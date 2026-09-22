# FS-C05 — Trung tâm Thông báo Hệ thống

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C05`** | **`[NOTI-01]` `[NOTI-02]` `[NOTI-03]` `[NOTI-04]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi**: Trung tâm nhận và quản lý thông báo cho mọi vai trò. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp kênh truyền thông báo tin cậy và theo thời gian thực (Real-time in-app badge & Push notification) để thông tin tức thời các sự kiện quan trọng trong vòng đời hồ sơ minh chứng và kỳ đánh giá.

---

## 2. 👤 User Story
> **As a** Sinh viên / Cán bộ,
> **I want to** nhận thông báo ngay khi trạng thái minh chứng thay đổi hoặc có hạn chót sắp đến,
> **so that** tôi không bỏ lỡ thời hạn nộp/bổ sung hoặc kịp thời xử lý hồ sơ.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Hiển thị số thông báo chưa đọc trên thanh điều hướng (`[NOTI-04]`).
- **AC-2**: Danh sách thông báo phân loại theo nhóm:
  - 🔔 *Hồ sơ*: Đã duyệt, Bị từ chối, Yêu cầu bổ sung, Có kết quả khiếu nại.
  - 📅 *Kỳ đánh giá*: Mở đợt nộp minh chứng, Nhắc nhở hạn chót (SLA).
  - ⚙️ *Hệ thống*: Cảnh báo bảo trì, Cập nhật quy chế mới.
- **AC-3**: Bấm vào thông báo $\rightarrow$ Đánh dấu đã đọc (`[NOTI-02]`) và chuyển hướng (*Deep link*) đến đúng chi tiết hồ sơ (`S05` hoặc `O03`).
- **AC-4**: Hỗ trợ nút "Đánh dấu tất cả đã đọc" (`[NOTI-03]`).

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[NOTI-01]` `GET /api/v1/notifications?page=1&limit=20&unread_only=false`
- `[NOTI-02]` `POST /api/v1/notifications/{id}/read`
- `[NOTI-03]` `POST /api/v1/notifications/read-all`
- `[NOTI-04]` `GET /api/v1/notifications/unread-count`

**Payload mẫu item thông báo:**
```json
{
  "id": "noti_9918a",
  "type": "EVIDENCE_REVIEWED",
  "title": "Minh chứng của bạn đã được duyệt",
  "body": "Hoạt động 'Hiến máu nhân đạo đợt 1' đã được Cán bộ phê duyệt +5.0 điểm.",
  "target_url": "/evidence/ev_8812c",
  "is_read": false,
  "created_at": "2026-09-21T10:30:00Z"
}
```
