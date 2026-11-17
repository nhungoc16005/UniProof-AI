# Sơ đồ Luồng 3 nâng cấp: Nhận diện mặt + Tra cứu + Khoa kiểm duyệt

```text
              [Sinh viên nộp Ảnh sự kiện + Khai Form trên Web]
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 1: KIỂM SOÁT GIAN LẬN SỐ & EXIF                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ • SHA-256 / pHash: chặn nộp lại ảnh cũ, ảnh tải từ bạn bè.               │
│ • Metadata EXIF: đọc ngày chụp, đối chiếu thời gian tự khai.             │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 2: SO KHỚP MẶT SINH VIÊN (Face Verification)                         │
├──────────────────────────────────────────────────────────────────────────┤
│ • MTCNN / YOLO: phát hiện các khuôn mặt trong ảnh sự kiện.               │
│ • FaceNet: trích vector 512-D, so khớp với Avatar hồ sơ SV.              │
│ → Tìm thấy mặt khớp: CỘNG ĐIỂM TIN CẬY (+30 điểm).                       │
│ → Mặt mờ / nghiêng: đánh dấu "Cần con người nhìn mắt".                   │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 3: OCR CHỮ BỐI CẢNH & HIỂU NGỮ CẢNH (Scene & Vision)                 │
├──────────────────────────────────────────────────────────────────────────┤
│ • EAST + Tesseract: đọc chữ banner, backdrop, áo sự kiện.                │
│ • Vision LLM: phân tích bối cảnh (hội trường, ngoài trời).               │
│ → So khớp nội dung hình ảnh với "Tên hoạt động" trên Form.               │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 4: TRA CỨU WEB / CSDL NỘI BỘ (Đối chiếu bên ngoài)                   │
├──────────────────────────────────────────────────────────────────────────┤
│ • Tự động tra cứu tên sự kiện trên cổng tin DUT / Fanpage.               │
│ → Tìm thấy bài viết xác thực: CỘNG THÊM ĐIỂM TIN CẬY.                    │
│ → Trả liên kết bài viết về giao diện cho SV & Người duyệt.               │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 5: TÍNH ĐIỂM TIN CẬY & GỢI Ý PHÂN HẠNG                               │
├──────────────────────────────────────────────────────────────────────────┤
│ • Có mặt SV + Banner rõ + Có bài viết → Hạng B (Vàng mạnh).              │
│ • Ảnh chung chung, không rõ mặt → Hạng C (Vàng yếu).                     │
│ → Ảnh cá nhân LUÔN ĐƯỢC CHUYỂN VÀO HÀNG CHỜ DUYỆT (HITL).                │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ LỚP 6: QUY TRÌNH DUYỆT 2 CẤP (Lớp/Cố vấn → KHOA KIỂM DUYỆT)              │
├──────────────────────────────────────────────────────────────────────────┤
│ → BƯỚC 6.1: CỐ VẤN HỌC TẬP (GVCN) / BAN CÁN SỰ LỚP DUYỆT SƠ BỘ:          │
│    • Xem ảnh sự kiện có đóng khung khuôn mặt AI nhận diện.               │
│    • Đọc liên kết bài viết sự kiện AI tìm được.                          │
│    • Bấm: "Xác nhận sinh viên có tham gia" → đẩy lên cấp Khoa.           │
│                                                                          │
│ → BƯỚC 6.2: BAN THẨM ĐỊNH CẤP KHOA KIỂM DUYỆT CHỐT CUỐI:                 │
│    • Dashboard của Khoa hiển thị bảng tổng hợp:                          │
│      - Các ca Vàng mạnh (đã có lớp duyệt + AI thấy mặt): Khoa chỉ        │
│        cần bấm "Phê duyệt hàng loạt" (Batch Approval).                   │
│      - Các ca Vàng yếu hoặc có Khiếu nại: mở giao diện xem bằng          │
│        chứng để quyết định giữ điểm hay trừ điểm.                        │
│    • Khoa chốt bảng điểm chính thức toàn khóa/ngành gửi CTSV.            │
└──────────────────────────────────────────────────────────────────────────┘
```
