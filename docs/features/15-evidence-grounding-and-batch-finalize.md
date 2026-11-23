# F15 — Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / ngày | 1.1 / 2026-11-17 |
| Vai trò | `STAFF` (Cán bộ Khoa), `ADMIN` (Quản trị viên), `STUDENT` (Sinh viên) |
| Trạng thái | Có implementation và regression cho quyền chốt, ngữ cảnh import, căn cứ học vụ và điểm danh. Chưa nghiệm thu toàn bộ F15. |
| Nguồn | `apps/backend/src/grounding-import/*`, `apps/backend/src/assessments/*`, `apps/backend/src/activities/*`, `apps/web/src/pages/officer/ImportGroundingData.tsx`, `apps/web/src/pages/officer/StudentAssessment.tsx`, `apps/web/src/components/EvaluationBoard.tsx`, `apps/backend/test/grounding-import-and-batch-finalize.test.cjs` |
| Quy tắc / gap | `DEC-006`, `DEC-008`, `DEC-009`, `DEC-011`, `DEC-012`, `R-29-GROUNDING` |

## 1. Objective — Mục tiêu

Chuyển đổi từ mô hình "sinh viên bắt buộc phải tự upload file minh chứng cho tất cả tiêu chí" sang mô hình "kết hợp căn cứ xác thực":
1. Cho phép Cán bộ Khoa (`STAFF`) import file Excel dữ liệu học vụ (GPA, vắng, cấm thi, nợ học phí, kỷ luật), danh sách điểm danh hoạt động ngoại khóa theo vai trò, và danh sách cán bộ lớp/CLB.
2. Dữ liệu căn cứ được lưu trong các bảng độc lập (`AcademicGrounding`, `ActivityParticipant`, `ClubLeadershipGrounding`) gắn theo từng lô (`ImportBatch`).
3. Đồng bộ điểm gợi ý (`suggestedScore`) và căn cứ (`verifiedData`) qua thao tác ghi có khóa kỳ khi nộp phiếu, chốt phiếu hoặc xác nhận/thu hồi lô; xem phiếu và xem trước không đồng bộ ghi DB.
4. Ở kỳ áp dụng quy trình căn cứ mới (`evidenceBasisWorkflowEnabled = true`), cho phép sinh viên nộp minh chứng 0 file có mô tả chi tiết $\ge 10$ ký tự (chuyển thẳng sang `NEEDS_HUMAN_REVIEW`, không gửi AI worker).
5. Cho phép cán bộ chốt từng phiếu sinh viên hoặc chốt hàng loạt (tối đa 100 phiếu/lần), tự động chuyển các tiêu chí có điểm gợi ý hợp lệ sang `FINALIZED` với `officialScore = suggestedScore`.
6. Hỗ trợ thu hồi lô (`Batch Revoke`) an toàn: chặn toàn bộ nếu có bất kỳ sinh viên nào trong lô đã bị chốt điểm hoặc phiếu đã bàn giao CTSV (`SENT`).

Khi import học vụ, bỏ qua căn cứ đang hiệu lực hoặc xác minh đã có của cùng sinh viên/kỳ/tiêu chí. Nguồn dữ liệu được liên kết bằng `academicGroundingId`, không dựa vào nội dung ghi chú; thu hồi lô không xóa xác minh thủ công. Dòng điểm danh thu hồi giữ trạng thái `REVOKED` và lịch sử, cho phép nhập lại thành dòng nháp mới. Migration chỉ cho phép một căn cứ học vụ ACTIVE và một dòng điểm danh chưa REVOKED cho cùng khóa nghiệp vụ.

## 2. User Story — Người dùng và kết quả

- Là **Cán bộ Khoa (`STAFF`)**, tôi muốn tải file mẫu Excel, chọn file dữ liệu học vụ / hoạt động / ban cán sự và xem trước (Preview) kiểm tra lỗi in-memory trước khi lưu, để đảm bảo dữ liệu căn cứ chính xác tuyệt đối.
- Là **Cán bộ Khoa (`STAFF`)**, tôi muốn chốt phiếu đánh giá của từng sinh viên hoặc chọn danh sách tối đa 100 sinh viên để chốt hàng loạt, giúp tiết kiệm thời gian thẩm định đối với các tiêu chí đã có căn cứ rõ ràng.
- Là **Sinh viên (`STUDENT`)**, tôi muốn xem rõ điểm tự chấm, điểm gợi ý từ căn cứ học vụ/hoạt động và điểm Khoa chốt cho từng tiêu chí, đồng thời có thể nộp minh chứng không kèm file khi có mô tả chi tiết mà không bị hệ thống chặn.
- Là **Quản trị viên (`ADMIN`)**, tôi muốn bật/tắt cờ `evidenceBasisWorkflowEnabled` trên từng kỳ để áp dụng linh hoạt giữa kỳ cũ và kỳ mới.

Trace:
- UI: `ImportGroundingData.tsx` → `apiClient.previewGroundingImport` / `confirmGroundingImport` → `GroundingImportController` → `GroundingImportService.preview` / `confirm` → Prisma Transaction (`ImportBatch`, `AcademicGrounding`, `AuditLog`) → `AssessmentsService.syncStudentGrounding` → UI cập nhật.
- Batch Finalize: `EvaluationBoard.tsx` → `apiClient.batchFinalizeAssessments` → `AssessmentsController.batchFinalizeAssessments` → `AssessmentsService.batchFinalizeAssessments` → Transaction độc lập từng sinh viên → UI Modal hiển thị kết quả chi tiết từng sinh viên.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- **F15-AC-01 (Định dạng MSSV & Preview In-memory):** MSSV dạng text luôn giữ nguyên số 0 ở đầu (ví dụ `"0102210001"`). Preview chỉ validate trong bộ nhớ, tuyệt đối không ghi DB.
- **F15-AC-02 (Phạm vi đơn vị Khoa):** Cán bộ Khoa A không được phép import căn cứ cho sinh viên thuộc Khoa B; dòng đó bị đánh dấu `ERROR` trong Preview.
- **F15-AC-03 (Xử lý ô trống - Không suy diễn):** Ô trống trong file Excel hoặc thiếu dữ liệu = `Chưa có dữ liệu` (giữ chờ). Tuyệt đối không tự ép thành 0, false hay "không vi phạm".
- **F15-AC-04 (Idempotency Replay):** Khi gửi trùng `idempotencyKey`, hệ thống trả về kết quả lô đã tạo trước đó mà không chèn trùng bản ghi.
- **F15-AC-05 (Minh chứng 0 file):** Ở kỳ `evidenceBasisWorkflowEnabled = true`, minh chứng 0 file có mô tả $\ge 10$ ký tự được phép nộp, chuyển trạng thái `NEEDS_HUMAN_REVIEW` và không tạo `AiJob`. Kỳ `evidenceBasisWorkflowEnabled = false` giữ nguyên chặn thiếu file.
- **F15-AC-06 (Chặn chốt phiếu khi còn hồ sơ chờ):** Chốt phiếu (cá nhân hoặc hàng loạt) bị chặn nếu sinh viên còn minh chứng ở trạng thái `NEEDS_HUMAN_REVIEW` hoặc `NEEDS_SUPPLEMENT`, hoặc có khiếu nại chưa giải quyết.
- **F15-AC-07 (Chốt hàng loạt độc lập):** Chốt tối đa 100 phiếu/lần. Mỗi phiếu chạy trong transaction riêng; phiếu lỗi (ví dụ còn minh chứng chờ) bị bỏ qua an toàn và báo lỗi chi tiết, không làm rollback phiếu thành công khác. Thao tác chốt không tự động gửi CTSV.
- **F15-AC-08 (Thu hồi lô an toàn):** Cho phép thu hồi lô khi các sinh viên liên quan chưa bị chốt điểm. Chặn thu hồi toàn bộ lô nếu có ít nhất một dòng đã dùng để chốt điểm (`FINALIZED`), phiếu đã gửi CTSV (`SENT`), đã có publication hoặc kỳ đã đóng (`CLOSED`). Khi thu hồi thành công, điểm gợi ý liên quan được tự động tính toán lại.
- **F15-AC-09 (Ngữ cảnh nhập):** Đổi kỳ, danh mục, hoạt động hoặc file làm mất hiệu lực phiên xem trước. Phản hồi về muộn chỉ cập nhật phiên hiện hành. Confirm dùng đúng kỳ đã xem trước. Retry cùng phiên giữ khóa idempotency.

## 4. UI/UX — Giao diện và tương tác

- **Cán bộ Khoa:**
  - Route `/officer/grounding-import`: Tab "Nhập căn cứ mới" (3 bước chọn loại, tải template Excel, tải file, xem trước preview thống kê 4 nhóm Hợp lệ/Lỗi/Bỏ qua, xác nhận nhập) và Tab "Lịch sử các lô đã nhập" (bảng danh sách lô, xem chi tiết, nút "Thu hồi lô" kèm modal nhập lý do $\ge 5$ ký tự).
  - Màn hình `/officer/students/:studentId/assessment`: Nút "Chốt phiếu sinh viên", mở modal xem trước 16 tiêu chí, kiểm tra blocker/warning trước khi xác nhận.
  - Màn hình `/officer/evaluations` / `EvaluationBoard`: Checkbox chọn nhiều sinh viên trên trang, nút "Chốt hàng loạt (X đã chọn)", modal xác nhận và bảng tiến trình/kết quả chi tiết từng sinh viên. Nút "Gửi CTSV" giữ riêng biệt.
- **Sinh viên:**
  - Màn hình `/student/scores`: Bảng 16 tiêu chí hiển thị rõ 3 cột: Điểm tự đánh giá / Điểm gợi ý (căn cứ, điểm danh, AI) / Khoa chốt điểm.
  - Modal minh chứng: Hiển thị hướng dẫn quy trình mới, cho phép nộp 0 file khi có mô tả $\ge 10$ ký tự.
- **Admin:**
  - Màn hình `/admin/terms`: Checkbox "Bật quy trình căn cứ mới (`evidenceBasisWorkflowEnabled`)" trong modal Tạo kỳ và modal Sửa kỳ.

## 5. API Contract — Hợp đồng API

1. `POST /api/grounding-import/preview`:
   - Body: `{ termId: string, type: 'ACADEMIC' | 'ACTIVITY' | 'CLUB_LEADERSHIP', rows: any[], activityId?: string }`
   - Response: `{ termId, totalRows, validCount, errorCount, skippedCount, canCommit, previewItems: [...] }`
2. `POST /api/grounding-import/confirm`:
   - Body thêm `previewTermId: string` bắt buộc, lấy từ response preview. Xem [hợp đồng API](../API_CONTRACT.md#lỗi-và-route-giới-hạn) cho lỗi mismatch và replay khác kỳ.
   - Response thành công gồm `batchId`, `type`, `validRows` và `affectedStudentsCount`. Replay cùng kỳ trả `batchId` và `idempotencyReplay: true`.
3. `GET /api/grounding-import/batches?termId=...`:
   - Response: `GroundingImportBatch[]`
4. `GET /api/grounding-import/batches/:id`:
   - Response: `GroundingImportBatch & { records: any[] }`
5. `POST /api/grounding-import/batches/:id/revoke`:
   - Body: `{ reason: string }` (tối thiểu 5 ký tự)
   - Response: `{ batchId, status: 'REVOKED', revokedCount }`
6. `GET /api/assessments/student/:id/preview-finalize?termId=...`:
   - Response: `{ canFinalize, blockers: string[], warnings: string[], criteria: [...] }`
7. `POST /api/assessments/student/:id/finalize`:
   - Body: `{ termId: string }`
   - Response: `{ studentId, finalizedCount, officialTotalScore }`
8. `POST /api/assessments/batch-finalize`:
   - Body: `{ termId: string, studentIds: string[] }` (tối đa 100 ID)
   - Response: `{ totalProcessed, successCount, failedCount, results: [...] }`

## 6. Error Handling — Xử lý lỗi

- **400 Bad Request:** MSSV ngoài phạm vi Khoa, kỳ đã đóng, thiếu lý do thu hồi, danh sách chốt vượt quá 100 phiếu, hoặc lô có sinh viên đã bị chốt điểm.
- **403 Forbidden:** Sinh viên cố tình gọi API import/finalize; hoặc cán bộ không có quyền review.
- **404 Not Found:** Không tìm thấy kỳ học, lô căn cứ hoặc sinh viên.
- **Transaction Rollback:** Trong quá trình confirm import, nếu có lỗi hệ thống, toàn bộ batch và các dòng liên quan bị rollback. Trong batch finalize, mỗi sinh viên chạy transaction riêng độc lập.

## 7. Edge Cases — Trường hợp biên

- File Excel có khoảng trắng ở đầu/cuối MSSV hoặc tên cột không viết hoa: được chuẩn hóa tự động (`trim()`, chữ hoa không phân biệt).
- Sinh viên có nhiều dòng trong cùng một file: dòng đầu tiên được duyệt, dòng thứ hai đánh dấu `ERROR` trùng lặp trong cùng file.
- Thu hồi lô khi đã có sinh viên bị chốt điểm: chặn toàn bộ lô và báo danh sách MSSV cản trở.
- Phiếu sinh viên chưa nộp tự đánh giá (`NOT_SUBMITTED`): khi chốt hàng loạt sẽ báo lỗi "Sinh viên chưa hoàn tất nộp phiếu".
- Phiếu có khiếu nại đang chờ giải quyết (`PENDING`): chốt bị chặn để chờ kết luận phúc khảo.

## 8. UI States — Trạng thái giao diện

- `Loading`: Hiển thị Skeleton hoặc Spinner khi tải danh sách lô, preview hoặc batch finalize.
- `Preview Table`: Tab lọc nhanh Tất cả / Hợp lệ / Có lỗi / Bỏ qua để cán bộ kiểm tra nhanh trước khi bấm Xác nhận.
- `Batch Finalize Modal`: Chuyển từ màn hình xác nhận sang màn hình báo cáo kết quả chi tiết từng sinh viên sau khi hoàn tất.

## 9. Test Cases — Kịch bản kiểm thử

Regression BL-028/029 đã đạt trên HTTP/PostgreSQL và component Web nhập Excel. Bao phủ vai trò, khóa phiếu/kỳ, cùng MSSV ở hai kỳ, đổi hoạt động hoặc file, response trả muộn và retry. Xem [TEST_PLAN](../TEST_PLAN.md).

Bộ test regression đầy đủ 25 ca tại `apps/backend/test/grounding-import-and-batch-finalize.test.cjs`:
- Ca 1: MSSV dạng text giữ số 0 ở đầu ("0102210001"), preview VALID.
- Ca 2: Dữ liệu học vụ sai kiểu -> Preview đánh dấu ERROR.
- Ca 3: MSSV ngoài phạm vi Khoa -> Preview đánh dấu ERROR.
- Ca 4: Trùng lặp sinh viên + tiêu chí trong cùng file -> Dòng thứ 2 đánh dấu ERROR.
- Ca 5: Preview tuyệt đối KHÔNG ghi vào database.
- Ca 6: Confirm import ghi đúng dòng; hỗ trợ idempotencyReplay.
- Ca 7: Tái sử dụng batchAddParticipants nhận participants và batchId.
- Ca 8: Import AcademicGrounding tự động đồng bộ vào CriterionAssessment.
- Ca 9: Tiêu chí đã FINALIZED không bị ghi đè điểm chính thức.
- Ca 10: getMine là request chỉ đọc, tuyệt đối KHÔNG ghi DB; đồng bộ diễn ra khi nộp phiếu (submitSelfAssessment).
- Ca 11: Minh chứng 0 file có mô tả $\ge 10$ ký tự ở kỳ mới chuyển NEEDS_HUMAN_REVIEW và KHÔNG tạo AiJob.
- Ca 12: Minh chứng 0 file ở kỳ cũ bị chặn theo quy tắc cũ.
- Ca 13: Preflight không cảnh báo thiếu minh chứng nếu đã có căn cứ/điểm danh.
- Ca 14: Thu hồi lô chưa chốt điểm thành công, tự động reset suggestedScore.
- Ca 15: Chặn thu hồi nếu có ít nhất một dòng đã FINALIZED.
- Ca 16: Chặn thu hồi nếu có ít nhất một sinh viên đã SENT.
- Ca 17: Chốt một phiếu sinh viên chuyển tiêu chí READY_FOR_REVIEW thành FINALIZED.
- Ca 18: Chặn chốt phiếu khi còn minh chứng NEEDS_HUMAN_REVIEW hoặc NEEDS_SUPPLEMENT.
- Ca 19: Chốt hàng loạt tối đa 100 phiếu, transaction riêng từng phiếu.
- Ca 20: Chốt hàng loạt từ chối khi vượt quá 100 phiếu.
- Ca 21: Confirm import re-validation độc lập: loại bỏ sinh viên sai Khoa và dữ liệu vi phạm schema, chỉ commit dòng hợp lệ.
- Ca 22: batchAddParticipants với externalTx không tạo transaction lồng hay lock term lặp lại.
- Ca 23: Thu hồi lô hoạt động (ACTIVITY) xóa sạch cả bản ghi CONFIRMED khi chưa chốt điểm và tính lại điểm gợi ý qua recomputeAndSaveActivityCriterion.
- Ca 24: Sửa tay qua verifyCriterion không bị syncStudentGrounding ghi đè (bảo vệ căn cứ thủ công của cán bộ).
- Ca 25: CriteriaService.updateTerm chặn đổi evidenceBasisWorkflowEnabled khi kỳ đã có publication hoặc handoff SENT.

## 10. Definition of Done — Điều kiện hoàn thành

- [x] Schema Prisma & Migration DDL đầy đủ (`evidenceBasisWorkflowEnabled`, `ImportBatch`, `AcademicGrounding`, `ClubLeadershipGrounding`, `batchId`).
- [x] Backend Core DTO, Service, Controller, Module hoàn chỉnh và đăng ký vào `AppModule`.
- [x] Khắc phục triệt để 9 điểm phát hiện qua review độc lập (re-validation trong confirm, externalTx loại bỏ nested transaction, bảo vệ căn cứ thủ công, phân tách 5 mẫu Excel chuyên biệt, xóa bản ghi CONFIRMED khi thu hồi lô hoạt động, bảo vệ công tắc kỳ khi đã công bố).
- [x] 25/25 test cases unit/regression pass 100%.
- [x] Frontend Khoa: Màn hình Import Căn Cứ & Quản lý lô (`/officer/grounding-import`).
- [x] Frontend Khoa: Chốt phiếu sinh viên (`StudentAssessment.tsx`) & Chốt hàng loạt (`EvaluationBoard.tsx`).
- [x] Frontend Sinh viên: Cập nhật bảng điểm 16 tiêu chí và minh chứng 0 file (`ScoreReport.tsx`).
- [x] Frontend Admin: Bật/tắt `evidenceBasisWorkflowEnabled` trong Quản lý kỳ học (`TermsMasterData.tsx`).
- [x] Đã kiểm tra build TypeScript backend và frontend: 0 lỗi.

## 11. Out of Scope — Ngoài phạm vi

- Không triển khai nhận diện OCR hoặc tích hợp mô hình AI mới.
- Không kết nối API trực tiếp tới hệ thống quản lý đào tạo ngoài.
- Không tự động gửi kết quả lên CTSV sau khi chốt phiếu.
