# FS-C02 — Quên & Đặt lại Mật khẩu

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C02`** | **`[AUTH-05]` `[AUTH-06]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi**: Dùng chung cho người dùng khi mất mật khẩu. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cho phép người dùng tự khôi phục quyền truy cập tài khoản thông qua liên kết xác thực OTP/Reset Token gửi về email trường đã đăng ký, đảm bảo không thể giả mạo tài khoản của người khác.

---

## 2. 👤 User Story
> **As a** người dùng hệ thống,
> **I want to** nhận liên kết đặt lại mật khẩu qua email sinh viên/cán bộ,
> **so that** tôi có thể tự khôi phục mật khẩu mà không cần nhờ hỗ trợ thủ công.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Gửi yêu cầu | Functional | Nhập email hợp lệ $\rightarrow$ hệ thống sinh mã reset token (hạn 15 phút), gửi email kèm URL kích hoạt. |
| AC-2 | Chống thu thập email | Security | Dù email có tồn tại hay không, response luôn trả về cùng thông điệp thành công (ngăn kẻ gian dò tìm danh sách email trường). |
| AC-3 | Đặt mật khẩu mới | Functional | Token hợp lệ $\rightarrow$ cho phép nhập mật khẩu mới (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số). |
| AC-4 | Vô hiệu hóa token cũ | Security | Ngay sau khi đổi mật khẩu thành công, token hết hiệu lực và mọi phiên đăng nhập cũ bị hủy. |

---

## 4. 🖥️ UI/UX Specification (`C02`)

- Màn hình 1: Nhập email trường $\rightarrow$ Nhấn **[Gửi mã xác nhận]**.
- Màn hình 2: Thông báo *"Kiểm tra hòm thư của bạn"* kèm bộ đếm lùi 60 giây trước khi cho gửi lại.
- Màn hình 3: Form nhập mật khẩu mới và xác nhận mật khẩu $\rightarrow$ Nhấn **[Lưu mật khẩu]** $\rightarrow$ Chuyển về `C01`.

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 5.1 `[AUTH-05]` Yêu cầu đặt lại mật khẩu
- **POST** `/api/v1/auth/forgot-password`
```json
{ "email": "sv@dut.udn.vn" }
```
**Response (200 OK):**
```json
{
  "data": { "message": "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi." },
  "request_id": "req_auth_05"
}
```

### 5.2 `[AUTH-06]` Đặt mật khẩu mới
- **POST** `/api/v1/auth/reset-password`
```json
{
  "token": "rst_tok_991823ab",
  "new_password": "NewPassword@123"
}
```

---

## 6. ⚠️ Error Handling
- `AUTH_TOKEN_EXPIRED`: Token đổi mật khẩu quá hạn 15 phút $\rightarrow$ "Liên kết đã hết hạn. Vui lòng yêu cầu lại."
- `VALIDATION_ERROR`: Mật khẩu không đủ độ phức tạp $\rightarrow$ Báo lỗi chi tiết dưới ô nhập.
