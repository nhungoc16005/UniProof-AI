# FS-O01 — Tổng quan Xử lý của Cán bộ (Officer Dashboard)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O01`** | **`[RPT-01]` `[OFF-02]` `[OFF-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Giao diện: Desktop-first. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp cái nhìn tổng quan về khối lượng công việc của Cán bộ trong học kỳ: Số lượng hồ sơ chờ duyệt, hồ sơ sắp chạm trần SLA (48 giờ), số lượng khiếu nại đang mở, tỷ lệ AI hỗ trợ duyệt thành công, và tiến độ chấm điểm rèn luyện của các lớp thuộc phạm vi phụ trách.

---

## 2. 👤 User Story
> **As a** cán bộ phụ trách điểm rèn luyện,
> **I want to** xem thống kê số hồ sơ đang tồn và các hồ sơ khẩn cấp sắp trễ hạn SLA,
> **so that** tôi lập kế hoạch xử lý công việc hiệu quả và không để sinh viên phải chờ đợi quá lâu.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Widget số liệu tức thời: (1) Cần duyệt hôm nay, (2) Cảnh báo sắp quá hạn SLA (< 12h), (3) Đang khiếu nại cần giải quyết, (4) Tỷ lệ tự động xác minh của AI.
- **AC-2**: Phân bố hồ sơ theo trạng thái 4 trục: `PROCESSING`, `NEEDS_HUMAN_REVIEW`, `NEEDS_SUPPLEMENT`, `APPEALING`, `APPROVED`, `REJECTED`.
- **AC-3**: Nút điều hướng nhanh: **[Vào Hàng đợi Xử lý (O02)]** hoặc **[Xem Khiếu nại (O07)]**.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[RPT-01]` Tổng quan thống kê cho Officer
- **GET** `/api/v1/reports/officer/overview?term_id={termId}`
- **Auth**: Bearer `<access_token>` (Role: `OFFICER` | `ADMIN`)

**Response (200 OK):**
```json
{
  "data": {
    "total_pending": 48,
    "sla_urgent_count": 5,
    "appealing_count": 3,
    "reviewed_today": 24,
    "ai_acceptance_rate": 0.82,
    "by_class": [
      { "class_id": "cls_21cntt1", "class_name": "21TCLC_DT1", "pending": 12, "completed": 35 },
      { "class_id": "cls_21cntt2", "class_name": "21TCLC_DT2", "pending": 18, "completed": 29 }
    ]
  },
  "request_id": "req_rpt_01"
}
```
