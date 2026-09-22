# FS-A10 — Nhật ký Kiểm toán Toàn hệ thống (System Audit Log)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A10`** | **`[ADM-AUD-01]` `[ADM-AUD-02]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR. Quyền: **ADMIN only**. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Ghi nhận bất biến (Append-only) và hiển thị toàn bộ lịch sử hành vi trong hệ thống nhằm phục vụ kiểm toán bảo mật, truy vết trách nhiệm và giải quyết tranh chấp: Ai đã làm gì, vào thời điểm nào, từ địa chỉ IP nào, trên đối tượng nào và thay đổi giá trị từ cũ sang mới ra sao.

---

## 2. 👤 User Story
> **As an** quản trị viên hệ thống,
> **I want to** xem nhật ký chi tiết của mọi hành động duyệt điểm, sửa OCR, cấu hình rule hoặc đổi phân quyền,
> **so that** tôi đảm bảo tính minh bạch, ngăn chặn gian lận nội bộ và truy vết khi có sự cố.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng nhật ký (`[ADM-AUD-01]`): Thời gian (UTC $\rightarrow$ Giờ VN), Tên người thực hiện, Vai trò, Loại hành động (`APPROVE`, `REJECT`, `OVERRIDE_SCORE`, `EDIT_RULE`, `LOGIN`, `CHANGE_ROLE`), Đối tượng tác động (ID minh chứng / ID User), Giá trị cũ/mới (`diff`), Địa chỉ IP & User Agent.
- **AC-2**: Bộ lọc đa điều kiện: Theo người thực hiện, theo mã minh chứng, theo loại hành động, theo khoảng thời gian.
- **AC-3**: Tính toàn vẹn: Dữ liệu audit log là **chỉ đọc (Read-only)**, không có API sửa hay xóa log trong CSDL.
- **AC-4**: Xuất file CSV (`[ADM-AUD-02]`): Cho phép trích xuất báo cáo kiểm toán ra file Excel/CSV phục vụ thanh tra.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-AUD-01]` `GET /api/v1/admin/audit-logs?actor_id={id}&action={act}&target_id={tid}&from={date}&to={date}&page=1&limit=50`
- `[ADM-AUD-02]` `GET /api/v1/admin/audit-logs/export?from={d}&to={d}&format=csv`

**Payload mẫu một dòng log:**
```json
{
  "id": "aud_99182a",
  "timestamp": "2026-09-21T10:15:30Z",
  "actor": { "id": "u_cb_02", "name": "Trần Thị B", "role": "OFFICER" },
  "action": "REVIEW_APPROVE",
  "target": { "type": "EVIDENCE", "id": "ev_8812c" },
  "changes": {
    "display_status": { "old": "NEEDS_HUMAN_REVIEW", "new": "APPROVED" },
    "official_score": { "old": null, "new": 5.0 }
  },
  "ip_address": "10.0.4.15",
  "reason": "Đã đối chiếu danh sách tình nguyện viên Mùa hè xanh."
}
```
