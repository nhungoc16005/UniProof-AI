# Thiết kế cải thiện OCR tiếng Việt

Ngày: 2026-11-10
Trạng thái: Chờ người dùng duyệt tài liệu thiết kế
Ưu tiên đã chốt: Cải thiện luồng OCR production trước; fine-tune sau khi nhãn đạt điều kiện.

## Mục tiêu

Cải thiện khả năng đọc chứng nhận tiếng Việt có dấu, đặc biệt với ảnh chụp giấy tờ có chữ nhỏ, kiểu chữ biểu mẫu và bố cục nhiều vùng. Kết quả OCR phải giữ nguyên văn bản nhận dạng, tránh tự sửa tên người hoặc dữ liệu định danh khi không có bằng chứng từ ảnh.

## Hiện trạng và căn cứ

- `OcrExtractorService._extract_text()` hiện gọi Tesseract một lần trên toàn ảnh bằng `image_to_string`, chưa tạo các biến thể tiền xử lý hoặc chọn chế độ phân đoạn trang.
- `vie.traineddata` và `eng.traineddata` đã có trong `apps/ai-service/tessdata`; việc có gói ngôn ngữ không đồng nghĩa với việc model đã được fine-tune cho tài liệu của dự án.
- `docs/dataset-final-20261102/data_tracker.xlsx` theo dõi nhãn phân loại hoạt động, không phải tập ảnh-transcript OCR.
- Tập OCR local có 117 hồ sơ trong manifest nhưng 117 annotation chưa hoàn tất. Pilot có 20 transcript đang ở trạng thái `needs_review`; không được dùng draft làm ground truth.
- Báo cáo cũ đo trên 17 mẫu có CER 50.6% và WER 71.0%. Do nhãn chưa được xác nhận đầy đủ, đây chỉ là tín hiệu chẩn đoán, không phải benchmark nghiệm thu.

## Phạm vi đã chốt

Giai đoạn hiện tại tập trung sửa luồng nhận dạng đang chạy, không thay engine ngay và không huấn luyện từ nhãn chưa duyệt. So sánh model `vie+eng` hiện tại với gói Tesseract độ chính xác cao hơn trên cùng tập kiểm thử trước khi chọn model triển khai.

## Thiết kế cải thiện production

### Luồng xử lý

1. Giữ nguyên nhánh lấy text trực tiếp từ PDF có text layer.
2. Với ảnh/PDF scan, đọc hướng ảnh, chuyển grayscale và tạo các candidate giới hạn: ảnh gốc đã chuẩn hóa, tăng tương phản/phóng đại, và adaptive threshold. Chỉ deskew khi góc nghiêng đo được đáng tin cậy.
3. Chạy từng candidate với cấu hình phân đoạn trang Tesseract đại diện cho trang đầy đủ, khối văn bản và văn bản rải rác. Không threshold cố định mọi ảnh.
4. Dùng `image_to_data` lấy confidence theo từ/dòng. Candidate được chọn bằng tiêu chí đã đo trên tập kiểm thử; confidence tự thân không được xem là xác suất đúng. Nếu các candidate bất đồng ở tên/MSSV hoặc confidence thấp, đánh dấu cần kiểm tra thay vì tự chọn một giá trị nhạy cảm.
5. Trả `rawText` có dấu từ candidate được chọn; giữ parser tách riêng cho tên, MSSV, ngày và hoạt động. Chuẩn hóa Unicode chỉ phục vụ so sánh, không làm mất dấu khi hiển thị.
6. Tách lỗi engine, lỗi từng candidate và không nhận dạng được thành trạng thái rõ ràng; lỗi một candidate không làm dừng các candidate còn lại.

### An toàn và lỗi

- Nếu một nhánh tiền xử lý hoặc cấu hình Tesseract lỗi, thử nhánh còn lại; nếu tất cả lỗi thì trả lỗi OCR hiện có thay vì làm hỏng pipeline.
- Không biến confidence thành xác suất xác thực giấy tờ.
- Không tự thay tên/MSSV đọc được bằng giá trị khai báo. Chỉ dùng giá trị khai báo để đối chiếu và báo sai khác.
- Ảnh mờ, chữ quá nhỏ hoặc cắt mất nội dung vẫn có thể không đọc được; trả kết quả cần rà soát thay vì đoán.

## Fine-tune sau khi dữ liệu sẵn sàng

Sau khi luồng production cải thiện và có đủ ground truth, fine-tune Tesseract LSTM tiếng Việt/Anh bằng quy trình tesstrain. Dữ liệu cần có ảnh dòng chữ/crop ghép với transcription chính xác đã được người duyệt xác nhận, giữ dấu và Unicode NFC. Trước train phải rà PII tại chỗ, loại nhãn nháp, nhóm ảnh trùng/near-duplicate theo tài liệu gốc rồi chia train/validation/test theo nhóm tài liệu, không chia ngẫu nhiên theo crop.

Chỉ bắt đầu train khi có tập line-image/transcription đã duyệt và đủ đại diện cho các loại tài liệu; corpus hiện tại chưa đạt tiêu chí này. Chỉ phát hành model nếu held-out test đã duyệt cho thấy CER/WER tốt hơn baseline và không làm giảm độ chính xác trường trích xuất quan trọng. Ghi phiên bản model, cấu hình, manifest và metrics; giữ model cũ để rollback. Không cam kết trước mức tăng hay cỡ tập cần thiết khi chưa kiểm tra nhãn thực tế.

## Kiểm thử và nghiệm thu

- Unit test cho mỗi nhánh tiền xử lý, chọn candidate, lỗi Tesseract và giữ nguyên Unicode/dấu.
- Test parser cho nhãn tiếng Việt có dấu/không dấu, tên sinh viên, mã số và văn bản nhiều dòng.
- Dựng tập kiểm thử chỉ từ transcript đã được con người đối chiếu ảnh gốc; báo riêng ảnh chưa đọc được, CER/WER và độ chính xác trường định danh.
- Chia tập theo tài liệu gốc, loại exact duplicate khỏi tập test và không dùng mẫu `needs_review` làm ground truth.
- So sánh model hiện tại, model độ chính xác cao hơn và các candidate tiền xử lý trên cùng tập test; không tuyên bố OCR cải thiện nếu chưa có nhãn duyệt để đo.
- Giữ raw OCR, candidate được chọn, confidence chẩn đoán và cấu hình để tái lập kết quả.
- Kiểm tra endpoint AI trên ảnh scan và PDF, đồng thời bảo đảm lỗi OCR không gây HTTP 500 hay tạo kết luận tự động.

## Ngoài phạm vi giai đoạn đầu

- Không tự động sửa chính tả tên người hoặc dữ liệu định danh.
- Không dùng workbook phân loại hoạt động làm nhãn huấn luyện OCR.
- Không fine-tune từ `pilot_machine_draft.csv`, `pilot_visual_review.csv` hoặc transcript `needs_review`.
- Không đổi OCR engine trước khi có kết quả benchmark so sánh.

## Quyết định cần giữ

Tài liệu OCR chứa dữ liệu cá nhân nên ảnh và bản chép chuẩn chỉ xử lý trong thư mục local được kiểm soát. Mọi transcript pilot hiện có vẫn là nháp cho đến khi người duyệt xác nhận từng mẫu.
