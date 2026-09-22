# Ma trận phạm vi — 37 trang, Core và phần AI/nâng cao

Mã trang theo [thiết kế FE](../../EduPoint_ThietKe_Trang_FE.md). “Core” là phần cần xong trước M5; “AI” chỉ hoàn thành sau tích hợp tương ứng. Các task ADV là **P3**, không chặn M5 và không được báo là đã làm.

## 1. Common và Student

| Trang | Phạm vi Core trước M5 | Task Core | Phần sau / task |
|---|---|---|---|
| C01 Đăng nhập | Web/Mobile, refresh, route theo quyền | BE-03, FE-03 | SSO trường nếu cần: ADV-10 |
| C02 Quên/reset | Khôi phục mật khẩu thật | BE-22, FE-19 | SSO reset theo provider: ADV-10 |
| C03 Hồ sơ | Readonly profile, đổi mật khẩu/logout | BE-03, FE-03 | Không có phần AI |
| C04 Hỏi đáp | Ẩn/chatbot chưa kích hoạt | BE-23, FE-19 | Chat/citation INT-04/05; lịch sử/feedback ADV-05 |
| C05 Thông báo | List, unread, deep link Web/Mobile | BE-19, FE-16 | Push hoàn thiện nhiều thiết bị ADV-09 |
| C06 Lỗi | 403/404/500/maintenance/offline | FE-02, FE-20 | Không có phần AI |
| C07 Xác nhận công khai | Chưa mở | — | Token xác nhận tổ chức ADV-01; không dùng làm cổng xác thực bằng điểm |
| S01 Tổng quan | Điểm chính thức, kỳ, trạng thái, việc cần làm | BE-15, FE-13 | Gợi ý AI/gap INT-03/08 |
| S02 Tiêu chí | Cây tiêu chí, trần/căn cứ metadata | BE-07, FE-06 | Citation chunk/RAG INT-04/05 |
| S03 Nộp | Wizard/camera/file/nháp/submit thật | BE-09/10, FE-08 | Precheck ảnh/trùng mềm ADV-07 |
| S04 Danh sách | Search/filter/detail/rút/tiếp tục nháp | BE-09/10, FE-09 | Không có phần AI bắt buộc |
| S05 Chi tiết | File, thông tin khai, manual verification, quyết định, trace/timeline | BE-11/15/17, FE-09/11 | OCR/gợi ý/bbox INT-03; gap INT-08; SSE ADV-04 |
| S06 Bổ sung | Yêu cầu cán bộ, file/url/text, deadline | BE-14, FE-12 | Evidence Gap tự động INT-08 |
| S07 Khiếu nại | Tạo/list/detail/resolve | BE-16, FE-14 | Không có phần AI bắt buộc |
| S08 Có thể tích lũy | Chưa mở | — | Gợi ý từ trần/hoạt động/citation ADV-02 |
| S09 Bảng điểm | Theo kỳ, breakdown, snapshot, trace | BE-15/18, FE-13/15 | PDF cá nhân/QR/chữ ký nếu có yêu cầu ADV-08 |

## 2. Officer và Admin

| Trang | Phạm vi Core trước M5 | Task Core | Phần sau / task |
|---|---|---|---|
| O01 Tổng quan | Pending/SLA/appeal/processing KPI | BE-13/20, FE-17 | Agreement/AI metrics INT-08 |
| O02 Hàng đợi | Scope/filter/claim/release | BE-13, FE-11 | Fast-track/bulk/next ADV-03 |
| O03 Xét duyệt | Split-view file, tiêu chí/điểm thủ công, Rule Engine, lịch sử, lock | BE-12/13/15, FE-11 | OCR/AI INT-03; verify INT-07/08; reprocess/history ADV-07 |
| O04 Nguồn ngoài | Nhập nguồn/căn cứ và verified by officer | BE-17, FE-12 | L1 check-source INT-07; L2–L4 workflow ADV-01 |
| O05 Hoạt động ngoài | Chưa mở màn quản lý nâng cao; khai báo ngoài vẫn nộp được | BE-09 | Registry/organizer/merge ADV-01 |
| O06 Nội bộ/điểm danh | CRUD/archive/import/preview/sửa tay | BE-08, FE-07 | Tab minh chứng liên quan ACT-09: ADV-11 |
| O07 Khiếu nại | So sánh quyết định gốc, REOPEN/reject | BE-16, FE-14 | Không có phần AI bắt buộc |
| O08 Rule readonly | Tra cứu tiêu chí/rule/version đang hiệu lực | BE-07/12, FE-06/10 | Hỏi RAG INT-05 |
| O09 Sinh viên | Tìm theo scope, bảng điểm, hồ sơ | BE-15, FE-13 | What-can-I-claim ADV-02 |
| O10 Báo cáo | Tổng hợp/phân phối/thời gian/export | BE-20, FE-17 | AI agreement INT-08; theo organizer ADV-01 |
| A01 Tổng quan | User/evidence/KPI/health | BE-21, FE-17 | AI evaluation INT-06/08 |
| A02 Người dùng | CRUD/import/reset/khóa/roles/scope | BE-05, FE-05 | Không có phần AI bắt buộc |
| A03 Dữ liệu/kỳ | Khoa/lớp/đơn vị, lifecycle/chốt/mở lại | BE-06/18, FE-05/15 | Không có phần AI bắt buộc |
| A04 Tiêu chí | Tree, version, hiệu lực/archive | BE-07, FE-06 | Kéo-thả/sort tùy chọn ADV-11 |
| A05 Rule | Form/JSON, validate, publish bất biến | BE-12, FE-10 | Simulate/history UI/rollback/import ADV-06; version persistence đã làm Core |
| A06 Knowledge Base | Kho file/metadata/đọc/archive, chưa index | BE-23, FE-18 | Index/publish/chunks/retrieval INT-04/05; edit chunks ADV-05 |
| A07 Cấu hình AI | Chưa mở; flag Core config và capability | BE-23, FE-19 | Threshold/version INT-05; history/models ADV-05 |
| A08 Ground Truth | Chưa mở; C quản lý dataset offline | — | Dataset import/export/UI INT-06 |
| A09 Đánh giá AI | Chưa mở; C xuất báo cáo offline | — | Metrics thật INT-06; thí nghiệm/curve/ablation UI ADV-12 |
| A10 Audit | Append-only, list/detail/diff | BE-21, FE-18 | Hash-chain integrity/export ADV-06 |
| A11 Job/health | Core health, job lỗi/list/detail/retry | BE-21, FE-18 | Health/metrics provider INT-01/04; không có tính năng xóa audit/job tùy tiện |

## 3. Backlog nâng cao có chủ sở hữu

Các task này giữ lại toàn bộ nhóm tính năng được tài liệu cũ đề cập nhưng chưa cần cho đường chạy ưu tiên. Chỉ triển khai sau bản tích hợp ổn định hoặc khi nhóm quyết định thay đổi phạm vi bằng một task rõ ràng.

| Xong | ID / Owner / Cỡ | Phạm vi | Phụ thuộc | Tiêu chí hoàn thành |
|---|---|---|---|---|
| [ ] | ADV-01 · A+B, C hỗ trợ · L, tách theo API | C07/O05, EXT-01/02/05…11, L2–L4, organizer report RPT-05 | REL-01, BE-17 | Token có hạn/một lần/dữ liệu tối thiểu; xác nhận chỉ ảnh hưởng câu hỏi trả lời; import/merge không gộp sai tham gia; các nguồn có audit |
| [ ] | ADV-02 · A+B, C hỗ trợ · M | S08/O09, SCO-03 từ trần còn lại/hoạt động/citation | REL-01, INT-04 | Không cam kết điểm tương lai; trần có phân biệt đã đạt/đang chờ; link nộp đúng hoạt động; đăng ký sự kiện là API mở rộng riêng nếu làm |
| [ ] | ADV-03 · A+B · M | REV-04 bulk/ OFF-03 next/fast-track | REL-01 | Server recheck từng hồ sơ, scope/version/cap trong transaction; trả lỗi từng mục; không coi confidence cao đơn lẻ là đủ; auto-approve vẫn tắt |
| [ ] | ADV-04 · A+B · M | EVD-08 SSE real-time | REL-01 | Auth event stream đúng; reconnect/cleanup; không rò event người khác; polling 3s fallback có dừng và backoff |
| [ ] | ADV-05 · A+B+C · L, tách module | RAG-02…06 đầy đủ; ADM-KB-09; ADM-AI-03/04 | INT-05 | Hội thoại đúng owner; feedback đúng message; sửa chunk/version không làm sai citation cũ; config history và model metadata thật |
| [ ] | ADV-06 · A+B · L, tách module | ADM-RUL-06/08/09; ADM-AUD-03/04 | REL-01 | Simulate không ghi điểm; rollback là version mới; import validate; hash-chain có thử phát hiện sửa dữ liệu và export đúng scope |
| [ ] | ADV-07 · A+B+C · M | EVD-15 precheck; PIPE-10/11 reprocess/history UI hoàn chỉnh | INT-03, INT-07 | Cảnh báo mềm không kết luận giả; run revision rõ; không sửa điểm đã duyệt khi reprocess; original/corrected OCR có lịch sử |
| [ ] | ADV-08 · A+B · M, cần contract mới | PDF cá nhân S09, QR kiểm tra; chữ ký số chỉ khi có hạ tầng hợp lệ | REL-01, BE-18 | Không tái dùng SCO-04/C07 sai mục đích; xác thực tài liệu chỉ lộ thông tin cần thiết; không gọi ảnh con dấu là chữ ký số |
| [ ] | ADV-09 · A+B · M | Push đầy đủ nhiều thiết bị và đóng gói iOS | BE-19, FE-16, QA-05 | Token lifecycle/logout đúng, deep link đúng scope; quyền push bị từ chối không chặn app; có thiết bị/build credentials mới nghiệm thu iOS |
| [ ] | ADV-10 · A+B · M, cần đầu vào trường | SSO/integration dữ liệu trường | BE-03, REL-01 | Có tài liệu/credentials sandbox và scope cho phép; mapping UID/user đúng; không làm hỏng login hiện hành |
| [ ] | ADV-11 · A+B · M | ACT-09, sắp xếp cây/reorder file, phím tắt/so sánh nhiều file | REL-01 | Contract mở rộng có validation/permissions; phím tắt không chạy khi gõ form; thao tác sắp xếp không mất file/quan hệ |
| [ ] | ADV-12 · A+B+C · L, tách theo màn | A08/A09 đủ bộ ADM-GT/ADM-EVAL; chạy thí nghiệm, selective curve, ablation/export | INT-06, REL-02 | Mọi metric có run/dataset/config/version; job đánh giá không nghẽn queue nộp; test set vẫn khóa; không tự dùng feedback làm ground truth |

**Auto-approve/break-glass:** chưa thuộc release mặc định. Chỉ thêm khi có quyết định nghiệp vụ cụ thể, quyền riêng, audit, spot-check, rollback và test chặn vượt trần. Hệ thống hoàn thành luồng cốt lõi bằng quyết định của Officer trước.
