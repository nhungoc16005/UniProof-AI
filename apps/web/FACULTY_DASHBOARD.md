# Tổng quan Khoa — biểu đồ và nguồn số liệu

## Giao diện

Trang `/officer?termId=...` giữ navigation đã thu gọn. Sáu KPI, ba deadline, danh sách công việc và tóm tắt kết quả tiếp tục sử dụng dữ liệu thật. Ba biểu đồ:

| Biểu đồ | Nội dung | Tương tác |
|---|---|---|
| Thanh ngang | 8 trạng thái phiếu, cùng thang đo số lượng; nhãn số và % trên tổng sinh viên | Chọn trạng thái để mở danh sách đã lọc |
| Thanh ngang chồng 100% | Từng lớp: chưa nộp, đang xử lý, sẵn sàng, đã bàn giao, ghi nhận không nộp | 8 lớp ban đầu, xem tất cả, chuyển sang bảng, mở chi tiết và liên kết từng trạng thái |
| Donut | Minh chứng đã duyệt, từ chối, chưa có quyết định cuối; tổng ở giữa vòng | Chú giải số lượng/%, liên kết trạng thái hỗ trợ và hàng đợi |

Lớp ưu tiên theo tỷ lệ phiếu còn phải bàn giao, sau đó số lượng. Ghi nhận không nộp không tính là bàn giao. Bàn giao gồm `SENT` và `PUBLISHED`; tám nhóm trạng thái không đếm trùng. Phân bố xếp loại và tra cứu kết quả chi tiết nằm trong phần Kết quả đã công bố của cùng trang Tổng quan. `/officer/reports` được giữ dưới dạng redirect tương thích.

Màn nghiệp vụ `/officer/evaluations` tách riêng khỏi Tổng quan: chỉ có bốn KPI hành động, bảng lớp compact và panel chi tiết. Các bảng phiếu, minh chứng và phúc khảo tiếp tục dùng route riêng để hỗ trợ lọc, phân trang và quay lại đúng lớp.

Donut dùng `totalEvidences - approvedEvidences - rejectedEvidences` cho nhóm còn lại. Không gắn nhóm này với một status hay gọi toàn bộ là việc cán bộ chưa duyệt. Kỳ không có minh chứng hiển thị empty state, không vẽ vòng với số liệu giả.

## Nguồn và tải dữ liệu

- Workflow page 1 cung cấp kỳ, summary và tổng sinh viên snapshot. Đọc đủ các trang, 100 dòng/request, tối đa 4 request đồng thời để thống kê lớp và tách hai loại phiếu bị trả.
- Kiểm tra tổng, studentId trùng, trạng thái không hỗ trợ và đối chiếu summary. Thiếu trang hoặc phát hiện thay đổi trong khi tổng hợp: không hiển thị biểu đồ lớp/trạng thái là dữ liệu hoàn chỉnh; có retry.
- KPI API cung cấp minh chứng và phúc khảo. Report API cung cấp kết quả công bố gần nhất hoặc rubric kỳ lịch sử.
- Các nguồn tải song song, có lỗi/thử lại riêng. Giữ summary khi tổng hợp lớp thất bại; không chuyển lỗi thành số 0.
- Request được gắn với user/kỳ và phiên tải; response cũ không thể ghi đè kỳ mới.
- Kỳ lịch sử không trình bày như workflow bàn giao mới; CLOSED dùng nhãn chỉ xem. Deadline phân biệt hạn nộp, hạn chấm, hạn phúc khảo.

Không thêm API, thay Backend, Prisma, migration, Supabase hoặc AI. Không thêm chart library; dùng HTML/CSS/SVG, liên kết, native details và bảng số liệu hỗ trợ bàn phím.

## Kiểm thử

```sh
node --test scripts/faculty-analytics.test.cjs
npm run build
```

Browser test cần database PostgreSQL localhost `_test` đã chạy migration và integration fixture. Không dùng database Supabase:

```sh
FACULTY_CHARTS_ONLY=1 TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/edupoint_charts_test node scripts/navigation-smoke.cjs
```

Bỏ `FACULTY_CHARTS_ONLY=1` để chạy đầy đủ navigation, biểu đồ và UX regression. Browser fixture có 108 sinh viên, 9 lớp, cả 8 trạng thái và 6 minh chứng. Kiểm tra tổng đủ trên hai trang, donut 3/1/2, bảng thay thế, mở rộng lớp, keyboard, drill-down, 390px, kỳ rỗng, lỗi trang 2/retry, response trả muộn khi đổi kỳ và CLOSED. Lỗi mạng được tạo ở tầng vận chuyển, không mock payload.

6 unit tests thống kê và build Web đã qua. Có cảnh báo bundle Web lớn đã tồn tại. Screenshot kiểm thử nằm trong thư mục tạm, không ghi dữ liệu tổng hợp vào hệ thống thật.
