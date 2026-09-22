# FS-A09 — Đánh giá Chất lượng Mô hình AI (Evaluation Dashboard)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A09`** | **`[ADM-EVAL-01]` đến `[ADM-EVAL-05]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Phục vụ phân tích thực nghiệm & nghiệm thu đồ án). Phân loại: **[ADV]**

---

## 1. 🎯 Objective
Cung cấp bảng điều khiển đo lường hiệu năng kỹ thuật chuyên sâu của hệ thống AI: Hiển thị các chỉ số đánh giá của mô hình PhoBERT (Accuracy, Precision, Recall, Macro-F1), Ma trận nhầm lẫn (Confusion Matrix), Biểu đồ tương quan giữa độ bao phủ và rủi ro (*Selective Prediction: Coverage vs. Risk curve*), và bảng so sánh kết quả thực nghiệm (*Ablation Study* giữa Baseline TF-IDF vs PhoBERT vs Claude Zero-shot).

---

## 2. 👤 User Story
> **As an** kỹ sư phát triển mô hình / Thành viên bảo vệ đồ án,
> **I want to** mở bảng điều khiển đo lường và theo dõi biểu đồ Macro-F1 cùng ma trận nhầm lẫn trực tiếp trên web,
> **so that** tôi trình chiếu và chứng minh tính hiệu quả của mô hình PhoBERT trước hội đồng chấm phản biện.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Bảng chỉ số tổng quan | Metrics | Macro-F1 ($\ge 0.85$), Weighted-F1, Accuracy toàn cục trên tập Test. |
| AC-2 | Ma trận nhầm lẫn (Confusion Matrix) | Heatmap | Biểu đồ nhiệt hiển thị tỷ lệ dự đoán đúng/sai giữa các lớp nhãn (Khung I đến V). Bấm vào từng ô để xem danh sách các mẫu dự đoán sai (*Hard cases / Error analysis*). |
| AC-3 | Đồ thị Selective Prediction | Risk Analysis | Biểu đồ đường cong biểu diễn sự đánh đổi giữa: Tỷ lệ tự động hóa (Coverage) $\leftrightarrow$ Tỷ lệ lỗi (Error rate) khi thay đổi ngưỡng tin cậy `confidence_threshold`. |
| AC-4 | Chạy đánh giá theo yêu cầu | Benchmark | Nút **[Chạy đánh giá lại trên tập Test (`[ADM-EVAL-02]`)]** để kiểm tra phiên bản trọng số mới của model. |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-EVAL-01]` `GET /api/v1/admin/ai-evaluation/dashboard` (Lấy toàn bộ chỉ số metrics)
- `[ADM-EVAL-02]` `POST /api/v1/admin/ai-evaluation/run` (Kích hoạt job đánh giá mô hình)
- `[ADM-EVAL-03]` `GET /api/v1/admin/ai-evaluation/confusion-matrix` (Dữ liệu ma trận nhầm lẫn)
- `[ADM-EVAL-04]` `GET /api/v1/admin/ai-evaluation/ablation-results` (Bảng so sánh Baseline vs PhoBERT vs LLM)
- `[ADM-EVAL-05]` `GET /api/v1/admin/ai-evaluation/error-samples?true_label={t}&pred_label={p}`

**Response mẫu `[ADM-EVAL-01]`:**
```json
{
  "data": {
    "model_name": "vinai/phobert-base-v2-finetuned",
    "test_set_size": 450,
    "metrics": {
      "accuracy": 0.892,
      "macro_f1": 0.876,
      "weighted_f1": 0.890
    },
    "by_class": [
      { "category": "I", "precision": 0.91, "recall": 0.88, "f1": 0.89 },
      { "category": "II", "precision": 0.94, "recall": 0.92, "f1": 0.93 },
      { "category": "III", "precision": 0.84, "recall": 0.86, "f1": 0.85 },
      { "category": "IV", "precision": 0.88, "recall": 0.85, "f1": 0.86 },
      { "category": "V", "precision": 0.86, "recall": 0.84, "f1": 0.85 }
    ]
  },
  "request_id": "req_adm_eval_01"
}
```
