# FS-A02 — Quản lý Người dùng & Phân quyền (RBAC)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A02`** | **`[ADM-USR-01]` đến `[ADM-USR-06]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Quản trị viên Hệ thống). Ưu tiên: **[MVP]**
> Áp dụng mô hình **3 vai trò**: `STUDENT`, `OFFICER`, `ADMIN`.

---

## 1. 🎯 Objective
Cung cấp công cụ quản trị tài khoản toàn diện cho Quản trị viên: Tạo mới, nhập danh sách hàng loạt (Import CSV), phân quyền vai trò (Role-Based Access Control), thiết lập phạm vi phụ trách của Cán bộ (theo Khoa/Lớp), khóa/mở khóa tài khoản và khôi phục mật khẩu.

---

## 2. 👤 User Story
> **As an** quản trị viên,
> **I want to** phân quyền đúng cho các cán bộ và phân chia các lớp sinh hoạt cho từng cán bộ phụ trách,
> **so that** mỗi cán bộ chỉ thấy và duyệt đúng hồ sơ của sinh viên thuộc thẩm quyền của mình (*Row-level security*).

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng CRUD người dùng (`[ADM-USR-01]`): Tên, Email, MSSV/Mã CB, Vai trò (`STUDENT` / `OFFICER` / `ADMIN`), Khoa/Lớp, Trạng thái (Hoạt động / Bị khóa).
- **AC-2**: Phân công phạm vi cán bộ (`[ADM-USR-04]`): Gán cán bộ phụ trách cụ thể 1 hoặc nhiều Khoa / Lớp.
- **AC-3**: Import người dùng hàng loạt (`[ADM-USR-02]`): Nhập file Excel/CSV danh sách sinh viên đầu khóa.
- **AC-4**: Khóa / Mở khóa tài khoản (`[ADM-USR-05]`): Ngăn chặn đăng nhập đối với tài khoản vi phạm hoặc đã thôi học.
- **AC-5**: Reset mật khẩu (`[ADM-USR-06]`): Tạo mật khẩu ngẫu nhiên tạm thời gửi về email người dùng.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-USR-01]` `GET /api/v1/admin/users?role={r}&faculty_id={f}&search={q}&page=1&limit=20`
- `[ADM-USR-02]` `POST /api/v1/admin/users/import` (Import CSV/Excel)
- `[ADM-USR-03]` `POST /api/v1/admin/users` (Tạo tài khoản đơn lẻ)
- `[ADM-USR-04]` `PUT /api/v1/admin/users/{id}/scope` (Phân quyền & gán phạm vi Khoa/Lớp)
- `[ADM-USR-05]` `PATCH /api/v1/admin/users/{id}/status` (Khóa/Mở khóa: `ACTIVE` / `LOCKED`)
- `[ADM-USR-06]` `POST /api/v1/admin/users/{id}/reset-password`
