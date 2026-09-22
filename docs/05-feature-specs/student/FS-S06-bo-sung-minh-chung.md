# FS-S06 — Bổ sung Minh chứng theo Yêu cầu

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S06`** | **`[EVD-09]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cho phép sinh viên tải thêm ảnh/tài liệu hoặc bổ sung đường link/thông tin liên hệ khi Cán bộ yêu cầu bổ sung minh chứng (trạng thái `NEEDS_SUPPLEMENT`), đảm bảo hồ sơ được hoàn thiện trước thời hạn quy định (*Supplement Deadline*).

---

## 2. 👤 User Story
> **As a** sinh viên có hồ sơ bị yêu cầu bổ sung,
> **I want to** đọc rõ lý do cán bộ yêu cầu và tải thêm giấy tờ bổ sung,
> **so that** hồ sơ của tôi được cán bộ xem xét lại và công nhận điểm.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Hiển thị hộp thông báo lý do Cán bộ yêu cầu bổ sung (VD: *"Ảnh bị mờ phần con dấu, vui lòng chụp lại bản gốc rõ nét"*).
- **AC-2**: Hiển thị hạn chót nộp bổ sung (mặc định 7 ngày kể từ khi yêu cầu). Nếu quá hạn $\rightarrow$ Hồ sơ tự động chuyển thành `REJECTED`.
- **AC-3**: Form tải file bổ sung (tối đa 3 files) và ô nhập giải trình thêm $\rightarrow$ Gọi `[EVD-09]`.
- **AC-4**: Sau khi bổ sung, trạng thái hồ sơ chuyển về `PROCESSING` để chạy lại kiểm tra hoặc chuyển thẳng cho Cán bộ duyệt lại.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[EVD-09]` Gửi minh chứng bổ sung
- **POST** `/api/v1/evidence/{id}/supplement`
- **Content-Type**: `multipart/form-data`
- **Auth**: Bearer `<access_token>`

**Form Data:**
- `files`: File ảnh/PDF mới tải lên.
- `supplement_note`: "Em đã chụp lại bản gốc có dấu đỏ rõ nét như thầy/cô yêu cầu ạ."

**Response (200 OK):**
```json
{
  "data": {
    "id": "ev_9918a",
    "display_status": "PROCESSING",
    "message": "Đã gửi thông tin bổ sung thành công. Cán bộ sẽ sớm xét duyệt lại hồ sơ của bạn."
  },
  "request_id": "req_evd_09"
}
```
