# Navigation Khoa và Admin — 03/11/2026

## Cấu trúc

Khoa có 4 mục: Tổng quan Khoa; Xử lý đánh giá (Theo lớp, Phiếu sinh viên, Minh chứng, Phúc khảo); Hoạt động & điểm danh; Tiêu chí & quy chế.

Admin có 5 mục: Tổng quan; Kết quả rèn luyện (Tiếp nhận & công bố, Báo cáo kết quả); Tài khoản & đơn vị; Thiết lập đánh giá (Kỳ đánh giá, Bộ tiêu chí, Văn bản quy chế); Giám sát & nhật ký.

`src/lib/roleNavigation.ts` định nghĩa menu cha, các route thuộc nhóm, tab con và mô tả. AppLayout dùng cấu hình này cho sidebar desktop/mobile, breadcrumb và active state. URL cũ giữ nguyên. Chuyển nhóm chỉ mang theo kỳ; quay về danh sách qua returnTo hợp lệ khôi phục bộ lọc. Hoạt động và Giám sát dùng liên kết có query để refresh/Back/Forward hoạt động.

## Trách nhiệm màn hình

- Tổng quan Khoa: tiến độ, deadline, việc ưu tiên và kết quả công bố. Route Báo cáo cũ chuyển tới phần kết quả trên trang này.
- Theo lớp: 4 KPI toàn Khoa, bảng lớp compact và panel chi tiết. Bộ lọc lớp không thay đổi KPI; tỷ lệ đã xử lý tính `READY + SENT + PUBLISHED + NOT_SUBMITTED_RECORDED` trên sĩ số snapshot.
- Danh sách phiếu: lọc nhanh, bộ lọc và thao tác. Số lọc nhanh là summary của toàn tập phù hợp từ khóa/Khoa/lớp, không lấy số dòng trang hiện tại và không bị thu hẹp bởi trạng thái đang chọn.
- Tiếp nhận: công bố, trả Khoa và điều kiện công bố có thể mở rộng; không lặp bảng tiến độ Khoa.
- Kỳ đánh giá: chốt kỳ, hiển thị blockers từ conditions; workflow mới dùng closeWorkflowTerm, kỳ cũ giữ closeTerm.
- Chi tiết sinh viên Khoa: minh chứng và tab phúc khảo liên quan. Vì API phúc khảo chưa hỗ trợ lọc sinh viên, chỉ khi mở tab này FE mới đọc từng trang trong phạm vi Khoa/kỳ rồi lọc; link dẫn về đúng trang hàng đợi và mở đơn. Không thay Backend.
- Badge minh chứng dùng tổng API theo từng trạng thái; nhóm Đã quyết định là tổng APPROVED và REJECTED nhưng hai danh sách vẫn phân trang độc lập.

Không sửa Backend, API contract, Prisma, migration hoặc Supabase. Student giữ nguyên trong đợt này; các thay đổi UI có sẵn trong working tree được bảo toàn.

## Kiểm thử

Web/Backend build và 13 kịch bản API integration (14 Node tests) thành công trên PostgreSQL test riêng. Chrome smoke kiểm tra routes ba role, Excel chứa điểm công bố, menu 4/5 mục, tab con, active ở chi tiết, refresh, Back/Forward, giữ kỳ, điều kiện chốt bị chặn, phúc khảo liên quan, hoạt động ngoài trường và mobile 390px. Bộ 11 UX checks hiện có tiếp tục chạy trong cùng harness.

Lệnh chạy kiểm thử navigation sau khi chạy integration để tạo fixture:

```sh
TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/edupoint_nav_test node scripts/navigation-smoke.cjs
```

Harness tái sử dụng Backend test hiện có nhưng không chỉnh file Backend. Bắt buộc database localhost có `_test` trong tên; không dùng Supabase. Cảnh báo bundle Web lớn vẫn còn từ trước.
