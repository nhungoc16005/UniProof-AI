# F02 — Dữ liệu đơn vị và quy chế

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | ADMIN; STAFF/STUDENT xem dữ liệu được mở |
| Trạng thái | Có implementation; chưa nghiệm thu runtime trong đợt tài liệu |
| Quy tắc liên quan | [R-03](../BUSINESS_RULES.md#r-03), [R-04](../BUSINESS_RULES.md#r-04) |

Nguồn: [criteria/criteria.service.ts](../../apps/backend/src/criteria/criteria.service.ts), [criteria/criteria.controller.ts](../../apps/backend/src/criteria/criteria.controller.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).


## 1. Objective — Mục tiêu

Quản lý Khoa, lớp và văn bản làm căn cứ cho đánh giá. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Admin duy trì đơn vị và văn bản; người dùng tra cứu quy chế đang áp dụng và lịch sử.

Luồng: TermsMasterData / UserManagement / KnowledgeBase → CriteriaController → CriteriaService → Faculty, Class, RegulationDocument, Criterion, AuditLog.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F02-AC-01:** Mã đơn vị không trùng và quan hệ lớp–Khoa hợp lệ.
- **F02-AC-02:** Không xóa đơn vị/văn bản đang bị ràng buộc.
- **F02-AC-03:** Văn bản chuyển ACTIVE/EXPIRED giữ lịch sử và liên kết tiêu chí.
- **F02-AC-04:** Thay đổi đơn vị không được diễn giải là tự cập nhật snapshot kỳ cũ.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Quản lý tài khoản & đơn vị và tab Văn bản quy chế; xác nhận thao tác xóa, hiển thị lý do bị chặn.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET/POST /faculties, /classes, /regulations`
- `PATCH /faculties/:id, /classes/:id, /regulations/:id/status`
- `DELETE /faculties/:id, /classes/:id, /regulations/:id`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Đổi Khoa của lớp đã có lịch sử.
- Văn bản hết hiệu lực vẫn được phiếu cũ tham chiếu.
- Xóa dữ liệu đang dùng.
- Mã trùng khác khoảng trắng.

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
| F02-TC-01 | Kiểm chứng: mã đơn vị không trùng và quan hệ lớp–Khoa hợp lệ | F02-AC-01 | Planned |
| F02-TC-02 | Kiểm chứng: không xóa đơn vị/văn bản đang bị ràng buộc | F02-AC-02 | Planned |
| F02-TC-03 | Kiểm chứng: văn bản chuyển ACTIVE/EXPIRED giữ lịch sử và liên kết tiêu chí | F02-AC-03 | Planned |
| F02-TC-04 | Kiểm chứng: thay đổi đơn vị không được diễn giải là tự cập nhật snapshot kỳ cũ | F02-AC-04 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

RAG hội thoại, embedding và đồng bộ văn bản tự động chưa được chứng minh chạy end to end.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

