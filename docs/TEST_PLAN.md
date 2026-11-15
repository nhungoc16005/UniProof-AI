# Kế hoạch kiểm chứng EduPoint

Đợt tài liệu ngày 2026-11-15 chỉ thay Markdown. Không chạy backend, DB integration, browser fixture, migration, seed hoặc pipeline thật để xác nhận tài liệu. Mọi ca feature hiện là **Planned**, trừ bằng chứng test cụ thể được ghi rõ dưới đây.

## Phân loại bằng chứng

| Mức | Chứng minh được | Không chứng minh được |
|---|---|---|
| Source inspection | Điều kiện/nhánh/quan hệ và mismatch contract | Deployment/schema đã áp dụng, thứ tự concurrency thật |
| Pure/in-memory | Công thức, serialization, policy và interleaving được mô hình | FK/transaction isolation, Storage/network thật |
| DB integration cách ly | Ràng buộc và transaction trên DB test cụ thể | Production giống cấu hình hoặc dữ liệu test |
| Browser end to end cách ly | UI→API→DB test và điều hướng qua browser | Production hoàn hảo, mọi thiết bị hoặc mọi ca biên |
| Kiểm tra dịch vụ ngoài được phép | Pipeline/storage môi trường được cấp | Không suy từ mock sang dịch vụ thật |

## Kết quả historical của audit

Cuộc trao đổi audit trước ghi nhận 15 worker tests và 6 faculty analytics tests đạt;23 ca tái hiện in-memory có chọn lọc gồm 2 mô hình race. Các harness ad hoc không được lưu vào repository; chưa có regression suite tái chạy cho toàn bộ 27 finding. Không coi số này là test đã chạy lại trong đợt tài liệu.

Tài liệu navigation/dashboard cũ từng ghi build/integration/browser đã đạt với fixture 108 sinh viên,9 lớp,8 state,6 minhchứng. Đây là báo cáo lịch sử, không được tái xác nhận ở đợt này; test fixture hiện cần rà trường startDate bắt buộc của Activity trước khi sử dụng. Không dùng claim cũ làm điều kiện đóng backlog.

## Suite hiện có và cách chọn an toàn

| Nguồn | Loại / giới hạn |
|---|---|
| [security fixes unit](../apps/backend/test/security-fixes.test.cjs) | In-memory doubles & Passport authenticate thật; kiểm BL-001 (scope/kỳ & dashboard sinh viên), BL-002 (select reviewer an toàn), BL-009 (JWT registerAsync factory + token 12h); 16/16 tests pass |
| [worker unit](../apps/backend/test/evidence-processing-worker.test.cjs) | In-memory doubles; kiểm worker/lease/recovery/version; đọc harness trước khi chạy |
| [faculty analytics unit](../apps/web/scripts/faculty-analytics.test.cjs) | Thuần tính toán: state, tổng hợp lớp, trùng/thiếu/empty và thứ tự |
| [workflow integration](../apps/backend/test/workflow.integration.test.cjs) | Ghi fixture PostgreSQL; không chạy trong audit/docs read-only |
| [browser smoke](../apps/backend/test/browser-smoke.cjs), [UX checks](../apps/backend/test/ux-checks.cjs) | Có phụ thuộc môi trường/fixture/backend, phải kiểm setup |
| [navigation smoke](../apps/web/scripts/navigation-smoke.cjs), [faculty charts checks](../apps/web/scripts/faculty-charts.checks.cjs) | Browser + fixture; có nhánh charts-only; không tự chạy DB thật |
| [workflow integrity script](../apps/backend/scripts/check-workflow-integrity.cjs) | Có truy cập DB; dù thiết kế đọc số lượng vẫn không tự kết nối môi trường thật khi chưa thuộc phạm vi |

Lệnh pure có thể dùng sau khi inspect harness và xác nhận không gọi DB/AI:

```sh
# cwd: apps/backend
node --test test/evidence-processing-worker.test.cjs
```

```sh
# cwd: apps/web
node --test scripts/faculty-analytics.test.cjs
```

Không dùng `npm test` backend cho audit vì glob bao gồm workflow.integration.test.cjs. Không chạy backend để “chỉ xem Swagger”: EvidenceProcessingWorker khởi động cùng ứng dụng.

## Ma trận regression của audit

Mỗi BL giữ kịch bản chi tiết trong [audit](BUSINESS_LOGIC_AUDIT.md). Đây là danh sách việc test cần có, không là kết quả Passed.

| Finding | Tầng cần kiểm tra | Kỳ vọng/bằng chứng |
|---|---|---|
| [BL-001](BUSINESS_LOGIC_AUDIT.md#bl-001) | Service/API doubles | **Passed (unit):** Đạt 5/5 ca trong security-fixes.test.cjs; kỳ không tồn tại ném NotFoundException, DB rỗng trả empty score, thiếu snapshot ném ForbiddenException, request có/không termId với sinh viên chuyển Khoa đều dùng cùng ranh giới snapshot Khoa. |
| [BL-002](BUSINESS_LOGIC_AUDIT.md#bl-002) | Service/API doubles | **Passed (unit):** Đạt 2/2 ca trong security-fixes.test.cjs; reviewer dùng projection select an toàn { id, fullName, role }, payload và chuỗi JSON không chứa password/authVersion; bắt được lỗi nếu code cũ dùng reviewer: true. |
| [BL-003](BUSINESS_LOGIC_AUDIT.md#bl-003) | Pure/service doubles | Rubric mặc định: không vi phạm→3, vắng không lý do một lần→1, trễ việc→0; config thiếu baseScore phải bị từ chối. |
| [BL-004](BUSINESS_LOGIC_AUDIT.md#bl-004) | Contract/form + browser cách ly | Thao tác form thật cho leadershipRole=true ở tiêu chí 14 và 16; kiểm tra payload boolean và điểm 4/3. |
| [BL-005](BUSINESS_LOGIC_AUDIT.md#bl-005) | Service/API + DB cách ly | CONFIRMED roster không có Evidence, chỉ Evidence, cả hai cùng hoạt động và hai nguồn khác hoạt động; kết quả không đổi theo thứ tự lưu. |
| [BL-006](BUSINESS_LOGIC_AUDIT.md#bl-006) | Service/API + DB cách ly | Hạn gốc hết nhưng gia hạn cá nhân/lớp chưa hết→không chốt; thu hồi/hết toàn bộ hạn→đánh giá lại blockers. |
| [BL-007](BUSINESS_LOGIC_AUDIT.md#bl-007) | Service doubles rồi DB/Storage cách ly | Double Storage upload/DB thành công rồi signing lỗi; object không bị xóa, bản ghi vẫn ký lại được. |
| [BL-008](BUSINESS_LOGIC_AUDIT.md#bl-008) | Pure/service doubles | Mock response có headers tức thì, body treo; sau deadline job kết thúc đúng trạng thái và poller nhận job tiếp. |
| [BL-009](BUSINESS_LOGIC_AUDIT.md#bl-009) | Pure/service doubles | **Passed (unit):** Đạt 4/4 ca trong security-fixes.test.cjs qua Passport strategy thật; token 12h ký bằng secret từ ConfigService được xác thực thành công; token ký bằng fallback bị invalid signature; production thiếu secret ném lỗi. |
| [BL-010](BUSINESS_LOGIC_AUDIT.md#bl-010) | Contract/form + browser cách ly | Mock permission=true với hạn gốc đã qua, effectiveDeadline tương lai: form cho phép và hiển thị hạn mới. |
| [BL-011](BUSINESS_LOGIC_AUDIT.md#bl-011) | Service/API + DB cách ly | Tạo không password và import thành công: Admin nhận được phương thức bàn giao; response/log không lộ credential lâu dài. |
| [BL-012](BUSINESS_LOGIC_AUDIT.md#bl-012) | Contract/form + browser cách ly | User có class.id nhưng không có scalar, lọc theo lớp phải vẫn đúng hoặc API bổ sung scalar theo hợp đồng. |
| [BL-013](BUSINESS_LOGIC_AUDIT.md#bl-013) | Contract/form + browser cách ly | Tạo nháp chưa review, reload; hiển thị đúng một lần tại tiêu chí, sửa/xóa được trong quyền. |
| [BL-014](BUSINESS_LOGIC_AUDIT.md#bl-014) | Service/API + DB cách ly | Tạo→lưu→ban hành rubric có role rates, đọc lại giữ nguyên và điểm danh tính đúng; thiếu rates hiển thị blocker trước sử dụng. |
| [BL-015](BUSINESS_LOGIC_AUDIT.md#bl-015) | Service doubles rồi DB/Storage cách ly | RETURNED tổng nhưng Evidence APPROVED: thêm file bị chặn hoặc chuyển trạng thái đúng cùng audit/version. |
| [BL-016](BUSINESS_LOGIC_AUDIT.md#bl-016) | Service/API + DB cách ly | Token firstLogin gọi API ghi bị chặn, đổi mật khẩu xong gọi được; không chặn endpoint cần cho bước đổi. |
| [BL-017](BUSINESS_LOGIC_AUDIT.md#bl-017) | Pure/service doubles | Chuỗi rác, âm, fractional khi cần integer, Infinity/boolean phải bị từ chối; 0 hợp lệ vẫn tính đúng. |
| [BL-018](BUSINESS_LOGIC_AUDIT.md#bl-018) | Contract/form + browser cách ly | Fixture26 hoặc 51 issues qua double HTTP, kiểm total/pageSize, chuyển trang và xử lý item cuối. |
| [BL-019](BUSINESS_LOGIC_AUDIT.md#bl-019) | Contract/form + browser cách ly | 21+ minh chứng, hồ sơ mục tiêu ở trang 2; tìm/đổi trạng thái và mở chi tiết vẫn truy cập được. |
| [BL-020](BUSINESS_LOGIC_AUDIT.md#bl-020) | Contract/form + browser cách ly | 101+ roster và user ngoài kỳ; tìm được người cuối và không chọn user ngoài roster. |
| [BL-021](BUSINESS_LOGIC_AUDIT.md#bl-021) | Service doubles rồi DB/Storage cách ly | Chạy chuỗi exclude/restore/exclude trong DB test cách ly; hai sự kiện tồn tại, trạng thái cuối EXCLUDED. |
| [BL-022](BUSINESS_LOGIC_AUDIT.md#bl-022) | Pure/service doubles | PROCESSING + job active, addSource→job CANCELLED và trạng thái xét thủ công; response cũ không đổi lại. |
| [BL-023](BUSINESS_LOGIC_AUDIT.md#bl-023) | Contract/form + browser cách ly | Yêu cầu có comment khác missingItem, deadline khác mẫu và deadline=null; UI phản ánh đúng cả3. |
| [BL-024](BUSINESS_LOGIC_AUDIT.md#bl-024) | Contract/form + browser cách ly | Deep link kỳ cũ, Back/Forward, reload, selector mobile390px; title/API/payload đều cùng kỳ. |
| [BL-025](BUSINESS_LOGIC_AUDIT.md#bl-025) | Service/API + DB cách ly | Create STUDENT thiếu mã/lớp, STAFF thiếu Khoa bị từ chối; bản hợp lệ được nhận. |
| [BL-026](BUSINESS_LOGIC_AUDIT.md#bl-026) | DB concurrency cách ly + barrier | Barrier integration test hai kết nối DB cách ly, xen kẽ precheck→submit→delete; nộp thành công phải giữ tệp hoặc xóa buộc nộp bị chặn. |
| [BL-027](BUSINESS_LOGIC_AUDIT.md#bl-027) | DB concurrency cách ly + barrier | Dùng barrier cho save-null trước khi submit lấy lock; submit phải trả blocker, không SUBMITTED. |

## Feature acceptance

14 spec trong [features](README.md) có Fxx-AC-yy và Fxx-TC-yy. Với task cụ thể, chuyển mô tả test thành Given/When/Then, chỉ rõ role/kỳ/roster/rubric/state/deadline/dữ liệu vào/ra; liên kết thêm BL/Q nếu có.

Bắt buộc kiểm tra các chiều liên quan đến thay đổi: happy path; sai chủ/Khoa/role; inactive/token cũ; deadline gốc/gia hạn/đúng biên; dữ liệu lịch sử; yêu cầu lặp; xung đột version; rollback/partial failure; stale response khi đổi kỳ; phân trang/aggregate/export. Không mở rộng suite chỉ để chạy thêm nếu kiểm tra liên quan đã đủ và không có lo ngại mới.

Không đánh dấu toàn feature Verified chỉ vì một test thuần hoặc build thành công. Khi không kiểm được, ghi “Not run” và lý do/môi trường còn thiếu.

DEC-006 đã được người dùng xác nhận: rubric không thay đổi thì tiếp tục dùng nguyên nội dung qua kỳ mới. Bổ sung F03-TC-06 và F04-TC-06/07: mở hai kỳ dùng cùng nội dung; chỉ thay khi có thay đổi được xác nhận; thay đổi kỳ sau không làm đổi rubric/kết quả lịch sử. Các ca này **Planned**, theo REQ-002; chưa chọn cách tái sử dụng ID hay snapshot và chưa chạy ứng dụng/DB để kiểm chứng.

## Browser scenarios được giữ từ tài liệu cũ

- Ba role; menu STAFF5/ADMIN5, tab con, active chi tiết, redirect; refresh/Back/Forward, termId/returnTo và deep link.
- Khoa dashboard đủ 108 sinhviên/9 lớp nếu fixture được tái tạo đúng;8 state không đếm trùng; tải 2 trang với pageSize=100; lỗi trang 2 có retry, response kỳ cũ không ghi đè.
- Biểu đồ lớp 8 dòng ban đầu/mở rộng/bảng/bàn phím; donut 3 approved/1 rejected/2 remaining theo fixture 6; tổng0 hiển thị empty.
- Theo lớp 4 KPI hành động, KPI không thay theo lớp đang chọn; badge approved+rejected nhưng list riêng.
- Mobile390px, kỳ rỗng/historical/CLOSED; ba deadline đúng nghĩa và chỉ xem khi khóa.
- Excel toàn tập lọc, điểm publication mới nhất, danh sách dài hơn trang; appeals liên quan lazy-load đủ trang và mở đúng đơn.
- Upload/signing/cleanup, supplement missingItem/deadline thật, form boolean leadershipRole và gia hạn được phản ánh đúng.

Harness browser có điều kiện localhost và tên DB chứa `_test`, không dùng Supabase. Chỉ chuẩn bị/chạy khi một task cho phép fixture DB và đã đọc cleanup/setup; biến TEST_DATABASE_URL phải do môi trường test cấp, không ghi secret vào tài liệu.

Lệnh tham khảo để chạy sau khi có fixture cách ly hợp lệ (chưa chạy ở đợt tài liệu):

```sh
# cwd: apps/web; TEST_DATABASE_URL đã được cấu hình an toàn
node scripts/navigation-smoke.cjs
# chỉ kiểm biểu đồ trong harness
FACULTY_CHARTS_ONLY=1 node scripts/navigation-smoke.cjs
```

## Kiểm chứng tài liệu

Kiểm link tương đối/anchor/source line; đủ 14 feature+template; đủ 11 mục/spec; R IDs/BL IDs/AC/TC không trùng; route inventory khớp controller; DTO kế thừa ghi đúng; không link tới file đã xóa; diff chỉ Markdown đúng phạm vi. Kết quả thực chạy ghi ở [CHANGELOG](CHANGELOG.md).

Không cần build hay viết test ứng dụng cho thay đổi thuần tài liệu. Kiểm tra diff và tài liệu là validation phù hợp cho công việc này.

