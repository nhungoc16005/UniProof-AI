# FS-O07 — Xử lý Khiếu nại Điểm Rèn luyện

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O07`** | **`[APL-03]` `[APL-04]` `[APL-05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý và giải quyết các đơn khiếu nại của sinh viên đối với các hồ sơ minh chứng bị từ chối hoặc bị hạ điểm. Cung cấp quy trình xem xét hai chiều (lý do sinh viên khiếu nại $\leftrightarrow$ căn cứ quyết định ban đầu) và đưa ra phán quyết cuối cùng (Chấp nhận khiếu nại / Giữ nguyên quyết định).

---

## 2. 👤 User Story
> **As a** cán bộ giải quyết khiếu nại,
> **I want to** đọc giải trình và bằng chứng bổ sung của sinh viên khiếu nại,
> **so that** tôi sửa lại mức điểm nếu quyết định trước đó chưa chuẩn xác, hoặc giải thích rõ ràng nếu khiếu nại không hợp lệ.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Danh sách khiếu nại chờ xử lý (`[APL-03]`): Hiển thị Tên sinh viên, MSSV, Tên hoạt động, Điểm trước/sau, Thời gian gửi khiếu nại.
- **AC-2**: Chi tiết đơn khiếu nại (`[APL-05]`): Hiển thị song song lý do từ chối ban đầu và văn bản giải trình của sinh viên kèm file đính kèm.
- **AC-3**: Phán quyết (`[APL-04]`):
  - *Chấp nhận khiếu nại*: Nhập điểm mới cập nhật $\rightarrow$ Hồ sơ chuyển `APPROVED`, tự động cộng lại điểm tổng kỳ.
  - *Bác bỏ khiếu nại*: Bắt buộc nhập lý do giải thích chi tiết gửi cho sinh viên $\rightarrow$ Hồ sơ giữ nguyên `REJECTED`.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[APL-03]` Lấy danh sách khiếu nại
- **GET** `/api/v1/officer/appeals?status=PENDING&term_id={termId}&page=1&limit=20`

### 4.2 `[APL-04]` Giải quyết khiếu nại
- **POST** `/api/v1/appeals/{id}/resolve`
```json
{
  "resolution": "ACCEPT",
  "new_score": 4.0,
  "explanation": "Cán bộ đã kiểm tra lại quyết định thành lập ban tổ chức do sinh viên bổ sung. Chấp nhận mức điểm thành viên BTC +4.0 điểm."
}
```
*(Nếu bác bỏ: `"resolution": "REJECT"`, `"explanation": "..."`)*.
