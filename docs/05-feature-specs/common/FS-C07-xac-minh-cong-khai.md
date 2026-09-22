# FS-C07 — Cổng Xác nhận Công khai Dành cho Đơn vị Tổ chức Bên ngoài

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C07`** | **`[PUB-01]` `[PUB-02]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi**: Dành cho đại diện các tổ chức/doanh nghiệp bên ngoài trường xác nhận sự tham gia của sinh viên thông qua liên kết bảo mật có token dùng 1 lần (*One-time token*). Không yêu cầu tài khoản EduPoint. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Giải quyết bài toán xác minh minh chứng ngoài trường ở cấp độ **Level 2 (Xác nhận của Đơn vị tổ chức)** mà không bắt buộc bên ngoài phải tạo tài khoản hệ thống. Khi sinh viên cung cấp email người phụ trách bên ngoài, hệ thống gửi liên kết xác thực nhanh.

---

## 2. 👤 User Story
> **As an** người phụ trách tại tổ chức bên ngoài (doanh nghiệp/tổ chức tình nguyện xã hội),
> **I want to** mở đường link nhận được qua email để xác nhận nhanh sinh viên có tham gia hoạt động hay không,
> **so that** minh chứng của sinh viên được nhà trường công nhận mà tôi không cần cài đặt phần mềm hay đăng ký tài khoản.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Truy cập qua đường dẫn dạng: `https://edupoint.dut.udn.vn/verify?token=<one_time_token>`.
- **AC-2**: Token có hạn sử dụng (mặc định 7 ngày) và chỉ sử dụng được 1 lần (`[PUB-01]`).
- **AC-3**: Màn hình hiển thị tối giản: Tên hoạt động, Thời gian, Tên sinh viên, MSSV và câu hỏi:
  - *"Bạn xác nhận sinh viên này đã tham gia hoạt động trên với vai trò được nêu?"*
  - Nút bấm: **[Xác nhận đúng]** hoặc **[Không xác nhận / Có sai lệch]** kèm ô ghi chú phản hồi (`[PUB-02]`).
- **AC-4**: Kết quả tự động ghi nhận vào hệ thống và nâng cấp độ xác minh của minh chứng lên **L2 (Xác nhận đơn vị tổ chức)**.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[PUB-01]` Đọc yêu cầu xác minh công khai
- **GET** `/api/v1/public/verify-request/{token}`
- **Auth**: None (Token-based)

**Response (200 OK):**
```json
{
  "data": {
    "activity_name": "Chiến dịch Mùa hè xanh 2026 tại Huyện Hòa Vang",
    "student_name": "Nguyễn Văn A",
    "student_id": "102210xxx",
    "claimed_role": "Tình nguyện viên",
    "activity_date": "15/07/2026 - 30/07/2026",
    "organization_name": "UBND Xã Hòa Phong",
    "expires_at": "2026-09-28T23:59:59Z"
  }
}
```

### 4.2 `[PUB-02]` Phản hồi xác nhận
- **POST** `/api/v1/public/verify-request/{token}`
```json
{
  "is_confirmed": true,
  "comment": "Sinh viên tham gia đầy đủ và nhiệt tình.",
  "responder_name": "Trần Văn B (Phó Bí thư Đoàn Xã)"
}
```
