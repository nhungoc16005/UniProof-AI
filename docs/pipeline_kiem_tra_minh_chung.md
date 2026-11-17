# Pipeline kiểm tra minh chứng (Luồng 1)

```text
[Sinh viên nộp Form Web + Tệp Giấy chứng nhận (Ảnh/PDF)]
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 0 & 1: TIẾP NHẬN & KIỂM TRA CHẤT LƯỢNG ẢNH                           │
├──────────────────────────────────────────────────────────────────────────┤
│ • Kiểm tra định dạng (JPG, PNG, PDF), dung lượng ≤ 8MB (Pillow)          │
│ • OpenCV: đo độ mờ nét (Laplacian blur), độ sáng, góc nghiêng méo        │
│   → Tệp lỗi / ảnh quá mờ: DỪNG SỚM, yêu cầu chụp lại                     │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ (Ảnh đạt chất lượng)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 2: KIỂM SOÁT GIAN LẬN & TRÙNG LẶP SỐ                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ • SHA-256: phát hiện nộp cùng một file ảnh gốc                           │
│ • pHash: phát hiện ảnh chụp lại từ màn hình hoặc dùng chung giấy tờ      │
│   → Trùng lặp bất thường: CẢNH BÁO ĐỎ / VÀNG                             │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ (Không trùng lặp)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 3: TRÍCH XUẤT TOÀN VĂN HÀNH CHÍNH (OCR)                              │
├──────────────────────────────────────────────────────────────────────────┤
│ • Tesseract v4 LSTM / PaddleOCR: nhận diện chữ, số quyết định, con dấu   │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 4: BÓC TÁCH THỰC THỂ CÓ CẤU TRÚC (LLM Schema JSON)                   │
├──────────────────────────────────────────────────────────────────────────┤
│ • Giấy trong/ngoài trường: Họ tên, MSSV, Sự kiện, Ngày cấp...            │
│ • Giấy hiến máu: Họ tên, Ngày sinh, CCCD, Lượng máu, Ngày hiến           │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 5: ĐỐI CHIẾU 3 CHIỀU (Form Web ↔ OCR ↔ Hồ sơ SV)                     │
├──────────────────────────────────────────────────────────────────────────┤
│ • So khớp định danh: Họ tên & MSSV (hoặc CCCD nếu là hiến máu)           │
│ • thefuzz: khớp "Tên hoạt động" tự khai với chữ đọc được trên giấy       │
│ • Kiểm tra ngày cấp có thuộc học kỳ đang xét rèn luyện hay không         │
│   → Sai họ tên, MSSV/CCCD hoặc học kỳ: ĐỎ (từ chối ngay)                 │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ (Đúng người & đúng học kỳ)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 6: NHẬN DIỆN MẪU PHÔI & DẤU HIỆU CHỈNH SỬA                           │
├──────────────────────────────────────────────────────────────────────────┤
│ • So khớp bố cục với phôi chuẩn DUT; ELA quét vùng chữ dán đè            │
│ • Kích hoạt LUỒNG TRA CỨU ĐỐI CHIẾU (xem Luồng 2)                        │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 7 & 8: TÍNH ĐIỂM TIN CẬY & PHÂN LUỒNG DUYỆT (HITL)                   │
├──────────────────────────────────────────────────────────────────────────┤
│ → XANH (≥ 90): tạm tính điểm + rút mẫu 5-10% kiểm toán ngẫu nhiên        │
│ → VÀNG (60 - 89, phôi lạ, chữ mờ): đẩy vào Hàng chờ Người duyệt          │
│ → ĐỎ (< 60, trùng lặp, giả mạo): từ chối kèm lý do tiếng Việt rõ ràng    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Hành vi hiện được triển khai

- Cổng chất lượng trả điểm ước lượng 0–100 và dừng pipeline dưới 70. Điểm này
  là heuristic: độ nét chiếm 70% (`min(100, blur/(2 × ngưỡng Laplacian) × 100)`),
  độ sáng chiếm 20%, góc nghiêng chiếm 10%; đây không phải xác suất ảnh/chứng
  nhận hợp lệ.
- Nếu OCR đọc được MSSV khác hồ sơ, tên khớp dưới 70%, hoặc ngày cấp nằm ngoài
  khoảng ngày học kỳ, pipeline phân loại ĐỎ, gợi ý 0 điểm và bỏ qua tra cứu web.
  Worker lưu trạng thái `INVALID`, cảnh báo và thông báo lý do; cán bộ vẫn cần
  kiểm tra ảnh gốc nếu OCR có thể đọc nhầm.
- Tên khớp 70–84% hoặc không trích xuất được được báo cần xem lại; chỉ số từ
  85% trở lên được tính là khớp ở mức heuristic.
- Tra cứu công khai mặc định chỉ nhận nguồn thuộc allow-list domain chính thức
  cấu hình được (mặc định DUT và Đoàn-Hội chính thức); nguồn báo chí/mạng xã hội
  tắt mặc định và chỉ được nhận khi bật cờ cấu hình. Nguồn chính thống có thể
  đóng góp +20; nguồn ngoài chính thống tối đa +10; mạng xã hội tối đa +5 và
  chỉ là tín hiệu yếu. Query chỉ gồm tên hoạt động, năm và đơn vị tổ chức,
  tuyệt đối không gồm họ tên/MSSV/CCCD. Không tìm thấy bài viết không chứng minh
  hoạt động không tồn tại và cũng không chứng minh chứng nhận giả.
- Checklist kết quả gồm chất lượng, OCR, danh tính, học kỳ, ELA, chữ ký/dấu,
  nguồn công khai, trùng lặp và phôi. Chế độ thử hiển thị chi tiết; kết quả xử
  lý thường hiển thị bản tóm tắt và giữ checklist trong lần chạy AI.
- Điểm thô từ 90 trở lên vẫn bị giới hạn tối đa 89 (VÀNG mạnh) nếu còn bước
  xác minh tính xác thực ở trạng thái `REVIEW` hoặc `NOT_CHECKED`, như trùng
  lặp, ELA, chữ ký/dấu, nguồn công khai hoặc phôi. Chỉ khi các kiểm tra này
  được triển khai và đạt mới có thể phân loại XANH; thiếu nguồn công khai không
  tự động đồng nghĩa chứng nhận giả.
- Dấu đỏ gần tròn và nét ở vùng cuối trang chỉ được tìm bằng heuristic ảnh.
  Trạng thái `PRESENT` nghĩa là thấy dấu hiệu hình ảnh, không xác minh được
  người ký, con dấu, thẩm quyền hay tính thật của chứng nhận.
- ELA luôn cần xem xét thủ công: không có tín hiệu không chứng minh ảnh nguyên
  bản, còn tín hiệu bất thường có thể là nén ảnh/chỉnh sửa hợp lệ.
- Nếu không trích xuất được MSSV, pipeline không coi đó là bằng chứng MSSV sai;
  kết quả tiếp tục được đánh giá theo tín hiệu hiện có và cần cán bộ kiểm tra.
- SHA-256/pHash hiện chỉ được tính cho tệp đang xử lý, chưa được so sánh với
  kho hồ sơ để xác định trùng lặp. Kho phôi chuẩn/chữ ký/con dấu cũng chưa có,
  nên các mục tương ứng được ghi `NOT_CHECKED`, không suy diễn thành đạt.
- Chưa có bộ dữ liệu gán nhãn “thật/giả” để đo độ chính xác. Các kịch bản giả
  lập dùng ảnh tổng hợp và lỗi có kiểm soát; không dùng ảnh giấy tờ thật làm
  ground truth.
- `INVALID` được dùng thay cho `REJECTED` vì `REJECTED` trong hệ thống là quyết
  định chính thức của cán bộ, có người duyệt và căn cứ từ chối. Nếu OCR nhận diện
  nhầm, sinh viên cần liên hệ cán bộ để được hỗ trợ.
