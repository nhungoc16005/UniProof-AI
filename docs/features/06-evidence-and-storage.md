# F06 — Minh chứng và lưu trữ tệp

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.1 / 2026-11-15, đã sửa BL-007 và bổ sung đối chứng race condition BL-026 |
| Vai trò | STUDENT sở hữu; STAFF theo Khoa; ADMIN xem |
| Trạng thái | Đã sửa BL-007 (Đợt 1), BL-015 (Đợt 5), BL-019 (Đợt 9); đối chứng kịch bản BL-026 đạt qua application lock, chờ test DB đa kết nối |
| Quy tắc liên quan | [R-12](../BUSINESS_RULES.md#r-12), [R-13](../BUSINESS_RULES.md#r-13), [R-14](../BUSINESS_RULES.md#r-14) |

Nguồn: [evidence/evidence.service.ts](../../apps/backend/src/evidence/evidence.service.ts), [evidence/evidence.controller.ts](../../apps/backend/src/evidence/evidence.controller.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: Đã giải quyết [BL-007](../BUSINESS_LOGIC_AUDIT.md#bl-007), [BL-015](../BUSINESS_LOGIC_AUDIT.md#bl-015), [BL-019](../BUSINESS_LOGIC_AUDIT.md#bl-019); [BL-026](../BUSINESS_LOGIC_AUDIT.md#bl-026) (đã bọc khóa Term qua `workflow.studentEdit`, đọc file trong lock và dọn Storage sau commit, giữ nhãn Potential chờ test DB đa kết nối). Theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Lưu minh chứng gắn với tiêu chí và bảo vệ tệp/lịch sử xử lý. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Sinh viên tạo nháp và tải tệp; người có quyền xem tệp được ký URL; sinh viên chỉ xóa nháp chưa có lịch sử.

Luồng: ScoreReport / EvidenceList / EvidenceDetail → EvidenceController → EvidenceService → WorkflowService.studentEdit/scope → Evidence, EvidenceFile, CriterionAssessment → Supabase Storage → URL có thời hạn.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F06-AC-01:** Minh chứng thuộc sinh viên, kỳ và tiêu chí hợp lệ.
- **F06-AC-02:** Upload nháp kiểm tra DataURL và kích thước tối đa 8 MB.
- **F06-AC-03:** Truy cập tệp phải kiểm tra quyền trước khi ký URL.
- **F06-AC-04:** Nháp chưa từng xử lý mới được xóa cả hồ sơ.
- **F06-AC-05:** DB và Storage không được mất liên kết khi ký URL thất bại.
- **F06-AC-06:** Thay đổi tệp không được giữ nguyên kết luận duyệt cũ.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Danh sách minh chứng phân trang và lọc phải phản ánh toàn bộ dữ liệu; trang chi tiết phân biệt AI, cán bộ, yêu cầu bổ sung.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET/POST /evidence`
- `GET/PATCH/DELETE /evidence/:id`
- `POST /evidence/:id/submit, /evidence/:id/withdraw`
- `POST /evidence/:id/files, /evidence/:id/files/upload`
- `DELETE /evidence/:id/files/:fileId`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- URL hết hạn.
- Storage upload thành công, DB thất bại.
- Ký URL thất bại sau commit.
- Xóa đua với nộp.
- Tệp thêm sau APPROVED.
- Hồ sơ vượt trang đầu 20 dòng.

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
| F06-TC-01 | Kiểm chứng: minh chứng thuộc sinh viên, kỳ và tiêu chí hợp lệ | F06-AC-01 | Planned |
| F06-TC-02 | Kiểm chứng: upload nháp kiểm tra DataURL và kích thước tối đa 8 MB | F06-AC-02 | Planned |
| F06-TC-03 | Kiểm chứng: truy cập tệp phải kiểm tra quyền trước khi ký URL | F06-AC-03 | Planned |
| F06-TC-04 | Kiểm chứng: nháp chưa từng xử lý mới được xóa cả hồ sơ | F06-AC-04 | Planned |
| F06-TC-05 | Kiểm chứng: DB và Storage không bị mất liên kết khi ký URL thất bại (tách 3 bước, không xóa Storage khi signing fail, trả signedUrlAvailable: false; đối chứng đỏ/xanh) | F06-AC-05 | Passed (11/11 tests trong `data-protection.test.cjs`) |
| F06-TC-06 | Kiểm chứng: thay đổi tệp không được giữ nguyên kết luận duyệt cũ (cấm thêm/xóa tệp khi đã APPROVED hoặc đã thẩm định; khi bổ sung tệp chuyển trạng thái PENDING_REVIEW và vô hiệu hóa officialScore cũ) | F06-AC-06; BL-015 | Verified in `evidence-and-term-selection.test.cjs` |
| F06-TC-07 | BL-019: Phân trang danh sách minh chứng sinh viên theo chuẩn `{ items, total, page, pageSize, counts }`, giữ counts phân nhóm tab toàn kỳ, tránh mất dữ liệu quá 20 hồ sơ | BL-019; F06-AC-01 | Verified in `pagination-and-filter.test.cjs` |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

BL-026 kiểm trên PostgreSQL 17 với hai kết nối. Khi xóa tệp commit trước, submit chặn vì thiếu tệp. Khi submit commit trước, xóa nháp bị từ chối và giữ tệp cùng job. Tác động Storage được kiểm qua giả lập.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

OCR toàn diện và xác minh tổ chức tự động chưa được xác nhận vận hành.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

