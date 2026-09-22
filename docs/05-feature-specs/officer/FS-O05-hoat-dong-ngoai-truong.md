# FS-O05 — Hoạt động Ngoài trường & Danh bạ Đơn vị Tổ chức

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O05`** | **`[EXT-04]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Phân loại: **[ADV]**

---

## 1. 🎯 Objective
Quản lý danh mục các đơn vị đối tác, doanh nghiệp, tổ chức tình nguyện xã hội uy tín bên ngoài trường đã được công nhận. Khi sinh viên nộp minh chứng từ các đơn vị này, hệ thống tự động gán nhãn đơn vị quen thuộc và hỗ trợ gửi yêu cầu xác minh tự động.

---

## 2. 👤 User Story
> **As a** cán bộ quản lý hoạt động,
> **I want to** tra cứu và cập nhật danh bạ các tổ chức bên ngoài đã được kiểm chứng,
> **so that** các minh chứng từ các tổ chức này được xác minh nhanh hơn mà không cần kiểm tra lại độ tin cậy từ đầu.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng danh sách đơn vị tổ chức bên ngoài: Tên tổ chức, Mã số thuế/Quyết định thành lập, Domain website chính thức, Email liên hệ xác minh, Trạng thái (Đã xác minh / Cần lưu ý / Khóa).
- **AC-2**: Thống kê số lượng sinh viên đã tham gia hoạt động tại từng đơn vị.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[EXT-04]` Lấy danh mục tổ chức ngoài trường
- **GET** `/api/v1/external/organizations?search={q}&status={st}&page=1&limit=20`
- **Auth**: Bearer `<access_token>` (Role: `OFFICER` | `ADMIN`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "org_thanhdoan",
      "name": "Thành Đoàn Đà Nẵng",
      "domain": "thanhdoandanang.org.vn",
      "contact_email": "vanphong@thanhdoandanang.org.vn",
      "trust_level": "VERIFIED_PARTNER",
      "total_activities_count": 14
    }
  ]
}
```
