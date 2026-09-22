# FS-A08 — Quản lý Ground Truth Dataset (Tập Dữ liệu Kiểm chuẩn)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A08`** | **`[ADM-GT-01]` đến `[ADM-GT-05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Phục vụ nghiên cứu mô hình & viết báo cáo đồ án). Phân loại: **[ADV]**

---

## 1. 🎯 Objective
Quản lý tập dữ liệu gán nhãn chuẩn vàng (*Ground Truth Dataset*) được các Cán bộ / Chuyên gia kiểm định thủ công: Lưu trữ các mẫu minh chứng hoạt động sinh viên kèm nhãn tiêu chí đúng, điểm đúng và các trường OCR chuẩn. Tập dữ liệu này là thước đo chuẩn để đánh giá hiệu năng mô hình PhoBERT, kiểm định thuật toán OCR và đối chứng trong báo cáo đồ án.

---

## 2. 👤 User Story
> **As an** kỹ sư AI kiêm quản trị viên,
> **I want to** quản lý và xuất tập dữ liệu Ground Truth đã được chuẩn hóa nhãn,
> **so that** tôi sử dụng làm tập kiểm thử độc lập (Test set) phục vụ huấn luyện và đo lường độ chính xác cho bài báo cáo tốt nghiệp.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng dữ liệu Ground Truth (`[ADM-GT-01]`): ID, Ảnh minh chứng, Text hoạt động, Tiêu chí chuẩn, Mức điểm chuẩn, Cán bộ thẩm định nhãn.
- **AC-2**: Thêm mẫu mới vào Ground Truth (`[ADM-GT-02]`): Cho phép trích xuất từ các hồ sơ thực tế đã được Cán bộ duyệt trong kỳ sang làm mẫu Ground Truth.
- **AC-3**: Phân chia tập dữ liệu (`[ADM-GT-04]`): Hỗ trợ chia tỷ lệ Train (70%) / Validation (15%) / Test (15%) tự động.
- **AC-4**: Export Dataset (`[ADM-GT-05]`): Xuất file CSV/JSON định dạng chuẩn dùng trực tiếp cho các script huấn luyện trong thư mục `research/`.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-GT-01]` `GET /api/v1/admin/ground-truth?category={cat}&page=1&limit=50`
- `[ADM-GT-02]` `POST /api/v1/admin/ground-truth` (Thêm mẫu dữ liệu kiểm chuẩn)
- `[ADM-GT-03]` `PUT /api/v1/admin/ground-truth/{id}` (Chỉnh sửa nhãn)
- `[ADM-GT-04]` `POST /api/v1/admin/ground-truth/split` (Phân chia Train/Val/Test)
- `[ADM-GT-05]` `GET /api/v1/admin/ground-truth/export?format=csv` (Tải tập dữ liệu)
