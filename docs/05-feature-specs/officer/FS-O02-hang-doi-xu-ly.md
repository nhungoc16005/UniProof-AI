# FS-O02 — Hàng đợi Xử lý Hồ sơ Thông minh (Smart Queue)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O02`** | **`[OFF-01]` `[OFF-02]` `[REV-02]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Sắp xếp và phân bổ hàng đợi hồ sơ minh chứng theo thứ tự ưu tiên nghiệp vụ, giúp Cán bộ không mất thời gian ở những hồ sơ AI đã có đầy đủ căn cứ xác minh mà tập trung giải quyết các hồ sơ sắp trễ hạn SLA, có khiếu nại hoặc có mâu thuẫn dữ liệu.

---

## 2. 👤 User Story
> **As a** cán bộ duyệt điểm,
> **I want to** làm việc trên danh sách hồ sơ đã được phân loại mức độ khẩn cấp và rủi ro,
> **so that** tôi duyệt nhanh các hồ sơ chuẩn (Fast-track) và dành thời gian kiểm tra kỹ các hồ sơ có nghi vấn.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | **Sắp xếp theo độ ưu tiên** | Queue Logic | Thứ tự ưu tiên hiển thị trên đỉnh hàng đợi: (1) Sắp quá hạn SLA (< 12h), (2) Đang khiếu nại (`APPEALING`), (3) Có mâu thuẫn dữ liệu (`INVALID`), (4) Đáng ngờ (`SUSPICIOUS`), (5) Certificate-only (`NEEDS_HUMAN_REVIEW`), (6) Hồ sơ chuẩn (`PLAUSIBLE` / `VERIFIED`). |
| AC-2 | **Bộ lọc thông minh** | Filter | Lọc theo: Lớp, Khoa, Tiêu chí, Mức xác minh (L1–L5 hoặc I1–I3), Trạng thái rủi ro. |
| AC-3 | **Duyệt hàng loạt Fast-track** | Bulk Action | Đối với các hồ sơ đạt xác minh cấp cao (`VERIFIED`) và AI confidence $\ge 0.85$ $\rightarrow$ Cho phép Cán bộ chọn nhiều và ấn **[Duyệt hàng loạt (`REV-02`)]** để tiết kiệm thời gian. |
| AC-4 | **Điều hướng 1-click** | Interaction | Bấm vào bất kỳ dòng hồ sơ nào $\rightarrow$ Mở màn hình xét duyệt Split-view (`O03`). |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[OFF-01]` Lấy danh sách hàng đợi ưu tiên
- **GET** `/api/v1/officer/queue?sort_by=priority&class_id={id}&status={st}&page=1&limit=20`
- **Auth**: Bearer `<access_token>` (Role: `OFFICER`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "ev_8812c",
      "student_name": "Nguyễn Văn A",
      "student_id": "102210xxx",
      "class_name": "21TCLC_DT1",
      "activity_name": "Chiến dịch Mùa hè xanh",
      "suggested_score": 5.0,
      "confidence": 0.94,
      "verification_level": "L2_ORGANIZER_CONFIRMED",
      "display_status": "VERIFIED",
      "priority_score": 95,
      "sla_remaining_hours": 8
    }
  ],
  "meta": { "total": 48, "urgent_count": 5 }
}
```

### 4.2 `[REV-02]` Phê duyệt hàng loạt hồ sơ Fast-track
- **POST** `/api/v1/evidence/bulk-review`
```json
{
  "evidence_ids": ["ev_8812c", "ev_9918a"],
  "action": "APPROVE"
}
```
