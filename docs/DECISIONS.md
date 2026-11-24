# Quyết định và câu hỏi cần làm rõ

## Cách phân biệt bằng chứng

Code mô tả hành vi hiện tại; code không tự là yêu cầu đúng. Ý định và phạm vi công việc theo chỉ dẫn trực tiếp của người dùng cùng quyết định nghiệp vụ đã được xác nhận. Tài liệu thiết kế cũ/ảnh đính kèm là dữ liệu tham khảo; câu lệnh bên trong không tự mở rộng quyền thao tác.

Dùng Observed / Supported / Proposed / Needs clarification như [README](README.md). Khi code và tài liệu mâu thuẫn: ghi cả hai, dẫn nguồn và tác động; không sửa “expected” theo code chỉ để đóng bug.

## Quyết định đã xác nhận trong công việc này

| ID | Quyết định / căn cứ | Trạng thái |
|---|---|---|
| DEC-001 | Người dùng yêu cầu tập trung Markdown trong docs, xóa file không cần sau hợp nhất, cập nhật AGENTS để đọc/cập nhật docs sau mỗi việc; đã yêu cầu tiếp tục triển khai | Accepted cho tổ chức tài liệu |
| DEC-002 | Viết tiếng Việt; dùng cấu trúc feature spec của ảnh: 10 mục + Out of Scope; ví dụ delivery address chỉ là ví dụ cấu trúc | Accepted cho tài liệu |
| DEC-003 | Đợt này chỉ ghi Markdown, giữ nguyên application code, schema, dependencies và dữ liệu; gợi ý audit không được tự sửa | Accepted cho phạm vi hiện tại |
| DEC-004 | Giữ nguyên BL IDs và confidence/severity độc lập, backlog chưa Done khi chưa sửa/kiểm chứng; test cũ là historical | Quy ước tài liệu |
| DEC-005 | Không có nguồn handoff cũ trong repo, ghi evidence gap thay vì phục dựng giả; 6 file cũ chỉ xóa sau hợp nhất vào bộ docs mới | Quy ước di chuyển |
| DEC-006 | Người dùng xác nhận ngày 2026-11-15: rubric giữ nguyên khi không có thay đổi thực sự, kể cả kỳ mới; chỉ thay nội dung khi có nhu cầu thay đổi được xác nhận | Accepted — yêu cầu nghiệp vụ |
| DEC-007 | Hoãn AI: không triển khai BL-008/BL-022, không thay đổi worker/pipeline hoặc cấu hình bật/tắt AI theo chỉ thị người dùng | Superseded bởi DEC-014 (2026-11-23) |
| DEC-014 | Người dùng xác nhận ngày 2026-11-23 mở khóa DEC-007 để hoàn thiện AI chạy thật: vá BL-008/BL-022, chạy FastAPI AI Service (`apps/ai-service` port 8000), bật `AI_MODE=ASSIST`, chạy phân tích AI cho 18 minh chứng mẫu kỳ `2026_1`, mở mục "Chạy thử AI" cho STAFF/ADMIN (ẩn với STUDENT). Điểm AI vẫn chỉ là gợi ý tham khảo, Cán bộ Khoa chốt điểm chính thức. | Accepted — yêu cầu triển khai |
| DEC-015 | Người dùng xác nhận ngày 2026-11-24 kiến trúc **Hybrid Local-First AI** và đồng bộ lại cam kết bảo mật `D8/D9`: lõi chính gồm 2 mô hình Deep Learning tự huấn luyện nén ONNX chạy 100% nội bộ trên CPU 8GB (`PhoBERT-base-v2` ONNX INT8 cho NLP 11 tiêu chí Rubric; `MobileNetV3-Small` ONNX linh hoạt 4 lớp cốt lõi → 7 lớp mở rộng cho CV loại ảnh/sự kiện, giữ tắt nhận diện khuôn mặt theo `D3/D4`). **0 gửi ảnh gốc và 0 gửi PII ra ngoài**; LLM API ngoài (`EXTERNAL_LLM_EXTRACTION_ENABLED`, mặc định `false`) chỉ là tầng mở rộng tùy chọn cho văn bản sự kiện công khai đã đi qua Tường lửa PII 3 lớp (xóa tên theo hồ sơ SV + cắt bỏ nguyên dòng định danh + Regex), kèm Event Cache 7 ngày và fallback an toàn về ONNX nội bộ. | Accepted — yêu cầu triển khai |
| DEC-008 | Gộp nguồn hoạt động (liên kết Q-01): trong cùng sinh viên/kỳ/tiêu chí, cùng `activityId` tính 1 lần; minh chứng không có `activityId` nhận diện riêng bằng `evidence.id`. Ưu tiên vai trò từ attendance `CONFIRMED`; nếu chỉ có nhiều evidence APPROVED cùng hoạt động nhưng vai trò mâu thuẫn thì giữ `NEEDS_VERIFICATION`, không tự chọn điểm cao nhất | Accepted — yêu cầu nghiệp vụ |
| DEC-009 | Điểm vai trò và công thức cổ vũ (liên kết Q-02): Admin cấu hình `rolesScore`; giữ giá trị đã có, thiếu cấu hình báo blocker (không tự gán mặc định từ comment). Công thức cổ vũ giữ nguyên: điểm bậc nhóm tham gia chính + điểm bậc nhóm cổ vũ * hệ số, giới hạn trần | Accepted — yêu cầu nghiệp vụ |
| DEC-010 | Mật khẩu tạm: tạo đơn hiển thị/copy một lần; import hiển thị bảng credential và nút tải file .xlsx do Admin chủ động bấm | Accepted — yêu cầu nghiệp vụ |
| DEC-011 | Ban hành rubric tiêu chí cộng đồng & Xử lý an toàn tài khoản legacy (BL-014, BL-025): Cho phép bản nháp thiếu rolesScore nhưng khi ban hành tiêu chí cộng đồng phải yêu cầu đủ ba vai trò (Tham gia, Ban tổ chức, Cổ vũ), điểm không âm và không có alias mâu thuẫn, không tự đặt điểm mặc định. Cho phép sửa thông tin không liên quan của tài khoản legacy thiếu lớp/Khoa mà không query ID null; khi bổ sung định danh hoặc kích hoạt tài khoản thì bắt buộc kiểm tra dữ liệu đầy đủ | Accepted — yêu cầu nghiệp vụ |
| DEC-012 | Căn cứ chấm điểm, import Excel và chốt phiếu hàng loạt: Bật qua cờ `evidenceBasisWorkflowEnabled`. Ô trống không suy diễn (= Chưa có dữ liệu). Kỳ mới cho phép minh chứng 0 file có mô tả $\ge 10$ ký tự chuyển NEEDS_HUMAN_REVIEW không tạo job AI. Chặn thu hồi lô nếu có sinh viên đã chốt điểm hoặc phiếu SENT. Chốt hàng loạt tối đa 100 phiếu/lần, transaction riêng, không tự gửi CTSV | Accepted — yêu cầu nghiệp vụ đã phê duyệt |
| DEC-013 | Admin xử lý hết lô căn cứ ACTIVE trước khi tắt F15. Khi kích hoạt kỳ còn bản nháp, Admin xác nhận ID bản PUBLISHED; sau khi mở, bản nháp giữ để tra cứu. | Accepted — lựa chọn đã xác nhận khi xử lý BL-032 và REQ-002 |

DEC-006 là yêu cầu nghiệp vụ được người dùng xác nhận trực tiếp; các quyết định tổ chức tài liệu không tự thay quy chế. Các Q sau vẫn Open trong phạm vi chưa được giải quyết; chưa được gán người cụ thể hoặc ngày cam kết.

### DEC-006 — Giữ rubric hiện hành qua các kỳ

- **Nội dung đã xác nhận:** Khi không thay đổi rubric, kỳ mới tiếp tục áp dụng nguyên bộ tiêu chí, mức điểm, công thức và điều kiện hiện hành. Không yêu cầu xây lại hoặc sửa/ban hành lại nội dung chỉ vì mở kỳ mới.
- **Khi có thay đổi thực sự:** Ghi nhận nội dung thay đổi và phạm vi áp dụng; quản lý phiên bản để giữ lịch sử. Không tự cập nhật hồi tố kết quả kỳ cũ.
- **Bản ghi kỹ thuật:** Mỗi kỳ có bản ghi và ID riêng để giữ quan hệ phiếu, roster và publication. Bản sao kế thừa giữ nguyên nội dung nghiệp vụ.
- **Triển khai REQ-002:** Nguồn DEFAULT/TERM đã ban hành được sao chép thành PUBLISHED. Thay đổi ở kỳ chưa mở sinh DRAFT kế tiếp. DEC-013 quy định việc kích hoạt khi còn bản nháp.
- **Ảnh hưởng:** R-08, F03/F04, workflow tạo kỳ, kế hoạch kiểm thử và lộ trình. Q-02 chỉ hỏi phần quy đổi còn thiếu/mâu thuẫn, không yêu cầu đặt lại mức điểm mỗi kỳ.

## Câu hỏi nghiệp vụ

### Q-10 — Điều kiện xác nhận tự động cho căn cứ CLB/BTC

Chưa có tiêu chuẩn xác định khi nào nguồn Excel đủ để xác nhận `eligibleMembership` hoặc `organizerConfirmation`. Đơn vị ban hành quy chế và CTSV cần xác định loại chứng từ, đơn vị có quyền xác nhận và cách xử lý các nguồn mâu thuẫn trước khi tự động tính điểm. Hiện F15 đưa nguồn nhập vào phiếu để Khoa xác minh.

<a id="q-01"></a>

### Q-01 — Định danh và hợp nhất hoạt động

- **Trạng thái:** Resolved theo DEC-008.
- **Quyết định:** Trong cùng sinh viên/kỳ/tiêu chí, cùng `activityId` tính một lần. Minh chứng không có `activityId` được nhận diện riêng bằng `evidence.id`; không tự đoán trùng theo tên/ngày. Khi có điểm danh `CONFIRMED` thì ưu tiên vai trò điểm danh; nếu chỉ có nhiều evidence `APPROVED` cùng hoạt động nhưng vai trò mâu thuẫn thì ghi blocker, giữ `NEEDS_VERIFICATION, suggestedScore: null`, không tự chọn điểm cao nhất.
- **Tác động:** R-15/R-16; BL-005; F07/F08.

<a id="q-02"></a>

### Q-02 — Điểm quy đổi và vai trò

- **Trạng thái:** Resolved theo DEC-009.
- **Quyết định:** `rolesScore` do Admin cấu hình cho 3 vai trò PARTICIPANT, ORGANIZER, CHEERLEADER; giữ giá trị đã có, thiếu cấu hình báo blocker (không tự gán mặc định từ comment). Công thức cổ vũ giữ nguyên: điểm bậc nhóm tham gia chính + điểm bậc nhóm cổ vũ * hệ số, sau đó giới hạn trần.
- **Tác động:** R-09/R-16; BL-014; F04/F08.

<a id="q-03"></a>

### Q-03 — Gia hạn và chốt kỳ

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Hạn cá nhân mới nhất ưu tiên hạn lớp có được phép sớm hơn không? Có hạn cứng endDate? Hai gia hạn có cùng createdAt xử lý thế nào? Chốt kỳ có phải chờ tất cả cửa sổ APPEAL còn hiệu lực?
- **Tác động:** R-06/R-20; BL-006/010; F03/F10/F11.
- **Vai trò cần trả lời:** CTSV/chủ nghiệp vụ kỳ.
- **Hiện trạng/căn cứ:** Code ưu tiên cá nhân→lớp→kỳ, không lấy max; chốt hiện chỉ xét hạn chung. Giữ quyền đã gia hạn là căn cứ finding, chi tiết chính sách cần chốt.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-04"></a>

### Q-04 — Roster sau kích hoạt

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Sinh viên mới nhập, kích hoạt muộn hoặc chưa có lớp lúc mở kỳ được thêm vào kỳ bằng quy trình nào? Có điều chỉnh snapshot đã dùng không?
- **Tác động:** R-05; F01/F03/F09.
- **Vai trò cần trả lời:** CTSV/quản trị đào tạo.
- **Hiện trạng/căn cứ:** Code initialize chụp active STUDENT có class; không tự thêm người mới.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-05"></a>

### Q-05 — Chuyển lớp/Khoa và quyền lịch sử

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Khi class chuyển Khoa hoặc sinh viên đổi đơn vị, ai đọc/xử lý kết quả cũ? Public master data có đủ phù hợp với phạm vi dự án?
- **Tác động:** R-01/R-04/R-05; BL-001; F02/F09/F12.
- **Vai trò cần trả lời:** Chủ dữ liệu/CTSV/Khoa.
- **Hiện trạng/căn cứ:** Nguồn đang dùng snapshot để bảo vệ workflow kỳ; dữ liệu nền hiện có GET public. Chưa suy đây là vi phạm nếu chưa có chính sách khác.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-06"></a>

### Q-06 — EXCLUDED và khôi phục

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Phân biệt loại trừ hành chính với ghi không nộp thế nào trong báo cáo/mẫu xuất? Có cần khôi phục ghi không nộp không? Có coi là điểm0 hoặc ngoài mẫu số không?
- **Tác động:** R-18; BL-021; F09/F12.
- **Vai trò cần trả lời:** CTSV/chủ báo cáo.
- **Hiện trạng/căn cứ:** Cùng enum EXCLUDED, reason khác; restore hiện chỉ có exclusionReason. Không tự gán điểm0/chính sách tỷ lệ.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-07"></a>

### Q-07 — Phúc khảo lặp và phạm vi mở lại

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Cho bao nhiêu đơn theo criterion/evidence/revision? Sau ACCEPTED phải mở lại toàn phiếu hay phần được duyệt? Khi nào chặn đơn tiếp theo?
- **Tác động:** R-21/R-22; F11.
- **Vai trò cần trả lời:** CTSV/Khoa/chủ quy chế.
- **Hiện trạng/căn cứ:** Service có điều kiện hiện tại nhưng thiếu quy định được xác nhận cho mọi chu kỳ; không báo mọi trường hợp chưa hạn chế là bug.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-08"></a>

### Q-08 — Tài liệu bàn giao có thẩm quyền

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** Có bản được phê duyệt của tài liệu FACULTY_ADMIN_HANDOFF_2026-11-02.md từng được link trong docs cũ không; tài liệu nào là nguồn yêu cầu chính thức?
- **Tác động:** Toàn bộ spec/rule/audit.
- **Vai trò cần trả lời:** Chủ dự án/CTSV.
- **Hiện trạng/căn cứ:** File không có trong repository tại đợt này; không suy nội dung từ tên/link.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

<a id="q-09"></a>

### Q-09 — Quyền điểm danh của Admin

- **Trạng thái:** Open / Needs clarification.
- **Cần xác nhận:** ADMIN có được tạo/xác nhận/thu hồi attendance khi workflow mới chỉ STAFF chốt điểm không? Ai chịu trách nhiệm căn cứ do Admin ghi?
- **Tác động:** R-15/R-16; F08.
- **Vai trò cần trả lời:** CTSV/Khoa/chủ phân quyền.
- **Hiện trạng/căn cứ:** Controller và service hiện có nhánh ADMIN; chưa kết luận unauthorized khi chưa có chính sách hạn chế.
- **Kết luận được duyệt:** Chưa có. Khi có, ghi người/vai trò xác nhận, ngày, quyết định và các R/F/AC/test phải cập nhật.

## Hợp nhất tài liệu cũ

| File được loại sau hợp nhất | Nội dung được giữ và nơi thay thế |
|---|---|
| `EduPoint_API_BE.md` | API/envelope/quyền/route → [API_CONTRACT](API_CONTRACT.md); bổ sung routes mới bị thiếu trong bản cũ |
| `EduPoint_ThietKe_Trang_FE.md` | Màn/luồng/AC/error/state →14[feature specs](README.md); nguyên tắc copy/AI/độ tin cậy giữ dưới đây, proposal phân loại riêng |
| `EduPoint_Tinh_nang_Techstack_Giaodien.md` | Mục tiêu/stack/domain → [overview](PROJECT_OVERVIEW.md); mobile/SSO/RAG/AI nâng cao ghi Proposed/scaffold |
| `cautruc.md` | Cấu trúc/module/worker thật → [overview](PROJECT_OVERVIEW.md) |
| `apps/web/NAVIGATION.md` | Menu/redirect/trách nhiệm màn và returnTo → [overview](PROJECT_OVERVIEW.md); harness → [test plan](TEST_PLAN.md) |
| `apps/web/FACULTY_DASHBOARD.md` | Ba biểu đồ, nguồn dữ liệu, phân trang, stale/error/empty, accessibility → overview/F12/test plan |

Link cũ tới `docs/07-hien-trang-he-thong/FACULTY_ADMIN_HANDOFF_2026-11-02.md` không có đích thực, liên quan Q-08. Comment lịch sử trong types Web nhắc tên file cũ được giữ vì đợt này không sửa application source.

Các chi tiết UI/API cũ đã lỗi thời không được giữ như yêu cầu đã nghiệm thu: Khoa hiện 5 menu (cũ 4); Student nộp qua bảng điểm, route wizard cũ redirect; reset/organizer/AI admin route cũ không mở tính năng; auth JWT 12h và cơ chế envelope hiện hành thay mô tả refresh/SSE cũ.

## Ý tưởng thiết kế có giá trị cần giữ, chưa đồng nghĩa đã triển khai

Các điểm sau được hợp nhất từ proposal FE cũ để dùng khi làm UI, cần kiểm hiện trạng trước khi cam kết AC:

- Thiếu bằng chứng không phải bằng chứng giả; không tự gắn nhãn “giả”. Certificate-only có thể trình bày “nhất quán nhưng chưa xác minh độc lập”; cần quyết định cán bộ.
- Tách hai câu hỏi: hoạt động tồn tại và sinh viên tham gia; chỉ nguồn công khai không tự xác nhận cá nhân.
- AI/rule suggestion gắn nhãn “Đề xuất — chưa phải điểm chính thức”; điểm chính thức có người chốt/lý do/thời điểm. Có đường truy vết căn cứ.
- Mức xác minh L1 chính thức, L2 tổ chức, L3 roster, L4 công khai, L5 certificate-only là cách trình bày đề xuất; không suy mọi mức đã có tích hợp tự động. Nguồn level4 không xác nhận người tham gia theo service.
- Confidence số cho cán bộ, mức định tính cho sinh viên; proposal ngưỡng≥0,85 cao, ≥0,60 trung bình, còn lại thấp. Phải kiểm component/config trước dùng; không coi đây là chính sách được phê duyệt mới.
- Risk signal chỉ là cảnh báo yếu; không là kết luận giả mạo. Tránh đưa chi tiết kỹ thuật pipeline/risk vào quyết định của sinh viên.
- Từ chối/sửa điểm/bổ sung cần lý do cụ thể và mục còn thiếu; “không có trong dữ liệu trường” không tự chứng minh sinh viên không tham gia.
- Hiển thị tiến trình hữu ích, ca lỗi mạng và cách phục hồi; đề xuất stepper7bước/SSE không được mô tả là implementation hiện tại.
- Dùng icon/chữ cùng màu, hỗ trợ bàn phím và mobile390px; ngày hiển thị theo vi-VN/Asia/Ho_Chi_Minh; hợp đồng API vẫn dùng thời điểm ISO.
- Thông điệp gợi ý: chưa có nguồn trường→chuyển xác minh/bổ sung; pipeline lỗi→chưa xử lý tự động, chuyển cán bộ; RAG thiếu nguồn→không đủ căn cứ để trả lời; không bịa kết luận.

Proposal chưa được xác nhận phạm vi: SSO, reset email/refresh token, mobile camera flow, xác nhận tổ chức public-token, streaming OCR/SSE, RAG retrieval/chat, AI config/ground truth/evaluation console, training datasets/experiment, export/notification đa kênh nâng cao. Theo [BACKLOG](BACKLOG.md) trước khi lập task; không báo thiếu proposal như confirmed bug.

## Mẫu ghi quyết định mới

Khi một Q được giải quyết, thêm DEC ID duy nhất, trạng thái, ngày, người/vai trò xác nhận, căn cứ, nội dung quyết định, lựa chọn bị loại nếu cần và các file/AC/test bị ảnh hưởng. Link ngược từ Q và cập nhật CHANGELOG. Không tự ký thay chủ nghiệp vụ.

