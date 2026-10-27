# Tiến độ chuẩn hóa Khoa và CTSV

Đối chiếu mã nguồn ngày 26/10/2026 với yêu cầu chuẩn hóa. “Đã có code” không đồng nghĩa đã nghiệm thu luồng trên cơ sở dữ liệu.

| Bước | Hiện trạng trong code | Phần cần nghiệm thu/hoàn thiện |
|---|---|---|
| 1. Sửa nghiệp vụ | Điểm rubric lấy từ đánh giá tiêu chí; phúc khảo mở lại đánh giá; kiểm tra phạm vi Khoa; danh sách và KPI dùng workflow | Kiểm thử ba vai trò, phạm vi Khoa và kỳ lịch sử trên DB riêng |
| 2. Gọn giao diện | Menu Khoa/CTSV đã tổ chức lại; hồ sơ có Phiếu đánh giá, Minh chứng, Lịch sử; quản lý đơn vị chuyển về tài khoản | Kiểm tra trực quan, bộ lọc URL và vị trí danh sách khi quay lại |
| 3. Bàn giao kết quả | Có API gửi Khoa, trả phiếu, ghi nhận không nộp, công bố phiên bản, chốt kỳ; có giao diện thao tác | Chạy migration và luồng hoàn chỉnh trên DB riêng; kiểm tra khóa sửa và quyền xem theo mốc công bố |
| 4. AI | Có job, run/step, phiên bản đầu vào, kiểm tra kết quả hết hiệu lực và fallback thủ công | Kết nối pipeline thật, giám sát xử lý và kiểm thử lỗi/khởi động lại worker |

## Phần tiếp tục trong lần rà soát này

- Tạo lại Prisma Client theo schema hiện tại để giải quyết lỗi kiểu dữ liệu Activity khi build Backend.
- Worker dùng khóa dòng Term cùng quy trình Khoa/CTSV, kiểm tra ngay trong transaction trước khi ghi kết quả: phiên bản minh chứng, rubric, trạng thái nộp, quyết định minh chứng, trạng thái bàn giao và trạng thái kỳ.
- Áp dụng kiểm tra cho cả nhánh thành công, chưa cấu hình và lỗi/retry. Kết quả đến muộn được hủy, không chuyển minh chứng đã quyết định về chờ duyệt và không ghi gợi ý vào phiên bản đã thay đổi.
- Dọn các nhãn Real Database/A10 còn hiện ở trang tiêu chí và nhật ký.
- Thêm 15 kiểm thử đơn vị cho điều kiện tiếp nhận/hủy kết quả AI. Các kiểm thử dùng đối tượng thay thế tại lớp dịch vụ, không dựng mock API, không kết nối DB và không thay thế nghiệm thu tích hợp.

## Xác minh đã thực hiện

- Backend: `npm run prisma:generate`, `npm run build`, `./node_modules/.bin/tsc --incremental false` thành công.
- Web: `npm run build` thành công; còn cảnh báo kích thước bundle.
- Tại thư mục gốc: `node --test apps/backend/test/evidence-processing-worker.test.cjs` — 15/15 đạt.
- Không chạy migration hoặc seed vào DB thật trong lần rà soát này. Migration có trong repo chưa chứng minh đã được áp dụng; cần đối chiếu trên DB riêng trước nghiệm thu.

## Bước tiếp theo

1. Dựng DB kiểm thử riêng và chạy chuỗi migration, đặc biệt migration bàn giao/công bố.
2. Tạo dữ liệu kiểm thử tại DB riêng cho hai Khoa và ba vai trò; kiểm tra nộp → xác minh → gửi → công bố → phúc khảo → gửi lại → chốt.
3. Kiểm tra đồng thời AI trả muộn với quyết định cán bộ trên DB thật của môi trường kiểm thử. Unit test hiện chỉ xác minh điều kiện chặn và thao tác khóa, chưa chứng minh cạnh tranh transaction thực tế.
4. Hoàn thiện quan sát job AI và xử lý job PROCESSING bị gián đoạn khi tiến trình dừng; sau đó nghiệm thu trực quan ba vai trò.

## Rà soát lỗi chạy ứng dụng tiếp theo — 26/10/2026

- Tái hiện `npm run start:prod` lỗi `Cannot find module dist/main`: build trước đây gom cả `prisma/seed.ts`, đưa entry vào `dist/src/main.js`. Thêm `tsconfig.build.json` chỉ biên dịch `src`, tạo đúng `dist/main.js`, tắt incremental cho build có xóa thư mục đầu ra. Đã build liên tiếp và kiểm tra entry/module import.
- Thêm `prebuild: prisma generate` để client tự đồng bộ schema trước mỗi build.
- Sửa payload điểm danh đơn: chuyển `role` của giao diện thành `formRole` mà DTO Backend chấp nhận. Payload cũ bị ValidationPipe từ chối do trường ngoài whitelist.
- Chuẩn hóa thông báo lỗi trong Axios interceptor từ `error.message` của response sang `message` mà các trang hiện đọc.
- Kiểm tra chỉ đọc trên Supabase xác nhận còn thiếu `20261026000100_ai_pipeline_runs` và `20261027000100_faculty_handoff_publication`. Đây là lỗi triển khai schema còn tồn tại, không thể giải quyết chỉ bằng `prisma generate`.
- Đã chạy cả 7 file migration SQL thành công trên DB mới `edupoint_fixcheck_20261026_v2` trong container PostgreSQL 16 riêng. Môi trường kiểm thử tạo extension `vector` trước baseline và bỏ duy nhất `SET transaction_timeout = 0` do lệnh này không có trên PG16. Không dùng seed hoặc mock API, không sửa file migration gốc. Kiểm tra này chưa thay thế nghiệm thu ba vai trò hoặc kiểm tra dữ liệu đang có.
- Supabase chưa được chạy hai migration còn thiếu trong lần sửa này. Khi triển khai cần áp dụng migration đã kiểm tra, giữ nguyên kỳ CLOSED và không chạy seed/reset.

## Đã cập nhật Supabase theo yêu cầu — 26/10/2026

- Người dùng đã cho phép áp dụng hai migration còn thiếu lên Supabase.
- `prisma migrate deploy` đã áp dụng thành công `20261026000100_ai_pipeline_runs` và `20261027000100_faculty_handoff_publication`. Không chạy reset hoặc seed.
- `prisma migrate status` xác nhận cả 7 migration đã cập nhật: `Database schema is up to date!`.
- Kiểm tra chỉ đọc sau migration: truy vấn được cả 4 bảng mới; Activity và Appeal đều có đủ 4 cột bổ sung; có 2 bản ghi bàn giao được khởi tạo; chưa có công bố hoặc lượt xử lý AI mới. Số kỳ CLOSED bật workflow mới bằng 0.
- Bước xuất bản sao lưu toàn bộ DB bị cơ chế auto-review từ chối do có thể chứa dữ liệu nhạy cảm và vượt phạm vi cho phép xuất dữ liệu. Không thực hiện xuất bản sao lưu toàn bộ; việc này không ngăn áp dụng migration đã được người dùng cho phép.
- Kết quả trên xác minh migration/schema, chưa thay thế nghiệm thu giao diện và luồng ba vai trò.
