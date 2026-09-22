# FS-A03 — Dữ liệu Nền & Quản lý Kỳ Đánh giá

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A03`** | **`[ADM-ORG-01..03]` `[ADM-TRM-01..05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Quản trị viên Hệ thống). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý cơ cấu tổ chức dữ liệu nền của trường (Danh mục Khoa, Lớp, Ngành, Đơn vị nội bộ) và điều hành vòng đời các **Kỳ đánh giá điểm rèn luyện (Terms)**: Thiết lập thời gian mở nộp minh chứng, hạn chót xử lý của Cán bộ, thời hạn mở khiếu nại, và thao tác chốt sổ kỳ (`TERM_CLOSED`) / mở lại kỳ khi có quyết định đặc biệt.

---

## 2. 👤 User Story
> **As an** quản trị viên,
> **I want to** mở kỳ đánh giá mới và thiết lập các mốc thời gian SLA nộp/duyệt/khiếu nại,
> **so that** hệ thống tự động kiểm soát quyền nộp minh chứng của sinh viên đúng theo kế hoạch đào tạo của trường.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: CRUD Khoa & Lớp sinh hoạt (`[ADM-ORG-01..03]`).
- **AC-2**: Tạo kỳ đánh giá (`[ADM-TRM-01]`): Tên kỳ (VD: Học kỳ 1 năm học 2026-2027), Ngày bắt đầu - kết thúc nhận minh chứng, Ngày hết hạn duyệt của Cán bộ, Hạn chót nộp khiếu nại.
- **AC-3**: Vòng đời Kỳ (`[ADM-TRM-03]`): `UPCOMING` (Sắp mở) $\rightarrow$ `ACTIVE` (Đang mở nhận hồ sơ) $\rightarrow$ `REVIEWING` (Đóng nộp, đang duyệt) $\rightarrow$ `CLOSED` (Chốt sổ điểm chính thức).
- **AC-4**: Mở lại kỳ (`[ADM-TRM-04]`): Chỉ dành cho Admin, ghi rõ lý do và bắt buộc lưu audit log.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-ORG-01]` `GET /api/v1/admin/faculties` / `POST /api/v1/admin/faculties`
- `[ADM-ORG-02]` `GET /api/v1/admin/classes` / `POST /api/v1/admin/classes`
- `[ADM-TRM-01]` `GET /api/v1/admin/terms`
- `[ADM-TRM-02]` `POST /api/v1/admin/terms` (Tạo kỳ đánh giá mới)
- `[ADM-TRM-03]` `PATCH /api/v1/admin/terms/{id}/state` (Chuyển trạng thái: `ACTIVE`, `REVIEWING`, `CLOSED`)
- `[ADM-TRM-04]` `POST /api/v1/admin/terms/{id}/reopen` (Mở lại kỳ kèm lý do)
