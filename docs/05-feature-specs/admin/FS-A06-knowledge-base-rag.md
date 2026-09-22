# FS-A06 — Quản lý Knowledge Base Quy chế (Kho Tri thức RAG)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`A06`** | **`[ADM-KB-01]` đến `[ADM-KB-06]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: ADMINISTRATOR (Admin kiêm Quản lý quy định). Quyền: **ADMIN only**. Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Quản lý vòng đời các tài liệu quy định, quy chế điểm rèn luyện chính thức của nhà trường (PDF/DOCX) làm nguồn dữ liệu tri thức (Knowledge Base) phục vụ hệ thống **RAG (Retrieval-Augmented Generation)**: Tải lên văn bản, kích hoạt tiến trình băm nhỏ thành các đoạn văn bản (Chunks) theo đúng Điều/Khoản, tạo vector embeddings và lưu trữ vào `pgvector`.

---

## 2. 👤 User Story
> **As an** quản trị viên,
> **I want to** tải lên file PDF quy chế mới ban hành và bấm nút lập chỉ mục (Indexing),
> **so that** trợ lý ảo RAG tự động học nội dung mới và trả lời sinh viên dựa trên đúng văn bản đó.

---

## 3. ✅ Acceptance Criteria

| # | Tiêu chí | Loại | Chi tiết |
|---|---|---|---|
| AC-1 | Quản lý Tài liệu | Display | Bảng danh sách văn bản quy định: Tên văn bản, Số hiệu (Quyết định số...), Ngày ban hành, Trạng thái (`ACTIVE` / `EXPIRED`), Số lượng chunks, Dung lượng file. |
| AC-2 | Upload & Indexing Pipeline | Background | Upload file PDF/DOCX (max 20MB) qua `[ADM-KB-02]`. Server kích hoạt tiến trình nền: Đọc văn bản $\rightarrow$ Tách đoạn theo cấu trúc Điều/Khoản $\rightarrow$ Sinh Vector Embeddings qua Claude/OpenAI $\rightarrow$ Lưu vào PostgreSQL `pgvector`. |
| AC-3 | Trạng thái Indexing | Progress | Hiển thị tiến trình xử lý: `UPLOADING` $\rightarrow$ `PARSING` $\rightarrow$ `EMBEDDING` $\rightarrow$ `INDEXED` (kèm thanh progress bar). |
| AC-4 | Đánh dấu hết hiệu lực (Deprecate) | Lifecycle | Khi có quy chế mới, đánh dấu quy chế cũ là `EXPIRED` (`[ADM-KB-04]`). Các chunks của văn bản hết hiệu lực sẽ bị loại bỏ khỏi vector search của chatbot. |
| AC-5 | Xem trước Chunks | Inspection | Cho phép Cán bộ xem danh sách các chunks và vector id để kiểm tra chất lượng phân đoạn (`[ADM-KB-05]`). |

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[ADM-KB-01]` `GET /api/v1/admin/knowledge-base/documents`
- `[ADM-KB-02]` `POST /api/v1/admin/knowledge-base/documents` (Upload file PDF)
- `[ADM-KB-03]` `POST /api/v1/admin/knowledge-base/documents/{id}/index` (Kích hoạt Indexing nền)
- `[ADM-KB-04]` `PATCH /api/v1/admin/knowledge-base/documents/{id}/status` (Đổi trạng thái: `ACTIVE`, `EXPIRED`)
- `[ADM-KB-05]` `GET /api/v1/admin/knowledge-base/documents/{id}/chunks?page=1&limit=50`
- `[ADM-KB-06]` `DELETE /api/v1/admin/knowledge-base/documents/{id}`
