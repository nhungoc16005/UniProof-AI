# Audit logic nghiệp vụ EduPoint

Ngày lập tài liệu: 2026-11-15. Cập nhật: 2026-11-16. Baseline nguồn: `93fb66c`. Ghi nhận kết quả audit mã nguồn và tiến độ xử lý theo từng đợt; đợt 1 đã hoàn thành xử lý 3 mục P0 (BL-001, BL-002, BL-009); đợt 2 đã giải quyết BL-007 và hoàn thiện kiểm chứng kịch bản BL-026; đợt 3 đã giải quyết BL-006, BL-010 và BL-020; đợt 4 đã giải quyết BL-003, BL-004 và BL-017; đợt 5 đã giải quyết BL-013, BL-015, BL-023, BL-024; đợt 7 đã giải quyết BL-011, BL-012, BL-016, BL-025; đợt 8 đã giải quyết BL-005, BL-014; đợt 9 đã giải quyết BL-018, BL-019; đợt 10 đã giải quyết BL-021. Đọc [kiến trúc và workflow](PROJECT_OVERVIEW.md), [quy tắc](BUSINESS_RULES.md) trước các finding.

## Phạm vi và cách phân loại

- **Confirmed:** luồng mã nguồn đủ chứng minh mâu thuẫn/hành vi; không đồng nghĩa đã tái hiện trên deployment.
- **Potential:** thứ tự xen kẽ/concurrency có thể gây lỗi, cần kiểm tra DB thực cách ly.
- Severity đánh giá tác động; priority đánh giá thứ tự xử lý. P0 kiểm chứng/xử lý trước bàn giao, P1 tiếp theo, P2 theo sprint được chọn.
- Tại mốc audit gốc có 27 mục: **23 mục Resolved**, **4 mục chưa đóng** gồm **2 mục hoãn xử lý AI** theo quyết định người dùng (BL-008, BL-022 - xem DEC-007) và **2 mục Potential** chờ kiểm chứng DB đa kết nối (BL-026, BL-027). Không có Critical.
- Expected chỉ dựa vào luồng/quy tắc hiện có; các quyết định kỹ thuật đã chốt tại DEC-001 đến DEC-010.

## Danh sách ưu tiên

| ID | Mức độ | Độ chắc chắn | Ưu tiên | Vấn đề |
|---|---|---|---|---|
| [BL-001](#bl-001) | High | Confirmed | P0 | Bỏ termId vượt ranh giới Khoa lịch sử (Resolved) |
| [BL-002](#bl-002) | High | Confirmed | P0 | Response duyệt minh chứng chứa password hash cán bộ (Resolved) |
| [BL-006](#bl-006) | High | Confirmed | P0 | Chốt kỳ bỏ qua gia hạn phúc khảo còn hiệu lực (Resolved) |
| [BL-007](#bl-007) | High | Confirmed | P0 | Lỗi ký URL xóa tệp đã commit vào DB (Resolved) |
| [BL-009](#bl-009) | High | Confirmed | P0 | JWT secret được đọc trước khi ConfigModule nạp .env (Resolved) |
| [BL-026](#bl-026) | High | Confirmed | P0 | Xóa minh chứng/tệp và nộp phiếu đã được kiểm chứng tuần tự trên PostgreSQL 17 (Done) |
| [BL-003](#bl-003) | High | Confirmed | P1 | Tiêu chí nhóm mặc định thiếu baseScore (Resolved) |
| [BL-004](#bl-004) | High | Confirmed | P1 | leadershipRole gửi chuỗi làm điểm chức vụ bằng 0 (Resolved) |
| [BL-005](#bl-005) | High | Confirmed | P1 | Xác minh minh chứng ghi đè số hoạt động từ điểm danh (Resolved) |
| [BL-008](#bl-008) | High | Confirmed | P1 | Timeout AI dừng trước lúc đọc response body (Hoãn AI - DEC-007) |
| [BL-027](#bl-027) | Medium | Confirmed | P1 | Kiểm lại điều kiện nộp phiếu dưới khóa Term (Done) |
| [BL-010](#bl-010) | Medium | Confirmed | P2 | Web khóa sửa theo hạn gốc dù đã gia hạn (Resolved) |
| [BL-011](#bl-011) | Medium | Confirmed | P2 | Mật khẩu tạm không được bàn giao đầy đủ (Resolved) |
| [BL-012](#bl-012) | Medium | Confirmed | P2 | Thiếu classId/facultyId scalar làm bộ lọc tài khoản sai (Resolved) |
| [BL-013](#bl-013) | Medium | Confirmed | P2 | Nháp minh chứng không hiện dưới đúng tiêu chí (Resolved) |
| [BL-014](#bl-014) | Medium | Confirmed | P2 | Rubric không lưu rolesScore cần cho điểm danh cộng đồng (Resolved) |
| [BL-015](#bl-015) | Medium | Confirmed | P2 | Thêm tệp vào Evidence APPROVED không đổi version/kết luận (Resolved) |
| [BL-016](#bl-016) | Medium | Confirmed | P2 | Bắt đổi mật khẩu lần đầu chỉ có ở frontend (Resolved) |
| [BL-017](#bl-017) | Medium | Confirmed | P2 | Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao (Resolved) |
| [BL-018](#bl-018) | Medium | Confirmed | P2 | Yêu cầu sửa thông tin mất meta và không có phân trang UI (Resolved) |
| [BL-019](#bl-019) | Medium | Confirmed | P2 | Danh sách minh chứng chỉ tải trang đầu rồi lọc cục bộ (Resolved) |
| [BL-020](#bl-020) | Medium | Confirmed | P2 | Chọn gia hạn chỉ có 100 sinh viên và lệch roster kỳ (Resolved) |
| [BL-021](#bl-021) | Medium | Confirmed | P2 | Loại trừ lần hai trùng dedupeKey và rollback (Resolved) |
| [BL-022](#bl-022) | Medium | Confirmed | P2 | Thêm nguồn xác minh hủy job nhưng Evidence còn PROCESSING (Hoãn AI - DEC-007) |
| [BL-023](#bl-023) | Medium | Confirmed | P2 | Màn bổ sung hiển thị deadline/nội dung giả (Resolved) |
| [BL-024](#bl-024) | Medium | Confirmed | P2 | Sinh viên mở URL kỳ khác nhưng đọc activeTerm (Resolved) |
| [BL-025](#bl-025) | Medium | Confirmed | P2 | API tạo tài khoản bỏ qua ràng buộc vai trò mà UI bắt buộc (Resolved) |

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

1. **Bug ID:** BL-003. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/criteria/dut-rubric.ts:11](../apps/backend/src/criteria/dut-rubric.ts#L11); [apps/backend/src/criteria/rubric-scoring.ts:41](../apps/backend/src/criteria/rubric-scoring.ts#L41); [apps/backend/src/criteria/criteria.service.ts:18](../apps/backend/src/criteria/criteria.service.ts#L18).
4. **Workflow:** Tính điểm tiêu chí 2. [F04](features/04-rubrics-and-scoring.md).
5. **Hiện tại (đã sửa):** Tiêu chí 2 trong `DUT_RUBRIC_CRITERIA` đã được bổ sung `baseScore: 3`. `validateScoringConfig` trong `criteria.service.ts` chặn lưu/ban hành rubric thiếu baseScore hoặc sai số. `rubric-scoring.ts` trả `NEEDS_VERIFICATION` rõ ràng nếu config thiếu baseScore trong DB cũ (không fallback tùy tiện, không crash, không sinh NaN).
6. **Kỳ vọng có căn cứ:** Mô tả tiêu chí cho trần 3 điểm, trừ theo lần vắng và mất hết khi trễ việc; trường hợp không vi phạm phải có điểm nền hợp lệ.
7. **Logic và trace qua lớp:** Đã bổ sung baseScore: 3 vào config chuẩn; evaluator kiểm tra tính hợp lệ của baseScore trước khi tính điểm; validator chặn từ cấp DTO/Service.
8. **Tình huống:** Nhập ba bộ đếm bằng 0 cho tiêu chí 2 của rubric mặc định -> đạt 3 điểm.
9. **Tác động:** Điểm được tính chính xác, không còn sinh NaN hay kẹt trạng thái.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `dut-rubric.ts`, `rubric-scoring.ts`, `criteria.service.ts`. Đã kiểm chứng 10 tests trong `apps/backend/test/scoring-and-validation.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory và double test; code đã sửa, dữ liệu rubric lịch sử đã lưu trong DB chưa được rà soát/chạy script kiểm kê DB.

<a id="bl-004"></a>

### BL-004 — leadershipRole gửi chuỗi làm điểm chức vụ bằng 0

1. **Bug ID:** BL-004. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/web/src/pages/officer/StudentAssessment.tsx:29](../apps/web/src/pages/officer/StudentAssessment.tsx#L29); [apps/web/src/pages/officer/StudentAssessment.tsx:115](../apps/web/src/pages/officer/StudentAssessment.tsx#L115); [apps/backend/src/criteria/rubric-scoring.ts:29](../apps/backend/src/criteria/rubric-scoring.ts#L29); [apps/backend/src/assessments/assessments.service.ts:9](../apps/backend/src/assessments/assessments.service.ts#L9).
4. **Workflow:** Xác minh tiêu chí 14/16. [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại (đã sửa):** Frontend `StudentAssessment.tsx` đã thêm `leadershipRole` vào `booleanFields` và `fieldLabels`, `toVerifiedData` sinh boolean `true`/`false` thực sự. Backend `validateVerifiedData` yêu cầu các trường boolean phải có kiểu `typeof === 'boolean'`, từ chối chuỗi `"true"`, `"false"` với HTTP 400. Evaluator kiểm tra đúng `leadershipRole === true`, `collectiveApprovalPercent > 90` và `advisorConfirmation === true` gợi ý 4 điểm cho tiêu chí 14, 3 điểm cho tiêu chí 16.
6. **Kỳ vọng có căn cứ:** leadershipRole phải boolean như evaluator yêu cầu để điều kiện chức vụ được xét đúng.
7. **Logic và trace qua lớp:** Giao diện gửi đúng boolean; backend validate kiểu boolean; evaluator so sánh `=== true` và tính đúng điểm.
8. **Tình huống:** Cán bộ chọn có chức vụ, bình chọn 95%, xác nhận cố vấn -> tiêu chí 14 gợi ý 4 điểm; tiêu chí 16 gợi ý 3 điểm.
9. **Tác động:** Điểm chức vụ của sinh viên được bảo vệ đúng quy chế.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `StudentAssessment.tsx`, `assessments.service.ts`, `rubric-scoring.ts`. Đã kiểm chứng 9 tests trong `apps/backend/test/scoring-and-validation.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory và double test; chưa chạy browser test với backend thật.

<a id="bl-005"></a>

### BL-005 — Xác minh minh chứng ghi đè số hoạt động từ điểm danh

1. **Bug ID:** BL-005. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/activities/activity-aggregator.ts](../apps/backend/src/activities/activity-aggregator.ts); [apps/backend/src/activities/activities.service.ts:41](../apps/backend/src/activities/activities.service.ts#L41); [apps/backend/src/assessments/assessments.service.ts:321](../apps/backend/src/assessments/assessments.service.ts#L321); [apps/backend/src/reviews/reviews.service.ts:168](../apps/backend/src/reviews/reviews.service.ts#L168).
4. **Workflow:** Điểm danh → xác minh tiêu chí hoạt động. [F07](features/07-evidence-review-and-verification.md), [F08](features/08-activities-and-attendance.md).
5. **Hiện tại (đã sửa):** Xây dựng bộ tổng hợp nguồn hoạt động chung `aggregateStudentActivitySources`. Trong cùng sinh viên/kỳ/tiêu chí:
   - Gộp nguồn theo khóa duy nhất `activity:<id>` (nếu có `activityId`) và `evidence:<id>` (minh chứng độc lập không gắn hoạt động). Cùng hoạt động có cả điểm danh `CONFIRMED` và minh chứng `APPROVED` chỉ được tính một lần.
   - Ưu tiên vai trò từ điểm danh `CONFIRMED`.
   - Nếu không có điểm danh và có nhiều minh chứng `APPROVED` mâu thuẫn vai trò, hoặc còn minh chứng đang chờ xử lý (`hasUnresolvedEvidence`), trả blocker `NEEDS_VERIFICATION, suggestedScore: null`.
   - `recomputeAndSaveActivityCriterion` tự động vô hiệu hóa điểm chính thức cũ (`officialScore = null, finalizedAt = null`) khi căn cứ hoạt động thay đổi.
6. **Kỳ vọng có căn cứ:** Dữ liệu đã xác nhận không tự mất chỉ vì đổi màn xác minh; nguồn hoạt động được thống nhất và truy vết minh bạch theo DEC-008.
7. **Logic và trace qua lớp:** Cả `ActivitiesService`, `AssessmentsService` và `ReviewsService` đều gọi chung `recomputeActivityCriterion` sử dụng aggregator chung.
8. **Tình huống:** Hoạt động đã CONFIRMED cho sinh viên có gợi ý 5; khi cán bộ duyệt thêm minh chứng hoặc xác minh dữ liệu, điểm danh không bị xóa hoặc ghi đè thành 0.
9. **Tác động:** Bảo vệ toàn vẹn dữ liệu điểm danh và minh chứng hoạt động, nhất quán điểm rèn luyện.
10. **Bằng chứng giải quyết:** Đã tạo mới `activity-aggregator.ts` và tích hợp vào 3 services. Đã kiểm chứng 6 tests trong `apps/backend/test/activity-and-roles-scoring.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng trên DB staging vật lý.

<a id="bl-006"></a>

### BL-006 — Chốt kỳ bỏ qua gia hạn phúc khảo còn hiệu lực

1. **Bug ID:** BL-006. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evaluation-workflow/workflow.service.ts:181](../apps/backend/src/evaluation-workflow/workflow.service.ts#L181); [apps/backend/src/evaluation-workflow/workflow.service.ts:401](../apps/backend/src/evaluation-workflow/workflow.service.ts#L401); [apps/backend/src/deadline-extensions/deadline-extensions.service.ts:18](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts#L18).
4. **Workflow:** Gia hạn → phúc khảo → chốt kỳ. [F03](features/03-terms-and-deadlines.md), [F10](features/10-publication-and-term-closure.md), [F11](features/11-appeals-and-corrections.md).
5. **Hiện tại:** conditions chỉ so thời gian với term.appealDeadline, trong khi tạo appeal dùng hạn resolve theo sinh viên/lớp.
6. **Kỳ vọng có căn cứ:** Quyền phúc khảo theo gia hạn còn hiệu lực phải được tôn trọng trước khi khóa kỳ.
7. **Logic và trace qua lớp:** Một endpoint cho gửi theo hạn hiệu lực, endpoint chốt lại chỉ dùng hạn gốc; CLOSED sau chốt chặn quyền đang được gia hạn.
8. **Tình huống:** Hạn gốc 10/11, gia hạn sinh viên đến 20/11, ngày 15/11 chưa có đơn PENDING và mọi phiếu đã công bố: canClose có thể true.
9. **Tác động:** Kết thúc sớm quyền phúc khảo đã cấp.
10. **Gợi ý sửa:** Kiểm tra tất cả cửa sổ APPEAL đang hiệu lực trong conditions và transaction close; xác nhận thêm chính sách Q-03.
11. **Regression test:** Hạn gốc hết nhưng gia hạn cá nhân/lớp chưa hết→không chốt; thu hồi/hết toàn bộ hạn→đánh giá lại blockers.
12. **Bằng chứng đã xử lý:** Đã bổ sung hàm `checkAppealDeadlineBlockers` trong `WorkflowService` duyệt toàn bộ danh sách `AssessmentHandoff` của kỳ, tính hạn phúc khảo hiệu lực theo thứ tự ưu tiên cá nhân → lớp → hạn chung (mỗi cấp chọn bản ghi chưa thu hồi mới nhất theo `createdAt: desc, id: desc`). Cả `conditions` và `close` đều kiểm tra hạn hiệu lực; tại đúng thời điểm biên `now === deadline` vẫn chặn (`now <= deadline`); `close` kiểm tra lại bằng client transaction `tx` sau khi khóa Term. Đã kiểm chứng đạt 12/12 ca trong [deadline-and-closure.test.cjs](../apps/backend/test/deadline-and-closure.test.cjs) gồm ca biên, ưu tiên ghi đè cá nhân/lớp, đối chứng đỏ/xanh, 1 ca concurrency lock revoke đồng thời đọc lại sau khóa, và 2 ca concurrency lock barrier mô phỏng tranh chấp 2 chiều giữa chốt kỳ và gia hạn.

**Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory mô phỏng khóa hàng (SELECT FOR UPDATE) và transaction; chưa kiểm chứng trên DB đa kết nối concurrency PostgreSQL vật lý thật.

<a id="bl-007"></a>

### BL-007 — Lỗi ký URL xóa tệp đã commit vào DB

1. **Bug ID:** BL-007. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P0.
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
12. **Bằng chứng đã xử lý:** Đã tách riêng 3 bước upload Storage, commit DB qua transaction khóa Term `workflow.studentEdit`, và ký URL qua `getFileUrl`. Nếu ký URL thất bại, trả về tệp đã lưu kèm `signedUrlAvailable: false` và thông báo hướng dẫn, tuyệt đối không xóa Storage; `withSignedFiles` bọc try/catch an toàn; nếu commit DB thất bại chỉ dọn tệp khi DB thực sự chưa có bản ghi. Kiểm chứng đạt 6/6 ca trong [apps/backend/test/data-protection.test.cjs](../apps/backend/test/data-protection.test.cjs) gồm đối chứng đỏ/xanh (code cũ xóa tệp, code mới giữ nguyên tệp).

**Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory mock Storage; chưa kiểm chứng trên Supabase Storage production.

<a id="bl-008"></a>

### BL-008 — Timeout AI dừng trước lúc đọc response body

1. **Bug ID:** BL-008. **Trạng thái:** Deferred (Hoãn theo quyết định người dùng - DEC-007). **Độ chắc chắn:** Confirmed; **ưu tiên:** P1.
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

1. **Bug ID:** BL-010. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/hooks/useStudentAssessmentAccess.ts:50](../apps/web/src/hooks/useStudentAssessmentAccess.ts#L50); [apps/web/src/types/index.ts:168](../apps/web/src/types/index.ts#L168).
4. **Workflow:** Sinh viên sửa/nộp trong gia hạn. [F03](features/03-terms-and-deadlines.md), [F05](features/05-student-assessment.md).
5. **Hiện tại:** Hook tự tính deadlinePassed từ term.submissionDeadline/reviewDeadline và AND với permissions.canEdit.
6. **Kỳ vọng có căn cứ:** UI phải dùng hạn hiệu lực/permissions server đã trả.
7. **Logic và trace qua lớp:** Server tính quyền bằng DeadlineExtensionsService; frontend thêm điều kiện hạn gốc làm phủ định quyền đúng.
8. **Tình huống:** Sinh viên có gia hạn sau hạn gốc, API cho canEdit=true nhưng UI khóa.
9. **Tác động:** Không thể dùng quyền gia hạn qua giao diện.
10. **Gợi ý sửa:** Trả/đọc effectiveDeadline và nguồn hạn thống nhất; tránh tự áp hạn gốc.
11. **Regression test:** Mock permission=true với hạn gốc đã qua, effectiveDeadline tương lai: form cho phép và hiển thị hạn mới.
12. **Bằng chứng đã xử lý:** Đã sửa hook `useStudentAssessmentAccess`: đọc `effectiveDeadlines` từ `permissions` do server trả về, gán `editDeadline` theo hạn gia hạn hiệu lực tương ứng với trạng thái phiếu; tính `deadlinePassed` theo `editDeadline`; không dùng hạn gốc để AND phủ định quyền của backend (`canEdit` tôn trọng `permissions.canEdit && !deadlinePassed`). Đã kiểm chứng đạt 4/4 ca trong [apps/web/scripts/deadline-dialog-and-access.test.cjs](../apps/web/scripts/deadline-dialog-and-access.test.cjs) chạy trực tiếp hook thật: mock đúng `getMyAssessments`, kiểm tra hạn gia hạn tương lai, phiếu RETURNED, kiểm tra thời điểm hết hạn khi API refresh đang treo thì `canEdit` lập tức chuyển false trước khi response về, kèm kiểm chứng nhánh refresh thất bại (lỗi mạng 500), và đối chứng đỏ code cũ.

**Giới hạn kiểm chứng:** Đã kiểm chứng qua hook unit test trong component harness; chưa kiểm chứng e2e trên browser.

<a id="bl-011"></a>

### BL-011 — Mật khẩu tạm không được bàn giao đầy đủ

1. **Bug ID:** BL-011. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/users.service.ts:153](../apps/backend/src/users/users.service.ts#L153); [apps/backend/src/users/users.controller.ts](../apps/backend/src/users/users.controller.ts); [apps/web/src/pages/admin/UserManagement.tsx:188](../apps/web/src/pages/admin/UserManagement.tsx#L188).
4. **Workflow:** Tạo/import tài khoản. [F01](features/01-accounts-and-access.md).
5. **Hiện tại (đã sửa):** Backend `UsersService.create` sinh mật khẩu tạm thời ngẫu nhiên an toàn tiền tố `Ep!` khi không truyền password; kết quả trả về `temporaryPassword` độc lập, loại bỏ `passwordHash` và `authVersion` khỏi `user`. Endpoint `resetPassword` trả mật khẩu tạm, đặt `isFirstLogin: true` và tăng `authVersion` để thu hồi phiên cũ. Thêm header `Cache-Control: no-store` cho các endpoint bàn giao credentials. Frontend `UserManagement.tsx` mở Dialog hiển thị mật khẩu tạm và cảnh báo sao chép khi tạo đơn lẻ; cung cấp nút tải file Excel `credentials-import-*.xlsx` sau khi import danh sách.
6. **Kỳ vọng có căn cứ:** Luồng quản trị tạo tài khoản phải có cách giao credential an toàn một lần theo DEC-010.
7. **Logic và trace qua lớp:** Mật khẩu tạm được sinh an toàn, trả một lần trên luồng HTTPS có no-store cache; UI cho phép quản trị viên bàn giao cho người dùng.
8. **Tình huống:** Admin tạo người dùng hoặc import danh sách -> nhận được mật khẩu tạm để bàn giao; người dùng đăng nhập lần đầu được chuyển sang đổi mật khẩu.
9. **Tác động:** Khắc phục tình trạng tài khoản mới không đăng nhập được hoặc lộ thông tin bảo mật.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `users.service.ts`, `users.controller.ts`, `UserManagement.tsx`. Đã kiểm chứng 3 tests trong `apps/backend/test/accounts-and-permissions.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-012"></a>

### BL-012 — Thiếu classId/facultyId scalar làm bộ lọc tài khoản sai

1. **Bug ID:** BL-012. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/users.service.ts:91](../apps/backend/src/users/users.service.ts#L91); [apps/web/src/pages/admin/UserManagement.tsx:246](../apps/web/src/pages/admin/UserManagement.tsx#L246).
4. **Workflow:** Admin tìm tài khoản theo đơn vị. [F01](features/01-accounts-and-access.md).
5. **Hiện tại (đã sửa):** Backend `UsersService.findAll` đã bổ sung `classId`, `facultyId` scalar vào projection select; đồng thời chuẩn hóa `student.facultyId` từ `class.facultyId` để bảo đảm sinh viên luôn có `facultyId` nhất quán. Phía STAFF, truy vấn bổ sung điều kiện `where.OR` bao quát cả sinh viên (qua `student.facultyId` hoặc `student.class.facultyId`) và cán bộ cùng Khoa.
6. **Kỳ vọng có căn cứ:** Danh sách tài khoản đã gán đơn vị phải xuất hiện đúng trong bộ lọc lớp/Khoa.
7. **Logic và trace qua lớp:** DTO trả đủ các scalar FK; bộ lọc UI so sánh chính xác `u.classId === filterClassId` và `u.facultyId === filterFacultyId`.
8. **Tình huống:** Chọn một lớp có sinh viên -> danh sách hiển thị đầy đủ sinh viên của lớp, không còn bị rỗng do so sánh với undefined.
9. **Tác động:** Quản trị viên và cán bộ lọc chính xác tài khoản theo cơ cấu đơn vị.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `users.service.ts`. Đã kiểm chứng 2 tests trong `apps/backend/test/accounts-and-permissions.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-013"></a>

### BL-013 — Nháp minh chứng không hiện dưới đúng tiêu chí

1. **Bug ID:** BL-013. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:50](../apps/backend/src/evidence/evidence.service.ts#L50); [apps/web/src/pages/student/ScoreReport.tsx:124](../apps/web/src/pages/student/ScoreReport.tsx#L124).
4. **Workflow:** Tải lại phiếu tự đánh giá có nháp. [F05](features/05-student-assessment.md).
5. **Hiện tại (đã sửa):** Backend `evidence.service.ts` include `criterionAssessment: { select: { criterionId: true } }` và map trường `criterionId` vào kết quả trả về. Frontend `ScoreReport.tsx` đọc `criterionId` (hoặc `criterionAssessmentId`) từ nháp để hiển thị đúng tiêu chí tương ứng.
6. **Kỳ vọng có căn cứ:** Nháp đã gắn CriterionAssessment phải hiện đúng tiêu chí sau tải lại.
7. **Logic và trace qua lớp:** API trả đủ `criterionId`; frontend map chính xác vào từng khối tiêu chí trên bảng điểm.
8. **Tình huống:** Sinh viên tạo nháp cho tiêu chí, tải lại trang -> nháp hiển thị đúng vị trí dưới tiêu chí đó.
9. **Tác động:** Giúp sinh viên theo dõi chính xác minh chứng đã đính kèm, không bị tạo trùng nháp.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `evidence.service.ts` và `ScoreReport.tsx`. Đã kiểm chứng trong `apps/backend/test/evidence-and-term-selection.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-014"></a>

### BL-014 — Rubric không lưu rolesScore cần cho điểm danh cộng đồng

1. **Bug ID:** BL-014. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/criteria/dut-rubric.ts](../apps/backend/src/criteria/dut-rubric.ts); [apps/backend/src/criteria/criteria.service.ts:178](../apps/backend/src/criteria/criteria.service.ts#L178); [apps/backend/src/activities/activity-aggregator.ts](../apps/backend/src/activities/activity-aggregator.ts).
4. **Workflow:** Cấu hình rubric → xác nhận điểm danh cộng đồng. [F04](features/04-rubrics-and-scoring.md), [F08](features/08-activities-and-attendance.md).
5. **Hiện tại (đã sửa):** Tuân thủ DEC-006, DEC-009 và kết quả review:
   - `DUT_RUBRIC_CRITERIA` không tự ý gán bảng điểm mặc định nhằm bảo toàn quy chế ban hành của Nhà trường.
   - `CriteriaService` mở rộng `RubricDefinition`, hỗ trợ và bảo toàn đầy đủ `rolesScore` qua các thao tác đọc (`getTermRubric`), tạo dự thảo (`createTermRubricDraft`), lưu cấu hình (`updateTermRubricDraft`) và sao chép sang kỳ mới (`createTerm`).
   - **Bản nháp (DRAFT, `isPublishing = false`):** Cho phép thiếu `rolesScore` (không chặn khi Admin đang biên soạn hoặc khởi tạo dự thảo từ bộ chuẩn).
   - **Khi ban hành (`publishTermRubric` / `publishRubricTemplateDraft`, `isPublishing = true`):** Bắt buộc tiêu chí cộng đồng (`community_activity_tier`) phải có `rolesScore` đầy đủ 3 vai trò: PARTICIPANT (Tham gia), ORGANIZER (Ban tổ chức), CHEERLEADER (Cổ vũ); điểm số là số không âm; và tuyệt đối không có alias mâu thuẫn (ví dụ vừa có `CO_VU: 2.5` vừa có `CHEERLEADER: 3` sẽ bị từ chối ngay).
   - Tuyệt đối không tự đặt mức điểm mặc định khi thiếu cấu hình.
   - Evaluator `activity-aggregator.ts` đọc `rolesScore` từ tiêu chí cấu hình, chuẩn hóa alias vai trò; nếu tiêu chí quy đổi chưa có `rolesScore`, thiếu vai trò cần tính, hoặc có alias mâu thuẫn thì lập tức trả blocker `NEEDS_VERIFICATION` (với `suggestedScore: null`).
6. **Kỳ vọng có căn cứ:** Cấu hình điểm vai trò cộng đồng do Quản trị viên thiết lập được lưu trữ, kế thừa qua các kỳ và bảo vệ tính toàn vẹn của quy chế; ban hành phải bảo đảm đủ dữ liệu hợp lệ.
7. **Logic và trace qua lớp:** Schema `Criterion.rolesScore` được validate phân biệt giữa nháp và ban hành; evaluator chỉ gợi ý điểm khi đủ cấu hình vai trò hợp lệ.
8. **Tình huống:** Quản trị viên tạo bản nháp chưa cấu hình vai trò -> lưu nháp thành công; khi bấm Ban hành -> hệ thống yêu cầu cấu hình đủ 3 vai trò; cấu hình alias mâu thuẫn bị chặn; cấu hình hợp lệ ban hành thành công và gợi ý điểm chính xác.
9. **Tác động:** Tiêu chí cộng đồng hoạt động chuẩn xác, bảo toàn quy chế qua mọi kỳ học mà không làm mất cấu hình điểm vai trò.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `criteria.service.ts`, `activity-aggregator.ts`. Đã kiểm chứng 13 tests trong `apps/backend/test/activity-and-roles-scoring.test.cjs` qua `CriteriaService` thật (gồm bản nháp cho phép thiếu rolesScore, ban hành thiếu vai trò bị từ chối, ban hành có alias mâu thuẫn bị từ chối, alias tương đương cùng điểm được chấp nhận, và aggregator bắt alias mâu thuẫn).
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng trên DB staging vật lý.

<a id="bl-015"></a>

### BL-015 — Thêm tệp vào Evidence APPROVED không đổi version/kết luận

1. **Bug ID:** BL-015. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:347](../apps/backend/src/evidence/evidence.service.ts#L347); [apps/backend/src/evidence/evidence.service.ts:418](../apps/backend/src/evidence/evidence.service.ts#L418).
4. **Workflow:** Sinh viên sửa phiếu RETURNED. [F06](features/06-evidence-and-storage.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại (đã sửa):** Trong `evidence.service.ts`, các thao tác `addFile` và `deleteDraftFile` thực hiện kiểm tra trạng thái của hồ sơ minh chứng trong transaction khóa Term: cấm thêm/xóa tệp nếu Evidence đã `APPROVED` hoặc tiêu chí đã có thẩm định chính thức. Khi bổ sung tệp cho hồ sơ đang ở trạng thái `SUPPLEMENT_REQUESTED`, hồ sơ được chuyển sang `PENDING_REVIEW` và tự động vô hiệu hóa điểm chính thức cũ (`officialScore = null, finalizedAt = null`).
6. **Kỳ vọng có căn cứ:** Nội dung được duyệt phải ổn định, không cho phép sửa lén sau khi đã duyệt.
7. **Logic và trace qua lớp:** Kiểm tra trạng thái hồ sơ trong transaction có lock; bảo toàn tính toàn vẹn của quyết định duyệt.
8. **Tình huống:** Phiếu ở trạng thái RETURNED, sinh viên gọi API thêm tệp vào minh chứng đã APPROVED -> bị chặn với BadRequestException `CANNOT_MODIFY_APPROVED_EVIDENCE`.
9. **Tác động:** Bảo vệ tính tin cậy của kết luận duyệt minh chứng và điểm rèn luyện.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `evidence.service.ts`. Đã kiểm chứng 3 tests trong `apps/backend/test/evidence-and-term-selection.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-016"></a>

### BL-016 — Bắt đổi mật khẩu lần đầu chỉ có ở frontend

1. **Bug ID:** BL-016. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/common/guards/jwt-auth.guard.ts](../apps/backend/src/common/guards/jwt-auth.guard.ts); [apps/backend/src/common/decorators/allow-first-login.decorator.ts](../apps/backend/src/common/decorators/allow-first-login.decorator.ts); [apps/backend/src/auth/auth.controller.ts](../apps/backend/src/auth/auth.controller.ts); [apps/web/src/lib/apiClient.ts](../apps/web/src/lib/apiClient.ts); [apps/web/src/pages/Account.tsx](../apps/web/src/pages/Account.tsx).
4. **Workflow:** Sử dụng tài khoản có isFirstLogin. [F01](features/01-accounts-and-access.md).
5. **Hiện tại (đã sửa):** Backend tạo decorator `@AllowFirstLogin()`. `JwtAuthGuard` kiểm tra nếu `user.isFirstLogin === true`, các endpoint không gắn decorator này sẽ bị chặn với HTTP 403 `FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED`. Allowlist chỉ gồm `/auth/me`, `/auth/change-password`, `/auth/logout`. Frontend `apiClient.ts` bắt mã lỗi 403 này và chuyển hướng về `/account?required=true` mà không xóa token; trang `Account.tsx` hiển thị banner cảnh báo bắt buộc đổi mật khẩu và mở sẵn tab đổi mật khẩu.
6. **Kỳ vọng có căn cứ:** Quy tắc bắt đổi mật khẩu lần đầu phải được thực thi triệt để tại backend.
7. **Logic và trace qua lớp:** Guard chặn API nghiệp vụ ở tầng gateway NestJS; người dùng buộc phải đổi mật khẩu thành công mới tiếp tục sử dụng hệ thống.
8. **Tình huống:** Tài khoản mới dùng token gọi API nộp phiếu hoặc duyệt điểm -> bị chặn ngay với HTTP 403; sau khi đổi mật khẩu xong gọi lại thành công.
9. **Tác động:** Đảm bảo an toàn bảo mật và chính sách chuyển giao mật khẩu cá nhân.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại guard, decorator, controller, apiClient và Account.tsx. Đã kiểm chứng 4 tests trong `apps/backend/test/accounts-and-permissions.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-017"></a>

### BL-017 — Bộ đếm không hợp lệ bị ép thành 0 và được điểm cao

1. **Bug ID:** BL-017. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/assessments/assessments.controller.ts:23](../apps/backend/src/assessments/assessments.controller.ts#L23); [apps/backend/src/assessments/assessments.service.ts:9](../apps/backend/src/assessments/assessments.service.ts#L9); [apps/backend/src/criteria/rubric-scoring.ts:25](../apps/backend/src/criteria/rubric-scoring.ts#L25).
4. **Workflow:** Xác minh dữ liệu chính thức. [F04](features/04-rubrics-and-scoring.md), [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại (đã sửa):** Backend đã bổ sung `validateVerifiedData` xác thực chặt chẽ: bộ đếm vi phạm/vắng phải là số nguyên không âm (`Number.isInteger(v) && v >= 0`), trường boolean phải có `typeof === 'boolean'`, tỷ lệ phần trăm trong `[0, 100]`, điểm quy đổi $\ge 0$, điểm chính thức trong `[0, maxScore]`. Ném `BadRequestException` với mã `INVALID_VERIFICATION_DATA` và danh sách trường lỗi trước khi mở transaction ghi DB. `rubric-scoring.ts` thay thế hàm `count` ép 0 lỏng lẻo bằng `getNonNegativeInteger`, trả `NEEDS_VERIFICATION` nếu dữ liệu vi phạm sai kiểu (không nuốt lỗi).
6. **Kỳ vọng có căn cứ:** Dữ liệu số lượng vi phạm phải hữu hạn, không âm và đúng kiểu trước tính điểm.
7. **Logic và trace qua lớp:** Validator chặn dữ liệu rác/âm/thập phân ngay tại controller/service; evaluator từ chối tính điểm khi dữ liệu không đúng quy chế.
8. **Tình huống:** Gửi examBans='abc' hoặc classWarnings=-1 -> bị từ chối ngay với HTTP 400 và không ghi DB; bộ đếm = 0 hợp lệ tính đúng điểm tối đa.
9. **Tác động:** Ngăn chặn gian lận điểm do ép kiểu ngầm, bảo vệ tính trung thực của điểm rèn luyện.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `assessments.service.ts` và `rubric-scoring.ts`. Đã kiểm chứng 11 tests trong `apps/backend/test/scoring-and-validation.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng trên DB staging vật lý.

<a id="bl-018"></a>

### BL-018 — Yêu cầu sửa thông tin mất meta và không có phân trang UI

1. **Bug ID:** BL-018. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts); [apps/backend/src/profile-data-issues/profile-data-issues.service.ts:24](../apps/backend/src/profile-data-issues/profile-data-issues.service.ts#L24); [apps/web/src/lib/apiClient.ts:182](../apps/web/src/lib/apiClient.ts#L182); [apps/web/src/pages/admin/ProfileDataIssues.tsx:19](../apps/web/src/pages/admin/ProfileDataIssues.tsx#L19).
4. **Workflow:** Admin xử lý profile data issues. [F01](features/01-accounts-and-access.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại (đã sửa):** Backend `ProfileDataIssuesController` và `service` nhận tham số `pageSize` (chuẩn hóa tối đa 100 dòng, fallback 25 dòng khi không hợp lệ hoặc <= 0), trả về envelope `{ items, total, page, pageSize }`. Frontend `apiClient.ts` chuẩn hóa kiểu trả về đọc đúng envelope. Màn `ProfileDataIssues.tsx` được bổ sung thanh Pagination Bar đầy đủ: hiển thị dải số dòng đang xem `(page - 1) * pageSize + 1` đến `Math.min(page * pageSize, total)`, tổng số dòng, nút Trang trước / Trang sau; tự động lùi trang an toàn khi xử lý (Resolve / Reject) mục cuối cùng trên trang; đồng bộ `page` vào URL search params; trang bị `requestGen = useRef(0)` để triệt tiêu race-condition khi chuyển đổi nhanh giữa tab OPEN và RESOLVED hoặc chuyển trang, bảo đảm kết quả trả về muộn không ghi đè lên dữ liệu tab mới.
6. **Kỳ vọng có căn cứ:** Admin phải thấy toàn bộ tập yêu cầu phân trang và đúng tổng.
7. **Logic và trace qua lớp:** Phân trang server-side kết nối xuyên suốt qua API client đến UI; Admin duyệt được toàn bộ các trang dữ liệu mà không bị sót hay bị ghi đè dữ liệu cũ.
8. **Tình huống:** Có 26 OPEN issues với pageSize 25 -> Admin xem trang 1 (1–25) và bấm Trang sau để duyệt tiếp issue thứ 26; khi xử lý xong issue 26 ở trang 2 thì giao diện tự động lùi về trang 1; khi chuyển sang tab RESOLVED, response trễ của tab OPEN bị hủy an toàn.
9. **Tác động:** Không còn bỏ sót yêu cầu chỉnh sửa thông tin của sinh viên; giao diện luôn hiển thị đúng trạng thái tab đang chọn.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại controller, service, apiClient và `ProfileDataIssues.tsx`. Đã kiểm chứng qua 8 tests trong `apps/backend/test/pagination-and-filter.test.cjs` và 1 test trong `apps/web/scripts/score-report-and-evidence-list.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-019"></a>

### BL-019 — Danh sách minh chứng chỉ tải trang đầu rồi lọc cục bộ

1. **Bug ID:** BL-019. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evidence/evidence.controller.ts](../apps/backend/src/evidence/evidence.controller.ts); [apps/backend/src/evidence/evidence.service.ts:25](../apps/backend/src/evidence/evidence.service.ts#L25); [apps/web/src/lib/apiClient.ts](../apps/web/src/lib/apiClient.ts); [apps/web/src/pages/student/EvidenceList.tsx:20](../apps/web/src/pages/student/EvidenceList.tsx#L20).
4. **Workflow:** Sinh viên tìm minh chứng. [F06](features/06-evidence-and-storage.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại (đã sửa):** Backend `EvidenceController` và `service` nhận tham số `statusGroup` (`APPROVED`, `SUPPLEMENT`, `REVIEWING`); tìm kiếm hỗ trợ cả tên hoạt động tự khai và `id` minh chứng (`contains: search, mode: 'insensitive'`); bảo toàn điều kiện tìm kiếm trong `baseScopeWhere` để số lượng đếm `counts: { all, approved, supplement, reviewing }` phản ánh chính xác kết quả tìm kiếm trên toàn bộ tập dữ liệu trong kỳ; trả về envelope `{ items, total, page, pageSize, counts }`. Frontend `apiClient.ts` bổ sung hàm `getEvidencesPage`. Màn `EvidenceList.tsx` chuyển sang gọi API phân trang server-side, debounce tìm kiếm 350ms, bộ lọc tab gọi server, bổ sung Pagination Bar đầy đủ với nút Trang trước / Trang sau, tự động lùi trang khi rút/xóa minh chứng cuối cùng trên trang; trang bị dropdown chọn kỳ, đồng bộ query param `termId`, tự động reset `page = 1` và xóa `page` thừa khỏi URL khi đổi kỳ.
6. **Kỳ vọng có căn cứ:** Danh sách/tìm kiếm phải truy cập được hồ sơ ngoài trang đầu API đã phân trang; bộ lọc kỳ và tìm kiếm phải chính xác.
7. **Logic và trace qua lớp:** Phân trang và lọc được thực hiện tại server; số lượng đếm trên từng tab phản ánh chính xác số lượng thực tế trong toàn bộ kỳ theo từ khóa tìm kiếm; đổi kỳ tự reset trang đầu.
8. **Tình huống:** Sinh viên có 25 minh chứng (vượt quá 20 dòng) -> chuyển trang 2 mượt mà, xem được đầy đủ hồ sơ cũ; tìm kiếm theo mã hồ sơ trả kết quả chính xác; chuyển sang kỳ mới tự động về trang 1.
9. **Tác động:** Sinh viên quản lý và theo dõi đầy đủ tất cả minh chứng đã nộp mà không bị cắt xén dữ liệu hoặc nhầm lẫn giữa các kỳ.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại controller, service, apiClient và `EvidenceList.tsx`. Đã kiểm chứng qua 8 tests trong `apps/backend/test/pagination-and-filter.test.cjs` và 2 tests trong `apps/web/scripts/score-report-and-evidence-list.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-020"></a>

### BL-020 — Chọn gia hạn chỉ có 100 sinh viên và lệch roster kỳ

1. **Bug ID:** BL-020. **Trạng thái:** Resolved. **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/components/admin/DeadlineExtensionsDialog.tsx](../apps/web/src/components/admin/DeadlineExtensionsDialog.tsx); [apps/backend/src/deadline-extensions/deadline-extensions.service.ts:53](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts#L53); [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:40](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L40).
4. **Workflow:** Admin gia hạn cá nhân. [F03](features/03-terms-and-deadlines.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại:** Dialog tải page1,size100 không search/pager; users với ADMIN không bắt buộc membership chỉ vì có termId.
6. **Kỳ vọng có căn cứ:** Đối tượng thuộc kỳ phải chọn được đầy đủ và không đưa đối tượng không hợp lệ vào picker.
7. **Logic và trace qua lớp:** termId chủ yếu đổi projection class/nhánh STAFF; đầu vào ADMIN không được giới hạn roster kỳ và dialog cắt trang.
8. **Tình huống:** Kỳ có 101 sinh viên; người cần gia hạn ngoài 100 hoặc sinh viên mới chưa thuộc kỳ lại xuất hiện.
9. **Tác động:** Không gia hạn được đúng người hoặc gửi yêu cầu chắc chắn bị service từ chối.
10. **Gợi ý sửa:** Endpoint/picker roster-scoped, tìm kiếm phân trang và giữ snapshot lớp.
11. **Regression test:** 101+ roster và user ngoài kỳ; tìm được người cuối và không chọn user ngoài roster.
12. **Bằng chứng đã xử lý:** Đã bổ sung endpoint `GET /deadline-extensions/targets` nhận `termId`, `targetType`, `q`, `page`, `pageSize`; validate DTO đầu vào; truy vấn trực tiếp từ `AssessmentHandoff` của kỳ, trích xuất thông tin lớp snapshot từ `h.class`, loại trùng lặp cho lớp và chỉ trả sinh viên thuộc roster của kỳ; `create` từ chối nếu đối tượng ngoài roster kỳ. Cập nhật `DeadlineExtensionsDialog.tsx`: picker roster-scoped có tìm kiếm debounce 300ms, phân trang trang trước/sau, reset state khi đổi loại/kỳ và chống race-condition qua `requestId`, hiển thị đúng MSSV/họ tên/lớp snapshot không bị undefined. Đã kiểm chứng đạt 4/4 ca backend trong [deadline-and-closure.test.cjs](../apps/backend/test/deadline-and-closure.test.cjs) (DTO validation, phân trang 105 sinh viên, loại trùng lớp, chặn ngoài roster) và 2/2 ca frontend trong [deadline-dialog-and-access.test.cjs](../apps/web/scripts/deadline-dialog-and-access.test.cjs) (render thông tin sinh viên và phân trang thực tế 6 trang bằng nút bấm, hiển thị và chọn thành công sinh viên 105).

**Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory và component harness; chưa kiểm chứng e2e trên browser.

<a id="bl-021"></a>

### BL-021 — Loại trừ lần hai trùng dedupeKey và rollback

1. **Bug ID:** BL-021. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/evaluation-workflow/workflow.service.ts:349](../apps/backend/src/evaluation-workflow/workflow.service.ts#L349); [apps/backend/src/evaluation-workflow/workflow.service.ts:390](../apps/backend/src/evaluation-workflow/workflow.service.ts#L390).
4. **Workflow:** Exclude → restore → exclude. [F09](features/09-faculty-handoff.md), [F13](features/13-notifications.md).
5. **Hiện tại (đã sửa):** Trong `workflow.service.ts`:
   - `exclude`: Đảm bảo strict idempotency (nếu hồ sơ đã ở trạng thái `EXCLUDED`, lập tức trả về `row` mà không ghi đè lý do hay sinh notification thừa, kể cả khi truyền lý do khác); giữ nguyên `revision` bàn giao của hồ sơ (bảo toàn ngữ nghĩa revision bàn giao theo F09); sinh `eventId = randomUUID()` gắn vào `dedupeKey: excluded:${row.id}:${eventId}`; ghi nhận `eventId` vào AuditLog `ASSESSMENT_EXCLUDED`.
   - `restoreExcluded`: Chuyển trạng thái về `WORKING`, xóa `exclusionReason`, giữ nguyên `revision`; sinh `eventId = randomUUID()` gắn vào `dedupeKey: restored:${row.id}:${eventId}`, tạo thông báo khôi phục cho sinh viên và ghi AuditLog `ASSESSMENT_RESTORED` kèm `eventId`.
   - Nhờ sinh `eventId` độc nhất cho mỗi sự kiện loại trừ/khôi phục và giữ đúng `revision`, lỗi trùng lặp unique constraint P2002 của Prisma trên bảng `Notification.dedupeKey` được triệt tiêu hoàn toàn mà không làm xáo trộn số hiệu revision bàn giao của Khoa.
6. **Kỳ vọng có căn cứ:** Khôi phục rồi loại trừ vì lý do mới phải là sự kiện hợp lệ, giữ cả lịch sử và không làm lỗi cơ sở dữ liệu.
7. **Logic và trace qua lớp:** Mỗi lần thay đổi trạng thái loại trừ/khôi phục sinh một eventId độc nhất; transaction thực thi thành công không bị rollback.
8. **Tình huống:** Admin loại trừ sinh viên A vì kỷ luật -> khôi phục khi có quyết định hủy -> sau đó phát hiện vi phạm mới và loại trừ lại -> cả 2 lần loại trừ và lần khôi phục đều được ghi nhận đầy đủ, không bị lỗi DB.
9. **Tác động:** Đảm bảo luồng quản trị loại trừ/khôi phục sinh viên hoạt động tin cậy và chính xác.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `workflow.service.ts`. Đã kiểm chứng 6 tests trong `apps/backend/test/exclusion-and-restore.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng trên PostgreSQL staging vật lý.

<a id="bl-022"></a>

### BL-022 — Thêm nguồn xác minh hủy job nhưng Evidence còn PROCESSING

1. **Bug ID:** BL-022. **Trạng thái:** Deferred (Hoãn theo quyết định người dùng - DEC-007). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/reviews/reviews.service.ts:269](../apps/backend/src/reviews/reviews.service.ts#L269); [apps/backend/src/evidence/evidence-processing.worker.ts:146](../apps/backend/src/evidence/evidence-processing.worker.ts#L146).
4. **Workflow:** Cán bộ thêm nguồn khi AI đang xử lý. [F07](features/07-evidence-review-and-verification.md), [F14](features/14-audit-monitoring-and-ai-jobs.md).
5. **Hiện tại:** addSource tăng version, CANCELLED job nhưng không đổi Evidence.status. Hoãn theo quyết định không thay đổi worker/pipeline AI của người dùng (DEC-007).

<a id="bl-023"></a>

### BL-023 — Màn bổ sung hiển thị deadline/nội dung giả

1. **Bug ID:** BL-023. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/pages/student/SupplementEvidence.tsx:130](../apps/web/src/pages/student/SupplementEvidence.tsx#L130); [apps/backend/src/reviews/reviews.service.ts:210](../apps/backend/src/reviews/reviews.service.ts#L210).
4. **Workflow:** Sinh viên đáp ứng SupplementRequest. [F07](features/07-evidence-review-and-verification.md).
5. **Hiện tại (đã sửa):** Frontend `SupplementEvidence.tsx` đã loại bỏ hoàn toàn hạn cứng "25/10/2026" và nội dung fallback giả. Giao diện đọc trực tiếp `missingItem` và `deadline` từ `SupplementRequest` mới nhất còn mở (lọc theo `status: 'OPEN'`). Nếu không có deadline cụ thể, hiển thị "Không đặt hạn cụ thể" thay vì hiển thị ngày giả.
6. **Kỳ vọng có căn cứ:** UI hiển thị SupplementRequest.missingItem/deadline thực và trạng thái không đặt hạn.
7. **Logic và trace qua lớp:** Màn hình đọc đúng trường từ DTO backend trả về, định dạng ngày thực tế theo locale vi-VN.
8. **Tình huống:** Cán bộ yêu cầu nộp minh chứng có dấu mộc trước 30/11 -> sinh viên nhìn thấy chính xác yêu cầu này và hạn 30/11.
9. **Tác động:** Sinh viên bổ sung đúng nội dung và kịp thời gian, tránh nộp sai hoặc quá hạn.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `SupplementEvidence.tsx`. Đã kiểm chứng trong `apps/backend/test/evidence-and-term-selection.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-024"></a>

### BL-024 — Sinh viên mở URL kỳ khác nhưng đọc activeTerm

1. **Bug ID:** BL-024. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/web/src/pages/student/ScoreReport.tsx:21](../apps/web/src/pages/student/ScoreReport.tsx#L21); [apps/web/src/layouts/AppLayout.tsx:511](../apps/web/src/layouts/AppLayout.tsx#L511).
4. **Workflow:** Đổi kỳ / mở deep link bảng điểm. [F05](features/05-student-assessment.md), [F12](features/12-scores-reports-and-exports.md).
5. **Hiện tại (đã sửa):** Màn hình `ScoreReport.tsx` đọc `termId` từ search params (`useSearchParams`), đồng bộ với `selectedTermId` và truyền vào `getMyAssessments({ termId })`. Khi URL có `?termId=xyz`, giao diện ưu tiên tải đúng dữ liệu của kỳ đó; dropdown chọn kỳ trên header (cả desktop và mobile trong `AppLayout.tsx`) cập nhật đúng query param của URL. Đồng thời, `ScoreReport.tsx` trang bị `currentTermRef` và `submitGenerationRef`: khi sinh viên đổi kỳ trong lúc request preflight/fetch đang treo, phản hồi cũ bị loại bỏ ngay lập tức và trạng thái `preflight` được reset về `null`, chặn đứng tình trạng nộp chéo kỳ do race-condition mạng.
6. **Kỳ vọng có căn cứ:** URL chứa kỳ phải khớp dữ liệu hiển thị, như navigation theo kỳ hiện có; không để request cũ nộp sang kỳ mới.
7. **Logic và trace qua lớp:** Nguồn chọn kỳ được đồng bộ giữa URL query và UI context; khi đổi kỳ thì URL cập nhật, dữ liệu tải lại đúng kỳ mục tiêu và request treo bị hủy.
8. **Tình huống:** Sinh viên mở link `/student/scores?termId=old-term` -> bảng điểm tải và hiển thị đúng điểm của kỳ `old-term` chứ không lấy nhầm kỳ `activeTerm`; khi chuyển nhanh giữa các kỳ, preflight của kỳ cũ không thể kích hoạt hành động nộp ở kỳ mới.
9. **Tác động:** Giúp sinh viên tra cứu chính xác lịch sử điểm rèn luyện và bảo đảm an toàn dữ liệu khi thao tác chuyển kỳ.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `ScoreReport.tsx` và `AppLayout.tsx`. Đã kiểm chứng trong `apps/backend/test/evidence-and-term-selection.test.cjs` và Ca 1 (Deferred Promise) trong `apps/web/scripts/score-report-and-evidence-list.test.cjs`.
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-025"></a>

### BL-025 — API tạo tài khoản bỏ qua ràng buộc vai trò mà UI bắt buộc

1. **Bug ID:** BL-025. **Trạng thái:** Resolved (2026-11-16). **Độ chắc chắn:** Confirmed; **ưu tiên:** P2.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/users/users.service.ts:157](../apps/backend/src/users/users.service.ts#L157); [apps/web/src/pages/admin/UserManagement.tsx:373](../apps/web/src/pages/admin/UserManagement.tsx#L373).
4. **Workflow:** Tạo sinh viên/cán bộ. [F01](features/01-accounts-and-access.md).
5. **Hiện tại (đã sửa):** Backend `UsersService.validateUserPayload` thực thi chặt chẽ:
   - STUDENT: Bắt buộc `studentCode` không rỗng (sau trim) và `classId` hợp lệ; nếu truyền `facultyId` thì lớp phải thuộc đúng Khoa đó.
   - STAFF: Bắt buộc `facultyId` hợp lệ; cấm truyền `studentCode` hoặc `classId`.
   - ADMIN: Cấm truyền `studentCode`, `classId`, hoặc `facultyId`.
   - Update: Cấm dùng chuỗi rỗng để xóa các trường bắt buộc theo vai trò; kiểm tra trùng lặp email và MSSV nếu có thay đổi.
   - **Xử lý tài khoản legacy theo kết quả review:**
     + Cho phép sửa thông tin không liên quan (như `fullName`, `email`) hoặc khóa tài khoản (`isActive: false`) của tài khoản legacy thiếu lớp/Khoa/MSSV mà **tuyệt đối không truy vấn class/faculty với ID null**.
     + Khi **bổ sung định danh** (truyền `studentCode`, `classId`, hoặc `facultyId`) HOẶC **kích hoạt tài khoản** (`isActive: true` từ tài khoản đang bị khóa): bắt buộc kiểm tra dữ liệu đầy đủ và từ chối nếu thiếu thông tin bắt buộc.
6. **Kỳ vọng có căn cứ:** Theo form hiện hành STUDENT cần MSSV/lớp, STAFF cần Khoa; API thực thi cùng quy tắc với UI; tài khoản legacy được cập nhật linh hoạt nhưng bảo đảm an toàn khi kích hoạt.
7. **Logic và trace qua lớp:** Validation được thực thi tại service trước khi ghi DB; chỉ truy vấn quan hệ DB khi ID hợp lệ; từ chối `BadRequestException` nếu vi phạm ràng buộc vai trò.
8. **Tình huống:** Sửa họ tên cho tài khoản legacy thiếu lớp -> thành công không query ID null; kích hoạt tài khoản legacy đang khóa mà chưa bổ sung MSSV -> bị chặn yêu cầu bổ sung dữ liệu đầy đủ.
9. **Tác động:** Đảm bảo toàn vẹn dữ liệu người dùng, loại bỏ tài khoản mồ côi không vào được roster kỳ.
10. **Bằng chứng giải quyết:** Đã sửa mã nguồn tại `users.service.ts`. Đã kiểm chứng 12 tests trong `apps/backend/test/accounts-and-permissions.test.cjs` qua `UsersService` thật (gồm các ca sửa thông tin không liên quan không gọi ID null, bổ sung MSSV thiếu lớp bị từ chối, kích hoạt tài khoản thiếu MSSV/Khoa bị từ chối, và khóa tài khoản legacy thành công).
11. **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory; chưa kiểm chứng e2e trên browser.

<a id="bl-026"></a>

### BL-026 — Xóa minh chứng/tệp có khoảng đua với nộp phiếu

1. **Bug ID:** BL-026. **Trạng thái:** Done. **Độ chắc chắn:** Confirmed qua PostgreSQL đa kết nối. **Ưu tiên:** P0.
2. **Severity:** High.
3. **Vị trí:** [apps/backend/src/evidence/evidence.service.ts:429](../apps/backend/src/evidence/evidence.service.ts#L429); [apps/backend/src/evidence/evidence.service.ts:451](../apps/backend/src/evidence/evidence.service.ts#L451); [apps/backend/src/assessments/assessments.service.ts:188](../apps/backend/src/assessments/assessments.service.ts#L188).
4. **Workflow:** Hai request xóa và nộp đồng thời. [F06](features/06-evidence-and-storage.md).
5. **Hiện tại:** ensureEvidenceEditable trước đây có transaction riêng kết thúc trước Storage delete/Prisma delete; deleteEvidence dựa snapshot DRAFT đọc trước. Hiện đã được sửa: đưa việc kiểm tra và xóa DB vào trong transaction khóa Term qua `workflow.studentEdit`.
6. **Kỳ vọng có căn cứ:** Sau SUBMITTED không được xóa dữ liệu vừa nộp; kiểm tra và thay đổi phải tuần tự theo cùng khóa.
7. **Logic và trace qua lớp:** Term lock bảo vệ nộp; khi bọc cả thao tác xóa DB vào `workflow.studentEdit`, hai luồng bị tuần tự hóa bởi `SELECT FOR UPDATE`. Danh sách tệp cần xóa được đọc bên trong lock và dọn Storage sau commit.
8. **Tình huống:** TabA bắt đầu xóa nháp rồi dừng sau precheck; tabB nộp phiếu; tabA tiếp tục xóa file/quan hệ.
9. **Tác động:** Có thể mất tệp/hồ sơ đã nộp hoặc lỗi và trạng thái dở dang nếu không tuần tự hóa.
10. **Gợi ý sửa:** Đặt kiểm tra hiện trạng và ghi DB trong cùng transaction khóa Term; thiết kế cleanup Storage sau commit có thể retry (đã thực hiện).
11. **Regression test:** Barrier integration test hai kết nối DB cách ly, xen kẽ precheck→submit→delete; nộp thành công phải giữ tệp hoặc xóa buộc nộp bị chặn.
12. **Tiến độ xử lý & Kiểm chứng:** Đã sửa mã nguồn: đưa toàn bộ kiểm tra và thao tác xóa DB trong `deleteDraftFile` và `deleteEvidence` vào transaction có khóa Term qua `workflow.studentEdit`; đọc lại danh sách tệp `files` bên trong lock và trả ra ngoài transaction để dọn Storage sau khi commit; helper `cleanupStorageObject` kiểm tra `res.ok`, log rõ ràng lỗi HTTP/mạng và bắt lỗi cấu hình an toàn. Đã kiểm chứng 5 kịch bản đối chứng trong [apps/backend/test/data-protection.test.cjs](../apps/backend/test/data-protection.test.cjs) (thứ tự nộp trước chặn xóa và không gọi DELETE Storage; thứ tự xóa tệp trước khiến nộp bị chặn do thiếu file; rollback giữ nguyên Storage; đọc file trong lock; cleanup lỗi không làm hỏng kết quả DB). Cập nhật 2026-11-23: kiểm hai thứ tự trên PostgreSQL 17. `pg_blocking_pids` xác nhận kết nối thứ hai thật sự chờ khóa. [Suite](../apps/backend/test/submission-concurrency.integration.test.cjs).

**Giới hạn bằng chứng:** Khóa và trạng thái ghi đã được kiểm trên PostgreSQL cách ly. Storage dùng giả lập.

<a id="bl-027"></a>

### BL-027 — Preflight nộp phiếu nằm ngoài transaction khóa

1. **Bug ID:** BL-027. **Trạng thái:** Done. **Độ chắc chắn:** Confirmed qua PostgreSQL đa kết nối. **Ưu tiên:** P1.
2. **Severity:** Medium.
3. **Vị trí:** [apps/backend/src/assessments/assessments.service.ts:179](../apps/backend/src/assessments/assessments.service.ts#L179); [apps/backend/src/assessments/assessments.service.ts:188](../apps/backend/src/assessments/assessments.service.ts#L188).
4. **Workflow:** Hai tab lưu điểm và nộp đồng thời. [F05](features/05-student-assessment.md).
5. **Hiện trạng khi audit:** Kiểm đủ điểm preflight trước transaction. Sau sửa, submit dùng cùng kiểm tra dữ liệu dưới khóa Term với rubric và cờ F15 hiện hành.
6. **Kỳ vọng có căn cứ:** Phiếu SUBMITTED phải thỏa điều kiện preflight trên dữ liệu được commit.
7. **Logic và trace qua lớp:** Một request lưu null điểm có thể commit giữa preflight và acquire Term lock của nộp; nộp dùng kết quả kiểm cũ.
8. **Tình huống:** TabA preflight đủ; tabB xóa một điểm tự đánh giá; tabA lấy lock rồi nộp.
9. **Tác động:** Có thể nộp phiếu thiếu dữ liệu dù preflight báo đủ trước đó.
10. **Gợi ý sửa:** Tái kiểm đầy đủ điều kiện nộp trong transaction đã khóa, dùng cùng rubric/dữ liệu current.
11. **Regression test:** Dùng barrier cho save-null trước khi submit lấy lock; submit phải trả blocker, không SUBMITTED.

**Kiểm chứng:** Hai kết nối PostgreSQL 17 và barrier xác nhận chờ khóa cho các thay đổi lưu null, vượt trần và tắt F15. Không tạo SUBMITTED, job hoặc audit trong ba ca bị từ chối. [Suite](../apps/backend/test/submission-concurrency.integration.test.cjs).

## Cập nhật P0 từ audit `eef49ca` — 2026-11-23

<a id="bl-028"></a>

### BL-028 — Quyền chốt hàng loạt

**P0 / High / Confirmed / Done.** Batch trước đây chỉ kiểm `scope`. Hiện mỗi phiếu đi qua `assertEditable` trong transaction ghi và helper lấy khóa hàng Term bằng cùng `tx`. Regression HTTP kiểm ba đường chốt, sai vai trò/Khoa, SENT, EXCLUDED, CLOSED và dữ liệu/audit giữ nguyên trong các ca bị từ chối. [Backend](../apps/backend/src/assessments/assessments.service.ts#L901), [integration](../apps/backend/test/workflow.integration.test.cjs).

<a id="bl-029"></a>

### BL-029 — Xác nhận import khác kỳ đã xem trước

**P0 / High / Confirmed / Done.** Phiên Web gắn kỳ, danh mục, hoạt động và file. API bắt buộc `previewTermId` cùng kỳ, chặn replay khóa khác kỳ. Regression component và HTTP/DB kiểm hai kỳ có cùng MSSV, phản hồi muộn, retry và không ghi dữ liệu khi lệch kỳ. [Web](../apps/web/src/pages/officer/ImportGroundingData.tsx#L92), [Backend](../apps/backend/src/grounding-import/grounding-import.service.ts#L365).

<a id="bl-036"></a>

### BL-036 — Dựng môi trường migration PostgreSQL 17

**P0 / High / Confirmed.** Compose đã chuyển PG17 và chuẩn bị pgvector. Baseline SQL nguyên bản được áp dụng qua session riêng, 13 migration sau đó qua Prisma. Integration chạy đạt trên DB cách ly với lịch sử đủ 14 migration. Giữ mở phần deploy một bước do `P1014` trên DB mới. [Quy trình và bằng chứng](TEST_PLAN.md#postgresql-17-local).

## Cập nhật hiển thị và phân trang từ audit `eef49ca` — 2026-11-23

<a id="bl-031"></a>

### BL-031 — Hiển thị kết quả chốt phiếu

**Medium / Confirmed / Done.** Bảng chốt hàng loạt từng đọc `failedCount` và `officialScore` dù API trả `failureCount` và `finalizedCount`. Modal từng phiếu lấy điểm gợi ý kể cả khi đã có điểm Khoa điều chỉnh. Web hiện đọc số phiếu bị chặn, số tiêu chí vừa chốt, lý do và `projectedScore` theo API. Regression kiểm lô một thành công/một bị chặn và điểm đã chốt bằng 0 khác điểm gợi ý. [Bảng kết quả](../apps/web/src/components/EvaluationBoard.tsx#L493), [modal](../apps/web/src/pages/officer/StudentAssessment.tsx#L1379).

<a id="bl-033"></a>

### BL-033 — Điểm gợi ý trên phiếu sinh viên và màn Khoa

**Medium / Confirmed / Done.** `getMine` từng xóa điểm gợi ý trong kỳ workflow và màn Khoa gắn nhãn AI cho điểm tổng hợp từ nhiều nguồn. Projection hiện giữ `suggestedScore` đã lưu, giữ trường nội bộ ở dạng ẩn và lấy điểm chính thức từ publication. Màn Khoa hiển thị nhãn **Điểm gợi ý**. Regression kiểm điểm 0, `null`, kỳ tắt F15 và điểm công bố khác điểm gợi ý. [Projection](../apps/backend/src/assessments/assessments.service.ts#L249), [màn Khoa](../apps/web/src/pages/officer/StudentAssessment.tsx#L384).

<a id="bl-035"></a>

### BL-035 — Minh chứng cần bổ sung ngoài trang mặc định

**Medium / Confirmed / Done.** Dashboard từng lấy thống kê từ trang đầu và lọc danh sách bổ sung tại chỗ. Client hiện đọc `meta.counts` toàn kỳ và tải bổ sung với `NEEDS_SUPPLEMENT`. Regression dùng 21 hồ sơ, kiểm số liệu toàn kỳ, hồ sơ cần bổ sung ngoài trang đầu và lỗi tải danh sách riêng. [API client](../apps/web/src/lib/apiClient.ts#L482), [Dashboard](../apps/web/src/pages/student/Dashboard.tsx#L73).

<a id="bl-037"></a>

### BL-037 — Tổng thông báo chưa đọc ngoài 50 mục

**Low / Confirmed / Done.** API client từng bỏ `unreadCount` nên Web đếm riêng 50 mục gần nhất. Chuông và trung tâm hiện dùng chung tổng từ API. Regression kiểm thông báo chưa đọc ở vị trí 51, trạng thái tab Chưa đọc và đồng bộ badge khi đánh dấu tất cả. [API client](../apps/web/src/lib/apiClient.ts#L627), [trung tâm thông báo](../apps/web/src/pages/common/NotificationsCenter.tsx#L36).

## Cập nhật P1 và concurrency — 2026-11-23

<a id="bl-030"></a>

### BL-030 — Căn cứ CLB/BTC và thu hồi

**Confirmed / Done.** Import từng chỉ lưu nguồn để báo preflight, còn thu hồi chỉ chặn SENT. Hiện phiếu Khoa hiển thị nguồn CLB/BTC theo tiêu chí 4/13 và giữ liên kết ID sau đồng bộ. Thu hồi kiểm trạng thái tiêu chí, phiếu và publication trong transaction. Regression kiểm nhiều nguồn, giữ xác minh tay và rollback khi gặp blocker. [Service](../apps/backend/src/grounding-import/grounding-import.service.ts), [integration](../apps/backend/test/grounding-db.integration.test.cjs).

<a id="bl-032"></a>

### BL-032 — Cờ F15 và trạng thái kỳ

**Confirmed / Done.** Preview và các điểm ghi F15 dùng cùng quy tắc. Confirm, thu hồi, đồng bộ và chốt dưới khóa Term. Web vô hiệu hóa phiên xem trước khi kỳ mất điều kiện. Đã kiểm các trạng thái UPCOMING/CLOSED, cờ tắt và quy tắc chặn tắt cờ khi còn lô ACTIVE. [Policy](../apps/backend/src/grounding-import/f15-policy.ts), [TEST_PLAN](TEST_PLAN.md#p1-suite-results).

<a id="bl-034"></a>

### BL-034 — Kỳ và hạn hiệu lực trong thông báo

**Confirmed / Done.** Thông báo gia hạn từng mở dashboard chung, thông báo công bố hiển thị hạn kỳ. Hiện cả hai mở bảng điểm đúng kỳ; bảng điểm đã công bố hiển thị hạn phúc khảo hiệu lực. Regression kiểm ưu tiên cá nhân, lớp snapshot, hạn kỳ và thu hồi. [Gia hạn](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts), [HTTP integration](../apps/backend/test/workflow.integration.test.cjs).

## Độ bao phủ và giới hạn kiểm chứng

Đã đối chiếu Web routes/callers, 16 controller, service/policy, guard/DTO, schema 34 model, 12 migration và các test liên quan; xem phân loại implementation/scaffold trong [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md). Các số là inventory nguồn tại baseline, không khẳng định hạ tầng đã triển khai giống schema.

Kết quả được ghi nhận từ đợt audit trước trong cuộc trao đổi: 15 test worker và 6 test faculty analytics đạt; 23 ca tái hiện có chọn lọc bằng in-memory doubles, trong đó 2 ca mô hình hóa khoảng đua. Harness tái hiện không được lưu thành regression test trong repository. Không coi chúng là bằng chứng DB concurrency/Storage/pipeline. Đợt tài liệu này không chạy lại ứng dụng hoặc integration fixture.

Chưa chạy DB integration/browser, chưa kiểm tra deployed migrations, bucket policy, object lifecycle, pipeline thật hoặc hiệu năng production. Test integration hiện có thao tác tạo/xóa fixture; một fixture Activity cần đối chiếu startDate bắt buộc trước khi dùng. Không start backend vì worker polling có thể ghi DB/gọi AI.

Không ghi nhận tính năng mobile/AI scaffold hay proposal SSO/RAG/OCR như defect nếu chưa có yêu cầu triển khai được xác nhận. Các lỗ hổng chính sách và tài liệu thiếu nằm riêng ở [DECISIONS](DECISIONS.md).

## Cần con người làm rõ

[Q-01 đến Q-09](DECISIONS.md) bao gồm hợp nhất hoạt động, tỷ lệ quy đổi, hạn hiệu lực, roster mới/chuyển đơn vị, loại trừ, phúc khảo lặp, tài liệu bàn giao thiếu và quyền điểm danh của Admin. Không tự đổi các chính sách này để đóng audit.

