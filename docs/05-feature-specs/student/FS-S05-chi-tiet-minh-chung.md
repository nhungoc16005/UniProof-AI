# FS-S05 — Chi tiết Minh chứng (Đối chiếu OCR, Xác minh & Đề xuất AI)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S05`** | **`[EVD-06]` `[EVD-07]` `[EVD-08]` `[PIPE-01]` `[PIPE-02]` `[PIPE-03]` `[PIPE-05]` `[PIPE-08]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App) — Trang quan trọng nhất của Sinh viên. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Minh bạch hóa toàn bộ quá trình phân tích và đánh giá minh chứng của sinh viên. Sinh viên theo dõi tiến trình xử lý thời gian thực (Stepper 7 bước), xem dữ liệu OCR trích xuất được (và sửa nếu máy đọc sai), hiểu rõ hai câu hỏi xác minh độc lập, thấy rõ **Evidence Gap ("còn thiếu gì để được xác minh?")**, và hiểu lý do vì sao AI đề xuất mức điểm đó.

---

## 2. 👤 User Stories
- **As a** sinh viên,
  **I want to** biết hệ thống đang xử lý hồ sơ của mình tới bước nào và đọc được thông tin gì từ ảnh,
  **so that** tôi yên tâm và có thể đính chính kịp thời nếu OCR nhận diện sai tên hoặc MSSV.
- **As a** sinh viên,
  **I want to** biết chính xác hồ sơ của mình còn thiếu giấy tờ gì (Evidence Gap),
  **so that** tôi chủ động bổ sung trước khi Cán bộ từ chối.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | **Stepper 7 bước tiến trình** | Real-time | Khi `display_status = PROCESSING`, hiển thị tiến trình động qua SSE (`[EVD-08]`) hoặc polling 3s (`[EVD-07]`): Nhận file $\rightarrow$ Quét virus $\rightarrow$ OCR $\rightarrow$ Trích xuất thực thể $\rightarrow$ Phân loại hoạt động $\rightarrow$ Xác minh $\rightarrow$ Tính điểm Rule Engine. |
| AC-2 | **Kiểm tra & Sửa lỗi OCR** | Human-in-loop | Sinh viên được xem kết quả OCR trích xuất (`[PIPE-01]`). Nếu sai (do ảnh chụp nghiêng/mờ), sinh viên có quyền gửi yêu cầu sửa trường (`[PIPE-02]`). |
| AC-3 | **Hai câu hỏi xác minh tách biệt** | Integrity | Hiển thị 2 chip riêng biệt: (1) *"Hoạt động có tồn tại?"* (Đạt/Chưa chắc) và (2) *"Sinh viên có tham gia?"* (Đạt/Chưa chắc). Không gộp thành 1 huy hiệu duy nhất. |
| AC-4 | **Evidence Gap ("Còn thiếu gì?")** | Transparency | Hiển thị khối Evidence Gap (`[PIPE-08]`): Liệt kê danh sách các bằng chứng còn thiếu để đạt cấp độ xác minh cao hơn, kèm nút **[Bổ sung ngay (S06)]**. |
| AC-5 | **Điểm AI đề xuất & Giải thích** | Explainable AI | Điểm nằm trong khung nét đứt ✦ kèm chip giải thích lý do trích dẫn từ quy chế trường (`[PIPE-05]`). |
| AC-6 | **Khiếu nại** | Action | Nếu Cán bộ duyệt điểm khác hoặc từ chối $\rightarrow$ Hiện nút **[Khiếu nại kết quả (S07)]**. |

---

## 4. 🖥️ UI/UX Specification (`S05`)

```
┌─────────────────────────────────────────────────────────────┐
│ [← Danh sách]        CHI TIẾT HỒ SƠ EV-99182        [Chia sẻ]│
├─────────────────────────────────────────────────────────────┤
│  Hoạt động: Chiến dịch Mùa hè xanh 2026                     │
│  Trạng thái: 🛡️ VERIFIED (Đã xác minh)                      │
│                                                             │
│  [✦ Đề xuất: +5.0 điểm]        [ Điểm chính thức: +5.0 ]    │
│  Tiêu chí: 4.1 - Hoạt động tình nguyện vì cộng đồng         │
├─────────────────────────────────────────────────────────────┤
│  🔍 HAI CÂU HỎI XÁC MINH:                                   │
│  • Hoạt động có tồn tại?  🟢 ĐÃ XÁC MINH (Website Đoàn ĐHBK)│
│  • Sinh viên có tham gia? 🟢 ĐÃ XÁC MINH (DS điểm danh Đoàn)│
│  Mức xác minh: Cấp 2 (Xác nhận từ đơn vị nội bộ trường)     │
├─────────────────────────────────────────────────────────────┤
│  📋 THÔNG TIN HỆ THỐNG TRÍCH XUẤT (OCR):                    │
│  • Họ tên: Nguyễn Văn A               • MSSV: 102210xxx     │
│  • Đơn vị cấp: Đoàn Thanh niên        • Ngày: 28/07/2026    │
│  [✏️ Báo sai sót thông tin OCR]                              │
├─────────────────────────────────────────────────────────────┤
│  💡 EVIDENCE GAP (HỒ SƠ CỦA BẠN ĐÃ ĐẦY ĐỦ):                 │
│  ✓ Giấy chứng nhận hoàn thành chiến dịch                    │
│  ✓ Khớp danh sách điểm danh ban tổ chức                      │
│                                                             │
│  [📄 Xem ảnh minh chứng gốc]        [⚖️ Khiếu nại (S07)]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[EVD-06]` `GET /api/v1/evidence/{id}` — Chi tiết hồ sơ tổng quan.
- `[EVD-07]` `GET /api/v1/evidence/{id}/status` — Polling tiến trình nhẹ.
- `[EVD-08]` `GET /api/v1/evidence/{id}/stream` — Server-Sent Events (SSE) tiến trình.
- `[PIPE-01]` `GET /api/v1/evidence/{id}/ocr` — Kết quả OCR và các trường trích xuất.
- `[PIPE-02]` `PATCH /api/v1/evidence/{id}/ocr/fields` — Sinh viên đính chính trường OCR sai.
- `[PIPE-03]` `GET /api/v1/evidence/{id}/verification` — Kết quả xác minh 2 câu hỏi.
- `[PIPE-05]` `GET /api/v1/evidence/{id}/ai-recommendation` — Đề xuất điểm của AI & lý do.
- `[PIPE-08]` `GET /api/v1/evidence/{id}/evidence-gap` — Danh sách bằng chứng còn thiếu.

**Payload mẫu `[PIPE-08]` (Evidence Gap):**
```json
{
  "data": {
    "current_level": "L5_CERTIFICATE_ONLY",
    "target_level": "L2_ORGANIZER_CONFIRMED",
    "missing_items": [
      {
        "type": "ORGANIZER_CONTACT",
        "description": "Cần cung cấp email hoặc số điện thoại của Ban tổ chức để gửi yêu cầu xác thực.",
        "action": "PROVIDE_CONTACT"
      }
    ],
    "can_claim_points_now": true,
    "current_provisional_score": 2.0,
    "potential_score": 4.0
  }
}
```
