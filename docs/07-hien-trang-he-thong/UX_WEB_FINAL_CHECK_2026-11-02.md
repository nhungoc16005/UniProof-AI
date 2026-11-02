# Chốt ba điểm UX trước giai đoạn AI — 02/11/2026

Phạm vi: Student Dashboard/Chấm điểm, Admin Tiếp nhận & công bố và Khoa Phiếu rèn luyện. Không thay đổi API, migration, Supabase hoặc chính sách điểm; AI giữ ở giai đoạn tiếp theo.

## Phiếu bị trả và khóa tiếp nhận

- Student có badge cam “Bị trả phiếu — cần chỉnh sửa”, đầy đủ lý do và hạn nộp lại.
- Dashboard có “Sửa & Nộp lại”, dẫn đến phiếu của kỳ hiện tại. Trang chấm điểm dùng “Nộp lại phiếu”. Khi không còn quyền sửa, CTA bị vô hiệu hóa và lý do trả vẫn còn.
- CLOSED hiển thị “Kỳ đánh giá đã đóng cổng tiếp nhận. Phiếu chỉ được xem.”, ưu tiên trước thông báo phiếu đang chờ cán bộ.
- REVIEWING khóa nộp mới. Ngoại lệ đã thống nhất: phiếu RETURNED được sửa và nộp lại đến reviewDeadline. Khi hết hạn, chuyển về chỉ xem.
- Backend vẫn là nguồn quyền `permissions.canEdit`; deadline phía trình duyệt chỉ khóa sớm giao diện và kích hoạt kiểm tra lại, không cấp quyền thay backend.
- Quyền được làm mới khi focus/visibility trở lại, mỗi 60 giây khi trang hiển thị và tại deadline. Nếu một request cũ đang chạy khi focus, kiểm tra lại sau khi request đó hoàn tất.
- Không làm mới toàn bộ form trong quá trình kiểm tra quyền: giữ điểm, nội dung minh chứng và File chưa lưu. Khi lỗi kiểm tra quyền, tạm khóa ghi và có Thử lại, kể cả trong popup minh chứng. Trả response của kỳ cũ không được ghi đè kỳ mới.

## Loading, empty state và lỗi danh sách

- Bộ lọc và khung trang vẫn hiện khi tải; skeleton có nhãn “Đang tải danh sách phiếu…”.
- Dòng và chỉ số của bộ lọc cũ không hiển thị như kết quả mới trong thời gian request đang chạy.
- Không có danh sách kỳ: icon vector và giải thích. Admin được dẫn đến Quản lý kỳ đánh giá; Khoa được hướng dẫn liên hệ Phòng CTSV.
- Không có kết quả: “Không tìm thấy phiếu phù hợp”, nút Xóa bộ lọc giữ nguyên termId và xóa tìm kiếm/trạng thái/Khoa/lớp/trang.
- Lỗi tải có trạng thái lỗi riêng và Thử lại; không thay thành thông báo danh sách rỗng hoặc vẽ bảng trắng.

## Kiểm thử

Bổ sung kịch bản vào `apps/backend/test/workflow.integration.test.cjs` cho REVIEWING thường, RETURNED còn/quá hạn chấm và CLOSED; gọi API ghi trực tiếp để xác nhận server tiếp tục chặn đúng quyền.

`apps/backend/test/ux-checks.cjs` chạy cùng browser-smoke trên Chrome và PostgreSQL riêng:

- Giữ request để kiểm tra skeleton, toolbar còn hiện và dòng cũ biến mất.
- Kiểm tra empty state đúng quyền cho cả Admin/Khoa, lọc rỗng, xóa bộ lọc giữ kỳ, lỗi mạng và retry.
- Kiểm tra ACTIVE hết hạn, REVIEWING chỉ xem, RETURNED có badge/lý do/deadline/CTA và ngoại lệ sửa.
- Nhập điểm/nội dung và chọn File thật chưa upload; kiểm tra còn nguyên sau focus refresh, lỗi kiểm tra quyền và retry.
- Nộp lại qua API thật, xác nhận điểm được lưu, trạng thái SUBMITTED, badge bị trả biến mất và phiếu bị khóa.
- Cho deadline thực sự trôi qua trong lúc mở trang, xác nhận khóa và giữ bản nháp.
- Kiểm tra định kỳ phát hiện CLOSED và thông báo CLOSED ưu tiên hơn phiếu đang chờ. Timer 60 giây được tăng tốc trong script test; ứng dụng vẫn dùng 60 giây.

Tất cả fixture có ghi dữ liệu chỉ dùng TEST_DATABASE_URL localhost với tên database `_test`; không dùng dữ liệu Supabase thật. Build Backend/Web và kiểm tra TypeScript được chạy để kiểm tra hồi quy. Web vẫn có cảnh báo kích thước bundle đã biết từ trước.

## Kết quả thực chạy

- Backend/Web build và TypeScript độc lập: đạt. Web còn cảnh báo bundle lớn đã có từ trước.
- API tích hợp PostgreSQL: 13 kịch bản con (14 test theo bộ đếm Node), đạt, bao gồm các điều kiện ghi REVIEWING/RETURNED/CLOSED bổ sung trong đợt này.
- Chrome: bộ smoke hiện có và 11 kiểm tra UX bổ sung đều đạt; giữ draft/File, recovery khi lỗi mạng, deadline đang mở và ưu tiên thông báo CLOSED đã được xác nhận bằng trình duyệt.
- `git diff --check`: đạt. Không tạo migration và không thay đổi Supabase trong đợt UX này.
