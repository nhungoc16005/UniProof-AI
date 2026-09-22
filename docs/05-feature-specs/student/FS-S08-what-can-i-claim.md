# FS-S08 — Gợi ý Tích lũy Điểm ("What Can I Claim?")

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S08`** | **`[SCO-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Phân loại: **[ADV]** (Tính năng nâng cao phân tích dữ liệu)

---

## 1. 🎯 Objective
Giải quyết câu hỏi thường trực của sinh viên vào cuối kỳ: *"Mình còn có thể kiếm thêm điểm rèn luyện ở đâu để lên loại Xuất sắc/Tốt?"*. Hệ thống tự động phân tích ma trận điểm hiện tại, đối chiếu với các mục đã chạm trần (Capped) và danh sách hoạt động sắp diễn ra để đưa ra lộ trình tích lũy điểm tối ưu nhất.

---

## 2. 👤 User Story
> **As a** sinh viên đang muốn cải thiện điểm rèn luyện lên mức Tốt hoặc Xuất sắc,
> **I want to** xem danh sách các tiêu chí mình chưa đủ điểm và các hoạt động khả dụng sắp tới,
> **so that** tôi không mất công nộp minh chứng vào những mục đã kịch trần và tập trung tham gia đúng hoạt động còn thiếu điểm.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Phân tích dung lượng điểm còn trống | Calculation | Tính toán số điểm còn có thể nhận thêm ở từng khung: $\text{Điểm còn trống} = \min(\text{Cap} - \text{Điểm đã đạt}, \text{Tổng còn thiếu})$. |
| AC-2 | Cảnh báo mục đã kịch trần (Locked) | Visual Alert | Đánh dấu biểu tượng khóa 🔒 với các tiêu chí/khung đã đạt tối đa (VD: Khung II đã đạt 25/25 $\rightarrow$ Cảnh báo: *"Đã đạt trần, nộp thêm giấy khen ở mục này sẽ không được cộng thêm điểm"*). |
| AC-3 | Gợi ý hoạt động sắp diễn ra | Smart Matching | Liệt kê các hoạt động nội bộ sắp tổ chức thuộc đúng các tiêu chí sinh viên đang khuyết điểm, kèm nút **[Đăng ký tham gia ngay]**. |
| AC-4 | Ước tính kịch bản điểm (Simulation) | Interactive | Cho phép sinh viên tick chọn các hoạt động dự kiến tham gia để xem điểm tổng kỳ sẽ nhảy lên bao nhiêu (VD: "Nếu tham gia Hiến máu + Giải chạy $\rightarrow$ Tổng điểm dự kiến: 88 điểm — Loại Tốt"). |

---

## 4. 🖥️ UI/UX Specification (`S08`)

```
┌─────────────────────────────────────────────────────────────┐
│ [← Trang chủ]        CÒN CÓ THỂ TÍCH LŨY GÌ?                │
├─────────────────────────────────────────────────────────────┤
│  🎯 MỤC TIÊU CỦA BẠN:                                       │
│  Hiện tại: 82.5 (Tốt) ──[ Cần thêm +7.5 điểm ]──> 90 (XUẤT SẮC)
├─────────────────────────────────────────────────────────────┤
│  💡 CÁC MỤC CÒN DƯ DUNG LƯỢNG ĐIỂM:                         │
│                                                             │
│  1. Khung III: Hoạt động Văn thể mỹ / Hội nhập (Còn +8.0 đ) │
│     👉 Hoạt động gợi ý:                                     │
│        • Ngày hội Văn hóa Quốc tế (15/10) ──> [+3.0 điểm]   │
│          [ Đăng ký tham gia ]                               │
│                                                             │
│  2. Khung IV: Phẩm chất công dân & Xã hội (Còn +4.0 đ)      │
│     👉 Hoạt động gợi ý:                                     │
│        • Hiến máu nhân đạo Đợt 2 (20/10) ──> [+5.0 điểm]    │
│          [ Đăng ký tham gia ]                               │
│                                                             │
│  ⛔ CÁC MỤC ĐÃ KỊCH TRẦN (KHÔNG NÊN NỘP THÊM):              │
│  🔒 Khung II: Chấp hành nội quy, quy chế (25 / 25 điểm)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[SCO-03]` Gợi ý các mục điểm sinh viên có thể nhận thêm
- **GET** `/api/v1/students/{id}/what-can-i-claim?term_id={termId}`
- **Auth**: Bearer `<access_token>`

**Response (200 OK):**
```json
{
  "data": {
    "student_id": "u_8f2c1a9e",
    "current_total_score": 82.5,
    "target_grade": "XUẤT SẮC",
    "points_needed_for_target": 7.5,
    "claimable_categories": [
      {
        "category": "III",
        "name": "Hoạt động chính trị - xã hội",
        "current_score": 12.0,
        "max_cap": 20.0,
        "remaining_capacity": 8.0,
        "recommended_activities": [
          {
            "id": "act_intl_day",
            "name": "Ngày hội Văn hóa Quốc tế 2026",
            "date": "2026-10-15",
            "potential_score": 3.0,
            "registration_url": "https://..."
          }
        ]
      }
    ],
    "capped_categories": [
      { "category": "II", "name": "Chấp hành quy chế", "score": 25.0, "max_cap": 25.0 }
    ]
  },
  "request_id": "req_sco_03"
}
```
