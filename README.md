
# EduPoint

Hệ thống hỗ trợ đánh giá điểm rèn luyện theo kỳ: sinh viên tự đánh giá và nộp minh chứng, Khoa thẩm định/chốt/gửi kết quả, CTSV công bố/phúc khảo/hiệu chỉnh/chốt kỳ. AI hỗ trợ gợi ý; điểm chính thức theo quyết định người có quyền.

Tài liệu bắt đầu tại **[docs/README.md](docs/README.md)**. Hướng dẫn làm việc cho Codex ở **[AGENTS.md](AGENTS.md)**.

| Thành phần | Nguồn |
|---|---|
| Web React/Vite/TypeScript | [apps/web](apps/web) |
| NestJS API, JWT và Prisma | [apps/backend](apps/backend) |
| Schema/migrations PostgreSQL | [apps/backend/prisma](apps/backend/prisma) |
| Mobile/AI/research scaffold | Xem phân loại trong [kiến trúc](docs/PROJECT_OVERVIEW.md) |

Đọc [workflow](docs/PROJECT_OVERVIEW.md), [quy tắc](docs/BUSINESS_RULES.md), [API](docs/API_CONTRACT.md), [feature specs](docs/README.md), [audit/backlog](docs/BACKLOG.md) và [test plan](docs/TEST_PLAN.md) trước khi thay đổi. Sau mỗi công việc, cập nhật docs liên quan và [CHANGELOG](docs/CHANGELOG.md).

Script build/dev nằm trong package.json từng ứng dụng; root chưa có orchestration hoàn chỉnh. Backend khởi động worker poll DB/gọi AI, nên không start chỉ để audit hoặc xem tài liệu. Kiểm tra thuần được chỉ dẫn tại TEST_PLAN; không dùng `npm test` backend trong audit vì có integration ghi fixture.

Bộ tài liệu khởi tạo2026-11-15 không sửa application code hoặc dữ liệu; các finding audit vẫn mở và cần xử lý theo công việc được giao.
