# Phân công công việc EduPoint

Cập nhật 22/09/2026: **ưu tiên hoàn thiện Backend và Frontend trước; người C làm AI độc lập, tích hợp sau khi đạt điều kiện bàn giao**.

| Người | Sở hữu | Backlog |
|---|---|---|
| A | Backend, database, auth/storage, Rule Engine, worker, audit, API và vận hành | **[Kế hoạch riêng Backend](../06-ke-hoach-trien-khai/01-ke-hoach-backend.md)** |
| B | Web Officer/Admin + Mobile Student, UI/UX, API client và E2E | **[Kế hoạch riêng Frontend](../06-ke-hoach-trien-khai/02-ke-hoach-frontend.md)** |
| C | Dataset, PhoBERT/FastAPI, OCR/extraction, RAG, AI adapters và thí nghiệm | **[Task riêng người C](../06-ke-hoach-trien-khai/04-task-rieng-nguoi-c-ai.md)** |

Xem [kế hoạch tổng và các giai đoạn](../06-ke-hoach-trien-khai/README.md), [ma trận 37 trang](../06-ke-hoach-trien-khai/06-ma-tran-pham-vi.md) và [điều kiện tích hợp AI](../06-ke-hoach-trien-khai/05-tich-hop-ai-va-nghiem-thu.md).

A/B ghép FE–BE liên tục từ giai đoạn nền tảng; không chờ AI. C bàn giao contract/fixture sớm, code và kết quả đánh giá sau. Rule Engine thuộc A và chạy ngay trong bản Core. Tất cả task triển khai hiện ở trạng thái chưa làm; file placeholder không được tính là chức năng hoàn tất.
