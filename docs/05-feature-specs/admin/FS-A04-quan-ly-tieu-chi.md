# FS-A04 — Quản lý Tiêu chí & Khung Điểm Rèn luyện

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A04`** | **`[ADM-CRI-01]` đến `[ADM-CRI-04]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Admin kiêm Quản lý quy định). Quyền: **ADMIN only**. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý cây danh mục tiêu chí đánh giá điểm rèn luyện (Khung I đến V theo Thông tư / Quy chế nhà trường): Tạo mới, sửa đổi, lưu phiên bản (*Versioning*), cấu hình mức điểm trần (Cap), và gán các loại minh chứng bắt buộc.

---

## 2. 👤 User Story
> **As an** quản trị viên hệ thống kiêm quản lý quy chế,
> **I want to** cập nhật các mức điểm và tiêu chí mới khi nhà trường ban hành quy chế sửa đổi,
> **so that** hệ thống tự động tính điểm theo đúng khung quy định mới nhất cho các kỳ tiếp theo.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng danh sách tiêu chí theo cây phân cấp (Khung I–V) và các tiểu mục con (`[ADM-CRI-01]`).
- **AC-2**: Form thêm/sửa tiêu chí (`[ADM-CRI-02]`): Tên tiêu chí, Mã tiêu chí, Mô tả, Khung cha, Điểm trần (Cap), Mức điểm theo từng vai trò (BTC/TTV/Thành viên/Cổ vũ).
- **AC-3**: Toàn vẹn dữ liệu: Không cho phép xóa tiêu chí đã có minh chứng liên kết trong CSDL $\rightarrow$ Chỉ được chuyển trạng thái sang `INACTIVE`.
- **AC-4**: Versioning (`[ADM-CRI-04]`): Thay đổi tiêu chí tự động tạo phiên bản mới, không làm sai lệch điểm của các kỳ học cũ đã kết thúc.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-CRI-01]` `GET /api/v1/admin/criteria?term_id={id}`
- `[ADM-CRI-02]` `POST /api/v1/admin/criteria` (Tạo mới)
- `[ADM-CRI-03]` `PUT /api/v1/admin/criteria/{id}` (Cập nhật)
- `[ADM-CRI-04]` `GET /api/v1/admin/criteria/{id}/versions` (Xem lịch sử phiên bản tiêu chí)
