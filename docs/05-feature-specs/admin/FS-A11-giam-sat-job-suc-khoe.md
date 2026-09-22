# FS-A11 — Giám sát Hàng đợi Xử lý & Sức khỏe Hệ thống (Job Health Monitor)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A11`** | **`[ADM-JOB-01]` đến `[ADM-JOB-04]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Quản trị viên Hệ thống). Phân loại: **[ADV]**

---

## 1. 🎯 Objective
Giám sát trạng thái hoạt động của hàng đợi tác vụ bất đồng bộ (BullMQ / Redis Task Queue), các worker xử lý nền của pipeline OCR và AI, tỷ lệ lỗi tác vụ (Failed jobs), độ trễ hàng đợi, và hỗ trợ nút kích hoạt **Thử lại các job lỗi (Retry failed jobs)**.

---

## 2. 👤 User Story
> **As an** quản trị viên / kỹ sư vận hành hệ thống,
> **I want to** theo dõi số lượng job trong hàng đợi BullMQ và phát hiện kịp thời các job bị treo hoặc thất bại,
> **so that** tôi xử lý nghẽn hàng đợi trong các ngày cao điểm sinh viên nộp bài cuối kỳ.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Dashboard giám sát hàng đợi (`[ADM-JOB-01]`):
  - Số lượng job: `Waiting` (Đang chờ), `Active` (Đang chạy), `Completed` (Hoàn thành), `Failed` (Lỗi).
  - Tốc độ xử lý: Số jobs/phút.
  - Thời gian xử lý trung bình mỗi minh chứng.
- **AC-2**: Danh sách Failed Jobs (`[ADM-JOB-02]`): Xem stack trace chi tiết lý do job thất bại (VD: Timeout gọi Claude API, Lỗi đọc file ảnh hỏng...).
- **AC-3**: Retry Failed Jobs (`[ADM-JOB-03]`): Chọn 1 hoặc toàn bộ job lỗi để đưa lại vào hàng đợi chạy lại tự động.
- **AC-4**: Dọn dẹp hàng đợi (`[ADM-JOB-04]`): Xóa lịch sử các job completed cũ để giải phóng bộ nhớ Redis.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-JOB-01]` `GET /api/v1/admin/jobs/stats` (Thống kê trạng thái hàng đợi)
- `[ADM-JOB-02]` `GET /api/v1/admin/jobs/failed?queue=evidence-processing&page=1&limit=20`
- `[ADM-JOB-03]` `POST /api/v1/admin/jobs/retry`
```json
{ "job_ids": ["job_ocr_8812a", "job_ocr_8812b"] }
```
- `[ADM-JOB-04]` `POST /api/v1/admin/jobs/clean?status=COMPLETED&grace_period_days=7`
