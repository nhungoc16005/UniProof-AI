# FS-C01 — Xác thực & Đăng nhập Hệ thống

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C01`** | **`[AUTH-01]` `[AUTH-02]` `[AUTH-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi áp dụng**: Dùng chung cho cả 3 vai trò: **STUDENT** (Mobile App), **OFFICER** (Web), **ADMIN** (Web).
> Phân loại ưu tiên: **[MVP]**

---

## 1. 🎯 Objective

Cung cấp cơ chế xác thực an toàn, tập trung cho người dùng (Sinh viên, Cán bộ, Quản trị viên). Hệ thống nhận diện đúng danh tính, phân quyền hạn phù hợp với từng vai trò (*Row-level scope*) và duy trì phiên đăng nhập bảo mật bằng cơ chế JWT Access/Refresh Token xoay vòng.

---

## 2. 👤 User Stories

- **As a** Sinh viên / Cán bộ / Quản trị viên,
  **I want to** đăng nhập bằng tài khoản trường (Email/MSSV và mật khẩu),
  **so that** tôi truy cập đúng không gian làm việc và dữ liệu thuộc thẩm quyền của mình.
- **As a** người dùng hệ thống,
  **I want to** được tự động làm mới phiên làm việc khi access token hết hạn mà không bị văng ra bất ngờ,
  **so that** công việc không bị gián đoạn.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết kiểm thử |
|---|---|---|---|
| AC-1 | **Đăng nhập hợp lệ** | Functional | Nhập đúng email/mật khẩu $\rightarrow$ trả về Access Token (15 phút), Refresh Token (HttpOnly Cookie, 7 ngày), thông tin `user` (id, role, name, email, scope). |
| AC-2 | **Điều hướng đúng vai trò** | Routing | Sinh viên $\rightarrow$ màn hình Trang chủ Sinh viên (`S01`). Cán bộ $\rightarrow$ Tổng quan xử lý (`O01`). Admin $\rightarrow$ Tổng quan hệ thống (`A01`). |
| AC-3 | **Bảo vệ tài khoản** | Security | Sai mật khẩu quá 5 lần liên tiếp $\rightarrow$ tạm khóa đăng nhập 15 phút kèm thông báo cảnh báo. |
| AC-4 | **Tự động làm mới phiên** | Auth | Khi Access Token hết hạn, client tự động gọi refresh token trong suốt; nếu refresh token hết hạn $\rightarrow$ chuyển hướng về trang Login (`C01`). |
| AC-5 | **Đăng xuất an toàn** | Auth | Xóa Access Token trong bộ nhớ, vô hiệu hóa Refresh Token trên server và xóa Cookie. |

---

## 4. 🖥️ UI/UX Specification (`C01`)

```
┌─────────────────────────────────────────────────────────────┐
│                       🎓 EduPoint                           │
│     Hệ thống Tự động hóa Đánh giá Điểm Rèn luyện           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    ĐĂNG NHẬP                          │  │
│  │                                                       │  │
│  │  Email / Tên đăng nhập:                               │  │
│  │  [ sv@dut.udn.vn / cb@dut.udn.vn                    ] │  │
│  │                                                       │  │
│  │  Mật khẩu:                                            │  │
│  │  [ ••••••••••••••••                               👁 ] │  │
│  │                                                       │  │
│  │  [✓] Ghi nhớ đăng nhập             [Quên mật khẩu? (C02)]│
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │             [   ĐĂNG NHẬP   ]                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ── hoặc ──                                           │  │
│  │  [ 🔵 Đăng nhập bằng Google Workspace trường ]        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│       Hỗ trợ kỹ thuật: hotro@dut.udn.vn · Hotline: 0236.xxx │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 5.1 `[AUTH-01]` Đăng nhập tài khoản
- **Method & Path**: `POST /api/v1/auth/login`
- **Auth required**: No (Public)
- **Rate limit**: 10 requests / phút / IP

**Request Body:**
```json
{
  "email": "sv@dut.udn.vn",
  "password": "Password@123",
  "remember_me": true
}
```

**Response (200 OK):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "user": {
      "id": "u_8f2c1a9e",
      "email": "sv@dut.udn.vn",
      "full_name": "Nguyễn Văn A",
      "role": "STUDENT",
      "faculty_id": "fac_cntt",
      "class_id": "cls_21cntt1"
    }
  },
  "meta": {},
  "request_id": "req_auth_01"
}
```
*(Lưu ý: Refresh Token được server set vào HttpOnly Cookie `refreshToken`)*.

### 5.2 `[AUTH-02]` Làm mới Access Token
- **Method & Path**: `POST /api/v1/auth/refresh`
- **Auth required**: Cookie chứa `refreshToken`

### 5.3 `[AUTH-03]` Đăng xuất
- **Method & Path**: `POST /api/v1/auth/logout`
- **Auth required**: Bearer `<access_token>`

---

## 6. ⚠️ Error Handling

| Mã Lỗi API | HTTP Status | Nguyên nhân | Phản hồi giao diện (`C01`) |
|---|:---:|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu | Viền đỏ ô nhập + "Email hoặc mật khẩu không chính xác." |
| `ACCOUNT_LOCKED` | 423 | Tài khoản bị Admin khóa hoặc nhập sai nhiều lần | Modal cảnh báo + "Tài khoản tạm khóa. Vui lòng liên hệ CTSV." |
| `RATE_LIMITED` | 429 | Thử đăng nhập dồn dập | "Quá nhiều lần thử. Vui lòng thử lại sau 60 giây." |
