# F13 — Thông báo và liên kết nghiệp vụ

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | Người dùng đã đăng nhập |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-25](../BUSINESS_RULES.md#r-25) |

Nguồn: [notifications/notifications.service.ts](../../apps/backend/src/notifications/notifications.service.ts), [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-021](../BUSINESS_LOGIC_AUDIT.md#bl-021). Theo dõi trong [backlog](../BACKLOG.md); chưa áp dụng bản sửa.

## 1. Objective — Mục tiêu

Thông báo đúng người, chống lặp cùng sự kiện và mở đúng màn hình liên quan. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Người dùng xem thông báo, số chưa đọc, mở hồ sơ/kỳ liên quan và đánh dấu đã đọc.

Luồng: NotificationsCenter / AppLayout → NotificationsController → NotificationsService → Notification; các service nghiệp vụ tạo notification trong transaction.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F13-AC-01:** Chỉ chủ thông báo được đọc/đánh dấu.
- **F13-AC-02:** Danh sách hiện lấy 50 thông báo gần nhất cùng unreadCount.
- **F13-AC-03:** Đánh dấu một/tất cả không đổi thông báo của người khác.
- **F13-AC-04:** dedupeKey không được chặn một sự kiện nghiệp vụ mới hợp lệ.
- **F13-AC-05:** targetPath/metadata giữ được ngữ cảnh kỳ và thực thể.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Badge chưa đọc, danh sách rỗng, tải/lỗi/retry; click giữ đường dẫn thực thể.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /notifications`
- `PATCH /notifications/:id/read, /notifications/read-all`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Notification cũ hơn 50.
- Lặp request.
- Exclude→restore→exclude cùng revision.
- Thực thể đích đã bị khóa/xóa.

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
| F13-TC-01 | Kiểm chứng: chỉ chủ thông báo được đọc/đánh dấu | F13-AC-01 | Planned |
| F13-TC-02 | Kiểm chứng: danh sách hiện lấy 50 thông báo gần nhất cùng unreadCount | F13-AC-02 | Planned |
| F13-TC-03 | Kiểm chứng: đánh dấu một/tất cả không đổi thông báo của người khác | F13-AC-03 | Planned |
| F13-TC-04 | Kiểm chứng: dedupeKey không được chặn một sự kiện nghiệp vụ mới hợp lệ | F13-AC-04 | Planned |
| F13-TC-05 | Kiểm chứng: targetPath/metadata giữ được ngữ cảnh kỳ và thực thể | F13-AC-05 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Push realtime, email hoặc thông báo mobile chưa được chứng minh triển khai.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

