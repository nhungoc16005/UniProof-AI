# FS-S04 — Danh sách Minh chứng của Tôi

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S04`** | **`[EVD-05]` `[EVD-10]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý tập trung toàn bộ minh chứng sinh viên đã nộp trong học kỳ hiện tại hoặc các học kỳ trước. Cung cấp bộ lọc đa chiều theo trạng thái hiển thị (`display_status`), tìm kiếm nhanh và hỗ trợ quyền **Rút hồ sơ (`[EVD-10]`)** khi hồ sơ chưa được duyệt.

---

## 2. 👤 User Story
> **As a** sinh viên,
> **I want to** xem danh sách các minh chứng mình đã nộp kèm trạng thái trực quan,
> **so that** tôi biết hồ sơ nào đã được duyệt, hồ sơ nào cần bổ sung và có thể rút lại hồ sơ nếu nộp nhầm.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Hiển thị thẻ minh chứng | Display | Mỗi thẻ hiển thị: Tên hoạt động, Tiêu chí, Ngày nộp, Huy hiệu trạng thái (`display_status`), Điểm (chính thức hoặc đề xuất). |
| AC-2 | Bộ lọc trạng thái chuẩn | Filter | Lọc theo: Tất cả / Bản nháp (`DRAFT`) / Đang xử lý (`PROCESSING`) / Cần bổ sung (`NEEDS_SUPPLEMENT`) / Đã duyệt (`APPROVED`) / Bị từ chối (`REJECTED`) / Đang khiếu nại (`APPEALING`). |
| AC-3 | Rút hồ sơ (Withdraw) | Action | Chỉ hiển thị nút "Rút hồ sơ" (`[EVD-10]`) khi hồ sơ ở trạng thái `DRAFT`, `PROCESSING`, `NEEDS_SUPPLEMENT` hoặc `NEEDS_HUMAN_REVIEW` (chưa chốt `APPROVED`/`REJECTED`). |
| AC-4 | Nút hành động nhanh | Action | Với hồ sơ `NEEDS_SUPPLEMENT` $\rightarrow$ Hiện nút màu cam nổi bật: **[Bổ sung ngay (S06)]**. |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[EVD-05]` Danh sách minh chứng cá nhân
- **GET** `/api/v1/evidence/my?term_id={id}&status={display_status}&page=1&limit=20`
- **Auth**: Bearer `<access_token>`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "ev_8812c",
      "activity_name": "Hiến máu nhân đạo đợt 1",
      "criterion": { "id": "cri_iv_1", "name": "4.1 Hoạt động vì cộng đồng" },
      "display_status": "APPROVED",
      "submitted_at": "2026-09-15T08:30:00Z",
      "official_score": 5.0,
      "files_count": 1
    },
    {
      "id": "ev_9918a",
      "activity_name": "Ngày hội việc làm DUT 2026",
      "criterion": { "id": "cri_iii_1", "name": "3.1 Văn hóa thể thao" },
      "display_status": "NEEDS_SUPPLEMENT",
      "submitted_at": "2026-09-20T14:15:00Z",
      "suggested_score": 2.0,
      "supplement_deadline": "2026-09-27T23:59:59Z"
    }
  ],
  "meta": { "total": 6, "page": 1, "page_size": 20 }
}
```

### 4.2 `[EVD-10]` Rút hồ sơ minh chứng
- **POST** `/api/v1/evidence/{id}/withdraw`
```json
{ "reason": "Em tải nhầm file ảnh của hoạt động khác." }
```
