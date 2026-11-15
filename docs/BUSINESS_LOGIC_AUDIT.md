# Audit logic nghiệp vụ EduPoint

Ngày lập tài liệu: 2026-11-15. Baseline nguồn: `93fb66c`. Ghi nhận kết quả audit mã nguồn và tiến độ xử lý theo từng đợt; đợt 1 đã hoàn thành xử lý và kiểm chứng 3 mục P0 (BL-001, BL-002, BL-009). Đọc [kiến trúc và workflow](PROJECT_OVERVIEW.md), [quy tắc](BUSINESS_RULES.md) trước các finding.

## Phạm vi và cách phân loại

- **Confirmed:** luồng mã nguồn đủ chứng minh mâu thuẫn/hành vi; không đồng nghĩa đã tái hiện trên deployment.
- **Potential:** thứ tự xen kẽ/concurrency có thể gây lỗi, cần kiểm tra DB thực cách ly.
- Severity đánh giá tác động; priority đánh giá thứ tự xử lý. P0 kiểm chứng/xử lý trước bàn giao, P1 tiếp theo, P2 theo sprint được chọn.
- Tổng cộng 27 mục: **24 mục Open** (22 Confirmed, 2 Potential) và **3 mục Resolved** (BL-001, BL-002, BL-009); không có Critical. Trong 24 mục Open có 6 High Confirmed, 16 Medium Confirmed, 1 High Potential và 1 Medium Potential.
- Expected chỉ dựa vào luồng/quy tắc hiện có; Q-01/Q-02 vẫn cần quyết định trước khi triển khai hợp nhất nguồn/tỷ lệ điểm. Gợi ý sửa là đề xuất, chưa được tự thực thi.

## Danh sách ưu tiên

| ID | Mức độ | Độ chắc chắn | Ưu tiên | Vấn đề |
|---|---|---|---|---|
| [BL-001](#bl-001) | High | Confirmed | P0 | Bỏ termId vượt ranh giới Khoa lịch sử (Resolved) |
| [BL-002](#bl-002) | High | Confirmed | P0 | Response duyệt minh chứng chứa password hash cán bộ (Resolved) |
| [BL-006](#bl-006) | High | Confirmed | P0 | Chốt kỳ bỏ qua gia hạn phúc khảo còn hiệu lực |
| [BL-007](#bl-007) | High | Confirmed | P0 | Lỗi ký URL xóa tệp đã commit vào DB |
| [BL-009](#bl-009) | High | Confirmed | P0 | JWT secret được đọc trước khi ConfigModule nạp .env (Resolved) |
| [BL-026](#bl-026) | High | Potential | P0 | Xóa minh chứng/tệp có khoảng đua với nộp phiếu |
| [BL-003](#bl-003) | High | Confirmed | P1 | Tiêu chí nhóm mặc định thiếu baseScore |
| [BL-004](#bl-004) | High | Confirmed | P1 | leadershipRole gửi chuỗi làm điểm chức vụ bằng 0 |
| [BL-005](#bl-005) | High | Confirmed | P1 | Xác minh minh chứng ghi đè số hoạt động từ điểm danh |
| [BL-008](#bl-008) | High | Confirmed | P1 | Timeout AI dừng trước lúc đọc response body |
| [BL-027](#bl-027) | Medium | Potential | P1 | Preflight nộp phiếu nằm ngoài transaction khóa |
| [BL-010](#bl-010) | Medium | Confirmed | P2 | Web khóa sửa theo hạn gốc dù đã gia hạn |
| [BL-011](#bl-011) | Medium | Confirmed | P2 | Mật khẩu tạm không được bàn giao đầy đủ |
| [BL-012](#bl-012) | Medium | Confirmed | P2 | Thiếu classId/facultyId scalar làm bộ lọc tài khoản sai |
| [BL-013](#bl-013) | Medium | Confirmed | P2 | Nháp minh chứng không hiện dưới đúng tiêu chí |
| [BL-014](#bl-014) | Medium | Confirmed | P2 | Rubric không lưu rolesScore cần cho điểm danh cộng đồng |
| [BL-015](#bl-015) | Medium | Confirmed | P2 | Thêm tệp vào Evidence APPROVED không đổi version/kết luận |
| [BL-016](#bl-016) | Medium | Confirmed | P2 | Bắt đổi mật khẩu lần đầu chỉ có ở frontend |
| [BL-017](#bl-017) | Medium | Confirmed | P2 | Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao |
| [BL-018](#bl-018) | Medium | Confirmed | P2 | Yêu cầu sửa thông tin mất meta và không có phân trang UI |
| [BL-019](#bl-019) | Medium | Confirmed | P2 | Danh sách minh chứng chỉ tải trang đầu rồi lọc cục bộ |
| [BL-020](#bl-020) | Medium | Confirmed | P2 | Chọn gia hạn chỉ có 100 sinh viên và lệch roster kỳ |
| [BL-021](#bl-021) | Medium | Confirmed | P2 | Loại trừ lần hai trùng dedupeKey và rollback |
| [BL-022](#bl-022) | Medium | Confirmed | P2 | Thêm nguồn xác minh hủy job nhưng Evidence còn PROCESSING |
| [BL-023](#bl-023) | Medium | Confirmed | P2 | Màn bổ sung hiển thị deadline/nội dung giả |
| [BL-024](#bl-024) | Medium | Confirmed | P2 | Sinh viên mở URL kỳ khác nhưng đọc activeTerm |
| [BL-025](#bl-025) | Medium | Confirmed | P2 | API tạo tài khoản bỏ qua ràng buộc vai trò mà UI bắt buộc |

## Chi tiết

<a id="bl-001"></a>

### BL-001 — Bỏ termId vượt ranh giới Khoa lịch sử

1. **Bug ID:** BL-001. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/conduct-scores/conduct-scores.controller.ts:46](../apps/backend/src/conduct-scores/conduct-scores.controller.ts#L46); [apps/backend/src/conduct-scores/conduct-scores.service.ts:13](../apps/backend/src/conduct-scores/conduct-scores.service.ts#L13); [apps/backend/src/evaluation-workflow/workflow.service.ts:30](../apps/backend/src/evaluation-workflow/workflow.service.ts#L30).
4. **Workflow:** Tra cứu bảng điểm sinh viên chuyển Khoa. [F01](features/01-accounts-and-access.md), [F09](features/09-faculty-handoff.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** scope kiểm tra lớp hiện tại khi termId thiếu; getScoreByStudent tự chọn kỳ sau đó.
6. **Kỳ vọng có căn cứ:** Quyền đọc phải gắn với Khoa snapshot của chính kỳ được trả, như scope khi có termId.
7. **Logic và trace qua lớp:** Controller kiểm tra trước khi service giải quyết kỳ; hai lớp dùng hai ngữ cảnh. Snapshot không tham gia phân quyền khi query bỏ trống.
8. **Tình huống:** Sinh viên chuyển từ Khoa A sang B; cán bộ B gọi GET /scores/:id không kèm kỳ, nhận kết quả kỳ thuộc A.
9. **Tác động:** Lộ bảng điểm ngoài phân công lịch sử.
10. **Gợi ý sửa:** Giải quyết termId trước rồi scope trên kỳ đó, hoặc bắt buộc kỳ khi tra cứu cán bộ.
11. **Regression test:** So sánh request có/không termId với snapshot A và lớp hiện tại B; cả hai phải áp dụng cùng ranh giới.
12. **Bằng chứng đã xử lý:** Đã bổ sung `resolveTermId(termId)` trong `ConductScoresService`: giải quyết kỳ đúng một lần duy nhất trước khi gọi `workflow.scope`. Nếu kỳ không tồn tại ném `NotFoundException`; nếu hệ thống không có kỳ nào trả `getEmptyScore()`; nếu sinh viên chuyển Khoa, cả request có và không có `termId` đều kiểm tra theo snapshot `assessmentHandoff.facultyId` của kỳ được trả. Kiểm chứng đạt 5/5 ca trong [apps/backend/test/security-fixes.test.cjs](../apps/backend/test/security-fixes.test.cjs).

**Giới hạn kiểm chứng:** Đã kiểm chứng bằng pure unit test in-memory (Node test runner); chưa kiểm chứng trên DB/production triển khai.

<a id="bl-002"></a>

### BL-002 — Response duyệt minh chứng chứa password hash cán bộ

1. **Bug ID:** BL-002. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/reviews/reviews.service.ts:226](../apps/backend/src/reviews/reviews.service.ts#L226); [apps/backend/src/auth/jwt.strategy.ts:30](../apps/backend/src/auth/jwt.strategy.ts#L30).
4. **Workflow:** Cán bộ trả kết quả duyệt. [F01](features/01-accounts-and-access.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại:** updatedEvidence include reviewer:true, trả thẳng qua response interceptor.
6. **Kỳ vọng có căn cứ:** Loại password khỏi mọi response, tương tự JwtStrategy/AuthService.
7. **Logic và trace qua lớp:** Prisma tải toàn bộ User cho quan hệ reviewer; interceptor chỉ bọc envelope, không lọc trường nhạy cảm.
8. **Tình huống:** Cán bộ duyệt một minh chứng rồi xem response HTTP có reviews[].reviewer.password.
9. **Tác động:** Rò rỉ hash sang client, log và công cụ giám sát của client.
10. **Gợi ý sửa:** Dùng select DTO an toàn cho reviewer và các quan hệ User.
11. **Regression test:** Duyệt thành công; assert recursively không có password/hash/authVersion ngoài hợp đồng.
12. **Bằng chứng đã xử lý:** Đã sửa `reviews.service.ts` tại dòng 226, thay `reviewer: true` bằng projection `reviewer: { select: { id: true, fullName: true, role: true } }` chỉ giữ 3 trường tối thiểu client cần. Kiểm chứng đạt 2/2 ca trong [apps/backend/test/security-fixes.test.cjs](../apps/backend/test/security-fixes.test.cjs): bắt được rò rỉ hash nếu dùng `reviewer: true` và khẳng định response không chứa `password` hay `authVersion`.

**Giới hạn kiểm chứng:** Đã kiểm chứng bằng pure unit test in-memory; chưa kiểm chứng trên DB/production triển khai.

<a id="bl-003"></a>

### BL-003 — Tiêu chí nhóm mặc định thiếu baseScore

1. **Bug ID:** BL-003. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/criteria/dut-rubric.ts:11](../apps/backend/src/criteria/dut-rubric.ts#L11); [apps/backend/src/criteria/rubric-scoring.ts:41](../apps/backend/src/criteria/rubric-scoring.ts#L41).
4. **Workflow:** Tính điểm tiêu chí 2. [F04](features/04-rubrics-and-scoring.md).
5. **Hiện tại:** group_penalty đọc Number(config.baseScore), nhưng cấu hình mặc định không có trường này.
6. **Kỳ vọng có căn cứ:** Mô tả tiêu chí cho trần 3 điểm, trừ theo lần vắng và mất hết khi trễ việc; trường hợp không vi phạm phải có điểm nền hợp lệ.
7. **Logic và trace qua lớp:** Không trễ deadline đi qua nhánh Number(undefined), tạo NaN và không tính được gợi ý hợp lệ; validator hiện chưa chặn thiếu cấu hình này.
8. **Tình huống:** Nhập ba bộ đếm bằng 0 cho tiêu chí 2 của rubric mặc định.
9. **Tác động:** Không tự tính/chốt theo gợi ý đúng, làm tắc phiếu hoặc tăng thao tác thủ công.
10. **Gợi ý sửa:** Thống nhất điểm nền với quy chế, bổ sung validation config theo kind và rà các bản rubric đã lưu; chưa sửa dữ liệu tự động.
11. **Regression test:** Rubric mặc định: không vi phạm→3, vắng không lý do một lần→1, trễ việc→0; config thiếu baseScore phải bị từ chối.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-004"></a>

### BL-004 — leadershipRole gửi chuỗi làm điểm chức vụ bằng 0

1. **Bug ID:** BL-004. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/web/src/pages/officer/StudentAssessment.tsx:29](../apps/web/src/pages/officer/StudentAssessment.tsx#L29); [apps/web/src/pages/officer/StudentAssessment.tsx:115](../apps/web/src/pages/officer/StudentAssessment.tsx#L115); [apps/backend/src/criteria/rubric-scoring.ts:29](../apps/backend/src/criteria/rubric-scoring.ts#L29).
4. **Workflow:** Xác minh tiêu chí 14/16. [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại:** booleanFields thiếu leadershipRole; serializer giữ 'true' là chuỗi.
6. **Kỳ vọng có căn cứ:** leadershipRole phải boolean như evaluator yêu cầu để điều kiện chức vụ được xét đúng.
7. **Logic và trace qua lớp:** Giao diện gửi chuỗi; leadership_duty và verified_boolean so sánh ===true. Thông tin người dùng chọn có bị coi là không đạt.
8. **Tình huống:** Cán bộ nhập có chức vụ, bình chọn 95%, xác nhận cố vấn; tiêu chí 14 cho 0 thay vì 4; tiêu chí 16 cũng có thể mất 3 điểm.
9. **Tác động:** Thiệt điểm và kết luận sai cho sinh viên có chức vụ.
10. **Gợi ý sửa:** Dùng kiểu dữ liệu rubric làm nguồn form và kiểm tra payload boolean ở backend.
11. **Regression test:** Thao tác form thật cho leadershipRole=true ở tiêu chí 14 và 16; kiểm tra payload boolean và điểm 4/3.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-005"></a>

### BL-005 — Xác minh minh chứng ghi đè số hoạt động từ điểm danh

1. **Bug ID:** BL-005. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/activities/activities.service.ts:41](../apps/backend/src/activities/activities.service.ts#L41); [apps/backend/src/assessments/assessments.service.ts:321](../apps/backend/src/assessments/assessments.service.ts#L321).
4. **Workflow:** Điểm danh → xác minh tiêu chí hoạt động. [F07](features/07-evidence-review-and-verification.md), [F08](features/08-activities-and-attendance.md).
5. **Hiện tại:** Điểm danh tính CONFIRMED roster; saveVerification tính lại verifiedActivityCount chỉ từ Evidence APPROVED.
6. **Kỳ vọng có căn cứ:** Dữ liệu đã xác nhận không tự mất chỉ vì đổi màn xác minh; cách hợp nhất/chống đếm trùng cần Q-01.
7. **Logic và trace qua lớp:** Hai service cùng ghi verifiedData nhưng dùng nguồn khác nhau. saveVerification không bảo toàn hoặc đọc roster; khi không có Evidence thì count trở thành 0.
8. **Tình huống:** Một hoạt động đã CONFIRMED cho sinh viên và có gợi ý 5; mở xác minh và lưu, không có Evidence APPROVED nên count=0.
9. **Tác động:** Điểm phụ thuộc thứ tự thao tác và mất dữ liệu nguồn chính thức.
10. **Gợi ý sửa:** Thiết kế bộ tổng hợp nguồn chung; chốt khóa định danh hoạt động với nghiệp vụ trước khi gộp.
11. **Regression test:** CONFIRMED roster không có Evidence, chỉ Evidence, cả hai cùng hoạt động và hai nguồn khác hoạt động; kết quả không đổi theo thứ tự lưu.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai. Chính sách hợp nhất nguồn cần [Q-01](DECISIONS.md#q-01).

<a id="bl-006"></a>

### BL-006 — Chốt kỳ bỏ qua gia hạn phúc khảo còn hiệu lực

1. **Bug ID:** BL-006. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evaluation-workflow/workflow.service.ts:193](../apps/backend/src/evaluation-workflow/workflow.service.ts#L193); [apps/backend/src/deadline-extensions/deadline-extensions.service.ts:9](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts#L9); [apps/backend/src/appeals/appeals.service.ts:72](../apps/backend/src/appeals/appeals.service.ts#L72).
4. **Workflow:** Gia hạn → phúc khảo → chốt kỳ. [F03](features/03-terms-and-deadlines.md), [F10](features/10-publication-and-term-closure.md), [F11](features/11-appeals-and-corrections.md).
5. **Hiện tại:** conditions chỉ so thời gian với term.appealDeadline, trong khi tạo appeal dùng hạn resolve theo sinh viên/lớp.
6. **Kỳ vọng có căn cứ:** Quyền phúc khảo theo gia hạn còn hiệu lực phải được tôn trọng trước khi khóa kỳ.
7. **Logic và trace qua lớp:** Một endpoint cho gửi theo hạn hiệu lực, endpoint chốt lại chỉ dùng hạn gốc; CLOSED sau chốt chặn quyền đang được gia hạn.
8. **Tình huống:** Hạn gốc 10/11, gia hạn sinh viên đến 20/11, ngày 15/11 chưa có đơn PENDING và mọi phiếu đã công bố: canClose có thể true.
9. **Tác động:** Kết thúc sớm quyền phúc khảo đã cấp.
10. **Gợi ý sửa:** Kiểm tra tất cả cửa sổ APPEAL đang hiệu lực trong conditions và transaction close; xác nhận thêm chính sách Q-03.
11. **Regression test:** Hạn gốc hết nhưng gia hạn cá nhân/lớp chưa hết→không chốt; thu hồi/hết toàn bộ hạn→đánh giá lại blockers.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-007"></a>

### BL-007 — Lỗi ký URL xóa tệp đã commit vào DB

1. **Bug ID:** BL-007. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:381](../apps/backend/src/evidence/evidence.service.ts#L381); [apps/backend/src/evidence/evidence.service.ts:384](../apps/backend/src/evidence/evidence.service.ts#L384).
4. **Workflow:** Upload tệp nháp. [F06](features/06-evidence-and-storage.md).
5. **Hiện tại:** Sau khi EvidenceFile commit, getFileUrl lỗi cũng đi vào catch xóa object Storage.
6. **Kỳ vọng có căn cứ:** Bản ghi tệp thành công phải còn object; lỗi tạo URL tạm không được xóa object đã được DB tham chiếu.
7. **Logic và trace qua lớp:** Một catch bao cả transaction tạo file và bước ký URL sau commit; rollback bù không biết giao dịch đã thành công.
8. **Tình huống:** Upload Storage và DB thành công, endpoint ký URL tạm trả lỗi; request thất bại và object bị DELETE.
9. **Tác động:** Mất tệp minh chứng, DB giữ liên kết hỏng.
10. **Gợi ý sửa:** Tách bước commit và ký URL; chỉ cleanup object khi DB chưa commit, cho ký lại URL sau lỗi.
11. **Regression test:** Double Storage upload/DB thành công rồi signing lỗi; object không bị xóa, bản ghi vẫn ký lại được.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-008"></a>

### BL-008 — Timeout AI dừng trước lúc đọc response body

1. **Bug ID:** BL-008. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evidence/evidence-processing.worker.ts:133](../apps/backend/src/evidence/evidence-processing.worker.ts#L133); [apps/backend/src/evidence/evidence-processing.worker.ts:135](../apps/backend/src/evidence/evidence-processing.worker.ts#L135).
4. **Workflow:** Worker gọi pipeline. [F14](features/14-audit-monitoring-and-ai-jobs.md).
5. **Hiện tại:** clearTimeout chạy sau fetch headers; response.json() chờ ngoài timeout.
6. **Kỳ vọng có căn cứ:** Cửa sổ timeout phải giới hạn toàn bộ request và đọc body để worker tiếp tục recovery.
7. **Logic và trace qua lớp:** fetch resolve khi có headers, không đợi toàn bộ JSON. Poller có thể giữ busy trong body promise không kết thúc.
8. **Tình huống:** Pipeline trả HTTP200 và headers rồi không đóng body JSON.
9. **Tác động:** Worker đang chạy có thể kẹt xử lý và không tiếp tục polling; lease cần phục hồi bởi tiến trình khác/restart.
10. **Gợi ý sửa:** Giữ AbortController/timer đến sau khi đọc/validate body và reset busy bằng finally.
11. **Regression test:** Mock response có headers tức thì, body treo; sau deadline job kết thúc đúng trạng thái và poller nhận job tiếp.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-009"></a>

### BL-009 — JWT secret được đọc trước khi ConfigModule nạp .env

1. **Bug ID:** BL-009. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/auth/auth.module.ts:12](../apps/backend/src/auth/auth.module.ts#L12); [apps/backend/src/app.module.ts:22](../apps/backend/src/app.module.ts#L22); [apps/backend/src/auth/jwt.strategy.ts:13](../apps/backend/src/auth/jwt.strategy.ts#L13); [apps/backend/src/auth/jwt-config.helper.ts](../apps/backend/src/auth/jwt-config.helper.ts).
4. **Workflow:** Khởi động cấu hình và đăng nhập. [F01](features/01-accounts-and-access.md).
5. **Hiện tại:** JwtModule.register đọc process.env lúc import; JwtStrategy đọc lúc khởi tạo, sau ConfigModule.forRoot.
6. **Kỳ vọng có căn cứ:** Bên ký và xác thực phải dùng cùng secret đã kiểm tra cấu hình.
7. **Logic và trace qua lớp:** Nếu secret chỉ nằm trong .env, giá trị lúc import có thể là fallback hoặc throw production; strategy sau đó đọc secret thật. Không áp dụng khi env đã được cấp từ shell/deployment.
8. **Tình huống:** Chạy dev với JWT_SECRET chỉ trong .env: login ký fallback, request /auth/me kiểm bằng secret khác.
9. **Tác động:** Token vừa cấp bị 401 hoặc production không khởi động theo cấu hình mong đợi.
10. **Gợi ý sửa:** Inject ConfigService qua registerAsync và kiểm tra secret một lần; không dùng fallback ngoài môi trường chủ ý.
11. **Regression test:** Process cô lập mô phỏng env trước/sau ConfigModule, không start backend; assert signer và verifier cùng secret. Deployment cấp sẵn env là đối chứng.
12. **Bằng chứng đã xử lý:** Đã tạo helper `getJwtSecret(config: ConfigService)`, chuyển `JwtModule.register` sang `JwtModule.registerAsync` inject `ConfigService` trong `auth.module.ts`, và inject `ConfigService` vào constructor của `jwt.strategy.ts`. Kiểm chứng đạt 4/4 ca trong [apps/backend/test/security-fixes.test.cjs](../apps/backend/test/security-fixes.test.cjs) qua cơ chế `strategy.authenticate` thật của Passport: chứng minh token ký 12h được xác thực thành công, và tái hiện token ký bằng fallback secret bị từ chối do sai chữ ký.

**Giới hạn kiểm chứng:** Đã kiểm chứng qua Passport strategy unit test in-memory; chưa kiểm chứng trên deployment thực tế.

<a id="bl-010"></a>

### BL-010 — Web khóa sửa theo hạn gốc dù đã gia hạn

1. **Bug ID:** BL-010. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/hooks/useStudentAssessmentAccess.ts:81](../apps/web/src/hooks/useStudentAssessmentAccess.ts#L81).
4. **Workflow:** Sinh viên sửa/nộp trong gia hạn. [F03](features/03-terms-and-deadlines.md), [F05](features/05-student-assessment.md).
5. **Hiện tại:** Hook tự tính deadlinePassed từ term.submissionDeadline/reviewDeadline và AND với permissions.canEdit.
6. **Kỳ vọng có căn cứ:** UI phải dùng hạn hiệu lực/permissions server đã trả.
7. **Logic và trace qua lớp:** Server tính quyền bằng DeadlineExtensionsService; frontend thêm điều kiện hạn gốc làm phủ định quyền đúng.
8. **Tình huống:** Sinh viên có gia hạn sau hạn gốc, API cho canEdit=true nhưng UI khóa.
9. **Tác động:** Không thể dùng quyền gia hạn qua giao diện.
10. **Gợi ý sửa:** Trả/đọc effectiveDeadline và nguồn hạn thống nhất; tránh tự áp hạn gốc.
11. **Regression test:** Mock permission=true với hạn gốc đã qua, effectiveDeadline tương lai: form cho phép và hiển thị hạn mới.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-011"></a>

### BL-011 — Mật khẩu tạm không được bàn giao đầy đủ

1. **Bug ID:** BL-011. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/users.service.ts:153](../apps/backend/src/users/users.service.ts#L153); [apps/backend/src/users/users.service.ts:176](../apps/backend/src/users/users.service.ts#L176); [apps/web/src/pages/admin/UserManagement.tsx:188](../apps/web/src/pages/admin/UserManagement.tsx#L188); [apps/web/src/pages/admin/UserManagement.tsx:364](../apps/web/src/pages/admin/UserManagement.tsx#L364).
4. **Workflow:** Tạo/import tài khoản. [F01](features/01-accounts-and-access.md).
5. **Hiện tại:** Create sinh mật khẩu ngẫu nhiên khi không truyền rồi chỉ trả safeUser; màn tạo không có bước nhận mật khẩu, import cũng không trình bày đầy đủ thông tin tạm trả về.
6. **Kỳ vọng có căn cứ:** Luồng quản trị tạo tài khoản phải có cách giao credential; reset có trả mật khẩu tạm là tiền lệ hiện có.
7. **Logic và trace qua lớp:** Hash được lưu nhưng plaintext tạm biến mất khỏi kết quả tạo. Forgot-password hiện 503, nên người dùng không tự phục hồi từ luồng này.
8. **Tình huống:** Admin tạo sinh viên bằng form, sinh viên không biết mật khẩu vừa sinh; phải reset bổ sung.
9. **Tác động:** Tài khoản mới chưa sử dụng được và phát sinh vận hành thủ công.
10. **Gợi ý sửa:** Cơ chế bàn giao một lần có kiểm soát tương tự reset/import; UI xử lý phản hồi rõ ràng, không log credential.
11. **Regression test:** Tạo không password và import thành công: Admin nhận được phương thức bàn giao; response/log không lộ credential lâu dài.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-012"></a>

### BL-012 — Thiếu classId/facultyId scalar làm bộ lọc tài khoản sai

1. **Bug ID:** BL-012. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/users.service.ts:91](../apps/backend/src/users/users.service.ts#L91); [apps/web/src/pages/admin/UserManagement.tsx:246](../apps/web/src/pages/admin/UserManagement.tsx#L246); [apps/web/src/pages/admin/UserManagement.tsx:251](../apps/web/src/pages/admin/UserManagement.tsx#L251).
4. **Workflow:** Admin tìm tài khoản theo đơn vị. [F01](features/01-accounts-and-access.md).
5. **Hiện tại:** Danh sách chỉ select quan hệ class/faculty, nhưng bộ lọc UI so u.classId/u.facultyId.
6. **Kỳ vọng có căn cứ:** Danh sách tài khoản đã gán đơn vị phải xuất hiện đúng trong lớp/Khoa.
7. **Logic và trace qua lớp:** Nested relation có id nhưng scalar FK không được trả; so undefined với ID khiến dữ liệu có thật bị loại.
8. **Tình huống:** Chọn một lớp có sinh viên; danh sách hiển thị rỗng dù response chứa class.id đúng.
9. **Tác động:** Không tìm/quản trị được tài khoản theo cấu trúc đơn vị.
10. **Gợi ý sửa:** Thống nhất response DTO và frontend; nếu term-scoped thì scalar phải cùng snapshot với nested class.
11. **Regression test:** User có class.id nhưng không có scalar, lọc theo lớp phải vẫn đúng hoặc API bổ sung scalar theo hợp đồng.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-013"></a>

### BL-013 — Nháp minh chứng không hiện dưới đúng tiêu chí

1. **Bug ID:** BL-013. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:50](../apps/backend/src/evidence/evidence.service.ts#L50); [apps/web/src/pages/student/ScoreReport.tsx:124](../apps/web/src/pages/student/ScoreReport.tsx#L124).
4. **Workflow:** Tải lại phiếu tự đánh giá có nháp. [F05](features/05-student-assessment.md).
5. **Hiện tại:** List Evidence có criterionAssessmentId nhưng không hydrate criterion; evidenceFor chỉ đọc criterionId/criterion/reviews.
6. **Kỳ vọng có căn cứ:** Nháp đã gắn CriterionAssessment phải hiện đúng tiêu chí sau tải lại.
7. **Logic và trace qua lớp:** Khóa liên kết của backend khác các trường frontend dùng để ghép; nháp chưa có review nên không có đường fallback.
8. **Tình huống:** Tạo nháp cho tiêu chí, tải lại trang trước nộp; tệp còn trong DB nhưng không hiện tại ô tiêu chí.
9. **Tác động:** Sinh viên tưởng mất minh chứng, tạo nháp trùng hoặc không xử lý được blocker.
10. **Gợi ý sửa:** Expose criterionId qua quan hệ an toàn hoặc map criterionAssessmentId theo assessment đã tải.
11. **Regression test:** Tạo nháp chưa review, reload; hiển thị đúng một lần tại tiêu chí, sửa/xóa được trong quyền.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-014"></a>

### BL-014 — Rubric không lưu rolesScore cần cho điểm danh cộng đồng

1. **Bug ID:** BL-014. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/criteria/criteria.service.ts:178](../apps/backend/src/criteria/criteria.service.ts#L178); [apps/backend/src/activities/activities.service.ts:166](../apps/backend/src/activities/activities.service.ts#L166).
4. **Workflow:** Cấu hình rubric → xác nhận điểm danh cộng đồng. [F04](features/04-rubrics-and-scoring.md), [F08](features/08-activities-and-attendance.md).
5. **Hiện tại:** PersistTermRubricDraft không lưu rolesScore; confirmParticipants chặn community_activity_tier thiếu rolesScore.
6. **Kỳ vọng có căn cứ:** Cấu hình mà service điểm danh bắt buộc phải có đường nhập/lưu qua luồng quản trị được hỗ trợ; giá trị cụ thể cần Q-02.
7. **Logic và trace qua lớp:** Schema có trường nhưng pipeline tạo/publish rubric chỉ giữ scoringConfig. Rubric mới không có cấu hình bắt buộc của attendance; không kết luận tỷ lệ nào là đúng.
8. **Tình huống:** Kỳ mới dùng tiêu chí cộng đồng, cán bộ xác nhận roster nhận lỗi chưa cấu hình điểm quy đổi.
9. **Tác động:** Nhánh điểm danh cộng đồng không hoàn tất qua UI/API rubric hiện có.
10. **Gợi ý sửa:** Bổ sung hợp đồng cấu hình rolesScore xuyên form/validator/persist khi nghiệp vụ xác nhận tỷ lệ; không sửa dữ liệu tự động.
11. **Regression test:** Tạo→lưu→ban hành rubric có role rates, đọc lại giữ nguyên và điểm danh tính đúng; thiếu rates hiển thị blocker trước sử dụng.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai. Giá trị quy đổi cần [Q-02](DECISIONS.md#q-02).

<a id="bl-015"></a>

### BL-015 — Thêm tệp vào Evidence APPROVED không đổi version/kết luận

1. **Bug ID:** BL-015. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:347](../apps/backend/src/evidence/evidence.service.ts#L347); [apps/backend/src/evidence/evidence.service.ts:418](../apps/backend/src/evidence/evidence.service.ts#L418).
4. **Workflow:** Sinh viên sửa phiếu RETURNED. [F06](features/06-evidence-and-storage.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại:** addFile chỉ kiểm quyền sửa phiếu và prefix object; không chặn Evidence APPROVED, không tăng version hay invalidate.
6. **Kỳ vọng có căn cứ:** Nội dung được duyệt phải ổn định hoặc thay đổi phải được tái xét; deleteDraftFile đã chặn APPROVED.
7. **Logic và trace qua lớp:** ensureEvidenceEditable kiểm phiếu, không kiểm trạng thái Evidence. RETURNED mở quyền phiếu khiến hồ sơ đã duyệt cũng thêm được quan hệ file.
8. **Tình huống:** Khoa trả phiếu vì tiêu chí khác; sinh viên gọi /files cho Evidence APPROVED với object key hợp lệ.
9. **Tác động:** Mất tính tin cậy kết luận duyệt và lịch sử file.
10. **Gợi ý sửa:** Áp dụng trạng thái edit của Evidence trong transaction; nếu cho sửa phải tăng version, hủy job cũ và invalidate liên quan.
11. **Regression test:** RETURNED tổng nhưng Evidence APPROVED: thêm file bị chặn hoặc chuyển trạng thái đúng cùng audit/version.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-016"></a>

### BL-016 — Bắt đổi mật khẩu lần đầu chỉ có ở frontend

1. **Bug ID:** BL-016. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/auth/jwt.strategy.ts:26](../apps/backend/src/auth/jwt.strategy.ts#L26); [apps/web/src/components/ProtectedRoute.tsx:31](../apps/web/src/components/ProtectedRoute.tsx#L31).
4. **Workflow:** Sử dụng tài khoản có isFirstLogin. [F01](features/01-accounts-and-access.md).
5. **Hiện tại:** ProtectedRoute chuyển /account, nhưng JwtStrategy không hạn chế API khi isFirstLogin=true.
6. **Kỳ vọng có căn cứ:** Nếu quy tắc bắt đổi mật khẩu được áp dụng như UI thể hiện, server phải enforce cùng giới hạn.
7. **Logic và trace qua lớp:** Token đăng nhập lần đầu là token đầy đủ quyền; caller bỏ qua UI vẫn thao tác nghiệp vụ.
8. **Tình huống:** Dùng credential tạm lấy token rồi gọi API nghiệp vụ trước đổi mật khẩu.
9. **Tác động:** Không bảo đảm bước chuyển mật khẩu tạm sang mật khẩu cá nhân.
10. **Gợi ý sửa:** Tách quyền/token lần đầu hoặc guard allowlist login/me/change-password/logout theo quyết định nghiệp vụ.
11. **Regression test:** Token firstLogin gọi API ghi bị chặn, đổi mật khẩu xong gọi được; không chặn endpoint cần cho bước đổi.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-017"></a>

### BL-017 — Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao

1. **Bug ID:** BL-017. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/assessments/assessments.controller.ts:23](../apps/backend/src/assessments/assessments.controller.ts#L23); [apps/backend/src/criteria/rubric-scoring.ts:25](../apps/backend/src/criteria/rubric-scoring.ts#L25).
4. **Workflow:** Xác minh dữ liệu chính thức. [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại:** VerificationDto chỉ IsObject; count Math.max(0,Number(value)||0) nhận 'abc'/số âm thành 0.
6. **Kỳ vọng có căn cứ:** Dữ liệu số lượng vi phạm phải hữu hạn, không âm và đúng kiểu trước tính điểm.
7. **Logic và trace qua lớp:** Kiểm tra requiredData chỉ hiện diện, không xác nhận kiểu/miền. Giá trị rác được diễn giải như không có vi phạm.
8. **Tình huống:** Gửi examBans='abc', classWarnings=-1 cho tiêu chí1, kết quả như 0/0 và có thể đạt6.
9. **Tác động:** Sai gợi ý/điểm, che lỗi nhập liệu.
10. **Gợi ý sửa:** Validator dữ liệu theo scoring kind, trả lỗi trường thay vì coercion im lặng.
11. **Regression test:** Chuỗi rác, âm, fractional khi cần integer, Infinity/boolean phải bị từ chối; 0 hợp lệ vẫn tính đúng.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-018"></a>

### BL-018 — Yêu cầu sửa thông tin mất meta và không có phân trang UI

1. **Bug ID:** BL-018. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/lib/apiClient.ts:182](../apps/web/src/lib/apiClient.ts#L182); [apps/web/src/pages/admin/ProfileDataIssues.tsx:19](../apps/web/src/pages/admin/ProfileDataIssues.tsx#L19); [apps/backend/src/profile-data-issues/profile-data-issues.service.ts:24](../apps/backend/src/profile-data-issues/profile-data-issues.service.ts#L24).
4. **Workflow:** Admin xử lý profile data issues. [F01](features/01-accounts-and-access.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** Client lấy chỉ body.data, bỏ meta rồi spread array thành object; màn có page query nhưng không có pager.
6. **Kỳ vọng có căn cứ:** Admin phải thấy toàn bộ tập yêu cầu phân trang và đúng tổng.
7. **Logic và trace qua lớp:** Interceptor chuyển {items,total,...} sang data[]+meta; client kỳ vọng object nằm trong data; UI không có điều hướng trang.
8. **Tình huống:** Có26 OPEN issues với pageSize25, người dùng không thấy dòng còn lại từ màn hiện tại.
9. **Tác động:** Yêu cầu bị bỏ sót và tổng hiển thị không đáng tin.
10. **Gợi ý sửa:** Chuẩn hóa parser đọc envelope.meta và thêm pager giữ status.
11. **Regression test:** Fixture26 hoặc 51 issues qua double HTTP, kiểm total/pageSize, chuyển trang và xử lý item cuối.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-019"></a>

### BL-019 — Danh sách minh chứng chỉ tải trang đầu rồi lọc cục bộ

1. **Bug ID:** BL-019. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/pages/student/EvidenceList.tsx:20](../apps/web/src/pages/student/EvidenceList.tsx#L20); [apps/backend/src/evidence/evidence.service.ts:25](../apps/backend/src/evidence/evidence.service.ts#L25).
4. **Workflow:** Sinh viên tìm minh chứng. [F06](features/06-evidence-and-storage.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** Web gọi getEvidences không page, giữ array trang đầu mặc định20 và lọc trên mảng đó.
6. **Kỳ vọng có căn cứ:** Danh sách/tìm kiếm phải truy cập được hồ sơ ngoài trang đầu API đã phân trang.
7. **Logic và trace qua lớp:** Metadata bị bỏ và UI thiếu pager/backend search theo bộ lọc; kết quả rỗng có thể chỉ là không thuộc20 dòng đầu.
8. **Tình huống:** Sinh viên có 21 minh chứng, tìm tên hồ sơ cũ nhất.
9. **Tác động:** Không tìm/theo dõi/bổ sung được hồ sơ từ danh sách.
10. **Gợi ý sửa:** Dùng API page và filter, giữ meta hoặc tải đủ có kiểm soát nếu tập nhỏ.
11. **Regression test:** 21+ minh chứng, hồ sơ mục tiêu ở trang 2; tìm/đổi trạng thái và mở chi tiết vẫn truy cập được.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-020"></a>

### BL-020 — Chọn gia hạn chỉ có 100 sinh viên và lệch roster kỳ

1. **Bug ID:** BL-020. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/components/admin/DeadlineExtensionsDialog.tsx:17](../apps/web/src/components/admin/DeadlineExtensionsDialog.tsx#L17); [apps/backend/src/users/users.service.ts:29](../apps/backend/src/users/users.service.ts#L29).
4. **Workflow:** Admin gia hạn cá nhân. [F03](features/03-terms-and-deadlines.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** Dialog tải page1,size100 không search/pager; users với ADMIN không bắt buộc membership chỉ vì có termId.
6. **Kỳ vọng có căn cứ:** Đối tượng thuộc kỳ phải chọn được đầy đủ và không đưa đối tượng không hợp lệ vào picker.
7. **Logic và trace qua lớp:** termId chủ yếu đổi projection class/nhánh STAFF; đầu vào ADMIN không được giới hạn roster kỳ và dialog cắt trang.
8. **Tình huống:** Kỳ có 101 sinh viên; người cần gia hạn ngoài100 hoặc sinh viên mới chưa thuộc kỳ lại xuất hiện.
9. **Tác động:** Không gia hạn được đúng người hoặc gửi yêu cầu chắc chắn bị service từ chối.
10. **Gợi ý sửa:** Endpoint/picker roster-scoped, tìm kiếm phân trang và giữ snapshot lớp.
11. **Regression test:** 101+ roster và user ngoài kỳ; tìm được người cuối và không chọn user ngoài roster.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-021"></a>

### BL-021 — Loại trừ lần hai trùng dedupeKey và rollback

1. **Bug ID:** BL-021. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evaluation-workflow/workflow.service.ts:306](../apps/backend/src/evaluation-workflow/workflow.service.ts#L306); [apps/backend/src/evaluation-workflow/workflow.service.ts:319](../apps/backend/src/evaluation-workflow/workflow.service.ts#L319).
4. **Workflow:** Exclude → restore → exclude. [F09](features/09-faculty-handoff.md), [F13](features/13-notifications.md).
5. **Hiện tại:** Exclude tạo Notification key excluded:handoffId:revision; restore không tăng revision/xóa notification.
6. **Kỳ vọng có căn cứ:** Khôi phục rồi loại trừ vì lý do mới phải là sự kiện hợp lệ, giữ cả lịch sử.
7. **Logic và trace qua lớp:** revision không thay ở cả hai thao tác; unique dedupeKey tái sử dụng trong transaction. Lần sau tạo Notification có thể P2002 và rollback cả thay đổi trạng thái.
8. **Tình huống:** Admin loại trừ A, khôi phục A, rồi loại trừ A lần hai trước gửi revision mới.
9. **Tác động:** Không thực hiện được thao tác quản trị lặp hợp lệ.
10. **Gợi ý sửa:** Phân biệt event occurrence bằng eventId/sequence hoặc idempotency theo request, không theo revision bàn giao đơn thuần.
11. **Regression test:** Chạy chuỗi exclude/restore/exclude trong DB test cách ly; hai sự kiện tồn tại, trạng thái cuối EXCLUDED.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-022"></a>

### BL-022 — Thêm nguồn xác minh hủy job nhưng Evidence còn PROCESSING

1. **Bug ID:** BL-022. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/reviews/reviews.service.ts:269](../apps/backend/src/reviews/reviews.service.ts#L269); [apps/backend/src/evidence/evidence-processing.worker.ts:146](../apps/backend/src/evidence/evidence-processing.worker.ts#L146).
4. **Workflow:** Cán bộ thêm nguồn khi AI đang xử lý. [F07](features/07-evidence-review-and-verification.md), [F14](features/14-audit-monitoring-and-ai-jobs.md).
5. **Hiện tại:** addSource tăng version, CANCELLED job nhưng không đổi Evidence.status.
6. **Kỳ vọng có căn cứ:** Khi hủy xử lý AI để chuyển sang xét thủ công, trạng thái hồ sơ phải phản ánh việc không còn job chạy.
7. **Logic và trace qua lớp:** acceptResult chặn kết quả cũ đúng version nhưng không còn nhánh đưa PROCESSING sang NEEDS_HUMAN_REVIEW cho lần hủy này.
8. **Tình huống:** Evidence PROCESSING, cán bộ thêm VerificationSource; job bị hủy, evidence giữ PROCESSING.
9. **Tác động:** Giao diện báo đang xử lý AI kéo dài và gây hiểu sai queue.
10. **Gợi ý sửa:** Chuyển trạng thái đồng bộ khi cancellation do cán bộ, giữ reason/audit và không nhận response muộn.
11. **Regression test:** PROCESSING + job active, addSource→job CANCELLED và trạng thái xét thủ công; response cũ không đổi lại.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-023"></a>

### BL-023 — Màn bổ sung hiển thị deadline/nội dung giả

1. **Bug ID:** BL-023. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/pages/student/SupplementEvidence.tsx:130](../apps/web/src/pages/student/SupplementEvidence.tsx#L130); [apps/backend/src/reviews/reviews.service.ts:210](../apps/backend/src/reviews/reviews.service.ts#L210).
4. **Workflow:** Sinh viên đáp ứng SupplementRequest. [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại:** Hạn cứng25/10/2026(Còn3ngày), nội dung đọc reviews[0].reason rồi fallback văn bản mẫu.
6. **Kỳ vọng có căn cứ:** UI hiển thị SupplementRequest.missingItem/deadline thực và trạng thái không đặt hạn.
7. **Logic và trace qua lớp:** Backend lưu missingItem/deadline; màn không dùng chúng làm nguồn, có thể hiện yêu cầu không tồn tại.
8. **Tình huống:** Cán bộ yêu cầu giấy xác nhận trong tháng11, sinh viên thấy yêu cầu ảnh mờ và hạn25/10.
9. **Tác động:** Bổ sung sai tài liệu hoặc trễ hạn thật.
10. **Gợi ý sửa:** Đọc yêu cầu còn mở mới nhất, định dạng hạn thật; bỏ nội dung fallback giả.
11. **Regression test:** Yêu cầu có comment khác missingItem, deadline khác mẫu và deadline=null; UI phản ánh đúng cả3.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-024"></a>

### BL-024 — Sinh viên mở URL kỳ khác nhưng đọc activeTerm

1. **Bug ID:** BL-024. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/pages/student/ScoreReport.tsx:21](../apps/web/src/pages/student/ScoreReport.tsx#L21); [apps/web/src/layouts/AppLayout.tsx:511](../apps/web/src/layouts/AppLayout.tsx#L511).
4. **Workflow:** Đổi kỳ / mở deep link bảng điểm. [F05](features/05-student-assessment.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** ScoreReport lấy activeTerm từ context; termId URL không được đọc tại màn; selector mobile không đồng bộ đủ ngữ cảnh URL.
6. **Kỳ vọng có căn cứ:** URL chứa kỳ phải khớp dữ liệu hiển thị, như navigation theo kỳ hiện có.
7. **Logic và trace qua lớp:** Nguồn chọn kỳ giữa context và query không thống nhất; link kỳ lịch sử có thể hiển thị kỳ đang active.
8. **Tình huống:** Mở /student/scores?termId=old khi context ở new hoặc đổi kỳ trên mobile rồi reload.
9. **Tác động:** Xem/nhập dữ liệu nhầm kỳ; quyết định dựa sai deadline/kết quả.
10. **Gợi ý sửa:** Dùng một nguồn selectedTerm đã validate và đồng bộ URL/context, hủy response cũ.
11. **Regression test:** Deep link kỳ cũ, Back/Forward, reload, selector mobile390px; title/API/payload đều cùng kỳ.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-025"></a>

### BL-025 — API tạo tài khoản bỏ qua ràng buộc vai trò mà UI bắt buộc

1. **Bug ID:** BL-025. **Trạng thái:** Open. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/dto/user.dto.ts:21](../apps/backend/src/users/dto/user.dto.ts#L21); [apps/backend/src/users/users.service.ts:157](../apps/backend/src/users/users.service.ts#L157); [apps/web/src/pages/admin/UserManagement.tsx:373](../apps/web/src/pages/admin/UserManagement.tsx#L373).
4. **Workflow:** Tạo sinh viên/cán bộ. [F01](features/01-accounts-and-access.md).
5. **Hiện tại:** studentCode/classId/facultyId optional trong DTO và create không kiểm theo role.
6. **Kỳ vọng có căn cứ:** Theo form hiện hành STUDENT cần MSSV/lớp, STAFF cần Khoa; API cần enforce cùng quy tắc hoặc quyết định chính sách khác rõ ràng.
7. **Logic và trace qua lớp:** DB cho nullable, nên gọi trực tiếp API tạo được tài khoản thiếu điều kiện workflow; activation roster loại sinh viên không có lớp.
8. **Tình huống:** Admin API tạo STUDENT không classId/MSSV; tài khoản tồn tại nhưng không vào roster.
9. **Tác động:** Dữ liệu quản trị không nhất quán và tài khoản không làm nghiệp vụ được.
10. **Gợi ý sửa:** Validator theo role và quan hệ tồn tại, thống nhất form/import/update; làm rõ trường hợp ngoại lệ trước backfill.
11. **Regression test:** Create STUDENT thiếu mã/lớp, STAFF thiếu Khoa bị từ chối; bản hợp lệ được nhận.

**Giới hạn bằng chứng:** Đối chiếu caller, service và hợp đồng liên quan trong nguồn. Không khẳng định đã tái hiện trên DB/Storage/AI triển khai.

<a id="bl-026"></a>

### BL-026 — Xóa minh chứng/tệp có khoảng đua với nộp phiếu

1. **Bug ID:** BL-026. **Trạng thái:** Open. **Độ chắc chắn:** Potential; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:429](../apps/backend/src/evidence/evidence.service.ts#L429); [apps/backend/src/evidence/evidence.service.ts:451](../apps/backend/src/evidence/evidence.service.ts#L451); [apps/backend/src/assessments/assessments.service.ts:188](../apps/backend/src/assessments/assessments.service.ts#L188).
4. **Workflow:** Hai request xóa và nộp đồng thời. [F06](features/06-evidence-and-storage.md).
5. **Hiện tại:** ensureEvidenceEditable có transaction riêng kết thúc trước Storage delete/Prisma delete; deleteEvidence dựa snapshot DRAFT đọc trước.
6. **Kỳ vọng có căn cứ:** Sau SUBMITTED không được xóa dữ liệu vừa nộp; kiểm tra và thay đổi phải tuần tự theo cùng khóa.
7. **Logic và trace qua lớp:** Term lock bảo vệ nộp nhưng không bao trùm phần xóa; request xóa đã vượt precheck có thể chạy tiếp sau khi nộp. Kết quả DB cuối phụ thuộc FK/cascade/thứ tự query.
8. **Tình huống:** TabA bắt đầu xóa nháp rồi dừng sau precheck; tabB nộp phiếu; tabA tiếp tục xóa file/quan hệ.
9. **Tác động:** Có thể mất tệp/hồ sơ đã nộp hoặc lỗi và trạng thái dở dang.
10. **Gợi ý sửa:** Đặt kiểm tra hiện trạng và ghi DB trong cùng transaction khóa Term; thiết kế cleanup Storage sau commit có thể retry.
11. **Regression test:** Barrier integration test hai kết nối DB cách ly, xen kẽ precheck→submit→delete; nộp thành công phải giữ tệp hoặc xóa buộc nộp bị chặn.

**Giới hạn bằng chứng:** Mô hình xen kẽ cho thấy cửa sổ đua; chưa chạy hai kết nối DB hay xác nhận FK/deployment.

<a id="bl-027"></a>

### BL-027 — Preflight nộp phiếu nằm ngoài transaction khóa

1. **Bug ID:** BL-027. **Trạng thái:** Open. **Độ chắc chắn:** Potential; **ưu tiên:** P1.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/assessments/assessments.service.ts:179](../apps/backend/src/assessments/assessments.service.ts#L179); [apps/backend/src/assessments/assessments.service.ts:188](../apps/backend/src/assessments/assessments.service.ts#L188).
4. **Workflow:** Hai tab lưu điểm và nộp đồng thời. [F05](features/05-student-assessment.md).
5. **Hiện tại:** Kiểm đủ điểm preflight trước transaction; bên trong chỉ kiểm lại tệp nháp, không kiểm lại đầy đủ điểm.
6. **Kỳ vọng có căn cứ:** Phiếu SUBMITTED phải thỏa điều kiện preflight trên dữ liệu được commit.
7. **Logic và trace qua lớp:** Một request lưu null điểm có thể commit giữa preflight và acquire Term lock của nộp; nộp dùng kết quả kiểm cũ.
8. **Tình huống:** TabA preflight đủ; tabB xóa một điểm tự đánh giá; tabA lấy lock rồi nộp.
9. **Tác động:** Có thể nộp phiếu thiếu dữ liệu dù preflight báo đủ trước đó.
10. **Gợi ý sửa:** Tái kiểm đầy đủ điều kiện nộp trong transaction đã khóa, dùng cùng rubric/dữ liệu current.
11. **Regression test:** Dùng barrier cho save-null trước khi submit lấy lock; submit phải trả blocker, không SUBMITTED.

**Giới hạn bằng chứng:** Mô hình xen kẽ cho thấy cửa sổ đua; chưa chạy hai kết nối DB hay xác nhận FK/deployment.

## Độ bao phủ và giới hạn kiểm chứng

Đã đối chiếu Web routes/callers, 16 controller, service/policy, guard/DTO, schema 34 model, 12 migration và các test liên quan; xem phân loại implementation/scaffold trong [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md). Các số là inventory nguồn tại baseline, không khẳng định hạ tầng đã triển khai giống schema.

Kết quả được ghi nhận từ đợt audit trước trong cuộc trao đổi: 15 test worker và 6 test faculty analytics đạt; 23 ca tái hiện có chọn lọc bằng in-memory doubles, trong đó 2 ca mô hình hóa khoảng đua. Harness tái hiện không được lưu thành regression test trong repository. Không coi chúng là bằng chứng DB concurrency/Storage/pipeline. Đợt tài liệu này không chạy lại ứng dụng hoặc integration fixture.

Chưa chạy DB integration/browser, chưa kiểm tra deployed migrations, bucket policy, object lifecycle, pipeline thật hoặc hiệu năng production. Test integration hiện có thao tác tạo/xóa fixture; một fixture Activity cần đối chiếu startDate bắt buộc trước khi dùng. Không start backend vì worker polling có thể ghi DB/gọi AI.

Không ghi nhận tính năng mobile/AI scaffold hay proposal SSO/RAG/OCR như defect nếu chưa có yêu cầu triển khai được xác nhận. Các lỗ hổng chính sách và tài liệu thiếu nằm riêng ở [DECISIONS](DECISIONS.md).

## Cần con người làm rõ

[Q-01 đến Q-09](DECISIONS.md) bao gồm hợp nhất hoạt động, tỷ lệ quy đổi, hạn hiệu lực, roster mới/chuyển đơn vị, loại trừ, phúc khảo lặp, tài liệu bàn giao thiếu và quyền điểm danh của Admin. Không tự đổi các chính sách này để đóng audit.

