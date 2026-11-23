# Sổ quy tắc nghiệp vụ

Đối chiếu 2026-11-15, baseline `93fb66c`. Mỗi R dưới đây là **Observed** từ code hoặc **Supported** khi có mô tả/form/điều kiện service cùng hỗ trợ; chưa phải chính sách được chủ nghiệp vụ ký mới. Gap audit là nơi hiện trạng vi phạm điều kiện hoặc hợp đồng. Chính sách chưa rõ ở [DECISIONS](DECISIONS.md), không được tự bổ sung.

## Quyền theo nghiệp vụ

| Nghiệp vụ | STUDENT | STAFF / Khoa | ADMIN / CTSV |
|---|---|---|---|
| Phiếu/minh chứng | Của mình, đúng hạn/trạng thái | Khoa snapshot của kỳ; legacy theo service | Xem theo vai trò, không tự chấm trong workflow mới |
| Rubric/kỳ/đơn vị/quy chế | Xem phần public | Xem | Quản lý |
| Review minh chứng/xác minh/chốt | Không | Có khi phiếu chưa khóa | Bị giới hạn trong service workflow mới |
| Hoạt động/attendance | Đọc theo API | Ghi theo phạm vi | Controller/service có cho phép; Q-09 |
| Gửi CTSV/ghi không nộp | Không | Có theo blockers | Không đóng vai Khoa |
| Trả Khoa/công bố/chốt/hiệu chỉnh/loại trừ/restore | Không | Xử lý lại phiếu được trả | Có theo trạng thái |
| Phúc khảo | Gửi của mình | Giải quyết đúng Khoa | Theo dõi/điều phối; service không cho resolve trực tiếp |
| Gia hạn/user management/audit tổng/retry job | Không | Đọc phần có quyền | Quản lý |

Quyền này phải được kiểm ở backend sau JWT, không chỉ hide nút frontend. Đọc decorator API rồi service, không suy từ riêng enum role.

## Vòng đời cần phân biệt

| Đối tượng | Trạng thái/luồng hiện hành |
|---|---|
| Term | UPCOMING → ACTIVE → REVIEWING qua công bố → CLOSED; reopen không khả dụng |
| RubricVersion | DRAFT → PUBLISHED, có enum ARCHIVED; không suy mọi chuyển tiếp đều có endpoint |
| AssessmentSubmission | DRAFT → SUBMITTED → RETURNED → SUBMITTED |
| CriterionAssessment | NEEDS_VERIFICATION → READY_FOR_REVIEW → FINALIZED; đổi nguồn quay lại xác minh/xóa officialScore |
| ActivityParticipant | DRAFT → CONFIRMED → REVOKED theo thao tác service |
| Handoff | WORKING/RETURNED → SENT; ADMIN trả→RETURNED; các nhánh EXCLUDED có lý do riêng |
| Publication | Append snapshot theo revision; không cập nhật đè qua service |
| Appeal | PENDING → ACCEPTED hoặc REJECTED |
| Correction | OPEN → FACULTY_RESUBMITTED → REPUBLISHED; enum CANCELLED không là luồng UI được chứng minh |
| AI job | QUEUED → PROCESSING → COMPLETED/FAILED/UNAVAILABLE/CANCELLED; retry tạo job mới khi hợp lệ |

Workflow UI có 8 state suy diễn từ submission, handoff, pending evidence/appeal và publication; đừng ghi trực tiếp các state UI vào enum handoff. Minh chứng có luồng nháp/nộp/AI/duyệt/bổ sung/withdraw/appeal; danh sách enum không tự định nghĩa một đồ thị chuyển tiếp được phép.

## Register R-01…R-28

<a id="r-01"></a>

### R-01 — Phạm vi chủ sở hữu và Khoa

- **Căn cứ:** JwtStrategy + WorkflowService.scope/evidenceScope; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L23).
- **Tiền điều kiện/quyền:** actor đã xác thực, biết studentId và kỳ thực sự truy cập.
- **Hậu điều kiện và chuyển trạng thái:** STUDENT chỉ dữ liệu của mình; STAFF theo facultyId snapshot AssessmentHandoff ở workflow mới, kỳ cũ dùng lớp hiện tại; ADMIN theo quyền service.
- **Bất biến/ca biên/gap:** Không suy quyền từ UI hoặc class hiện tại khi có snapshot; BL-001 là lối bỏ termId còn mở.

<a id="r-02"></a>

### R-02 — Phiên đăng nhập và đổi mật khẩu

- **Căn cứ:** AuthService/JwtStrategy; [nguồn](../apps/backend/src/auth/jwt.strategy.ts#L17).
- **Tiền điều kiện/quyền:** User tồn tại, isActive, token hợp lệ.
- **Hậu điều kiện và chuyển trạng thái:** Đối chiếu authVersion; logout/reset làm token cũ mất hiệu lực; UI buộc first login đến /account.
- **Bất biến/ca biên/gap:** Bắt đổi mật khẩu ở API còn gap BL-016; password/hash không thuộc payload công khai (BL-002).

<a id="r-03"></a>

### R-03 — Tài khoản, lớp và Khoa

- **Căn cứ:** UsersService + điều kiện form quản trị; [nguồn](../apps/backend/src/users/users.service.ts#L139).
- **Tiền điều kiện/quyền:** ADMIN tạo/import/sửa, STAFF chỉ đọc có phạm vi.
- **Hậu điều kiện và chuyển trạng thái:** STUDENT theo form cần MSSV/lớp; STAFF cần Khoa; role enum STUDENT/STAFF/ADMIN.
- **Bất biến/ca biên/gap:** API tạo chưa enforce hết điều kiện form (BL-025); scalar/nested quan hệ cần khớp (BL-012); ngoại lệ cần quyết định.

<a id="r-04"></a>

### R-04 — Văn bản và dữ liệu nền có lịch sử

- **Căn cứ:** CriteriaService; [nguồn](../apps/backend/src/criteria/criteria.service.ts#L434).
- **Tiền điều kiện/quyền:** Mã không trùng; tham chiếu hợp lệ; ADMIN ghi.
- **Hậu điều kiện và chuyển trạng thái:** CRUD Khoa/lớp có kiểm ràng buộc; regulation ACTIVE/EXPIRED giữ liên kết, xóa bị chặn khi dùng.
- **Bất biến/ca biên/gap:** Không diễn giải EXPIRED thành xóa căn cứ phiếu cũ; chuyển đơn vị lịch sử cần Q-05.

<a id="r-05"></a>

### R-05 — Vòng đời và roster kỳ

- **Căn cứ:** CriteriaService.activateTerm + WorkflowService.initialize; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L52).
- **Tiền điều kiện/quyền:** Kỳ chưa CLOSED, rubric PUBLISHED, không có kỳ ACTIVE khác.
- **Hậu điều kiện và chuyển trạng thái:** UPCOMING→ACTIVE; workflow roster chụp sinh viên active có lớp vào AssessmentHandoff gồm class/faculty/rubric.
- **Bất biến/ca biên/gap:** Student phát sinh/chuyển đơn vị sau kích hoạt không tự đổi roster; Q-04/Q-05; cần tái kiểm DB triển khai.

<a id="r-06"></a>

### R-06 — Cấu hình ngày và hạn có hiệu lực

- **Căn cứ:** validateTermDates + DeadlineExtensionsService.resolve; [nguồn](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts#L9).
- **Tiền điều kiện/quyền:** Các ngày hữu hạn; start≤end, start≤submission≤review≤appeal.
- **Hậu điều kiện và chuyển trạng thái:** Resolver ưu tiên bản cá nhân mới nhất chưa thu hồi, rồi lớp snapshot, rồi hạn kỳ; không phải luôn lấy ngày lớn nhất.
- **Bất biến/ca biên/gap:** Code không ràng buộc appeal≤endDate; đừng invent. Chính sách ưu tiên/hạn cứng/tie cần Q-03; BL-006/010.

<a id="r-07"></a>

### R-07 — Cửa sổ sửa phiếu sinh viên

- **Căn cứ:** WorkflowService.assertStudentEditable; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L75).
- **Tiền điều kiện/quyền:** Đúng chủ, có roster nếu workflow, phiếu chưa SENT/EXCLUDED.
- **Hậu điều kiện và chuyển trạng thái:** ACTIVE đến hạn nộp hiệu lực; RETURNED được sửa trong ACTIVE/REVIEWING đến hạn REVIEW hiệu lực; SUBMITTED khóa.
- **Bất biến/ca biên/gap:** Web còn áp hạn gốc BL-010; kiểm tra và ghi dùng studentEdit khóa Term.

<a id="r-08"></a>

### R-08 — Hiệu lực và phiên bản rubric

- **Yêu cầu đã xác nhận:** Theo DEC-006 trong [DECISIONS](DECISIONS.md), rubric hiện hành giữ nguyên qua kỳ mới nếu không có thay đổi thực sự. Không yêu cầu chỉnh tiêu chí, mức điểm hoặc công thức vì đổi kỳ.
- **Triển khai:** Tạo kỳ sao chép bộ chuẩn hoặc rubric kỳ nguồn đã ban hành thành bản ghi `PUBLISHED` riêng của kỳ. Bản thay đổi ở kỳ chưa mở tạo phiên bản `DRAFT` kế tiếp. Khi ban hành bản sửa, lưu trữ bản trước.
- **Tiền điều kiện/quyền:** ADMIN quản lý; có rubric hiện hành đã ban hành để tiếp tục áp dụng. Việc sửa nội dung cần có thay đổi thực sự được xác nhận.
- **Hậu điều kiện/bất biến:** Không thay đổi→kỳ mới áp dụng nguyên nội dung rubric hiện hành. Có thay đổi→quản lý phiên bản/phạm vi áp dụng, giữ lịch sử; không chỉnh đè rubric/kết quả kỳ cũ đã dùng. Phiếu/handoff/publication cần truy vết được rubric áp dụng.
- **Ca biên:** Bản ghi theo kỳ dùng riêng ID để truy vết. Khi mở kỳ với bản nháp còn chờ, Admin xác nhận ID bản `PUBLISHED` và roster dùng bản đó. Bản nháp giữ ở chế độ chỉ đọc sau khi mở.

<a id="r-09"></a>

### R-09 — Điểm tiêu chí và điểm gợi ý

- **Căn cứ:** evaluateRubricCriterion; [nguồn](../apps/backend/src/criteria/rubric-scoring.ts#L10).
- **Tiền điều kiện/quyền:** Có config và verifiedData đủ requiredData.
- **Hậu điều kiện và chuyển trạng thái:** Thiếu dữ liệu→NEEDS_VERIFICATION; dữ liệu hợp lệ→gợi ý trong trần; officialScore chỉ qua cán bộ chốt.
- **Bất biến/ca biên/gap:** Cần boolean/số đúng kiểu; BL-004 và BL-017 đã Resolved (đồng bộ leadershipRole kiểu boolean giữa Web và Backend, validateVerifiedData từ chối chuỗi rác/số âm/thập phân cho counter, evaluator không ép 0 nuốt lỗi); AI không là điểm chính thức.

<a id="r-10"></a>

### R-10 — Trần nhóm, tổng và xếp loại

- **Căn cứ:** WorkflowService.snapshot + evaluation-policy; [nguồn](../apps/backend/src/evaluation-workflow/evaluation-policy.ts#L3).
- **Tiền điều kiện/quyền:** Các tiêu chí thuộc đúng rubric.
- **Hậu điều kiện và chuyển trạng thái:** Nhóm=min(trần, tổng điểm FINALIZED); tổng=min(100,tổng nhóm). ≥90 Xuất sắc, ≥80 Tốt, ≥65 Khá, ≥50 Trung bình, còn lại Yếu.
- **Bất biến/ca biên/gap:** Rubric DUT 5 nhóm 20/25/20/25/10; selfScore/suggestion không được cộng như officialScore.

<a id="r-11"></a>

### R-11 — Nộp và trả phiếu tự đánh giá

- **Căn cứ:** AssessmentsService; [nguồn](../apps/backend/src/assessments/assessments.service.ts#L177).
- **Tiền điều kiện/quyền:** Preflight đủ điểm, minh chứng nháp đủ tệp, đúng kỳ và còn quyền.
- **Hậu điều kiện và chuyển trạng thái:** DRAFT/RETURNED→SUBMITTED; chuyển draft evidence sang PROCESSING và tạo job; STAFF trả phiếu có lý do→RETURNED, hủy kết quả/job cần thiết.
- **Bất biến:** Submit đọc lại rubric, điểm, trần nhóm, cờ F15 và minh chứng trong transaction giữ khóa Term. Preflight dùng cùng kiểm tra dữ liệu để báo trước cho sinh viên.

<a id="r-12"></a>

### R-12 — Liên kết minh chứng với tiêu chí

- **Căn cứ:** EvidenceService.create + CriterionAssessment; [nguồn](../apps/backend/src/evidence/evidence.service.ts#L180).
- **Tiền điều kiện/quyền:** Đúng sinh viên/kỳ, rubric đã công bố, criterion thuộc rubric.
- **Hậu điều kiện và chuyển trạng thái:** Evidence.criterionAssessmentId nối về student/term/criterion; file gắn Evidence.
- **Bất biến/ca biên/gap:** FE không được bỏ liên kết nháp chỉ vì thiếu reviews; BL-013. Nháp không tệp là blocker khi nộp.

<a id="r-13"></a>

### R-13 — Quyền và tính nhất quán Storage

- **Căn cứ:** EvidenceService; [nguồn](../apps/backend/src/evidence/evidence.service.ts#L152).
- **Tiền điều kiện/quyền:** Kiểm ownership/scope trước ký; upload trong cửa sổ cho phép.
- **Hậu điều kiện và chuyển trạng thái:** Lưu storage key bền vững, cấp URL có hạn; upload nháp DataURL≤8 MB; chỉ xóa nháp chưa xử lý.
- **Bất biến/ca biên/gap:** Storage/DB là hai hệ thống không có một transaction; BL-007/026 phải được xử lý bằng bước bù đúng thời điểm.

<a id="r-14"></a>

### R-14 — Duyệt minh chứng và mất hiệu lực điểm

- **Căn cứ:** ReviewsService + EvidenceService; [nguồn](../apps/backend/src/reviews/reviews.service.ts#L216).
- **Tiền điều kiện/quyền:** STAFF đúng Khoa, phiếu mở, khóa và expectedVersion nếu cung cấp hợp lệ.
- **Hậu điều kiện và chuyển trạng thái:** APPROVED/REJECTED/NEEDS_SUPPLEMENT kèm review/audit; thay đổi căn cứ invalidate điểm liên quan; kết luận Evidence không tự chốt điểm.
- **Bất biến/ca biên/gap:** expectedVersion optional; thêm file APPROVED còn gap BL-015; bổ sung/nguồn khi AI chạy cần đồng bộ version/job (BL-022).

<a id="r-15"></a>

### R-15 — Xác minh rồi chốt tiêu chí

- **Căn cứ:** AssessmentsService + workflow.edit; [nguồn](../apps/backend/src/assessments/assessments.service.ts#L328).
- **Tiền điều kiện/quyền:** Trong workflow mới, chốt tiêu chí, chốt phiếu và chốt hàng loạt đều kiểm tra quyền `STAFF` theo Khoa snapshot và trạng thái phiếu/kỳ dưới khóa `Term` trong transaction ghi. Cần dữ liệu chính thức đủ và ghi chú xác minh.
- **Hậu điều kiện và chuyển trạng thái:** NEEDS_VERIFICATION→READY_FOR_REVIEW→FINALIZED; ghi người chốt/lý do; minh chứng thay đổi hoặc attendance đổi phải xóa officialScore cũ.
- **Bất biến/ca biên/gap:** Trạng thái trung gian không là tự phê duyệt; hợp nhất nguồn hoạt động Q-01; route chấm /class bị từ chối.

<a id="r-16"></a>

### R-16 — Vòng đời điểm danh

- **Căn cứ:** ActivitiesService; [nguồn](../apps/backend/src/activities/activities.service.ts#L160).
- **Tiền điều kiện/quyền:** Hoạt động có kỳ/tiêu chí phù hợp, người tham gia đúng roster/phạm vi.
- **Hậu điều kiện và chuyển trạng thái:** DRAFT→CONFIRMED→REVOKED; chỉ CONFIRMED tính, thu hồi có lý do; tính lại/xóa điểm đã chốt trong cùng transaction.
- **Bất biến/ca biên/gap:** Community cần rolesScore; chưa chốt rate Q-02 và vai trò ADMIN Q-09; BL-005/014.

<a id="r-17"></a>

### R-17 — Sẵn sàng và bàn giao

- **Căn cứ:** WorkflowService.send + sendBlockers; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L212).
- **Tiền điều kiện/quyền:** STAFF; 1–100 sinh viên; phiếu đã nộp; đủ FINALIZED và verificationNote; không còn unresolved evidence/PENDING appeal.
- **Hậu điều kiện và chuyển trạng thái:** WORKING/RETURNED→SENT; revision tăng và snapshot chụp trong transaction khóa Term; gửi lại SENT bỏ qua.
- **Bất biến/ca biên/gap:** Unresolved gồm PROCESSING,PLAUSIBLE,VERIFIED,NEEDS_HUMAN_REVIEW,NEEDS_SUPPLEMENT,APPEALING,INVALID; không coi tất cả trạng thái là quyết định cuối.

<a id="r-18"></a>

### R-18 — Trả Khoa, ghi nhận không nộp và loại trừ

- **Căn cứ:** WorkflowService.returnResult/recordNotSubmitted/exclude/restoreExcluded; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L239).
- **Tiền điều kiện/quyền:** ADMIN trả SENT có lý do; STAFF ghi không nộp sau hạn hiệu lực và chưa có phiếu SUBMITTED/RETURNED; ADMIN loại trừ hành chính trước công bố.
- **Hậu điều kiện và chuyển trạng thái:** Trả→RETURNED; không nộp/loại trừ→EXCLUDED; restore hiện chỉ loại trừ có exclusionReason→WORKING.
- **Bất biến/ca biên/gap:** Hai nghiệp vụ chung EXCLUDED nhưng không cùng lý do/khả năng restore; Q-06; vòng lặp admin còn BL-021.

<a id="r-19"></a>

### R-19 — Công bố theo revision

- **Căn cứ:** WorkflowService.publish; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L325).
- **Tiền điều kiện/quyền:** ADMIN; workflow kỳ mở; đủ SENT/EXCLUDED; không pending appeals; hạn chung cho phép công bố theo code.
- **Hậu điều kiện và chuyển trạng thái:** Append AssessmentPublication unique(student,term,revision), giữ snapshot; revision có rồi bỏ qua; kỳ→REVIEWING; tạo notification.
- **Bất biến/ca biên/gap:** Publication bất biến theo luồng service; không khẳng định DB có trigger append-only. Phiên bản mới cần vòng trả/chấm/gửi lại.

<a id="r-20"></a>

### R-20 — Chốt và khóa kỳ

- **Căn cứ:** WorkflowService.conditions/close + CriteriaService.reopenTerm; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L352).
- **Tiền điều kiện/quyền:** ADMIN; REVIEWING; đủ publication mới nhất, không đơn PENDING, hết hạn phúc khảo theo chính sách.
- **Hậu điều kiện và chuyển trạng thái:** Kỳ→CLOSED; thao tác ghi khóa; route reopen hiện luôn từ chối.
- **Bất biến/ca biên/gap:** Implementation chỉ xét hạn appeal chung, bỏ gia hạn BL-006. Điều kiện UI không thay kiểm tra transaction.

<a id="r-21"></a>

### R-21 — Tạo và giải quyết phúc khảo

- **Căn cứ:** AppealsService; [nguồn](../apps/backend/src/appeals/appeals.service.ts#L72).
- **Tiền điều kiện/quyền:** Sinh viên sở hữu kết quả/tiêu chí/minh chứng trong kỳ; trong hạn APPEAL hiệu lực; STAFF đúng Khoa giải quyết.
- **Hậu điều kiện và chuyển trạng thái:** PENDING→ACCEPTED/REJECTED có lý do; ACCEPTED mở lại đối tượng liên quan và cần Khoa chấm/gửi lại; REJECTED phục hồi trạng thái phù hợp.
- **Bất biến/ca biên/gap:** ADMIN bị service từ chối resolve dù decorator có ADMIN; số lần/phạm vi mở lại cần Q-07.

<a id="r-22"></a>

### R-22 — Hiệu chỉnh sau công bố

- **Căn cứ:** WorkflowService.requestCorrection/send/publish; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L268).
- **Tiền điều kiện/quyền:** ADMIN; kỳ chưa CLOSED, có publication; chưa có request OPEN/FACULTY_RESUBMITTED.
- **Hậu điều kiện và chuyển trạng thái:** OPEN→FACULTY_RESUBMITTED khi gửi→REPUBLISHED khi công bố; giữ sourcePublication/sourceRevision/resultingRevision.
- **Bất biến/ca biên/gap:** Không sửa snapshot cũ; enum CANCELLED không chứng minh có endpoint cancel. Không tự mở CLOSED.

<a id="r-23"></a>

### R-23 — Nguồn bảng điểm và báo cáo

- **Căn cứ:** ReportsService + ConductScoresService; [nguồn](../apps/backend/src/reports/reports.service.ts#L17).
- **Tiền điều kiện/quyền:** Actor có quyền ở kỳ, chọn nguồn chính thức theo workflow/legacy.
- **Hậu điều kiện và chuyển trạng thái:** CTSV xem snapshot bàn giao, báo cáo chọn publication mới nhất; kỳ legacy chỉ dùng rubric complete; average chỉ trên dòng có điểm.
- **Bất biến/ca biên/gap:** Chưa công bố là null/UNPUBLISHED, không là 0; query thiếu kỳ cần scope sau giải quyết kỳ (BL-001). Trong kỳ `workflowEnabled`, sinh viên xem được điểm gợi ý đã lưu. Điểm chính thức trên phiếu sinh viên vẫn theo publication (BL-033).

<a id="r-24"></a>

### R-24 — Toàn vẹn pagination, thống kê và export

- **Căn cứ:** WorkflowService.list/export + facultyAnalytics; [nguồn](../apps/backend/src/evaluation-workflow/workflow.service.ts#L175).
- **Tiền điều kiện/quyền:** Bộ lọc được validate và có quyền; phân biệt 2 response envelope list.
- **Hậu điều kiện và chuyển trạng thái:** Summary toàn tập lọc; export không cắt trang; dashboard gom đủ trang và phát hiện trùng/thiếu/stale trước vẽ.
- **Dashboard sinh viên:** Dùng `counts` toàn phạm vi kỳ cho chỉ số minh chứng. Danh sách việc cần bổ sung tải riêng với `NEEDS_SUPPLEMENT` (BL-035).
- **Bất biến/ca biên/gap:** KPI, workflow, report lỗi độc lập; không dùng lỗi làm0. Các list còn gap BL-018/019/020.

<a id="r-25"></a>

### R-25 — Thông báo riêng tư và chống lặp

- **Căn cứ:** NotificationsService + Notification schema; [nguồn](../apps/backend/src/notifications/notifications.service.ts#L10).
- **Tiền điều kiện/quyền:** userId đúng chủ; event phát sinh từ hành động hợp lệ.
- **Hậu điều kiện và chuyển trạng thái:** Danh sách tối đa 50 thông báo gần nhất, `unreadCount` tính trên toàn bộ thông báo của chủ tài khoản; markRead theo chủ và markAll theo userId; dedupeKey unique khi có (BL-037).
- **Bất biến/ca biên/gap:** Chống trùng request không được cấm sự kiện mới; BL-021; không assume realtime/email đã triển khai.

<a id="r-26"></a>

### R-26 — Nhật ký và truy vết

- **Căn cứ:** AuditLogService + WorkflowService.history/audit; [nguồn](../apps/backend/src/audit-log/audit-log.service.ts#L1).
- **Tiền điều kiện/quyền:** ADMIN xem audit tổng; STAFF lịch sử phiếu qua scope.
- **Hậu điều kiện và chuyển trạng thái:** Lưu actor/action/entity/old/new, tìm kiếm/phân trang server; history phiếu lấy tối đa 200.
- **Bất biến/ca biên/gap:** Không khẳng định log bất biến bởi DB hay bao hết mọi ghi; tránh credential và payload nhạy cảm.

<a id="r-27"></a>

### R-27 — Claim, lease, retry AI

- **Căn cứ:** EvidenceProcessingWorker + WorkflowService.retryJob; [nguồn](../apps/backend/src/evidence/evidence-processing.worker.ts#L24).
- **Tiền điều kiện/quyền:** Job QUEUED; compare-and-swap claim; retry Admin chỉ FAILED/UNAVAILABLE và phiếu còn hợp lệ.
- **Hậu điều kiện và chuyển trạng thái:** QUEUED→PROCESSING→COMPLETED/FAILED/UNAVAILABLE/CANCELLED; poll3 giây, lease=max(5 phút,timeout+2 phút), recovery tối đa 3 attempt theo code.
- **Bất biến/ca biên/gap:** Timeout đọc body còn BL-008; addSource cancellation còn BL-022; Redis/BullMQ scaffold không phải worker này.

<a id="r-28"></a>

### R-28 — Chấp nhận kết quả AI còn hiệu lực

- **Căn cứ:** EvidenceProcessingWorker.acceptResult; [nguồn](../apps/backend/src/evidence/evidence-processing.worker.ts#L175).
- **Tiền điều kiện/quyền:** Cùng attempt/version/rubric, phiếu SUBMITTED, kỳ mở, chưa SENT/EXCLUDED, hồ sơ còn xử lý phù hợp.
- **Hậu điều kiện và chuyển trạng thái:** Chỉ ghi suggestions có criterion trong rubric, điểm trong trần, confidence0–1, reasoning; response muộn bị hủy thay vì ghi đè quyết định.
- **Bất biến/ca biên/gap:** Không tự ghi OCR/VerificationResult/Anomaly từ output suggestions; không gọi pipeline thật để audit docs.

<a id="r-29"></a>

### R-29 — Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt

- **Căn cứ:** GroundingImportService + AssessmentsService + ActivitiesService; [F15](features/15-evidence-grounding-and-batch-finalize.md).
- **Tiền điều kiện/quyền:** STAFF thao tác trong phạm vi Khoa theo snapshot. Import, thu hồi, đồng bộ và chốt phiếu F15 yêu cầu cờ bật, kỳ ACTIVE hoặc REVIEWING. Điểm ghi kiểm dưới khóa Term. Chỉ tắt cờ khi đã xử lý hết lô ACTIVE.
- **Hậu điều kiện và chuyển trạng thái:**
  1. **Import căn cứ:** AcademicGrounding cập nhật dữ liệu xác minh và điểm gợi ý theo rubric. Điểm danh dùng luồng ActivitiesService. ClubLeadershipGrounding liên kết tiêu chí 4/13 qua clubGroundingIds và hiển thị nguồn cho Khoa đối chiếu. Tên tổ chức và chức vụ không tự xác nhận điều kiện boolean. Dữ liệu xác minh thủ công được giữ khi đồng bộ.
  2. **Minh chứng 0 file:** Ở kỳ `evidenceBasisWorkflowEnabled = true`, cho phép sinh viên nộp minh chứng 0 file khi có mô tả $\ge 10$ ký tự, chuyển trạng thái sang `NEEDS_HUMAN_REVIEW` và không tạo job AI. Kỳ `evidenceBasisWorkflowEnabled = false` giữ nguyên chặn thiếu file.
  3. **Chốt phiếu (Cá nhân & Hàng loạt):** Chỉ chốt các tiêu chí `READY_FOR_REVIEW` có `suggestedScore !== null` thành `FINALIZED` với `officialScore = suggestedScore`. Chặn chốt toàn bộ nếu sinh viên còn minh chứng `NEEDS_HUMAN_REVIEW` hoặc `NEEDS_SUPPLEMENT`, hoặc có khiếu nại đang chờ giải quyết. Chốt hàng loạt tối đa 100 phiếu/lần, transaction riêng từng phiếu, không tự động gửi CTSV.
  4. **Thu hồi lô:** Chặn cả lô khi tiêu chí bị ảnh hưởng đã FINALIZED, phiếu đã SENT, sinh viên đã có publication hoặc kỳ không đủ điều kiện F15. Nhánh CLB còn chặn EXCLUDED. Khi thu hồi hợp lệ, đồng bộ căn cứ còn hiệu lực và cập nhật điểm gợi ý phụ thuộc nguồn đã thu hồi. Nhánh CLB giữ điểm gợi ý có căn cứ xác minh thủ công.
- **Bất biến/ca biên:**
  - MSSV dạng text luôn bảo toàn số 0 ở đầu (`"0102210001"`).
  - Xác nhận import phải dùng cùng kỳ với kết quả xem trước. Đổi ngữ cảnh yêu cầu xem trước lại.
  - Không suy diễn từ dữ liệu trống: ô trống = "Chưa có dữ liệu" (giữ chờ).
  - Không ghi đè điểm chính thức của tiêu chí đã `FINALIZED`.

## Yêu cầu nhất quán xuyên module

Mọi ghi điểm, căn cứ, submission, handoff và publication phải cùng studentId/termId/rubricVersionId phù hợp. Foreign key chỉ bảo đảm tồn tại; phải kiểm sự phù hợp nghiệp vụ trong service. Schema có unique CriterionAssessment(student,term,criterion), Submission(student,term,rubric), Handoff(student,term), Publication(student,term,revision) và Notification.dedupeKey.

Khóa Term tuần tự hóa nộp phiếu, lưu điểm và xóa nháp. BL-026/027 được kiểm bằng hai kết nối PostgreSQL. Dọn Storage vẫn diễn ra sau commit; kiểm thử sử dụng Storage giả lập.

Mỗi thay đổi quy tắc phải cập nhật feature/API/test/backlog và CHANGELOG theo [hướng dẫn tài liệu](README.md). Không dùng tài liệu để che khác biệt giữa expected và current.

