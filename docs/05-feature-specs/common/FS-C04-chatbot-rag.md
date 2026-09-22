# FS-C04 — Hỏi đáp Quy chế Điểm Rèn luyện (RAG Chatbot)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`C04`** | **`[RAG-01]` `[RAG-02]` `[RAG-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Phạm vi**: Dùng chung cho Sinh viên (hỏi quy định để nộp bài đúng) và Cán bộ (tra cứu nhanh điều khoản khi duyệt). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp trợ lý ảo thông minh trả lời các thắc mắc về quy định, quy chế điểm rèn luyện dựa trên kỹ thuật **RAG (Retrieval-Augmented Generation)**. Mọi câu trả lời bắt buộc phải trích dẫn căn cứ điều khoản cụ thể từ tài liệu chính thức của nhà trường, tuyệt đối không bịa đặt kiến thức (*hallucination*).

---

## 2. 👤 User Stories
- **As a** Sinh viên,
  **I want to** hỏi chatbot về các hoạt động của mình (VD: "Hiến máu được cộng bao nhiêu điểm ở mục nào?"),
  **so that** tôi biết cách chọn tiêu chí và chuẩn bị minh chứng phù hợp trước khi nộp.
- **As a** Cán bộ duyệt,
  **I want to** tra cứu nhanh quy định khống chế trần điểm hoặc điều kiện ngoại lệ,
  **so that** tôi ra quyết định phê duyệt chính xác và tự tin.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | **Truy xuất ngữ cảnh chính xác** | RAG Core | Vector search qua `pgvector` lấy top-k đoạn văn bản quy chế có cosine similarity $\ge 0.70$. |
| AC-2 | **Trích dẫn bắt buộc (Citations)** | Precision | Mọi câu trả lời đều đính kèm chip trích dẫn: Tên văn bản, Điều/Khoản, Số trang. Bấm vào chip mở bản xem trước tài liệu tại đúng vị trí trích dẫn. |
| AC-3 | **Từ chối trả lời ngoài phạm vi (Abstention)** | Safety | Nếu độ tương đồng dưới ngưỡng hoặc câu hỏi không liên quan quy chế $\rightarrow$ chatbot trả lời lịch sự: *"Quy chế hiện hành không có thông tin về vấn đề này. Bạn vui lòng liên hệ trực tiếp Phòng CTSV để được giải đáp."* |
| AC-4 | **Lịch sử & Phản hồi (Feedback)** | UX/Audit | Lưu lịch sử hội thoại (`[RAG-02]`), cho phép người dùng đánh giá Thích (👍) / Không thích (👎) kèm lý do (`[RAG-03]`). |

---

## 4. 🖥️ UI/UX Specification (`C04`)

```
┌─────────────────────────────────────────────────────────────┐
│  💬 Trợ lý Quy chế Điểm Rèn luyện (EduPoint Bot)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Bot] Xin chào! Tôi có thể hỗ trợ bạn tra cứu quy chế...   │
│                                                             │
│  [User] Tham gia giải bóng đá trường được cộng mấy điểm?   │
│                                                             │
│  [Bot] Theo quy chế rèn luyện, hoạt động giải bóng đá       │
│        thuộc Khung III (Tiêu chí 3.1 - Thể dục thể thao):   │
│        • Vận động viên tham gia: +3.0 điểm                 │
│        • Thành viên Ban tổ chức: +4.0 điểm                  │
│        • Cổ động viên (có điểm danh): +1.0 điểm             │
│                                                             │
│        📎 Căn cứ trích dẫn:                                 │
│        ┌─────────────────────────────────────────────────┐  │
│        │ 📄 Quyết định 1234/QĐ-ĐHBK · Điều 8, Khoản 2    │  │
│        └─────────────────────────────────────────────────┘  │
│        [👍 Hữu ích]  [👎 Chưa đúng]                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [ Nhập câu hỏi về quy chế...                            ] [➤]│
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 5.1 `[RAG-01]` Đặt câu hỏi hỏi đáp quy chế
- **POST** `/api/v1/rag/query`
- **Auth**: Bearer `<access_token>`

**Request Body:**
```json
{
  "question": "Tham gia hiến máu nhân đạo được cộng bao nhiêu điểm?",
  "context": {
    "term_id": "term_2026_1",
    "faculty_id": "fac_cntt"
  }
}
```

**Response (200 OK):**
```json
{
  "data": {
    "answer": "Tham gia hiến máu tình nguyện được cộng 5.0 điểm vào Tiêu chí 4.1 (Hoạt động vì cộng đồng). Mức điểm này được áp dụng một lần cho mỗi đợt hiến máu...",
    "answer_status": "CONFIRMED",
    "citations": [
      {
        "document_id": "doc_qc_2026",
        "document_name": "Quy chế Đánh giá ĐRL Sinh viên 2026",
        "article": "Điều 9",
        "clause": "Khoản 1b",
        "page_number": 14,
        "matched_text": "Sinh viên tham gia hiến máu nhân đạo được cộng tối đa 5 điểm/lần..."
      }
    ],
    "suggested_criteria_id": "cri_iv_1"
  },
  "request_id": "req_rag_01"
}
```

### 5.2 `[RAG-02]` Lịch sử hội thoại
- **GET** `/api/v1/rag/history?page=1&limit=20`

### 5.3 `[RAG-03]` Gửi phản hồi chất lượng câu trả lời
- **POST** `/api/v1/rag/feedback`
```json
{
  "query_id": "rag_q_8812",
  "is_helpful": true,
  "comment": "Trích dẫn rất chuẩn xác"
}
```

---

## 6. ⚠️ Error Handling
- `RATE_LIMITED`: Vượt quá 20 lượt hỏi/ngày đối với sinh viên $\rightarrow$ "Bạn đã dùng hết lượt hỏi đáp quy chế hôm nay."
- `NO_EVIDENCE`: Không tìm thấy điều khoản tương tự $\rightarrow$ Trả lời `answer_status: "NO_EVIDENCE"` kèm lời khuyên liên hệ Cán bộ CTSV.
