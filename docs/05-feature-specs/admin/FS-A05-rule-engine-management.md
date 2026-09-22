# FS-A05 — Quản trị Rule Engine (Bộ Quy tắc Điểm & Logic Chốt chặn)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A05`** | **`[ADM-RUL-01]` đến `[ADM-RUL-07]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Admin kiêm Quản lý quy định). Ưu tiên: **[MVP soạn/publish · ADV mô phỏng/phiên bản]**

---

## 1. 🎯 Objective
Quản lý bộ quy tắc logic tường minh (Rule Engine) độc lập với LLM: Định nghĩa các luật khống chế điểm bằng cấu hình linh hoạt (*Config-driven* / JSON Logic), bao gồm: Giới hạn trần điểm tích lũy, điều kiện tiên quyết, khống chế tỷ lệ điểm cổ vũ/tham gia (mục 9, 10), phát hiện trùng lặp, và hạn nộp minh chứng. Cung cấp môi trường **Chạy thử giả lập (Dry-run / Simulation)** trước khi ban hành chính thức (*Publish*).

---

## 2. 👤 User Story
> **As an** quản trị viên hệ thống,
> **I want to** cấu hình các công thức tính điểm phức tạp dạng JSON Logic và chạy thử trên tập dữ liệu mẫu,
> **so that** tôi đảm bảo Rule Engine hoạt động chuẩn xác 100% trước khi kích hoạt cho sinh viên toàn trường.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Danh sách Quy tắc | Display | Hiển thị toàn bộ rules: Tên rule, Tiêu chí áp dụng, Kiểu luật (Trần điểm / Điều kiện / Trùng lặp / Hạn nộp), Trạng thái (`DRAFT` / `PUBLISHED` / `ARCHIVED`). |
| AC-2 | Trình soạn thảo Rule (JSON Logic) | Editor | Giao diện kéo thả trực quan kết hợp Monaco Code Editor cho phép nhập cấu trúc JSON Logic chuẩn (`[ADM-RUL-02]`). |
| AC-3 | Chạy thử giả lập (Dry-run) | Testing | Nhập thông tin hồ sơ giả định (Họ tên, ngày tham gia, điểm đã có trong kỳ) $\rightarrow$ Nhấn **[Chạy thử]** (`[ADM-RUL-05]`): Trả về kết quả: Đạt/Không đạt, Điểm được nhận, Lý do giải thích. |
| AC-4 | Ban hành & Phiên bản (Publishing) | Versioning | Lưu lịch sử phiên bản (`[ADM-RUL-07]`). Khi publish rule mới (`[ADM-RUL-04]`), rule cũ được lưu trữ bất biến. |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-RUL-01]` `GET /api/v1/admin/rules?criterion_id={id}&status={st}`
- `[ADM-RUL-02]` `POST /api/v1/admin/rules` (Tạo bản nháp rule mới)
- `[ADM-RUL-03]` `PUT /api/v1/admin/rules/{id}` (Cập nhật rule)
- `[ADM-RUL-04]` `POST /api/v1/admin/rules/{id}/publish` (Kích hoạt rule chính thức)
- `[ADM-RUL-05]` `POST /api/v1/admin/rules/test` (Chạy thử giả lập trên payload mẫu)
- `[ADM-RUL-06]` `GET /api/v1/admin/rules/{id}/history` (Xem lịch sử thay đổi)
- `[ADM-RUL-07]` `POST /api/v1/admin/rules/{id}/rollback` (Quay lại phiên bản trước)

**Định dạng JSON Logic mẫu (`[ADM-RUL-02]`):**
```json
{
  "name": "RULE_CAP_CHEERLEADER_POINTS",
  "criterion_id": "cri_iii_1",
  "rule_type": "CAP_RESTRICTION",
  "condition": {
    "and": [
      { "==": [{ "var": "claimed_role" }, "CHEERLEADER"] },
      { ">=": [{ "var": "existing_cheerleader_score_in_term" }, 3.0] }
    ]
  },
  "action": {
    "allow": false,
    "max_score": 0.0,
    "reason": "Điểm cổ vũ hoạt động văn thể mỹ đã đạt trần tối đa 3.0 điểm trong kỳ này."
  }
}
```
