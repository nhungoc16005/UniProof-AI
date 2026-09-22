# FS-S07 — Khiếu nại Kết quả Đánh giá

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S07`** | **`[APL-01]` `[APL-02]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Bảo vệ quyền lợi chính đáng của sinh viên khi kết quả đánh giá minh chứng không thỏa đáng (bị trừ điểm, sai tiêu chí, hoặc bị từ chối không đúng). Cung cấp kênh khiếu nại minh bạch kèm bằng chứng giải trình, có giới hạn thời gian mở cổng khiếu nại (*Appeal Window*).

---

## 2. 👤 User Story
> **As a** sinh viên có minh chứng bị từ chối hoặc bị hạ điểm,
> **I want to** gửi đơn khiếu nại kèm căn cứ giải trình,
> **so that** Cán bộ xem xét lại hồ sơ và khôi phục quyền lợi điểm cho tôi.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Điều kiện khiếu nại | Validation | Chỉ mở nút Khiếu nại khi: (1) Hồ sơ có `display_status = APPROVED` (nhưng bị giảm điểm) hoặc `REJECTED`, (2) Trong thời hạn khiếu nại của học kỳ, (3) Số lần khiếu nại trên hồ sơ này chưa vượt quá 2 lần. |
| AC-2 | Form gửi khiếu nại | Functional | Nhập: Lý do khiếu nại (bắt buộc, tối thiểu 20 ký tự), Điểm sinh viên đề xuất, Tài liệu/ảnh chứng minh bổ sung (tùy chọn) $\rightarrow$ Gọi `[APL-01]`. |
| AC-3 | Trạng thái hồ sơ | State | Sau khi gửi, hồ sơ chuyển `display_status = APPEALING` (Đang khiếu nại). |
| AC-4 | Xem lịch sử khiếu nại | Display | Xem toàn bộ phản hồi giải quyết của Cán bộ (`[APL-02]`). |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[APL-01]` Gửi yêu cầu khiếu nại
- **POST** `/api/v1/evidence/{id}/appeal`
- **Auth**: Bearer `<access_token>`

**Request Body:**
```json
{
  "reason": "Em là thành viên Ban tổ chức chiến dịch Mùa hè xanh (có tên trong Quyết định thành lập BTC đính kèm), nhưng thầy/cô duyệt điểm ở mức người tham gia thông thường (+2 điểm thay vì +4 điểm).",
  "requested_score": 4.0,
  "requested_criterion_id": "cri_iv_1",
  "evidence_file_ids": ["file_btc_quyetdinh.pdf"]
}
```

**Response (201 Created):**
```json
{
  "data": {
    "appeal_id": "apl_7712a",
    "evidence_id": "ev_8812c",
    "status": "PENDING",
    "submitted_at": "2026-09-22T09:00:00Z"
  },
  "request_id": "req_apl_01"
}
```

### 4.2 `[APL-02]` Xem lịch sử khiếu nại của minh chứng
- **GET** `/api/v1/evidence/{id}/appeals`
