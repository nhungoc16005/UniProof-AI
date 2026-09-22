# FS-O03 — Màn hình Xét duyệt Hồ sơ (Split-view Inspection)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O03`** | **`[EVD-06]` `[PIPE-01..11]` `[REV-01]` `[REV-03..05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV) — **Trang cốt lõi của Officer**. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp bàn làm việc chuyên nghiệp dạng màn hình kép (Split-view 50:50) cho phép Cán bộ đối chiếu trực tiếp giữa ảnh/file minh chứng gốc với kết quả bóc tách OCR, kết quả xác minh 2 câu hỏi độc lập, đề xuất phân loại của PhoBERT và trần điểm Rule Engine. Giúp ra quyết định phê duyệt hoặc từ chối nhanh chóng, chuẩn xác và có căn cứ pháp lý.

---

## 2. 👤 User Story
> **As a** cán bộ chấm điểm rèn luyện,
> **I want to** nhìn thấy ảnh minh chứng gốc song song với dữ liệu AI đọc được và điểm đề xuất,
> **so that** tôi đối chiếu nhanh mà không cần tải file về máy, và ra quyết định chỉ với 1 cú click chuột.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | **Bố cục Split-view 50:50** | Layout | Cột trái: Trình xem tài liệu (Zoom 300%, xoay 90°, lật trang PDF, bounding box con dấu/chữ ký). Cột phải: Thông tin sinh viên, kết quả xác minh và bảng điều khiển quyết định. |
| AC-2 | **Khóa xử lý đồng thời (Soft-lock)** | Concurrency | Khi Cán bộ mở hồ sơ, hệ thống gọi `[REV-03]` khóa hồ sơ trong 15 phút. Cán bộ khác mở ra sẽ thấy cảnh báo: *"Cán bộ Trần B đang xử lý hồ sơ này"*. Thoát màn hình $\rightarrow$ mở khóa `[REV-04]`. |
| AC-3 | **Hai câu hỏi xác minh tách biệt** | Verification | Hiển thị 2 câu hỏi độc lập: (1) Hoạt động có tồn tại? (2) Sinh viên có tham gia? Kèm thang xác minh L1–L5 (ngoài trường) hoặc I1–I3 (nội bộ). |
| AC-4 | **Tín hiệu rủi ro (Risk Signals)** | Fraud Detection | Chỉ hiển thị cho Cán bộ: Cảnh báo trùng lặp ảnh (`[PIPE-04]`), phát hiện can thiệp số/chữ (`[PIPE-11]`), lệch ngày tháng tổ chức. |
| AC-5 | **Bốn hành động ra quyết định (`[REV-01]`)** | Action | (1) **Duyệt**: Giữ nguyên đề xuất AI hoặc chỉnh điểm. (2) **Từ chối**: Bắt buộc chọn căn cứ quy chế (`reject_basis`). (3) **Yêu cầu bổ sung**: Ghi rõ giấy tờ cần thêm. (4) **Chạy lại pipeline (`[PIPE-10]`)**: Khi sinh viên đính chính OCR. |

---

## 4. 🖥️ UI/UX Specification (`O03`)

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│ 📄 MINH CHỨNG GỐC (Zoom: [ 100% ▾ ] 🔄)│ 👤 Nguyễn Văn A · MSSV: 102210xxx     │
├───────────────────────────────────────┼───────────────────────────────────────┤
│                                       │ 🏷️ Trạng thái: 🛡️ VERIFIED (Cấp L2)   │
│  ┌─────────────────────────────────┐  │                                       │
│  │   ĐOÀN THANH NIÊN TRƯỜNG ĐHBK   │  │ 🔍 XÁC MINH HAI CÂU HỎI ĐỘC LẬP:      │
│  │                                 │  │ 1. Hoạt động có tồn tại?  🟢 ĐẠT (Đoàn)│
│  │     GIẤY CHỨNG NHẬN             │  │ 2. Sinh viên tham gia?    🟢 ĐẠT (DS)  │
│  │ Trao tặng: Nguyễn Văn A         │  │                                       │
│  │ Đã tham gia: Mùa hè xanh 2026   │  │ 🤖 AI ĐỀ XUẤT (PhoBERT - Conf: 94%):  │
│  │ Vai trò: Tình nguyện viên       │  │ Tiêu chí: 4.1 Tình nguyện cộng đồng   │
│  │                                 │  │ Điểm trần tiêu chí (Cap): 5.0 điểm     │
│  │       Đà Nẵng, 28/07/2026       │  │ Đề xuất: [ 5.0 ] điểm                 │
│  │          [DẤU ĐỎ ĐOÀN]          │  │                                       │
│  └─────────────────────────────────┘  │ ⚠️ Tín hiệu rủi ro: Không có (Ảnh sạch│
│                                       ├───────────────────────────────────────┤
│                                       │ ⚖️ RA QUYẾT ĐỊNH XÉT DUYỆT:           │
│                                       │ [✓ Duyệt 5.0đ]  [✏️ Sửa điểm]          │
│                                       │ [📎 Yêu cầu bổ sung]  [✖ Từ chối]     │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 5.1 `[REV-03]` Khóa hồ sơ khi bắt đầu duyệt
- **POST** `/api/v1/evidence/{id}/lock`

### 5.2 `[REV-01]` Ra quyết định xét duyệt
- **POST** `/api/v1/evidence/{id}/review`
- **Headers**: `Idempotency-Key: <uuid>`

**Request Body (Phê duyệt):**
```json
{
  "action": "APPROVE",
  "final_score": 5.0,
  "criterion_id": "cri_iv_1",
  "note": "Minh chứng hợp lệ, có xác nhận từ Đoàn thanh niên.",
  "expected_version": 1
}
```

**Request Body (Từ chối — Bắt buộc căn cứ cụ thể):**
```json
{
  "action": "REJECT",
  "reject_basis": "OUTSIDE_TERM_WINDOW",
  "reason": "Hoạt động diễn ra vào tháng 3/2025, nằm ngoài khung thời gian học kỳ 1 (2026-2027) đang xét.",
  "expected_version": 1
}
```

### 5.3 `[PIPE-10]` Chạy lại pipeline phân tích
- **POST** `/api/v1/evidence/{id}/rerun`
```json
{ "step": "FULL_PIPELINE" }
```
