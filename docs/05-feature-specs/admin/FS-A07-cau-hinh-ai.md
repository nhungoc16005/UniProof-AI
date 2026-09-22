# FS-A07 — Cấu hình Tham số AI & Ngưỡng Quyết định

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A07`** | **`[ADM-AI-01]` `[ADM-AI-02]` `[ADM-AI-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Quản trị viên Hệ thống). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp bảng điều khiển cấu hình các siêu tham số (Hyper-parameters) và ngưỡng tin cậy (Confidence Thresholds) của các mô hình AI: Ngưỡng tự động chấp nhận đề xuất PhoBERT, ngưỡng chuyển Cán bộ xem xét (`abstention_threshold`), ngưỡng tương đồng cosine của RAG, thời hạn xử lý SLA (giờ), và hạn ngạch tra cứu chatbot/ngày.

---

## 2. 👤 User Story
> **As an** quản trị viên,
> **I want to** điều chỉnh ngưỡng confidence của mô hình AI trực tiếp trên giao diện mà không phải sửa code hay restart server,
> **so that** tôi kiểm soát được tỷ lệ hồ sơ chuyển Cán bộ duyệt theo từng giai đoạn thử nghiệm.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Bảng tham số AI (`[ADM-AI-01]`):
  - `ai_confidence_auto_threshold`: Mặc định 0.85 (>= ngưỡng này $\rightarrow$ Gợi ý Fast-track).
  - `ai_abstention_threshold`: Mặc định 0.70 (< ngưỡng này $\rightarrow$ Mô hình tự từ chối đưa ra kết luận, chuyển `NEEDS_HUMAN_REVIEW`).
  - `rag_similarity_threshold`: Mặc định 0.75 (Dưới ngưỡng này $\rightarrow$ Chatbot trả lời "Không tìm thấy quy định").
  - `sla_timeout_hours`: Mặc định 48 giờ.
  - `max_appeals_per_evidence`: Mặc định 2 lần.
- **AC-2**: Cập nhật cấu hình (`[ADM-AI-02]`): Validate miền giá trị hợp lệ ($0.0 \le \text{Threshold} \le 1.0$), lưu thay đổi có hiệu lực ngay lập tức.
- **AC-3**: Khôi phục mặc định (`[ADM-AI-03]`): Nút "Khôi phục cài đặt gốc" an toàn.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-AI-01]` `GET /api/v1/admin/ai-config`
- `[ADM-AI-02]` `PUT /api/v1/admin/ai-config`
```json
{
  "ai_confidence_auto_threshold": 0.85,
  "ai_abstention_threshold": 0.70,
  "rag_similarity_threshold": 0.75,
  "sla_timeout_hours": 48,
  "max_appeals_per_evidence": 2,
  "rag_daily_quota_per_student": 20
}
```
- `[ADM-AI-03]` `POST /api/v1/admin/ai-config/reset`
