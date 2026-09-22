# ĐỀ XUẤT TÍNH NĂNG, TECH STACK & GIAO DIỆN
## Hệ thống Hỗ trợ Quản lý Điểm Rèn luyện & Minh chứng Hoạt động Sinh viên (EduPoint)

*Dựa trên: Tài liệu phân tích nghiệp vụ & đề xuất hệ thống (v1.0)*

---

## PHẦN 1 — CÁC TÍNH NĂNG CHÍNH

### 1.1. Nhóm tính năng dành cho Sinh viên (App di động là chính)

| # | Tính năng | Mô tả |
|---|---|---|
| 1 | Đăng nhập / Xác thực | Đăng nhập bằng tài khoản trường (SSO/email), phân quyền theo vai trò |
| 2 | Trang chủ cá nhân | Tổng điểm rèn luyện hiện tại, biểu đồ theo học kỳ, danh sách hoạt động đã tham gia |
| 3 | Nộp minh chứng | Chọn/nhập hoạt động → chọn loại minh chứng → chụp ảnh hoặc upload PDF → xác nhận thông tin cá nhân, thời gian tham gia → gửi |
| 4 | Theo dõi trạng thái minh chứng | Xem trạng thái theo thời gian thực: Đã tiếp nhận → Đang xử lý → Đã xác minh/Có thể chấp nhận/Cần bổ sung/Cần cán bộ xem xét/Không hợp lệ |
| 5 | Xem chi tiết đề xuất của AI | Xem nội dung OCR trích xuất, tiêu chí được gợi ý, mức điểm đề xuất kèm lý do/căn cứ |
| 6 | Bổ sung minh chứng | Khi hệ thống yêu cầu, sinh viên tải thêm tài liệu/thông tin còn thiếu (danh sách tham gia, URL, xác nhận đơn vị tổ chức...) |
| 7 | Khiếu nại / Phản hồi kết quả | Gửi phản hồi nếu không đồng ý với điểm/kết luận, đính kèm minh chứng bổ sung |
| 8 | Hỏi đáp quy định (RAG chatbot) | Hỏi các câu như "Hoạt động này thuộc tiêu chí nào?", "Mức điểm tối đa là bao nhiêu?" — trả lời có trích dẫn nguồn |
| 9 | Lịch sử hoạt động & điểm | Xem toàn bộ lịch sử minh chứng, điểm đã được duyệt qua các học kỳ |
| 10 | Thông báo (Notification) | Thông báo đẩy khi có cập nhật trạng thái, yêu cầu bổ sung, kết quả duyệt |

### 1.2. Nhóm tính năng dành cho Cán bộ/Khoa (Web là chính)

| # | Tính năng | Mô tả |
|---|---|---|
| 1 | Dashboard xử lý | Danh sách hồ sơ mới, cần bổ sung, cần xem xét — có bộ lọc, sắp xếp theo độ ưu tiên/độ tin cậy AI |
| 2 | Xem chi tiết hồ sơ minh chứng | Xem tài liệu gốc, kết quả OCR, kết quả xác minh (5 mức), đề xuất tiêu chí/điểm kèm giải thích |
| 3 | Duyệt minh chứng | Duyệt / Từ chối / Sửa điểm / Yêu cầu bổ sung — bắt buộc ghi lý do quyết định |
| 4 | Truy vết căn cứ quyết định | Xem chuỗi: Điểm cuối → quy tắc/tiêu chí → hoạt động → minh chứng → OCR → nguồn xác minh |
| 5 | Quản lý tiêu chí & quy tắc điểm | CRUD tiêu chí, điều kiện áp dụng, mức điểm giới hạn (dùng cho Rule Engine) |
| 6 | Quản lý hoạt động nội bộ | CRUD hoạt động do trường/khoa tổ chức, danh sách người tham gia |
| 7 | Quản lý tài liệu quy định (RAG) | Upload/versioning tài liệu quy định, gắn ngày hiệu lực để dùng làm nguồn tra cứu |
| 8 | Xử lý cảnh báo bất thường | Xem các minh chứng bị gắn cờ trùng lặp/không nhất quán/nghi ngờ |
| 9 | Báo cáo & thống kê | Thống kê theo lớp/khoa/hoạt động/thời gian, tỷ lệ AI đề xuất đúng, thời gian xử lý trung bình |
| 10 | Nhật ký hệ thống (Audit log) | Ai thực hiện gì, khi nào — phục vụ kiểm toán |

### 1.3. Nhóm tính năng dành cho Quản trị viên

- Quản lý tài khoản & phân quyền (RBAC: Sinh viên / Cán bộ / Quản trị viên / Người phụ trách quy định)
- Cấu hình hệ thống, ngưỡng độ tin cậy AI (confidence threshold) để route sang Human-in-the-Loop
- Quản lý dữ liệu nền (danh mục hoạt động chuẩn, đơn vị tổ chức)

### 1.4. Nhóm tính năng lõi AI (Core AI Engine — chạy nền, không phải màn hình)

| Khối | Chức năng | Kỹ thuật đề xuất |
|---|---|---|
| OCR & Trích xuất | Đọc ảnh/PDF, trích xuất trường thông tin (tên SV, mã SV, hoạt động, đơn vị, thời gian, QR/mã xác minh...) | OCR engine + LLM để cấu trúc hoá (structured extraction/JSON) |
| Nhận diện & phân loại hoạt động | Hiểu hoạt động dù cách viết khác nhau; phân loại nội bộ/bên ngoài | LLM embedding + semantic matching với danh mục chuẩn |
| Xác minh minh chứng (5 mức) | Đối chiếu QR/URL, danh sách tham gia, email, website công khai, hoặc chỉ có ảnh | Rule-based check + web/API lookup + LLM đối chiếu |
| RAG tra cứu quy định | Trả lời có trích dẫn nguồn từ tài liệu quy định đã duyệt | Vector DB + retrieval + LLM generation, quản lý version tài liệu |
| Đề xuất tiêu chí & điểm | Ánh xạ hoạt động → tiêu chí → điểm, kèm giải thích | LLM reasoning + lookup tiêu chí |
| Rule Engine | Kiểm tra giới hạn điểm chính thức, chặn AI vượt quy định | Rule engine tách biệt khỏi AI (không dùng LLM để quyết định cuối) |
| Abstention / Human-in-the-Loop | AI từ chối tự quyết khi thiếu căn cứ, chuyển cán bộ | Confidence scoring + threshold routing |
| Phát hiện bất thường | Trùng lặp, thiếu thông tin, mâu thuẫn dữ liệu | Duplicate detection (hash/similarity) + rule-based consistency check |

---

## PHẦN 2 — ĐỀ XUẤT TECH STACK (bản tối ưu tốc độ phát triển)

### 2.1. Frontend

| Nền tảng | Đề xuất | Lý do |
|---|---|---|
| **Web** (Cán bộ/Admin/Người phụ trách quy định) | **React (Vite) + TypeScript**, UI: TailwindCSS + **shadcn/ui**, Chart: Recharts | Component dựng sẵn (shadcn) → không tốn thời gian tự style; phù hợp dashboard nhiều bảng dữ liệu |
| **Mobile App** (Sinh viên) | **React Native (Expo)** | Cùng ngôn ngữ TypeScript với web → tái dùng type/logic/hooks; camera/upload ảnh, push notification (Expo Notifications) hỗ trợ sẵn |

### 2.2. Backend

| Thành phần | Đề xuất | Lý do |
|---|---|---|
| API chính | **Node.js + NestJS + TypeScript** | CLI sinh module/controller/service tự động, decorator-based, tích hợp sẵn validation + Swagger docs tự generate → dựng API nhanh |
| ORM | **Prisma** | Type-safe client tự generate từ schema, migration 1 lệnh, nhanh hơn viết SQL tay nhiều |
| Kiến trúc | Modular monolith, tách rõ module: Auth, Evidence, Verification, Scoring, RAG, Audit | Đủ dùng cho quy mô đồ án, không cần microservice |
| Xử lý bất đồng bộ | **Redis Queue (BullMQ)** cho tác vụ OCR/AI chạy nền | Tránh block request khi sinh viên upload minh chứng |

### 2.3. Auth, Database & Storage — dùng **Supabase** làm nền tảng gộp

| Thành phần | Đề xuất | Lý do |
|---|---|---|
| Database | **Supabase (PostgreSQL)** | Lưu sinh viên, hoạt động, minh chứng, tiêu chí, duyệt, nhật ký |
| Auth | **Supabase Auth** (JWT + RBAC: student/staff/admin/regulation-officer) | Có sẵn login/JWT/RBAC, khỏi tự viết auth từ đầu |
| File Storage | **Supabase Storage** | Tích hợp RLS (Row Level Security) thẳng với Auth/DB → set quyền "SV chỉ xem file của mình" dễ dàng; lưu nguyên chất lượng ảnh/PDF phục vụ OCR chính xác |
| Vector DB (cho RAG) | **Supabase pgvector** (thay vì thêm ChromaDB/Qdrant riêng) | Dùng chung Postgres đang có sẵn → giảm 1 hệ thống phải cài đặt/quản lý |

> Gộp 4 việc (DB + Auth + Storage + Vector DB) vào 1 nền tảng Supabase là điểm tối ưu hoá tốc độ phát triển lớn nhất trong stack này.

### 2.4. AI Layer

| Thành phần | Đề xuất | Lý do |
|---|---|---|
| OCR | **Tesseract OCR** (mã nguồn mở, miễn phí) hoặc **Google Cloud Vision / Azure Document Intelligence** nếu cần độ chính xác cao hơn cho tiếng Việt | Tesseract đủ dùng cho đồ án, không phát sinh chi phí |
| Phát hiện bất thường (tín hiệu phụ) | **Google Cloud Vision — Web Detection API** | Reverse-image-search: đối chiếu ảnh minh chứng với ảnh đã xuất hiện trên mạng để gắn cờ nghi vấn (vd: trùng mẫu trống chưa điền tên). **Chỉ dùng làm cảnh báo phụ đưa cán bộ xem xét**, tuyệt đối không dùng để tự kết luận thật/giả — vì dễ false positive (mẫu dùng chung hợp lệ) và false negative (ảnh chụp riêng không có trên mạng) |
| LLM (trích xuất cấu trúc, phân loại, đề xuất, RAG generation) | **Claude API** — dùng **SDK TypeScript chính thức** (đồng bộ ngôn ngữ với NestJS backend) | Structured output (JSON schema) đảm bảo dữ liệu có cấu trúc; cùng hệ TypeScript nên tích hợp liền mạch |
| Embedding model | Model embedding đa ngôn ngữ hỗ trợ tiếng Việt | Dùng cho RAG với pgvector |
| Rule Engine | Code thuần (business rule tách biệt AI) hoặc lib nhẹ như `json-rules-engine` | Đảm bảo AI không tự vượt giới hạn điểm quy định |

### 2.5. Hạ tầng & Deploy

| Thành phần | Đề xuất |
|---|---|
| Backend | **Railway** hoặc **Render** — deploy NestJS 1 lệnh, không cần tự cấu hình server |
| Web | **Vercel** — deploy React tự động theo mỗi commit |
| Mobile App | **EAS Build (Expo)** — build & phát hành app không cần cấu hình Xcode/Android Studio phức tạp |
| CI/CD | GitHub Actions |
| Container hoá | Docker (tuỳ chọn, không bắt buộc nếu dùng platform managed ở trên) |

### 2.6. Tổng hợp stack đề xuất (rút gọn)

```
Ngôn ngữ chung : TypeScript (Backend + Web + App dùng chung 1 ngôn ngữ)
Frontend Web   : React (Vite) + TypeScript + TailwindCSS + shadcn/ui
Mobile App     : React Native (Expo)
Backend API    : NestJS + TypeScript + Prisma
Database/Auth/
Storage/Vector : Supabase (Postgres + Auth + Storage + pgvector)
AI/OCR         : Tesseract OCR (hoặc Cloud OCR) + Claude API (TS SDK)
Chống gian lận : Google Cloud Vision Web Detection (tín hiệu phụ, không tự kết luận)
Queue          : Redis Queue (BullMQ)
Deploy         : Railway/Render (backend) + Vercel (web) + EAS Build (app)
```

---

## PHẦN 3 — ĐỀ XUẤT GIAO DIỆN HOÀN CHỈNH

### 3.1. Nguyên tắc thiết kế chung
- **App (sinh viên):** tối giản, thao tác nhanh (nộp minh chứng ≤ 3 bước), ưu tiên camera/upload, trạng thái trực quan bằng màu sắc (badge).
- **Web (cán bộ):** tối ưu cho xử lý hàng loạt, nhiều dữ liệu — layout dạng dashboard + bảng + panel chi tiết bên cạnh (split-view) để không mất ngữ cảnh khi duyệt.
- Xuyên suốt cả hai: mọi đề xuất của AI phải hiển thị kèm **lý do/căn cứ**, không hiển thị con số đơn thuần.

### 3.2. Giao diện App (Sinh viên) — Mobile

**Cấu trúc điều hướng (Bottom Tab Bar — 4 tab):**
`Trang chủ | Nộp minh chứng | Hoạt động của tôi | Hỏi đáp quy định`

| Màn hình | Bố cục chính |
|---|---|
| **1. Trang chủ** | Header: tên SV + avatar. Card lớn ở giữa: tổng điểm rèn luyện hiện tại (vòng tròn %). Bên dưới: biểu đồ cột điểm theo học kỳ. List rút gọn "Hồ sơ cần chú ý" (cần bổ sung/cần xem xét) với badge màu cam/đỏ. |
| **2. Nộp minh chứng** (dạng wizard 3 bước) | Bước 1: Chọn hoạt động (search + chọn từ danh sách hoặc "Nhập hoạt động mới"). Bước 2: Chọn loại minh chứng + chụp ảnh/upload PDF (preview ảnh ngay). Bước 3: Xác nhận thông tin cá nhân, thời gian tham gia → nút "Gửi hồ sơ" cố định ở đáy màn hình. |
| **3. Chi tiết minh chứng** | Ảnh/PDF minh chứng ở trên. Timeline trạng thái dạng stepper ngang (Đã tiếp nhận → Đang xử lý → Đã xác minh...). Section "Đề xuất của hệ thống": tiêu chí + điểm đề xuất + lý do (dạng bullet). Nếu "Cần bổ sung": khung cảnh báo màu vàng nêu rõ thiếu gì + nút "Bổ sung ngay". |
| **4. Hoạt động của tôi** | Danh sách dạng card, mỗi card: tên hoạt động, ngày, badge trạng thái, điểm (nếu đã chốt). Filter theo học kỳ/trạng thái ở đầu trang. |
| **5. Hỏi đáp quy định (Chatbot)** | Giao diện chat quen thuộc, câu trả lời kèm thẻ trích dẫn "Nguồn: [tên văn bản, điều khoản]" có thể bấm để xem chi tiết văn bản. |
| **6. Thông báo** | Danh sách thông báo, chấm đỏ số lượng chưa đọc trên icon chuông ở header. |

### 3.3. Giao diện Web (Cán bộ / Khoa)

**Cấu trúc điều hướng (Sidebar trái cố định):**
`Dashboard | Danh sách cần xử lý | Quản lý hoạt động | Quản lý tiêu chí | Quản lý tài liệu quy định | Báo cáo | Nhật ký`

| Màn hình | Bố cục chính |
|---|---|
| **1. Dashboard** | Hàng thẻ số liệu tổng quan (số hồ sơ mới, cần xem xét, đã duyệt hôm nay, thời gian xử lý TB). Biểu đồ xu hướng hồ sơ theo ngày. Bảng "Cần xử lý gấp" (SLA sắp hết hạn). |
| **2. Danh sách cần xử lý** | Bảng dữ liệu (data table) với cột: SV, Hoạt động, Trạng thái, Độ tin cậy AI (progress bar), Ngày nộp. Filter/sort đa tiêu chí. Bấm 1 dòng → mở **panel chi tiết trượt từ phải (split-view)**, không chuyển trang, giúp duyệt liên tục nhiều hồ sơ nhanh. |
| **3. Panel/Trang chi tiết hồ sơ** | 2 cột: **Trái** — ảnh/PDF minh chứng (zoom được) + nội dung OCR trích xuất (có thể sửa nếu OCR sai). **Phải** — Kết quả xác minh (badge mức 1–5 + nguồn), Đề xuất AI (tiêu chí, điểm, lý do — dạng breadcrumb truy vết căn cứ), khung nhập lý do quyết định, 4 nút hành động: **Duyệt / Từ chối / Sửa điểm / Yêu cầu bổ sung**. |
| **4. Quản lý hoạt động** | Bảng CRUD hoạt động nội bộ, tab phụ "Danh sách tham gia" để import/đối chiếu. |
| **5. Quản lý tiêu chí** | Bảng CRUD tiêu chí + điều kiện áp dụng + mức điểm giới hạn (đây là input cho Rule Engine). |
| **6. Quản lý tài liệu quy định** | Danh sách tài liệu (tên, phiên bản, ngày hiệu lực), upload mới, đánh dấu tài liệu hết hiệu lực (dùng cho RAG). |
| **7. Báo cáo** | Bộ lọc theo lớp/khoa/thời gian → biểu đồ + bảng xuất Excel. |
| **8. Nhật ký (Audit log)** | Bảng log: Người thực hiện, Hành động, Đối tượng, Thời gian — có thể lọc theo hồ sơ cụ thể để truy vết. |

### 3.4. Bảng màu trạng thái gợi ý (dùng chung App & Web)

| Trạng thái | Màu badge |
|---|---|
| Đã tiếp nhận / Đang xử lý | Xanh dương nhạt |
| Đã xác minh | Xanh lá |
| Có thể chấp nhận | Vàng nhạt |
| Cần bổ sung / Cần cán bộ xem xét | Cam |
| Không hợp lệ | Đỏ |

---

## Ghi chú
Toàn bộ đề xuất trên bám sát nguyên tắc nghiệp vụ cốt lõi trong tài liệu gốc: **AI chỉ đề xuất, quy định chính thức và quyết định của cán bộ là căn cứ cuối cùng**, và **"không tìm thấy trong dữ liệu trường" không đồng nghĩa với "giả"** — nên mọi giao diện đều được thiết kế để hiển thị rõ căn cứ/lý do thay vì chỉ đưa ra kết luận.
