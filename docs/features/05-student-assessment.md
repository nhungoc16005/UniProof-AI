# F05 — Tự đánh giá của sinh viên

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STUDENT; STAFF trả phiếu và xem |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-07](../BUSINESS_RULES.md#r-07), [R-11](../BUSINESS_RULES.md#r-11), [R-12](../BUSINESS_RULES.md#r-12) |

Nguồn: [assessments/assessments.service.ts](../../apps/backend/src/assessments/assessments.service.ts), [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-010](../BUSINESS_LOGIC_AUDIT.md#bl-010), [BL-013](../BUSINESS_LOGIC_AUDIT.md#bl-013), [BL-024](../BUSINESS_LOGIC_AUDIT.md#bl-024), [BL-027](../BUSINESS_LOGIC_AUDIT.md#bl-027). Theo dõi trong [backlog](../BACKLOG.md); chưa áp dụng bản sửa.

## 1. Objective — Mục tiêu

Cho sinh viên lưu nháp, kiểm tra đủ dữ liệu và nộp phiếu đúng kỳ. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Sinh viên nhập điểm tự đánh giá theo rubric, gắn minh chứng vào từng tiêu chí, xem blockers và nộp; phiếu RETURNED được sửa/nộp lại trong cửa sổ cho phép.

Luồng: ScoreReport / useStudentAssessmentAccess → AssessmentsController → AssessmentsService.preflight, submitSelfAssessment → WorkflowService.studentEdit → CriterionAssessment, AssessmentSubmission, Evidence, AiProcessingJob.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F05-AC-01:** Chỉ chủ sở hữu thuộc roster được sửa trong cửa sổ hiệu lực.
- **F05-AC-02:** Điểm tự đánh giá hợp lệ theo trần tiêu chí.
- **F05-AC-03:** Preflight báo tiêu chí/tệp còn thiếu trước nộp.
- **F05-AC-04:** Nộp thành công đổi phiếu SUBMITTED, chuyển minh chứng nháp sang xử lý và tạo job.
- **F05-AC-05:** Phiếu SUBMITTED khóa sửa; RETURNED có thể nộp lại đến hạn chấm phù hợp.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Màn /student/scores là điểm vào chính; hiển thị tiến độ, lý do khóa, lỗi từng tiêu chí, trạng thái đang lưu/nộp và kết quả.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /assessments/me`
- `GET /assessments/me/preflight`
- `PUT /assessments/me/:criterionId`
- `POST /assessments/me/save, /assessments/me/submit`
- `PUT /assessments/students/:studentId/:termId/return`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Hai tab lưu và nộp đồng thời.
- Minh chứng không có tệp.
- Phiếu được trả sau hạn nộp.
- Đổi kỳ trên mobile/URL.
- Nháp liên kết qua criterionAssessmentId.

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
| F05-TC-01 | Kiểm chứng: chỉ chủ sở hữu thuộc roster được sửa trong cửa sổ hiệu lực | F05-AC-01 | Planned |
| F05-TC-02 | Kiểm chứng: điểm tự đánh giá hợp lệ theo trần tiêu chí | F05-AC-02 | Planned |
| F05-TC-03 | Kiểm chứng: preflight báo tiêu chí/tệp còn thiếu trước nộp | F05-AC-03 | Planned |
| F05-TC-04 | Kiểm chứng: nộp thành công đổi phiếu SUBMITTED, chuyển minh chứng nháp sang xử lý và tạo job | F05-AC-04 | Planned |
| F05-TC-05 | Kiểm chứng: phiếu SUBMITTED khóa sửa; RETURNED có thể nộp lại đến hạn chấm phù hợp | F05-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Tự động nộp thay sinh viên hoặc coi compile thành công là đạt nghiệp vụ.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

