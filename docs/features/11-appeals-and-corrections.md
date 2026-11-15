# F11 — Phúc khảo và hiệu chỉnh công bố

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STUDENT gửi; STAFF giải quyết; ADMIN điều phối hiệu chỉnh |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-21](../BUSINESS_RULES.md#r-21), [R-22](../BUSINESS_RULES.md#r-22) |

Nguồn: [appeals/appeals.service.ts](../../apps/backend/src/appeals/appeals.service.ts), [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-006](../BUSINESS_LOGIC_AUDIT.md#bl-006). Theo dõi trong [backlog](../BACKLOG.md); chưa áp dụng bản sửa.

## 1. Objective — Mục tiêu

Giải quyết phản hồi theo kết quả công bố và lưu phiên bản hiệu chỉnh. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Sinh viên gửi đơn trong hạn có hiệu lực; Khoa chấp nhận/từ chối kèm lý do; CTSV yêu cầu hiệu chỉnh khi cần công bố lại.

Luồng: Appeals / AppealsResolution / ResultsReception → AppealsController, WorkflowController → AppealsService.resolve / WorkflowService correction → Appeal, PublicationCorrectionRequest, AssessmentHandoff, AssessmentPublication.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F11-AC-01:** Đơn thuộc chủ sở hữu/kỳ và kết quả có thể phúc khảo.
- **F11-AC-02:** Hạn phúc khảo dùng gia hạn sinh viên/lớp.
- **F11-AC-03:** Chỉ Khoa có phạm vi giải quyết; decorator ADMIN không đồng nghĩa service cho phép.
- **F11-AC-04:** Chấp nhận mở lại phần cần xử lý, làm mất hiệu lực điểm cũ theo service.
- **F11-AC-05:** Hiệu chỉnh giữ sourcePublication và tạo revision mới khi gửi/công bố lại.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Phúc khảo là menu riêng; tab đơn liên quan chỉ tải khi mở, đọc đủ các trang trong Khoa/kỳ rồi lọc sinh viên.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET/POST /appeals`
- `POST /appeals/:id/resolve`
- `GET /evaluation-workflow/:termId/corrections`
- `POST /evaluation-workflow/:termId/students/:studentId/correction` — body có reason; ADMIN yêu cầu hiệu chỉnh sau công bố.

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Đơn lặp cùng revision.
- Kỳ CLOSED.
- Đơn gắn minh chứng khác chủ/kỳ.
- Hai cán bộ giải quyết cùng đơn.
- Gia hạn đã thu hồi.

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
| F11-TC-01 | Kiểm chứng: đơn thuộc chủ sở hữu/kỳ và kết quả có thể phúc khảo | F11-AC-01 | Planned |
| F11-TC-02 | Kiểm chứng: hạn phúc khảo dùng gia hạn sinh viên/lớp | F11-AC-02 | Planned |
| F11-TC-03 | Kiểm chứng: chỉ Khoa có phạm vi giải quyết; decorator ADMIN không đồng nghĩa service cho phép | F11-AC-03 | Planned |
| F11-TC-04 | Kiểm chứng: chấp nhận mở lại phần cần xử lý, làm mất hiệu lực điểm cũ theo service | F11-AC-04 | Planned |
| F11-TC-05 | Kiểm chứng: hiệu chỉnh giữ sourcePublication và tạo revision mới khi gửi/công bố lại | F11-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Số lần phúc khảo và phạm vi mở lại chưa có quyết định bổ sung; xem Q-07.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

