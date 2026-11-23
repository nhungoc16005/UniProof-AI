# F14 — Nhật ký, giám sát và xử lý AI

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | ADMIN giám sát; STAFF đọc lịch sử có phạm vi |
| Trạng thái | Đã có implementation; BL-008 và BL-022 đã được xử lý và kiểm chứng regression theo DEC-014 |
| Quy tắc liên quan | [R-26](../BUSINESS_RULES.md#r-26), [R-27](../BUSINESS_RULES.md#r-27), [R-28](../BUSINESS_RULES.md#r-28) |

Nguồn: [evidence/evidence-processing.worker.ts](../../apps/backend/src/evidence/evidence-processing.worker.ts), [audit-log/audit-log.service.ts](../../apps/backend/src/audit-log/audit-log.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts). Tài liệu kiến trúc 6 tầng AI & quy trình huấn luyện model A-Z: [AI_TRAINING_AND_ARCHITECTURE_GUIDE.md](../AI_TRAINING_AND_ARCHITECTURE_GUIDE.md).

Gap: [BL-008](../BUSINESS_LOGIC_AUDIT.md#bl-008) (Resolved), [BL-022](../BUSINESS_LOGIC_AUDIT.md#bl-022) (Resolved). Theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Truy vết thay đổi và xử lý AI có lease, retry, kiểm tra version. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Admin xem nhật ký/job lỗi và retry khi hợp lệ; Khoa xem lịch sử phiếu; worker chỉ lưu gợi ý còn hiệu lực.

Luồng: Monitoring / AiJobs / AuditLogs → AuditLogController, AiJobsController → service → AuditLog, AiProcessingJob, AiPipelineRun, AiPipelineStep; EvidenceProcessingWorker → pipeline /evidence/process → acceptResult → AiSuggestion.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F14-AC-01:** Audit lưu actor, hành động, entity và giá trị phục vụ truy vết.
- **F14-AC-02:** Job được claim, ghi lease/attempt và xử lý recovery theo code.
- **F14-AC-03:** Kết quả AI muộn/khác version không ghi đè quyết định cán bộ.
- **F14-AC-04:** AI chỉ gợi ý trong rubric với điểm/confidence hợp lệ, không chốt officialScore.
- **F14-AC-05:** Timeout phải bao trùm đọc response và không để poller kẹt.
- **F14-AC-06:** Retry job theo điều kiện trạng thái và ghi audit.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Giám sát & Nhật ký có tìm kiếm/phân trang backend, job có lỗi/attempt và thao tác retry hợp lệ.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /audit-logs, /health, /ai-jobs`
- `POST /ai-jobs/:id/retry`
- `GET /evaluation-workflow/:termId/students/:studentId/history`
- `pipeline ngoài hệ thống POST /evidence/process`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Mất worker sau claim.
- Response headers đến, body treo.
- AI trả tiêu chí ngoài rubric.
- Nguồn xác minh thêm khi đang PROCESSING.
- Pipeline thiếu cấu hình.

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
| F14-TC-01 | Kiểm chứng: audit lưu actor, hành động, entity và giá trị phục vụ truy vết | F14-AC-01 | Planned |
| F14-TC-02 | Kiểm chứng: job được claim, ghi lease/attempt và xử lý recovery theo code | F14-AC-02 | Planned |
| F14-TC-03 | Kiểm chứng: kết quả AI muộn/khác version không ghi đè quyết định cán bộ | F14-AC-03 | Planned |
| F14-TC-04 | Kiểm chứng: aI chỉ gợi ý trong rubric với điểm/confidence hợp lệ, không chốt officialScore | F14-AC-04 | Planned |
| F14-TC-05 | Kiểm chứng: timeout phải bao trùm đọc response và không để poller kẹt | F14-AC-05 | Planned |
| F14-TC-06 | Kiểm chứng: retry job theo điều kiện trạng thái và ghi audit | F14-AC-06 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Không khởi động backend để kiểm tra tài liệu: worker có thể ghi DB và gọi AI; Python/queue scaffold không được coi là pipeline đã chạy.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

