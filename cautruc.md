PBL6/
├── apps/
│   ├── backend/                       # NGƯỜI A — Backend + Database
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Schema PostgreSQL (Supabase) — đã fix cứng
│   │   │   ├── seed.ts                # Dữ liệu khởi tạo: tiêu chí I-V, khoa, lớp, đơn vị nội bộ mẫu
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── auth/                  # JWT/RBAC (STUDENT/STAFF/ADMIN), tích hợp Supabase Auth
│   │   │   ├── users/                 # User, Faculty, Class
│   │   │   ├── activities/            # Activity, ActivityParticipant
│   │   │   │   └── authority-check/   # Đối chiếu đơn vị tổ chức với danh sách nội bộ đã biết
│   │   │   │                          # (Đoàn TN, Hội SV, các Khoa, CLB) → quyết định INTERNAL/EXTERNAL
│   │   │   │                          # THUẦN RULE-BASED (string matching với CSDL) — KHÔNG đặt trong
│   │   │   │                          # ai-core vì không cần AI, chỉ là tra cứu dữ liệu có sẵn
│   │   │   ├── evidence/              # Evidence, EvidenceFile
│   │   │   │   ├── evidence.controller.ts
│   │   │   │   ├── evidence.service.ts
│   │   │   │   └── sub-resources/     # OcrResult, VerificationResult, AiSuggestion, AnomalyFlag
│   │   │   │                          # (đều khoá theo evidenceId, gộp chung 1 module)
│   │   │   ├── criteria/              # Criterion — CRUD tiêu chí khung I-V
│   │   │   ├── regulations/           # RegulationDocument, RegulationChunk (upload → gọi ai-core/rag
│   │   │   │                          # để tách đoạn + tạo embedding)
│   │   │   ├── reviews/               # Review, SupplementRequest — cán bộ duyệt/yêu cầu bổ sung
│   │   │   ├── appeals/               # Appeal — cán bộ xem & xử lý khiếu nại điểm
│   │   │   ├── conduct-scores/        # Tổng điểm rèn luyện theo học kỳ (điểm cuối, đã chốt)
│   │   │   ├── reports/               # Thống kê, xuất Excel cho trang Báo cáo
│   │   │   ├── storage/               # Upload/xoá file lên Supabase Storage
│   │   │   ├── rule-engine/           # Tính điểm theo công thức trường (tra bảng if-else),
│   │   │   │                          # chốt trần điểm (Cap), tính % cổ vũ (mục 9, 10)
│   │   │   ├── jobs/                  # BullMQ Worker — xử lý nền, không chặn request khi SV nộp
│   │   │   │   ├── queue.module.ts    # Kết nối Redis
│   │   │   │   └── processors/
│   │   │   │       └── evidence-processing.processor.ts
│   │   │   │           # Pipeline (gọi qua packages/ai-core):
│   │   │   │           # OCR → Extraction (Claude, gồm cả trường vai trò tham gia trích xuất
│   │   │   │           # từ minh chứng) → Classification (HTTP → apps/ai-service, PhoBERT)
│   │   │   │           # → Verification (Claude + rule, gồm so khớp vai trò SV khai vs vai trò
│   │   │   │           # trích xuất được) → Anomaly (Google Vision) → Rule Engine chốt điểm
│   │   │   ├── notifications/
│   │   │   ├── audit-log/
│   │   │   ├── common/                # guards, interceptors, decorators, filters
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   ├── railway.json               # Deploy Railway/Render
│   │   ├── .env.example               # + REDIS_URL, AI_SERVICE_URL
│   │   └── package.json
│   │
│   ├── ai-service/                    # NGƯỜI C — FastAPI, CHẠY THẬT — inference PhoBERT
│   │   ├── src/
│   │   │   ├── main.py                # POST /api/ai/classify — nhận text hoạt động, trả nhãn+confidence
│   │   │   ├── predictor.py           # Load model đã fine-tune & chạy inference
│   │   │   ├── tokenizer.py           # Tokenizer tiếng Việt riêng của PhoBERT
│   │   │   └── schemas.py             # Pydantic request/response
│   │   ├── model/                     # Weights sau fine-tune — copy từ research/ qua export_model.py
│   │   │   ├── config.json
│   │   │   ├── model.safetensors
│   │   │   └── tokenizer_config.json
│   │   ├── Dockerfile                 # Cần container hoá vì torch nặng
│   │   ├── requirements.txt           # torch, transformers, fastapi, uvicorn
│   │   └── .env.example
│   │
│   ├── web/                           # NGƯỜI B — Web (Cán bộ/Admin) — React + Vite + shadcn/ui
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login/
│   │   │   │   ├── Dashboard/
│   │   │   │   ├── EvidenceList/      # Split-view danh sách + panel duyệt, có tab lọc "Có khiếu nại"
│   │   │   │   ├── Activities/
│   │   │   │   ├── Criteria/
│   │   │   │   ├── Regulations/
│   │   │   │   ├── Reports/
│   │   │   │   ├── AuditLog/
│   │   │   │   ├── Accounts/
│   │   │   │   ├── Settings/
│   │   │   │   └── Categories/        # Danh mục dữ liệu nền (Khoa/Lớp/Đơn vị tổ chức)
│   │   │   ├── components/            # Button, Table, Badge, Modal, Split-view Panel
│   │   │   ├── layouts/               # Sidebar + layout chính + ProtectedRoute
│   │   │   ├── queries/               # React Query hooks (gọi API backend)
│   │   │   ├── hooks/
│   │   │   ├── lib/                   # api-client.ts, supabase-client.ts
│   │   │   ├── mocks/                 # Mock data — dùng ở giai đoạn đầu, không chờ backend
│   │   │   ├── routes.tsx
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── tests/
│   │   ├── vercel.json
│   │   └── package.json
│   │
│   └── mobile/                        # NGƯỜI B — App (Sinh viên) — React Native (Expo)
│       ├── app/
│       │   ├── login.tsx
│       │   ├── (tabs)/                # 4 tab: Trang chủ / Nộp / Hoạt động / Hỏi đáp
│       │   │   ├── home.tsx           # Dashboard cá nhân + tiến độ theo 5 khung điểm I-V
│       │   │   ├── submit.tsx         # Entry point → điều hướng vào stack submit-evidence
│       │   │   ├── my-activities.tsx
│       │   │   └── chat.tsx           # Chatbot hỏi đáp quy định (RAG)
│       │   ├── submit-evidence/       # Wizard 3 bước (stack riêng, không phải tab)
│       │   │   ├── step-1.tsx         # Chọn hoạt động
│       │   │   ├── step-2.tsx         # Chọn loại minh chứng + tải file
│       │   │   └── step-3.tsx         # Xác nhận thông tin (gồm vai trò SV tự khai) + Gửi
│       │   ├── evidence/[id].tsx      # Chi tiết + đề xuất AI + popup Khiếu nại
│       │   ├── notifications.tsx
│       │   └── profile.tsx            # Gồm cả Cài đặt (đổi mật khẩu, ngôn ngữ, thông báo)
│       ├── components/
│       ├── hooks/
│       ├── lib/                       # + đăng ký Expo push notification
│       ├── mocks/
│       ├── assets/
│       ├── tests/
│       ├── eas.json
│       └── package.json
│
├── packages/
│   ├── ai-core/                       # NGƯỜI C — Điều phối AI logic (TypeScript, THƯ VIỆN)
│   │   ├── src/
│   │   │   ├── ocr/                   # Google Cloud Vision / Tesseract adapter
│   │   │   ├── extraction/            # Claude — trích xuất JSON: tên, MSSV, đơn vị, ngày,
│   │   │   │                          # VÀ vai trò tham gia đọc được từ minh chứng (để đối chiếu)
│   │   │   ├── classification/        # KHÔNG tự phân loại bằng LLM — gọi HTTP sang apps/ai-service
│   │   │   │   └── client.ts          # POST {AI_SERVICE_URL}/api/ai/classify → nhãn + confidence
│   │   │   ├── verification/          # Logic xác minh 5 mức (QR/URL, danh sách nội bộ, email,
│   │   │   │                          # website công khai, chỉ-có-ảnh) + so khớp vai trò SV khai
│   │   │   │                          # với vai trò trích xuất được (không tách module riêng)
│   │   │   ├── rag/                   # embed.ts, retrieve.ts, answer-regulation-question.ts (Claude)
│   │   │   ├── anomaly/               # Google Vision Web Detection — tín hiệu phụ, không tự kết luận
│   │   │   ├── types.ts               # Interface input/output chung của pipeline
│   │   │   └── index.ts               # Export public API — backend "jobs/" import từ đây
│   │   ├── scripts/                   # Test độc lập bằng ảnh mẫu/Postman — không cần backend/web/app
│   │   └── package.json
│   │
│   ├── shared-types/                  # DTO/type sinh từ Prisma — dùng chung Backend ↔ Web ↔ App
│   └── config/                        # eslint, tsconfig base dùng chung
│
├── research/                          # NGƯỜI C — Huấn luyện & đánh giá model (Python, KHÔNG deploy)
│   └── activity-classification/
│       ├── datasets/
│       │   ├── raw/                   # Dữ liệu thu thập/tự tạo ban đầu
│       │   ├── cleaned/               # Đã khử trùng, chuẩn hoá nhãn theo đúng mục 8/9/10/12/13
│       │   ├── train.csv              # 70%
│       │   ├── val.csv                # 15%
│       │   └── test.csv               # 15%
│       ├── notebooks/
│       │   └── data_exploration.ipynb # Phân tích phân bố các lớp nhãn
│       ├── train_baseline.py          # TF-IDF + Logistic Regression
│       ├── train_phobert.py           # Fine-tune PhoBERT (PyTorch/Transformers)
│       ├── evaluate.py                # Accuracy/Precision/Recall/Macro-F1 cho cả 2 model
│       ├── error_analysis.py          # Confusion Matrix + liệt kê hard case để phân tích trong báo cáo
│       ├── compare_llm_vs_baseline.py # So sánh thêm với LLM zero-shot trên cùng test set (đối chứng)
│       ├── export_model.py            # Đóng gói model tốt nhất → copy vào apps/ai-service/model/
│       ├── results/                   # Biểu đồ loss/accuracy, bảng so sánh — dùng thẳng cho báo cáo
│       └── requirements.txt           # torch, transformers, scikit-learn, pandas, seaborn
│
├── docs/                              # Toàn bộ tài liệu đã làm
│   ├── 00-nghiep-vu-goc/
│   │   └── Tai_lieu_nghiep_vu_he_thong_diem_ren_luyen.docx
│   ├── 01-tinh-nang-techstack/
│   │   └── EduPoint_Tinh_nang_Techstack_Giaodien.md
│   ├── 02-database/
│   │   ├── schema.prisma
│   │   └── schema.sql
│   ├── 03-giao-dien/
│   │   ├── EduPoint_Chitiet_Giaodien_Chucnang.md
│   │   └── EduPoint_Sketch_Giaodien.md
│   └── 04-phan-cong/
│       └── phan-cong-cong-viec.md
│
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml          # Lint + test + deploy Railway/Render
│       ├── ai-service-ci-cd.yml       # Build Docker image + deploy (Python, tách riêng khỏi Node)
│       ├── web-ci-cd.yml              # Lint + test + deploy Vercel
│       └── mobile-build.yml           # Build qua EAS
│
├── .env.example                       # SUPABASE_URL, CLAUDE_API_KEY, GOOGLE_VISION_KEY, REDIS_URL,
│                                       # AI_SERVICE_URL (địa chỉ FastAPI PhoBERT)
├── .gitignore
├── package.json                       # Root — khai báo workspaces (KHÔNG gồm ai-service/research vì Python)
├── pnpm-workspace.yaml                # apps/backend, apps/web, apps/mobile, packages/*
└── README.md