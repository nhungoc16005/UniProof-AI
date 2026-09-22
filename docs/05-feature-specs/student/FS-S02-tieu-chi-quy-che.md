# FS-S02 — Tiêu chí & Quy chế Điểm Rèn luyện

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S02`** | **`[CRI-01]` `[CRI-02]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cho phép sinh viên duyệt cây danh mục tiêu chí đánh giá điểm rèn luyện (Khung I đến V), xem chi tiết các điều kiện áp dụng, mức điểm tối đa, và các loại minh chứng hợp lệ cần nộp cho từng tiêu chí.

---

## 2. 👤 User Story
> **As a** sinh viên,
> **I want to** tra cứu danh mục tiêu chí và xem yêu cầu minh chứng của từng mục,
> **so that** tôi chuẩn bị đúng giấy tờ/ảnh chụp trước khi bấm nộp.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Hiển thị cây tiêu chí 2 cấp: Cấp 1 (Khung I–V), Cấp 2 (Mục chi tiết, VD: 3.1 Tham gia hoạt động văn nghệ/thể thao).
- **AC-2**: Chi tiết mỗi tiêu chí hiển thị: Tên tiêu chí, Điểm tối đa, Mô tả điều kiện, Mức điểm theo vai trò (BTC/TTV/Người tham gia/Cổ vũ), Ví dụ minh chứng hợp lệ.
- **AC-3**: Có nút hành động nhanh: **[Nộp minh chứng cho tiêu chí này (S03)]**.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[CRI-01]` `GET /api/v1/criteria?term_id={id}` (Danh sách tiêu chí)
- `[CRI-02]` `GET /api/v1/criteria/{id}` (Chi tiết 1 tiêu chí kèm hướng dẫn)

**Payload mẫu tiêu chí:**
```json
{
  "id": "cri_iii_1",
  "code": "3.1",
  "name": "Tham gia hoạt động văn hóa, văn nghệ, thể dục thể thao",
  "category": "III",
  "max_score": 8.0,
  "roles_score": {
    "ORGANIZER": 4.0,
    "VOLUNTEER": 3.0,
    "PARTICIPANT": 2.0,
    "CHEERLEADER": 1.0
  },
  "required_evidence_types": ["CERTIFICATE", "ATTENDANCE_CONFIRMATION", "ACTIVITY_PHOTO"]
}
```
