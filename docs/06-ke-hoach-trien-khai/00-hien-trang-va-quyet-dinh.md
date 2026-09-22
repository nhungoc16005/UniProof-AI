# Hiện trạng và các quyết định làm cơ sở chia task

Khảo sát repo ngày 22/09/2026. Đây là đánh giá từ file hiện có, chưa chạy ứng dụng hay xác nhận kết nối database bên ngoài.

## 1. Đã đọc và đối chiếu

| Nhóm nguồn | Kết quả khảo sát |
|---|---|
| `EduPoint_API_BE.md` | Danh mục endpoint, envelope, 4 trục trạng thái, review, điểm, scope, pipeline và mapping trang |
| `EduPoint_ThietKe_Trang_FE.md` | 37 mã trang C01–C07, S01–S09, O01–O10, A01–A11; luồng và component |
| Hai bản tài liệu tính năng/techstack + `cautruc.md` | Phân công A/B/C, NestJS + Web React/Vite + Expo + FastAPI AI; nhiều mô tả cũ khác API |
| `docs/05-feature-specs` | 36 spec giao diện và 1 spec pipeline; không có file spec C06 riêng, nhưng C06 có trong thiết kế FE |
| Hai schema Prisma + SQL | Có mô hình cơ sở, nhưng chưa đủ để thực hiện contract API; Prisma trong app thêm `directUrl` so với bản docs |
| `apps/backend/prisma/seed.ts` | Có khoa/lớp/tiêu chí/user mẫu; kỳ ACTIVE là 2024–2025, không phù hợp demo hiện tại; chưa cấp tài khoản Supabase Auth |
| Package/config/env/requirements/lockfile | Backend chỉ khai báo Prisma/dotenv và công cụ TS; script Nest có nhưng thiếu dependency/bootstrap Nest; Python có requirements |
| Source BE/Web/Mobile/AI/research và workflow | Các file nguồn ứng dụng hiện là placeholder 0 byte; dataset, notebook và model weights cũng rỗng; workflow CI/CD chưa có nội dung |
| README/workspace và docs còn lại | `README.md`, root `package.json`, `pnpm-workspace.yaml`, phân công và hai tài liệu UI trong docs đều rỗng |
| `docs/00-nghiep-vu-goc/*.docx` | File **0 byte**, không có nội dung nghiệp vụ để đọc/xác minh; không thể coi các con số mẫu là quy định chính thức |

Chưa có cơ sở đánh dấu BE, FE, model, CI hay deployment là đã hoàn thành. Không chạy migrate/seed trong lượt lập kế hoạch này.

## 2. Quy ước nguồn và stack cho kế hoạch

Đây là **phương án triển khai mặc định để tiến hành**, được ghi lại ở PL-01; chưa phải thay đổi đã thực hiện trong source.

| Vấn đề | Chênh lệch hiện tại | Phương án của kế hoạch |
|---|---|---|
| Backend | API nói FastAPI monolith/MinIO/Celery; cấu trúc, package và tổng quan nói NestJS/Supabase/BullMQ | Giữ **NestJS + Prisma + Supabase PostgreSQL/Auth/Storage + BullMQ/Redis** cho Core; FastAPI dành cho AI inference |
| Frontend | FE ghi React/Next.js và student web; cấu trúc là Vite + Expo | Web React/Vite cho Officer/Admin; Expo cho Student; mã trang là trace ID, route mobile thích nghi với Expo Router |
| Nguồn API | Feature spec và API tổng lệch ID/path/method/payload | Dùng **bảng endpoint trong API tổng** làm gốc; PL-02 tạo OpenAPI chuẩn và cập nhật mapping. Không copy endpoint từ spec con khi chưa đối chiếu |
| Vai trò | `STAFF`, `OFFICER`, `officer`, có tài liệu gốc ghi 4 role | API chuẩn dùng `STUDENT/OFFICER/ADMIN`; migration đổi STAFF hoặc adapter có test, không để FE tự đoán. Admin quản trị; duyệt của Admin mặc định tắt |
| Trạng thái | DB gộp một EvidenceStatus; API có 4 trục | Bổ sung `pipeline_status`, `verification_status`, `review_status`, `appeal_status`; BE tính `display_status` |
| Quy tắc điểm | Seed, UI ví dụ, mục 8/9/10/12/13 không cùng bảng nhãn/điểm | Rule/criterion có version và nguồn. Dữ liệu demo phải gắn nhãn demo; quy chế thật còn thiếu là đầu vào bắt buộc trước nghiệm thu nghiệp vụ chính thức |
| Trần và xếp loại | Nhiều con số hard-code trong spec | Lưu cấu hình theo kỳ/version; FE đọc API, không hard-code điểm/threshold từ ảnh minh họa |
| Xác minh | AI01 lẫn xác minh nội bộ với L1–L5; ví dụ `level >= 2` có thể coi cả L5 là mạnh | Tách I1–I3 nội bộ và L1–L5 ngoài trường, enum rõ nghĩa. L1 mạnh nhất; L5 luôn cần người xem, không suy luận bằng so sánh số |
| Auto-approve | O06 đề nghị tự duyệt ngay sau import; API mặc định tắt | Core luôn Officer quyết định. Import chỉ đối chiếu dữ liệu; không ghi điểm tự động. Tự duyệt thuộc P3 |
| Hết hạn bổ sung | S06 tự REJECT; thiết kế FE chỉ chặn nộp | Chặn nộp sau hạn và đưa cán bộ xử lý, **không tự từ chối**. Muốn đổi chính sách cần căn cứ nghiệp vụ và task riêng |
| Khiếu nại | Spec cho APL resolve sửa điểm trực tiếp; API REOPEN rồi REV-01 | APL chỉ mở lại hoặc bác; mọi thay đổi điểm qua cùng luồng review + Rule Engine + transaction |
| Withdraw | API cho “chưa APPROVED”, S04 không cho REJECTED | Core cho DRAFT/SUBMITTED/đang chờ/NEEDS_SUPPLEMENT trước quyết định cuối, chặn khi có appeal đang mở. Ghi rõ đây là quyết định chuẩn hóa ở PL-03 |
| Threshold/SLA | 48/72 giờ; abstain 0,60/0,70; RAG 0,55/0,70/0,75 | SLA Core khởi tạo demo 72 giờ theo API tổng; AI threshold do C hiệu chỉnh trên validation và bàn giao config version, không coi con số ví dụ là đã tối ưu |
| RAG/embedding | Provider không thống nhất; DB cố định vector(1536) | C chốt model và dimension tại AI-10; A tạo migration tương ứng khi ghép, không giả định mọi model ra 1536 chiều |
| Phiên bản thư viện | Tài liệu liệt kê phiên bản cũ hoặc “Latest” | BE-01/FE-01/AI-02 chốt và khóa bộ dependency tương thích khi triển khai; kế hoạch không khẳng định các version trong docs là mới nhất |

Thứ tự xử lý mâu thuẫn: yêu cầu mới của chủ dự án → quyết định được ghi trong bộ plan này → OpenAPI chuẩn hóa từ API tổng → thiết kế FE → spec con → schema/seed hiện tại. Quy chế chính thức khi được cung cấp phải được đối chiếu lại, không tự thay bằng ví dụ trong tài liệu.

## 3. Những mapping cần sửa trước khi code

| Nghiệp vụ | Contract API tổng cần dùng | Ví dụ sai/lệch trong spec con |
|---|---|---|
| Đổi/quên/reset mật khẩu | AUTH-05 / AUTH-06 / AUTH-07 | C02/C03 gán ID khác |
| Tạo/list nháp | `POST /evidence`, `GET /evidence` | `/evidence/draft`, `/evidence/my` |
| Sửa OCR/bổ sung/rút | EVD-09 / EVD-10 / EVD-11 | S04–S06 đảo ID; PIPE-02 bị dùng cho sửa OCR |
| SSE | EVD-08 `/evidence/{id}/events` | `/stream` |
| Lịch sử/claim/bulk review | REV-02 / REV-03 `/assign` / REV-04 | Spec dùng REV-02 cho bulk, REV-04 cho unlock |
| Điểm danh | ACT-06 đọc / ACT-07 import / ACT-08 sửa | O06 đảo GET và import |
| Khiếu nại | APL-02 danh sách / APL-03 chi tiết / APL-04 resolve | APL-05 không có trong API tổng |
| Tra cứu/điểm | SCO-01 dashboard / SCO-02 scores / SCO-04 students / SCO-05 profile | S09 gán SCO-04 cho export PDF |
| Public confirmation | EXT-06/07 | PUB-01/02 không có trong API tổng |
| Thông báo | NOTI-01 có `meta.unread_count`; NOTI-02 là PATCH | NOTI-04 và POST read trong spec |
| Rule, KB, audit, job, dataset, evaluation | Đối chiếu từng dòng ADM trong API tổng | Nhiều ID trỏ nhầm chức năng; đặc biệt ADM-JOB-04 là health, không phải xóa job |

Danh sách trên chỉ là các lệch đã phát hiện, **PL-02 phải đối chiếu toàn bộ endpoint**, không chỉ sửa các ví dụ này. Các tính năng chưa có API như đăng ký hoạt động, PDF bảng điểm có chữ ký số, reorder file cần được đánh dấu mở rộng; không tái sử dụng ID khác để lấp chỗ trống.

## 4. Khoảng thiếu database cần đưa vào migration

| Nhóm | Cần bổ sung/điều chỉnh | Task |
|---|---|---|
| Users/Auth | Supabase UID thật; scope nhiều khoa/lớp; khóa tài khoản và thu hồi phiên | BE-02, BE-03, BE-05 |
| Term/Activity | Term lifecycle, scope đơn vị tổ chức, archive, criterion mặc định, attendance PRESENT/ABSENT/UNKNOWN | BE-02, BE-06, BE-08 |
| Evidence/File | 4 trục; DRAFT mặc định; submittedAt nullable khi nháp; metadata/storage key, scan status/hash, khai báo ngoài trường, revision | BE-02, BE-09, BE-10 |
| Rule/Criterion | Cây tiêu chí, version bất biến, hiệu lực, trần khung/mục, snapshot quyết định; precision điểm | BE-02, BE-07, BE-12 |
| Review/Appeal | active decision, lịch sử thay thế, expected_version, reason, idempotency và hết hạn lock | BE-13, BE-16 |
| Điểm | Ledger/đóng góp duy nhất mỗi hồ sơ, snapshot chốt kỳ; chặn race giữa nhiều hồ sơ cùng sinh viên | BE-13, BE-15, BE-18 |
| Nguồn xác minh | Tách hai câu hỏi enum (boolean không đủ diễn đạt chưa rõ/mâu thuẫn), nguồn và tác giả, manual verification | BE-11, BE-17 |
| Jobs/Audit/Notification | Outbox hoặc cơ chế đảm bảo DB→queue; retry; request_id/reason/system actor; bảo vệ append-only | BE-04, BE-10, BE-14, BE-21 |
| AI/RAG sau này | PipelineRun/step history, original/corrected OCR, model/config version; Top-K/citation/abstention; KB chunks với trang/điều/khoản; GT/EvaluationRun | BE-23, INT-01, INT-04, INT-06 |

SQL hiện dùng snake_case/tên bảng số nhiều, Prisma chưa có mapping tương ứng. Không chạy cả hai schema để tạo hai bộ bảng; BE-02 chọn Prisma migrations làm nguồn thực thi và đồng bộ docs từ đó.

## 5. Hạn chế và đầu vào còn thiếu

- Chưa có tài liệu nghiệp vụ gốc có nội dung. PL-03 phải ghi nguồn quy chế/điểm chính thức trước khi xác nhận hệ thống tính đúng cho trường; việc dựng nền tảng và demo vẫn làm được bằng fixture rõ nhãn.
- Chưa có deadline, ngân sách dịch vụ AI hay máy training. C đo thực tế trước khi cam kết độ trễ/chi phí.
- Các mục tiêu Macro-F1 ≥ 0,85, pipeline ≤ 15 giây, giảm thời gian duyệt ≥ 70% trong tổng quan là **mục tiêu cần đo**, không phải kết quả có sẵn. Không dùng số ví dụ trong response làm số liệu báo cáo.
- Không tự thêm SSO thật, chữ ký số, tích hợp hệ thống trường hay cơ chế phát hiện ảnh giả có tính kết luận vào bản Core.
