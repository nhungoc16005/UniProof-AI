# F10 — Công bố và chốt kỳ

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | ADMIN; STAFF/STUDENT xem theo quyền |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-19](../BUSINESS_RULES.md#r-19), [R-20](../BUSINESS_RULES.md#r-20) |

Nguồn: [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts), [criteria/criteria.service.ts](../../apps/backend/src/criteria/criteria.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-006](../BUSINESS_LOGIC_AUDIT.md#bl-006). Theo dõi trong [backlog](../BACKLOG.md); chưa áp dụng bản sửa.

## 1. Objective — Mục tiêu

Công bố snapshot có phiên bản và chốt khi hoàn tất xử lý cùng cửa sổ phúc khảo. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

CTSV xem blockers, công bố kết quả, xử lý tồn đọng rồi chốt kỳ; người dùng xem đúng bản đã công bố.

Luồng: ResultsReception / TermsMasterData → WorkflowController.conditions/publish/close → WorkflowService + transaction khóa Term → AssessmentPublication, AssessmentHandoff, Term, AuditLog, Notification.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F10-AC-01:** Công bố chỉ khi đủ bàn giao/ghi nhận không nộp và không còn phúc khảo chờ.
- **F10-AC-02:** Publication chụp snapshot theo revision, không sửa đè lịch sử.
- **F10-AC-03:** Công bố chuyển kỳ REVIEWING.
- **F10-AC-04:** Chốt chỉ khi đủ publication mới nhất, hết thời gian phúc khảo có hiệu lực và không còn blockers.
- **F10-AC-05:** CLOSED chỉ xem, reopen hiện không khả dụng.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Tiếp nhận & Công bố có blockers mở rộng; nút chốt dựa trên conditions nhưng server luôn kiểm tra lại.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

Thông báo công bố dẫn sinh viên đến phiếu đúng kỳ để xem hạn phúc khảo hiệu lực. Hạn lấy từ nguồn cá nhân, lớp snapshot hoặc hạn kỳ theo resolver hiện hành.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /evaluation-workflow/:termId/conditions`
- `POST /evaluation-workflow/:termId/publish, /evaluation-workflow/:termId/close`
- `POST /terms/:id/close, /terms/:id/reopen`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Gia hạn APPEAL vượt hạn chung.
- Một revision chưa công bố.
- Publication correction đang mở.
- Công bố lặp.
- Kỳ lịch sử workflowEnabled=false.

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
| F10-TC-01 | Kiểm chứng: công bố chỉ khi đủ bàn giao/ghi nhận không nộp và không còn phúc khảo chờ | F10-AC-01 | Planned |
| F10-TC-02 | Kiểm chứng: publication chụp snapshot theo revision, không sửa đè lịch sử | F10-AC-02 | Planned |
| F10-TC-03 | Kiểm chứng: công bố chuyển kỳ REVIEWING | F10-AC-03 | Planned |
| F10-TC-04 | Kiểm chứng: chốt chỉ khi đủ publication mới nhất, hết thời gian phúc khảo có hiệu lực và không còn blockers | F10-AC-04 | Planned |
| F10-TC-05 | Kiểm chứng: cLOSED chỉ xem, reopen hiện không khả dụng | F10-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Tự mở lại CLOSED hoặc cập nhật trực tiếp publication cũ.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

