# Bàn giao Web Khoa và Admin/CTSV — 02/11/2026

## Phạm vi và trạng thái

Đã triển khai đợt hoàn thiện nghiệp vụ Web trên NestJS/Prisma và React hiện có. Giữ ba role `STUDENT`, `STAFF`, `ADMIN`; Khoa là đơn vị, không thêm role Faculty. Student Web là nguồn nghiệp vụ. Mobile và việc kết nối/nghiệm thu AI không thuộc đợt này.

Database và Storage của dự án vẫn là Supabase. Kiểm thử ghi dữ liệu sử dụng PostgreSQL riêng với dữ liệu tổng hợp, không seed/reset Supabase. Migration `20261102000100_workflow_integrity` đã được áp dụng lên Supabase sau khi kiểm tra chỉ đọc các ràng buộc và thử chuỗi migration trên DB riêng. Các bước xác minh sau triển khai được ghi ở phần kiểm thử.

## Tab trước và sau

| Vai trò | Trước | Sau |
|---|---|---|
| Khoa | Tổng quan, Minh chứng, Phúc khảo, Hoạt động & điểm danh, Phiếu rèn luyện, Tiêu chí; route Báo cáo chuyển về danh sách phiếu | Giữ các mục nghiệp vụ, mở Báo cáo Khoa bằng dữ liệu thật; Tổng quan chỉ hiển thị tóm tắt và liên kết đến danh sách |
| Admin | Tổng quan chứa cả bảng tiếp nhận; Tài khoản & đơn vị, Kỳ, Bộ tiêu chí, Quy chế, Giám sát | Tách Tiếp nhận & công bố và Báo cáo toàn trường khỏi Tổng quan; giữ các mục quản trị hiện có; Giám sát gồm nhật ký và dịch vụ, mã job AI được giữ để tích hợp sau |

Không thêm tab Tra cứu sinh viên trùng với Phiếu rèn luyện. Rule Engine vẫn nằm trong Bộ tiêu chí. Các route AI cấu hình/dataset/đánh giá nâng cao tiếp tục chuyển hướng, không quảng bá chức năng chưa kết nối.

### Các trang đã hoàn thiện

- Khoa: Dashboard, danh sách/chi tiết phiếu, hàng đợi và chi tiết minh chứng, phúc khảo, hoạt động/điểm danh, báo cáo.
- Admin: Dashboard, Tiếp nhận & công bố, chi tiết bản bàn giao, tra cứu minh chứng chỉ đọc, báo cáo, tài khoản/import/đơn vị, kỳ đánh giá, rubric phiên bản, hiệu lực quy chế và nhật ký.
- Student sửa giới hạn ở các chỗ liên thông: quyền sửa/nộp lại phiếu bị trả, bổ sung minh chứng thật, payload phúc khảo và điểm công bố.

## Nghiệp vụ và quyền

| Nghiệp vụ | Student | Khoa (`STAFF`) | Admin/CTSV |
|---|---|---|---|
| Tự đánh giá, nộp/nộp lại | Chính mình, đúng cửa sổ thời gian | Xem/trả phiếu theo Khoa | Xem |
| Minh chứng/file | Chính mình; sửa khi được phép | Xem/thẩm định theo danh sách kỳ | Xem căn cứ, không chấm thay |
| Xác minh và điểm tiêu chí | Xem điểm công bố | Xác minh/chốt khi phiếu đã nộp và chưa khóa | Không ghi điểm trong workflow mới |
| Gửi/trả kết quả | Xem kết quả của mình | Gửi CTSV | Trả Khoa có lý do |
| Công bố/chốt kỳ | Xem đúng phiên bản | Theo dõi | Thực hiện khi đủ điều kiện |
| Phúc khảo | Gửi sau công bố, trong hạn | Giải quyết theo Khoa | Giám sát, không ghi điểm trực tiếp |
| Tài khoản/đơn vị/rubric/kỳ | Không quản trị | Chỉ tra cứu liên quan | Quản trị và có audit |
| Báo cáo/export | Bảng điểm riêng | Theo Khoa | Toàn trường, theo bộ lọc |

### Phạm vi Khoa và dữ liệu lịch sử

- Kỳ có workflow: `AssessmentHandoff` chụp sinh viên, lớp, Khoa và rubric khi mở kỳ. Chuyển lớp sau đó không chuyển quyền xử lý của kỳ cũ.
- Minh chứng, file được ký, hàng đợi, chi tiết phiếu, điểm danh, báo cáo và export kiểm tra phạm vi ở backend. Không cấp quyền theo `facultyId` client gửi.
- `STAFF` không có Khoa bị chặn. Khóa tài khoản hoặc đổi phân công có hiệu lực từ request tiếp theo; không còn cache quyền 15 giây.
- Kỳ lịch sử `workflowEnabled=false` chỉ tra cứu sinh viên thực sự có dữ liệu trong kỳ. Không lấy toàn bộ sinh viên hiện tại làm sĩ số lịch sử, không tự dựng điểm bằng tổng Review.
- Kỳ cũ không có snapshot enrollment không thể khôi phục chính xác lịch sử chuyển lớp/sinh viên không nộp từ dữ liệu chưa lưu; phân quyền legacy dựa trên cơ cấu hiện có. Không tự chuyển đổi kỳ cũ.

### Chu trình kết quả

1. CTSV tạo kỳ UPCOMING, chuẩn bị rubric và ban hành. Chỉ mở kỳ sau khi có rubric; thao tác mở kỳ chụp danh sách và không được dùng lại để thêm sinh viên vào danh sách đã mở.
2. Student tạo minh chứng nháp, tải tệp vào Supabase Storage, tự đánh giá và nộp cả phiếu.
3. Khoa xác minh minh chứng và dữ liệu chính thức, chốt từng tiêu chí. Minh chứng không tự ghi điểm chính thức.
4. Nếu trả Student, ghi lý do và thông báo; hủy job cũ. Student được nộp lại đến hạn chấm, kể cả qua hạn nộp ban đầu.
5. Khi đủ tiêu chí có điểm/căn cứ và không còn minh chứng/phúc khảo chờ, Khoa gửi CTSV. Lưu snapshot, tăng revision và khóa sửa.
6. CTSV xem điểm từ snapshot bàn giao, có thể trả Khoa kèm lý do hoặc công bố khi toàn kỳ đủ điều kiện. Student chỉ thấy publication gần nhất.
7. Chấp thuận phúc khảo mở lại tiêu chí để Khoa xác minh, gửi lại và CTSV công bố revision tiếp theo. Publication cũ không bị ghi đè trong thời gian sửa. Bác phúc khảo giữ kết quả.
8. Chỉ chốt sau hạn phúc khảo, không còn đơn chờ và mọi phiếu đã gửi có publication mới nhất; ghi nhận không nộp là trạng thái riêng. CLOSED chỉ đọc.

Gửi lại phiếu đã gửi không tăng revision; công bố lại không tạo publication hoặc thông báo trùng. Các thao tác nhạy cảm dùng transaction và khóa dòng Term. Khóa nhận minh chứng dùng cập nhật có điều kiện; quyết định hỗ trợ `expectedVersion`, tăng phiên bản khi thay đổi và chặn xử lý lặp.

### Bổ sung minh chứng và nguồn xác minh

- Student bổ sung qua API thật, thay cho `setTimeout` mô phỏng thành công. Chỉ chủ hồ sơ với yêu cầu đang mở, trong hạn và phiếu chưa khóa mới được nộp.
- Nội dung bổ sung/tệp thật được lưu; đóng yêu cầu, tăng version, tạo lượt xử lý nền và đưa hồ sơ trở lại hàng đợi. Có thể chỉ gửi giải trình hoặc liên kết mà không tải tệp mới.
- Nguồn xác minh của cán bộ lưu `VerificationResult` và audit; tải lại trang vẫn có dữ liệu, không chỉ lưu React state.
- Màn hình thẩm định chỉ đọc khi đã có quyết định/phiếu đã gửi/kỳ đã đóng; giữ server authorization dù client tự gọi API.

## Điểm, báo cáo và hợp đồng dữ liệu

- Điểm theo rubric: cộng điểm tiêu chí đã FINALIZED, áp trần nhóm, tổng tối đa 100 và xếp loại dùng cùng chính sách.
- Báo cáo kết quả lấy publication mới nhất. Phiếu đang sửa sau phúc khảo vẫn báo điểm publication trước đó cho đến khi công bố mới.
- Chưa công bố/không nộp không được tính như sinh viên đã chấm 0 điểm hoặc tự đưa vào nhóm Yếu.
- Mẫu số kỳ mới là danh sách snapshot. Dashboard, bảng phiếu và export có cùng định nghĩa trạng thái.
- Lọc/tìm kiếm/phân trang workflow và báo cáo thực hiện ở backend, 25 dòng mặc định, tối đa 100. Summary tính trên toàn bộ tập đã lọc. Export gọi endpoint riêng lấy toàn bộ bộ lọc đã kiểm tra quyền, rồi Web tạo Excel.
- Bộ lọc kỳ, lớp, Khoa, trạng thái, tìm kiếm và trang lưu trên URL; trả về danh sách từ phiếu giữ bộ lọc. Các trang danh sách chính chặn response cũ ghi đè dữ liệu sau khi đổi kỳ/lọc.
- Hợp đồng API mới và danh mục 105 controller routes: [API hiện hành](../../EduPoint_API_BE.md).

### API bổ sung/điều chỉnh chính

| Nhóm | Thay đổi |
|---|---|
| `/evaluation-workflow/:termId` | Query DTO, tìm kiếm/trạng thái/phân trang, summary, facultyProgress, filter options |
| `/evaluation-workflow/:termId/export` | Export đầy đủ theo cùng phạm vi/bộ lọc |
| `/evaluation-workflow/:termId/conditions` | Điều kiện công bố/chốt và lý do bị chặn |
| `/reports/*` | Nhận actor, chặn truy cập ngoài Khoa, dùng snapshot danh sách và publication |
| `/reports/results`, `/reports/results/export` | Báo cáo thật theo Khoa/lớp/kỳ, xếp loại và điểm công bố |
| `/users/:id?termId=...` | Tra cứu theo phạm vi của kỳ khi sinh viên đã chuyển lớp |
| `/evidence/:id/supplement` | Bổ sung thật, upload Supabase, version/audit và xử lý yêu cầu |
| `/evidence/:id/verification-sources` | Căn cứ xác minh được lưu thực tế |
| `/evidence/:id/review` | expectedVersion, giữ đầy đủ căn cứ từ chối và nội dung/hạn bổ sung từ Web |
| `/regulations/:id/status` | Ngừng/khôi phục hiệu lực, giữ liên kết tiêu chí và lịch sử |
| `/audit-logs` | Tìm kiếm backend và đọc đúng envelope phân trang |
| `/health` | Chỉ Admin; phân biệt dịch vụ chưa cấu hình và chưa kiểm tra |
| `/ai-jobs` | Mã giám sát/retry để tích hợp AI sau, không là điều kiện nghiệm thu AI |

Account CRUD/import, Khoa/lớp, kỳ, rubric, hiệu lực quy chế, hoạt động/điểm danh và quyết định nghiệp vụ ghi audit. Import giới hạn 1.000 dòng, kiểm tra kiểu dữ liệu và không đổi role của tài khoản hiện có qua import. Endpoint cũ không được sửa/xóa tiêu chí thuộc rubric phiên bản. Văn bản đang liên kết tiêu chí và đơn vị/lớp đang có lịch sử không được xóa làm mất căn cứ.

## Database và Supabase

Migration mới:

- Enum `AssessmentHandoffStatus`: WORKING, SENT, RETURNED, EXCLUDED.
- Foreign key từ handoff/publication đến sinh viên, kỳ, rubric, lớp/Khoa, người gửi/công bố; từ Appeal đến kỳ và đánh giá tiêu chí.
- Index job theo trạng thái/thời điểm bắt đầu và audit theo thời gian.
- Giữ quy tắc RESTRICT cho minh chứng đã có Appeal để bảo toàn lịch sử.
- Không backfill điểm, không reset/seed hoặc đổi workflow của kỳ CLOSED.

Preflight `node scripts/check-workflow-integrity.cjs` chỉ đọc và chỉ xuất số lượng lỗi. Trước triển khai Supabase: 0 trạng thái lạ, 0 handoff/publication/appeal mồ côi, 0 rubric bàn giao sai kỳ. `prisma migrate status` xác nhận chỉ thiếu migration mới, sau đó `prisma migrate deploy` áp dụng thành công migration này. Kiểm tra sau triển khai: `prisma migrate status` báo cả 9 migration đã cập nhật; chạy lại preflight vẫn có 0 lỗi ở toàn bộ kiểm tra.

Schema tham chiếu đã đồng bộ tại `docs/02-database/schema.prisma` và `schema.sql` (DDL sinh từ schema, không phải bản sao lưu dữ liệu). Không chạy file DDL toàn bộ lên database đang sử dụng; dùng migration.

## Kiểm thử và bằng chứng

### Đã chạy

- Backend `npm run build` và Web `npm run build`: đạt; backend tự generate Prisma Client, Web chạy TypeScript trước Vite.
- Kiểm tra TypeScript độc lập cho cả hai ứng dụng: đạt.
- Unit worker hiện có: 15/15 đạt, xác minh chặn kết quả sai phiên bản/trạng thái. Đây là kiểm thử mã tích hợp, không chứng minh chất lượng AI.
- API PostgreSQL thực: 13 kịch bản con, 14 test theo bộ đếm Node, đạt. Dữ liệu tổng hợp có hai Khoa, nhiều lớp, ba role và cán bộ chưa phân công.
- Chrome headless: mở các trang chính Admin/Khoa và Student, không có lỗi runtime hoặc request API thất bại; tải file Excel thật và đọc lại xác nhận điểm publication 95; bảng phiếu Khoa vừa viewport di động 390px; đổi kỳ từ trang chi tiết tự về danh sách và bỏ các bộ lọc của kỳ cũ.
- Chạy cả 9 migration SQL trên PostgreSQL 16/pgvector riêng. Riêng baseline từ PostgreSQL 17 được bỏ lệnh `SET transaction_timeout = 0` trên luồng test vì PG16 chưa hỗ trợ; file migration gốc không thay đổi.
- Đối chiếu DB kiểm thử với Prisma bằng `prisma migrate diff`: không có khác biệt.
- Supabase: preflight chỉ đọc và migration deploy thành công. Không dùng dữ liệu người dùng thật cho API/browser fixture.

### Kịch bản API bao phủ

CRUD/import tài khoản và đơn vị; audit; quy chế còn liên kết không bị xóa; rubric đã ban hành bất biến; quyền chéo Khoa; phân trang/export; trả và nộp lại sau hạn nộp; chuyển lớp vẫn giữ phạm vi kỳ; hoạt động/điểm danh/import; bổ sung và nguồn xác minh bền vững; cạnh tranh nhận hồ sơ; quyền Admin không chấm thay; bàn giao/trả/công bố lặp; cả chấp thuận và bác phúc khảo; publication cũ trong lúc sửa; chốt trước/sau hạn; khóa tài khoản/đổi phân công có hiệu lực; mở kỳ cần rubric; legacy không tự dựng sĩ số.

### Chạy lại an toàn

Tạo một database PostgreSQL/pgvector riêng, tên chứa `_test`, áp dụng chuỗi migration rồi đặt `TEST_DATABASE_URL`. Các test API/browser từ chối URL ngoài localhost hoặc tên không có `_test`.

```sh
TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:PORT/edupoint_workflow_test' node --test apps/backend/test/workflow.integration.test.cjs
TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:PORT/edupoint_workflow_test' node apps/backend/test/browser-smoke.cjs
node --test apps/backend/test/evidence-processing-worker.test.cjs
```

Browser script dùng Chrome được cài trên macOS; có thể chỉ định `CHROME_BIN`. Dùng profile tạm, không dùng phiên đăng nhập trình duyệt cá nhân. Fixture integration tạo dữ liệu tổng hợp riêng mỗi lần chạy; không đặt TEST_DATABASE_URL trỏ Supabase.

## AI làm sau và giới hạn nghiệm thu

- Theo yêu cầu chủ dự án: kết nối/nghiệm thu OCR, extraction, PhoBERT, RAG và đánh giá mô hình là bước cuối. Không công bố accuracy/F1 hoặc dữ liệu Ground Truth giả.
- Giữ mã job/run/step, kiểm tra phiên bản, recovery và retry để ghép sau. Khi chưa cấu hình pipeline, nghiệp vụ vẫn cho Khoa xử lý thủ công.
- Không coi `APPROVED` tự động là nhãn chuẩn và không mở lại trang cấu hình localStorage như một cài đặt hệ thống thật.
- Browser/API nghiệm thu dùng database riêng. Upload/signing Supabase Storage giữ kết nối hiện có; chưa thực hiện upload/xóa tệp thật trong bucket của người dùng trong đợt kiểm thử này.
- Danh sách có phân trang server, nhưng một số thống kê trạng thái được tổng hợp trên tập dữ liệu đã scope trong backend; chưa nghiệm thu tải toàn trường ở quy mô lớn.
- Web build hiện còn cảnh báo bundle lớn; không phải lỗi build. Chưa mở rộng phạm vi sang tối ưu tải module hoặc Mobile.
- Giữ nguyên thay đổi có sẵn của người dùng trong `docs/06-ke-hoach-trien-khai/02-task-nghiep-vu-be-fe.md`.

## Các file thay đổi

Danh sách dưới đây phục vụ review; không bao gồm file task do người dùng sửa trước đợt này.

- `EduPoint_API_BE.md`
- `EduPoint_ThietKe_Trang_FE.md`
- `apps/backend/package.json`
- `apps/backend/prisma/migrations/20261102000100_workflow_integrity/migration.sql`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/scripts/check-workflow-integrity.cjs`
- `apps/backend/src/activities/activities.controller.ts`
- `apps/backend/src/activities/activities.service.ts`
- `apps/backend/src/activities/dto/activity.dto.ts`
- `apps/backend/src/assessments/assessments.service.ts`
- `apps/backend/src/audit-log/audit-log.controller.ts`
- `apps/backend/src/audit-log/audit-log.service.ts`
- `apps/backend/src/auth/jwt.strategy.ts`
- `apps/backend/src/common/filters/http-exception.filter.ts`
- `apps/backend/src/conduct-scores/conduct-scores.controller.ts`
- `apps/backend/src/conduct-scores/conduct-scores.module.ts`
- `apps/backend/src/conduct-scores/conduct-scores.service.ts`
- `apps/backend/src/criteria/criteria.controller.ts`
- `apps/backend/src/criteria/criteria.service.ts`
- `apps/backend/src/criteria/dto/criteria.dto.ts`
- `apps/backend/src/evaluation-workflow/ai-jobs.controller.ts`
- `apps/backend/src/evaluation-workflow/dto/workflow-query.dto.ts`
- `apps/backend/src/evaluation-workflow/evaluation-policy.ts`
- `apps/backend/src/evaluation-workflow/workflow.controller.ts`
- `apps/backend/src/evaluation-workflow/workflow.module.ts`
- `apps/backend/src/evaluation-workflow/workflow.service.ts`
- `apps/backend/src/evidence/dto/evidence.dto.ts`
- `apps/backend/src/evidence/evidence-processing.worker.ts`
- `apps/backend/src/evidence/evidence.controller.ts`
- `apps/backend/src/evidence/evidence.service.ts`
- `apps/backend/src/reports/reports.controller.ts`
- `apps/backend/src/reports/reports.service.ts`
- `apps/backend/src/reviews/dto/review.dto.ts`
- `apps/backend/src/reviews/reviews.controller.ts`
- `apps/backend/src/reviews/reviews.service.ts`
- `apps/backend/src/users/dto/user.dto.ts`
- `apps/backend/src/users/users.controller.ts`
- `apps/backend/src/users/users.service.ts`
- `apps/backend/test/browser-smoke.cjs`
- `apps/backend/test/workflow.integration.test.cjs`
- `apps/web/src/components/AiJobs.tsx`
- `apps/web/src/components/EvaluationBoard.tsx`
- `apps/web/src/components/EvidenceInspection.tsx`
- `apps/web/src/components/ResultReports.tsx`
- `apps/web/src/layouts/AppLayout.tsx`
- `apps/web/src/lib/apiClient.ts`
- `apps/web/src/pages/admin/AiConfig.tsx`
- `apps/web/src/pages/admin/AiEvaluation.tsx`
- `apps/web/src/pages/admin/AuditLogs.tsx`
- `apps/web/src/pages/admin/Dashboard.tsx`
- `apps/web/src/pages/admin/KnowledgeBase.tsx`
- `apps/web/src/pages/admin/Monitoring.tsx`
- `apps/web/src/pages/admin/ResultsReception.tsx`
- `apps/web/src/pages/admin/TermsMasterData.tsx`
- `apps/web/src/pages/admin/UserManagement.tsx`
- `apps/web/src/pages/officer/AppealsResolution.tsx`
- `apps/web/src/pages/officer/Reports.tsx`
- `apps/web/src/pages/officer/ReviewDetail.tsx`
- `apps/web/src/pages/officer/ReviewQueue.tsx`
- `apps/web/src/pages/officer/StudentAssessment.tsx`
- `apps/web/src/pages/student/EvidenceDetail.tsx`
- `apps/web/src/pages/student/ScoreReport.tsx`
- `apps/web/src/pages/student/SupplementEvidence.tsx`
- `apps/web/src/routes.tsx`
- `apps/web/src/types/index.ts`
- `cautruc.md`
- `docs/02-database/schema.prisma`
- `docs/02-database/schema.sql`
- `docs/05-feature-specs/README.md`
- `docs/06-ke-hoach-trien-khai/08-tien-do-chuan-hoa-khoa-ctsv.md`
- `docs/06-ke-hoach-trien-khai/README.md`
- `docs/07-hien-trang-he-thong/EDUPOINT_CURRENT_SYSTEM_HANDBOOK_2026-10-27.md`
- `docs/07-hien-trang-he-thong/FACULTY_ADMIN_HANDOFF_2026-11-02.md`
- `docs/BAO_CAO_THAY_DOI_VA_TOI_UU_HE_THONG.md`
- `docs/README.md`
