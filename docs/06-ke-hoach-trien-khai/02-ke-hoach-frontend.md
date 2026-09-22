# Kế hoạch riêng người B — Frontend Web và Mobile

Tài liệu này là backlog độc lập của **người B**. FE gồm `apps/web` cho Officer/Admin và `apps/mobile` cho Student. Người B không cần đọc backlog Backend để biết việc của mình; chỉ theo các mốc API `BA-*` được A bàn giao.

Phạm vi sở hữu: route, auth/session phía client, design system, Web/Mobile UI, API/query layer, upload UX, E2E và build artifact. B không tự tính điểm, tự suy ra quyền hoặc sửa contract bằng logic FE.

## Quy tắc làm độc lập với Backend

1. PL-02 cung cấp OpenAPI và fixture chuẩn. B dựng màn hình bằng mock adapter có validate schema.
2. Khi A bàn giao `BA-*`, B đổi sang API thật bằng config và đóng task chỉ sau khi tích hợp thật.
3. API thật lỗi không được tự fallback sang mock. Mock chỉ dùng dev/test.
4. Mỗi lỗi contract tạo issue gắn endpoint + request_id + payload đã ẩn dữ liệu; không vá bằng hard-code riêng ở Web/Mobile.

| Mốc A | B có thể nghiệm thu | Nhóm task FE |
|---|---|---|
| BA-1 | Login, route guard, shell và error states | FE-01…04 |
| BA-2 | Admin master data/criteria, Officer activity/attendance | FE-05…07 |
| BA-3 | Student wizard, evidence list/detail/file/status | FE-08…09 |
| BA-4 | Rule editor, review, supplement, scores, appeal, close term | FE-10…15 |
| BA-5 | Notification, dashboard/report, audit/health, reset/no-AI states | FE-16…20 |

## GĐ0 — Route, UX và contract client

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | PL-04 · S | Map đủ 37 trace ID sang route Web/Mobile; menu theo permission/capability; component/state inventory | PL-02 | Có C06; phân rõ Web/Mobile; no-AI không gọi endpoint hoặc spinner vô hạn |
| [ ] | PL-06 · S | Review OpenAPI/fixture do A tạo: pagination, error, file, auth, no-AI, role-specific response | PL-02 | Danh sách mismatch được trả A; fixture validate được; B không tự tạo endpoint ID khác |
| [ ] | PL-07 · S | Review fixture/seed scenario từ góc nhìn màn hình và E2E | PL-05 | Đủ dữ liệu loading/empty/error/role/status/kỳ đóng; ID khớp giữa mock và seed |

`PL-06` và `PL-07` là checklist review của B, không thay owner của PL-02/PL-05 và không tạo dependency mới cho người C.

## GĐ1 — Nền tảng FE

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | FE-01 · M | Bootstrap Vite/React/TS Web và Expo/Router Mobile; theme/layout/navigation/form/query client/env | PL-01, PL-04 | Web start/build; Android/emulator mở được; không chứa service-role key |
| [ ] | FE-02 · M | API client từ contract, query keys, mock adapter, C06, loading/empty/error và 401/403/404/409/429 | FE-01, PL-02, PL-05 | Mock→real bằng config; không fallback giả; fixture được validate |
| [ ] | FE-03 · L | C01/C03: auth state, login, restore, change password/logout, route guard/sidebar | FE-02, BA-1 | Web/Mobile login API thật; concurrent 401 chỉ refresh một lần; logout xóa cache người cũ |
| [ ] | FE-04 · M | Component Core: badges, term selector, table, dialog, timeline, file picker/dropzone, import wizard | FE-02, PL-04 | Nhãn Việt, icon+chữ, focus/bàn phím Web; logic chung không ép DOM component lên Mobile |

## GĐ2 — Admin/Officer nền và Student nộp hồ sơ

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | FE-05 · L | A02/A03: user/scope/import, khoa/lớp/kỳ/đơn vị | FE-03, FE-04, BA-2 | Tạo dữ liệu thật; preview import; form theo role; không cho thao tác ngoài policy kỳ |
| [ ] | FE-06 · M | A04 + S02 + O08: cây tiêu chí, trần và căn cứ metadata | FE-04, BA-2 | Admin quản lý, Student/Officer readonly; không hard-code điểm; chưa RAG vẫn đọc metadata |
| [ ] | FE-07 · M | O06: activity/archive/import/sửa attendance | FE-04, BA-2 | Upload→preview→commit; báo lỗi từng dòng; sửa tay có reason; refresh không nhân bản |
| [ ] | FE-08 · L | S03 Mobile wizard: activity, camera/file, draft, review/submit | FE-03, FE-04, FE-06, BA-3 | INTERNAL/EXTERNAL/UNKNOWN; camera denied vẫn chọn file; mất mạng giữ nháp; chống submit đúp |
| [ ] | FE-09 · L | S04/S05: list/detail/file/timeline/status/withdraw | FE-08, BA-3 | Poll dừng đúng; signed URL refresh; no-AI không treo; không lộ risk hoặc dữ liệu người khác |

## GĐ3 — Review, bổ sung, điểm và appeal

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | FE-10 · M | A05 rule form/JSON/validate/publish; O08 readonly | FE-06, BA-4 | Published rule không sửa trực tiếp; effect date/reason bắt buộc; lỗi validate tại trường |
| [ ] | FE-11 · L | O02/O03 queue + split-view + RuleCheck/DecisionBar | FE-07, FE-09, BA-4 | Duyệt không AI; file thật; claim/release; 409 giữ form; reject có basis; chuyển hồ sơ tiếp theo có kiểm soát |
| [ ] | FE-12 · M | S06 + O04: supplement và manual verification/source | FE-09, FE-11, BA-4 | Request→Student bổ sung→Officer xem lại; deadline/scan error; thiếu chứng cứ khác reject |
| [ ] | FE-13 · M | S01/S09 + O09: dashboard score, kỳ, trace, tìm Student | FE-06, FE-09, BA-4 | Official/pending tách rõ; đổi user/kỳ không lộ cache; trace thiếu OCR vẫn hiển thị đúng |
| [ ] | FE-14 · M | S07 + O07 appeal | FE-11, FE-13, BA-4 | Gửi/list/detail/REOPEN/reject thật; decision cũ còn xem; reopen chưa tự sinh điểm mới |
| [ ] | FE-15 · S | A03 close/reopen và readonly banner xuyên S03/S05/O03 | FE-05, FE-11, FE-13, BA-4 | Nêu hậu quả; xử lý TERM_CLOSED kể cả UI đang mở; giữ dữ liệu form khi 409 |

## GĐ4 — Hoàn thiện FE Core

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | FE-16 · M | C05 Web/Mobile: bell, unread, read-all, deep link, push nếu có | FE-03, FE-09, BA-5 | Notification thật; đúng route/role; từ chối push vẫn dùng in-app |
| [ ] | FE-17 · M | O01/O10 + A01 KPI/chart/export status | FE-11, FE-13, BA-5 | Filter nhất quán; tổng khớp bảng điểm; metric AI thiếu data không hiện 0/số giả |
| [ ] | FE-18 · M | A10/A11 audit/diff/health/job retry; A06 kho quy chế cơ bản | FE-04, BA-5 | Không nút sửa/xóa audit; sanitize log; archive không mất căn cứ; AI disabled hiển thị đúng |
| [ ] | FE-19 · M | C02 Web/Mobile; chuẩn hóa no-AI ở S05/O03/C04/A06/A07 | FE-03, FE-09, FE-11, BA-5 | Reset link thật; menu AI theo capability; không poll dịch vụ không chạy |
| [ ] | FE-20 · M | Rà UX Web/Mobile: offline, retry upload, empty/error, responsive, focus, token expiry, timezone | FE-05…19 | Luồng chính đạt Web desktop và Android; không mất draft; ghi thiết bị thực tế đã test |

## GĐ5 — E2E và bàn giao FE

| Xong | ID / Cỡ | Việc của B | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|
| [ ] | QA-03 · L | E2E manual-first Mobile/Web/BE thật | QA-01, QA-02, FE-20 | 12 ca Core trong plan nghiệm thu đạt khi AI tắt; không dùng mock cho dữ liệu nghiệm thu |
| [ ] | QA-05 · M | Build Web + Android artifact; smoke staging auth/CORS/upload/download/export | QA-03, QA-04 | Artifact mở/cài được; signed URL không dùng localhost; ghi môi trường/số đo thật |
| [ ] | QA-07 · S | FE release notes, hướng dẫn chạy/build và danh sách giới hạn thiết bị | QA-05 | Không lỗi chặn luồng; A replay E2E được; không tuyên bố iOS đạt nếu chưa test |

### 12 ca E2E B phải chạy

1. Admin tạo kỳ/tiêu chí/rule → Officer tạo hoạt động → Student nộp → Officer duyệt → Student thấy điểm/trace.
2. Certificate-only ngoài trường vào hàng đợi người xem, không tự bị từ chối.
3. Yêu cầu bổ sung → Student nộp → Officer duyệt lại, lịch sử/file cũ còn nguyên.
4. Appeal APPROVED/REJECTED, lần lượt REOPEN và bác; điểm không cộng trùng.
5. Hai Officer mở cùng hồ sơ và hai hồ sơ cùng Student chạm trần; FE xử lý lock/409.
6. Chốt kỳ khi Student/Officer đang mở form; giữ nội dung và giải thích lỗi.
7. File quá lớn/sai MIME/scan lỗi và signed URL hết hạn.
8. Mất mạng giữa upload/submit/review; refresh token hết hạn.
9. Truy cập evidence/file/export/notification người khác không lộ nội dung.
10. Khóa account/đổi scope khi đang đăng nhập; request tiếp theo mất quyền cũ.
11. Export rồi đổi filter/kỳ; job/file vẫn đúng snapshot ban đầu.
12. AI tắt và queue restart; UI vẫn cho review thủ công, không treo AI step.

## Definition of Done của B

- Màn hình chạy API thật và đủ loading/empty/error/forbidden/conflict; mock chỉ dùng dev/test.
- Web và Mobile không tự tính điểm, permission hoặc state transition trái contract.
- Official score, pending score và AI suggestion được trình bày tách biệt.
- Query/cache được tách theo user/role/term; logout không để lại dữ liệu người cũ.
- Luồng chính có bằng chứng E2E trên Web và Android; accessibility/responsive được kiểm tra phù hợp.

## Thứ tự bắt đầu của B

`PL-04 → PL-06/PL-07 → FE-01 → FE-02 → FE-04`, sau BA-1 đóng FE-03; tiếp tục lần lượt theo BA-2 đến BA-5. B không cần chờ AI để hoàn thành M5.
