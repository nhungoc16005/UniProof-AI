# FS-C03 — Hồ sơ Cá nhân & Đổi Mật khẩu

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C03`** | **`[AUTH-04]` `[AUTH-07]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi**: Xem thông tin định danh và đổi mật khẩu cho người dùng đang đăng nhập. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Hiển thị thông tin định danh của người dùng (Họ tên, MSSV/Mã CB, Khoa, Lớp, Vai trò hệ thống) và cung cấp tính năng đổi mật khẩu chủ động.

---

## 2. 👤 User Story
> **As a** người dùng đã đăng nhập,
> **I want to** xem hồ sơ cá nhân và đổi mật khẩu định kỳ,
> **so that** tôi kiểm tra tính chính xác của thông tin và bảo vệ tài khoản của mình.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Gọi `[AUTH-04]` tải đầy đủ thông tin cá nhân theo quyền hạn token.
- **AC-2**: Đổi mật khẩu qua `[AUTH-07]` bắt buộc xác thực mật khẩu hiện tại trước khi cập nhật mật khẩu mới.
- **AC-3**: Thông tin định danh cốt lõi (MSSV, Họ tên, Lớp, Khoa) là **chỉ đọc (Read-only)** để bảo toàn tính toàn vẹn dữ liệu trường. Nếu có sai sót phải liên hệ CTSV/Admin.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[AUTH-04]` Lấy thông tin người dùng hiện tại
- **GET** `/api/v1/auth/me`
- **Auth**: Bearer `<access_token>`

**Response (200 OK):**
```json
{
  "data": {
    "id": "u_8f2c1a9e",
    "email": "sv@dut.udn.vn",
    "full_name": "Nguyễn Văn A",
    "student_id": "102210xxx",
    "role": "STUDENT",
    "faculty": { "id": "fac_cntt", "name": "Khoa Công nghệ Thông tin" },
    "class": { "id": "cls_21cntt1", "name": "21TCLC_DT1" },
    "avatar_url": "https://storage.../avatars/u_8f2c1a9e.jpg"
  },
  "request_id": "req_auth_04"
}
```

### 4.2 `[AUTH-07]` Đổi mật khẩu chủ động
- **POST** `/api/v1/auth/change-password`
```json
{
  "current_password": "OldPassword@123",
  "new_password": "NewPassword@456"
}
```
