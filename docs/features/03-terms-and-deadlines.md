# F03 — Kỳ đánh giá và gia hạn

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | ADMIN; STAFF/STUDENT đọc kỳ và hạn có hiệu lực |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-05](../BUSINESS_RULES.md#r-05), [R-06](../BUSINESS_RULES.md#r-06), [R-07](../BUSINESS_RULES.md#r-07) |

Nguồn: [criteria/criteria.service.ts](../../apps/backend/src/criteria/criteria.service.ts), [deadline-extensions/deadline-extensions.service.ts](../../apps/backend/src/deadline-extensions/deadline-extensions.service.ts), [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: Đã giải quyết [BL-006](../BUSINESS_LOGIC_AUDIT.md#bl-006), [BL-010](../BUSINESS_LOGIC_AUDIT.md#bl-010), [BL-020](../BUSINESS_LOGIC_AUDIT.md#bl-020) tại Đợt 3. Đã có 16/16 test cô lập đạt trong [deadline-and-closure.test.cjs](../../apps/backend/test/deadline-and-closure.test.cjs).

## 1. Objective — Mục tiêu

Thiết lập vòng đời kỳ, danh sách sinh viên của kỳ và gia hạn có căn cứ. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Admin cấu hình ngày, áp dụng rubric hiện hành và kích hoạt kỳ; gia hạn cho sinh viên/lớp và thu hồi gia hạn khi cần. Kỳ mới giữ nguyên rubric nếu không có thay đổi thực sự, theo DEC-006 trong [DECISIONS](../DECISIONS.md).

Luồng: TermsMasterData / DeadlineExtensionsDialog → CriteriaController, DeadlineExtensionsController → CriteriaService, WorkflowService.initialize, DeadlineExtensionsService → Term, AssessmentHandoff, AssessmentDeadlineExtension.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F03-AC-01:** Ngày bắt đầu ≤ ngày kết thúc, và ngày bắt đầu ≤ hạn nộp ≤ hạn chấm ≤ hạn phúc khảo; code hiện không ràng buộc hạn phúc khảo ≤ ngày kết thúc.
- **F03-AC-02:** Kích hoạt cần rubric PUBLISHED và tạo snapshot sinh viên đang hoạt động, có lớp.
- **F03-AC-03:** Gia hạn lưu đối tượng, loại hạn, thời điểm và lý do; thu hồi giữ dấu vết.
- **F03-AC-04:** Quyền sửa/nộp/phúc khảo phải dùng hạn có hiệu lực.
- **F03-AC-05:** CLOSED chỉ xem; endpoint reopen hiện luôn từ chối.
- **F03-AC-06:** Mở kỳ mới không tự phát sinh yêu cầu thay nội dung rubric; dùng tiếp rubric hiện hành khi không có thay đổi, đồng thời giữ được lịch sử rubric áp dụng cho từng kỳ.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Tab Kỳ đánh giá có ba hạn riêng; dialog gia hạn cần tìm được đầy đủ sinh viên thuộc kỳ.

Code hiện yêu cầu sao chép và ban hành bản nháp theo từng kỳ. Theo DEC-006, cần đối chiếu thao tác này với luồng dùng lại rubric hiện hành; không trình bày đổi kỳ như bắt buộc đổi nội dung tiêu chí. Theo dõi REQ-002 trong BACKLOG.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET/POST /terms`
- `PATCH /terms/:id`
- `POST /terms/:id/activate, /terms/:id/close, /terms/:id/reopen`
- `GET/POST /deadline-extensions`
- `GET /deadline-extensions/targets` (lọc đối tượng theo Roster kỳ `termId`, `targetType`, `q`, `page`, `pageSize`)
- `DELETE /deadline-extensions/:id`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Hết hạn đúng thời điểm.
- Gia hạn cá nhân và lớp cùng tồn tại.
- Sinh viên mới sau kích hoạt.
- Gia hạn còn hiệu lực lúc chốt kỳ.
- Trang chọn sinh viên vượt 100 dòng.

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
| F03-TC-01 | Kiểm chứng hai chuỗi ngày: start ≤ end và start ≤ submission ≤ review ≤ appeal; không tự thêm điều kiện appeal ≤ end | F03-AC-01 | Planned |
| F03-TC-02 | Kiểm chứng: kích hoạt cần rubric PUBLISHED và tạo snapshot sinh viên đang hoạt động, có lớp | F03-AC-02 | Planned |
| F03-TC-03 | Kiểm chứng: gia hạn lưu đối tượng, loại hạn, thời điểm và lý do; thu hồi giữ dấu vết; lọc đối tượng theo Roster kỳ (BL-020) | F03-AC-03; BL-020 | Partially verified (Unit/Component: BL-020 & revoke lock đạt 2 ca dialog thật gồm chuyển trang qua nút bấm đến trang 6 và chọn SV 105, 4 ca backend targets/DTO/100+ roster; chưa kiểm chứng DB/E2E tích hợp) |
| F03-TC-04 | Kiểm chứng: quyền sửa/nộp/phúc khảo dùng hạn hiệu lực, web không bị hạn gốc phủ định quyền gia hạn (BL-010); chốt kỳ bị chặn khi còn gia hạn phúc khảo hiệu lực (BL-006) | F03-AC-04; BL-006; BL-010 | Partially verified (Unit/Hook: BL-006 đạt 12 ca backend gồm 3 ca lock concurrency có barrier 2 chiều, BL-010 đạt 4 ca hook thật gồm RETURNED/hết hạn khi pending refresh/lỗi 500; chưa kiểm chứng DB/E2E tích hợp) |
| F03-TC-05 | Kiểm chứng: CLOSED chỉ xem; endpoint reopen hiện luôn từ chối | F03-AC-05 | Planned |
| F03-TC-06 | Given rubric hiện hành không đổi, When tạo kỳ kế tiếp, Then vẫn áp dụng nguyên rubric và truy vết được lịch sử theo kỳ | F03-AC-06; DEC-006; REQ-002 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Tự mở lại kỳ CLOSED và tự đưa sinh viên mới vào roster chưa được hỗ trợ.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

