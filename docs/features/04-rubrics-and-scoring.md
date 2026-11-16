# F04 — Bộ tiêu chí và công thức điểm

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / đối chiếu | 1.0 / 2026-11-15, mã nguồn tại baseline `93fb66c` |
| Vai trò | ADMIN quản lý; STAFF xác minh; STUDENT tự đánh giá |
| Trạng thái | Đã có implementation; các gap BL-003, BL-004, BL-017 (Đợt 4) và BL-014 (Đợt 8) đã được xử lý và kiểm chứng |
| Quy tắc liên quan | [R-08](../BUSINESS_RULES.md#r-08), [R-09](../BUSINESS_RULES.md#r-09), [R-10](../BUSINESS_RULES.md#r-10) |

Nguồn: [criteria/criteria.service.ts](../../apps/backend/src/criteria/criteria.service.ts), [criteria/dut-rubric.ts](../../apps/backend/src/criteria/dut-rubric.ts), [criteria/rubric-scoring.ts](../../apps/backend/src/criteria/rubric-scoring.ts); [routes Web](../../apps/web/src/routes.tsx), [API client](../../apps/web/src/lib/apiClient.ts).

Gap: [BL-003](../BUSINESS_LOGIC_AUDIT.md#bl-003) (Resolved), [BL-004](../BUSINESS_LOGIC_AUDIT.md#bl-004) (Resolved), [BL-014](../BUSINESS_LOGIC_AUDIT.md#bl-014) (Resolved), [BL-017](../BUSINESS_LOGIC_AUDIT.md#bl-017) (Resolved). Theo dõi trong [backlog](../BACKLOG.md); quyết định kỹ thuật BL-014 đã chốt tại DEC-009.

## 1. Objective — Mục tiêu

Quản lý rubric có phiên bản và tính điểm theo dữ liệu đã xác minh. Tài liệu mô tả nền hiện tại và tiêu chí cần kiểm chứng; các gap không được coi là đã đạt.

## 2. User Story — Người dùng và kết quả

Admin tiếp tục dùng rubric hiện hành cho kỳ mới khi không có thay đổi. Khi cần thay đổi nội dung thực sự, Admin quản lý bản thay đổi và phạm vi áp dụng; cán bộ tính điểm theo rubric được áp dụng cho kỳ. Quy tắc đã được người dùng xác nhận tại DEC-006 trong [DECISIONS](../DECISIONS.md).

Hiện trạng code vẫn tạo bản nháp rubric theo từng kỳ rồi yêu cầu ban hành; nội dung sao chép có thể không đổi. Đối chiếu/điều chỉnh luồng tái sử dụng theo REQ-002 trong [BACKLOG](../BACKLOG.md); tài liệu chưa khẳng định code đã đáp ứng đầy đủ quy tắc mới.

Luồng: CriteriaManager → CriteriaController → CriteriaService / validateRubricDefinition → RubricVersion, RubricCategory, Criterion; AssessmentsService → evaluateRubricCriterion → snapshot tổng hợp.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F04-AC-01:** Chỉ bản nháp hợp lệ được ban hành; không sửa lịch sử đã dùng.
- **F04-AC-02:** Rubric mặc định có 5 nhóm trần 20/25/20/25/10, tổng 100.
- **F04-AC-03:** Điểm tiêu chí hữu hạn trong [0,maxScore], nhóm không vượt trần, tổng ≤100.
- **F04-AC-04:** Thiếu dữ liệu chính thức trả NEEDS_VERIFICATION.
- **F04-AC-05:** Gợi ý và điểm chính thức là hai trường, hai thao tác khác nhau.
- **F04-AC-06:** Khi tạo kỳ mới mà không có thay đổi rubric, tiếp tục áp dụng nguyên tiêu chí, mức điểm, công thức và điều kiện của rubric hiện hành; không bắt chỉnh hoặc ban hành lại nội dung vì đổi kỳ.
- **F04-AC-07:** Khi có thay đổi được xác nhận, lưu được nội dung/phạm vi áp dụng và giữ nguyên rubric, kết quả lịch sử của các kỳ đã dùng.

Các tiêu chí có gap audit là điều kiện cần đạt khi sửa, không phải tuyên bố hành vi hiện tại đã đúng. Chính sách chưa rõ theo [DECISIONS](../DECISIONS.md).

## 4. UI/UX — Giao diện và tương tác

CriteriaManager và CriteriaRulesView trình bày bản/nguồn, trần và căn cứ; trường boolean không gửi chuỗi.

Luồng cần đạt theo DEC-006: “Tiếp tục dùng bộ tiêu chí hiện hành” là trường hợp không thay đổi; chỉ mở thao tác chỉnh nội dung khi có nhu cầu thay đổi thực sự. Thiết kế tái sử dụng/bản ghi kỹ thuật chưa được triển khai trong lượt tài liệu này.

Giữ ngữ cảnh người dùng/kỳ và cung cấp thao tác thử lại. Chỉ hiển thị nút khi có quyền, đồng thời server phải kiểm tra lại quyền và trạng thái.

## 5. API Contract — Hợp đồng API

Các route sau đều có prefix `/api` (trừ pipeline ngoài hệ thống):

- `GET /criteria?termId=...`
- `GET /rubric-templates, /rubric-templates/:versionId`
- `POST /rubric-templates/draft, /rubric-templates/:versionId/publish`
- `PUT /rubric-templates/:versionId`
- `GET/PUT /terms/:id/rubric`
- `POST /terms/:id/rubric/draft, /terms/:id/rubric/publish`

Request, DTO, quyền khai báo và vị trí controller: [API_CONTRACT](../API_CONTRACT.md). Phân biệt các [response envelope](../API_CONTRACT.md#envelopes); quyền service có thể hẹp hơn decorator.

## 6. Error Handling — Xử lý lỗi

Lỗi validation/nghiệp vụ phải hiển thị lý do từ server; 401 yêu cầu đăng nhập lại, 403 chặn thao tác ngoài quyền, 409 tải lại dữ liệu khi xung đột. Khi lỗi mạng xảy ra sau thao tác ghi, tải lại trạng thái trước khi cho người dùng lặp thao tác. Không đổi lỗi tải thành kết quả thành công hoặc số liệu 0.

Đối chiếu gap audit trước khi cam kết hành vi lỗi đã được xử lý đầy đủ.

## 7. Edge Cases — Trường hợp biên

- Thiếu baseScore.
- NaN/chuỗi/số âm.
- Ngưỡng bình chọn đúng 90%.
- Vai trò cổ vũ hỗn hợp.
- Cấu hình rolesScore bị mất khi persist.
- Nhiều kỳ liên tiếp dùng cùng rubric không thay đổi nội dung.
- Rubric có phiên bản thay đổi sau khi kỳ cũ đã có điểm/kết quả; không hồi tố kỳ cũ.

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
| F04-TC-01 | Kiểm chứng: chỉ bản nháp hợp lệ được ban hành; không sửa lịch sử đã dùng | F04-AC-01 | Planned |
| F04-TC-02 | Kiểm chứng: rubric mặc định có 5 nhóm trần 20/25/20/25/10, tổng 100 | F04-AC-02 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-03 | Kiểm chứng: điểm tiêu chí hữu hạn trong [0,maxScore], nhóm không vượt trần, tổng ≤100 | F04-AC-03 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-04 | Kiểm chứng: thiếu dữ liệu chính thức trả NEEDS_VERIFICATION | F04-AC-04 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-05 | Kiểm chứng: gợi ý và điểm chính thức là hai trường, hai thao tác khác nhau | F04-AC-05 | Planned |
| F04-TC-06 | Given rubric hiện hành không thay đổi, When mở kỳ mới, Then kỳ mới áp dụng nguyên nội dung mà không bắt chỉnh/ban hành lại nội dung chỉ vì đổi kỳ | F04-AC-06; DEC-006; REQ-002 | Planned |
| F04-TC-07 | Given kỳ trước đã có kết quả, When áp dụng một thay đổi rubric được xác nhận cho kỳ sau, Then nội dung/kết quả kỳ trước vẫn giữ nguyên và truy vết được rubric áp dụng | F04-AC-07; DEC-006 | Planned |
| F04-TC-08 | BL-003: Tiêu chí 2 mặc định có baseScore: 3, tính đúng điểm theo quy chế vắng/trễ hạn; config thiếu baseScore trả NEEDS_VERIFICATION rõ ràng; validateScoringConfig từ chối lưu rubric sai cấu hình | BL-003; F04-AC-03 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-09 | BL-004: leadershipRole được đồng bộ boolean giữa Web và Backend, tiêu chí 14 (>90%) gợi ý 4 điểm, tiêu chí 16 gợi ý 3 điểm; chuỗi "true" bị từ chối với HTTP 400 | BL-004; F04-AC-03 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-10 | BL-017: Dữ liệu xác minh bộ đếm không hợp lệ (âm, thập phân, chuỗi rác) bị từ chối trước transaction; evaluator không ép 0 nuốt lỗi | BL-017; F04-AC-04 | Verified in `scoring-and-validation.test.cjs` |
| F04-TC-11 | BL-014: `rolesScore` được lưu và bảo toàn qua clone/update/publish rubric; tiêu chí 12 tính điểm đúng theo vai trò cộng đồng; thiếu cấu hình trả blocker NEEDS_VERIFICATION | BL-014; F04-AC-03; DEC-009 | Verified in `activity-and-roles-scoring.test.cjs` |

Bổ sung ca biên ở mục 7 và regression của từng BL liên quan; xem [TEST_PLAN](../TEST_PLAN.md) để chọn môi trường và bằng chứng. Không gán Passed nếu chưa chạy.

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] Tất cả AC liên quan được chứng minh bằng kiểm tra phù hợp.
- [ ] Test happy path, sai quyền, trạng thái và ca biên liên quan đã có kết quả.
- [ ] Gap audit liên quan được xử lý hoặc có quyết định chấp nhận rõ ràng.
- [ ] API/quy tắc/spec/backlog và nhật ký được cập nhật theo thay đổi thực tế.
- [ ] Ghi rõ giới hạn kiểm chứng; không còn lỗi Critical/High chưa được xử lý hoặc chấp nhận trong phạm vi bàn giao.

## 11. Out of Scope — Ngoài phạm vi

Đổi quy chế hoặc tỷ lệ quy đổi chưa có quyết định nghiệp vụ.

Đợt khởi tạo tài liệu không thay đổi application code, schema hoặc dữ liệu và không tự thực hiện gợi ý sửa trong audit.

