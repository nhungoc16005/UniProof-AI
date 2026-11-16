# F09 — Thẩm định và bàn giao Khoa

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STAFF gửi; ADMIN tiếp nhận/trả |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-05](../BUSINESS_RULES.md#r-05), [R-17](../BUSINESS_RULES.md#r-17), [R-18](../BUSINESS_RULES.md#r-18) |

Nguồn: [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts), [evaluation-workflow/evaluation-policy.ts](../../apps/backend/src/evaluation-workflow/evaluation-policy.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-001](../BUSINESS_LOGIC_AUDIT.md#bl-001) (Resolved), [BL-021](../BUSINESS_LOGIC_AUDIT.md#bl-021) (Resolved). Đã xử lý BL-001 trong security-fixes.test.cjs và BL-021 chu trình loại trừ/khôi phục/loại trừ lại chống trùng dedupeKey trong exclusion-and-restore.test.cjs; các gap còn lại theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Bàn giao snapshot đầy đủ cho CTSV, khóa kết quả đã gửi và giữ lịch sử phiên bản. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Khoa xem danh sách theo lớp, giải quyết blockers, gửi 1–100 phiếu; CTSV trả phiếu có lý do để Khoa xử lý lại.

Luồng: EvaluationsByClass / EvaluationBoard / StudentAssessment → WorkflowController → WorkflowService.list/snapshot/send/return → khóa Term trong transaction → AssessmentHandoff, CriterionAssessment, Evidence, Appeal, AuditLog.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F09-AC-01:** Roster lớp/Khoa lấy snapshot của kỳ.
- **F09-AC-02:** Gửi cần SUBMITTED, đủ tiêu chí FINALIZED, ghi chú và không còn minh chứng/phúc khảo chưa xử lý.
- **F09-AC-03:** Gửi tạo snapshot và revision, lặp lại không nhân bản phiếu đã gửi.
- **F09-AC-04:** SENT bị khóa sửa; trả Khoa lưu lý do/lịch sử.
- **F09-AC-05:** EXCLUDED/restore có lý do, không được coi là điểm 0 đã chấm.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Theo lớp có 4 KPI hành động, bảng lớp compact và panel; hàng đợi, chi tiết, returnTo và bộ lọc giữ ngữ cảnh kỳ.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /evaluation-workflow/:termId, /evaluation-workflow/:termId/export, /evaluation-workflow/:termId/students/:studentId/history`
- `POST /evaluation-workflow/:termId/send, /evaluation-workflow/:termId/students/:studentId/return, /evaluation-workflow/:termId/students/:studentId/not-submitted, /evaluation-workflow/:termId/students/:studentId/exclude, /evaluation-workflow/:termId/students/:studentId/restore`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Gửi hai lần.
- Một phiếu trong batch bị chặn.
- Sinh viên chuyển lớp/Khoa.
- Exclude→restore→exclude.
- Minh chứng còn INVALID/NEEDS_SUPPLEMENT.

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
| F09-TC-01 | Kiểm chứng: roster lớp/Khoa lấy snapshot của kỳ | F09-AC-01 | Planned |
| F09-TC-02 | Kiểm chứng: gửi cần SUBMITTED, đủ tiêu chí FINALIZED, ghi chú và không còn minh chứng/phúc khảo chưa xử lý | F09-AC-02 | Planned |
| F09-TC-03 | Kiểm chứng: gửi tạo snapshot và revision, lặp lại không nhân bản phiếu đã gửi | F09-AC-03 | Planned |
| F09-TC-04 | Kiểm chứng: sENT bị khóa sửa; trả Khoa lưu lý do/lịch sử | F09-AC-04 | Planned |
| F09-TC-05 | Kiểm chứng: eXCLUDED/restore có lý do, không được coi là điểm 0 đã chấm | F09-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Không tự suy luận sinh viên EXCLUDED là đã bàn giao hoặc đã được chấm.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

