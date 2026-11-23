# F07 — Duyệt minh chứng và chốt tiêu chí

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STAFF theo Khoa; ADMIN chỉ xem trong workflow mới |
| Trạng thái | Đã có implementation; các gap BL-002, BL-004, BL-005, BL-015, BL-017, BL-023 đã được giải quyết; BL-022 hoãn theo quyết định AI (DEC-007) |
| Quy tắc liên quan | [R-01](../BUSINESS_RULES.md#r-01), [R-14](../BUSINESS_RULES.md#r-14), [R-15](../BUSINESS_RULES.md#r-15) |

Nguồn: [reviews/reviews.service.ts](../../apps/backend/src/reviews/reviews.service.ts), [assessments/assessments.service.ts](../../apps/backend/src/assessments/assessments.service.ts), [evidence/evidence.service.ts](../../apps/backend/src/evidence/evidence.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-002](../BUSINESS_LOGIC_AUDIT.md#bl-002) (Resolved), [BL-004](../BUSINESS_LOGIC_AUDIT.md#bl-004) (Resolved), [BL-005](../BUSINESS_LOGIC_AUDIT.md#bl-005) (Resolved), [BL-015](../BUSINESS_LOGIC_AUDIT.md#bl-015) (Resolved), [BL-017](../BUSINESS_LOGIC_AUDIT.md#bl-017) (Resolved), [BL-022](../BUSINESS_LOGIC_AUDIT.md#bl-022) (Hoãn AI - DEC-007), [BL-023](../BUSINESS_LOGIC_AUDIT.md#bl-023) (Resolved). Theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Tách kết luận minh chứng khỏi xác minh dữ liệu và điểm chính thức. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Cán bộ nhận khóa minh chứng, bổ sung nguồn, duyệt/từ chối/yêu cầu bổ sung; sau đó xác minh dữ liệu và chốt từng tiêu chí.

Luồng: ReviewQueue / ReviewDetail / StudentAssessment → ReviewsController, AssessmentsController → ReviewsService / AssessmentsService → workflow.edit → Review, VerificationResult, SupplementRequest, CriterionAssessment, AuditLog, Notification.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F07-AC-01:** Không xử lý ngoài Khoa hoặc phiếu SENT/EXCLUDED/CLOSED.
- **F07-AC-02:** Khóa còn hiệu lực của cán bộ khác và version xung đột phải bị chặn.
- **F07-AC-03:** Duyệt minh chứng không tự ghi officialScore.
- **F07-AC-04:** Thay đổi kết luận minh chứng làm mất hiệu lực điểm tiêu chí cũ.
- **F07-AC-05:** Chốt điểm cần dữ liệu đủ, ghi chú xác minh và lý do. Trong workflow mới chỉ `STAFF` đúng Khoa theo snapshot được chốt. Chốt tiêu chí, từng phiếu và hàng loạt dùng chung kiểm tra quyền dưới khóa `Term`.
- **F07-AC-06:** Yêu cầu bổ sung hiển thị đúng missingItem và deadline lưu trong DB.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Queue có trạng thái/chủ khóa; chi tiết cho căn cứ, AI và lịch sử; SupplementEvidence hiển thị yêu cầu và lỗi đúng trường.

Màn phiếu Khoa gọi `CriterionAssessment.suggestedScore` là **Điểm gợi ý**, vì giá trị có thể đến từ căn cứ quy chế, xác minh tay hoặc AI. Modal chốt hiển thị `projectedScore` và phân biệt tiêu chí đã chốt với tiêu chí sẵn sàng chốt. Xem các ca BL-031/033 trong [TEST_PLAN](../TEST_PLAN.md).

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /reviews/queue`
- `POST /evidence/:id/claim, /evidence/:id/release, /evidence/:id/review, /evidence/:id/verification-sources, /evidence/:id/supplement`
- `PUT /assessments/students/:studentId/:termId/:criterionId/verification, /assessments/students/:studentId/:termId/:criterionId/final`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Lock hết 15 phút.
- expectedVersion bị bỏ qua bởi client cũ.
- Nguồn nhập khi AI đang chạy.
- approved chỉ là một phần dữ liệu hoạt động.
- supplement không có deadline.

## 8. UI States — Trạng thái giao diện

| Trạng thái | Hành vi cần kiểm chứng |
|---|---|
| Loading | Có chỉ báo; không dùng dữ liệu kỳ trước như dữ liệu kỳ đang chọn |
| Empty | Giải thích không có dữ liệu/không có quyền thao tác theo phản hồi API |
| Ready | Hiển thị dữ liệu, quyền và hành động hợp lệ |
| Saving | Chống bấm lặp, giữ thông tin nhập |
| Success | Tải lại dữ liệu liên quan và hiển thị trạng thái mới |
| Error | Giữ dữ liệu hợp lệ đang có, thông báo nguyên nhân và cho thử lại |
| Read only | Giải thích trạng thái khóa/hết hạn theo quyền server |

Đây là checklist nghiệm thu; kiểm tra từng màn để đánh dấu đạt, không suy từ việc có component chung.

## 9. Test Cases — Kịch bản kiểm thử

| ID | Kịch bản | Liên kết | Trạng thái |
|---|---|---|---|
| F07-TC-01 | Kiểm chứng: không xử lý ngoài Khoa hoặc phiếu SENT/EXCLUDED/CLOSED | F07-AC-01 | Planned |
| F07-TC-02 | Kiểm chứng: khóa còn hiệu lực của cán bộ khác và version xung đột phải bị chặn | F07-AC-02 | Planned |
| F07-TC-03 | Kiểm chứng: duyệt minh chứng không tự ghi officialScore | F07-AC-03 | Planned |
| F07-TC-04 | Kiểm chứng: thay đổi kết luận minh chứng làm mất hiệu lực điểm tiêu chí cũ | F07-AC-04 | Planned |
| F07-TC-05 | Kiểm chứng dữ liệu và quyền chốt trên ba đường chốt trong workflow mới | F07-AC-05; BL-028 | Phân quyền và khóa trạng thái đã đạt HTTP/PostgreSQL, có đối chiếu DB trước/sau khi từ chối. |
| F07-TC-06 | Kiểm chứng: yêu cầu bổ sung hiển thị đúng missingItem và deadline lưu trong DB | F07-AC-06 | Planned |
| F07-TC-07 | BL-004: leadershipRole gửi boolean hợp lệ, giao diện hiển thị Có/Không, backend nhận boolean và tính đúng điểm tiêu chí 14/16 | BL-004; F07-AC-05 | Verified in `scoring-and-validation.test.cjs` |
| F07-TC-08 | BL-017: Dữ liệu xác minh counter âm/thập phân/chuỗi rác, boolean sai kiểu bị chặn bởi validateVerifiedData trước transaction DB | BL-017; F07-AC-05 | Verified in `scoring-and-validation.test.cjs` |
| F07-TC-09 | BL-005: Bộ tổng hợp nguồn hoạt động chung `aggregateStudentActivitySources` gộp theo `activityId`, ưu tiên `Attendance` `CONFIRMED`, phát hiện mâu thuẫn vai trò, tự động vô hiệu hóa `officialScore` khi căn cứ hoạt động thay đổi | BL-005; F07-AC-04; DEC-008 | Verified in `activity-and-roles-scoring.test.cjs` |
| F07-TC-10 | BL-023: Giao diện SupplementEvidence hiển thị đúng missingItem và deadline hiệu lực từ API, xử lý đúng fallback và submit bổ sung minh chứng | BL-023; F07-AC-06 | Verified in `evidence-and-term-selection.test.cjs` |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Chấm lớp qua route /class hiện bị từ chối; AI không có quyền chốt điểm.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

