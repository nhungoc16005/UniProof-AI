# FS-S01 — Tổng quan Điểm Rèn luyện (Dashboard Sinh viên)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S01`** | **`[SCO-01]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp màn hình trang chủ cá nhân cho sinh viên ngay sau khi đăng nhập: Hiển thị tổng điểm rèn luyện tạm tính học kỳ hiện tại, xếp loại dự kiến (Xuất sắc/Tốt/Khá/Trung bình/Yếu), và thanh tiến độ chi tiết theo 5 khung tiêu chí (Khung I đến V) kèm mức điểm trần (Cap).

---

## 2. 👤 User Story
> **As a** sinh viên,
> **I want to** mở app là thấy ngay tổng điểm hiện tại và tiến độ từng khung tiêu chí,
> **so that** tôi biết mình đang thiếu điểm ở khung nào để chủ động tham gia hoạt động bổ sung.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Điểm tổng kỳ & Xếp loại | Display | Hiển thị tổng điểm (thang 100), xếp loại tạm tính theo quy chế (>=90: Xuất sắc, >=80: Tốt, >=65: Khá, >=50: TB, <50: Yếu). |
| AC-2 | Tiến độ 5 Khung tiêu chí | Progress | Hiển thị 5 thanh tiến độ: Khung I (Ý thức học tập - max 20), Khung II (Quy chế - max 25), Khung III (Chính trị/XH - max 20), Khung IV (Phẩm chất công dân - max 25), Khung V (Hoạt động lớp/Đoàn - max 10). |
| AC-3 | Cảnh báo trần điểm (Cap) | Logic | Khi điểm cộng vượt mức trần khung, hiển thị điểm thực nhận = Cap kèm ghi chú trực quan (VD: "Đã đạt tối đa 20/20 điểm"). |
| AC-4 | Tách bạch điểm chính thức & đề xuất | AI Principle | Điểm đã duyệt hiển thị nét liền. Điểm AI đang đề xuất hiển thị nét đứt kèm biểu tượng ✦ để không gây hiểu nhầm. |

---

## 4. 🖥️ UI/UX Specification (`S01`)

```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Nguyễn Văn A · 21TCLC_DT1                  🔔 (3) [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│ 🏆 ĐIỂM RÈN LUYỆN TẠM TÍNH — HỌC KỲ 1 (2026–2027)            │
│                                                             │
│                ┌─────────────────────────┐                  │
│                │      82.5 / 100         │                  │
│                │    Xếp loại: 🟢 TỐT    │                  │
│                └─────────────────────────┘                  │
│  [Đã chốt: 78.5]              [✦ AI đề xuất: +4.0 điểm]     │
├─────────────────────────────────────────────────────────────┤
│ 📊 TIẾN ĐỘ THEO 5 KHUNG TIÊU CHÍ                            │
│                                                             │
│ Khung I: Ý thức học tập           [████████████░░] 16 / 20  │
│ Khung II: Chấp hành quy chế       [██████████████] 25 / 25 🔒│
│ Khung III: Hoạt động CT-XH        [████████░░░░░░] 12 / 20  │
│ Khung IV: Phẩm chất công dân      [████████████░░] 21 / 25  │
│ Khung V: Phụ trách lớp / Đoàn     [██████████░░░░]  8 / 10  │
│                                                             │
│ [ 🚀 NỘP MINH CHỨNG NGAY (S03) ]  [ 💡 GỢI Ý ĐIỂM (S08) ]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### `[SCO-01]` Lấy tổng quan điểm kỳ hiện tại của sinh viên
- **Method & Path**: `GET /api/v1/scores/my/current`
- **Auth**: Bearer `<access_token>` (Role: `STUDENT`)

**Response (200 OK):**
```json
{
  "data": {
    "term": { "id": "term_2026_1", "name": "Học kỳ 1 (2026-2027)" },
    "official_score": 78.5,
    "suggested_score": 4.0,
    "total_estimated_score": 82.5,
    "estimated_grade": "TỐT",
    "criteria_progress": [
      { "category": "I", "name": "Ý thức học tập", "earned": 16.0, "max_cap": 20.0, "is_capped": false },
      { "category": "II", "name": "Chấp hành quy chế", "earned": 25.0, "max_cap": 25.0, "is_capped": true },
      { "category": "III", "name": "Hoạt động chính trị - xã hội", "earned": 12.0, "max_cap": 20.0, "is_capped": false },
      { "category": "IV", "name": "Phẩm chất công dân", "earned": 21.0, "max_cap": 25.0, "is_capped": false },
      { "category": "V", "name": "Hoạt động lớp, Đoàn thể", "earned": 8.0, "max_cap": 10.0, "is_capped": false }
    ],
    "pending_evidence_count": 2
  },
  "request_id": "req_sco_01"
}
```

---

## 6. ⚠️ Error Handling
- `TERM_NOT_FOUND`: Trường chưa mở kỳ đánh giá $\rightarrow$ Empty state: *"Chưa có kỳ đánh giá nào đang hoạt động."*
- `NETWORK_ERROR`: Mất kết nối $\rightarrow$ Hiển thị dữ liệu lưu trong local cache kèm nhãn *"Dữ liệu ngoại tuyến"*.
