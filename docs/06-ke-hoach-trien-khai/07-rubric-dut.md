# Rubric Đánh giá rèn luyện ĐHBK Đà Nẵng

## Phạm vi

Rubric áp dụng từ kỳ đánh giá mới được tạo sau khi migration được triển khai. Các kỳ cũ, tiêu chí cũ và lịch sử phê duyệt không bị cập nhật hồi tố. Không đưa điểm tự đánh giá màu đỏ hoặc tổng 87 trong ảnh tham chiếu vào cấu hình.

Mỗi kỳ mới nhận một `RubricVersion` gồm 5 khung, 16 tiêu chí và tổng tối đa 100 điểm. Phiên bản, khung và tiêu chí được lưu cùng kỳ để các kỳ sau có thể thay đổi độc lập. Ngưỡng xếp loại tiếp tục dùng cấu hình Backend hiện tại.

| Khung | Mã mục | Điểm tối đa |
|---|---:|---:|
| I. Ý thức tham gia học tập | 1–5 | 6, 3, 5, 3, 3 (20) |
| II. Chấp hành nội quy, quy chế | 6–8 | 5, 15, 5 (25) |
| III. Hoạt động chính trị, xã hội, phong trào | 9–10 | 10, 10 (20) |
| IV. Công dân trong quan hệ cộng đồng | 11–13 | 10, 10, 5 (25) |
| V. Công tác cán bộ lớp, đoàn thể | 14–16 | 4, 3, 3 (10) |

## Luồng chấm

- Sinh viên ghi điểm tự đánh giá và ghi chú; đây không phải điểm chính thức.
- Cán bộ ghi kết quả lớp cùng căn cứ xác nhận của tập thể.
- Cán bộ nhập dữ liệu xác minh và nguồn đối chiếu. Backend tính điểm đề xuất kèm giải thích.
- Cán bộ xác nhận đề xuất hoặc nhập điểm khác; điểm khác bắt buộc có lý do.
- Chỉ kết quả ở trạng thái `FINALIZED` được cộng vào điểm chính thức. Điểm theo từng khung và tổng điểm đều áp trần.
- Thiếu dữ liệu bắt buộc thì tiêu chí ở trạng thái `NEEDS_VERIFICATION`; đã đủ dữ liệu thì `READY_FOR_REVIEW`; cán bộ chốt thì `FINALIZED`.
- Số hoạt động của các tiêu chí theo lượt được đếm từ minh chứng đã duyệt gắn với tiêu chí. Minh chứng đang xử lý khiến việc tính điểm chờ; minh chứng bị từ chối hoặc rút không được tính.
- Chỉ kỳ `CLOSED` mới khóa sửa đánh giá.

## API

- `GET /api/criteria?termId=...`: phiên bản rubric, khung điểm, 16 tiêu chí, mô tả và cấu hình quy tắc.
- `GET /api/assessments/me?termId=...`: rubric và tự đánh giá của sinh viên hiện tại.
- `PUT /api/assessments/me/:criterionId?termId=...`: lưu điểm tự đánh giá/ghi chú; Backend kiểm tra điểm theo trần.
- `GET /api/assessments/students/:studentId?termId=...`: cán bộ xem tự đánh giá, điểm lớp, dữ liệu xác minh, đề xuất, kết quả chính thức và minh chứng.
- `PUT /api/assessments/students/:studentId/:termId/:criterionId/class`: ghi điểm lớp và căn cứ tập thể.
- `PUT /api/assessments/students/:studentId/:termId/:criterionId/verification`: lưu dữ liệu xác minh và tính lại đề xuất.
- `PUT /api/assessments/students/:studentId/:termId/:criterionId/final`: xác nhận điểm chính thức.
- `GET /api/scores/dashboard?termId=...`: tổng điểm chính thức khi đủ tiêu chí, điểm đang hoàn tất, điểm từng khung, trạng thái và giải thích từng mục.

## Migration và dữ liệu thật

Supabase ban đầu có schema và dữ liệu nhưng chưa có lịch sử `_prisma_migrations`. Vì vậy đã tạo `20261018000000_baseline_existing_supabase` từ schema-only dump hiện trạng và đánh dấu baseline là đã áp dụng; baseline này chỉ ghi nhận cấu trúc DB cũ, không chạy lại trên DB đó. Hai migration rubric `20261019000100_add_versioned_dut_rubric` và `20261019000200_rubric_templates` đã được áp dụng thành công. Chúng thêm bảng/quan hệ phiên bản và đánh giá, mở rộng liên kết của `Criterion` và `Evidence`, rồi tạo cấu hình mẫu `DUT_DEFAULT v1`; không xóa hoặc cập nhật tiêu chí/lượt duyệt hiện có. Sau migrate, truy vấn đọc xác nhận số cũ vẫn là 4 kỳ, 23 tiêu chí, 2 minh chứng và 1 lượt duyệt; cấu hình mới có 5 khung, 16 tiêu chí, tổng 100 điểm. `prisma migrate status` báo schema up to date. Bản sao lưu đầy đủ trước migration nằm tại `/private/tmp/edupoint-pre-rubric-20261019.dump`. Không chạy `prisma:seed` trên DB thật.

Tích hợp dữ liệu học tập, học phí, chuyên cần và vi phạm chưa được giả lập. Cán bộ chỉ có thể xác nhận những nguồn dữ liệu thực đã kiểm tra; thiếu nguồn vẫn là chờ xác minh.

## Quản trị bộ chuẩn và phiên bản

`RubricTemplate` lưu bộ chuẩn; mỗi lần cập nhật tạo `RubricTemplateVersion` mới. Bản chuẩn khởi tạo `DUT_DEFAULT v1` lấy từ 16 tiêu chí ở trên. Quản trị viên sao chép bản đang ban hành thành nháp, chỉnh sửa và ban hành. Bản cũ chuyển sang lưu trữ nhưng vẫn được giữ để truy nguồn.

Khi tạo kỳ, quản trị viên chọn bộ chuẩn hiện tại hoặc kỳ đã ban hành. Backend sao chép toàn bộ khung, tiêu chí và quy tắc thành `RubricVersion` trạng thái `DRAFT`; bản sao không thay đổi theo các cập nhật của nguồn. Kỳ mới ở trạng thái `UPCOMING` cho tới khi bản nháp được ban hành và kỳ được mở. Không cho áp dụng rubric mới hồi tố vào kỳ đã có minh chứng/điểm.

Trong trang **Quản trị → Tiêu chí đánh giá**, tab **Bộ chuẩn** dùng để tạo/sửa/ban hành phiên bản chuẩn; tab **Theo kỳ** dùng để chỉnh bản nháp, xem trạng thái và ban hành riêng cho kỳ. Backend kiểm tra tổng rubric bằng 100, từng khung bằng tổng tiêu chí, mã không trùng và loại quy tắc được hỗ trợ. Phiên bản đã ban hành chỉ đọc. Muốn cập nhật mẫu, tạo nháp mới; muốn kỳ mới dùng thay đổi đó, chọn phiên bản chuẩn mới khi tạo kỳ.

Các API quản trị bổ sung gồm `GET /api/rubric-templates`, `GET /api/rubric-templates/:versionId`, `POST /api/rubric-templates/draft`, `PUT /api/rubric-templates/:versionId`, `POST /api/rubric-templates/:versionId/publish`, `GET /api/terms/:id/rubric`, `POST /api/terms/:id/rubric/draft`, `PUT /api/terms/:id/rubric`, `POST /api/terms/:id/rubric/publish` và `POST /api/terms/:id/activate`.
