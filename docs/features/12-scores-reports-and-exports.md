# F12 — Bảng điểm, báo cáo và xuất Excel

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | STUDENT của mình; STAFF theo Khoa; ADMIN toàn hệ thống |
| Trạng thái | Đã có implementation; các gap BL-001, BL-018, BL-019, BL-020, BL-024 đã được xử lý và kiểm chứng |
| Quy tắc liên quan | [R-01](../BUSINESS_RULES.md#r-01), [R-23](../BUSINESS_RULES.md#r-23), [R-24](../BUSINESS_RULES.md#r-24) |

Nguồn: [conduct-scores/conduct-scores.service.ts](../../apps/backend/src/conduct-scores/conduct-scores.service.ts), [reports/reports.service.ts](../../apps/backend/src/reports/reports.service.ts), [evaluation-workflow/workflow.service.ts](../../apps/backend/src/evaluation-workflow/workflow.service.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-001](../BUSINESS_LOGIC_AUDIT.md#bl-001) (Resolved), [BL-018](../BUSINESS_LOGIC_AUDIT.md#bl-018) (Resolved), [BL-019](../BUSINESS_LOGIC_AUDIT.md#bl-019) (Resolved), [BL-020](../BUSINESS_LOGIC_AUDIT.md#bl-020) (Resolved), [BL-024](../BUSINESS_LOGIC_AUDIT.md#bl-024) (Resolved). Theo dõi trong [backlog](../BACKLOG.md).

## 1. Objective — Mục tiêu

Hiển thị nhất quán snapshot bàn giao, kết quả công bố và thống kê đầy đủ. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Người dùng tra cứu đúng kỳ; cán bộ xem phân bố/tiến độ và xuất toàn bộ tập lọc có quyền truy cập.

Luồng: Dashboard / ResultReports / useFacultyDashboard → ScoresController, ReportsController, WorkflowController.export → ConductScoresService, ReportsService, WorkflowService → snapshot/publication/assessment → apiClient → Excel.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F12-AC-01:** Bảng điểm bảo vệ phạm vi kể cả khi thiếu termId.
- **F12-AC-02:** CTSV xem HANDOFF_SNAPSHOT khi đã gửi; báo cáo ưu tiên publication mới nhất.
- **F12-AC-03:** Summary theo toàn tập lọc, không theo trang.
- **F12-AC-04:** Export toàn bộ tập lọc có quyền, giữ kỳ/lớp/Khoa/trạng thái.
- **F12-AC-05:** Không chuyển lỗi tải một phần thành thống kê 0 hoặc biểu đồ hoàn chỉnh.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

Tổng quan Khoa: 8 trạng thái, tiến độ từng lớp, donut minh chứng; bảng thay thế và liên kết bàn phím. Màn Theo lớp có mục tiêu hành động riêng.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /scores/dashboard, /scores/:studentId, /scores/class/:classId, /scores/trace/:evidenceId`
- `GET /reports/summary, /reports/distribution, /reports/faculties, /reports/results, /reports/results/export`
- `GET /evaluation-workflow/:termId/export`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Trang 2 lỗi.
- Response cũ của kỳ trước.
- Kỳ không có dữ liệu.
- Snapshot lớp khác đơn vị hiện tại.
- Export hơn 100 dòng.
- Tổng đã quyết định gồm APPROVED+REJECTED.

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
| F12-TC-01 | Kiểm chứng: bảng điểm bảo vệ phạm vi kể cả khi thiếu termId | F12-AC-01 | Planned |
| F12-TC-02 | Kiểm chứng: cTSV xem HANDOFF_SNAPSHOT khi đã gửi; báo cáo ưu tiên publication mới nhất | F12-AC-02 | Planned |
| F12-TC-03 | Kiểm chứng: summary theo toàn tập lọc, không theo trang | F12-AC-03 | Planned |
| F12-TC-04 | Kiểm chứng: export toàn bộ tập lọc có quyền, giữ kỳ/lớp/Khoa/trạng thái | F12-AC-04 | Planned |
| F12-TC-05 | Kiểm chứng: không chuyển lỗi tải một phần thành thống kê 0 hoặc biểu đồ hoàn chỉnh | F12-AC-05 | Planned |
| F12-TC-06 | BL-020: DeadlineExtensionsDialog hiển thị đúng sinh viên ngoài trang đầu 100 người, lấy đúng danh sách và snapshot kỳ, không bị undefined | BL-020; F12-AC-04 | Verified in `deadline-dialog-and-access.test.cjs` |
| F12-TC-07 | BL-024: Mở đúng kỳ theo URL (?termId=...) cho các màn sinh viên, đồng bộ ngữ cảnh chọn kỳ giữa giao diện và API | BL-024; F12-AC-01 | Verified in `evidence-and-term-selection.test.cjs` |
| F12-TC-08 | BL-018: Phân trang danh sách yêu cầu chỉnh sửa thông tin profile, hỗ trợ pageSize chuẩn hóa tối đa 100 dòng, lùi trang khi xử lý dòng cuối | BL-018; F12-AC-03 | Verified in `pagination-and-filter.test.cjs` |
| F12-TC-09 | BL-019: Phân trang danh sách minh chứng sinh viên, bảo đảm số lượng vượt 20 dòng không bị cắt mất dữ liệu | BL-019; F12-AC-03 | Verified in `pagination-and-filter.test.cjs` |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Không xuất dữ liệu ngoài quyền hoặc lấy số dòng trang hiện tại làm tổng.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

