# FS-O06 — Quản lý Hoạt động Nội bộ & Danh sách Điểm danh

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O06`** | **`[ACT-02]` `[ACT-03]` `[ACT-04]` `[ACT-05]` `[ACT-06]` `[ACT-07]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý các hoạt động phong trào, hội thảo, tình nguyện do trường, khoa, đoàn thể tổ chức. Cho phép Cán bộ tạo hoạt động, cấu hình khung tiêu chí điểm và **Import danh sách sinh viên điểm danh bằng file Excel (`[ACT-06]`)**. Đây là dữ liệu nguồn giúp hệ thống tự động xác minh nội bộ (Cấp `I1` Danh tính $\rightarrow$ `I2` Hoạt động $\rightarrow$ `I3` Điểm danh) mà không cần xem xét thủ công.

---

## 2. 👤 User Story
> **As a** cán bộ tổ chức hoạt động,
> **I want to** tải lên danh sách sinh viên đã tham gia hoạt động sau khi sự kiện kết thúc,
> **so that** khi các bạn sinh viên nộp minh chứng, hệ thống tự động khớp mã sinh viên và duyệt điểm ngay lập tức.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | CRUD Hoạt động nội bộ | Functional | Tạo mới (`[ACT-03]`), cập nhật (`[ACT-05]`), xem chi tiết (`[ACT-04]`): Tên sự kiện, Đơn vị tổ chức, Thời gian, Địa điểm, Tiêu chí rèn luyện mặc định, Điểm quy định theo vai trò. |
| AC-2 | Import danh sách tham gia | Bulk Upload | Tải lên file Excel/CSV danh sách MSSV (`[ACT-06]`). Hệ thống tự động kiểm tra trùng lặp và xác thực MSSV có tồn tại trong trường. |
| AC-3 | Tự động khớp hồ sơ đã nộp | Auto Match | Khi import danh sách thành công, hệ thống tự động quét lại các minh chứng đang ở trạng thái `PROCESSING` hoặc `NEEDS_HUMAN_REVIEW` của sinh viên trong danh sách $\rightarrow$ Chuyển thành `VERIFIED` và kích hoạt tự động duyệt. |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ACT-02]` `GET /api/v1/activities?term_id={id}&status={st}&page=1&limit=20`
- `[ACT-03]` `POST /api/v1/activities` (Tạo hoạt động mới)
- `[ACT-04]` `GET /api/v1/activities/{id}` (Xem chi tiết hoạt động)
- `[ACT-05]` `PUT /api/v1/activities/{id}` (Cập nhật hoạt động)
- `[ACT-06]` `POST /api/v1/activities/{id}/attendance/import` (Import file Excel điểm danh)
- `[ACT-07]` `GET /api/v1/activities/{id}/attendance?page=1&limit=50` (Xem danh sách điểm danh)

**Payload mẫu `[ACT-06]` (Import response):**
```json
{
  "data": {
    "activity_id": "act_8812a",
    "total_rows_imported": 250,
    "matched_students": 248,
    "unmatched_mssv": ["102210999", "102210888"],
    "auto_verified_evidence_count": 115
  },
  "request_id": "req_act_06"
}
```
