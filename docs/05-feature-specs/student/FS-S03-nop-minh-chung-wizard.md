# FS-S03 — Nộp Minh chứng Điểm Rèn luyện (Wizard 3 bước)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S03`** | **`[EVD-01]` `[EVD-02]` `[EVD-03]` `[EVD-04]` `[ACT-01]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quy trình nộp minh chứng trực quan, tối giản hóa theo wizard 3 bước: Khai báo hoạt động $\rightarrow$ Tải file minh chứng $\rightarrow$ Xác nhận thông tin và gửi. Hỗ trợ cơ chế lưu nháp (*Draft*) tự động để tránh mất dữ liệu.

---

## 2. 👤 User Stories
- **As a** sinh viên,
  **I want to** nộp minh chứng cho hoạt động trường hoặc hoạt động ngoài xã hội chỉ với vài bước trên điện thoại,
  **so that** hồ sơ của tôi được tiếp nhận và xử lý nhanh chóng mà không cần nộp bản cứng.
- **As a** sinh viên,
  **I want to** lưu nháp khi chưa chụp đủ ảnh giấy tờ,
  **so that** tôi có thể tiếp tục nộp sau mà không phải nhập lại từ đầu.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | **Bước 1 — Chọn Hoạt động** | Flow | Cho phép chọn từ: (1) Hoạt động nội bộ đã đăng ký (`[ACT-01]`), (2) Hoạt động ngoài trường (nhập tên, đơn vị tổ chức, ngày), (3) "Chưa rõ tiêu chí" để AI tự gợi ý. |
| AC-2 | **Bước 2 — Tải Minh chứng** | Flow | Hỗ trợ chụp ảnh trực tiếp hoặc chọn ảnh/PDF từ thư viện (`[EVD-02]`). Tối đa 5 files, dung lượng tối đa 10MB/file. Hỗ trợ xoay ảnh, xem trước, xóa ảnh (`[EVD-03]`). |
| AC-3 | **Bước 3 — Khai báo Vai trò & Gửi** | Flow | Chọn vai trò tham gia (Ban tổ chức / Tình nguyện viên / Người tham gia / Cổ vũ). Nhấn [Gửi hồ sơ] (`[EVD-04]`). |
| AC-4 | **Lưu nháp (Draft)** | Safety | Khi chọn file xong hệ thống tự tạo bản ghi `DRAFT` qua `[EVD-01]`. Nếu thoát app, quay lại `S04` vẫn thấy hồ sơ nháp có nút "Tiếp tục nộp". |
| AC-5 | **Bất đồng bộ tức thì** | Async | Khi nộp thành công, hệ thống trả về ngay mã tiếp nhận trong < 1s, chuyển trạng thái sang `PROCESSING` và kích hoạt BullMQ worker xử lý nền. |

---

## 4. 🖥️ UI/UX Specification (`S03`)

```
┌─────────────────────────────────────────────────────────────┐
│ [← Trở về]        NỘP MINH CHỨNG (Bước 2/3)         [Lưu nháp]
├─────────────────────────────────────────────────────────────┤
│  Hoạt động: Ngày hội Việc làm DUT 2026                      │
│  Tiêu chí: 3.1 - Hoạt động văn hóa thể thao / Hội chợ       │
├─────────────────────────────────────────────────────────────┤
│  📸 TẢI ẢNH / FILE MINH CHỨNG (Tối đa 5 file, max 10MB)     │
│                                                             │
│  ┌───────────────────────┐  ┌────────────────────────┐      │
│  │ [ Ảnh GCN Tham gia ]  │  │ [ ➕ Chụp thêm ảnh ]   │      │
│  │   gcn_ngayhoi.jpg     │  │   hoặc tải file PDF    │      │
│  │   [🔍 Xem]  [🗑️ Xóa]   │  │                        │      │
│  └───────────────────────┘  └────────────────────────┘      │
│                                                             │
│  💡 Gợi ý: Hãy chụp ảnh rõ nét 4 góc, đủ con dấu và chữ ký  │
│     để AI nhận diện nhanh và chính xác nhất.                │
├─────────────────────────────────────────────────────────────┤
│  [ Quay lại Bước 1 ]              [ Tiếp tục: Bước 3 (➤) ]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 5.1 `[EVD-01]` Tạo hồ sơ nháp
- **POST** `/api/v1/evidence/draft`
```json
{
  "activity_id": "act_8812a",
  "external_activity_name": null,
  "term_id": "term_2026_1",
  "criterion_id": "cri_iii_1"
}
```
**Response (201 Created):** `{ "data": { "id": "ev_991823", "display_status": "DRAFT" } }`

### 5.2 `[EVD-02]` Tải file minh chứng đính kèm
- **POST** `/api/v1/evidence/{id}/files`
- **Content-Type**: `multipart/form-data` (file ảnh/PDF)

### 5.3 `[EVD-04]` Chính thức nộp hồ sơ (Kích hoạt Pipeline)
- **POST** `/api/v1/evidence/{id}/submit`
- **Headers**: `Idempotency-Key: <uuid>`

**Request Body:**
```json
{
  "claimed_role": "PARTICIPANT",
  "student_note": "Em tham gia trọn vẹn cả ngày và có giấy chứng nhận kèm theo."
}
```

**Response (202 Accepted):**
```json
{
  "data": {
    "id": "ev_991823",
    "display_status": "PROCESSING",
    "job_id": "job_ocr_991823",
    "status_url": "/api/v1/evidence/ev_991823/status",
    "stream_url": "/api/v1/evidence/ev_991823/stream"
  }
}
```

---

## 6. ⚠️ Error Handling
- `FILE_TOO_LARGE` (413): File vượt quá 10MB $\rightarrow$ Thông báo: "Dung lượng file vượt quá giới hạn 10MB. Vui lòng nén file."
- `FILE_TYPE_NOT_ALLOWED` (415): Upload file sai định dạng (chỉ nhận JPG, PNG, PDF).
- `TERM_CLOSED` (409): Kỳ đánh giá đã khóa sổ nộp minh chứng $\rightarrow$ Khóa nút nộp.
