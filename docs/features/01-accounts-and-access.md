# F01 — Tài khoản và phân quyền

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STUDENT, STAFF, ADMIN |
| Trạng thái | Đã có implementation; còn gap trong audit, chưa nghiệm thu toàn bộ |
| Quy tắc liên quan | [R-01](../BUSINESS_RULES.md#r-01), [R-02](../BUSINESS_RULES.md#r-02), [R-03](../BUSINESS_RULES.md#r-03) |

Nguồn: [auth/auth.service.ts](../../apps/backend/src/auth/auth.service.ts), [auth/jwt.strategy.ts](../../apps/backend/src/auth/jwt.strategy.ts), [users/users.service.ts](../../apps/backend/src/users/users.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-001](../BUSINESS_LOGIC_AUDIT.md#bl-001) (Resolved), [BL-002](../BUSINESS_LOGIC_AUDIT.md#bl-002) (Resolved), [BL-009](../BUSINESS_LOGIC_AUDIT.md#bl-009) (Resolved), [BL-011](../BUSINESS_LOGIC_AUDIT.md#bl-011) (Resolved), [BL-012](../BUSINESS_LOGIC_AUDIT.md#bl-012) (Resolved), [BL-016](../BUSINESS_LOGIC_AUDIT.md#bl-016) (Resolved), [BL-025](../BUSINESS_LOGIC_AUDIT.md#bl-025) (Resolved). Đã xử lý và kiểm chứng qua security-fixes.test.cjs và accounts-and-permissions.test.cjs; các gap còn lại theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Đăng nhập, đổi mật khẩu và quản trị tài khoản theo vai trò, trạng thái và đơn vị phụ trách. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Người dùng đăng nhập đúng tài khoản và đổi mật khẩu lần đầu; Admin tạo, nhập, khóa, đặt lại mật khẩu; Khoa chỉ xem sinh viên thuộc phạm vi.

Luồng: Login / Account / UserManagement → apiClient → AuthController, UsersController → AuthService, UsersService, JwtStrategy → User, Class, Faculty, AuditLog.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F01-AC-01:** Đăng nhập sai hoặc tài khoản khóa bị từ chối.
- **F01-AC-02:** JWT kiểm tra lại isActive, authVersion và phân công từ DB.
- **F01-AC-03:** Phản hồi không chứa password/hash.
- **F01-AC-04:** Tạo/import/reset phải có cách bàn giao mật khẩu tạm và ghi nhận đổi mật khẩu đầu tiên.
- **F01-AC-05:** Danh sách và chỉnh sửa tài khoản giữ đúng classId/facultyId.
- **F01-AC-06:** Yêu cầu sửa hồ sơ của người dùng được Admin tìm thấy đầy đủ qua phân trang, phản hồi có lý do; RESOLVED không tự đổi dữ liệu User.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Login, Account, UserManagement; lỗi nhập liệu tại trường, giữ bộ lọc khi quay lại danh sách.

Người dùng báo sai thông tin hồ sơ qua Account; Admin xem ProfileDataIssues và phản hồi RESOLVED/REJECTED có lý do. Resolve issue lưu phản hồi và gửi thông báo, không tự cập nhật User; việc sửa User là thao tác quản trị riêng. Gap phân trang: [BL-018](../BUSINESS_LOGIC_AUDIT.md#bl-018).

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password, /auth/logout, /auth/forgot-password`
- `GET/POST /users`
- `POST /users/import, /users/:id/reset-password`
- `PATCH/DELETE /users/:id`
- `POST /profile-data-issues; GET /profile-data-issues/mine` — báo lỗi và xem yêu cầu của mình.
- `GET /profile-data-issues; PATCH /profile-data-issues/:id/resolve` — ADMIN xem/xử lý yêu cầu.

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Token cũ sau logout/reset.
- Tài khoản chưa phân công Khoa/lớp.
- Import trùng email/MSSV.
- Tài khoản tự khóa/xóa.
- Mật khẩu tạm không đến người dùng.

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
| F01-TC-01 | Kiểm chứng: đăng nhập sai hoặc tài khoản khóa bị từ chối | F01-AC-01 | Planned |
| F01-TC-02 | Kiểm chứng: JWT kiểm tra lại isActive, authVersion và phân công từ DB | F01-AC-02 | Planned |
| F01-TC-03 | Kiểm chứng: phản hồi không chứa password/hash | F01-AC-03; BL-002 | Passed (unit in security-fixes.test.cjs) |
| F01-TC-04 | Kiểm chứng: tạo/import/reset phải có cách bàn giao mật khẩu tạm và ghi nhận đổi mật khẩu đầu tiên | F01-AC-04 | Planned |
| F01-TC-05 | Kiểm chứng: danh sách và chỉnh sửa tài khoản giữ đúng classId/facultyId | F01-AC-05 | Planned |
| F01-TC-06 | Given 26 yêu cầu OPEN, When Admin mở trang 2 và phản hồi yêu cầu cuối, Then lưu resolution/notification đúng người và User không bị tự sửa | F01-AC-06; BL-018 | Planned |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

SSO, email reset tự động và tài khoản mobile chưa có luồng hoàn chỉnh.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

