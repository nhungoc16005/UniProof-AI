# F08 — Hoạt động và điểm danh

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STAFF theo Khoa; ADMIN theo quyền controller/service |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-03](../BUSINESS_RULES.md#r-03), [R-16](../BUSINESS_RULES.md#r-16) |

Nguồn: [activities/activities.service.ts](../../apps/backend/src/activities/activities.service.ts), [activities/dto/activity.dto.ts](../../apps/backend/src/activities/dto/activity.dto.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-005](../BUSINESS_LOGIC_AUDIT.md#bl-005), [BL-014](../BUSINESS_LOGIC_AUDIT.md#bl-014). Theo dõi trong [backlog](../BACKLOG.md); chưa áp dụng bản sửa.

## 1. Objective — Mục tiêu

Ghi nhận tham gia có vòng đời và cập nhật dữ liệu chấm điểm từ danh sách đã xác nhận. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Cán bộ tạo hoạt động, nhập danh sách tham gia, xác nhận hoặc thu hồi điểm danh có lý do.

Luồng: InternalActivities → ActivitiesController → ActivitiesService.mutate/recomputeActivityCriterion → workflow.lock → Activity, ActivityParticipant, CriterionAssessment, AuditLog.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F08-AC-01:** Hoạt động có kỳ/tiêu chí, ngày bắt đầu và khoảng thời gian hợp lệ.
- **F08-AC-02:** Danh sách DRAFT chưa được tính như CONFIRMED.
- **F08-AC-03:** Xác nhận/thu hồi cập nhật gợi ý và xóa officialScore cũ.
- **F08-AC-04:** Không sửa phiếu đã bàn giao hoặc kỳ đã khóa.
- **F08-AC-05:** Người tham gia phải đúng roster/phạm vi được xử lý.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Hoạt động & điểm danh dùng bảng trạng thái DRAFT/CONFIRMED/REVOKED, nhập batch và phản hồi từng lỗi.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET/POST /activities`
- `GET/PATCH/DELETE /activities/:id`
- `GET/POST /activities/:id/attendance`
- `POST /activities/:id/attendance/batch, /activities/:id/attendance/confirm`
- `DELETE /activities/:id/attendance/:participantId`
- `POST /activities/:id/attendance/:participantId/revoke`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Cùng sinh viên xuất hiện hai lần.
- Thu hồi sau chốt điểm.
- Hoạt động có cả minh chứng và roster.
- Vai trò ORGANIZER/CHEERLEADER.
- Không có rolesScore cho điểm quy đổi.

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
| F08-TC-01 | Kiểm chứng: hoạt động có kỳ/tiêu chí, ngày bắt đầu và khoảng thời gian hợp lệ | F08-AC-01 | Planned |
| F08-TC-02 | Kiểm chứng: danh sách DRAFT chưa được tính như CONFIRMED | F08-AC-02 | Planned |
| F08-TC-03 | Kiểm chứng: xác nhận/thu hồi cập nhật gợi ý và xóa officialScore cũ | F08-AC-03 | Planned |
| F08-TC-04 | Kiểm chứng: không sửa phiếu đã bàn giao hoặc kỳ đã khóa | F08-AC-04 | Planned |
| F08-TC-05 | Kiểm chứng: người tham gia phải đúng roster/phạm vi được xử lý | F08-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Cơ chế chống đếm trùng giữa nhiều nguồn cần xác nhận Q-01/Q-02 trước khi sửa.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

