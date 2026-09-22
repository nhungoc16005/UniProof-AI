# EduPoint — Thiết kế API Backend cho Frontend

> **Phiên bản:** 1.0 · **Ngày:** 21/09/2026 · **Stack:** FastAPI (monolith theo module) · PostgreSQL + pgvector · MinIO · Task queue (đề xuất Celery/ARQ + Redis) · JWT
> **Đi kèm:** `EduPoint_ThietKe_Trang_FE.md` (thiết kế chi tiết từng trang). Cột **"FE dùng"** trong mọi bảng dưới đây được sinh tự động từ file thiết kế trang, nên hai file luôn khớp nhau.

---

## 0. Đọc nhanh

- **3 role:** `S` = Student (Sinh viên) · `O` = Officer (Cán bộ/Khoa) · `A` = Administrator (Quản trị viên, gồm cả vai trò "người phụ trách quy định" trong tài liệu nghiệp vụ). `*` = mọi người dùng đã đăng nhập, `pub` = công khai (có token riêng).
- **Cột P (ưu tiên):** `M` = MVP · `A` = Advanced (làm sau MVP), theo mục 38–40 của tài liệu đề tài.
- **Mã endpoint** (`EVD-01`, `PIPE-05`, `ADM-RUL-07`…) là khóa tham chiếu giữa hai file.
- **Base URL:** `/api/v1`. Các đường dẫn trong bảng viết tắt, không kèm tiền tố này.
- Các endpoint gốc đã có trong tài liệu đề tài (mục 26) được giữ nguyên tên: `POST /evidence`, `GET /evidence/{id}/status`, `POST /evidence/{id}/ocr`, `GET /evidence/{id}/ai-recommendation`, `POST /evidence/{id}/review`, `POST /evidence/{id}/appeal`, `GET /criteria`, `POST /admin/rules`, `POST /rag/query`, `GET /students/{id}/what-can-i-claim`, `GET /admin/audit-logs`, `GET /admin/ai-evaluation/dashboard`.

### Ba nguyên tắc BE phải bảo vệ (ảnh hưởng trực tiếp tới thiết kế API)

| # | Nguyên tắc | Hệ quả thiết kế API |
|---|---|---|
| 1 | **"Không đủ bằng chứng ≠ bằng chứng giả"** | BE **không có** trạng thái tự động "FAKE". Certificate-only ⇒ mặc định `NEEDS_HUMAN_REVIEW`. API reject **bắt buộc** `reject_basis` cụ thể và **cấm** lý do kiểu "không có trong dữ liệu trường" (`REJECT_BASIS_INVALID`). |
| 2 | **AI đề xuất, Rule Engine chốt chặn, Người quyết định** | Mọi response điểm luôn tách `suggested_score` (AI) ≠ `final_recommended_score` (đã qua Rule Engine) ≠ `final_score` (Officer chốt). Officer không thể nhập điểm vượt trần (`RULE_MAX_SCORE_EXCEEDED`). |
| 3 | **Hai câu hỏi xác minh tách biệt** | Verification luôn trả `activity_existence` và `participation` là hai trường độc lập; Level 4 chỉ được phép tác động tới `activity_existence`. |

---

## 1. Kiến trúc BE và vai trò từng module (ánh xạ sang FE)

Monolith FastAPI chia module rõ ràng. Chỉ các module có "Nhóm API" mới mở HTTP cho FE; `ocr/`, `verification/`, `ai/`, `rule_engine/` chạy trong worker và FE chỉ đọc **kết quả** của chúng.

| Module BE | Trách nhiệm | Nhóm API (mã) | Trang FE chính |
|---|---|---|---|
| `auth/` | JWT, refresh, RBAC, row-level scope (sinh viên chỉ thấy dữ liệu mình; officer theo khoa/lớp) | `AUTH` | C01, C02, C03 |
| `core/` | Người dùng, khoa, lớp, kỳ đánh giá, danh mục enum, thông báo | `REF`, `NOTI`, `ADM-USR`, `ADM-ORG`, `ADM-TRM` | A02, A03, C05 |
| `catalog/` | Tiêu chí, hoạt động nội bộ, điểm danh | `CRI`, `ACT`, `ADM-CRI` | S02, O06, O08, A04 |
| `evidence/` | Vòng đời hồ sơ minh chứng: nháp → nộp → bổ sung → rút; file, hash, quét virus | `EVD` | S03–S06, O03 |
| `ocr/` | Tiền xử lý ảnh → PaddleOCR → trích xuất thực thể (LLM) → chuẩn hóa → JSON kèm confidence | `PIPE-01/02` | S05, O03 |
| `verification/` | Nội bộ 3 lớp, ngoài trường 5 cấp, Evidence Gap, phát hiện trùng lặp, risk signal | `PIPE-03/04/08`, `EXT` | S05, O03, O04, O05 |
| `ai/` | Phân loại hoạt động, ánh xạ tiêu chí Top-K, đề xuất điểm, giải thích, **abstention** | `PIPE-05/06/11` | S05, O03 |
| `rule_engine/` | Luật tường minh, độc lập LLM: eligibility, max score, duplicate, required evidence, trần tích lũy, hạn nộp | `PIPE-07`, `ADM-RUL` | O03, A05 |
| `rag/` | Chunk theo Điều/Khoản, embedding, truy hồi, trả lời kèm citation, từ chối khi thiếu căn cứ | `RAG`, `ADM-KB` | C04, A06 |
| `review/` | Quyết định của Officer, khiếu nại, khóa xử lý (soft-lock) | `REV`, `APL`, `OFF` | O02, O03, O07, S07 |
| `reporting/` | Tổng hợp thống kê, xuất báo cáo | `RPT`, `SCO`, `ADM-DSH` | S01, S09, O01, O10, A01 |
| `audit/` | Nhật ký append-only, hash-chain | `ADM-AUD` | A10 |
| `evaluation/` | Ground Truth, chạy thí nghiệm, ablation, selective prediction | `ADM-GT`, `ADM-EVAL`, `ADM-AI` | A07, A08, A09 |
| `jobs/` | Hàng đợi bất đồng bộ, retry, health | `ADM-JOB`, SSE | A11, S05, O03 |

### 1.1 Hợp đồng dịch vụ nội bộ (không mở HTTP)

| Hàm nội bộ | Vào | Ra | Ghi chú |
|---|---|---|---|
| `ocr.process(file_id)` | file đã CLEAN | `OCRResult{raw_text, fields[], quality}` | Field có `confidence`; dưới ngưỡng ⇒ `low_confidence=true` |
| `verification.run_internal(evidence)` | fields + Student/Activity/Attendance DB | 3 layer result | Identity → Activity → Attendance |
| `verification.run_external(evidence)` | fields + nguồn xác minh | Level 1–5 + 2 câu hỏi tách biệt | Level 5 ⇒ `NEEDS_HUMAN_REVIEW` |
| `verification.check_source(type, value)` | URL / Certificate ID / QR | `CONFIRMED / NOT_CONFIRMED / UNREACHABLE` | Chống SSRF: allow-list giao thức, chặn IP nội bộ, timeout |
| `verification.detect_duplicates(evidence)` | sha256 + perceptual hash + (student, activity, term) | `duplicate_of[]` | Trùng và gần trùng |
| `ai.classify(evidence)` | fields (dưới dạng **data**, không phải instruction) | `activity_type, scope, confidence` | System prompt cố định + escaping |
| `ai.map_criteria(evidence, caps)` | + RAG context + mapping lịch sử | Top-K `[criterion, confidence, reason, citations]` hoặc `NO_MATCH` | Không được tự tạo tiêu chí |
| `ai.recommend(evidence, criterion, cap)` | | `suggested_score, reason, confidence, abstained` | Confidence thấp ⇒ abstain |
| `rule_engine.get_cap(criterion, ctx)` | | `maximum_allowed_score` | Đưa vào prompt AI làm ngữ cảnh |
| `rule_engine.evaluate(evidence, criterion, suggested)` | | `checks[], final_recommended_score, capped` | **Luôn gọi sau AI**, kết quả là thẩm quyền cuối |
| `rag.answer(question, ctx?)` | | `answer, citations[], answer_status` | Similarity dưới ngưỡng ⇒ `NO_EVIDENCE` |

---

## 2. Quy ước chung

**2.1 Giao thức.** JSON UTF-8; `multipart/form-data` cho upload. Thời gian ISO-8601 UTC (FE quy đổi sang `Asia/Ho_Chi_Minh`). ID dạng UUID.

**2.2 Xác thực.** `Authorization: Bearer <access_token>` (JWT, sống 15 phút). Refresh token lưu trong cookie `httpOnly; Secure; SameSite=Strict` (7 ngày, xoay vòng mỗi lần refresh). FE giữ access token trong bộ nhớ, không lưu localStorage.

**2.3 Envelope thành công**
```json
{ "data": { }, "meta": { "page": 1, "page_size": 20, "total": 135, "unread_count": 3 }, "request_id": "req_8f2c" }
```

**2.4 Envelope lỗi**
```json
{ "error": { "code": "RULE_MAX_SCORE_EXCEEDED", "message": "Điểm vượt trần 3 của tiêu chí C03.",
             "details": [ { "field": "final_score", "issue": "max=3" } ] }, "request_id": "req_8f2c" }
```

| HTTP | Mã lỗi thường gặp |
|---|---|
| 400/422 | `VALIDATION_ERROR`, `REASON_REQUIRED`, `REJECT_BASIS_INVALID`, `RULE_MAX_SCORE_EXCEEDED`, `FILE_INFECTED` |
| 401 | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED` |
| 403 | `FORBIDDEN` (sai role hoặc ngoài scope) |
| 404 | `NOT_FOUND` (sinh viên truy cập hồ sơ người khác cũng trả 404 để không lộ tồn tại) |
| 409 | `CONFLICT_VERSION`, `EVIDENCE_STATE_INVALID`, `TERM_CLOSED`, `APPEAL_WINDOW_CLOSED`, `IDEMPOTENCY_CONFLICT` |
| 413/415 | `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` |
| 429 | `RATE_LIMITED` (upload và RAG có hạn mức riêng; header `Retry-After`) |
| 503 | `AI_UNAVAILABLE` (chỉ với endpoint rerun; pipeline gốc không lỗi mà chuyển `NEEDS_HUMAN_REVIEW`) |

**2.5 Phân trang / lọc / sắp xếp.** `?page=1&page_size=20` (tối đa 100), `?sort=-created_at`, lọc theo tên trường. Danh sách trả `meta.total`.

**2.6 Đồng thời & idempotency.**
- Các bản ghi Officer sửa (review) mang trường `version`; request gửi `expected_version`, lệch ⇒ `409 CONFLICT_VERSION` (FE hiện hộp thoại "Hồ sơ vừa được cập nhật, tải lại?").
- `POST /evidence/{id}/submit`, `POST /evidence/{id}/review` bắt buộc header `Idempotency-Key` (chống bấm đúp).

**2.7 Bất đồng bộ.** Bước nặng (OCR, AI, verification, index KB, evaluation, export) chạy qua queue. Endpoint kích hoạt trả `202 Accepted` + `{ "job_id": "...", "status_url": "..." }`. FE theo dõi bằng **SSE** (`EVD-08`) hoặc **polling** `EVD-07` mỗi 3 giây làm phương án dự phòng.

**2.8 Upload file.** Cho phép `image/jpeg`, `image/png`, `application/pdf`; tối đa **10 MB/file**, **5 file/hồ sơ**. BE kiểm tra MIME bằng magic bytes (không tin phần mở rộng), quét virus, tính `sha256` + perceptual hash, lưu MinIO. FE **không** nhận URL cố định: mỗi lần xem file gọi `EVD-12` để lấy signed URL sống 5 phút.

**2.9 Rate limit.** Upload: 30 file/giờ/người dùng. RAG: 20 câu/phút/người dùng. Login: 5 lần sai ⇒ khóa 15 phút.

---

## 3. Enum và mô hình trạng thái

FE nhận **danh sách enum kèm nhãn tiếng Việt** từ `REF-05`, không hard-code.

### 3.1 Bốn trục trạng thái của một hồ sơ (Evidence)

Trạng thái được tách thành các trục độc lập để tránh trộn "hệ thống xử lý tới đâu" với "đã đủ căn cứ chưa" và "người quyết định thế nào":

| Trục | Giá trị | Ý nghĩa |
|---|---|---|
| `pipeline_status` | `DRAFT` · `SUBMITTED` · `PROCESSING` · `PROCESSED` · `FAILED` | Tiến trình máy. `FAILED` không bao giờ chặn người dùng: hồ sơ vẫn chuyển sang xét duyệt với cờ `PIPELINE_ERROR`. |
| `verification_status` | `VERIFIED` · `PLAUSIBLE` · `SUSPICIOUS` · `INVALID` · `NEEDS_HUMAN_REVIEW` | Mức xác minh (mục 10.3 tài liệu nghiệp vụ). |
| `review_status` | `NOT_READY` · `PENDING_REVIEW` · `IN_REVIEW` · `NEEDS_SUPPLEMENT` · `APPROVED` · `REJECTED` · `WITHDRAWN` | Quyết định của con người. "Sửa điểm" là `APPROVED` kèm `score_modified=true`. |
| `appeal_status` | `NONE` · `SUBMITTED` · `IN_REVIEW` · `ACCEPTED` · `REJECTED` | Khiếu nại (nếu có). |

### 3.2 `display_status` (BE tính sẵn, FE chỉ hiển thị)

Thứ tự ưu tiên, dừng ở điều kiện đầu tiên khớp:

| Ưu tiên | Điều kiện | `display_status` | Nhãn (Sinh viên) |
|---|---|---|---|
| 1 | `review_status=WITHDRAWN` | `WITHDRAWN` | Đã rút |
| 2 | `pipeline_status=DRAFT` | `DRAFT` | Bản nháp |
| 3 | `appeal_status ∈ {SUBMITTED, IN_REVIEW}` | `APPEALING` | Đang khiếu nại |
| 4 | `review_status=APPROVED` | `APPROVED` | Đã được duyệt |
| 5 | `review_status=REJECTED` | `REJECTED` | Bị từ chối |
| 6 | `review_status=NEEDS_SUPPLEMENT` | `NEEDS_SUPPLEMENT` | Cần bổ sung |
| 7 | `pipeline_status ∈ {SUBMITTED, PROCESSING}` | `PROCESSING` | Đang xử lý |
| 8 | `verification_status=INVALID` | `INVALID` | Phát hiện mâu thuẫn, chờ cán bộ xác nhận |
| 9 | `verification_status=VERIFIED` | `VERIFIED` | Đã xác minh |
| 10 | `verification_status=PLAUSIBLE` | `PLAUSIBLE` | Có thể chấp nhận |
| 11 | còn lại (gồm `NEEDS_HUMAN_REVIEW`, `SUSPICIOUS`) | `NEEDS_HUMAN_REVIEW` | Cần cán bộ xem xét |

> `SUSPICIOUS` **không** hiển thị cho sinh viên dưới tên đó (tránh gán nhãn nghi ngờ khi chưa có người xác nhận); sinh viên chỉ thấy "Cần cán bộ xem xét". Officer thấy nhãn thật.

### 3.3 Hai câu hỏi xác minh (luôn tách biệt)

| Trường | Giá trị |
|---|---|
| `activity_existence` | `CONFIRMED` · `PLAUSIBLE` · `UNCONFIRMED` · `CONTRADICTED` |
| `participation` | `CONFIRMED` · `NOT_INDEPENDENTLY_VERIFIED` · `CONTRADICTED` |

### 3.4 Enum khác

| Enum | Giá trị |
|---|---|
| `scope` | `INTERNAL` · `EXTERNAL` · `UNKNOWN` (sinh viên chọn "không chắc"; AI phân loại lại) |
| `evidence_type` | `CERTIFICATE` · `PARTICIPATION_CONFIRMATION` · `EMAIL_CONFIRMATION` · `RESULT_ANNOUNCEMENT` · `PARTICIPANT_LIST` · `PHOTO` · `OTHER` |
| `participation_role` | `ATTENDEE` · `VOLUNTEER` · `CONTESTANT` · `AWARDEE` · `ORGANIZER_MEMBER` · `OTHER` |
| `verification_level` (ngoài trường) | `L1_OFFICIAL` · `L2_ORGANIZER_CONFIRMATION` · `L3_PARTICIPANT_REGISTRY` · `L4_PUBLIC_SOURCE` · `L5_CERTIFICATE_ONLY` |
| `internal_layer` | `I1_IDENTITY` · `I2_ACTIVITY` · `I3_ATTENDANCE` |
| `attendance_status` | `PRESENT` · `ABSENT` · `UNKNOWN` |
| `ai_outcome` | `RECOMMENDED` · `ABSTAINED` · `NO_MATCH` · `ERROR` |
| `review_action` | `APPROVE` · `REJECT` · `MODIFY` · `REQUEST_SUPPLEMENT` |
| `reject_basis` | `CONTRADICTION_FOUND` · `DUPLICATE_CONFIRMED` · `ACTIVITY_NOT_ELIGIBLE` · `PARTICIPATION_DISPROVEN` · `PAST_DEADLINE` · `DOCUMENT_UNREADABLE_AFTER_SUPPLEMENT` (**không có** `NOT_IN_DATABASE`) |
| `supplement_code` | `PARTICIPANT_LIST` · `ORGANIZER_CONFIRMATION` · `VERIFICATION_URL` · `CERTIFICATE_ID` · `RESULT_ANNOUNCEMENT` · `CLEARER_IMAGE` · `NAME_CLARIFICATION` · `TIME_PROOF` · `OTHER` |
| `verification_flag` | `UNVERIFIED_EXTERNAL_ACTIVITY` · `NEW_ACTIVITY_NEVER_SEEN` · `DUPLICATE_SUSPECTED` · `NAME_MISMATCH` · `STUDENT_ID_MISMATCH` · `ABSENT_IN_ATTENDANCE` · `LOW_OCR_CONFIDENCE` · `DATE_INCONSISTENT` · `STUDENT_EDITED_OCR` · `PIPELINE_ERROR` |
| `answer_status` (RAG) | `ANSWERED` · `NO_EVIDENCE` |

---

## 4. Danh mục API theo nhóm chức năng

Cột **FE dùng** liệt kê mã trang (xem file thiết kế trang). Dấu `—` nghĩa là endpoint chưa có trang nào gọi trực tiếp (nội bộ hoặc dùng cho tích hợp).

### 4.1 `AUTH` — Xác thực

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| AUTH-01 | POST | `/auth/login` | pub | Đăng nhập bằng MSSV/email + mật khẩu; trả access token + hồ sơ + role. Sai 5 lần ⇒ khóa tạm. | M | C01 |
| AUTH-02 | POST | `/auth/refresh` | pub (cookie) | Cấp lại access token, xoay vòng refresh token | M | C01 |
| AUTH-03 | POST | `/auth/logout` | * | Thu hồi refresh token | M | C03 |
| AUTH-04 | GET | `/auth/me` | * | Hồ sơ + role + scope (khoa/lớp) + danh sách quyền để FE dựng menu và route guard | M | C01, C03 |
| AUTH-05 | POST | `/auth/change-password` | * | Đổi mật khẩu (yêu cầu mật khẩu cũ) | M | C03 |
| AUTH-06 | POST | `/auth/forgot-password` | pub | Gửi email đặt lại mật khẩu (luôn trả 200, không lộ email có tồn tại) | A | C02 |
| AUTH-07 | POST | `/auth/reset-password` | pub | Đặt lại mật khẩu bằng token một lần | A | C02 |

### 4.2 `NOTI` và `REF` — Thông báo và dữ liệu tham chiếu

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| NOTI-01 | GET | `/notifications` | * | Danh sách thông báo của tôi; `meta.unread_count` cho chuông | M | C05, S01 |
| NOTI-02 | PATCH | `/notifications/{id}/read` | * | Đánh dấu đã đọc | M | C05 |
| NOTI-03 | POST | `/notifications/read-all` | * | Đánh dấu tất cả đã đọc | M | C05 |
| REF-01 | GET | `/terms` | * | Danh sách kỳ đánh giá; `?current=true` lấy kỳ đang mở (kèm hạn nộp, hạn khiếu nại, trạng thái mở/chốt) | M | S01, S02, S03, S04, S08, S09, O01, O02, O06, O09, O10, A03 |
| REF-02 | GET | `/faculties` | * | Danh sách khoa | M | O01, O02, O09, O10, A02, A03 |
| REF-03 | GET | `/classes` | * | Danh sách lớp (`?faculty_id=`) | M | O01, O02, O09, O10, A02, A03 |
| REF-04 | GET | `/organizers` | * | Autocomplete đơn vị tổ chức ngoài trường (`?q=`), gồm alias | M | S03, O05 |
| REF-05 | GET | `/meta/enums` | * | Toàn bộ enum + nhãn tiếng Việt + loại hoạt động (do Admin cấu hình) + loại minh chứng + mẫu lý do yêu cầu bổ sung | M | S03, O02, O03, O06, O08, A04, A05 |

### 4.3 `CRI` và `ACT` — Tiêu chí, hoạt động, điểm danh

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| CRI-01 | GET | `/criteria` | * | Cây tiêu chí → tiêu chí con (`?term_id=`) kèm điểm tối đa, loại minh chứng yêu cầu, loại hoạt động áp dụng, mô tả điều kiện dễ đọc | M | S02, S04, O02, O06, O08, A04, A05 |
| CRI-02 | GET | `/criteria/{id}` | * | Chi tiết một tiêu chí: điều kiện, cách tính, **trích dẫn quy chế** (Điều/Khoản), ví dụ hoạt động, và **tóm tắt rule đang hiệu lực** (mã rule, phiên bản, hiệu lực — chỉ đọc) | M | S02, O03, O08, A04 |
| ACT-01 | GET | `/activities` | * | Tìm hoạt động nội bộ (`?q=&term_id=&scope=&organizer_unit=&status=`); Student dùng làm autocomplete | M | S03, O06 |
| ACT-02 | GET | `/activities/{id}` | * | Chi tiết một hoạt động | M | S03, O06 |
| ACT-03 | POST | `/activities` | O,A | Tạo hoạt động nội bộ | M | O06 |
| ACT-04 | PUT | `/activities/{id}` | O,A | Sửa hoạt động | M | O06 |
| ACT-05 | DELETE | `/activities/{id}` | O,A | Lưu trữ (soft-delete). Nếu đã có hồ sơ tham chiếu thì chỉ archive, không xóa vật lý | M | O06 |
| ACT-06 | GET | `/activities/{id}/attendance` | O,A | Danh sách điểm danh (PRESENT/ABSENT) | M | O06 |
| ACT-07 | POST | `/activities/{id}/attendance/import` | O,A | Import CSV/XLSX điểm danh. `?dry_run=true` trả báo cáo lỗi (MSSV không tồn tại, dòng trùng) trước khi commit | M | O06 |
| ACT-08 | PUT | `/activities/{id}/attendance/{student_id}` | O,A | Đánh dấu điểm danh thủ công (bắt buộc lý do, ghi audit) | M | O06 |
| ACT-09 | GET | `/activities/{id}/evidence` | O,A | Các hồ sơ minh chứng gắn với hoạt động này | A | O06 |

### 4.4 `EVD` — Hồ sơ minh chứng (vòng đời và file)

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| EVD-01 | POST | `/evidence` | S | Tạo hồ sơ **nháp**: `scope_declared`, `activity_id` **hoặc** `external_activity{name, organizer_name, start_date, end_date, role, verification_url?, certificate_id?}`, `evidence_type`, `term_id`, `note` | M | S03 |
| EVD-02 | POST | `/evidence/{id}/files` | S | Upload **1 file** (multipart). Trả `file_id`, `scan_status` (`SCANNING`→`CLEAN`/`INFECTED`), hash | M | S03 |
| EVD-03 | DELETE | `/evidence/{id}/files/{file_id}` | S | Xóa file (chỉ khi `DRAFT`) | M | S03 |
| EVD-04 | POST | `/evidence/{id}/submit` | S | Chốt và **kích hoạt pipeline**. Yêu cầu ≥1 file `CLEAN` và `student_confirmed=true`. Trả `202` + `job_id`. Header `Idempotency-Key` | M | S03 |
| EVD-05 | GET | `/evidence` | S,O,A | Danh sách hồ sơ theo phạm vi quyền (S: của mình; O: theo khoa/lớp được giao; A: tất cả). Lọc: `term_id, display_status, verification_status, scope, criterion_id, student_id, class_id, q` | M | S01, S04, O05, O09, A08 |
| EVD-06 | GET | `/evidence/{id}` | S,O,A | Chi tiết hồ sơ; **cấu trúc response khác nhau theo role** (sinh viên không thấy `risk_signals`, confidence thô) | M | S03, S05, S06, S07, O03, O07, A08 |
| EVD-07 | GET | `/evidence/{id}/status` | S,O,A | Trạng thái nhẹ để polling: các bước pipeline, `display_status`, tóm tắt Evidence Gap | M | S05, O03 |
| EVD-08 | GET | `/evidence/{id}/events` | S,O,A | **SSE**: đẩy tiến trình pipeline và thay đổi trạng thái theo thời gian thực | A | S05, O03 |
| EVD-09 | PATCH | `/evidence/{id}/ocr-fields` | S,O | Xác nhận/sửa các trường OCR. Giá trị OCR gốc luôn được giữ; bản sửa ghi `source` (`STUDENT` / `OFFICER`), gắn cờ `STUDENT_EDITED_OCR` và chạy lại verification | M | S05, O03 |
| EVD-10 | POST | `/evidence/{id}/supplements` | S | Nộp bổ sung để trả lời yêu cầu của Officer (multipart: `request_id`, `files[]`, `url`, `text`). Chạy lại verification | M | S06 |
| EVD-11 | POST | `/evidence/{id}/withdraw` | S | Rút hồ sơ (khi chưa `APPROVED`) | M | S04, S05 |
| EVD-12 | GET | `/evidence/{id}/files/{file_id}/url` | S,O,A | Signed URL sống 5 phút. Officer/Admin truy cập được ghi audit | M | S05, S06, O03, O04 |
| EVD-13 | GET | `/evidence/{id}/timeline` | S,O,A | Lịch sử sự kiện (nộp, OCR xong, yêu cầu bổ sung, quyết định…). Bản của sinh viên đã lọc thông tin nội bộ | M | S05, O03 |
| EVD-14 | PATCH | `/evidence/{id}` | S | Sửa thông tin hồ sơ nháp (tự lưu theo từng bước wizard) | M | S03 |
| EVD-15 | POST | `/evidence/{id}/precheck` | S | Kiểm tra nhanh trước khi nộp: trùng lặp (hash), thiếu thông tin, ảnh mờ ⇒ trả `warnings[]` (không chặn) | A | S03 |

### 4.5 `PIPE` — Kết quả pipeline (đọc) và chạy lại (Officer/Admin)

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| PIPE-01 | GET | `/evidence/{id}/ocr` | S,O,A | Kết quả OCR: `raw_text`, `fields[]` (value, normalized, **confidence**, `low_confidence`, bbox, page, source), `quality` (mờ/nghiêng/thiếu sáng) | M | S05, O03 |
| PIPE-02 | POST | `/evidence/{id}/ocr` | O,A | Chạy lại OCR (`202`) | M | O03 |
| PIPE-03 | GET | `/evidence/{id}/verification` | S,O,A | Kết quả xác minh: lớp nội bộ I1–I3 **hoặc** cấp ngoài trường L1–L5, **hai câu hỏi tách biệt**, cờ, `risk_signals` (chỉ O,A) | M | S05, O03 |
| PIPE-04 | POST | `/evidence/{id}/verification/rerun` | O,A | Chạy lại verification (`202`) | M | O03 |
| PIPE-05 | GET | `/evidence/{id}/ai-recommendation` | S,O,A | Đề xuất AI mới nhất: loại hoạt động, scope, Top-K tiêu chí, `suggested_score`, `final_recommended_score`, lý do, citation, `abstained`. Sinh viên nhận bản rút gọn | M | S05, O03 |
| PIPE-06 | POST | `/evidence/{id}/ai-recommendation` | O,A | Chạy lại AI (`202`), tạo bản ghi lịch sử mới | M | O03 |
| PIPE-07 | GET | `/evidence/{id}/rule-check` | O,A | Kết quả Rule Engine: từng check (eligibility, max, duplicate, required evidence, trần tích lũy, hạn nộp) + `rule_id`/`rule_version` | M | O03 |
| PIPE-08 | GET | `/evidence/{id}/evidence-gap` | S,O,A | Phân tích "còn thiếu gì" + gợi ý bổ sung cụ thể | M | S05, S06, O03 |
| PIPE-09 | GET | `/evidence/{id}/score-trace` | S,O,A | Truy vết "Vì sao được X điểm?": điểm cuối → rule/tiêu chí → hoạt động → minh chứng → OCR → nguồn xác minh → quyết định Officer | M | S05, S09, O03 |
| PIPE-10 | POST | `/evidence/{id}/reprocess` | O,A | Chạy lại toàn bộ pipeline (`202`) | A | O03 |
| PIPE-11 | GET | `/evidence/{id}/ai-recommendation/history` | O,A | Lịch sử các lần AI chạy (model/prompt/rule version) | A | O03 |

### 4.6 `REV` và `OFF` — Xét duyệt và hàng đợi Officer

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| REV-01 | POST | `/evidence/{id}/review` | O,A | **Quyết định**: `APPROVE` · `REJECT` · `MODIFY` · `REQUEST_SUPPLEMENT`. Lý do bắt buộc (trừ APPROVE thuần); điểm không vượt trần; header `Idempotency-Key`; `expected_version` | M | O03 |
| REV-02 | GET | `/evidence/{id}/reviews` | O,A | Lịch sử các quyết định (ai, khi nào, trước/sau, lý do) | M | O03 |
| REV-03 | POST | `/evidence/{id}/assign` | O | `CLAIM` nhận xử lý (soft-lock 15 phút, tự gia hạn) hoặc `RELEASE` nhả | M | O02, O03 |
| REV-04 | POST | `/reviews/bulk-approve` | O | Duyệt hàng loạt các hồ sơ đã chọn thuộc diện "fast-track". BE **kiểm tra lại từng hồ sơ**; hồ sơ không đủ điều kiện bị loại kèm lý do | A | O02 |
| OFF-01 | GET | `/officer/queue` | O,A | Hàng đợi ưu tiên. `tab=pending\|needs_supplement\|auto_approved\|processed\|all` + bộ lọc; `sort=priority` (mặc định). Trả kèm `priority_score` và `priority_reasons[]` | M | O02 |
| OFF-02 | GET | `/officer/dashboard` | O,A | KPI: chờ xem xét, cần bổ sung, khiếu nại mới, auto-approved cần spot-check, thời gian xử lý TB, top 5 ưu tiên | M | O01 |
| OFF-03 | GET | `/officer/queue/next` | O | Lấy hồ sơ tiếp theo theo ưu tiên và tự `CLAIM` (luồng duyệt liên tục) | A | O02, O03 |

### 4.7 `EXT` — Xác minh hoạt động ngoài trường

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| EXT-01 | GET | `/external-activities` | O,A | Danh sách hoạt động ngoài trường đã được khai báo (`?q=&organizer_id=&is_new=`) | A | O05 |
| EXT-02 | GET | `/external-activities/{id}` | O,A | Chi tiết: tên chuẩn hóa, đơn vị, số hồ sơ, độ phủ xác minh, registry | A | O05 |
| EXT-03 | POST | `/evidence/{id}/external-verifications` | O | Ghi nhận **một nguồn xác minh**: `level` (L1–L4), `source_url`, `note`, `attachment`, `result` (`CONFIRMED`/`NOT_CONFIRMED`/`UNREACHABLE`), `addresses` (`ACTIVITY_EXISTENCE` và/hoặc `PARTICIPATION`) | M | O04 |
| EXT-04 | GET | `/evidence/{id}/external-verifications` | O,A | Danh sách nguồn xác minh đã ghi nhận | M | O03, O04 |
| EXT-05 | POST | `/evidence/{id}/organizer-confirmation-requests` | O | Tạo và gửi yêu cầu xác nhận tới đơn vị tổ chức (email kèm link có token). Trong phạm vi đồ án: mô phỏng bằng form nội bộ | A | O04 |
| EXT-06 | GET | `/public/organizer-confirmation/{token}` | pub | Đơn vị tổ chức xem thông tin cần xác nhận (dữ liệu cá nhân tối thiểu) | A | C07 |
| EXT-07 | POST | `/public/organizer-confirmation/{token}` | pub | Đơn vị tổ chức gửi xác nhận `CONFIRM`/`DENY` + ghi chú (token một lần, có hạn) | A | C07 |
| EXT-08 | POST | `/external-activities/{id}/participant-registry` | O | Import danh sách người tham gia do đơn vị tổ chức cung cấp (Level 3) | A | O05 |
| EXT-09 | PATCH | `/external-activities/{id}` | O | Chuẩn hóa tên/đơn vị/loại; hợp nhất bản ghi trùng (`merge_into`) | A | O05 |
| EXT-10 | POST | `/organizers` | O,A | Tạo đơn vị tổ chức (tên, alias, website, email liên hệ) | A | O05 |
| EXT-11 | PUT | `/organizers/{id}` | O,A | Sửa đơn vị tổ chức | A | O05 |
| EXT-12 | POST | `/evidence/{id}/mark-verification` | O | Đánh dấu **verified / unverified thủ công** (bắt buộc lý do; hiển thị "verified by officer", **không** nâng lên Level 1–4) | M | O04 |
| EXT-13 | POST | `/evidence/{id}/verification/check-source` | O,A | Kiểm tra ngay QR/URL/Certificate ID (Level 1). BE gọi ra ngoài có bảo vệ SSRF, trả kết quả và tự ghi thành một nguồn xác minh | M | O04 |

### 4.8 `APL` — Khiếu nại

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| APL-01 | POST | `/evidence/{id}/appeal` | S | Gửi khiếu nại (`reason`, `disputed_items[]`, file đính kèm). Chỉ khi `APPROVED`/`REJECTED` và trong hạn khiếu nại của kỳ | M | S07 |
| APL-02 | GET | `/appeals` | S,O,A | Danh sách khiếu nại theo phạm vi quyền | M | S07, O07 |
| APL-03 | GET | `/appeals/{id}` | S,O,A | Chi tiết: quyết định gốc, lý do, đính kèm, kết quả xử lý | M | S07, O03, O07 |
| APL-04 | POST | `/appeals/{id}/resolve` | O,A | `outcome=REOPEN` (chấp nhận xem lại ⇒ hồ sơ về `PENDING_REVIEW` mang `appeal_id`, Officer ra quyết định mới qua `REV-01`) hoặc `outcome=REJECT` (kèm lý do) | M | O07 |

### 4.9 `SCO` — Điểm và tra cứu sinh viên

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| SCO-01 | GET | `/students/me/dashboard` | S | Tổng điểm, điểm từng tiêu chí (đã duyệt / đang chờ), đếm hồ sơ theo `display_status`, việc cần làm, top Evidence Gap | M | S01 |
| SCO-02 | GET | `/students/{id}/scores` | S (`me`), O, A | Bảng điểm theo kỳ (`?term_id=`): từng tiêu chí, trần, đã đạt, danh sách hồ sơ đóng góp | M | S09, O03, O09 |
| SCO-03 | GET | `/students/{id}/what-can-i-claim` | S (`me`), O | "Có thể claim gì thêm": trần còn lại theo tiêu chí, hoạt động gợi ý, hồ sơ có thể nâng cấp nếu bổ sung | A | S08, O09 |
| SCO-04 | GET | `/students` | O,A | Tìm sinh viên (`?q=&class_id=&faculty_id=`), giới hạn theo scope Officer | M | O09 |
| SCO-05 | GET | `/students/{id}` | S (`me`), O, A | Hồ sơ sinh viên | M | O03, O09 |

### 4.10 `RAG` — Hỏi đáp quy chế

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| RAG-01 | POST | `/rag/query` | * | Hỏi đáp có citation. Tuỳ chọn `context.evidence_id` / `context.criterion_id`. Thiếu căn cứ ⇒ `answer_status=NO_EVIDENCE` kèm câu chuẩn "Không tìm thấy thông tin đủ căn cứ trong tài liệu chính thức." | M | C04, O03, O08 |
| RAG-02 | GET | `/rag/conversations` | * | Lịch sử hội thoại của tôi | A | C04 |
| RAG-03 | GET | `/rag/conversations/{id}` | * | Chi tiết một hội thoại | A | C04 |
| RAG-04 | POST | `/rag/messages/{id}/feedback` | * | Thumbs up/down + ghi chú (dùng cho đánh giá RAG) | A | C04 |
| RAG-05 | GET | `/rag/citations/{chunk_id}` | * | Nội dung đoạn quy chế được trích: văn bản Điều/Khoản, tên tài liệu, phiên bản, hiệu lực | M | C04, S02, S05, S08, O03 |
| RAG-06 | GET | `/knowledge/documents` | * | Danh sách tài liệu quy chế **đã publish** (chỉ đọc) | A | C04 |

### 4.11 `RPT` — Báo cáo

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| RPT-01 | GET | `/reports/summary` | O,A | Số hồ sơ theo trạng thái/scope/tiêu chí (`?term_id&faculty_id&class_id`) | M | O10 |
| RPT-02 | GET | `/reports/processing-time` | O,A | Thời gian xử lý trung bình, p90, theo Officer/tuần | A | O01, O10 |
| RPT-03 | GET | `/reports/score-distribution` | O,A | Phân phối điểm theo tiêu chí | M | O10 |
| RPT-04 | GET | `/reports/ai-agreement` | O,A | Tỷ lệ Officer đồng ý với đề xuất AI theo thời gian (exact / ±1 / đổi tiêu chí) | A | O01, O10 |
| RPT-05 | GET | `/reports/external-by-organizer` | O,A | Hoạt động ngoài trường theo đơn vị tổ chức + mức xác minh đạt được | A | O01, O10 |
| RPT-06 | POST | `/reports/export` | O,A | Xuất báo cáo Excel/PDF (`202` + `job_id`) | A | O10 |
| RPT-07 | GET | `/exports/{id}` | O,A | Trạng thái xuất + signed URL tải | A | O10 |

### 4.12 `ADM` — Quản trị

**Dashboard, người dùng, dữ liệu nền**

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| ADM-DSH-01 | GET | `/admin/dashboard` | A | KPI hệ thống: người dùng, lượng hồ sơ theo ngày, tình trạng pipeline, tóm tắt AI, trạng thái KB | M | A01 |
| ADM-USR-01 | GET | `/admin/users` | A | Danh sách người dùng (`?role=&faculty_id=&status=&q=`) | M | A02 |
| ADM-USR-02 | POST | `/admin/users` | A | Tạo người dùng (role ∈ `student/officer/admin`; student kèm MSSV/lớp) | M | A02 |
| ADM-USR-03 | GET | `/admin/users/{id}` | A | Chi tiết người dùng | M | A02 |
| ADM-USR-04 | PUT | `/admin/users/{id}` | A | Sửa thông tin/role (đổi role ghi audit) | M | A02 |
| ADM-USR-05 | PATCH | `/admin/users/{id}/status` | A | Khóa/mở khóa | M | A02 |
| ADM-USR-06 | POST | `/admin/users/{id}/reset-password` | A | Đặt lại mật khẩu (sinh mật khẩu tạm) | M | A02 |
| ADM-USR-07 | POST | `/admin/users/import` | A | Import CSV người dùng/sinh viên (`?dry_run=true`) | M | A02 |
| ADM-USR-08 | PUT | `/admin/users/{id}/scopes` | A | Gán phạm vi Officer (khoa/lớp) — Faculty-scoped Officer | A | A02 |
| ADM-USR-09 | GET | `/admin/roles` | A | Ma trận quyền của 3 role (chỉ đọc) | M | A02 |
| ADM-ORG-01 | POST | `/admin/faculties` | A | Tạo khoa | M | A03 |
| ADM-ORG-02 | PUT | `/admin/faculties/{id}` | A | Sửa khoa | M | A03 |
| ADM-ORG-03 | POST | `/admin/classes` | A | Tạo lớp | M | A03 |
| ADM-ORG-04 | PUT | `/admin/classes/{id}` | A | Sửa lớp | M | A03 |
| ADM-TRM-01 | POST | `/admin/terms` | A | Tạo kỳ đánh giá (thời gian, hạn nộp, hạn khiếu nại) | M | A03 |
| ADM-TRM-02 | PUT | `/admin/terms/{id}` | A | Sửa kỳ (không sửa được mốc đã qua khi kỳ đã chốt) | M | A03 |
| ADM-TRM-03 | POST | `/admin/terms/{id}/close` | A | **Chốt kỳ**: đóng băng điểm, chặn nộp/duyệt mới (`TERM_CLOSED`) | M | A03 |
| ADM-TRM-04 | POST | `/admin/terms/{id}/reopen` | A | Mở lại kỳ (bắt buộc lý do, ghi audit) | A | A03 |

**Tiêu chí và Rule Engine**

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| ADM-CRI-01 | POST | `/admin/criteria` | A | Tạo tiêu chí | M | A04 |
| ADM-CRI-02 | PUT | `/admin/criteria/{id}` | A | Sửa tiêu chí | M | A04 |
| ADM-CRI-03 | DELETE | `/admin/criteria/{id}` | A | Lưu trữ tiêu chí (không xóa nếu đã có điểm dùng) | M | A04 |
| ADM-CRI-04 | POST | `/admin/criteria/{id}/sub-criteria` | A | Tạo tiêu chí con | M | A04 |
| ADM-CRI-05 | PUT | `/admin/sub-criteria/{id}` | A | Sửa tiêu chí con | M | A04 |
| ADM-CRI-06 | DELETE | `/admin/sub-criteria/{id}` | A | Lưu trữ tiêu chí con | M | A04 |
| ADM-RUL-01 | GET | `/admin/rules` | A | Danh sách rule (`?criterion_id=&status=draft\|published`) | M | A05 |
| ADM-RUL-02 | POST | `/admin/rules` | A | Tạo rule ở trạng thái **draft** | M | A05 |
| ADM-RUL-03 | GET | `/admin/rules/{id}` | A | Chi tiết rule (dạng form + JSON Logic + mô tả ngôn ngữ tự nhiên) | M | A05 |
| ADM-RUL-04 | PUT | `/admin/rules/{id}` | A | Sửa rule draft | M | A05 |
| ADM-RUL-05 | POST | `/admin/rules/validate` | A | Kiểm tra schema, xung đột/chồng lấn giữa các rule | M | A05 |
| ADM-RUL-06 | POST | `/admin/rules/simulate` | A | Chạy thử: đầu vào mẫu **hoặc** phát lại N hồ sơ cũ ⇒ so sánh kết quả với bộ rule đang hiệu lực | A | A05 |
| ADM-RUL-07 | POST | `/admin/rules/{id}/publish` | A | Xuất bản với `effective_from` + ghi chú thay đổi (bắt buộc) ⇒ tạo version mới | M | A05 |
| ADM-RUL-08 | GET | `/admin/rules/{id}/versions` | A | Lịch sử phiên bản + diff; rollback = publish lại phiên bản cũ thành version mới | A | A05 |
| ADM-RUL-09 | POST | `/admin/rules/import` | A | Import bộ rule từ quy chế đã số hóa (JSON/Excel), có bước validate | A | A05 |

**Knowledge Base (RAG)**

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| ADM-KB-01 | GET | `/admin/knowledge/documents` | A | Danh sách tài liệu + trạng thái index | M | A06 |
| ADM-KB-02 | POST | `/admin/knowledge/documents` | A | Upload tài liệu + metadata (loại, cơ quan ban hành, phiên bản, hiệu lực từ/đến) | M | A06 |
| ADM-KB-03 | GET | `/admin/knowledge/documents/{id}` | A | Chi tiết + tiến trình xử lý | M | A06 |
| ADM-KB-04 | PUT | `/admin/knowledge/documents/{id}` | A | Sửa metadata | M | A06 |
| ADM-KB-05 | POST | `/admin/knowledge/documents/{id}/publish` | A | Cho phép truy hồi; tự đánh dấu phiên bản cũ bị thay thế (`superseded_by`) | M | A06 |
| ADM-KB-06 | POST | `/admin/knowledge/documents/{id}/archive` | A | Ngừng sử dụng tài liệu | M | A06 |
| ADM-KB-07 | POST | `/admin/knowledge/documents/{id}/reindex` | A | Chunk theo Điều/Khoản + embedding + index (`202`) | M | A06 |
| ADM-KB-08 | GET | `/admin/knowledge/documents/{id}/chunks` | A | Xem chunk và nhãn citation (Điều/Khoản/trang) | M | A06 |
| ADM-KB-09 | PATCH | `/admin/knowledge/chunks/{id}` | A | Sửa ranh giới/nhãn chunk sai | A | A06 |
| ADM-KB-10 | POST | `/admin/knowledge/test-retrieval` | A | Thử truy hồi: câu hỏi ⇒ top-k kèm similarity, ngưỡng, "có abstain không" | M | A06 |

**Cấu hình AI, Ground Truth, đánh giá, audit, job**

| ID | Method | Endpoint | Role | Chức năng | P | FE dùng |
|---|---|---|---|---|---|---|
| ADM-AI-01 | GET | `/admin/ai-config` | A | Ngưỡng và cờ hiện hành | M | A07 |
| ADM-AI-02 | PUT | `/admin/ai-config` | A | Cập nhật ngưỡng (bắt buộc lý do; có version; chỉ áp dụng cho hồ sơ mới) | M | A07 |
| ADM-AI-03 | GET | `/admin/ai-config/history` | A | Lịch sử thay đổi cấu hình + diff | A | A07 |
| ADM-AI-04 | GET | `/admin/ai/models` | A | Model/prompt/pipeline version đang dùng (chỉ đọc) | A | A07 |
| ADM-GT-01 | GET | `/admin/ground-truth` | A | Danh sách bản ghi (`?scope=&case_type=&source=real\|synthetic&split=`) | A | A08 |
| ADM-GT-02 | POST | `/admin/ground-truth` | A | Tạo từ `evidence_id` hoặc thủ công (synthetic, gắn `tamper_variant`) | A | A08 |
| ADM-GT-03 | GET | `/admin/ground-truth/{id}` | A | Chi tiết | A | A08 |
| ADM-GT-04 | PUT | `/admin/ground-truth/{id}` | A | Sửa nhãn | A | A08 |
| ADM-GT-05 | DELETE | `/admin/ground-truth/{id}` | A | Xóa khỏi bộ đánh giá | A | A08 |
| ADM-GT-06 | POST | `/admin/ground-truth/import` | A | Import hàng loạt | A | A08 |
| ADM-GT-07 | GET | `/admin/ground-truth/export` | A | Xuất (có ẩn danh hóa MSSV/họ tên) | A | A08 |
| ADM-GT-08 | GET | `/admin/ground-truth/stats` | A | Phân bố theo scope/loại/level/case (kiểm tra độ phủ certificate-only, trùng lặp, OCR lỗi…) | A | A08 |
| ADM-EVAL-01 | GET | `/admin/ai-evaluation/dashboard` | A | Chỉ số theo thời gian: accuracy, coverage, abstention rate, FNR, MAE, hallucination rate | A | A01, A09 |
| ADM-EVAL-02 | GET | `/admin/ai-evaluation/runs` | A | Danh sách lần chạy thí nghiệm | A | A09 |
| ADM-EVAL-03 | POST | `/admin/ai-evaluation/runs` | A | Tạo lần chạy: `experiment` (Exp.1–10), `config` (A–E), tập dữ liệu (`202`) | A | A09 |
| ADM-EVAL-04 | GET | `/admin/ai-evaluation/runs/{id}` | A | Kết quả: metric, confusion matrix, P/R theo level | A | A09 |
| ADM-EVAL-05 | GET | `/admin/ai-evaluation/runs/{id}/errors` | A | Danh sách mẫu sai để phân tích lỗi | A | A09 |
| ADM-EVAL-06 | GET | `/admin/ai-evaluation/ablation` | A | So sánh cấu hình A–E (đặc biệt tỷ lệ điểm vượt trần) | A | A09 |
| ADM-EVAL-07 | GET | `/admin/ai-evaluation/selective-curve` | A | Đường cong coverage ↔ accuracy/selective risk theo ngưỡng abstention | A | A09 |
| ADM-AUD-01 | GET | `/admin/audit-logs` | A | Tra cứu nhật ký (`?actor_id&action&entity_type&entity_id&from&to`) | M | A10 |
| ADM-AUD-02 | GET | `/admin/audit-logs/{id}` | A | Chi tiết + `before`/`after` + request_id + IP | M | A10 |
| ADM-AUD-03 | POST | `/admin/audit-logs/export` | A | Xuất nhật ký (`202`) | A | A10 |
| ADM-AUD-04 | POST | `/admin/audit-logs/verify-integrity` | A | Kiểm tra chuỗi hash của nhật ký append-only | A | A10 |
| ADM-JOB-01 | GET | `/admin/jobs` | A | Danh sách job (`?type=&status=`) | A | A11 |
| ADM-JOB-02 | GET | `/admin/jobs/{id}` | A | Chi tiết + log lỗi | A | A11 |
| ADM-JOB-03 | POST | `/admin/jobs/{id}/retry` | A | Thử lại job lỗi | A | A11 |
| ADM-JOB-04 | GET | `/admin/system/health` | A | Sức khỏe: DB, queue, storage, OCR, LLM API, vector DB + độ trễ | M | A01, A11 |

---

## 5. Payload chi tiết cho các endpoint quan trọng

### 5.1 `AUTH-04` — `GET /auth/me`
```json
{ "data": {
    "id": "u_01", "role": "officer", "full_name": "Nguyễn Thị Lan", "email": "lan@uni.edu.vn",
    "scope": { "faculty_ids": ["f_cntt"], "class_ids": [] },
    "student": null,
    "permissions": ["evidence.review", "activity.manage", "report.view"]
} }
```
FE dùng `role` + `permissions` để dựng sidebar và route guard. BE vẫn kiểm tra lại ở mọi endpoint.

### 5.2 Luồng nộp hồ sơ: `EVD-01` → `EVD-02` → `EVD-04`

**`EVD-01` — tạo nháp (hoạt động ngoài trường)**
```json
// request
{ "term_id": "t_2026_1", "scope_declared": "EXTERNAL", "evidence_type": "CERTIFICATE",
  "external_activity": { "name": "AI Hackathon 2026", "organizer_name": "TechVN",
                         "start_date": "2026-05-10", "end_date": "2026-05-11",
                         "role": "CONTESTANT", "verification_url": null, "certificate_id": null },
  "note": "Đạt giải khuyến khích" }
// 201
{ "data": { "id": "ev_9a1", "pipeline_status": "DRAFT", "display_status": "DRAFT", "version": 1 } }
```
Với hoạt động nội bộ gửi `"scope_declared": "INTERNAL", "activity_id": "act_77"` thay cho `external_activity`. `"UNKNOWN"` nghĩa là để AI phân loại.

**`EVD-02` — upload 1 file** (`multipart`, field `file`)
```json
// 201
{ "data": { "file_id": "f_1", "name": "cert.jpg", "size": 812345, "mime": "image/jpeg",
            "scan_status": "SCANNING", "sha256": "ab12…" } }
```
FE poll `EVD-06` (hoặc chờ sự kiện SSE `file.scanned`) cho tới khi `CLEAN`. `INFECTED` ⇒ file bị loại và FE báo lỗi tại thumbnail.

**`EVD-04` — nộp**
```json
// request
{ "student_confirmed": true }
// 202 Accepted
{ "data": { "id": "ev_9a1", "pipeline_status": "SUBMITTED", "job_id": "job_5c", "status_url": "/api/v1/evidence/ev_9a1/status" } }
```

### 5.3 `EVD-07` — trạng thái nhẹ để polling
```json
{ "data": {
    "id": "ev_9a1", "display_status": "PROCESSING", "pipeline_status": "PROCESSING", "version": 3,
    "steps": [
      { "key": "OCR",            "status": "DONE" },
      { "key": "EXTRACTION",     "status": "DONE" },
      { "key": "VERIFICATION",   "status": "RUNNING" },
      { "key": "CLASSIFICATION", "status": "PENDING" },
      { "key": "MAPPING",        "status": "PENDING" },
      { "key": "RULE_CHECK",     "status": "PENDING" },
      { "key": "RECOMMENDATION", "status": "PENDING" }
    ],
    "gap_summary": { "missing_count": 3 }
} }
```
`status ∈ PENDING · RUNNING · DONE · FAILED · SKIPPED`. Khi một bước `FAILED` sau retry, các bước sau `SKIPPED`, `display_status` chuyển về `NEEDS_HUMAN_REVIEW` (không crash, không đoán bừa).

### 5.4 `PIPE-01` — kết quả OCR
```json
{ "data": {
    "engine": "paddleocr", "pipeline_version": "ocr-1.3",
    "quality": { "blur": 0.12, "skew_deg": 1.5, "brightness": "OK" },
    "fields": [
      { "key": "student_id",   "value": "20IT123", "normalized": "20IT123", "confidence": 0.98, "low_confidence": false,
        "page": 1, "bbox": [120, 340, 260, 372], "source": "OCR" },
      { "key": "full_name",    "value": "Nguyen Van A", "normalized": "Nguyễn Văn A", "confidence": 0.71, "low_confidence": true,
        "page": 1, "bbox": [100, 280, 400, 315], "source": "OCR" },
      { "key": "activity_name","value": "AI Hackathon 2026", "confidence": 0.93, "low_confidence": false, "page": 1, "bbox": [90,200,510,250], "source": "OCR" },
      { "key": "organizer",    "value": "TechVN", "confidence": 0.90, "low_confidence": false, "page": 1, "bbox": [90,120,300,160], "source": "OCR" },
      { "key": "date",         "value": "10/05/2026", "normalized": "2026-05-10", "confidence": 0.88, "low_confidence": false, "page": 1, "bbox": [90,420,300,450], "source": "OCR" },
      { "key": "certificate_id","value": null, "confidence": null, "low_confidence": false, "page": 1, "bbox": null, "source": "OCR" }
    ],
    "raw_text": "…"
} }
```
Trường trích xuất chuẩn: `student_id, full_name, activity_name, activity_code, date, time, location, organizer, participation_role, certificate_id, verification_code, qr_payload, content, achievement, activity_type`. `bbox` cho phép FE tô sáng vùng trên ảnh khi click một trường.

**`EVD-09` — sinh viên/Officer xác nhận hoặc sửa**
```json
{ "fields": [ { "key": "full_name", "value": "Nguyễn Văn A", "action": "CORRECT" },
              { "key": "student_id", "action": "CONFIRM" } ] }
```
BE giữ giá trị OCR gốc, lưu bản sửa với `source`, đặt cờ `STUDENT_EDITED_OCR` nếu do sinh viên sửa, rồi tự chạy lại verification. Officer nhìn thấy cả hai giá trị.

### 5.5 `PIPE-03` — kết quả xác minh

**Hoạt động nội bộ (3 lớp)**
```json
{ "data": {
    "scope": "INTERNAL", "verification_status": "VERIFIED",
    "activity_existence": "CONFIRMED", "participation": "CONFIRMED",
    "layers": [
      { "layer": "I1_IDENTITY",   "result": "MATCH", "details": { "student_id": "MATCH", "full_name": "MATCH", "email": "N/A" } },
      { "layer": "I2_ACTIVITY",   "result": "MATCH", "details": { "activity_id": "act_77", "date": "MATCH", "organizer": "MATCH" } },
      { "layer": "I3_ATTENDANCE", "result": "PRESENT" }
    ],
    "flags": [],
    "risk_signals": []
} }
```

**Hoạt động ngoài trường, chỉ có certificate (Level 5)**
```json
{ "data": {
    "scope": "EXTERNAL", "verification_status": "NEEDS_HUMAN_REVIEW",
    "achieved_level": "L5_CERTIFICATE_ONLY",
    "activity_existence": "PLAUSIBLE", "participation": "NOT_INDEPENDENTLY_VERIFIED",
    "summary": "Thông tin trên tài liệu nhất quán với hồ sơ sinh viên nhưng chưa có căn cứ độc lập để xác minh.",
    "internal_consistency": { "identity": "MATCH", "date": "CONSISTENT", "organizer_name": "CONSISTENT" },
    "sources": [],
    "flags": ["UNVERIFIED_EXTERNAL_ACTIVITY", "NEW_ACTIVITY_NEVER_SEEN"],
    "risk_signals": [ { "code": "FONT_INCONSISTENT", "weight": "LOW", "note": "Chỉ là cảnh báo rủi ro, không phải căn cứ kết luận giả." } ]
} }
```
- `risk_signals` **chỉ trả cho O, A**. Sinh viên nhận `summary` và Evidence Gap.
- Không tồn tại giá trị `FAKE`/`VALID` cho certificate-only.
- Level 4 (`L4_PUBLIC_SOURCE`) chỉ được đặt `activity_existence=CONFIRMED`; `participation` giữ `NOT_INDEPENDENTLY_VERIFIED` cho tới khi có L1–L3 xác nhận đúng sinh viên.

### 5.6 `PIPE-08` — Evidence Gap
```json
{ "data": {
    "activity_existence": "PLAUSIBLE", "participation": "NOT_INDEPENDENTLY_VERIFIED",
    "missing": [
      { "code": "PARTICIPANT_LIST",        "label": "Danh sách người tham gia chính thức",      "improves": "PARTICIPATION" },
      { "code": "ORGANIZER_CONFIRMATION",  "label": "Xác nhận từ đơn vị tổ chức",               "improves": "PARTICIPATION" },
      { "code": "VERIFICATION_URL",        "label": "Đường dẫn/mã xác minh chứng nhận",         "improves": "ACTIVITY_EXISTENCE,PARTICIPATION" },
      { "code": "RESULT_ANNOUNCEMENT",     "label": "Thông báo kết quả công bố chính thức",     "improves": "PARTICIPATION" }
    ],
    "potential_outcome": "Nếu bổ sung một trong các mục trên, hồ sơ có thể đạt mức xác minh cao hơn."
} }
```

### 5.7 `PIPE-05` — đề xuất AI (bản Officer)
```json
{ "data": {
    "id": "air_3", "run_no": 2, "outcome": "RECOMMENDED",
    "activity": "AI Hackathon 2026", "activity_type": "professional_competition", "scope": "EXTERNAL",
    "classification_confidence": 0.94,
    "top_k_criteria": [
      { "criterion_id": "C03", "name": "Nghiên cứu khoa học, cuộc thi chuyên môn", "confidence": 0.91,
        "reason": "Cuộc thi chuyên môn theo Điều 5 khoản 2.", "citations": [ { "chunk_id": "ck_88", "label": "QC-2025 · Điều 5 · Khoản 2" } ] },
      { "criterion_id": "C05", "name": "Hoạt động cộng đồng", "confidence": 0.22, "reason": "…", "citations": [] }
    ],
    "suggested_score": 5, "final_recommended_score": 3, "capped": true, "maximum_allowed_score": 3,
    "confidence": 0.91, "reason": "…", "abstained": false, "abstain_reason": null,
    "evidence_status": "NEEDS_HUMAN_REVIEW", "needs_human_review": true,
    "versions": { "model": "llm-x", "prompt": "map-v4", "rule": "rules-2026.1" }
} }
```
- `outcome=NO_MATCH` ⇒ `top_k_criteria=[]`, FE hiển thị "Không tìm thấy tiêu chí phù hợp, cần cán bộ chọn".
- `outcome=ABSTAINED` ⇒ vẫn trả `abstain_reason` (`LOW_CONFIDENCE`, `LEVEL_4_5_NO_SUPPORT`, `CONTRADICTORY_INFO`, `RETRIEVAL_EMPTY`).
- **Bản Sinh viên** chỉ gồm: Top-1 tiêu chí, `final_recommended_score`, `capped` + `maximum_allowed_score`, `reason`, mức chắc chắn dạng định tính (`HIGH/MEDIUM/LOW`), `label="Đề xuất — chưa phải điểm chính thức"`. Không lộ `top_k` đầy đủ, confidence thô, version.

### 5.8 `PIPE-07` — kết quả Rule Engine
```json
{ "data": {
    "rule_set_version": "rules-2026.1", "criterion_id": "C03",
    "checks": [
      { "code": "ELIGIBILITY",       "passed": true,  "rule_id": "R_C03_01", "detail": "professional_competition được áp dụng" },
      { "code": "MAX_SCORE",         "passed": false, "rule_id": "R_C03_02", "detail": "AI đề xuất 5 > tối đa 3 ⇒ cắt về 3" },
      { "code": "DUPLICATE",         "passed": true,  "detail": "Không trùng hoạt động trong kỳ" },
      { "code": "REQUIRED_EVIDENCE", "passed": true,  "detail": "Đủ loại minh chứng CERTIFICATE" },
      { "code": "CUMULATIVE_CAP",    "passed": true,  "detail": "Đã tích lũy 4/10, còn 6" },
      { "code": "DEADLINE",          "passed": true,  "detail": "Trong hạn nộp của kỳ" }
    ],
    "suggested_score": 5, "maximum_allowed_score": 3, "final_recommended_score": 3, "hard_fail": false
} }
```
`hard_fail=true` (ví dụ quá hạn, trùng bị cấm) ⇒ `final_recommended_score=0` và FE hiển thị lý do, nhưng vẫn để Officer quyết định.

### 5.9 `REV-01` — quyết định của Officer
```json
// request (header Idempotency-Key: 6b1c…)
{ "action": "APPROVE",
  "expected_version": 4,
  "criterion_id": "C03",
  "final_score": 3,
  "reason": "Đã đối chiếu trang chính thức của đơn vị tổ chức, tên sinh viên có trong danh sách kết quả.",
  "manual_verification": { "status": "VERIFIED", "basis": "Officer tự xác minh qua website đơn vị", "evidence_refs": ["ext_ver_12"] },
  "appeal_id": null }
```
Các nhánh khác:
```json
{ "action": "REJECT", "expected_version": 4,
  "reject_basis": "PARTICIPATION_DISPROVEN",
  "evidence_refs": ["ext_ver_15"],
  "reason": "Đơn vị tổ chức xác nhận không có sinh viên này trong danh sách (email ngày 12/09)." }

{ "action": "MODIFY", "expected_version": 4, "criterion_id": "C03", "final_score": 2,
  "reason": "Vai trò chỉ là người tham dự, theo Điều 5 khoản 3 tính mức 2 điểm." }

{ "action": "REQUEST_SUPPLEMENT", "expected_version": 4, "deadline": "2026-10-05",
  "supplement_requests": [ { "code": "PARTICIPANT_LIST", "note": "Vui lòng gửi danh sách kết quả chính thức." },
                            { "code": "VERIFICATION_URL", "note": "" } ] }
```
**Quy tắc BE bắt buộc (validation):**
1. `REJECT`, `MODIFY`, `REQUEST_SUPPLEMENT` ⇒ `reason` (hoặc `supplement_requests`) bắt buộc, ngược lại `422 REASON_REQUIRED`.
2. `REJECT` ⇒ `reject_basis` phải thuộc danh sách hợp lệ và có `evidence_refs` hoặc mô tả bằng chứng cụ thể; lý do dạng "không có trong cơ sở dữ liệu" bị chặn `422 REJECT_BASIS_INVALID`. Đây là hiện thực hóa nguyên tắc "không đủ bằng chứng ≠ giả".
3. `final_score` không vượt `maximum_allowed_score` **và** không vượt trần tích lũy còn lại ⇒ nếu vượt, `422 RULE_MAX_SCORE_EXCEEDED`. AI và Officer đều không thể override Rule Engine.
4. `APPROVE` hồ sơ ngoài trường ở `L5_CERTIFICATE_ONLY` ⇒ bắt buộc có `manual_verification.basis`; hệ thống ghi rõ **"Verified by officer"**, không nâng `achieved_level`.
5. Kỳ đã chốt ⇒ `409 TERM_CLOSED`. Lệch `expected_version` ⇒ `409 CONFLICT_VERSION`.
6. Mỗi lần gọi ghi Audit Log: ai, khi nào, giá trị trước/sau, lý do, `request_id`.

```json
// 200
{ "data": { "evidence_id": "ev_9a1", "review_status": "APPROVED", "final_score": 3, "score_modified": false,
            "decided_by": "u_01", "decided_at": "2026-09-21T03:10:00Z", "version": 5 } }
```

### 5.10 `OFF-01` — hàng đợi ưu tiên
```json
{ "data": [ {
    "evidence_id": "ev_9a1",
    "student": { "id": "s_1", "student_code": "20IT123", "full_name": "Nguyễn Văn A", "class": "20CNTT1" },
    "activity": "AI Hackathon 2026", "scope": "EXTERNAL",
    "verification_status": "NEEDS_HUMAN_REVIEW", "achieved_level": "L5_CERTIFICATE_ONLY",
    "ai": { "criterion_id": "C03", "final_recommended_score": 3, "confidence": 0.91, "outcome": "RECOMMENDED" },
    "flags": ["UNVERIFIED_EXTERNAL_ACTIVITY", "LOW_OCR_CONFIDENCE"],
    "waiting_hours": 30, "assignee": null,
    "priority_score": 0.82, "priority_reasons": ["Level xác minh thấp", "OCR có trường confidence thấp", "Chờ 30 giờ"],
    "fast_track": false
} ], "meta": { "page": 1, "page_size": 20, "total": 48, "counts": { "pending": 48, "needs_supplement": 12, "auto_approved": 9, "processed": 510 } } }
```
**Công thức ưu tiên đề xuất (cấu hình được):**
`priority = 0.30·(1 − ai_confidence) + 0.25·level_penalty + 0.20·flag_weight + 0.15·min(waiting_hours/SLA_hours, 1) + 0.10·is_appeal`
(`level_penalty`: L1=0 … L5=1). `fast_track=true` khi: nội bộ + `VERIFIED` + điểm danh `PRESENT` + Rule Engine không lỗi + không cờ. Chỉ nhóm `fast_track` mới đủ điều kiện cho `REV-04`.

### 5.11 `EXT-03` — ghi nhận nguồn xác minh
```json
{ "level": "L4_PUBLIC_SOURCE",
  "source_url": "https://techvn.example/hackathon-2026/results",
  "addresses": ["ACTIVITY_EXISTENCE"],
  "result": "CONFIRMED",
  "note": "Trang kết quả chính thức xác nhận cuộc thi diễn ra, chưa thấy tên sinh viên.",
  "attachment_file_id": "f_9" }
```
BE tính lại `activity_existence` / `participation` theo **những gì nguồn thực sự trả lời** (`addresses`). Ví dụ trên chỉ nâng `activity_existence`, không đổi `participation`.

### 5.12 `RAG-01` — hỏi đáp quy chế
```json
// request
{ "question": "Hackathon thuộc tiêu chí nào và tối đa mấy điểm?", "context": { "evidence_id": "ev_9a1" }, "conversation_id": null }
// 200 — có căn cứ
{ "data": { "message_id": "m_5", "conversation_id": "c_2", "answer_status": "ANSWERED",
    "answer": "Cuộc thi chuyên môn thuộc tiêu chí C03, tối đa 3 điểm/hoạt động …",
    "citations": [ { "chunk_id": "ck_88", "document": "Quy chế đánh giá rèn luyện 2025", "version": "2025.1",
                     "article": "Điều 5", "clause": "Khoản 2", "page": 4, "similarity": 0.83 } ] } }
// 200 — thiếu căn cứ
{ "data": { "message_id": "m_6", "answer_status": "NO_EVIDENCE",
    "answer": "Không tìm thấy thông tin đủ căn cứ trong tài liệu chính thức.", "citations": [] } }
```
Nội dung OCR đưa vào `context` được coi là **dữ liệu**, không phải chỉ dẫn (chống prompt injection). Câu trả lời chỉ dựa trên tài liệu **đã publish và còn hiệu lực** tại thời điểm hỏi.

### 5.13 `SCO-03` — What can I claim?
```json
{ "data": { "term_id": "t_2026_1",
    "criteria_headroom": [ { "criterion_id": "C03", "cap": 10, "earned": 4, "pending": 3, "remaining": 3 } ],
    "suggested_activities": [ { "type": "professional_competition", "example": "Cuộc thi chuyên môn", "typical_score": "1–3",
                                "required_evidence": ["CERTIFICATE"], "citations": [ { "chunk_id": "ck_88" } ] },
                              { "activity_id": "act_90", "name": "Workshop AI (nội bộ)", "date": "2026-10-12", "typical_score": 2 } ],
    "upgrade_opportunities": [ { "evidence_id": "ev_9a1", "if_provided": "PARTICIPANT_LIST", "potential": "Có thể đạt mức xác minh cao hơn" } ],
    "disclaimer": "Gợi ý tham khảo, điểm cuối do cán bộ quyết định." } }
```

### 5.14 `ADM-RUL-02` — định dạng rule (config-driven, JSON Logic)
```json
{ "code": "R_C03_02", "criterion_id": "C03", "name": "Trần điểm cuộc thi chuyên môn",
  "when": { "and": [ { "==": [ { "var": "activity_type" }, "professional_competition" ] },
                     { ">=": [ { "var": "verification_rank" }, 0 ] } ] },
  "then": { "max_score": 3, "cumulative_cap_criterion": 10, "duplicate_policy": "PER_TERM",
            "required_evidence": ["CERTIFICATE"], "min_verification": "PLAUSIBLE" },
  "effective_from": "2026-09-01", "status": "draft", "change_note": "" }
```
FE có hai chế độ sửa: **form** (map sang `when/then`) và **JSON nâng cao**; `ADM-RUL-05` xác thực cả hai. Rule đã publish là **bất biến**; sửa = tạo version mới.

### 5.15 `ADM-AI-02` — khóa cấu hình AI
| Khóa | Ý nghĩa | Ví dụ |
|---|---|---|
| `ocr.low_confidence_threshold` | Dưới mức này trường bị gắn `low_confidence` | 0.80 |
| `ai.abstain_confidence_threshold` | Dưới mức này ⇒ `ABSTAINED` | 0.60 |
| `ai.no_match_threshold` | Không tiêu chí nào đạt ⇒ `NO_MATCH` | 0.40 |
| `ai.top_k` | Số tiêu chí ứng viên | 3 |
| `rag.similarity_threshold` | Dưới mức này ⇒ `NO_EVIDENCE` | 0.55 |
| `rag.top_k` / `rag.rerank_enabled` | Truy hồi | 5 / true |
| `review.auto_approve_enabled` | Bật tự duyệt nội bộ đủ điều kiện | **false** (mặc định) |
| `review.auto_approve_min_confidence` | Ngưỡng tự duyệt | 0.90 |
| `review.spot_check_rate` | Tỷ lệ mẫu Officer kiểm tra lại | 0.10 |
| `verification.enabled_levels` | Bật/tắt các cấp L1–L4 | `["L1","L4"]` |
| `queue.sla_hours` | Hạn xử lý để tính ưu tiên | 72 |

> **Lưu ý thiết kế:** tài liệu đề tài (mục 13) cho phép auto-approve nội bộ, còn tài liệu nghiệp vụ (mục 14) yêu cầu điểm cuối chỉ ghi nhận sau quyết định của người có thẩm quyền. Đề xuất: **mặc định tắt** `auto_approve_enabled`; hồ sơ `fast_track` được duyệt hàng loạt bởi Officer (`REV-04`). Nếu bật, hồ sơ tự duyệt mang `decided_by="SYSTEM"`, `auto_approved=true`, vào tab "cần spot-check" và Officer vẫn có thể đảo quyết định.

---

## 6. Luồng xử lý phía BE

### 6.1 Pipeline khi `EVD-04` được gọi
```
submit ─► [queue] ─► 1 OCR + tiền xử lý ─► 2 Trích xuất thực thể + chuẩn hóa
                      │ lỗi/confidence thấp ⇒ gắn low_confidence (không dừng)
                      ▼
            3 Phân loại scope (INTERNAL/EXTERNAL) ─► 4 Verification
                      │  INTERNAL: I1 → I2 → I3          EXTERNAL: L1 (tự động QR/URL) → L2–L4 nếu có nguồn → L5 mặc định
                      │  + phát hiện trùng lặp + risk signal
                      ▼
            5 rule_engine.get_cap() ─► 6 AI: phân loại hoạt động → Top-K tiêu chí (RAG) → đề xuất điểm / abstain
                      ▼
            7 rule_engine.evaluate()  (cắt điểm, kiểm tra điều kiện — thẩm quyền cuối)
                      ▼
            8 Tính Evidence Gap ─► 9 review_status = PENDING_REVIEW (+ thông báo cho Officer)
```
- **Retry/fallback:** mỗi bước retry tối đa 2 lần (backoff). Bước vẫn lỗi ⇒ bước sau `SKIPPED`, `flags += PIPELINE_ERROR`, `verification_status = NEEDS_HUMAN_REVIEW`, hồ sơ vào hàng đợi Officer. Không có đường nào dẫn tới việc hệ thống "đoán bừa".
- **Abstention:** confidence < `ai.abstain_confidence_threshold`, hoặc (ngoài trường ở Level 4–5 và không có tín hiệu hỗ trợ khác) ⇒ `ABSTAINED`, vẫn chạy Rule Engine để cho Officer biết trần điểm.
- **Đặt lại khi bổ sung:** `EVD-10` / `EVD-09` chạy lại từ bước 4 trở đi; bản ghi AI cũ được giữ trong lịch sử.

### 6.2 Máy trạng thái `review_status`
```
NOT_READY ─(pipeline xong / lỗi)─► PENDING_REVIEW ─(CLAIM)─► IN_REVIEW
   IN_REVIEW ─APPROVE/MODIFY──► APPROVED ──(APL-01)──► [appeal] ─REOPEN─► PENDING_REVIEW
   IN_REVIEW ─REJECT──────────► REJECTED ──(APL-01)──► [appeal] ─REOPEN─► PENDING_REVIEW
   IN_REVIEW ─REQUEST_SUPPLEMENT─► NEEDS_SUPPLEMENT ─(EVD-10)─► (chạy lại từ verification) ─► PENDING_REVIEW
   (chưa APPROVED) ─(EVD-11)─► WITHDRAWN
```
Soft-lock `REV-03` hết hạn sau 15 phút không hoạt động. Chuyển trạng thái không hợp lệ ⇒ `409 EVIDENCE_STATE_INVALID`.

### 6.3 Điểm tổng kỳ
Điểm tổng của sinh viên = Σ `final_score` của các hồ sơ `APPROVED` trong kỳ, mỗi tiêu chí bị chặn bởi trần tích lũy do Rule Engine kiểm tra **tại thời điểm duyệt**. Điểm "đang chờ" (chỉ có `final_recommended_score`) được trả riêng (`pending`) và **không** cộng vào điểm chính thức. `ADM-TRM-03` chốt kỳ và đóng băng toàn bộ.

### 6.4 Truy vết quyết định (`PIPE-09`)
`final_score → rule (id, version) → criterion → activity → evidence → OCR fields (kèm bản sửa) → nguồn xác minh (level) → quyết định Officer (ai, khi nào, lý do)`. Dùng để trả lời "Vì sao được 3 điểm?".

---

## 7. Phân quyền (RBAC + row-level)

| Nhóm API | Student | Officer | Admin |
|---|---|---|---|
| `AUTH`, `NOTI`, `REF`, `CRI`, `RAG` | ✔ | ✔ | ✔ |
| `ACT-01/02` (xem) | ✔ | ✔ | ✔ |
| `ACT-03…09` (quản lý, điểm danh) | — | ✔ | ✔ |
| `EVD-01…04, 10, 11, 14, 15` (tạo/nộp/bổ sung) | ✔ (của mình) | — | — |
| `EVD-05/06/07/08/12/13` (đọc) | ✔ (của mình) | ✔ (trong scope) | ✔ (tất cả) |
| `EVD-09` (sửa trường OCR) | ✔ (của mình, khi được phép) | ✔ | — |
| `PIPE` đọc | ✔ (bản rút gọn) | ✔ (đầy đủ) | ✔ |
| `PIPE` chạy lại | — | ✔ | ✔ |
| `REV`, `OFF` | — | ✔ | ✔ (chỉ xem; duyệt cần bật chế độ break-glass, ghi audit) |
| `EXT` | — | ✔ (`EXT-06/07` là `pub`) | ✔ (xem, `EXT-10/11`, `EXT-13`) |
| `APL-01` | ✔ | — | — |
| `APL-02/03` | ✔ (của mình) | ✔ (trong scope) | ✔ |
| `APL-04` | — | ✔ | ✔ |
| `SCO-01` | ✔ | — | — |
| `SCO-02/05` | ✔ (`me`) | ✔ (trong scope) | ✔ |
| `SCO-03` | ✔ (`me`) | ✔ | — |
| `SCO-04` | — | ✔ | ✔ |
| `RPT` | — | ✔ (trong scope) | ✔ |
| `ADM-*` | — | — | ✔ |

**Row-level:** sinh viên truy cập hồ sơ/điểm của người khác ⇒ `404`. Officer ngoài `scope` (khoa/lớp) ⇒ `404`. Admin có thể xem tất cả nhưng thao tác duyệt luôn ghi audit với cờ `acting_as_admin`.

> Nếu dự án muốn cho Officer tự chỉnh tiêu chí/rule (tài liệu đề tài mục 9 ghi "Officer quản lý danh mục hoạt động/tiêu chí/rule"), chỉ cần cấp quyền `ADM-CRI-*` và `ADM-RUL-*` cho Officer kèm quy tắc **hai người** (người sửa ≠ người publish). Thiết kế hiện tại đặt quyền sửa rule ở Admin để tách bạch với quyền duyệt điểm.

---

## 8. Realtime và thông báo

**SSE `EVD-08`** (`text/event-stream`). Các sự kiện:

| Event | Payload | FE phản ứng |
|---|---|---|
| `file.scanned` | `{file_id, scan_status}` | Cập nhật thumbnail (trong wizard) |
| `pipeline.step` | `{step, status}` | Cập nhật stepper |
| `pipeline.done` | `{display_status}` | Tải lại các tab kết quả |
| `verification.updated` | `{verification_status}` | Cập nhật thẻ xác minh |
| `review.decided` | `{review_status, final_score}` | Hiện thẻ kết quả, thông báo toast |
| `supplement.requested` | `{request_ids[]}` | Hiện banner "Cần bổ sung" |
| `lock.changed` | `{locked_by}` | Officer khác đang xem (O03) |

FE phải có **fallback polling** `EVD-07` mỗi 3 giây khi SSE mất kết nối.

**Loại thông báo (`NOTI-01`):**

| Người nhận | Loại |
|---|---|
| Student | `EVIDENCE_RECEIVED` · `SUPPLEMENT_REQUESTED` · `EVIDENCE_APPROVED` · `SCORE_MODIFIED` · `EVIDENCE_REJECTED` · `APPEAL_RESOLVED` · `TERM_DEADLINE_NEAR` |
| Officer | `NEW_EVIDENCE_IN_QUEUE` · `SUPPLEMENT_SUBMITTED` · `APPEAL_SUBMITTED` · `SLA_WARNING` · `ORGANIZER_CONFIRMED` |
| Admin | `KB_INDEX_DONE` · `KB_INDEX_FAILED` · `EVAL_RUN_DONE` · `JOB_FAILED` · `AI_ERROR_SPIKE` |

---

## 9. Bảo mật và Audit (những điểm FE/BE cần thống nhất)

- **Upload:** kiểm tra MIME bằng magic bytes, giới hạn kích thước/số lượng, quét virus trước khi `CLEAN`; file lưu MinIO mã hóa, chỉ truy cập qua signed URL ngắn hạn.
- **Prompt injection:** nội dung OCR luôn được đưa vào LLM ở vai trò **dữ liệu** (system prompt cố định, escape/sanitize, không thực thi bất kỳ "chỉ dẫn" nào xuất hiện trong tài liệu). Kết quả LLM được validate theo schema trước khi lưu; trường ngoài schema bị bỏ.
- **SSRF (`EXT-13`):** chỉ cho `http/https`, chặn dải IP nội bộ/loopback, giới hạn redirect, timeout ngắn, không gửi cookie/credential.
- **Dữ liệu nhạy cảm:** MSSV, ảnh minh chứng mã hóa khi lưu; sinh viên không bao giờ thấy `risk_signals`; export Ground Truth bắt buộc ẩn danh hóa.
- **Audit append-only** (mọi hành động Approve/Reject/Modify, đổi role, đổi rule/config, publish KB, mở lại kỳ, truy cập file bởi Officer/Admin). Bản ghi: `id, ts, actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id, ip, prev_hash, hash`. `ADM-AUD-04` kiểm tra chuỗi hash.
- **Không tồn tại API xóa/sửa audit log**, và không API nào cho phép sửa điểm cuối ngoài `REV-01`.

---

## 10. Gợi ý ưu tiên triển khai

| Giai đoạn (mục 38 tài liệu đề tài) | Nhóm API cần xong |
|---|---|
| 1. Nền tảng | `AUTH`, `NOTI`, `REF`, `CRI`, `ACT`, `EVD-01…07, 12, 13, 14`, `ADM-USR`, `ADM-ORG`, `ADM-TRM`, `ADM-CRI`, `ADM-AUD-01/02` |
| 2. OCR & Extraction | `PIPE-01/02`, `EVD-09`, SSE/polling cơ bản, `ADM-JOB-04` |
| 3. Rule Engine & xác minh nội bộ | `ADM-RUL-01…05, 07`, `PIPE-03/04/07`, `REV-01/02/03`, `OFF-01/02`, `SCO-01/02/04/05`, `APL` |
| 4. AI + RAG cơ bản | `PIPE-05/06/08/09`, `RAG-01/05`, `ADM-KB-01…08, 10`, `ADM-AI-01/02` |
| 5. Xác minh ngoài trường + Abstention | `EXT-03/04/12/13` (MVP: L1 và L5), rồi `EXT-05…11`, `EVD-10`, `SCO-03` |
| 6. Dashboard, Ground Truth, thí nghiệm | `RPT`, `ADM-GT`, `ADM-EVAL`, `ADM-AI-03/04`, `ADM-DSH-01`, `ADM-AUD-03/04` |
---

## Phụ lục A. Ma trận Trang FE → API (tự sinh từ file thiết kế trang)

| Trang | Tên trang | API sử dụng |
|---|---|---|
| **C01** | Đăng nhập | AUTH-01, AUTH-04, AUTH-02 |
| **C02** | Quên và đặt lại mật khẩu | AUTH-06, AUTH-07 |
| **C03** | Hồ sơ cá nhân và bảo mật | AUTH-04, AUTH-05, AUTH-03 |
| **C04** | Hỏi đáp quy chế (RAG) | RAG-01, RAG-02, RAG-03, RAG-04, RAG-05, RAG-06 |
| **C05** | Trung tâm thông báo | NOTI-01, NOTI-02, NOTI-03 |
| **C06** | Trang lỗi và trạng thái hệ thống | — |
| **C07** | Biểu mẫu xác nhận của đơn vị tổ chức (công khai, có token) | EXT-06, EXT-07 |
| **S01** | Tổng quan điểm rèn luyện | SCO-01, EVD-05, REF-01, NOTI-01 |
| **S02** | Tiêu chí và quy chế | CRI-01, CRI-02, RAG-05, REF-01 |
| **S03** | Nộp minh chứng (wizard 3 bước) | ACT-01, ACT-02, REF-01, REF-04, REF-05, EVD-01, EVD-14, EVD-02, EVD-03, EVD-06, EVD-15, EVD-04 |
| **S04** | Danh sách minh chứng của tôi | EVD-05, EVD-11, REF-01, CRI-01 |
| **S05** | Chi tiết minh chứng | EVD-06, EVD-07, EVD-08, EVD-12, EVD-13, EVD-09, EVD-11, PIPE-01, PIPE-03, PIPE-05, PIPE-08, PIPE-09, RAG-05 |
| **S06** | Bổ sung minh chứng | EVD-06, PIPE-08, EVD-10, EVD-12 |
| **S07** | Khiếu nại | APL-01, APL-02, APL-03, EVD-06 |
| **S08** | "What can I claim?" — Còn có thể tích lũy gì | SCO-03, REF-01, RAG-05 |
| **S09** | Bảng điểm rèn luyện | SCO-02, PIPE-09, REF-01 |
| **O01** | Tổng quan xử lý | OFF-02, RPT-02, RPT-04, RPT-05, REF-01, REF-02, REF-03 |
| **O02** | Hàng đợi xử lý | OFF-01, OFF-03, REV-03, REV-04, REF-01, REF-02, REF-03, REF-05, CRI-01 |
| **O03** | Màn hình xét duyệt hồ sơ | EVD-06, EVD-07, EVD-08, EVD-09, EVD-12, EVD-13, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, PIPE-09, PIPE-10, PIPE-11, REV-01, REV-02, REV-03, EXT-04, SCO-02, SCO-05, OFF-03, APL-03, RAG-01, RAG-05, CRI-02, REF-05 |
| **O04** | Thêm nguồn xác minh ngoài trường | EXT-03, EXT-04, EXT-05, EXT-12, EXT-13, EVD-12 |
| **O05** | Hoạt động ngoài trường và đơn vị tổ chức | EXT-01, EXT-02, EXT-08, EXT-09, EXT-10, EXT-11, REF-04, EVD-05 |
| **O06** | Quản lý hoạt động nội bộ và điểm danh | ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07, ACT-08, ACT-09, REF-01, REF-05, CRI-01 |
| **O07** | Xử lý khiếu nại | APL-02, APL-03, APL-04, EVD-06 |
| **O08** | Tiêu chí và quy tắc (chỉ xem) | CRI-01, CRI-02, REF-05, RAG-01 |
| **O09** | Tra cứu sinh viên | SCO-04, SCO-05, SCO-02, SCO-03, EVD-05, REF-01, REF-02, REF-03 |
| **O10** | Báo cáo và thống kê | RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, REF-01, REF-02, REF-03 |
| **A01** | Tổng quan hệ thống | ADM-DSH-01, ADM-JOB-04, ADM-EVAL-01 |
| **A02** | Quản lý người dùng và phân quyền | ADM-USR-01, ADM-USR-02, ADM-USR-03, ADM-USR-04, ADM-USR-05, ADM-USR-06, ADM-USR-07, ADM-USR-08, ADM-USR-09, REF-02, REF-03 |
| **A03** | Dữ liệu nền và Kỳ đánh giá | REF-01, REF-02, REF-03, ADM-ORG-01, ADM-ORG-02, ADM-ORG-03, ADM-ORG-04, ADM-TRM-01, ADM-TRM-02, ADM-TRM-03, ADM-TRM-04 |
| **A04** | Quản lý tiêu chí | CRI-01, CRI-02, ADM-CRI-01, ADM-CRI-02, ADM-CRI-03, ADM-CRI-04, ADM-CRI-05, ADM-CRI-06, REF-05 |
| **A05** | Rule Engine | ADM-RUL-01, ADM-RUL-02, ADM-RUL-03, ADM-RUL-04, ADM-RUL-05, ADM-RUL-06, ADM-RUL-07, ADM-RUL-08, ADM-RUL-09, CRI-01, REF-05 |
| **A06** | Knowledge Base (tài liệu quy chế cho RAG) | ADM-KB-01, ADM-KB-02, ADM-KB-03, ADM-KB-04, ADM-KB-05, ADM-KB-06, ADM-KB-07, ADM-KB-08, ADM-KB-09, ADM-KB-10 |
| **A07** | Cấu hình AI | ADM-AI-01, ADM-AI-02, ADM-AI-03, ADM-AI-04 |
| **A08** | Ground Truth Dataset | ADM-GT-01, ADM-GT-02, ADM-GT-03, ADM-GT-04, ADM-GT-05, ADM-GT-06, ADM-GT-07, ADM-GT-08, EVD-05, EVD-06 |
| **A09** | Đánh giá AI | ADM-EVAL-01, ADM-EVAL-02, ADM-EVAL-03, ADM-EVAL-04, ADM-EVAL-05, ADM-EVAL-06, ADM-EVAL-07 |
| **A10** | Nhật ký hệ thống (Audit Log) | ADM-AUD-01, ADM-AUD-02, ADM-AUD-03, ADM-AUD-04 |
| **A11** | Giám sát job và sức khỏe hệ thống | ADM-JOB-01, ADM-JOB-02, ADM-JOB-03, ADM-JOB-04 |
