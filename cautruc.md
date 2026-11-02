# Cấu trúc EduPoint đang triển khai — 02/11/2026

Nguồn đối chiếu: mã nguồn hiện tại. Tài liệu nghiệp vụ và nghiệm thu: [bàn giao Khoa/CTSV](docs/07-hien-trang-he-thong/FACULTY_ADMIN_HANDOFF_2026-11-02.md).

```text
PBL6/
├── apps/backend/                 NestJS + Prisma; JWT, PostgreSQL và Storage Supabase
│   ├── prisma/schema.prisma      Schema nguồn; dùng migrations để cập nhật Supabase
│   ├── prisma/migrations/        Lịch sử migration có thứ tự; không reset database thật
│   ├── src/
│   │   ├── auth/                 Đăng nhập JWT, kiểm tra tài khoản hiện hành mỗi request
│   │   ├── users/                Tài khoản, import, phân công Khoa/lớp
│   │   ├── criteria/             Kỳ, Khoa/lớp, rubric phiên bản, quy chế, công thức điểm
│   │   ├── assessments/          Tự đánh giá, nộp/trả phiếu, xác minh và chốt tiêu chí
│   │   ├── evaluation-workflow/   Phạm vi Khoa theo kỳ, gửi/trả, công bố, chốt, export
│   │   ├── evidence/             Minh chứng, tải tệp Supabase, bổ sung, worker dữ liệu nền
│   │   ├── reviews/              Thẩm định, khóa hồ sơ, yêu cầu bổ sung, nguồn xác minh
│   │   ├── activities/           Hoạt động và điểm danh có lịch sử
│   │   ├── appeals/              Phúc khảo kết quả đã công bố
│   │   ├── conduct-scores/       Bảng điểm Student và tra cứu kết quả
│   │   ├── reports/              Báo cáo từ danh sách kỳ và bản công bố
│   │   ├── audit-log/            Tra cứu nhật ký và trạng thái dịch vụ
│   │   ├── notifications/        Thông báo nghiệp vụ
│   │   └── common/               Guard, interceptor, filter và Prisma service
│   ├── scripts/check-workflow-integrity.cjs  Preflight chỉ đọc, chỉ xuất số lượng lỗi
│   └── test/                     Unit, API PostgreSQL và Chrome smoke
├── apps/web/                     React + Vite + Tailwind + lucide-react
│   └── src/
│       ├── routes.tsx            Phân hệ Student / officer (Khoa) / admin (CTSV)
│       ├── layouts/AppLayout.tsx Menu theo quyền và bộ chọn kỳ
│       ├── pages/student/        Chấm điểm, minh chứng, bổ sung, phúc khảo
│       ├── pages/officer/        Tổng quan, phiếu, minh chứng, hoạt động, phúc khảo
│       ├── pages/admin/          Tổng quan, tiếp nhận, tài khoản, kỳ, rubric, quy chế
│       ├── components/           EvaluationBoard, ResultReports, EvidenceInspection
│       ├── lib/apiClient.ts      API thật; các dạng envelope được đọc đúng
│       └── types/index.ts        Kiểu dữ liệu, trạng thái và quyền thao tác
├── apps/mobile/                  Nằm ngoài đợt hoàn thiện Web này
├── apps/ai-service/               Phần AI để tích hợp sau
├── packages/ai-core/              Mã AI nghiên cứu/tích hợp; không phải nguồn điểm chính thức
├── research/                     Nghiên cứu và thực nghiệm AI
└── docs/                         Tài liệu hiện trạng, đặc tả và kế hoạch
```

## Quyết định kiến trúc hiện hành

- Ba role database: `STUDENT`, `STAFF`, `ADMIN`; không có enum role `FACULTY` hoặc `OFFICER`.
- Khoa là đơn vị quản lý; `STAFF` ở `/officer`. `ADMIN` kiêm CTSV ở `/admin`.
- API gốc `/api`, Swagger `/api/docs`; backend chính là NestJS, không phải FastAPI.
- PostgreSQL/Storage vẫn là Supabase. Database PostgreSQL riêng chỉ phục vụ kiểm thử có ghi dữ liệu.
- Worker hiện đọc job bền vững từ database; không mặc định BullMQ/Redis đã vận hành.
- Rule Engine là công thức nghiệp vụ trong `criteria/rubric-scoring.ts`; giao diện quản trị nằm trong Bộ tiêu chí.
- AI là giai đoạn cuối. Trang cấu hình localStorage và số liệu đánh giá hardcode đã được loại bỏ; các trang AI nâng cao không nằm trong navigation chính.
