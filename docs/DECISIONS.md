# Quyết định chủ dự án

Ngày ghi nhận ban đầu: 15/11/2026. Cập nhật quyết định chủ dự án: 15/11/2026.

| ID | Quyết định | Trạng thái | Bằng chứng / lưu ý |
|---|---|---|---|
| D1 | Tra cứu dùng allow-list cấu hình, mặc định DUT và Đoàn-Hội chính thức. Nguồn ngoài tắt mặc định; khi bật +10, nguồn chính thống +20, mạng xã hội tối đa +5 và chỉ là tín hiệu yếu. Query chỉ có tên hoạt động, năm, đơn vị; tuyệt đối không có họ tên/MSSV/CCCD. | ĐÃ QUYẾT ĐỊNH — 15/11/2026 | Chủ dự án cho phép đổi mặc định code để khớp D1. Cấu hình/test nhỏ được làm trong lượt này; các thay đổi boost còn lại thuộc M4. |
| D2 | Giữ trần 89 khi còn bước REVIEW/NOT_CHECKED. Chỉ XANH từ 90 khi mọi kiểm tra liên quan đã triển khai và đạt. | ĐÃ GHI NHẬN — phù hợp source of truth | `docs/pipeline_kiem_tra_minh_chung.md`, mục “Hành vi hiện được triển khai”, đã nêu trần 89. |
| D3 | Tắt toàn bộ xử lý khuôn mặt trong Luồng 3 bằng `FACE_MATCHING_ENABLED=false` mặc định; không detect, không embedding/vector, không tọa độ/khung mặt. Checker mặt trả NOT_CHECKED. Khi tắt, B/C không dựa trên mặt. | ĐÃ QUYẾT ĐỊNH — 15/11/2026 | Chủ dự án xác nhận tắt cả Haar detection; được phép triển khai chốt an toàn cùng M1. |
| D4 | Chỉ cân nhắc bật nhận dạng mặt sau khi trường xác nhận cơ sở pháp lý và consent; khi đó cần mã hóa, retention/xóa và audit. | BLOCKED — chờ xác nhận nhà trường | Hạng mục thật P2-M5-04 trong checklist; chưa có xử lý vector mặt. |
| D5 | Cấp 1 là Cố vấn học tập/BCS lớp, chỉ xác nhận tham gia; Cấp 2 là Ban thẩm định Khoa, chốt cuối. Cấp 1 không xem bản gốc giấy hiến máu; chỉ bản che. Cố vấn có thể xem bản đầy đủ nếu cần, phải nhập lý do và mọi lần mở phải audit. Mọi lần người khác xem ảnh gốc đều audit. | ĐÃ DUYỆT — cập nhật 15/11/2026 | Với BCS lớp: CCCD chỉ hiện 3 số cuối; ẩn lượng máu và ngày sinh. Ảnh che phải được tạo từ ảnh trước khi cấp quyền xem và lưu tách khỏi bản gốc. API BCS không trả OCR gốc nhạy cảm. Ảnh gốc chỉ qua endpoint có kiểm quyền hoặc URL ký hạn ngắn, không URL trực tiếp. Cố vấn mở ảnh gốc phải nhập lý do; audit gồm actor, hồ sơ, thời điểm, lý do. Chưa tạo migration/API; kiểm thử M6 được ghi trong checklist. |
| D6 | Một score breakdown dùng thành phần/trọng số cấu hình; mỗi thành phần ghi nguồn và trạng thái. Không gọi điểm là xác suất hoặc độ chính xác. | ĐÃ GHI NHẬN — chờ thực hiện M2+ | Hiện có các breakdown khác nhau trong AI service; thay đổi thuộc M2 trở đi, chưa đụng trong lượt này. |
| D7 | Ảnh cá nhân luôn vào hàng chờ người duyệt, không tự APPROVED. Batch chỉ cấp Khoa, chỉ hồ sơ đã xác nhận cấp 1 và không cảnh báo; ghi audit riêng từng hồ sơ. | ĐÃ GHI NHẬN — chờ thực hiện M5/M6 | Chưa thay đổi workflow. Cần kiểm thử điều kiện và audit khi triển khai. |
| D8 | Vision LLM chưa bật; scene hiện tại chỉ dùng OCR/heuristic. Chỉ tích hợp Vision LLM sau khi chủ dự án duyệt provider, dữ liệu được gửi, retention và giới hạn sử dụng ảnh. | CHỜ CHỦ DỰ ÁN XÁC NHẬN — chưa bật | Không gửi ảnh tới Vision LLM; giữ EXIF + OCR banner/scene hiện có. Chưa triển khai provider/API. |
| D9 | Trích xuất thực thể Lớp 4 dùng rule-based và kiểm định schema Pydantic. Mặc định không gửi OCR có PII cho LLM bên ngoài; `EXTERNAL_LLM_EXTRACTION_ENABLED=false`. Nếu muốn bật sau này phải che PII, dùng mô hình nội bộ hoặc có căn cứ pháp lý/đồng ý. | CHỜ CHỦ DỰ ÁN — mặc định an toàn đã quyết định, bật LLM vẫn chờ | Không có request LLM ngoài khi cờ tắt; có test khẳng định. |
| D10 | `AI_MODE=OFF|SHADOW|ASSIST`, mặc định `OFF`. OFF giữ hành vi tiền AI; SHADOW chỉ chạy và lưu `AiPipelineRun`, không hiển thị/đổi trạng thái/thứ tự queue; ASSIST hiển thị gợi ý, quyết định vẫn do người. | ĐÃ QUYẾT ĐỊNH — 15/11/2026 | Mode và nhánh tác động phải có test riêng; không được tạo đường AI tự APPROVED/REJECTED. |

## Ghi nhận rủi ro audit M1

`Review.rejectBasis` lưu nguyên văn; `AuditLog.newValue.reason` cũng lưu nguyên văn `comment`, và notification gửi comment. DTO hiện chưa giới hạn độ dài. Vì vậy cán bộ có thể vô tình ghi họ tên, MSSV, CCCD hoặc dữ liệu sức khỏe vào audit/notification; audit bất biến khiến việc thu hồi khó. Đề xuất cho lượt sửa review tiếp theo: giới hạn độ dài (ví dụ 500 ký tự), cảnh báo rõ “không nhập PII/CCCD/sức khỏe”, và lưu căn cứ bằng mã lý do có cấu trúc khi nghiệp vụ cho phép; không tự ý cắt nội dung audit hiện có. Test M1 dùng sentinel synthetic họ tên/MSSV/CCCD trong fixture và xác nhận không rò vào audit khi comment không chứa chúng.

## Cổng tiếp tục

D1 đã được chủ dự án giải quyết; D1/D3 safety patch được phép làm cùng M1. D4 vẫn BLOCKED cho mọi triển khai sinh trắc học thật. D9 external LLM extraction chờ chủ dự án; D10 mode được quyết định. M6 chưa bắt đầu migration/API.
