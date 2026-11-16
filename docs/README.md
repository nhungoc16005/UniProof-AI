# Tài liệu quản lý dự án EduPoint

Bộ tài liệu tiếng Việt, đối chiếu mã nguồn ngày **2026-11-15**, baseline `93fb66c`. Bắt đầu từ kiến trúc và luồng nghiệp vụ trước khi sửa code. Hình đính kèm của người dùng cung cấp cấu trúc feature spec; ví dụ “thêm địa chỉ giao hàng” không phải yêu cầu của EduPoint.

## Đọc theo công việc

| Tài liệu | Dùng khi |
|---|---|
| [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md) | Hiểu hệ thống, module, DB, migrations, navigation, workflow và scaffold |
| [BUSINESS_RULES](BUSINESS_RULES.md) | Kiểm quyền, tiền/hậu điều kiện, state transition, trần điểm, tính nhất quán |
| [API_CONTRACT](API_CONTRACT.md) | Đọc 121 route,45 lớp DTO, body/query/validation và các dạng envelope |
| [BUSINESS_LOGIC_AUDIT](BUSINESS_LOGIC_AUDIT.md) | Đọc 27 finding có vị trí và regression; 7 Resolved (BL-001, BL-002, BL-006, BL-007, BL-009, BL-010, BL-020), 20 Open |
| [BACKLOG](BACKLOG.md) | Chọn việc, ưu tiên, trạng thái, điều kiện đóng và phụ thuộc quyết định |
| [DECISIONS](DECISIONS.md) | Quyết định đã xác nhận, chính sách chưa rõ Q-01…Q-09 và chuyển tài liệu cũ |
| [TEST_PLAN](TEST_PLAN.md) | Chọn kiểm tra an toàn, regression, môi trường và bằng chứng |
| [CHANGELOG](CHANGELOG.md) | Xem thay đổi đã thực hiện và kết quả kiểm chứng của từng công việc |
| [FEATURE_TEMPLATE](features/FEATURE_TEMPLATE.md) | Tạo spec mới theo 10 mục trong ảnh + Out of Scope |
| [AGENTS.md](../AGENTS.md) | Quy trình bắt buộc cho Codex trước/trong/sau công việc |

## Danh mục14 đặc tả

| ID | Tính năng |
|---|---|
| F01 | [Tài khoản và phân quyền](features/01-accounts-and-access.md) |
| F02 | [Dữ liệu đơn vị và quy chế](features/02-master-data-and-regulations.md) |
| F03 | [Kỳ đánh giá và gia hạn](features/03-terms-and-deadlines.md) |
| F04 | [Bộ tiêu chí và công thức điểm](features/04-rubrics-and-scoring.md) |
| F05 | [Tự đánh giá của sinh viên](features/05-student-assessment.md) |
| F06 | [Minh chứng và lưu trữ tệp](features/06-evidence-and-storage.md) |
| F07 | [Duyệt minh chứng và chốt tiêu chí](features/07-evidence-review-and-verification.md) |
| F08 | [Hoạt động và điểm danh](features/08-activities-and-attendance.md) |
| F09 | [Thẩm định và bàn giao Khoa](features/09-faculty-handoff.md) |
| F10 | [Công bố và chốt kỳ](features/10-publication-and-term-closure.md) |
| F11 | [Phúc khảo và hiệu chỉnh công bố](features/11-appeals-and-corrections.md) |
| F12 | [Bảng điểm, báo cáo và xuất Excel](features/12-scores-reports-and-exports.md) |
| F13 | [Thông báo và liên kết nghiệp vụ](features/13-notifications.md) |
| F14 | [Nhật ký, giám sát và xử lý AI](features/14-audit-monitoring-and-ai-jobs.md) |

Mỗi spec có metadata/nguồn, Objective, User Story, Acceptance Criteria, UI/UX, API Contract, Error Handling, Edge Cases, UI States, Test Cases, Definition of Done và Out of Scope. AC/TC là checklist kiểm chứng; chưa đánh dấu đạt chỉ vì code tồn tại.

## Cách duy trì sau mỗi công việc

1. Đọc overview, rules, feature liên quan và backlog/decisions trước khi sửa. Kiểm source để tránh tài liệu cũ dẫn sai.
2. Phân biệt hiện trạng, yêu cầu đã xác nhận, đề xuất và câu hỏi. Nếu chưa rõ chính sách, ghi Q có tác động và tiếp tục phần độc lập.
3. Khi thay đổi hành vi: cập nhật spec/AC/state, quy tắc/API hoặc kiến trúc liên quan trong cùng đợt thay đổi.
4. Khi xử lý audit: giữ BL ID, ghi status, bằng chứng sửa và test; chưa tái hiện không đóng Potential.
5. Sau **mỗi công việc trong dự án**, cập nhật CHANGELOG: việc thực hiện, file/tính năng liên quan, kiểm tra thực sự đã chạy, kết quả và giới hạn. Tài liệu không bị ảnh hưởng có thể giữ nguyên và ghi lý do ngắn.
6. Kiểm link/anchor/nguồn, diff và dữ liệu nhạy cảm. Kết thúc bằng tóm tắt kết quả thực tế, phần chưa xác minh và câu hỏi còn mở.

Không nhân bản cùng hợp đồng vào nhiều tài liệu. API inventory ở API_CONTRACT; quy tắc ở BUSINESS_RULES; finding đầy đủ ở audit; backlog chỉ theo dõi; spec liên kết đến nguồn chung.

## Nhãn và mã ổn định

- F01…F14: feature; Fxx-AC-yy: tiêu chí nghiệm thu; Fxx-TC-yy: test dự kiến.
- R-01…R-28: quy tắc; BL-001…BL-027: finding; Q-01…Q-09: câu hỏi; DEC-xxx: quyết định.
- **Observed** là code đang làm; **Supported** có căn cứ yêu cầu/form/service; **Proposed** chưa được duyệt; **Needs clarification** chưa đủ chính sách.
- **Planned** không là Passed; **Implemented** không là Verified; **Confirmed** theo nguồn không đồng nghĩa đã tái hiện trên production.

Các file Markdown cũ được hợp nhất có bảng ánh xạ trong [DECISIONS](DECISIONS.md). Không có thay đổi application code/schema/data trong đợt khởi tạo này.

