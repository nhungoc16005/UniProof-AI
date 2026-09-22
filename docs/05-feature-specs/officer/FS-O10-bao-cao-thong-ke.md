# FS-O10 — Báo cáo & Thống kê Điểm Rèn luyện

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O10`** | **`[RPT-02]` `[RPT-03]` `[RPT-04]` `[RPT-05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER & ADMIN (Web). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp công cụ thống kê trực quan và xuất báo cáo kết quả đánh giá điểm rèn luyện phục vụ các đợt tổng kết học kỳ của Khoa và Nhà trường: Báo cáo tỷ lệ xếp loại theo Khoa/Khóa/Lớp, thống kê sinh viên Xuất sắc/Yếu kém, và xuất file bảng điểm Excel/PDF chuẩn mẫu Phòng Đào tạo & CTSV.

---

## 2. 👤 User Story
> **As a** cán bộ quản lý điểm rèn luyện Khoa / Trường,
> **I want to** xem biểu đồ phân bố xếp loại và xuất file Excel danh sách điểm tổng hợp của toàn bộ sinh viên,
> **so that** tôi nộp báo cáo cho Ban Giám hiệu và chuyển dữ liệu sang bộ phận xét học bổng khuyến khích.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Biểu đồ phân bố xếp loại | Analytics | Biểu đồ tròn (Pie chart) & cột (Bar chart): Tỷ lệ Xuất sắc (>=90), Tốt (>=80), Khá (>=65), Trung bình (>=50), Yếu (<50). |
| AC-2 | Thống kê theo cấp độ | Breakdown | Phân rã theo cấp Khoa (`[RPT-02]`), cấp Lớp sinh hoạt (`[RPT-03]`), hoặc theo từng Khóa học. |
| AC-3 | Xuất báo cáo Excel/PDF nền | Export Job | Khởi tạo job xuất file qua `[RPT-04]`. File dung lượng lớn chạy nền, khi xong thông báo link tải qua `[RPT-05]`. |
| AC-4 | Định dạng file chuẩn mẫu | Format | File Excel gồm: STT, MSSV, Họ tên, Lớp, Điểm Khung I, II, III, IV, V, Tổng điểm, Xếp loại, Ghi chú. |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[RPT-02]` `GET /api/v1/reports/scores/faculty?term_id={id}&faculty_id={facId}`
- `[RPT-03]` `GET /api/v1/reports/scores/class?term_id={id}&class_id={clsId}`
- `[RPT-04]` `POST /api/v1/reports/export`
```json
{
  "term_id": "term_2026_1",
  "faculty_id": "fac_cntt",
  "class_id": "cls_21cntt1",
  "format": "EXCEL",
  "template": "CTSV_OFFICIAL_V1"
}
```
**Response (202 Accepted):** `{ "data": { "job_id": "job_exp_8812c", "status": "PENDING" } }`

- `[RPT-05]` `GET /api/v1/reports/export/{job_id}` (Kiểm tra tiến trình và lấy URL download khi xong).
