# EduPoint — API Backend hiện hành (02/11/2026)

Backend chính: **NestJS + Prisma + PostgreSQL/Storage Supabase**. Base URL `/api`; Swagger `/api/docs`. Ba role: `STUDENT`, `STAFF` (Khoa), `ADMIN` (CTSV). Tài liệu thiết kế API năm 2026 trước đây có stack, route và tính năng dự kiến khác implementation; danh mục dưới đây được đối chiếu với controller hiện hành.

Chi tiết nghiệp vụ và nghiệm thu: [bàn giao Khoa/CTSV](docs/07-hien-trang-he-thong/FACULTY_ADMIN_HANDOFF_2026-11-02.md).

## Hợp đồng dùng cho Khoa và CTSV

- Header xác thực: `Authorization: Bearer <JWT>`. Backend đọc lại trạng thái tài khoản/phân công ở mỗi request.
- `GET /evaluation-workflow/:termId`: `q`, `classId`, `facultyId`, `state`, `page=1`, `pageSize=25` (tối đa 100).
- `state`: `NOT_SUBMITTED`, `STUDENT_RETURNED`, `REVIEWING`, `READY`, `SENT`, `PUBLISHED`, `FACULTY_RETURNED`, `NOT_SUBMITTED_RECORDED`; `APPEALS` và `RETURNED` là bộ lọc tổng hợp. `SENT` bao gồm phiếu đã công bố.
- Workflow trả object trong `data`: `items`, `total`, `page`, `pageSize`, `term`, `summary`, `facultyProgress`, `filters`, `updatedAt`. Summary tính trên toàn bộ bộ lọc, không chỉ trang hiện tại.
- `GET /evaluation-workflow/:termId/export`: cùng bộ lọc; trả tất cả dòng có quyền truy cập để Web tạo Excel. Không dùng danh sách trang hiện tại làm export.
- `GET /reports/results` và `/reports/results/export`: thêm `termId`, cùng bộ lọc. Điểm lấy từ publication mới nhất; có `distribution`, `averageScore`, `classProgress`, `totalEvaluated`, `pendingStudents`, `source`.
- `GET /evaluation-workflow/:termId/conditions`: chỉ Admin; trả `canPublish`, `canClose`, `publishBlockers`, `closeBlockers`.
- `POST /evaluation-workflow/:termId/send`: `{studentIds: string[]}`, 1–100 phần tử; trả số phiếu thực sự mới gửi. Gọi lại không nhân revision của phiếu đã gửi.
- `POST .../students/:studentId/return` và `.../not-submitted`: `{reason: string}`, bắt buộc không trống.
- `POST .../publish`, `POST .../close`: điều kiện được kiểm tra lại trong transaction có khóa kỳ.
- `GET /assessments/students/:studentId?termId=...`: `permissions.canReview`, `canSend`, `sendBlockers`; CTSV xem điểm snapshot bàn giao khi phiếu đã gửi, `resultSource=HANDOFF_SNAPSHOT`.
- `GET /assessments/me`: `permissions.canEdit` cho phép sửa/nộp lại phiếu bị trả đến hạn chấm, kể cả đã qua hạn nộp ban đầu.
- `GET /evidence/:id`: file URL được ký sau khi kiểm tra quyền; trả `permissions.canReview`. Cán bộ Khoa không truy cập được file của Khoa khác qua endpoint này.
- `POST /evidence/:id/review`: `action`, `comment`, `expectedVersion` (tùy chọn để tương thích client cũ), `rejectBasis` khi từ chối, `missingItem` và `supplementDeadline` khi yêu cầu bổ sung. Không ghi điểm chính thức qua minh chứng.
- `POST /evidence/:id/verification-sources`: `sourceName`, `sourceUrl?`, `note`, `level`, `confirmedActivity`, `confirmedStudent`; lưu căn cứ và audit, không tự chốt điểm.
- `POST /evidence/:id/supplement`: `explanation?`, `verificationUrl?`, `fileData?`, `fileName?`, `fileType?`; cần ít nhất một nội dung. Tệp thật được lưu Supabase Storage. Kiểm tra chủ sở hữu, yêu cầu còn mở, hạn bổ sung và khóa phiếu.
- `PATCH /regulations/:id/status`: `{status: 'ACTIVE' | 'EXPIRED'}`; giữ lịch sử và liên kết tiêu chí. Không xóa văn bản đang là căn cứ tiêu chí.
- `GET /audit-logs`: `userId`, `action`, `entityType`, `search`, `page`, `pageSize`; tìm kiếm ở backend, không chỉ lọc trang đang hiển thị.

## Dạng response và lỗi

Workflow, báo cáo kết quả và danh sách job trả `{success:true,data:{items,total,...}}`. Các danh sách phân trang khác như users/evidence/appeals/audit trả `{success:true,data:[...],meta:{total,page,pageSize}}`. Không được mặc định mọi danh sách có cùng dạng envelope.

Lỗi trả `{success:false,error:{code,message,details},meta:{timestamp,path}}`; 400 cho nghiệp vụ/validation, 401 khi chưa xác thực hoặc tài khoản bị khóa, 403 khi sai role/Khoa, 404 khi không tìm thấy, 409 cho dữ liệu trùng/xung đột phiên bản hoặc khóa. Lỗi Prisma nội bộ không được trả nguyên câu truy vấn cho client.

## Danh mục routes theo controller

Danh mục này ghi nhận route có code. Các endpoint AI nâng cao chưa có controller không được xem là đã triển khai. Với route có JWT, service vẫn kiểm tra phạm vi sinh viên/Khoa và trạng thái kỳ.

| Method | Route | Quyền khai báo |
|---|---|---|
| `GET` | `/api/activities` | JWT; kiểm tra quyền ở service |
| `GET` | `/api/activities/:id` | JWT; kiểm tra quyền ở service |
| `POST` | `/api/activities` | ADMIN, STAFF |
| `POST` | `/api/activities/:id/attendance` | ADMIN, STAFF |
| `POST` | `/api/activities/:id/attendance/batch` | ADMIN, STAFF |
| `GET` | `/api/activities/:id/attendance` | ADMIN, STAFF |
| `DELETE` | `/api/activities/:id/attendance/:participantId` | ADMIN, STAFF |
| `PATCH` | `/api/activities/:id` | ADMIN, STAFF |
| `DELETE` | `/api/activities/:id` | ADMIN, STAFF |
| `GET` | `/api/appeals` | JWT; kiểm tra quyền ở service |
| `POST` | `/api/appeals` | STUDENT |
| `POST` | `/api/appeals/:id/resolve` | ADMIN, STAFF |
| `GET` | `/api/assessments/me` | STUDENT |
| `PUT` | `/api/assessments/me/:criterionId` | STUDENT |
| `POST` | `/api/assessments/me/save` | STUDENT |
| `POST` | `/api/assessments/me/submit` | STUDENT |
| `GET` | `/api/assessments/students/:studentId` | STAFF, ADMIN |
| `PUT` | `/api/assessments/students/:studentId/:termId/:criterionId/class` | STAFF, ADMIN |
| `PUT` | `/api/assessments/students/:studentId/:termId/:criterionId/verification` | STAFF, ADMIN |
| `PUT` | `/api/assessments/students/:studentId/:termId/:criterionId/final` | STAFF, ADMIN |
| `PUT` | `/api/assessments/students/:studentId/:termId/return` | STAFF, ADMIN |
| `GET` | `/api/audit-logs` | ADMIN |
| `GET` | `/api/health` | ADMIN |
| `POST` | `/api/auth/login` | Công khai / token của luồng |
| `GET` | `/api/auth/me` | JWT; kiểm tra quyền ở service |
| `POST` | `/api/auth/change-password` | JWT; kiểm tra quyền ở service |
| `POST` | `/api/auth/forgot-password` | Công khai / token của luồng |
| `POST` | `/api/auth/logout` | JWT; kiểm tra quyền ở service |
| `GET` | `/api/scores/dashboard` | JWT; kiểm tra quyền ở service |
| `GET` | `/api/scores/trace/:evidenceId` | JWT; kiểm tra quyền ở service |
| `GET` | `/api/scores/class/:classId` | ADMIN, STAFF |
| `GET` | `/api/scores/:studentId` | ADMIN, STAFF |
| `GET` | `/api/criteria` | Công khai / token của luồng |
| `GET` | `/api/rubric-templates` | ADMIN |
| `GET` | `/api/rubric-templates/:versionId` | ADMIN |
| `POST` | `/api/rubric-templates/draft` | ADMIN |
| `PUT` | `/api/rubric-templates/:versionId` | ADMIN |
| `POST` | `/api/rubric-templates/:versionId/publish` | ADMIN |
| `GET` | `/api/terms/:id/rubric` | ADMIN |
| `POST` | `/api/terms/:id/rubric/draft` | ADMIN |
| `PUT` | `/api/terms/:id/rubric` | ADMIN |
| `POST` | `/api/terms/:id/rubric/publish` | ADMIN |
| `POST` | `/api/criteria` | ADMIN |
| `PATCH` | `/api/criteria/:id` | ADMIN |
| `DELETE` | `/api/criteria/:id` | ADMIN |
| `GET` | `/api/terms` | Công khai / token của luồng |
| `GET` | `/api/terms/active` | Công khai / token của luồng |
| `POST` | `/api/terms` | ADMIN |
| `PATCH` | `/api/terms/:id` | ADMIN |
| `POST` | `/api/terms/:id/close` | ADMIN |
| `POST` | `/api/terms/:id/activate` | ADMIN |
| `POST` | `/api/terms/:id/reopen` | ADMIN |
| `GET` | `/api/faculties` | Công khai / token của luồng |
| `POST` | `/api/faculties` | ADMIN |
| `PATCH` | `/api/faculties/:id` | ADMIN |
| `DELETE` | `/api/faculties/:id` | ADMIN |
| `GET` | `/api/classes` | Công khai / token của luồng |
| `POST` | `/api/classes` | ADMIN |
| `PATCH` | `/api/classes/:id` | ADMIN |
| `DELETE` | `/api/classes/:id` | ADMIN |
| `GET` | `/api/regulations` | Công khai / token của luồng |
| `POST` | `/api/regulations` | ADMIN |
| `PATCH` | `/api/regulations/:id/status` | ADMIN |
| `DELETE` | `/api/regulations/:id` | ADMIN |
| `GET` | `/api/ai-jobs` | ADMIN |
| `POST` | `/api/ai-jobs/:id/retry` | ADMIN |
| `GET` | `/api/evaluation-workflow/:termId` | STAFF, ADMIN |
| `GET` | `/api/evaluation-workflow/:termId/export` | STAFF, ADMIN |
| `GET` | `/api/evaluation-workflow/:termId/conditions` | ADMIN |
| `GET` | `/api/evaluation-workflow/:termId/students/:studentId/history` | STAFF, ADMIN |
| `POST` | `/api/evaluation-workflow/:termId/send` | STAFF |
| `POST` | `/api/evaluation-workflow/:termId/students/:studentId/return` | ADMIN |
| `POST` | `/api/evaluation-workflow/:termId/students/:studentId/not-submitted` | STAFF |
| `POST` | `/api/evaluation-workflow/:termId/publish` | ADMIN |
| `POST` | `/api/evaluation-workflow/:termId/close` | ADMIN |
| `GET` | `/api/evidence` | STUDENT, STAFF, ADMIN |
| `GET` | `/api/evidence/:id` | STUDENT, STAFF, ADMIN |
| `POST` | `/api/evidence` | STUDENT |
| `POST` | `/api/evidence/:id/submit` | STUDENT |
| `POST` | `/api/evidence/:id/supplement` | STUDENT |
| `POST` | `/api/evidence/:id/withdraw` | STUDENT |
| `POST` | `/api/evidence/:id/files` | STUDENT |
| `POST` | `/api/evidence/:id/files/upload` | STUDENT |
| `DELETE` | `/api/evidence/:id/files/:fileId` | STUDENT |
| `PATCH` | `/api/evidence/:id` | STUDENT |
| `DELETE` | `/api/evidence/:id` | STUDENT |
| `GET` | `/api/notifications` | JWT; kiểm tra quyền ở service |
| `PATCH` | `/api/notifications/:id/read` | JWT; kiểm tra quyền ở service |
| `PATCH` | `/api/notifications/read-all` | JWT; kiểm tra quyền ở service |
| `GET` | `/api/reports/summary` | ADMIN, STAFF |
| `GET` | `/api/reports/distribution` | ADMIN, STAFF |
| `GET` | `/api/reports/faculties` | ADMIN, STAFF |
| `GET` | `/api/reports/results/export` | ADMIN, STAFF |
| `GET` | `/api/reports/results` | ADMIN, STAFF |
| `GET` | `/api/reviews/queue` | STAFF |
| `POST` | `/api/evidence/:id/claim` | STAFF |
| `POST` | `/api/evidence/:id/release` | STAFF |
| `POST` | `/api/evidence/:id/review` | STAFF |
| `POST` | `/api/evidence/:id/verification-sources` | STAFF |
| `GET` | `/api/users` | ADMIN, STAFF |
| `GET` | `/api/users/:id` | ADMIN, STAFF |
| `POST` | `/api/users/import` | ADMIN |
| `POST` | `/api/users` | ADMIN |
| `PATCH` | `/api/users/:id` | ADMIN |
| `DELETE` | `/api/users/:id` | ADMIN |
