# FS-O09 — Tra cứu Hồ sơ & Bảng điểm Sinh viên

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O09`** | **`[SCO-05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV) & ADMIN. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cho phép Cán bộ và Admin tra cứu toàn diện hồ sơ điểm rèn luyện của bất kỳ sinh viên nào theo MSSV hoặc Họ tên: Xem bảng điểm tổng hợp các kỳ, danh sách minh chứng đã nộp, lịch sử khiếu nại và cơ chế truy vết quyết định ("Vì sao sinh viên được X điểm?").

---

## 2. 👤 User Story
> **As a** cán bộ phòng CTSV / Cố vấn học tập,
> **I want to** tra cứu nhanh toàn bộ quá trình rèn luyện của một sinh viên khi tiếp nhận phản ánh,
> **so that** tôi nắm rõ mọi dữ liệu lịch sử và giải thích cặn kẽ cho sinh viên hoặc phụ huynh.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Tìm kiếm tức thì theo MSSV hoặc Họ tên (auto-complete sau 3 ký tự) qua `[SCO-05]`.
- **AC-2**: Hiển thị bảng tổng hợp: Thông tin cá nhân (Lớp, Khoa, Email), Bảng điểm 5 khung của kỳ hiện tại và lịch sử các kỳ trước.
- **AC-3**: Hỗ trợ xem màn hình "What can I claim?" của sinh viên đó để tư vấn định hướng rèn luyện.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[SCO-05]` Tìm kiếm và tra cứu sinh viên
- **GET** `/api/v1/students/search?q={query}&faculty_id={facId}&class_id={clsId}&page=1&limit=20`
- **Auth**: Bearer `<access_token>` (Role: `OFFICER` | `ADMIN`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "u_8f2c1a9e",
      "student_id": "102210123",
      "full_name": "Nguyễn Văn A",
      "class_name": "21TCLC_DT1",
      "faculty_name": "Khoa CNTT",
      "current_term_score": 82.5,
      "current_grade": "TỐT"
    }
  ]
}
```
