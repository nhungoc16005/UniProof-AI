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
| [BL-006](BUSINESS_LOGIC_AUDIT.md#bl-006) | P0 / High | Confirmed | Done | [F03](features/03-terms-and-deadlines.md), [F10](features/10-publication-and-term-closure.md), [F11](features/11-appeals-and-corrections.md) | Chốt kỳ khóa khi còn gia hạn phúc khảo hiệu lực theo ưu tiên cá nhân → lớp → hạn chung; kiểm chứng 9 ca trong deadline-and-closure.test.cjs |
| [BL-007](BUSINESS_LOGIC_AUDIT.md#bl-007) | P0 / High | Confirmed | Done | [F06](features/06-evidence-and-storage.md) | Lỗi ký URL xóa tệp đã commit vào DB; tách 3 bước upload/commit/ký, lỗi ký không xóa Storage, đạt 6/6 test regression trong data-protection.test.cjs |
| [BL-009](BUSINESS_LOGIC_AUDIT.md#bl-009) | P0 / High | Confirmed | Done | [F01](features/01-accounts-and-access.md) | JWT secret được đọc trước khi ConfigModule nạp .env; dùng registerAsync + getJwtSecret, đạt 4/4 ca Passport test |
| [BL-026](BUSINESS_LOGIC_AUDIT.md#bl-026) | P0 / High | Confirmed | Done | F06 | Hai thứ tự xóa/nộp đạt trên PostgreSQL 17. Storage giả lập. |
| [BL-028](BUSINESS_LOGIC_AUDIT.md#bl-028) | P0 / High | Confirmed | Done | F07/F15 | Cùng chính sách chốt dưới khóa Term. Regression HTTP và đối chiếu trạng thái DB đạt. |
| [BL-029](BUSINESS_LOGIC_AUDIT.md#bl-029) | P0 / High | Confirmed | Done | F15 | Phiên UI gắn ngữ cảnh, API buộc cùng kỳ và replay đúng kỳ. Regression Web và PostgreSQL đạt. |
| [BL-036](BUSINESS_LOGIC_AUDIT.md#bl-036) | P0 / High | Confirmed | Đã kiểm chứng bootstrap PG17, deploy một bước còn mở | Docker local, Prisma | Đủ 14 migration và integration trên PG17 theo quy trình hai bước. Deploy trực tiếp từ DB trống vẫn gặp P1014. |
| [BL-031](BUSINESS_LOGIC_AUDIT.md#bl-031) | Medium | Confirmed | Done | F07/F15 | Đồng bộ kết quả batch và điểm xem trước. Regression lô thành công một phần và điểm đã điều chỉnh đạt. |
| [BL-033](BUSINESS_LOGIC_AUDIT.md#bl-033) | Medium | Confirmed | Done | F07/F15 | Giữ điểm gợi ý đã lưu, điểm chính thức theo publication, sửa nhãn màn Khoa. Regression projection và Web đạt. |
| [BL-035](BUSINESS_LOGIC_AUDIT.md#bl-035) | Medium | Confirmed | Done | F12 | Thống kê toàn kỳ và danh sách bổ sung lọc tại API. Regression 21 hồ sơ ở service và Dashboard đạt. |
| [BL-037](BUSINESS_LOGIC_AUDIT.md#bl-037) | Low | Confirmed | Done | F13 | Dùng tổng chưa đọc do API trả. Regression 51 thông báo ở service, chuông và trung tâm đạt. |
| [BL-003](BUSINESS_LOGIC_AUDIT.md#bl-003) | P1 / High | Confirmed | Resolved | [F04](features/04-rubrics-and-scoring.md) | Tiêu chí nhóm mặc định thiếu baseScore; đã bổ sung baseScore: 3, validateScoringConfig và kiểm chứng trong scoring-and-validation.test.cjs |
| [BL-004](BUSINESS_LOGIC_AUDIT.md#bl-004) | P1 / High | Confirmed | Resolved | [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md) | leadershipRole gửi chuỗi làm điểm chức vụ bằng 0; đã đồng bộ boolean Web/Backend và kiểm chứng trong scoring-and-validation.test.cjs |
| [BL-005](BUSINESS_LOGIC_AUDIT.md#bl-005) | P1 / High | Confirmed | Resolved | [F07](features/07-evidence-review-and-verification.md), [F08](features/08-activities-and-attendance.md) | Bộ tổng hợp hoạt động chung: chuẩn hóa alias vai trò; không fallback sang PARTICIPANT hoặc 0; thiếu vai trò báo blocker NEEDS_VERIFICATION; gộp cùng activityId, ưu tiên vai trò attendance CONFIRMED; tự động tính lại tiêu chí và vô hiệu hóa officialScore cũ; kiểm chứng 6 ca trong activity-and-roles-scoring.test.cjs |
| [BL-008](BUSINESS_LOGIC_AUDIT.md#bl-008) | P1 / High | Confirmed | Resolved | [F14](features/14-audit-monitoring-and-ai-jobs.md) | Mở khóa theo DEC-014: giữ AbortController + Promise.race timeout bao trùm cả fetch và đọc body `response.json()` trong `EvidenceProcessingWorker`; đạt regression trong `evidence-processing-worker.test.cjs` |
| [BL-027](BUSINESS_LOGIC_AUDIT.md#bl-027) | P1 / Medium | Confirmed | Done | F05 | Kiểm lại điều kiện sau khóa. Ba ca cạnh tranh lưu null, vượt trần và tắt F15 đạt trên PostgreSQL 17. |
| [BL-030](BUSINESS_LOGIC_AUDIT.md#bl-030) | P1 | Confirmed | Done | F15 | Căn cứ CLB/BTC hiện trong thẩm định. Thu hồi và xác minh thủ công có regression PostgreSQL. |
| [BL-032](BUSINESS_LOGIC_AUDIT.md#bl-032) | P1 | Confirmed | Done | F15 | Cờ, trạng thái, ngữ cảnh form và chốt có regression. |
| [BL-034](BUSINESS_LOGIC_AUDIT.md#bl-034) | P1 | Confirmed | Done | F03/F10/F13 | Link đúng kỳ, hạn phúc khảo hiệu lực có regression HTTP và Web. |
| [BL-010](BUSINESS_LOGIC_AUDIT.md#bl-010) | P2 / Medium | Confirmed | Done | [F03](features/03-terms-and-deadlines.md), [F05](features/05-student-assessment.md) | Hook useStudentAssessmentAccess đọc effectiveDeadlines, không lấy hạn gốc phủ định quyền sửa; kiểm chứng 3 ca trong deadline-and-closure.test.cjs |
| [BL-011](BUSINESS_LOGIC_AUDIT.md#bl-011) | P2 / Medium | Confirmed | Resolved | [F01](features/01-accounts-and-access.md) | Bàn giao mật khẩu tạm thời: validate từng dòng trước khi mở transaction; rollback không tăng importedCount và không trả temporaryCredentials; ẩn password hash/authVersion, header no-store; kiểm chứng 4 ca trong accounts-and-permissions.test.cjs |
| [BL-012](BUSINESS_LOGIC_AUDIT.md#bl-012) | P2 / Medium | Confirmed | Resolved | [F01](features/01-accounts-and-access.md) | findAll giữ nguyên facultyId gán trực tiếp của User và quan hệ class với faculty; cán bộ Khoa chỉ xem sinh viên thuộc Khoa mình; kiểm chứng 2 ca trong accounts-and-permissions.test.cjs |
| [BL-013](BUSINESS_LOGIC_AUDIT.md#bl-013) | P2 / Medium | Confirmed | Resolved | [F05](features/05-student-assessment.md) | Nháp minh chứng không hiện dưới đúng tiêu chí; đã bổ sung projection criterionAssessment.criterion và ghép trực tiếp ưu tiên hơn review cũ trong evidence-and-term-selection.test.cjs |
| [BL-014](BUSINESS_LOGIC_AUDIT.md#bl-014) | P2 / Medium | Confirmed | Resolved | [F04](features/04-rubrics-and-scoring.md), [F08](features/08-activities-and-attendance.md) | Bảo toàn rolesScore qua đọc/sửa/lưu/sao chép kỳ; bản nháp cho phép thiếu rolesScore; khi ban hành bắt buộc đủ 3 vai trò, điểm không âm, không alias mâu thuẫn, không tự gán mặc định (DEC-009/DEC-011); kiểm chứng 13 ca trong activity-and-roles-scoring.test.cjs |
| [BL-015](BUSINESS_LOGIC_AUDIT.md#bl-015) | P2 / Medium | Confirmed | Resolved | [F06](features/06-evidence-and-storage.md), [F07](features/07-evidence-review-and-verification.md) | Thêm tệp vào Evidence APPROVED bị chặn ở cả kiểm tra ban đầu lẫn bên trong transaction có khóa Term; kiểm chứng trong evidence-and-term-selection.test.cjs |
| [BL-016](BUSINESS_LOGIC_AUDIT.md#bl-016) | P2 / Medium | Confirmed | Resolved | [F01](features/01-accounts-and-access.md) | Chặn API nghiệp vụ ở JwtAuthGuard khi isFirstLogin = true (HTTP 403 FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED), ngoại trừ @AllowFirstLogin(), kiểm chứng trong accounts-and-permissions.test.cjs |
| [BL-017](BUSINESS_LOGIC_AUDIT.md#bl-017) | P2 / Medium | Confirmed | Resolved | [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md) | Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao; đã bổ sung validateVerifiedData chặn trước transaction và kiểm chứng trong scoring-and-validation.test.cjs |
| [BL-018](BUSINESS_LOGIC_AUDIT.md#bl-018) | P2 / Medium | Confirmed | Resolved | [F12](features/12-scores-reports-and-exports.md) | ProfileDataIssues: phân trang envelope chuẩn { items, total, page, pageSize }, requestGen chặn response cũ ghi đè khi đổi tab/trang; lùi trang khi giải quyết item cuối; kiểm chứng trong score-report-and-evidence-list.test.cjs và pagination-and-filter.test.cjs |
| [BL-019](BUSINESS_LOGIC_AUDIT.md#bl-019) | P2 / Medium | Confirmed | Resolved | [F06](features/06-evidence-and-storage.md), [F12](features/12-scores-reports-and-exports.md) | EvidenceList: server-side pagination, counts giữ nguyên search filter không bị xóa; tìm kiếm theo cả ID minh chứng; đồng bộ URL ?termId=... và tự động reset page=1 khi đổi kỳ; kiểm chứng trong score-report-and-evidence-list.test.cjs và pagination-and-filter.test.cjs |
| [BL-020](BUSINESS_LOGIC_AUDIT.md#bl-020) | P2 / Medium | Confirmed | Done | [F03](features/03-terms-and-deadlines.md), [F12](features/12-scores-reports-and-exports.md) | Bổ sung endpoint GET /targets roster-scoped, picker tìm kiếm phân trang; kiểm chứng 4 ca trong deadline-and-closure.test.cjs |
| [BL-021](BUSINESS_LOGIC_AUDIT.md#bl-021) | P2 / Medium | Confirmed | Resolved | [F09](features/09-faculty-handoff.md), [F13](features/13-notifications.md) | Chu trình loại trừ → khôi phục → loại trừ lại: giữ nguyên revision bàn giao; sinh eventId ngẫu nhiên cho dedupeKey chống trùng P2002; strict no-op khi đã EXCLUDED (không ghi đè lý do, không sinh notification thừa); kiểm chứng 6 ca trong exclusion-and-restore.test.cjs |
| [BL-022](BUSINESS_LOGIC_AUDIT.md#bl-022) | P2 / Medium | Confirmed | Resolved | [F07](features/07-evidence-review-and-verification.md), [F14](features/14-audit-monitoring-and-ai-jobs.md) | Mở khóa theo DEC-014: `ReviewsService.addSource` hủy job AI và chuyển `Evidence.status` từ `PROCESSING` → `NEEDS_HUMAN_REVIEW`; đạt regression trong `evidence-processing-worker.test.cjs` |
| [BL-023](BUSINESS_LOGIC_AUDIT.md#bl-023) | P2 / Medium | Confirmed | Resolved | [F07](features/07-evidence-review-and-verification.md) | Màn bổ sung hiển thị deadline/nội dung giả; đã hiển thị missingItem thật, hạn thật và bảo vệ form trong evidence-and-term-selection.test.cjs |
| [BL-024](BUSINESS_LOGIC_AUDIT.md#bl-024) | P2 / Medium | Confirmed | Resolved | [F05](features/05-student-assessment.md), [F12](features/12-scores-reports-and-exports.md) | ScoreReport: gắn currentTermRef và submitGenerationRef; xóa preflight khi đổi kỳ; chặn nộp chéo kỳ khi request đang treo; kiểm chứng Deferred Promise trong score-report-and-evidence-list.test.cjs |
| [BL-025](BUSINESS_LOGIC_AUDIT.md#bl-025) | P2 / Medium | Confirmed | Resolved | [F01](features/01-accounts-and-access.md) | Validate ràng buộc vai trò ở backend; sửa thông tin không liên quan của legacy user không query ID null; bổ sung định danh hoặc kích hoạt tài khoản kiểm tra dữ liệu đầy đủ (DEC-011); kiểm chứng 12 ca trong accounts-and-permissions.test.cjs |

## Công việc nền tảng

| ID | Trạng thái | Phạm vi và điều kiện |
|---|---|---|
| DOC-001 | Done | Tập trung docs, 14 feature spec, template, audit/backlog và quy trình AGENTS; kiểm chứng tài liệu ghi tại CHANGELOG |
| QA-001 | Open | Chuyển các tái hiện in-memory của audit thành regression có thể chạy lại; không coi 23 ca cũ là suite đã được lưu |
| QA-002 | Một phần | Fixture Activity và hai suite PostgreSQL local đã kiểm chứng. Browser harness chưa chạy. |
| QA-003 | Open | Kiểm chứng Storage cleanup, signing và quyền bucket trên môi trường thử nghiệm được cho phép |
| QA-004 | Open | Kiểm chứng AI timeout, lease/recovery và response muộn với pipeline giả/cách ly trước pipeline thật |
| REQ-001 | Open | Chốt Q-01…Q-09 trong DECISIONS với người có thẩm quyền; không biến giả định thành yêu cầu |
| REQ-002 | Done | Kế thừa rubric dưới dạng PUBLISHED. Phiên bản thay đổi bảo toàn lịch sử. Khi còn nháp, mở kỳ theo bản PUBLISHED đã xác nhận. F03-AC-06, F04-AC-06/07 đạt trên PostgreSQL 17. |
| GAP-001 | Open | Mobile, Python AI/research, ai-core/queue scaffold: chỉ lên kế hoạch triển khai khi được xác nhận phạm vi |

Mỗi lần thực hiện hạng mục: cập nhật trạng thái, test đã chạy/kết quả/giới hạn, link thay đổi và mục CHANGELOG. Nếu không thay đổi hành vi, ghi rõ lý do docs nào được giữ nguyên.

