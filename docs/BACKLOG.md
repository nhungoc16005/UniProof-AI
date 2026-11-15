# Backlog dự án

Ngày đối chiếu: 2026-11-15. Nguồn finding: [audit](BUSINESS_LOGIC_AUDIT.md). Chưa có bug nào được sửa trong đợt tài liệu.

## Quy trình trạng thái

`Open → In progress → Ready for verification → Done`. Dùng `Needs clarification` khi cần quyết định nghiệp vụ, `Accepted risk` chỉ khi có quyết định người có thẩm quyền và ghi tại DECISIONS. Potential cần tái hiện trước khi cam kết hướng sửa. Không đổi thành Done chỉ vì có code hoặc build qua.

P0 là thứ tự xử lý đề xuất trước bàn giao; P1 tiếp theo; P2 có thể lên sprint theo tác động. Người phụ trách và sprint chưa được phân công. Nhiệm vụ sửa cụ thể chỉ bắt đầu khi người dùng giao.

## Lộ trình đề xuất sau audit — 2026-11-15

Đây là khuyến nghị để chọn công việc tiếp theo, chưa phải yêu cầu triển khai được duyệt. Giữ nguyên trạng thái và mức ưu tiên của từng BL; chưa sửa application code hoặc chạy test ứng dụng trong lượt lập lộ trình.

| Bước | Công việc đề xuất | Điều kiện hoàn thành |
|---|---|---|
| 1 | Lưu mốc Git của bộ tài liệu sau review; kiểm tra lại các pure test hiện có; chuẩn bị DB localhost _test, Storage test/doubles và pipeline giả khi được giao task kiểm thử | Có baseline kiểm thử tái chạy được, tách dữ liệu thật; không coi kết quả historical là kết quả mới |
| 2 | Giữ rubric hiện hành qua các kỳ theo DEC-006; chỉ làm rõ phần còn thiếu/mâu thuẫn trong Q-01 gộp hoạt động, Q-02 quy đổi, Q-03 gia hạn/chốt kỳ; thực hiện song song với các sửa lỗi độc lập | Không xây lại hoặc đặt lại mức điểm mỗi kỳ; quyết định bổ sung có căn cứ ghi DECISIONS; các Q còn lại chốt trước khi nghiệm thu luồng liên quan |
| 3 | Xử lý P0 theo nhóm nhỏ: BL-002/001/009 về payload nhạy cảm, phạm vi Khoa và JWT; tiếp đến BL-007 về Storage, xác minh BL-026 race xóa/nộp; BL-006 theo chính sách hạn được chốt | Có test tái hiện và regression cho từng bản sửa; Potential chỉ được xác nhận/loại bỏ bằng bằng chứng phù hợp |
| 4 | Xử lý P1 BL-003/004/005/008 và xác minh BL-027; kéo vào cùng luồng các P2 liên quan như BL-010/013/017/023/024 | Điểm không đổi do thứ tự thao tác; dữ liệu boolean/số đúng; deadline/kỳ/nháp/bổ sung khớp giữa Web và API; worker không kẹt |
| 5 | Nghiệm thu một kỳ end to end: tạo kỳ dùng rubric hiện hành → tự đánh giá/minh chứng → review/attendance/chốt → gửi → công bố → phúc khảo/hiệu chỉnh → công bố lại → chốt/export | Đạt AC với cả ba role; kiểm thêm sai Khoa, gia hạn, không nộp/loại trừ, thao tác lặp/đồng thời, lỗi một phần và phân trang; thêm nhánh thay đổi rubric chỉ khi có thay đổi được xác nhận |
| 6 | Hoàn tất P2 còn lại, UX và gói bàn giao; chọn phạm vi AI/mobile theo mục tiêu dự án đã được xác nhận | Không còn P0/P1 chưa xử lý hoặc chưa có quyết định chấp nhận rủi ro; báo cáo test/giới hạn và docs khớp bản bàn giao |

Đợt kỹ thuật đầu tiên: xử lý và kiểm chứng xong BL-002, BL-001, BL-009 (đạt 16/16 test in-memory trong security-fixes.test.cjs, trạng thái Done). Đợt tiếp theo tập trung vào bảo vệ dữ liệu: BL-007 (ký URL/Storage) và xác minh BL-026 (race xóa/nộp). Mỗi đợt chỉ chọn vài lỗi liên quan; trace → tái hiện → sửa → regression → cập nhật spec/API/rules khi ảnh hưởng, backlog và changelog.

## Hạng mục audit

| ID | Ưu tiên / mức độ | Chắc chắn | Trạng thái | Phạm vi | Việc cần làm / điều kiện đóng |
|---|---|---|---|---|---|
| [BL-001](BUSINESS_LOGIC_AUDIT.md#bl-001) | P0 / High | Confirmed | Done | [F01](features/01-accounts-and-access.md), [F09](features/09-faculty-handoff.md), [F12](features/12-scores-reports-and-exports.md) | Bỏ termId vượt ranh giới Khoa lịch sử; giải quyết kỳ 1 lần, đạt regression 5/5 ca test |
| [BL-002](BUSINESS_LOGIC_AUDIT.md#bl-002) | P0 / High | Confirmed | Done | [F01](features/01-accounts-and-access.md), [F07](features/07-evidence-review-and-verification.md) | Response duyệt minh chứng chứa password hash cán bộ; dùng select an toàn, đạt regression 2/2 ca test |
| [BL-006](BUSINESS_LOGIC_AUDIT.md#bl-006) | P0 / High | Confirmed | Open | [F03](features/03-terms-and-deadlines.md), [F10](features/10-publication-and-term-closure.md), [F11](features/11-appeals-and-corrections.md) | Chốt kỳ bỏ qua gia hạn phúc khảo còn hiệu lực; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-007](BUSINESS_LOGIC_AUDIT.md#bl-007) | P0 / High | Confirmed | Done | [F06](features/06-evidence-and-storage.md) | Lỗi ký URL xóa tệp đã commit vào DB; tách 3 bước upload/commit/ký, lỗi ký không xóa Storage, đạt 6/6 test regression trong data-protection.test.cjs |
| [BL-009](BUSINESS_LOGIC_AUDIT.md#bl-009) | P0 / High | Confirmed | Done | [F01](features/01-accounts-and-access.md) | JWT secret được đọc trước khi ConfigModule nạp .env; dùng registerAsync + getJwtSecret, đạt 4/4 ca Passport test |
| [BL-026](BUSINESS_LOGIC_AUDIT.md#bl-026) | P0 / High | Potential | In Progress / Potential | [F06](features/06-evidence-and-storage.md) | Xóa minh chứng/tệp có khoảng đua với nộp phiếu; bọc khóa Term qua studentEdit, đọc file trong lock, đạt 5/5 test đối chứng trong data-protection.test.cjs, chờ test PostgreSQL đa kết nối |
| [BL-003](BUSINESS_LOGIC_AUDIT.md#bl-003) | P1 / High | Confirmed | Open | [F04](features/04-rubrics-and-scoring.md) | Tiêu chí nhóm mặc định thiếu baseScore; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-004](BUSINESS_LOGIC_AUDIT.md#bl-004) | P1 / High | Confirmed | Open | [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md) | leadershipRole gửi chuỗi làm điểm chức vụ bằng 0; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-005](BUSINESS_LOGIC_AUDIT.md#bl-005) | P1 / High | Confirmed | Open; chờ chính sách Q-01 | [F07](features/07-evidence-review-and-verification.md), [F08](features/08-activities-and-attendance.md) | Xác minh minh chứng ghi đè số hoạt động từ điểm danh; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-008](BUSINESS_LOGIC_AUDIT.md#bl-008) | P1 / High | Confirmed | Open | [F14](features/14-audit-monitoring-and-ai-jobs.md) | Timeout AI dừng trước lúc đọc response body; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-027](BUSINESS_LOGIC_AUDIT.md#bl-027) | P1 / Medium | Potential | Open | [F05](features/05-student-assessment.md) | Preflight nộp phiếu nằm ngoài transaction khóa; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-010](BUSINESS_LOGIC_AUDIT.md#bl-010) | P2 / Medium | Confirmed | Open | [F03](features/03-terms-and-deadlines.md), [F05](features/05-student-assessment.md) | Web khóa sửa theo hạn gốc dù đã gia hạn; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-011](BUSINESS_LOGIC_AUDIT.md#bl-011) | P2 / Medium | Confirmed | Open | [F01](features/01-accounts-and-access.md) | Mật khẩu tạm không được bàn giao đầy đủ; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-012](BUSINESS_LOGIC_AUDIT.md#bl-012) | P2 / Medium | Confirmed | Open | [F01](features/01-accounts-and-access.md) | Thiếu classId/facultyId scalar làm bộ lọc tài khoản sai; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-013](BUSINESS_LOGIC_AUDIT.md#bl-013) | P2 / Medium | Confirmed | Open | [F05](features/05-student-assessment.md) | Nháp minh chứng không hiện dưới đúng tiêu chí; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-014](BUSINESS_LOGIC_AUDIT.md#bl-014) | P2 / Medium | Confirmed | Open; chờ chính sách Q-02 | [F04](features/04-rubrics-and-scoring.md), [F08](features/08-activities-and-attendance.md) | Rubric không lưu rolesScore cần cho điểm danh cộng đồng; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-015](BUSINESS_LOGIC_AUDIT.md#bl-015) | P2 / Medium | Confirmed | Open | [F06](features/06-evidence-and-storage.md), [F07](features/07-evidence-review-and-verification.md) | Thêm tệp vào Evidence APPROVED không đổi version/kết luận; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-016](BUSINESS_LOGIC_AUDIT.md#bl-016) | P2 / Medium | Confirmed | Open | [F01](features/01-accounts-and-access.md) | Bắt đổi mật khẩu lần đầu chỉ có ở frontend; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-017](BUSINESS_LOGIC_AUDIT.md#bl-017) | P2 / Medium | Confirmed | Open | [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md) | Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-018](BUSINESS_LOGIC_AUDIT.md#bl-018) | P2 / Medium | Confirmed | Open | [F12](features/12-scores-reports-and-exports.md) | Yêu cầu sửa thông tin mất meta và không có phân trang UI; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-019](BUSINESS_LOGIC_AUDIT.md#bl-019) | P2 / Medium | Confirmed | Open | [F06](features/06-evidence-and-storage.md), [F12](features/12-scores-reports-and-exports.md) | Danh sách minh chứng chỉ tải trang đầu rồi lọc cục bộ; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-020](BUSINESS_LOGIC_AUDIT.md#bl-020) | P2 / Medium | Confirmed | Open | [F03](features/03-terms-and-deadlines.md), [F12](features/12-scores-reports-and-exports.md) | Chọn gia hạn chỉ có 100 sinh viên và lệch roster kỳ; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-021](BUSINESS_LOGIC_AUDIT.md#bl-021) | P2 / Medium | Confirmed | Open | [F09](features/09-faculty-handoff.md), [F13](features/13-notifications.md) | Loại trừ lần hai trùng dedupeKey và rollback; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-022](BUSINESS_LOGIC_AUDIT.md#bl-022) | P2 / Medium | Confirmed | Open | [F07](features/07-evidence-review-and-verification.md), [F14](features/14-audit-monitoring-and-ai-jobs.md) | Thêm nguồn xác minh hủy job nhưng Evidence còn PROCESSING; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-023](BUSINESS_LOGIC_AUDIT.md#bl-023) | P2 / Medium | Confirmed | Open | [F07](features/07-evidence-review-and-verification.md) | Màn bổ sung hiển thị deadline/nội dung giả; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-024](BUSINESS_LOGIC_AUDIT.md#bl-024) | P2 / Medium | Confirmed | Open | [F05](features/05-student-assessment.md), [F12](features/12-scores-reports-and-exports.md) | Sinh viên mở URL kỳ khác nhưng đọc activeTerm; đạt regression ở finding và cập nhật spec/test evidence |
| [BL-025](BUSINESS_LOGIC_AUDIT.md#bl-025) | P2 / Medium | Confirmed | Open | [F01](features/01-accounts-and-access.md) | API tạo tài khoản bỏ qua ràng buộc vai trò mà UI bắt buộc; đạt regression ở finding và cập nhật spec/test evidence |

## Công việc nền tảng

| ID | Trạng thái | Phạm vi và điều kiện |
|---|---|---|
| DOC-001 | Done | Tập trung docs, 14 feature spec, template, audit/backlog và quy trình AGENTS; kiểm chứng tài liệu ghi tại CHANGELOG |
| QA-001 | Open | Chuyển các tái hiện in-memory của audit thành regression có thể chạy lại; không coi 23 ca cũ là suite đã được lưu |
| QA-002 | Open | Rà fixture startDate rồi chuẩn bị DB localhost _test riêng và browser harness; chỉ chạy khi phạm vi công việc cho phép ghi fixture |
| QA-003 | Open | Kiểm chứng Storage cleanup, signing và quyền bucket trên môi trường thử nghiệm được cho phép |
| QA-004 | Open | Kiểm chứng AI timeout, lease/recovery và response muộn với pipeline giả/cách ly trước pipeline thật |
| REQ-001 | Open | Chốt Q-01…Q-09 trong DECISIONS với người có thẩm quyền; không biến giả định thành yêu cầu |
| REQ-002 | Open; yêu cầu đã xác nhận | DEC-006: rubric hiện hành giữ nguyên cả khi mở kỳ mới nếu không có thay đổi thực sự. Đối chiếu/điều chỉnh luồng tạo kỳ đang sao chép DRAFT và yêu cầu ban hành mỗi kỳ; không bắt người dùng sửa/ban hành lại nội dung chỉ vì đổi kỳ. Cách lưu bản ghi/snapshot theo kỳ chưa chọn, không tự đổi schema. Điều kiện đóng: F03-AC-06, F04-AC-06/07 có kiểm chứng |
| GAP-001 | Open | Mobile, Python AI/research, ai-core/queue scaffold: chỉ lên kế hoạch triển khai khi được xác nhận phạm vi |

Mỗi lần thực hiện hạng mục: cập nhật trạng thái, test đã chạy/kết quả/giới hạn, link thay đổi và mục CHANGELOG. Nếu không thay đổi hành vi, ghi rõ lý do docs nào được giữ nguyên.

