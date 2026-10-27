# EduPoint — Sổ tay hiện trạng hệ thống Web

> **Mục đích:** Đây là tài liệu bàn giao nhanh cho chủ dự án và Codex ở các phiên làm việc sau. Khi cần hiểu hệ thống hiện tại, hãy đọc file này trước rồi mới mở các file nguồn được liên kết trong từng phần.
>
> **Mốc đối chiếu:** 27/10/2026, nhánh `docs-current-system-handbook-20261027`, được khảo sát trực tiếp từ mã nguồn Web, Backend, Prisma schema và routes tại thời điểm tạo tài liệu.
>
> **Phạm vi đang phát triển:** Web trước, mobile sau. Hệ thống có 3 vai trò chính: `STUDENT` (Sinh viên), `STAFF` (Cán bộ Khoa), `ADMIN` (Phòng CTSV/cấp Trường). Không có vai trò cán sự lớp hoặc giảng viên riêng.

---

## 1. Cách dùng tài liệu này trong các phiên Codex sau

Khi bắt đầu một yêu cầu mới, Codex nên làm theo thứ tự:

1. Đọc toàn bộ file này để biết luồng và tên trang hiện hành.
2. Kiểm tra `git status`, nhánh hiện tại và các commit sau ngày 27/10/2026 vì mã nguồn có thể đã thay đổi.
3. Đọc `apps/web/src/routes.tsx` và `apps/web/src/layouts/AppLayout.tsx` để xác nhận route/menu chưa đổi.
4. Đọc controller/service Backend liên quan trước khi sửa giao diện; Web không được tự tính hoặc dựng dữ liệu giả.
5. Đọc `apps/backend/prisma/schema.prisma` trước khi đề xuất sửa database.
6. Không dùng các tài liệu feature spec cũ như bằng chứng rằng chức năng đã tồn tại. Một chức năng chỉ được coi là đang chạy khi route Web, API Backend và schema cần thiết đều có mã thật.
7. Không chạy `prisma:seed`, reset database hoặc xóa dữ liệu Supabase nếu người dùng chưa cho phép rõ ràng.

Tài liệu này mô tả **hiện trạng mã nguồn**, không phải cam kết rằng mọi nhánh giao diện đã được nghiệm thu thủ công trên trình duyệt.

---

## 2. Tóm tắt hệ thống hiện tại

EduPoint là hệ thống đánh giá điểm rèn luyện theo kỳ. Luồng chính hiện tại:

```text
Admin tạo kỳ và ban hành rubric
        ↓
Sinh viên tự đánh giá 16 tiêu chí + tạo minh chứng theo tiêu chí
        ↓
Sinh viên bấm Nộp phiếu
        ↓
AI xử lý nền nếu được cấu hình; nếu không, hồ sơ chuyển cán bộ xử lý thủ công
        ↓
Cán bộ Khoa xác nhận minh chứng → nhập dữ liệu xác minh → Backend đề xuất điểm
        ↓
Cán bộ xác nhận điểm chính thức từng tiêu chí
        ↓
Khoa gửi kết quả hoàn tất đến CTSV
        ↓
CTSV công bố tạm → Sinh viên phúc khảo → Khoa đánh giá lại nếu được mở
        ↓
CTSV chốt kỳ chính thức
```

Các nguyên tắc nguồn dữ liệu:

- Điểm tự đánh giá của sinh viên, điểm đề xuất và điểm chính thức là ba giá trị khác nhau.
- Điểm chính thức nằm ở `CriterionAssessment.officialScore`.
- Tổng điểm được Backend tính từ các tiêu chí `FINALIZED`, áp trần từng khung và tổng 100.
- Duyệt một minh chứng không tự cộng điểm vào tổng.
- Phúc khảo không cộng trực tiếp vào tổng; chấp thuận phúc khảo mở lại tiêu chí để Khoa đánh giá lại.
- Kết quả sinh viên nhìn thấy trong quy trình mới lấy từ bản công bố của CTSV, không lộ điểm chấm nội bộ trước thời điểm công bố.
- Không còn bảng `ConductScore`, `Rule` và enum `RuleStatus`; các bảng này đã bị loại bỏ vì trùng nguồn sự thật.
- Thiếu dữ liệu xác minh không được tự coi là đạt và không sinh điểm mặc định.

---

## 3. Công nghệ và cách chạy

### 3.1 Web

- React 18 + TypeScript.
- Vite 5.
- React Router DOM 6.
- Tailwind CSS.
- Axios để gọi Backend.
- Lucide React cho icon.
- `xlsx` để xuất danh sách tiến độ ra Excel.
- Mặc định chạy tại `http://localhost:3000` trong quá trình phát triển hiện tại.

Thư mục: `apps/web`.

Lệnh thường dùng:

```bash
cd apps/web
npm run dev -- --port 3000
npm run build
```

### 3.2 Backend

- NestJS 10 + TypeScript.
- Prisma 5.
- PostgreSQL trên Supabase.
- Supabase Storage cho tệp minh chứng.
- JWT + Passport cho xác thực.
- Swagger tại `/api/docs`.
- API prefix là `/api`, mặc định chạy tại `http://localhost:3001`.

Thư mục: `apps/backend`.

Lệnh thường dùng:

```bash
cd apps/backend
npm run start:dev
npm run build
npx prisma migrate status
```

### 3.3 AI hiện tại

- `apps/ai-service` mới là khung file rỗng, chưa phải dịch vụ FastAPI có thể chạy.
- Backend có worker thật trong `evidence-processing.worker.ts`. Worker thăm dò bảng `AiProcessingJob` mỗi 3 giây.
- Nếu có `AI_PIPELINE_URL`, Backend gọi `POST {AI_PIPELINE_URL}/evidence/process`.
- Nếu chưa cấu hình AI, job chuyển `UNAVAILABLE`, minh chứng chuyển `NEEDS_HUMAN_REVIEW` để cán bộ xử lý thủ công.
- AI chỉ đưa đề xuất; AI không được ghi điểm chính thức.
- Backend kiểm tra phiên bản minh chứng, rubric, trạng thái phiếu, trạng thái kỳ và trạng thái bàn giao trước khi nhận kết quả AI. Kết quả đến muộn hoặc đã lỗi thời bị hủy.

### 3.4 Biến môi trường quan trọng

Xem mẫu ở `apps/backend/.env.example`:

- `DATABASE_URL`: kết nối runtime qua Supabase pooler.
- `DIRECT_URL`: kết nối session/direct dùng cho migration.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_EVIDENCE_BUCKET`: lưu và ký URL tệp minh chứng.
- `AI_PIPELINE_URL`, `AI_PIPELINE_TOKEN`, `AI_PIPELINE_TIMEOUT_MS`.
- `AI_MODEL_NAME`, `AI_MODEL_VERSION`, `AI_PIPELINE_CONFIG_VERSION`.

Không đưa file `.env` thật hoặc service role key vào Git/tài liệu.

---

## 4. Bố cục giao diện chung

`AppLayout.tsx` là khung dùng chung sau đăng nhập:

- Header cố định phía trên có logo EduPoint/ĐHBK, bộ chọn kỳ, huy hiệu vai trò, chuông thông báo và menu tài khoản.
- Bộ chọn kỳ cập nhật `termId` trên URL hiện tại, giúp các trang cùng nhìn một kỳ.
- Sidebar thay đổi theo vai trò.
- Breadcrumb được dựng theo route.
- Nội dung chính dùng chiều rộng lớn, ưu tiên bảng `table-fixed`; các trang nghiệp vụ mới tránh tạo vùng cuộn riêng trong bảng.
- Trên màn hình nhỏ có nút mở/đóng menu, nhưng đợt hiện tại tối ưu Web trước.

Trạng thái phiên đăng nhập:

- Token lưu tại `localStorage` với khóa `edupoint_auth_token`.
- Người dùng lưu tại `edupoint_current_user`.
- Kỳ đang chọn lưu tại `edupoint_active_term`.
- Axios tự gắn Bearer token.
- Khi Backend trả 401, token/user cục bộ bị xóa và giao diện chuyển về `/login`.
- Vai trò lấy từ tài khoản Backend; người dùng không thể tự đổi vai trò.

Các route chung:

| Route | Chức năng | Khi có dữ liệu |
|---|---|---|
| `/login` | Đăng nhập | Nhận JWT và user, sau đó chuyển đúng dashboard theo vai trò. |
| `/forgot-password` | Gửi yêu cầu quên mật khẩu | Hiển thị phản hồi từ Backend. Cần lưu ý Backend hiện không có route reset hoàn chỉnh tương ứng với toàn bộ luồng FE. |
| `/reset-password` | Form đặt lại mật khẩu | FE có trang/API client; cần xác minh Backend trước khi coi là hoạt động đầy đủ. |
| `/account` | Hồ sơ cá nhân và đổi mật khẩu | Hiển thị thông tin tài khoản hiện tại; đổi mật khẩu bằng mật khẩu cũ/mới. |
| `/notifications` | Danh sách thông báo | Hiện thông báo thật từ DB, trạng thái đã đọc/chưa đọc và thao tác đọc tất cả. |
| `/regulations/ask` | Tra cứu tiêu chí | Tìm cục bộ trên rubric kỳ đang chọn; hiện 5 khung/tiêu chí phù hợp. Đây chưa phải chatbot RAG sinh câu trả lời. |
| `/organizer-confirm/:token` | Route xác minh công khai | Trang còn tồn tại nhưng chưa nối luồng nghiệp vụ chính hiện tại. |

---

## 5. Vai trò Sinh viên (`STUDENT`)

### 5.1 Menu hiện tại

```text
HỌC KỲ HIỆN TẠI
├── Tổng quan
└── Chấm điểm rèn luyện

HỒ SƠ & KẾT QUẢ
├── Minh chứng của tôi
└── Phúc khảo

TRA CỨU
└── Hỗ trợ
```

### 5.2 Tổng quan — `/student`

Mục đích: cho sinh viên biết mình đang ở bước nào trong kỳ, thay vì phải mở từng hồ sơ.

Khi tải thành công, trang hiển thị:

- Họ tên, mã sinh viên, Khoa và Lớp.
- Tên kỳ đang chọn và hạn nộp.
- Trạng thái phiếu tự đánh giá: bản nháp, đã nộp chờ xử lý hoặc bị trả để chỉnh sửa.
- Nếu bị trả: lý do trả và nút sang trang chỉnh sửa phiếu.
- Số minh chứng đã được duyệt, đang chờ và cần bổ sung.
- Điểm chính thức nếu đã công bố/chốt.
- Nếu Khoa đã chốt một phần nhưng CTSV chưa công bố: chỉ mô tả tổng tiêu chí đã xác nhận là tạm tính, không gọi đó là điểm chính thức.
- Tiến độ theo 5 khung rubric và số mục đã xử lý.
- Danh sách minh chứng gần đây; mỗi dòng có trạng thái thực tế.
- Khối bảng điểm/in kết quả khi có dữ liệu.

Khi không có dữ liệu:

- Không tự hiển thị điểm 0 như điểm thật.
- Hiển thị “Chưa có dữ liệu điểm”, “Chưa xếp loại”, “Chưa có minh chứng”.
- Khi API lỗi, hiển thị thông báo không tải được dữ liệu và cho tải lại.

### 5.3 Chấm điểm rèn luyện — `/student/scores`

Đây là nơi duy nhất sinh viên vừa tự đánh giá vừa gắn minh chứng theo tiêu chí. Các route cũ `/student/criteria`, `/student/evidence/new` và `/student/what-can-i-claim` đều chuyển về đây.

Phần đầu trang:

- Tên “Phiếu đánh giá rèn luyện”.
- Tên kỳ, phiên bản rubric và trạng thái nộp.
- Ba nút chung: **Lưu**, **Nộp phiếu**, **In phiếu**.
- Không có nút lưu riêng cho từng tiêu chí.
- Thông báo khóa nếu kỳ không `ACTIVE`, đã hết hạn, kỳ đã chốt hoặc phiếu đang `SUBMITTED`.
- Nếu phiếu `RETURNED`, hiển thị lý do để sinh viên sửa và nộp lại.

Bảng chính gồm các cột:

1. STT/mã tiêu chí.
2. Nội dung tiêu chí và mô tả/cách tính.
3. Điểm tối đa.
4. Sinh viên tự đánh giá.
5. Minh chứng.
6. AI phân tích.
7. Cán bộ đánh giá.

Cách bảng hiển thị dữ liệu:

- Rubric được chia theo 5 khung; mỗi dòng khung có tổng phụ.
- Bộ chuẩn ĐHBK hiện hướng tới 16 tiêu chí, tổng các khung `20/25/20/25/10`, toàn phiếu 100.
- Điểm vừa nhập cập nhật tổng tự đánh giá ngay trên FE; đây chỉ là tổng tạm của phần sinh viên.
- Ô trống vẫn là “chưa tự đánh giá”, không tự chuyển thành 0.
- Backend từ chối điểm âm hoặc vượt điểm tối đa của tiêu chí.
- Cột Minh chứng hiện số hồ sơ và trạng thái từng hồ sơ.
- Cột AI hiện đề xuất/giải thích nếu có; đang chạy thì ghi “Đang phân tích”; lỗi hoặc chưa cấu hình ghi rõ chờ cán bộ, không tạo kết quả giả.
- Cột Cán bộ chỉ hiện điểm chính thức sau mốc được phép công bố; trước đó là chờ xác minh/chờ chốt/chưa đánh giá.
- Cuối phiếu có tổng tự đánh giá trên 100 và số mục đã nhập.

Nút **Lưu**:

- Gửi toàn bộ danh sách điểm tự đánh giá hiện tại lên Backend.
- Không khóa phiếu.
- Có thể để trống một số tiêu chí.

Nút **Nộp phiếu**:

- Lưu điểm hiện tại.
- Chuyển `AssessmentSubmission` sang `SUBMITTED`.
- Chuyển các minh chứng nháp hợp lệ sang xử lý và tạo job AI.
- Khóa phần tự đánh giá và minh chứng cho đến khi cán bộ trả phiếu.
- Có thể nộp khi còn mục điểm trống; cán bộ vẫn phải xác minh/chốt đủ trước khi gửi CTSV.

Popup **Quản lý minh chứng** theo từng tiêu chí:

- Danh sách “Minh chứng 1, Minh chứng 2…” của đúng tiêu chí.
- Thêm/sửa/xóa hồ sơ nháp.
- Trường dữ liệu: tên hoạt động/thành tích, ngày tham gia, vai trò, loại minh chứng, mô tả/căn cứ.
- Vai trò hiện có: người tham gia, ban tổ chức/tình nguyện viên, cổ vũ.
- Loại hồ sơ hiện có: giấy chứng nhận/bằng khen, giấy xác nhận, vé/check-in QR, danh sách kết quả.
- Một hồ sơ có nhiều tệp.
- Tệp được tải lên Supabase Storage; DB lưu storage key và metadata.
- Hồ sơ đã được duyệt không cho sinh viên sửa/xóa.

### 5.4 Minh chứng của tôi — `/student/evidence`

Mục đích: tra cứu và theo dõi hồ sơ đã tạo, không phải một luồng chấm thứ hai.

Giao diện có:

- Các thẻ/bộ lọc trạng thái: tất cả, đang xử lý/chờ duyệt, đã duyệt, cần bổ sung hoặc các trạng thái tương ứng.
- Ô tìm theo tên hoạt động hoặc mã.
- Danh sách hồ sơ với tên, tiêu chí, ngày gửi, trạng thái và thao tác.
- Hồ sơ nháp có thể xóa.
- Hồ sơ chưa có quyết định cuối có thể rút theo điều kiện Backend.
- Bấm hồ sơ mở `/student/evidence/:id`.

Khi không có dữ liệu: hiện thông báo không có hồ sơ khớp bộ lọc, không dựng card mẫu.

### 5.5 Chi tiết minh chứng — `/student/evidence/:id`

Hiển thị:

- Thông tin khai báo, loại hồ sơ, vai trò, thời gian và tệp.
- Lịch sử/trạng thái xử lý.
- OCR nếu pipeline đã trả: nội dung trích xuất, họ tên, MSSV, đơn vị, ngày, độ tin cậy.
- Kết quả xác minh nếu có.
- Đề xuất AI và lý do, có nhãn đây là tham khảo.
- Quyết định của cán bộ, yêu cầu bổ sung và phản hồi.

Thao tác theo trạng thái:

- Bổ sung tệp/nội dung khi có yêu cầu bổ sung.
- Gửi khiếu nại cũ theo minh chứng vẫn còn trong trang chi tiết để tương thích dữ liệu cũ; luồng rubric mới ưu tiên phúc khảo theo tiêu chí ở `/student/appeals`.

### 5.6 Phúc khảo — `/student/appeals`

- Chỉ cho tạo đơn khi CTSV đã công bố tạm, còn trong hạn phúc khảo và kỳ chưa `CLOSED`.
- Dropdown chỉ liệt kê tiêu chí đã có kết quả công bố.
- Sinh viên chọn tiêu chí, nhập giải trình và gửi.
- Bên dưới hiển thị các đơn trong kỳ: chờ xử lý, được chấp thuận để đánh giá lại hoặc đã bác; có phản hồi của cán bộ nếu có.
- Nếu chưa đủ điều kiện, trang giải thích mốc nghiệp vụ thay vì vẫn mở form.

### 5.7 Hỗ trợ — `/regulations/ask`

- Lấy rubric thật theo kỳ.
- Tìm theo từ khóa trong mã, tên, mô tả tiêu chí.
- Hiển thị khung, mã mục, nội dung, điểm tối đa và điều kiện/cấu hình tính.
- Nếu kỳ chưa có rubric đã ban hành, hiện trạng thái trống.
- Hiện chưa gọi mô hình RAG hay sinh câu trả lời hội thoại.

---

## 6. Vai trò Cán bộ Khoa (`STAFF`)

### 6.1 Phạm vi quyền

- Cán bộ phải được gán `facultyId`.
- Backend tự giới hạn danh sách sinh viên/minh chứng theo Khoa của tài khoản; không tin `facultyId` do FE tự truyền để mở rộng quyền.
- Cán bộ không quản lý tài khoản, Khoa hay Lớp.
- Cán bộ xác nhận minh chứng và chốt điểm tiêu chí, nhưng không công bố kết quả toàn trường.

### 6.2 Menu hiện tại

```text
CÔNG VIỆC
├── Tổng quan
├── Minh chứng
└── Phúc khảo

DỮ LIỆU
├── Hoạt động & điểm danh
└── Phiếu rèn luyện

TRA CỨU
└── Tiêu chí & quy chế
```

### 6.3 Tổng quan — `/officer`

Trang sử dụng `EvaluationBoard` ở chế độ rút gọn, dữ liệu lấy từ workflow theo kỳ.

Khi có dữ liệu, hiển thị:

- Tổng số sinh viên trong snapshot kỳ và thời gian cập nhật.
- Thẻ tiến độ: chưa nộp, đang chấm, cần chỉnh sửa, hoàn tất chấm, đã gửi CTSV, phúc khảo chờ.
- Mỗi thẻ dẫn đến danh sách đã lọc hoặc trang phúc khảo.
- Danh sách rút gọn các phiếu sinh viên, lớp, trạng thái, số tiêu chí hoàn tất, minh chứng còn chờ và link xem phiếu.

KPI ở đây đếm **sinh viên/phiếu**, không dùng số minh chứng để giả làm số phiếu đã chốt.

### 6.4 Minh chứng — `/officer/queue`

Đây là hàng đợi xác nhận hồ sơ, không phải nơi tạo tổng điểm.

Giao diện có:

- Bộ lọc kỳ, trạng thái, loại minh chứng, lớp/từ khóa tùy dữ liệu trả về.
- Phân trang từ Backend.
- Bảng/card hồ sơ với sinh viên, hoạt động, tiêu chí, thời gian, trạng thái AI/xác minh và link mở chi tiết.
- Khi API đang tải: skeleton/loading.
- Khi không có hồ sơ: empty state “không có hồ sơ phù hợp”, trang không được trắng.
- Khi lỗi: thông báo lỗi và nút tải lại.

Backend áp dụng Khoa từ tài khoản cán bộ và tối ưu truy vấn phân trang để tránh tải toàn bộ hồ sơ.

### 6.5 Chi tiết minh chứng — `/officer/review/:id`

Đây là màn hình đối chiếu một hồ sơ. Nội dung chia theo các nhóm:

- Thông tin sinh viên khai báo.
- Tệp minh chứng/xem tệp.
- Nội dung OCR và trường AI trích xuất nếu có.
- Kết quả AI: tiêu chí đề xuất, điểm tham khảo, lý do và độ tin cậy.
- Nguồn xác minh độc lập và mức xác minh.
- Cờ bất thường nếu pipeline trả về.
- Quyết định/lịch sử review.
- Tra cứu rubric đúng phiên bản kỳ, không dùng điểm viết cứng.

Với rubric phiên bản mới, cán bộ có các quyết định:

- **Xác nhận minh chứng hợp lệ:** đổi trạng thái minh chứng, không cộng điểm.
- **Yêu cầu bổ sung:** ghi rõ tài liệu còn thiếu; sinh viên nhận thông báo và có thể bổ sung.
- **Từ chối:** bắt buộc nêu lý do/căn cứ.
- Các thao tác nhập điểm trực tiếp theo minh chứng bị chặn đối với rubric mới; điểm phải chốt tại phiếu tiêu chí.

Trang còn một số khối tương thích luồng cũ như nguồn xác minh L1–L4 và quyết định điểm legacy; chúng không phải nguồn điểm cho rubric mới.

### 6.6 Phúc khảo — `/officer/appeals`

- Lọc theo trạng thái `PENDING`, `ACCEPTED`, `REJECTED` hoặc tất cả.
- Bảng gồm sinh viên, tiêu chí/nội dung, kết quả đã công bố, phiên bản công bố và thao tác.
- Popup hiển thị giải trình của sinh viên.
- Bác hoặc chấp thuận đều bắt buộc nhập lý do.
- Chấp thuận mở lại tiêu chí/phiếu để Khoa đánh giá lại; không nhập một khoản điểm cộng ngay trong popup.
- Kỳ đã chốt không cho xử lý.
- Link “Mở phiếu” đưa về đúng hồ sơ sinh viên.

### 6.7 Hoạt động & điểm danh — `/officer/activities`

Có hai tab trong cùng trang:

1. **Hoạt động nội bộ**.
2. **Hoạt động ngoài trường**.

Chức năng:

- Lọc/tìm hoạt động theo kỳ, tên, đơn vị.
- Tạo, sửa, xóa hoạt động.
- Gắn hoạt động với tiêu chí rubric của kỳ.
- Khai báo tên, đơn vị tổ chức, thời gian, địa điểm, mô tả.
- Mở chi tiết hoạt động để xem danh sách tham gia.
- Thêm một sinh viên bằng MSSV.
- Nhập hàng loạt danh sách MSSV.
- Ghi vai trò tham gia.
- Xóa một bản ghi điểm danh.

Danh sách tham gia là **nguồn đối chiếu**; chỉ tạo hoạt động không có nghĩa sinh viên đã tham gia và cũng không tự sinh điểm.

Route cũ `/officer/external-activities` chuyển về trang này.

### 6.8 Phiếu rèn luyện — `/officer/students`

Đây là không gian làm việc chính theo sinh viên và sử dụng `EvaluationBoard` đầy đủ.

Phần tiến độ:

- Các thẻ trạng thái theo số phiếu.
- Tìm theo MSSV/họ tên.
- Lọc trạng thái và lớp; bộ lọc lưu trong URL.
- Xuất Excel và in.
- Chọn tối đa 100 phiếu đủ điều kiện để gửi CTSV.
- Chỉ phiếu `READY` mới chọn được.
- Sau hạn, sinh viên thật sự không nộp có thể được ghi nhận “không nộp” với lý do.

Bảng danh sách:

- Sinh viên, lớp, trạng thái, số tiêu chí hoàn tất/tổng tiêu chí, số minh chứng chờ và thao tác xem phiếu.
- Trạng thái có thể là: Chưa nộp, Chờ sinh viên sửa, Đang chấm, Hoàn tất chấm, Đã gửi CTSV, Đã công bố tạm, CTSV trả lại, Đã ghi nhận không nộp.

### 6.9 Hồ sơ đánh giá sinh viên — `/officer/students/:studentId/assessment`

Trang có ba tab:

#### Tab “Phiếu đánh giá”

Bảng cột:

- Tiêu chí.
- Điểm tối đa.
- Sinh viên tự đánh giá.
- Số minh chứng.
- Điểm đề xuất theo quy tắc Backend.
- Điểm cán bộ.
- Trạng thái.

Mỗi khung hiển thị số mục hoàn tất và tổng điểm Khoa đã chấm trong trần khung. Cuối bảng hiển thị tổng điểm Khoa và số tiêu chí đã hoàn tất.

Bấm một tiêu chí mở popup chi tiết:

- Điểm sinh viên tự đánh giá.
- Danh sách minh chứng và kết quả AI tham khảo.
- Các trường dữ liệu cần xác minh theo `scoringConfig` của tiêu chí.
- Một số số lượng hoạt động được Backend tính từ minh chứng đã duyệt và hiển thị chỉ đọc.
- Ghi chú nguồn xác minh là bắt buộc để phiếu đủ điều kiện gửi.
- Nút “Lưu xác minh & tính điểm đề xuất” gửi dữ liệu sang Backend rule evaluator.
- Khi đủ dữ liệu, Backend trả `suggestedScore` và `suggestionReason`.
- Cán bộ nhập điểm chính thức; nếu khác đề xuất thì bắt buộc ghi lý do.
- Nút “Xác nhận điểm” chuyển tiêu chí sang `FINALIZED`.

#### Tab “Minh chứng”

- Liệt kê toàn bộ minh chứng gắn với các tiêu chí của sinh viên trong kỳ.
- Mỗi dòng dẫn tới trang chi tiết review đúng hồ sơ.
- Nếu không có hồ sơ, hiện empty state.

#### Tab “Lịch sử”

- Lấy audit log liên quan đến assessment, submission, evidence và handoff.
- Hiển thị hành động, người thực hiện, thời gian và lý do nếu có.

Các thao tác cấp phiếu:

- “Trả sinh viên” yêu cầu lý do; phiếu chuyển `RETURNED` để sinh viên sửa/nộp lại.
- “Gửi CTSV” chỉ bật khi tất cả tiêu chí đã `FINALIZED`, có căn cứ và không còn hồ sơ/phúc khảo chờ.
- Khi đã gửi CTSV, phiếu Khoa bị khóa cho đến khi CTSV trả lại hoặc phúc khảo hợp lệ mở lại.
- Kỳ `CLOSED` luôn chỉ xem.

### 6.10 Tiêu chí & quy chế — `/officer/criteria`

- Chỉ đọc bộ rubric đã ban hành của kỳ.
- Tìm theo mã hoặc nội dung.
- Hiển thị 5 khung, mã, nội dung, điểm tối đa và cách tính từ `scoringConfig`.
- Có thể mở/thu gọn mô tả chi tiết.
- Không cho cán bộ chỉnh rubric.
- Nếu kỳ chưa có rubric, hiển thị trạng thái rõ ràng, không tạo tiêu chí giả.

---

## 7. Vai trò Admin CTSV (`ADMIN`)

### 7.1 Trách nhiệm

- Quản lý tài khoản và cơ cấu Khoa/Lớp.
- Quản lý vòng đời kỳ đánh giá.
- Quản lý bộ chuẩn và bản rubric riêng theo kỳ.
- Tiếp nhận kết quả Khoa, trả Khoa nếu cần, công bố tạm và chốt chính thức.
- Quản lý tài liệu quy chế.
- Xem audit log và sức khỏe hệ thống.
- Admin xem phiếu/căn cứ nhưng trong workflow mới không thay Khoa chấm từng tiêu chí.

### 7.2 Menu hiện tại

```text
QUẢN LÝ
├── Tổng quan
├── Tài khoản & đơn vị
└── Kỳ đánh giá

QUY ĐỊNH
├── Bộ tiêu chí
└── Tài liệu quy chế

HỆ THỐNG
└── Giám sát & nhật ký
```

### 7.3 Tổng quan — `/admin`

Trang dùng `EvaluationBoard` ở chế độ Admin:

- Thẻ tiến độ toàn trường theo số sinh viên/phiếu.
- Bảng tiến độ theo Khoa: tổng sinh viên, số đã gửi, số đã công bố, phúc khảo tồn.
- Bấm Khoa để lọc danh sách.
- Tìm sinh viên, lọc trạng thái/lớp/Khoa, xuất Excel và in.
- Xem phiếu ở `/admin/results/:studentId`.
- Trả một kết quả đã gửi về Khoa, bắt buộc có lý do.
- Nút “Công bố tạm” chỉ bật khi toàn bộ phiếu đã được Khoa gửi hoặc được ghi nhận không nộp và không còn điều kiện chặn.

Khi công bố tạm:

- Backend tạo `AssessmentPublication` dạng append-only theo revision.
- Sinh viên được xem snapshot điểm và có thể phúc khảo trong hạn.
- Kỳ chuyển sang `REVIEWING`.

### 7.4 Xem phiếu — `/admin/results/:studentId`

- Dùng cùng `StudentAssessment` với Khoa để ba vai trò nhìn cùng dữ liệu.
- Có ba tab Phiếu đánh giá, Minh chứng, Lịch sử.
- Admin ở chế độ chỉ xem căn cứ và kết quả Khoa.
- Không chấm thay cán bộ Khoa trong workflow mới.

### 7.5 Tài khoản & đơn vị — `/admin/users`

Đây là một trang lớn quản lý tập trung ba loại dữ liệu.

Chế độ/khối giao diện:

- Duyệt dạng cây Khoa → Lớp → Sinh viên.
- Tra cứu dạng bảng phẳng.
- Tìm kiếm và lọc theo vai trò, Khoa, Lớp, trạng thái.
- Tạo tài khoản `STUDENT`, `STAFF`, `ADMIN`.
- Sửa họ tên, email, mã sinh viên, vai trò, lớp/Khoa và trạng thái.
- Khóa/mở khóa tài khoản; với tài khoản có lịch sử nên ưu tiên khóa thay vì xóa.
- Import Excel/CSV hàng loạt và hiển thị số thành công/cập nhật/lỗi.
- Tải file mẫu import.
- CRUD Khoa.
- CRUD Lớp và gắn lớp vào Khoa/khóa học.

Khi có dữ liệu, cây hiển thị card Khoa, đi sâu vào danh sách lớp rồi tài khoản; bảng phẳng hiển thị thông tin và thao tác từng người. Khi trống, trang hiện trạng thái không có dữ liệu tương ứng.

### 7.6 Kỳ đánh giá — `/admin/terms`

Danh sách hiển thị:

- Tên/mã kỳ.
- Thời gian bắt đầu/kết thúc.
- Hạn nộp, hạn chấm, hạn phúc khảo.
- Trạng thái `UPCOMING`, `ACTIVE`, `REVIEWING`, `CLOSED`.
- Trạng thái rubric và link “Thiết lập tiêu chí”.

Thao tác:

- Tạo kỳ mới.
- Sửa thời hạn/thông tin kỳ.
- Kích hoạt kỳ.
- Mở lại kỳ với lý do theo điều kiện Backend.
- Sang màn tiếp nhận/công bố.
- Chốt chính thức khi kỳ đã công bố tạm, hết hạn phúc khảo, không còn đơn chờ và mọi revision mới nhất đã công bố.

Khi kích hoạt kỳ mới có rubric đã ban hành, Backend tạo snapshot `AssessmentHandoff` để cố định sinh viên, lớp, Khoa và rubric của kỳ. Việc sinh viên đổi lớp sau đó không làm thay lịch sử phân công của kỳ.

### 7.7 Bộ tiêu chí — `/admin/criteria`

Có hai tab:

#### Tab “Bộ chuẩn”

- Quản lý mẫu rubric dùng để tạo kỳ sau.
- Xem danh sách phiên bản `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- Tạo bản nháp từ bản đang ban hành.
- Chỉnh khung, tiêu chí, điểm tối đa, mô tả và `scoringConfig` trong bản nháp.
- Thêm/xóa khung và tiêu chí.
- Nhập ghi chú phiên bản.
- Ban hành bộ chuẩn; bản chuẩn trước được lưu lịch sử.

#### Tab “Theo kỳ”

- Chọn kỳ.
- Nếu kỳ chưa có rubric: tạo bản nháp từ bộ chuẩn hoặc sao chép từ một kỳ khác.
- Chỉnh bản nháp độc lập của kỳ.
- Ban hành rubric cho kỳ.
- Rubric đã ban hành hoặc kỳ đã chốt là chỉ đọc.

Nguyên tắc version:

- Bộ chuẩn là mẫu.
- Mỗi kỳ dùng bản sao riêng.
- Sửa bộ chuẩn cho tương lai không thay đổi rubric và điểm lịch sử của kỳ cũ.
- Backend kiểm tra tổng khung/tiêu chí khi lưu và ban hành.

### 7.8 Tài liệu quy chế — `/admin/knowledge-base`

- Danh sách tài liệu từ DB.
- Tìm theo tên/số hiệu.
- Thêm tài liệu với tên, phiên bản/số hiệu, ngày hiệu lực và URL tệp.
- Xóa tài liệu theo điều kiện Backend.
- Hiển thị trạng thái hiệu lực.

Giới hạn hiện tại:

- FE đang lưu URL, chưa có giao diện upload file trực tiếp vào Storage tại trang này.
- Schema có `RegulationChunk` và vector embedding, nhưng chưa có pipeline lập chỉ mục RAG đang vận hành.
- Không nên mô tả tài liệu là đã được AI đọc nếu chưa có chunk/embedding thật.

### 7.9 Giám sát & nhật ký — `/admin/monitoring`

Có hai tab:

#### Tab “Nhật ký”

- Phân trang audit log từ Backend.
- Lọc action và entity type.
- Tìm trong trang hiện tại theo người thao tác, email, ID hoặc IP.
- Bảng thời gian, người thực hiện, hành vi, đối tượng, IP.
- Popup xem JSON dữ liệu trước/sau thay đổi.

Lưu ý: một số lựa chọn filter trên FE còn tên action legacy như `EDIT_RULE`; audit thực tế của workflow mới có các action như gửi Khoa, CTSV trả, công bố, mở phúc khảo và chốt kỳ.

#### Tab “Trạng thái dịch vụ”

- Gọi API health thật.
- Hiển thị trạng thái Database, Backend API và AI.
- AI phân biệt chưa cấu hình, đã cấu hình nhưng chưa kiểm tra, khỏe hoặc không khả dụng.
- Hiển thị thời điểm kiểm tra và uptime.

---

## 8. Trạng thái nghiệp vụ quan trọng

### 8.1 Trạng thái kỳ

| Trạng thái | Ý nghĩa |
|---|---|
| `UPCOMING` | Kỳ sắp tới, chưa cho sinh viên nhập/nộp. |
| `ACTIVE` | Đang nhận tự đánh giá và minh chứng. |
| `REVIEWING` | Đã công bố tạm/đang xử lý phúc khảo. |
| `CLOSED` | Đã chốt chính thức, chỉ xem. |

### 8.2 Trạng thái phiếu sinh viên

| Trạng thái | Ý nghĩa |
|---|---|
| `DRAFT` | Sinh viên đang lưu dở, còn được sửa. |
| `SUBMITTED` | Đã nộp, sinh viên bị khóa sửa, Khoa được xử lý. |
| `RETURNED` | Cán bộ trả kèm lý do; sinh viên sửa và nộp lại. |

### 8.3 Trạng thái đánh giá tiêu chí

| Trạng thái | Ý nghĩa |
|---|---|
| `NEEDS_VERIFICATION` | Chưa đủ dữ liệu xác minh để đề xuất/chốt. |
| `READY_FOR_REVIEW` | Backend đã có đề xuất theo quy tắc, chờ cán bộ xác nhận. |
| `FINALIZED` | Cán bộ đã chốt điểm chính thức của tiêu chí. |

### 8.4 Trạng thái bàn giao Khoa → CTSV

Giao diện suy ra các nhãn:

- `NOT_SUBMITTED`: sinh viên chưa nộp.
- `STUDENT_RETURNED`: phiếu đang chờ sinh viên sửa.
- `REVIEWING`: Khoa đang chấm.
- `READY`: Khoa đã hoàn tất và đủ điều kiện gửi.
- `SENT`: Khoa đã gửi CTSV.
- `PUBLISHED`: CTSV đã công bố revision hiện tại.
- `FACULTY_RETURNED`: CTSV trả Khoa.
- `NOT_SUBMITTED_RECORDED`: đã ghi nhận sinh viên không nộp sau hạn.

### 8.5 Trạng thái minh chứng

`DRAFT`, `PROCESSING`, `VERIFIED`, `PLAUSIBLE`, `NEEDS_SUPPLEMENT`, `NEEDS_HUMAN_REVIEW`, `INVALID`, `APPROVED`, `REJECTED`, `APPEALING`, `WITHDRAWN`.

Các trạng thái trung gian không phải kết luận điểm. Chỉ `CriterionAssessment.officialScore` đã `FINALIZED` mới tham gia tổng điểm nội bộ; sinh viên chỉ thấy theo snapshot đã công bố trong workflow mới.

---

## 9. Cách Backend tính và bảo vệ điểm

1. Sinh viên nhập `selfScore`; Backend kiểm tra trong khoảng `0..criterion.maxScore`.
2. Minh chứng được gắn vào đúng `CriterionAssessment` của sinh viên, kỳ và rubric đang ban hành.
3. Cán bộ xác minh các trường dữ liệu mà `scoringConfig` yêu cầu.
4. `rubric-scoring.ts` tính `suggestedScore` và giải thích; thiếu dữ liệu thì không tự cấp điểm.
5. Cán bộ xác nhận `officialScore`; nếu khác đề xuất thì phải có lý do.
6. Tổng mỗi khung là tổng điểm chính thức nhưng không vượt `RubricCategory.maxScore`.
7. Tổng toàn phiếu không vượt 100.
8. Khi Khoa gửi, Backend tạo snapshot và kiểm tra:
   - Sinh viên đã nộp.
   - Tất cả tiêu chí đã chốt và có căn cứ.
   - Không còn minh chứng trung gian/chờ xử lý.
   - Không còn phúc khảo chờ.
9. Khi CTSV công bố, snapshot được ghi vào `AssessmentPublication` với `revision`; không ghi đè bản công bố cũ.
10. Khi chốt kỳ, Backend kiểm tra revision mới nhất của mọi phiếu đã được công bố và không còn phúc khảo chờ.

Xếp loại hiện tại trong workflow:

- Từ 90: Xuất sắc.
- Từ 80: Tốt.
- Từ 65: Khá.
- Từ 50: Trung bình.
- Dưới 50: Yếu.

Ngưỡng này nằm trong Backend hiện tại; ảnh rubric của trường chỉ cung cấp tiêu chí/điểm, không phải nguồn của ngưỡng xếp loại.

---

## 10. AI và luồng minh chứng

### 10.1 Khi sinh viên còn soạn

- Minh chứng ở `DRAFT`.
- Có thể sửa, xóa, thêm/xóa tệp.
- Chưa tạo kết luận AI như điểm thật.

### 10.2 Khi nộp phiếu

- Backend chuyển minh chứng nháp sang `PROCESSING`.
- Tạo `AiProcessingJob` bền vững trong DB.
- Worker claim job và tăng số lần thử.
- Mỗi lần chạy tạo `AiPipelineRun` và `AiPipelineStep`, lưu hash/phiên bản đầu vào, rubric/model/config version.

### 10.3 Khi AI thành công

- Response phải có danh sách suggestions.
- Criterion ID phải thuộc đúng rubric.
- Điểm gợi ý phải trong trần tiêu chí.
- Confidence nếu có phải trong `0..1`.
- Lý do không được trống.
- Gợi ý lưu ở `AiSuggestion`; minh chứng chuyển để cán bộ xem.

### 10.4 Khi AI lỗi hoặc chưa cấu hình

- Chưa cấu hình: job `UNAVAILABLE`.
- Lỗi tạm thời: thử lại tối đa theo worker hiện tại.
- Hết retry: `FAILED`.
- Minh chứng vẫn được giữ, chuyển cán bộ xử lý thủ công.
- Không tự gán điểm 0 và không làm mất hồ sơ.

### 10.5 Khi hồ sơ thay đổi hoặc đã khóa

- Worker so version, hash, rubric, submission, handoff và trạng thái kỳ trong transaction.
- Nếu kết quả AI không còn hợp lệ, job/run/step chuyển `CANCELLED`.
- Kết quả cũ không ghi đè quyết định cán bộ.

### 10.6 Phần AI chưa hoàn thiện

- Chưa có microservice AI nội bộ thực thi OCR/phân loại.
- Chưa có dashboard job/run chi tiết cho Admin.
- Chưa có UI cấu hình model thật.
- Chưa có Ground Truth/evaluation run có version.
- Chưa có RAG ingest cho tài liệu quy chế.
- Các file `AiCenter.tsx`, `AiConfig.tsx`, `GroundTruth.tsx`, `AiEvaluation.tsx` còn trong source nhưng route đều redirect về `/admin`; không được coi là chức năng đang hoạt động.

---

## 11. Kiến trúc Backend và trách nhiệm từng module

| Thư mục/file | Trách nhiệm hiện tại |
|---|---|
| `src/main.ts` | Bootstrap Nest, prefix `/api`, CORS, JSON 12 MB, ValidationPipe, filter/interceptor và Swagger. |
| `src/app.module.ts` | Ghép các module nghiệp vụ. |
| `src/common/prisma` | Prisma client dùng chung. |
| `src/common/guards` | JWT và kiểm tra role. |
| `src/common/interceptors/response.interceptor.ts` | Chuẩn hóa response thành envelope `data`. |
| `src/common/filters/http-exception.filter.ts` | Chuẩn hóa lỗi API. |
| `src/auth` | Đăng nhập, lấy user hiện tại, đổi/quên mật khẩu, logout. |
| `src/users` | CRUD/import tài khoản; áp phạm vi Khoa khi cán bộ tra cứu. |
| `src/criteria` | CRUD kỳ/Khoa/Lớp/tài liệu, rubric template, rubric theo kỳ, 16 tiêu chí và cấu hình điểm. |
| `src/criteria/dut-rubric.ts` | Định nghĩa bộ tiêu chí ĐHBK được dùng làm nguồn tạo rubric. |
| `src/criteria/rubric-scoring.ts` | Máy tính điểm đề xuất theo dữ liệu xác minh. |
| `src/assessments` | Lưu/nộp/trả phiếu, xác minh và chốt điểm từng tiêu chí. |
| `src/evidence` | CRUD hồ sơ/tệp, Storage, scope quyền, submit/withdraw và worker AI. |
| `src/reviews` | Hàng đợi, claim/release và quyết định tính hợp lệ minh chứng. Không phải nguồn tổng điểm. |
| `src/evaluation-workflow` | Snapshot danh sách kỳ, gửi Khoa, trả Khoa, ghi nhận không nộp, công bố revision và chốt kỳ. |
| `src/appeals` | Sinh viên tạo phúc khảo; cán bộ xử lý và mở lại đánh giá khi chấp thuận. |
| `src/conduct-scores` | API `/scores`; tính dashboard/điểm từ rubric assessment và publication. Tên module được giữ để tương thích route, nhưng không còn bảng `ConductScore`. |
| `src/activities` | Hoạt động nội/ngoại trường và danh sách tham gia. |
| `src/reports` | Tổng hợp báo cáo theo kỳ/Khoa/lớp từ nguồn rubric mới. |
| `src/notifications` | Danh sách và đánh dấu thông báo đã đọc. |
| `src/audit-log` | Nhật ký Admin và health check Backend/DB/AI. |
| `prisma/schema.prisma` | Nguồn schema thực thi. |
| `prisma/migrations` | Lịch sử thay đổi schema; không sửa migration đã chạy. |
| `prisma/seed.ts` | Script seed tồn tại nhưng không được chạy lên DB thật nếu chưa có chỉ định rõ. |

---

## 12. Nhóm API hiện hành

| Prefix | Người dùng chính | Công dụng |
|---|---|---|
| `/api/auth` | Tất cả | Login, me, đổi/quên mật khẩu, logout. |
| `/api/users` | Admin; Staff đọc có scope | Người dùng/import. |
| `/api/terms`, `/api/faculties`, `/api/classes` | Admin quản lý | Dữ liệu nền. |
| `/api/criteria`, `/api/rubric-templates`, `/api/terms/:id/rubric` | Tất cả đọc rubric; Admin quản lý | Rubric và tiêu chí. |
| `/api/assessments` | Sinh viên/Khoa/Admin | Phiếu tự đánh giá và điểm tiêu chí. |
| `/api/evidence` | Sinh viên/Khoa/Admin theo quyền | Hồ sơ và tệp minh chứng. |
| `/api/reviews/queue`, `/api/evidence/:id/review` | Cán bộ Khoa | Hàng đợi và quyết định minh chứng. |
| `/api/evaluation-workflow` | Khoa/Admin | Bàn giao, công bố, chốt. |
| `/api/appeals` | Sinh viên/Khoa/Admin | Phúc khảo. |
| `/api/activities` | Đọc chung; Admin/Staff ghi | Hoạt động và điểm danh. |
| `/api/scores` | Sinh viên/Khoa/Admin | Dashboard và truy vết điểm. |
| `/api/reports` | Khoa/Admin | Báo cáo tổng hợp. |
| `/api/regulations` | Đọc chung; Admin ghi | Tài liệu quy chế. |
| `/api/notifications` | Người đã đăng nhập | Thông báo của chính user. |
| `/api/audit-logs` | Admin | Nhật ký. |
| `/api/health` | Route health | Trạng thái dịch vụ. |

Swagger sinh từ code ở `http://localhost:3001/api/docs` khi Backend chạy.

---

## 13. Database hiện tại

### 13.1 Tài khoản và cơ cấu

- `Faculty`: Khoa.
- `Class`: Lớp, thuộc Khoa.
- `User`: tài khoản; sinh viên thuộc Lớp, cán bộ thuộc Khoa.

### 13.2 Kỳ, rubric và đánh giá

- `Term`: kỳ và các deadline.
- `RubricTemplate`, `RubricTemplateVersion`: bộ chuẩn và phiên bản mẫu.
- `RubricVersion`: bản rubric riêng của một kỳ.
- `RubricCategory`: 5 khung điểm.
- `Criterion`: tiêu chí, trần điểm, mô tả và `scoringConfig`.
- `AssessmentSubmission`: trạng thái nộp toàn phiếu.
- `CriterionAssessment`: tự đánh giá, dữ liệu xác minh, đề xuất và điểm chính thức từng mục.
- `AssessmentHandoff`: snapshot phân công và trạng thái Khoa → CTSV.
- `AssessmentPublication`: snapshot công bố append-only theo revision.

### 13.3 Hoạt động và minh chứng

- `Activity`, `ActivityParticipant`.
- `Evidence`, `EvidenceFile`.
- `Review`, `SupplementRequest`.
- `Appeal`.

### 13.4 AI và xác minh

- `AiProcessingJob`.
- `AiPipelineRun`, `AiPipelineStep`.
- `OcrResult`.
- `VerificationResult`.
- `AnomalyFlag`.
- `AiSuggestion`.

### 13.5 Hệ thống

- `RegulationDocument`, `RegulationChunk`.
- `AuditLog`.
- `Notification`.

Các bảng legacy đã xóa:

- `Rule`.
- `ConductScore`.
- Enum `RuleStatus`.

---

## 14. Cấu trúc thư mục toàn repository

```text
PBL6/
├── apps/
│   ├── backend/               # NestJS API + Prisma, phần Backend đang hoạt động
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Schema database chính
│   │   │   ├── migrations/    # Migration đã version hóa
│   │   │   └── seed.ts        # Seed thủ công, không tự chạy trên DB thật
│   │   ├── src/               # Controller/service/module theo nghiệp vụ
│   │   ├── test/              # Test worker AI hiện có
│   │   └── dist/              # Kết quả build, không phải nguồn để sửa
│   ├── web/                   # React/Vite Web đang phát triển chính
│   │   ├── public/            # Logo/tài nguyên tĩnh
│   │   ├── src/
│   │   │   ├── components/    # Component dùng chung, EvaluationBoard
│   │   │   ├── context/       # AuthContext và kỳ đang chọn
│   │   │   ├── layouts/       # Header/sidebar/breadcrumb
│   │   │   ├── lib/           # Axios API client
│   │   │   ├── pages/         # common/student/officer/admin
│   │   │   ├── types/         # TypeScript domain types
│   │   │   └── routes.tsx     # Nguồn route Web hiện hành
│   │   └── dist/              # Kết quả Vite build
│   ├── mobile/                # Khung Expo gần như toàn file 0 byte; chưa thuộc bản Web hiện tại
│   └── ai-service/            # Khung Python/model rỗng; chưa chạy được
├── packages/
│   └── ai-core/               # Khung package chia sẻ AI, hiện source rỗng
├── research/
│   └── activity-classification/ # Khung nghiên cứu/dataset rỗng
├── docs/
│   ├── 00-nghiep-vu-goc/      # Tài liệu nghiệp vụ đầu vào
│   ├── 01-tinh-nang-techstack/# Mô tả ý tưởng/techstack cũ
│   ├── 02-database/            # Bản schema để tham khảo; schema thực thi ở apps/backend
│   ├── 03-giao-dien/           # Thiết kế/sketch cũ
│   ├── 05-feature-specs/       # Đặc tả mục tiêu theo mã chức năng, không đồng nghĩa đã làm
│   ├── 06-ke-hoach-trien-khai/ # Kế hoạch và tiến độ các đợt trước
│   └── 07-hien-trang-he-thong/ # File sổ tay hiện trạng này
├── docker-compose.yml          # Hạ tầng local từng dùng để kiểm tra
├── EduPoint_*.md               # Tài liệu thiết kế/API gốc ở root
├── cautruc.md                  # Cấu trúc/ý tưởng ban đầu
└── README.md                   # Hiện còn trống
```

Quy tắc khi sửa:

- Sửa source trong `apps/*/src`, không sửa `dist`.
- Sửa schema tại `apps/backend/prisma/schema.prisma` và tạo migration mới.
- `docs/02-database/schema.prisma` chỉ là bản tài liệu; cần đồng bộ nếu thay đổi schema quan trọng nhưng không dùng nó để migrate.
- Không sử dụng các thư mục `mocks` hoặc mock API cho luồng dữ liệu thật.

---

## 15. Các trang/file còn tồn tại nhưng không hoạt động trong điều hướng chính

| File/route cũ | Hiện trạng |
|---|---|
| `student/SubmitEvidence.tsx` | File còn nhưng route tạo mới chuyển về `/student/scores`; popup trong phiếu là luồng chuẩn. |
| `student/WhatCanIClaim.tsx` | File còn nhưng route redirect về phiếu. |
| `officer/ExternalActivities.tsx` | File còn; route chuyển về tab ngoài trường của `/officer/activities`. |
| `officer/Reports.tsx` | File còn; route `/officer/reports` chuyển về `/officer/students`. |
| `admin/AiCenter.tsx` | Không mở; route redirect `/admin`. |
| `admin/AiConfig.tsx` | Không mở; route redirect `/admin`. |
| `admin/GroundTruth.tsx` | Không mở; route redirect `/admin`. |
| `admin/AiEvaluation.tsx` | Không mở; route redirect `/admin`. |
| `admin/AuditLogs.tsx` | Được nhúng trong tab của Monitoring; route riêng redirect. |
| `admin/SystemHealth.tsx` | Được nhúng trong tab của Monitoring; route riêng redirect. |
| `RuleEngineEditor.tsx` | Đã xóa. Quy tắc nằm trong rubric/scoring config Backend. |
| `student/CriteriaView.tsx` | Đã xóa; phiếu tự đánh giá thay thế. |

Codex không nên mở lại các menu AI/legacy chỉ vì file vẫn còn. Chỉ kích hoạt khi Backend/API và nghiệp vụ đã hoàn thiện.

---

## 16. Empty state, loading và lỗi kỳ vọng

Mọi trang lấy dữ liệu thật phải phân biệt:

- **Loading:** skeleton hoặc dòng “Đang tải…”.
- **Empty:** API thành công nhưng không có bản ghi; hiện giải thích và hành động phù hợp.
- **Error:** API lỗi/network; hiện thông báo và nút thử lại khi hợp lý.
- **Locked:** có dữ liệu nhưng người dùng không được sửa vì trạng thái kỳ/phiếu/bàn giao.
- **Unavailable AI:** giữ hồ sơ và chuyển xử lý thủ công.

Không được:

- Hiện trang trắng chỉ vì mảng dữ liệu rỗng.
- Hiện số 0 như điểm chính thức khi chưa có assessment/publication.
- Dùng số liệu viết cứng làm KPI.
- Tự sinh rubric/minh chứng/điểm khi API không có dữ liệu.
- Gọi dữ liệu seed/mock là dữ liệu thật.

---

## 17. Những điểm còn cần hoàn thiện

### Ưu tiên cao

- Nghiệm thu trực quan toàn bộ luồng ba vai trò trên một DB kiểm thử có dữ liệu đủ trạng thái.
- Bổ sung test tích hợp quyền Khoa, đặc biệt truy cập trực tiếp bằng ID.
- Xác minh/hoàn thiện luồng quên và reset mật khẩu giữa FE–BE.
- Sửa link kỳ lịch sử trong `EvaluationBoard`: hiện trỏ tới `/admin/historical-results` hoặc `/officer/students/legacy` nhưng routes này chưa được khai báo.
- Đồng bộ filter audit log với action thực tế của workflow mới.
- Kiểm tra layout các bảng dài ở độ rộng laptop phổ biến để không tạo scroll lồng không cần thiết.

### AI

- Xây dịch vụ AI thật theo contract hiện tại.
- Trả output OCR, phân loại, đối chiếu và suggestion có version.
- Thêm cơ chế phục hồi job `PROCESSING` khi Backend dừng giữa chừng.
- Có trang giám sát job/run/step thật trước khi mở menu AI.
- Có tập kiểm chuẩn và evaluation run version hóa trước khi hiển thị metric chất lượng.

### Dữ liệu và vận hành

- Thiết lập chính sách backup/restore Supabase chính thức.
- Chuẩn hóa chính sách lưu trữ/xóa tệp Storage khi hồ sơ bị xóa.
- Xác nhận index và hiệu năng khi số sinh viên/minh chứng tăng lớn.
- Bổ sung README chạy dự án và CI kiểm tra migration/build/test.

### Code/UI còn legacy

- Một số file/trường như `classScore`, `classNote`, quyết định `SCORE_ADJUSTED` còn trong schema/type để tương thích lịch sử nhưng không thuộc luồng mới.
- Một số tiêu đề còn mã cũ như C03/C05/S09; có thể dọn khi hoàn thiện nội dung, nhưng không ảnh hưởng nghiệp vụ.
- `UserManagement.tsx` rất lớn; nên tách component theo Tài khoản/Khoa/Lớp/Import để dễ test và bảo trì.
- `ScoreReport.tsx` và `ReviewDetail.tsx` cũng lớn; nên tách popup/section thành component có test.

---

## 18. Checklist đối chiếu nhanh trước khi thay đổi hệ thống

### Nếu sửa phiếu sinh viên

- Đọc `ScoreReport.tsx`.
- Đọc `assessments.service.ts` và `evidence.service.ts`.
- Kiểm tra `AssessmentSubmission`, `CriterionAssessment`, `Evidence`.
- Không mở đường tạo minh chứng thứ hai.

### Nếu sửa màn cán bộ

- Đọc `EvaluationBoard.tsx`, `StudentAssessment.tsx`, `ReviewDetail.tsx`.
- Đọc `workflow.service.ts`, `reviews.service.ts`, `assessments.service.ts`.
- Kiểm tra scope Khoa và điều kiện khóa phiếu.

### Nếu sửa Admin/rubric

- Đọc `CriteriaManager.tsx`, `TermsMasterData.tsx`.
- Đọc `criteria.service.ts`, `dut-rubric.ts`, `rubric-scoring.ts`.
- Giữ lịch sử version; không sửa ngược rubric đã dùng/chốt.

### Nếu sửa AI

- Đọc `evidence-processing.worker.ts`.
- Giữ kiểm tra stale result và transaction lock.
- Không để AI ghi `officialScore`.
- Giữ fallback cán bộ thủ công.

### Nếu sửa database

- Đọc toàn bộ schema và migrations mới nhất.
- Kiểm tra số dòng/quan hệ bằng truy vấn chỉ đọc.
- Tạo migration tương thích và test trên DB riêng.
- Không reset, seed hoặc drop dữ liệu thật khi chưa được duyệt.

---

## 19. Nguồn sự thật ưu tiên

Khi tài liệu mâu thuẫn, dùng thứ tự sau:

1. Yêu cầu mới nhất đã được chủ dự án xác nhận.
2. Mã Backend + Prisma migration đang chạy.
3. Route/menu và API client Web hiện tại.
4. File sổ tay này, sau khi đối chiếu ngày/commit.
5. Tài liệu kế hoạch trong `docs/06-ke-hoach-trien-khai`.
6. Feature specs và tài liệu thiết kế cũ.

Rubric/điểm chính thức luôn phải truy về phiên bản theo kỳ trong database; không dùng ảnh minh họa, seed hoặc số hiển thị cũ làm dữ liệu kết quả.

---

## 20. Kết luận hiện trạng

Phần Web và Backend hiện đã có xương sống nghiệp vụ đầy đủ cho ba vai trò:

- Sinh viên tự đánh giá và quản lý minh chứng theo 16 tiêu chí.
- Cán bộ Khoa xác nhận căn cứ, nhận đề xuất theo quy tắc và chốt từng tiêu chí.
- Khoa bàn giao kết quả cho CTSV.
- CTSV công bố theo revision, nhận phúc khảo và chốt kỳ.
- Rubric có version theo bộ chuẩn và theo kỳ.
- AI có hợp đồng job/run an toàn và fallback thủ công nhưng chưa có model/service thật.

Trạng thái phù hợp nhất để mô tả dự án là: **Core workflow đã được cài đặt trong mã và đã build; cần tiếp tục nghiệm thu tích hợp/UI bằng dữ liệu kiểm thử có kiểm soát, hoàn thiện một số route legacy và xây pipeline AI thật trước khi đưa vào vận hành chính thức.**
