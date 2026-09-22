# FS-O08 — Tra cứu Tiêu chí & Quy tắc Điểm (Read-only cho Officer)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O08`** | **`[CRI-01]` `[CRI-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Phân quyền: **Chỉ xem (Read-only)** — Quyền chỉnh sửa thuộc về Admin (`A04`, `A05`). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp cho Cán bộ bảng tra cứu toàn bộ danh mục tiêu chí đánh giá (Khung I đến V), mức điểm trần (Cap), các quy tắc logic khống chế (VD: quy tắc tỷ lệ cổ vũ mục 9/10, quy tắc không tính điểm trùng) đang có hiệu lực trong kỳ để phục vụ công tác đối chiếu khi xét duyệt.

---

## 2. 👤 User Story
> **As a** cán bộ duyệt điểm,
> **I want to** tra cứu nhanh quy tắc tính điểm và mức trần của một tiêu chí,
> **so that** tôi giải thích căn cứ rõ ràng cho sinh viên và không chấm vượt mức trần quy định.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Hiển thị bảng danh mục tiêu chí theo cây phân cấp (Khung I đến V).
- **AC-2**: Bấm vào một tiêu chí $\rightarrow$ Hiển thị chi tiết các rule đang áp dụng (`[CRI-03]`): Mức trần điểm, điều kiện tiên quyết, giới hạn số lần nộp/kỳ.
- **AC-3**: Giao diện chỉ cho phép xem và tra cứu, không có nút thêm/sửa/xóa tiêu chí (chỉ Quản trị viên mới có quyền tại trang `A04` / `A05`).

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[CRI-01]` `GET /api/v1/criteria?term_id={id}` (Danh sách tiêu chí)
- `[CRI-03]` `GET /api/v1/criteria/{id}/rules` (Danh sách quy tắc gắn với tiêu chí)
