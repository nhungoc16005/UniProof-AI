# FS-A01 — Tổng quan Hệ thống (Admin System Dashboard)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A01`** | **`[ADM-DSH-01]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Quản trị viên Hệ thống). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp bảng điều khiển trung tâm cho Quản trị viên: Giám sát toàn bộ hoạt động của hệ thống, số lượng tài khoản, tình trạng các học kỳ đánh giá, tỷ lệ tài nguyên sử dụng, tổng quan lưu lượng pipeline AI, và các sự kiện bảo mật cần lưu ý.

---

## 2. 👤 User Story
> **As an** quản trị viên hệ thống,
> **I want to** xem tổng quan tình trạng hoạt động và các chỉ số sức khỏe của EduPoint,
> **so that** tôi phát hiện sớm các bất thường về hệ thống hoặc tải xử lý để có biện pháp can thiệp.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Chỉ số tổng quan: Tổng số sinh viên, cán bộ, số lượng hồ sơ nộp trong kỳ, tỷ lệ hồ sơ đã duyệt.
- **AC-2**: Trạng thái các dịch vụ (*System Health*): Database (PostgreSQL), Storage (Supabase), Cache & Queue (Redis/BullMQ), AI Microservice (FastAPI PhoBERT).
- **AC-3**: Lối tắt cấu hình nhanh: Mở/khóa kỳ đánh giá, điều chỉnh ngưỡng AI, xem nhật ký cảnh báo lỗi.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[ADM-DSH-01]` Lấy số liệu Dashboard Admin
- **GET** `/api/v1/admin/dashboard`
- **Auth**: Bearer `<access_token>` (Role: `ADMIN`)

**Response (200 OK):**
```json
{
  "data": {
    "total_users": 5420,
    "active_term": { "id": "term_2026_1", "name": "Học kỳ 1 (2026-2027)", "status": "ACTIVE" },
    "total_evidences_submitted": 12850,
    "evidence_status_summary": {
      "APPROVED": 9820,
      "REJECTED": 450,
      "NEEDS_HUMAN_REVIEW": 1800,
      "PROCESSING": 780
    },
    "system_health": {
      "database": "HEALTHY",
      "redis_queue": "HEALTHY",
      "ai_service": "HEALTHY"
    }
  },
  "request_id": "req_adm_dsh_01"
}
```
