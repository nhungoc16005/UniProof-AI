# TÀI LIỆU CHI TIẾT CÁC THAY ĐỔI VÀ TỐI ƯU HỆ THỐNG (WORKFLOW AUDIT & CLEAN UI)

*Thời gian cập nhật: Tháng 10/2026*  
*Dự án: Hệ thống Quản lý và Đánh giá Điểm rèn luyện Sinh viên (EduPoint / UniProof-AI)*

---

## 1. TỔNG QUAN VÀ ĐỘNG LỰC THAY ĐỔI

Trong quá trình vận hành và kiểm thử hệ thống, xuất hiện các bất cập lớn về trải nghiệm người dùng (UI/UX) và tính toàn vẹn dữ liệu:
1. **Dữ liệu giả lập (Mock data) còn tồn đọng**: Một số trang vẫn dùng danh sách cứng, link ảnh ngoài mạng (`unsplash.com`, `placehold.co`), hàm giả lập thời gian trễ `setTimeout` thay vì gọi API thực tế.
2. **Giao diện rườm rà, rối mắt**: Nhiều khối thẻ lồng nhau (nested cards), wizard nhiều bước (stepper) gây cản trở thao tác nhanh của người quản trị, lạm dụng emoji không phù hợp với ngữ cảnh học thuật đại học.
3. **Bất cập trong quy trình nghiệp vụ (Workflow)**:
   - **Quản lý học kỳ**: Cán bộ quản trị cần thao tác nhanh cấu hình hạn nộp và hạn duyệt, nhưng hệ thống trước đây bắt qua wizard 4 bước kèm popup đóng sổ không cần thiết.
   - **Nộp minh chứng**: Sinh viên chọn hoạt động trong trường nhưng phải tự nhập tay tên đơn vị, không liên kết với kho hoạt động thực tế của nhà trường.
   - **Khiếu nại**: Cho phép bấm khiếu nại cả hồ sơ đang ở trạng thái Nháp (Draft) hoặc Chờ duyệt (Pending), gây sai lệch quy trình xử lý của cán bộ.
   - **Quản lý tiêu chí**: Admin chỉ có thể Thêm và Xóa, thiếu hoàn toàn tính năng Chỉnh sửa tiêu chí khi có điều chỉnh quy chế.

---

## 2. BẢNG SO SÁNH CHI TIẾT TRƯỚC VÀ SAU CẢI TIẾN

| Hạng mục | Trước khi sửa đổi (Before) | Sau khi hoàn thiện (After) |
| :--- | :--- | :--- |
| **Nguồn dữ liệu** | Trộn lẫn giữa API thật và mock array tĩnh, ảnh Unsplash, placeholder giả. | **100% Real Database & Real API**, liên thông giữa PostgreSQL, NestJS backend và React frontend. |
| **Quản lý Học kỳ (Admin)** | Wizard Stepper 4 bước phức tạp, popup đóng sổ rườm rà, khó theo dõi tổng quan. | **Bảng dữ liệu phẳng (Flat Table)** tối giản: hiển thị rõ hạn nộp, hạn duyệt, trạng thái, modal xác nhận chốt sổ trực tiếp. |
| **Quản lý Tiêu chí (Admin)** | Chỉ có nút Tạo mới và Xóa tiêu chí. | Bổ sung nút **Sửa** từng tiêu chí, modal cập nhật tên, mô tả, khung danh mục và điểm trần tối đa qua API `PATCH /criteria/:id`. |
| **Nộp minh chứng (Sinh viên)** | Danh sách hoạt động nội bộ là mảng cố định; ảnh demo là Unsplash ngẫu nhiên. | Nạp trực tiếp từ `GET /activities?type=INTERNAL`; tự động điền đơn vị tổ chức, ngày và mã hoạt động; xử lý ảnh upload thật từ thiết bị. |
| **Chi tiết minh chứng (Sinh viên)** | Gửi khiếu nại bằng `setTimeout(..., 1000)`; bổ sung file gửi URL giả `placehold.co`. | Gửi khiếu nại qua `POST /appeals` thật; modal bổ sung hồ sơ cho phép chọn tệp thật từ máy tính. |
| **Điều kiện Khiếu nại** | Cho phép khiếu nại mọi trạng thái hồ sơ. | Chỉ cho phép khiếu nại khi hồ sơ đã có kết quả thẩm định chính thức (`APPROVED`, `REJECTED`, `SCORE_ADJUSTED`). |
| **Thẩm định hồ sơ (Cán bộ)** | Vẽ bounding box tọa độ cứng `box-name`, `box-code` đè lên ảnh; fallback ảnh mẫu Unsplash. | Loại bỏ bounding box vẽ bừa; hiển thị chuẩn xác file ảnh sinh viên tải lên; hỗ trợ phóng to toàn màn hình. |
| **Phong cách UI/UX** | Nhiều viền lồng nhau, màu sắc phân mảnh, sử dụng emoji trong cảnh báo và nhãn. | **Clean & Minimalist**: Đường nét phẳng, phân cấp chữ rõ ràng, loại bỏ 100% emoji, dùng icon vector đồng bộ. |

---

## 3. CHI TIẾT CÁC FILE ĐƯỢC THAY ĐỔI

### 3.1. Phân hệ Quản trị viên (Admin)
- **`apps/web/src/pages/admin/TermsMasterData.tsx`**:
  - Gỡ bỏ component Wizard Stepper 4 bước.
  - Xây dựng giao diện bảng quản lý phẳng: hiển thị Năm học, Học kỳ, Hạn nộp minh chứng, Hạn cán bộ duyệt, Trạng thái (Đang mở, Sắp diễn ra, Đã chốt).
  - Tích hợp modal xác nhận Đóng sổ và Kích hoạt lại kỳ học với cảnh báo an toàn.
  - Định dạng hiển thị ngày chuẩn `DD/MM/YYYY`.
- **`apps/web/src/pages/admin/CriteriaManager.tsx`**:
  - Thêm state và handler `handleOpenEdit`, `handleUpdate`.
  - Bổ sung nút **Sửa** cạnh nút Xóa trên từng dòng bảng tiêu chí.
  - Thêm modal Chỉnh sửa tiêu chí, cho phép sửa tên, mô tả, trần điểm tối đa và khung phân loại tiêu chí.

### 3.2. Phân hệ Sinh viên (Student)
- **`apps/web/src/pages/student/SubmitEvidence.tsx`**:
  - Xóa mảng mock data tĩnh `internalActivities`.
  - Kết nối nạp danh sách hoạt động nội bộ thật qua `apiClient.getActivities({ type: 'INTERNAL' })`.
  - Tự động điền thông tin đơn vị tổ chức, ngày hoạt động khi sinh viên chọn hoạt động trong trường.
  - Hỗ trợ tải tệp thật từ máy tính (qua `FileReader` Base64/Data URL), hiển thị bản xem trước ảnh thật hoặc tệp tài liệu.
  - Xóa bỏ các điều kiện kiểm tra chuỗi Unsplash.
- **`apps/web/src/pages/student/EvidenceDetail.tsx`**:
  - Loại bỏ giả lập thời gian `setTimeout(..., 1000)`.
  - Kết nối API khiếu nại thật: `apiClient.createAppeal({ evidenceId, reason, desiredScore })`.
  - Nâng cấp modal Bổ sung hồ sơ: cho phép sinh viên duyệt tệp thật từ thiết bị thay vì gửi đường dẫn `placehold.co`.
  - Hiển thị ảnh minh chứng thật từ `evidence.files[0].fileUrl`, không fallback sang Unsplash.
- **`apps/web/src/pages/student/Appeals.tsx`**:
  - Lọc danh sách hồ sơ có thể khiếu nại: chỉ hiển thị hồ sơ đã được thẩm định có kết quả (`APPROVED`, `REJECTED`, `SCORE_ADJUSTED`), ngăn chặn khiếu nại hồ sơ chưa duyệt hoặc nháp.
- **`apps/web/src/pages/student/ScoreReport.tsx`**:
  - Loại bỏ emoji bóng đèn ở phần gợi ý nâng điểm rèn luyện, chuẩn hóa văn phong học thuật.

### 3.3. Phân hệ Cán bộ thẩm định (Officer)
- **`apps/web/src/pages/officer/ReviewDetail.tsx`**:
  - Xóa bỏ các khung tọa độ cứng (`box-name`, `box-code`) vẽ đè lên ảnh.
  - Hiển thị đúng tệp ảnh minh chứng của sinh viên hoặc thông báo tệp rõ ràng nếu không có ảnh.
  - Loại bỏ các emoji cảnh báo vượt trần điểm ở cả 2 modal Phê duyệt và Điều chỉnh điểm.
- **`apps/web/src/pages/officer/InternalActivities.tsx`**:
  - Xác thực liên thông toàn bộ các thao tác Thêm / Sửa / Xóa hoạt động và quản lý điểm danh đơn lẻ / hàng loạt với database PostgreSQL.

### 3.4. Thư viện kết nối API & Tiện ích chung
- **`apps/web/src/lib/apiClient.ts`**:
  - Xóa bỏ fallback URL giả `https://placehold.co/600x400.png` trong phương thức `supplementEvidence`.
- **`apps/web/src/pages/ForgotPassword.tsx`**:
  - Xóa bỏ ký tự trang trí `✦` để đồng nhất ngôn ngữ thiết kế.

---

## 4. HƯỚNG DẪN KIỂM TRA VÀ CHẠY THỰC TẾ

1. **Kiểm tra trạng thái Backend:**
   - Server NestJS chạy tại: `http://localhost:3001/api`
   - Kiểm tra lệnh build:
     ```bash
     cd apps/backend
     npm run build
     ```
     *(Kết quả: Biên dịch thành công, không có lỗi)*

2. **Kiểm tra trạng thái Frontend:**
   - Ứng dụng Vite chạy tại: `http://localhost:3000`
   - Kiểm tra lệnh build:
     ```bash
     cd apps/web
     npm run build
     ```
     *(Kết quả: Biên dịch thành công 100%, 0 lỗi TypeScript)*

3. **Quy trình kiểm thử liên thông (End-to-End Workflow):**
   - **Bước 1 (Admin - Kỳ học & Tiêu chí):** Truy cập `/admin/terms` để kiểm tra danh sách kỳ học theo bảng phẳng, ngày hạn nộp rõ ràng. Truy cập `/admin/criteria` bấm nút **Sửa** để chỉnh sửa một tiêu chí.
   - **Bước 2 (Cán bộ - Hoạt động):** Truy cập `/officer/activities` tạo một hoạt động nội bộ mới và thêm mã sinh viên vào danh sách điểm danh.
   - **Bước 3 (Sinh viên - Nộp hồ sơ):** Truy cập `/student/submit`, chọn hoạt động nội bộ vừa tạo để kiểm tra việc tự động điền đơn vị và tải tệp minh chứng thật.
   - **Bước 4 (Cán bộ - Thẩm định):** Truy cập `/officer/review` mở hồ sơ vừa nộp, kiểm tra ảnh minh chứng thật, duyệt điểm hoặc điều chỉnh điểm.
   - **Bước 5 (Sinh viên - Khiếu nại/Bổ sung):** Truy cập `/student/appeals` hoặc chi tiết minh chứng để nộp khiếu nại với lý do thật và bổ sung tệp từ máy.
