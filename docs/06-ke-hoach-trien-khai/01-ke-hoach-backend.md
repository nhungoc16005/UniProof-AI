# Kế hoạch riêng người A — Backend và dữ liệu

Tài liệu này là backlog làm việc độc lập của **người A**. Người A chỉ cần theo file này cho phần Core Backend; các dependency `FE-*` là mốc bàn giao cho người B, không phải task của A.

Phạm vi sở hữu: `apps/backend`, Prisma migrations/seed, OpenAPI, PostgreSQL/Supabase, Auth/Storage, Redis/BullMQ, Rule Engine, audit, báo cáo, CI và vận hành Core. AI inference, OCR và RAG thuộc người C.

## Cách bàn giao với FE

Mỗi nhóm API chỉ được báo “sẵn sàng cho FE” khi có OpenAPI cập nhật, migration/seed cần thiết, fixture success/error, tài khoản test và lệnh chạy. A gửi cho B theo các mốc `BA-1` đến `BA-5`; không chờ toàn bộ Backend hoàn thành mới bàn giao.

| Mốc | Gói bàn giao cho B | Task phải xong |
|---|---|---|
| BA-1 | Auth, `/me`, role/scope, enum lỗi | PL-01…03, BE-01…04 |
| BA-2 | User, khoa/lớp/kỳ, tiêu chí, hoạt động/điểm danh | BE-05…08 |
| BA-3 | Evidence draft/upload/submit/list/detail/status/file/timeline | BE-09…11 |
| BA-4 | Rule, queue/review, bổ sung, điểm, appeal, nguồn xác minh, chốt kỳ | BE-12…18 |
| BA-5 | Notification, report/export, audit/health/job, reset password, no-AI capability | BE-19…23 |

## GĐ0 — Chốt kiến trúc và hợp đồng

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | PL-01 · S | Ghi ADR stack, package manager, repo layout, môi trường Core/AI tách biệt | Không | Core install/build không kéo torch/model/AI SDK; A/B/C thống nhất kiến trúc |
| [ ] | PL-02 · L | Đối chiếu toàn bộ API tổng với spec con; viết OpenAPI/DTO, enum, envelope lỗi, fixture success/error/no-AI | PL-01 | Không còn ID trùng chức năng; B validate fixture; C nhận contract version |
| [ ] | PL-03 · M | Chốt state machine 4 trục, scope, trần điểm, withdraw, bổ sung, appeal, chốt/mở kỳ | PL-01 | Có transition table, ca biên từng luật; dữ liệu demo tách quy chế chính thức |
| [ ] | PL-05 · S | Tạo fixture xuyên suốt và seed scenario cho A/B | PL-02, PL-03 | 2 khoa, ≥2 lớp, Officer khác scope, Admin/Student và hồ sơ đủ trạng thái; seed lặp không nhân bản |

PL-04 thuộc backlog FE; A chỉ review route/permission mapping của B.

## GĐ1 — Nền tảng Backend

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | BE-01 · M | Bootstrap NestJS, root workspace, validation, exception filter, request_id, health, Swagger | PL-01, PL-02 | Checkout sạch cài/start/build/typecheck được; health và validation đúng envelope |
| [ ] | BE-02 · L | Thiết kế schema Core, Prisma migrations, index/FK/precision và seed repeatable | PL-03, PL-05, BE-01 | DB trống migrate được; có 4 trục trạng thái, scope, criterion version; không chạy vào production |
| [ ] | BE-03 · L | Supabase Auth, UID mapping, guards role/scope, refresh/logout/đổi mật khẩu cho Web và Mobile | BE-02, PL-02 | AUTH-01…05 chạy thật; Student/Officer đúng scope; khóa/đổi role có hiệu lực; refresh reuse bị từ chối |
| [ ] | BE-04 · M | Storage private, Redis/BullMQ cơ bản, config validation, health và audit writer | BE-01, BE-02 | Core boot không cần AI key; signed storage private; job demo chạy; thiếu config báo rõ |

**BA-1:** gửi OpenAPI, URL dev, `.env.example`, tài khoản 3 role và fixture lỗi cho B. Web refresh qua HttpOnly cookie; Mobile dùng secure storage theo contract riêng. Seed phải link tài khoản Auth thật, không chỉ tạo UUID trong bảng ứng dụng.

## GĐ2 — Dữ liệu nền và nộp minh chứng

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | BE-05 · M | User CRUD/import/khóa/reset/scope; ADM-USR-01…09 | BE-03, BE-04 | Import preview+commit không trùng; không tự nâng role; khóa chặn request tiếp theo |
| [ ] | BE-06 · M | Khoa/lớp/đơn vị/kỳ/enum; REF, ADM-ORG, ADM-TRM | BE-02, BE-03 | Validate ngày/hạn/lifecycle; không xóa dữ liệu tham chiếu; endpoint thiếu được bổ sung contract |
| [ ] | BE-07 · M | Cây tiêu chí, version, hiệu lực và metadata quy chế; CRI, ADM-CRI | BE-06, PL-03 | Trần/điều kiện đọc qua API; archive thay xóa; version cũ bất biến |
| [ ] | BE-08 · L | Hoạt động nội bộ và điểm danh; ACT-01…08 | BE-06, BE-07 | Import CSV/XLSX dry-run+commit; báo dòng lỗi/trùng; scope đúng; không tự cộng điểm |
| [ ] | BE-09 · L | Evidence draft, file CRUD/list/detail/signed URL; EVD-01/02/03/05/06/12/14 | BE-03, BE-04, BE-06, BE-08 | Nháp CRUD; JPEG/PNG/PDF ≤10 MB, ≤5 file; magic bytes/quarantine/scan; kiểm quyền evidence và file ID |
| [ ] | BE-10 · L | Submit/manual processor/status/timeline/withdraw; EVD-04/07/11/13 | BE-09, PL-03 | Idempotency; chỉ file CLEAN; outbox/recovery; không AI vẫn đến PENDING_REVIEW; retry không nhân đôi |
| [ ] | BE-11 · M | Đối chiếu nội bộ và manual verification DTO; PIPE-03 đọc | BE-08, BE-10 | Tách dữ liệu khai/kiểm chứng; I1–I3 khác L1–L5; certificate-only cần người xem; hai câu hỏi độc lập |

**BA-2:** bàn giao sau BE-05…08. **BA-3:** bàn giao sau BE-09…11, kèm mẫu file sạch/lỗi và hướng dẫn signed URL.

## GĐ3 — Rule Engine, review và điểm

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | BE-12 · L | Rule Engine + rule CRUD/validate/publish; ADM-RUL-01…05/07, PIPE-07 | BE-07, PL-03 | Chạy khi AI tắt; kiểm eligibility/evidence/duplicate/deadline/cap; output giải thích + version |
| [ ] | BE-13 · L | Officer queue, claim/release, review/history; OFF-01/02, REV-01…03 | BE-10/11/12 | Transaction recheck scope/lock/version/kỳ/cap; concurrent review không ghi đúp; audit đầy đủ |
| [ ] | BE-14 · M | Supplement theo request_id, file/url/text/deadline; EVD-10 | BE-13, BE-09 | Đúng chủ hồ sơ/yêu cầu; file mới scan; giữ lịch sử; quá hạn chặn và báo Officer |
| [ ] | BE-15 · L | Dashboard/bảng điểm/tra cứu/trace; SCO-01/02/04/05, PIPE-09 | BE-13 | Chỉ active APPROVED contribution; pending tách riêng; trace có rule version/reviewer; aggregate đúng scope |
| [ ] | BE-16 · M | Appeal create/list/detail/resolve; APL-01…04 | BE-13, BE-15, PL-03 | REOPEN qua REV-01; bác giữ quyết định gốc; không double-count; kiểm hạn và appeal đang mở |
| [ ] | BE-17 · M | Nguồn xác minh ngoài trường thủ công; EXT-03/04/12 | BE-11, BE-13 | L4 chỉ existence; verified-by-officer không giả thành L1; thiếu DB không tự reject |
| [ ] | BE-18 · M | Chốt/mở kỳ và snapshot điểm; ADM-TRM-03/04 | BE-15, BE-16 | Chống race review/close; kỳ đóng chặn mutation; reopen có reason/audit và giữ snapshot cũ |

Trần cộng dồn phải serialize theo sinh viên+kỳ trong transaction; optimistic lock một evidence không đủ. Khi appeal REOPEN, quyết định mới thay đóng góp cũ, không cộng thêm một dòng điểm.

**BA-4:** gửi B kịch bản approve/modify/reject/supplement/appeal, ca 409 lock/version/TERM_CLOSED và response trace.

## GĐ4 — Hoàn thiện Backend Core

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | BE-19 · M | Notification NOTI-01…03 và event nghiệp vụ; device token nếu bật push | BE-13/14/16 | Đúng user, unread/read-all; retry không trùng; deep link không bỏ qua scope |
| [ ] | BE-20 · L | Báo cáo và export; RPT-01/02/03/06/07 | BE-15, BE-18, BE-04 | Dữ liệu điểm chính thức; job/export đúng filter và scope; signed download URL |
| [ ] | BE-21 · M | Audit read/detail, dashboard, health, job list/detail/retry | BE-04, BE-13, BE-18, BE-20 | Audit append-only; health AI tắt=DISABLED; retry không lặp quyết định |
| [ ] | BE-22 · M | AUTH-06/07 forgot/reset và session invalidation | BE-03 | Không lộ email tồn tại; token một lần/quá hạn; test email sandbox |
| [ ] | BE-23 · M | No-AI adapter/capability/nullable result; kho tài liệu metadata/download/archive cơ bản | BE-04, PL-02, AI-01 | Core không import/load provider; AI chưa chạy có availability rõ; không báo indexed giả |

**BA-5:** bàn giao toàn bộ API Core, capability no-AI, report/export, notification và admin operations cho B.

## GĐ5 — Kiểm thử và bàn giao Backend

| Xong | ID / Cỡ | Việc của A | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | QA-01 · M | Contract + RBAC/IDOR test mọi endpoint/file/export/aggregate | BE-01…23 | Khác owner/out-of-scope→404; service key không lộ; Admin không duyệt mặc định |
| [ ] | QA-02 · L | Test transition, transaction, score, idempotency, queue recovery | BE-12…21 | Không vượt trần/double-count; rule version bất biến; close/review race bị chặn |
| [ ] | QA-04 · M | CI lint/typecheck/build/test/migration; staging, backup/restore, secrets | QA-01, QA-02 | Checkout sạch tái lập; workflow thật; restore thử trên DB dev; AI optional |
| [ ] | QA-06 · S | Backend release notes, API changelog và runbook dev/demo | QA-04, QA-03 | Không còn lỗi chặn; B replay được seed và các flow; giới hạn còn lại ghi rõ |

`QA-03` và `QA-05` do B sở hữu trong plan FE; A hỗ trợ API/staging. Backend hoàn thành khi QA-01/02/04 đạt và B xác nhận E2E không còn blocker do API.

## Definition of Done của A

- Contract/OpenAPI, validation, role/scope và error envelope đã cập nhật.
- Migration/seed repeatable; mutation quan trọng có transaction, audit và idempotency phù hợp.
- Test nghiệp vụ, bảo mật và race condition tương xứng rủi ro đã đạt.
- B có fixture/tài khoản/URL dev và ghép được API thật; mock không được tính là nghiệm thu Backend.
- Core chạy khi AI service và AI key hoàn toàn vắng mặt.

## Thứ tự bắt đầu của A

`PL-01 → PL-02/PL-03 → PL-05 → BE-01 → BE-02 → BE-03/04 → BA-1`, sau đó đi lần lượt BA-2, BA-3, BA-4 và BA-5.
