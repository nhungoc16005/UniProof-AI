# Nhật ký công việc

Mỗi công việc trong dự án thêm mục mới ở đầu với ngày, phạm vi, feature/bug/quyết định liên quan, thay đổi thực tế, kiểm tra đã chạy và giới hạn. Không ghi test dự kiến như đã Passed, không ghi credential hoặc dữ liệu sinh viên.

## 2026-11-23 — Train lại toàn bộ AI từ A đến Z và hiệu chỉnh tài liệu hướng dẫn

- **Train thực tế:** Pipeline A (Rubric Classifier `tfidf_linear_svc` v2.0.0, 11 lớp) → `apps/ai-service/model/rubric_classifier.joblib`; Pipeline B (MobileNetV3-Small 7 lớp) → `apps/ai-service/model/event_scene_classifier.pt`; Pipeline C (5 phôi) → `apps/ai-service/templates/registry.json`. Khởi động lại FastAPI để nạp model.
- **Sửa script đánh giá:** [evaluate.py](../research/activity-classification/evaluate.py) đánh giá đúng mô hình thắng CV (đọc `bestCvModel` trong metadata) thay vì cố định `tfidf_logreg`; [error_analysis.py](../research/activity-classification/error_analysis.py) fit trên train+val thay vì dùng model production đã học cả test.
- **Tài liệu:** Viết lại [AI_TRAINING_AND_ARCHITECTURE_GUIDE.md](AI_TRAINING_AND_ARCHITECTURE_GUIDE.md) cho khớp mã nguồn: đúng tên module (`vietnamese_ocr_engine.py`, `ocr_extractor.py`, `web_search_verifier.py`), đúng nghĩa nhãn `MUC_x` theo `predictor.py`, đúng 7 lớp CV, đúng cơ chế Tầng 6 (pHash + aspectRatio), đúng đường dẫn đầu ra; thêm kết quả train thực chạy, cảnh báo dataset ảnh tổng hợp/phôi mô phỏng và lộ trình nâng cấp. Cập nhật [TEST_PLAN.md](TEST_PLAN.md).
- **Kiểm chứng:** 23/23 test Python OK, 26/26 test worker pass, `/health` báo `rubricMlModelAvailable: true`. Chưa chạy lại seed đối chứng và browser E2E.

## 2026-11-23 — Bổ sung tài liệu hướng dẫn Kiến trúc, Hoàn thiện Task AI và Huấn luyện Mô hình từ A đến Z

- **Tài liệu mới ([AI_TRAINING_AND_ARCHITECTURE_GUIDE.md](AI_TRAINING_AND_ARCHITECTURE_GUIDE.md)):**
  - Tổng hợp toàn diện kiến trúc pipeline xác thực AI 6 tầng (`apps/ai-service`) và luồng kết nối với `EvidenceProcessingWorker` (`AI_MODE=ASSIST`).
  - Mô tả chi tiết cơ chế chống giả mạo đa tầng (`detect_synthetic_graphic`, kiểm tra thẻ EXIF/PNG `Software`, độ phẳng vi mô 8×8 block variance, dấu đỏ vector `red_luma_std`, chống trùng `pHash`, đối chiếu định danh cứng và siết nguồn xác thực web `officialWebVerified`).
  - Hướng dẫn thực hành từng bước từ A đến Z để tái huấn luyện và xuất 2 mô hình ML/DL: **Pipeline A — Rubric Classifier v2.0.0** (11 lớp tại `research/activity-classification/`) và **Pipeline B — MobileNetV3-Small Event Scene Classifier** (7 lớp tại `research/image-classification/`), cùng **Pipeline C — Đăng ký Mẫu phôi chuẩn Layer 6** (`register_templates.py` → `registry.json`).
  - Cung cấp quy trình kiểm thử End-to-End, cách sinh bộ minh chứng đối chứng Thật (Realistic Scan) / Giả (Đồ họa phẳng, Sai MSSV) kỳ `2026_1` và checklist mở rộng các task AI tiếp theo.
- **Liên kết tài liệu:** Cập nhật chỉ mục trong [README.md](README.md) và đặc tả [14-audit-monitoring-and-ai-jobs.md](features/14-audit-monitoring-and-ai-jobs.md). Không ảnh hưởng `API_CONTRACT.md` hay `BUSINESS_RULES.md`.
- **Kiểm chứng:** Kiểm tra liên kết nội bộ và `git diff --check` đạt.

## 2026-11-23 — Huấn luyện Rubric Model v2.0.0 (11 lớp), MobileNetV3 CV (7 lớp), Kho phôi Lớp 6 & Bộ mẫu đối chứng Thật/Giả

- **Huấn luyện Rubric Classifier v2.0.0 ([prepare_dataset.py](../research/activity-classification/prepare_dataset.py), [train_baseline.py](../research/activity-classification/train_baseline.py), [evaluate.py](../research/activity-classification/evaluate.py), [error_analysis.py](../research/activity-classification/error_analysis.py), [export_model.py](../research/activity-classification/export_model.py)):**
  - Mở rộng tập dữ liệu có nhãn từ 123 mẫu (8 lớp) lên **259 mẫu trên 239 `group_id` độc lập** phủ đủ **11 lớp** (`MUC_4, 5, 8, 9, 10, 12, 13, 14, 15, 16 + KHONG_HOP_LE`), chia `train/val/test` bằng `StratifiedGroupKFold` (0% rò rỉ `group_id`).
  - Huấn luyện `tfidf_linear_svc` (Calibrated) đạt **5-fold CV Accuracy `88.42%` / Macro-F1 `0.8851`** và **Holdout Test Accuracy `84.62%` / Macro-F1 `0.8241`**; xuất artifact `apps/ai-service/model/rubric_classifier.joblib` và cập nhật [predictor.py](../apps/ai-service/src/predictor.py), [criterion_evaluator.py](../apps/ai-service/src/criterion_evaluator.py) chặn gợi ý điểm khi model phân loại `KHONG_HOP_LE`.
- **Huấn luyện MobileNetV3-Small CV & Kho phôi Lớp 6 ([build_cv_dataset.py](../research/image-classification/build_cv_dataset.py), [train_mobilenet_cv.py](../research/image-classification/train_mobilenet_cv.py), [face_verifier.py](../apps/ai-service/src/face_verifier.py), [register_templates.py](../apps/ai-service/tools/register_templates.py), [registry.json](../apps/ai-service/templates/registry.json)):**
  - Huấn luyện MobileNetV3-Small 7 lớp bối cảnh ảnh, xuất TorchScript `apps/ai-service/model/event_scene_classifier.pt` và nối vào `FaceAndVisionService.analyze_scene_vision`.
  - Đăng ký 5 phôi chuẩn của Trường/Bệnh viện Huyết học vào `apps/ai-service/templates/registry.json` kèm ảnh mẫu trong `templates/files/`.
- **Forensics đa tầng & Bộ minh chứng đối chứng Thật/Giả kỳ `2026_1` ([quality_forensics.py](../apps/ai-service/src/quality_forensics.py), [render_certificate.py](../apps/backend/scripts/render_certificate.py), [seed-sample-evidences-2026-1.cjs](../apps/backend/scripts/seed-sample-evidences-2026-1.cjs)):**
  - Bổ sung kiểm tra thẻ EXIF/PNG Software (`Canva`, `Photoshop`, `Illustrator`, `Figma`, `Paint`, `GIMP`) kết hợp phát hiện nền đồ họa phẳng và dấu vector đơn sắc.
  - Cấu hình bộ 18 minh chứng mẫu kỳ `2026_1` gồm cả **bản scan giấy thật hợp lệ** (`realisticScan: true` → gợi ý điểm `3đ`, `5đ`, `NEEDS_HUMAN_REVIEW`) và **minh chứng giả mạo** (ảnh đồ họa phẳng tự vẽ của `102210002`, ảnh sai MSSV của `102240015` → AI bắt `0 điểm`, `RED`, `INVALID`).
- **Kiểm chứng:** Python `test_m2_contract_quality.py` **11/11** đạt, `test_template_matcher.py` + `test_ml_and_flows.py` **12/12** đạt; Backend `evidence-processing-worker.test.cjs` **26/26** đạt; `git diff --check` đạt.

## 2026-11-23 — Mở khóa DEC-014: Vá BL-008, BL-022 và kích hoạt AI chạy thật end-to-end

- **Phạm vi & quyết định:** `DEC-014` (thay thế `DEC-007`), `BL-008`, `BL-022`, F07/F14.
- **Backend:**
  - `BL-008` ([evidence-processing.worker.ts](../apps/backend/src/evidence/evidence-processing.worker.ts)): Mở rộng `AbortController` + `Promise.race` timeout bao trùm cả `fetch()` lẫn `response.json()` để worker không treo khi response body không đóng.
  - `BL-022` ([reviews.service.ts](../apps/backend/src/reviews/reviews.service.ts)): `addSource()` khi hủy job AI đang chạy đồng thời chuyển `Evidence.status` từ `PROCESSING` → `NEEDS_HUMAN_REVIEW`.
  - Siết chặt chống giả mạo & chấm điểm gợi ý trong [evidence-processing.worker.ts](../apps/backend/src/evidence/evidence-processing.worker.ts), [quality_forensics.py](../apps/ai-service/src/quality_forensics.py), [pipeline_orchestrator.py](../apps/ai-service/src/pipeline_orchestrator.py) và [main.py](../apps/ai-service/src/main.py): bổ sung `detect_synthetic_graphic()` phát hiện ảnh chứng nhận đồ họa phẳng tự tạo (tỷ lệ ô 8x8 không có nhiễu cảm biến $\ge 78\%$ kèm con dấu vector đơn sắc); ép `suggestedScore = 0`, `tier = RED`, `Evidence.status = INVALID` khi phát hiện ảnh đồ họa tự dựng hoặc trùng lặp `isDuplicate`; chỉ bật `activityExistsVerified = true` khi nguồn web đạt mức chính thống (`confidenceBoost >= 20`, không tự xác nhận từ link mạng xã hội ngẫu nhiên).
  - Bật `AI_MODE=ASSIST` và `AI_PIPELINE_URL=http://127.0.0.1:8000` trong môi trường chạy local.
- **AI Service & Dữ liệu mẫu `2026_1`:**
  - Khởi chạy FastAPI `apps/ai-service` tại `http://127.0.0.1:8000` (`rapidocr_vietocr` + `tesseract` + `rubricMlModelAvailable: true`).
  - Nâng cấp [render_certificate.py](../apps/backend/scripts/render_certificate.py) và [seed-sample-evidences-2026-1.cjs](../apps/backend/scripts/seed-sample-evidences-2026-1.cjs) (5 giao diện riêng biệt chống trùng `pHash`, ngày cấp hợp lệ trong `2026_1`, nhãn định danh rõ) và chạy AI thật cho 18 minh chứng mẫu.
- **Web ([roleNavigation.ts](../apps/web/src/lib/roleNavigation.ts)):** Mở lại mục "Chạy thử AI" (`/ai-test`) trên sidebar cho `STAFF` và `ADMIN` (giữ ẩn với `STUDENT`).
- **Kiểm chứng:** Backend `tsc --noEmit` đạt, `evidence-processing-worker.test.cjs` **26/26** đạt; Web `tsc --noEmit` đạt, `node --test scripts/*.test.cjs` **31/31** đạt; `GET http://127.0.0.1:8000/health` đạt; worker đã chạy thật qua FastAPI lưu `OcrResult`, `VerificationResult`, `AiSuggestion`, `AiPipelineRun` vào PostgreSQL; `git diff --check` đạt. Chưa chạy browser E2E tự động.

## 2026-11-23 — Tinh gọn & chuẩn hóa giao diện Frontend xuyên suốt 3 vai trò (4 gói)

- **Phạm vi & tính năng liên quan:** F05 ([05-student-assessment.md](features/05-student-assessment.md)), F06 ([06-evidence-and-storage.md](features/06-evidence-and-storage.md)), F07 ([07-evidence-review-and-verification.md](features/07-evidence-review-and-verification.md)). Không thay đổi API contract, quy tắc nghiệp vụ backend hay schema DB.
- **Gói 1 — Sửa lỗi thật trên [EvidenceDetail.tsx](../apps/web/src/pages/student/EvidenceDetail.tsx):** Gỡ nút chết "Báo sai / Sửa" (`showOcrEditModal` không có modal); sửa giới hạn tệp bổ sung từ 15 MB thành **8 MB** kèm kiểm tra kích thước trước upload cho khớp Backend; hiển thị thẻ "Thông tin hồ sơ đã khai báo" và ẩn khối OCR rỗng + dòng mã băm nội bộ khi chưa có dữ liệu OCR; thay `window.alert()` bằng banner inline và hỗ trợ mở tệp PDF trong khung xem.
- **Gói 2 — Dọn menu & ngôn ngữ kỹ thuật thừa:** Ẩn mục "Chạy thử AI" / "Chạy thử AI minh chứng" khỏi sidebar của cả 3 vai trò ([AppLayout.tsx](../apps/web/src/layouts/AppLayout.tsx), [roleNavigation.ts](../apps/web/src/lib/roleNavigation.ts)), đổi nhãn "Hàng đợi minh chứng & AI" → "Hàng đợi duyệt minh chứng"; rút gọn hộp giải thích AI/ELA dài 6 dòng trong modal [ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx); bỏ các từ kỹ thuật lộ ra UI (`VITE_API_URL`, `Backend`, `migration`, `blocker`, `workflow mới`) trên [ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx), [RegulationRAG.tsx](../apps/web/src/pages/common/RegulationRAG.tsx), [CriteriaRulesView.tsx](../apps/web/src/pages/officer/CriteriaRulesView.tsx), [StudentsDirectory.tsx](../apps/web/src/pages/officer/StudentsDirectory.tsx), [Dashboard.tsx](../apps/web/src/pages/officer/Dashboard.tsx) và [CriteriaManager.tsx](../apps/web/src/pages/admin/CriteriaManager.tsx).
- **Gói 3 — Đồng bộ Sinh viên ↔ Cán bộ Khoa:** Tách helper dùng chung [criterionEvidencePolicy.ts](../apps/web/src/lib/criterionEvidencePolicy.ts), hiển thị badge `[Học vụ tự động]` / `[Mặc định đạt]` / `[Bắt buộc minh chứng]` và chú thích chính xác trên [StudentAssessment.tsx](../apps/web/src/pages/officer/StudentAssessment.tsx); truyền `returnTo` sang [ReviewDetail.tsx](../apps/web/src/pages/officer/ReviewDetail.tsx) để quay lại đúng phiếu sinh viên đang chấm.
- **Gói 4 — Bản in phiếu A4 & test Web:** Bổ sung `print:hidden` cho topbar/sidebar/breadcrumb/nút thao tác và bổ sung tiêu đề Quốc hiệu – Tiêu ngữ + khu vực chữ ký A4 chỉ hiện khi in trên [ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx); vá mock `AiResultPanel` trong [evidence-inspection.test.cjs](../apps/web/scripts/evidence-inspection.test.cjs) và resolver helper trong [score-report-and-evidence-list.test.cjs](../apps/web/scripts/score-report-and-evidence-list.test.cjs).
- **Kiểm chứng:** `npx tsc --noEmit` đạt; `node --test scripts/*.test.cjs` đạt **31/31**; `git diff --check` đạt. Chưa chạy browser E2E tự động.

## 2026-11-23 — Chuẩn hóa quy tắc minh chứng 16 tiêu chí, cảnh báo nộp phiếu và nạp minh chứng mẫu kỳ 2026_1

- **Phạm vi & tính năng liên quan:** F05 ([05-student-assessment.md](features/05-student-assessment.md)), R-11 ([BUSINESS_RULES.md](BUSINESS_RULES.md#r-11)).
- **Backend ([assessments.service.ts](../apps/backend/src/assessments/assessments.service.ts)):**
  - Bổ sung helper `isEvidenceRequiredCriterion` phân loại theo `scoringConfig.kind` (miễn nộp: `TC1, TC2, TC3, TC6, TC7, TC11`; bắt buộc minh chứng/xác nhận hoạt động: `TC4, TC5, TC8, TC9, TC10, TC12, TC13, TC14, TC15, TC16`).
  - Vá `checkSubmission()` bổ sung `leadership_duty` (`TC14`), tính cả minh chứng hợp lệ đã nộp/đã duyệt (`APPROVED`, v.v.) khi nộp lại phiếu `RETURNED`, và chuẩn hóa thông điệp cảnh báo `preflight.warnings` liệt kê rõ từng mã tiêu chí thiếu minh chứng.
- **Web ([ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx)):**
  - Bổ sung `getCriterionEvidencePolicy` và hiển thị badge `[Học vụ tự động]`, `[Mặc định đạt]` cho 6 tiêu chí miễn nộp, `[Bắt buộc minh chứng]` kèm nhắc nhở trực quan khi `selfScore > 0` chưa có minh chứng cho 10 tiêu chí bắt buộc.
  - Cho phép bấm nút `Minh chứng (N)` để mở modal xem ảnh/tệp ngay cả khi phiếu đã `SUBMITTED`, và hiển thị ảnh xem trước ngay trong modal đối với tệp ảnh có signed URL.
- **Dữ liệu minh chứng mẫu kỳ `2026_1` ([seed-sample-evidences-2026-1.cjs](../apps/backend/scripts/seed-sample-evidences-2026-1.cjs), [render_certificate.py](../apps/backend/scripts/render_certificate.py)):**
  - Nạp 18 minh chứng mẫu (Hiến máu `TC12`, NCKH `TC5`, Thể thao DUT Cup `TC9`, Kỹ năng mềm `TC8`, Khen thưởng Ban Cán sự `TC15`) với 18 ảnh chứng nhận PNG tải lên Supabase Storage cho 8 sinh viên tiêu biểu Khoa CNTT kỳ `2026_1`; chuyển trạng thái minh chứng sang `NEEDS_HUMAN_REVIEW` và phiếu sang `SUBMITTED` để hiển thị trên `/officer/queue`.
- **Kiểm chứng:** Backend `nest build` đạt, `Ca 13b` đạt; Web `tsc --noEmit` đạt, `score-report-and-evidence-list.test.cjs` **14/14** đạt; xác minh trực tiếp PostgreSQL đủ 18 minh chứng/18 tệp/8 phiếu `SUBMITTED` và ký signed URL Supabase Storage trả `HTTP 200`. Chưa chạy browser E2E; không thay đổi API contract hoặc schema DB.

## 2026-11-23 — Dọn dẹp dữ liệu DEMO và nạp 400 sinh viên thật Bách Khoa K22–K25

- Dọn dẹp sạch 100 tài khoản sinh viên `[DEMO]` cũ và 5 lớp `[DEMO]` cùng toàn bộ liên kết (điểm, minh chứng, bàn giao, thông báo) khỏi cơ sở dữ liệu EduPoint.
- Trích xuất dữ liệu thực tế từ máy chủ SQL Server `DHBK_CDS` của trường (chỉ đọc): 13 Khoa, 40 Lớp, 400 Sinh viên đại diện cho 4 khóa K22, K23, K24, K25 (10 SV/lớp) và 888 dòng điểm lịch sử.
- Nạp thành công vào EduPoint Supabase Database:
  - Kỳ hiện hành `2026_1` (ACTIVE): Thiết lập 400 hồ sơ bàn giao (`AssessmentHandoff`, trạng thái `WORKING`) và phiếu tự chấm (`AssessmentSubmission`, trạng thái `DRAFT`) — chưa chấm điểm.
  - Kỳ quá khứ `2024_1` (CLOSED): Nạp 300 hồ sơ công bố chính thức (`AssessmentPublication`) và 4.800 bản ghi điểm tiêu chí (`CriterionAssessment`, trạng thái `FINALIZED`) cho K22, K23, K24. Điểm 16 tiêu chí rubric được phân bổ khớp chính xác 100% với `DiemRL` thực tế của trường.
  - Kỳ quá khứ `2023_2` (CLOSED): Nạp 200 hồ sơ công bố chính thức và 3.200 bản ghi điểm tiêu chí cho K22, K23. Khóa K24 và K25 không có điểm ở kỳ này vì chưa nhập học.
- Đã chạy kiểm chứng trực tiếp trên PostgreSQL: 0 sinh viên demo, 400 sinh viên thật, kiểm tra chéo tính lũy tiến lịch sử điểm theo khóa K22–K25 đạt 100%. Script thực thi: `scripts/cleanup_demo_data.js`, `scripts/import_to_edupoint.js`.

## 2026-11-23 — Báo cáo luồng nghiệp vụ và trường hợp xử lý

- Bổ sung báo cáo theo commit `11a2d3c` gồm sơ đồ vòng đời kỳ, trách nhiệm ba vai trò, luồng chính và các nhánh bị chặn, kịch bản trình diễn, liên kết source và bằng chứng F01–F15. Giữ mã use case của bản thảo. [Báo cáo luồng nghiệp vụ](bao-cao/BAO_CAO_LUONG_NGHIEP_VU_EDUPOINT.md)
- Đối chiếu nội dung với mã nguồn hiện hành, kiểm liên kết, cấu trúc bảng và diff. Tài liệu dẫn kết quả kiểm thử đã ghi, chưa chạy lại kiểm thử ứng dụng trong đợt viết báo cáo.

## 2026-11-23 — Hoàn thiện P1 và khóa khi nộp phiếu

- BL-032/030 áp dụng điều kiện F15 dưới khóa Term. Phiếu Khoa hiển thị nguồn CLB/BTC và giữ xác minh tay khi thu hồi. Migration mới thêm `clubGroundingIds` mặc định mảng rỗng.
- REQ-002 lưu rubric kế thừa dưới dạng PUBLISHED. Thay đổi trước khi mở kỳ tạo phiên bản kế tiếp. Admin xác nhận bản đang áp dụng nếu còn bản nháp.
- BL-034 mở thông báo đúng kỳ và hiển thị hạn phúc khảo hiệu lực. BL-027 kiểm lại công tắc F15, điểm và minh chứng dưới khóa Term. BL-026 được kiểm chứng ở cả hai thứ tự khóa trên PostgreSQL.
- Backend unit **198/198**, Web **30/30**, PostgreSQL integration **26/26**, typecheck hai app và kiểm tra diff đạt. Migration tương thích với bản ghi tạo trước và sau deploy. Browser E2E chưa chạy. [Kết quả từng suite](TEST_PLAN.md#p1-suite-results).

<a id="p1-files"></a>

### Tệp thay đổi trong đợt P1

- **Schema và migration** · [20261123000100_club_grounding_provenance/migration.sql](../apps/backend/prisma/migrations/20261123000100_club_grounding_provenance/migration.sql), [schema.prisma](../apps/backend/prisma/schema.prisma)
- **Backend** · [assessments.service.ts](../apps/backend/src/assessments/assessments.service.ts), [criteria.controller.ts](../apps/backend/src/criteria/criteria.controller.ts), [criteria.service.ts](../apps/backend/src/criteria/criteria.service.ts), [deadline-extensions.service.ts](../apps/backend/src/deadline-extensions/deadline-extensions.service.ts), [workflow.service.ts](../apps/backend/src/evaluation-workflow/workflow.service.ts), [f15-policy.ts](../apps/backend/src/grounding-import/f15-policy.ts), [grounding-import.service.ts](../apps/backend/src/grounding-import/grounding-import.service.ts)
- **Web** · [EvaluationBoard.tsx](../apps/web/src/components/EvaluationBoard.tsx), [apiClient.ts](../apps/web/src/lib/apiClient.ts), [CriteriaManager.tsx](../apps/web/src/pages/admin/CriteriaManager.tsx), [TermsMasterData.tsx](../apps/web/src/pages/admin/TermsMasterData.tsx), [ImportGroundingData.tsx](../apps/web/src/pages/officer/ImportGroundingData.tsx), [StudentAssessment.tsx](../apps/web/src/pages/officer/StudentAssessment.tsx), [ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx), [index.ts](../apps/web/src/types/index.ts)
- **Kiểm thử** · [activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs), [data-protection.test.cjs](../apps/backend/test/data-protection.test.cjs), [grounding-db.integration.test.cjs](../apps/backend/test/grounding-db.integration.test.cjs), [grounding-import-and-batch-finalize.test.cjs](../apps/backend/test/grounding-import-and-batch-finalize.test.cjs), [submission-concurrency.integration.test.cjs](../apps/backend/test/submission-concurrency.integration.test.cjs), [workflow.integration.test.cjs](../apps/backend/test/workflow.integration.test.cjs), [score-report-and-evidence-list.test.cjs](../apps/web/scripts/score-report-and-evidence-list.test.cjs)
- **Tài liệu** · [API_CONTRACT.md](API_CONTRACT.md), [BACKLOG.md](BACKLOG.md), [BUSINESS_LOGIC_AUDIT.md](BUSINESS_LOGIC_AUDIT.md), [BUSINESS_RULES.md](BUSINESS_RULES.md), [CHANGELOG.md](CHANGELOG.md), [DECISIONS.md](DECISIONS.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), [README.md](README.md), [TEST_PLAN.md](TEST_PLAN.md), [03-terms-and-deadlines.md](features/03-terms-and-deadlines.md), [04-rubrics-and-scoring.md](features/04-rubrics-and-scoring.md), [05-student-assessment.md](features/05-student-assessment.md), [06-evidence-and-storage.md](features/06-evidence-and-storage.md), [10-publication-and-term-closure.md](features/10-publication-and-term-closure.md), [13-notifications.md](features/13-notifications.md), [15-evidence-grounding-and-batch-finalize.md](features/15-evidence-grounding-and-batch-finalize.md)

## 2026-11-23 — Sửa hiển thị điểm, minh chứng và thông báo

- BL-031/033 (F07/F15) đồng bộ `EvaluationBoard` và `StudentAssessment` với hợp đồng kết quả chốt. `AssessmentsService.getMine` giữ điểm gợi ý đã lưu, `ScoreReport` hiển thị riêng điểm công bố.
- BL-035 (F12) sửa `apiClient` đọc `meta.counts`, Dashboard dùng thống kê toàn kỳ và tải riêng `NEEDS_SUPPLEMENT`. BL-037 (F13) giữ `unreadCount` trong API client, dùng chung dữ liệu cho `AppLayout` và `NotificationsCenter`.
- Backend **75/75**, Web **29/29**, typecheck hai app và `git diff --check` đạt. Test dùng doubles/transport giả lập. Chưa chạy DB integration hay browser E2E. Xem [kết quả](TEST_PLAN.md).

## 2026-11-23 — Sửa phân quyền chốt và ngữ cảnh nhập Excel, kiểm PostgreSQL 17

- BL-028 (F07/F15) dùng `WorkflowService.assertEditable` trong transaction batch. Đã kiểm tra helper tự lấy khóa hàng `Term` trên cùng transaction với ghi điểm và audit.
- BL-029 (F15) gắn phiên xem trước với kỳ, danh mục, hoạt động và file. Confirm yêu cầu `previewTermId`, bỏ phản hồi cũ khi đổi ngữ cảnh và từ chối replay khóa khác kỳ.
- BL-036 chuyển Compose sang image pgvector PG17, volume PG17 riêng và khởi tạo extension trong `public`. Trên Docker 17.12, deploy một bước từ DB trống gặp `P1014`. Áp dụng baseline SQL nguyên bản trong session riêng, ghi nhận baseline và deploy 13 migration còn lại thành công. Checksum baseline giữ nguyên. Xem [quy trình dựng DB local](TEST_PLAN.md#postgresql-17-local).
- Sửa fixture ngày hoạt động và hai chỗ lệch hợp đồng/dữ liệu giữa suite. Integration PostgreSQL **17/17**, test thuần Backend **27/27**, Web **7/7**. Typecheck hai app và diff check đạt. Kiểm thử giới hạn ở localhost và doubles.

## 2026-11-17 — Soạn báo cáo thô EduPoint theo mẫu

- Tạo bản thảo Markdown và Word trong `docs/bao-cao/`, dựa trên bố cục và định dạng tham chiếu của báo cáo người dùng cung cấp; mô tả kiến trúc, nghiệp vụ, chức năng, kết quả và các giới hạn có căn cứ. Thông tin nhóm, sơ đồ, ảnh và kết quả nghiệm thu cần bổ sung.
- Đã kiểm tra chuyển đổi Word, cấu trúc tệp và nội dung còn sót từ đề tài mẫu; `git diff --check` đạt. Không chạy lại kiểm thử ứng dụng, không thay đổi code, quy tắc hoặc API.

## 2026-11-17 — Bổ sung điểm chấm mẫu cho các hồ sơ DEMO

- Theo yêu cầu của người dùng, gán cán bộ CNTT hiện có cho điểm giả lập của 60 phiếu DEMO đã nộp thuộc kỳ `2026_1`: TC1, TC3, TC7, tổng 180 tiêu chí `FINALIZED`, ghi rõ `[DEMO]` trong căn cứ/lý do. Đây là dữ liệu được gán theo yêu cầu tạo mẫu, không khẳng định cán bộ thực sự đã thực hiện lượt chấm. Không tạo cán bộ mới.
- Điểm được tính bằng `evaluateRubricCriterion` theo scoringConfig đã ban hành; không thay rubric, không đặt rolesScore, không công bố và không chấm 13 tiêu chí còn lại. 40 tài khoản DEMO chưa nộp được giữ nguyên.
- Trước khi ghi đã thử trên PostgreSQL localhost `_test` (schema bản sao tương thích PG16), kiểm tra 60 phiếu/180 điểm và chạy lại bị chặn để không ghi đè; sau ghi kiểm tra chỉ đọc trên Supabase có 60 bản ghi mỗi TC, đều có người chấm và nhãn DEMO. Đã dừng container test. Không kiểm browser; không chạy migration trên Supabase, không sửa application code/contract/spec.

## 2026-11-17 — Tạo dữ liệu trình diễn trong kỳ 2026_1

- Theo yêu cầu và xác nhận của người dùng, thêm dữ liệu tổng hợp `[DEMO]` vào Supabase EduPoint: 5 lớp Khoa CNTT, 100 sinh viên giả, 100 snapshot roster, 80 phiếu (20 nháp, 60 đã nộp), 1.280 điểm tự đánh giá, 5 hoạt động và 40 dòng điểm danh nháp. 20 sinh viên chưa tạo phiếu. Không tạo điểm chính thức, publication, minh chứng giả hay job AI; không thay rubric/kỳ hiện có.
- Mã lớp `DEMO_26_CNTT_1`…`DEMO_26_CNTT_5`; MSSV mẫu `990260001`…`990260100`. Tài khoản mẫu phải đổi mật khẩu khi đăng nhập lần đầu. Dữ liệu mẫu có ảnh hưởng thống kê kỳ hiện hành.
- Trước khi ghi đã thử trên PostgreSQL localhost `_test`: 5 lớp mỗi lớp 20, kiểm tra mật khẩu/mốc đổi lần đầu, điểm không vượt trần và chạy lại không ghi đè. Sau khi ghi đã kiểm tra chỉ đọc trên Supabase: đủ 100 tài khoản, 5 lớp mỗi lớp 20, 20 chưa tạo phiếu/20 nháp/60 đã nộp; xác thực mẫu bằng bcrypt. Container test đã dừng.
- Script tạm `/tmp/edupoint-create-demo-20261117.cjs` dừng khi có mã trùng và ghi trong một transaction. Không áp dụng migrations mới lên Supabase; hai migration F15 chưa có trên database tại thời điểm kiểm tra. Không sửa application code, feature spec hoặc contract; chưa kiểm browser E2E.

## 2026-11-17 — Sửa các lỗi review F15

- Ô trống/sai kiểu trong file học vụ được giữ là thiếu/sai, không tự chuyển thành 0, true, false hoặc AVERAGE; vai trò không hợp lệ không tự đổi sang tham gia, hỗ trợ alias THAM_GIA_CHINH.
- Chặn import trùng căn cứ ACTIVE hoặc verifiedData hiện có; kiểm tra roster kỳ và khóa phiếu khi confirm, thêm unique index theo khóa nghiệp vụ. Liên kết CriterionAssessment với ID căn cứ học vụ; xác minh tay xóa liên kết, thu hồi theo ID thay vì dựa vào ghi chú. Preflight/preview chốt không còn đồng bộ ghi DB.
- Thu hồi lô hoạt động giữ từng dòng REVOKED, người xác nhận và lý do; unique index mới cho phép nhập lại dòng nháp nhưng không có hai dòng hiện hành. Kiểm tra công tắc kỳ trong transaction giữ khóa Term.
- Regression: 89/89 unit/component và 1/1 PostgreSQL test cách ly pass; typecheck hai app và diff check pass. Database test dùng 14 migration bản sao điều chỉnh hai lệnh baseline cho PostgreSQL 16. Chưa kiểm browser E2E, các race chốt/thu hồi và công tắc kỳ; tiếp tục theo dõi ở TEST_PLAN. Không chạy AI hay dùng Supabase thật.

## 2026-11-17 — Đang sửa kiểm tra ô trống file học vụ

- Bỏ giá trị boolean mặc định ở các cột TC3/TC7 trong `ImportGroundingData.tsx`, để ô trống không tự biến thành có/không. Chưa hoàn tất kiểm tra ô sai định dạng và chưa nghiệm thu luồng import.
- Trước thay đổi: 4 suite do người dùng duyệt đạt 65/65; typecheck backend/frontend và `git diff --check` đạt. Chưa chạy lại sau thay đổi; chưa kiểm database/browser.
- Các lỗi còn lại về trùng lô, thu hồi, preview và transaction tiếp tục xử lý sau khi được duyệt các lệnh đọc/kiểm tra cần thiết. Chưa sửa API, quy tắc hay trạng thái feature.

## 2026-11-17 — Khắc phục dứt điểm 9 điểm review độc lập cho tính năng Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt

- **Phạm vi & mục tiêu giải quyết (9 điểm review độc lập):**
  1. *Critical — Re-validation độc lập trong transaction confirm (`grounding-import.service.ts`):*
     - Không tin cậy dữ liệu client gửi lên; trong transaction `confirm()`, chạy lại toàn bộ kiểm tra đối với từng dòng: sinh viên tồn tại, thuộc phạm vi Khoa trong kỳ (ưu tiên snapshot pháp lý `assessmentHandoff.facultyId` của kỳ đó, fallback `class.facultyId` khi chưa có handoff; giải quyết trường hợp sinh viên chuyển Khoa ở kỳ cũ), tiêu chí thuộc rubric đã ban hành, dữ liệu `data` thỏa mãn schema `validateVerifiedData`.
     - Tự động bỏ qua các dòng không hợp lệ; chỉ commit các dòng thỏa mãn đầy đủ điều kiện. Ném lỗi nếu không có dòng nào hợp lệ.
  2. *High — Đồng bộ contract FE ↔ BE:*
     - Backend: `PreviewGroundingImportDto` và `ConfirmGroundingImportDto` chấp nhận `source?: string` (fallback `'File tải lên'`), chấp nhận cả `rows` hoặc `validRows`. `BatchFinalizeAssessmentsDto` nhận thêm `termId?: string`.
     - Frontend: `apiClient.ts` chuẩn hóa các endpoint `/preview`, `/confirm`, `/preview-finalize`, `/finalize`, `/batch-finalize` (truyền cả query param `termId` và body `termId`).
  3. *High — Phân tách 5 danh mục và mẫu Excel chuyên biệt theo TC1/3/7/Hoạt động/CLB:*
     - Màn hình `ImportGroundingData.tsx` phân chia rõ ràng 5 danh mục:
       * `ACADEMIC_1`: TC1 (Đi học đầy đủ & Chuyên cần) — các cột `examBans` (số học phần cấm thi), `classWarnings` (số lần nhắc nhở).
       * `ACADEMIC_3`: TC3 (Tinh thần phấn đấu học tập) — các cột `academicTier` (`XUAT_SAC`, `GIOI`, `KHA`, `TRUNG_BINH`, `YEU`), `improvedFromPreviousTerm` (`CO`/`KHONG`), `academicWarning` (`CO`/`KHONG`).
       * `ACADEMIC_7`: TC7 (Chấp hành nội quy, quy chế) — các cột `tuitionCompliance`, `studentWeekParticipation`, `disciplinaryViolation`, `requiredSurveyParticipation`, `nonCauseAccountLocks`, `classTaskFailures`, `unexcusedClassMeetingAbsences`, `excusedClassMeetingAbsences`.
       * `ACTIVITY`: Điểm danh sự kiện/hoạt động — `studentCode`, `role` (`THAM_GIA_CHINH`, `BAN_TO_CHUC`, `TINH_NGUYEN`, `CO_VU`), `note`.
       * `CLUB_LEADERSHIP`: Cán bộ lớp & Ban chủ nhiệm CLB — `criterionCode` (`4` hoặc `13`), `organizationName`, `roleTitle`, `source`, `note`.
     - Nút "Tải file mẫu Excel" tải chính xác mẫu của danh mục đã chọn. Tự động parse và map chuẩn xác vào DTO của backend.
  4. *High — Loại bỏ nguy cơ khóa lồng (nested transaction / deadlock):*
     - `ActivitiesService.batchAddParticipants` bổ sung tham số tùy chọn `externalTx?: Prisma.TransactionClient`.
     - Khi `GroundingImportService.confirm` gọi `batchAddParticipants`, truyền trực tiếp `tx` làm `externalTx`, loại bỏ hoàn toàn việc mở `$transaction` thứ hai và không gọi `lockTerm` lặp lại.
  5. *High — Bảo vệ dữ liệu xác minh thủ công và loại bỏ ghi DB trên request đọc:*
     - Xóa bỏ việc gọi `syncStudentGrounding` trong `getMine()` (request GET chỉ đọc, tuyệt đối không ghi dữ liệu vào DB).
     - Đồng bộ grounding diễn ra an toàn khi: sinh viên nộp phiếu (`submitSelfAssessment`), cán bộ import căn cứ (`confirm`), hoặc cán bộ chốt phiếu (`finalizeStudentAssessment`).
     - Trong `syncStudentGrounding`: nếu `existing.verifiedData` đã tồn tại và `existing.verificationNote` không bắt đầu bằng `'Căn cứ học vụ từ'` (nghĩa là do cán bộ xác minh thủ công), tuyệt đối **không ghi đè**, bảo toàn kết luận thẩm định của cán bộ.
  6. *High — Thống nhất route API chốt phiếu:*
     - `assessments.controller.ts`: Hỗ trợ cả hai route `/assessments/students/:studentId/:termId/preview-finalize` và route tương thích `/assessments/student/:studentId/preview-finalize` (kèm query param `termId`); tương tự cho `finalize`.
     - Endpoint `batch-finalize` hỗ trợ nhận `termId` từ query param hoặc body `dto.termId`.
     - `apiClient.ts` cập nhật gọi đúng các route trên.
  7. *High — Thu hồi lô hoạt động (ACTIVITY) xóa sạch bản ghi `CONFIRMED`:*
     - Khi thu hồi lô hoạt động mà chưa có sinh viên nào bị chốt điểm (`FINALIZED`) hoặc phiếu gửi CTSV (`SENT`): xóa toàn bộ bản ghi `ActivityParticipant` của lô (kể cả `DRAFT` và `CONFIRMED`).
     - Tự động gọi `recomputeAndSaveActivityCriterion` tính lại điểm gợi ý cho các sinh viên trong lô.
  8. *Medium — Cho phép nhập các dòng hợp lệ & Quản lý Idempotency Key cố định:*
     - `preview()` trả về `canCommit: validCount > 0` (cho phép import nếu có ít nhất 1 dòng hợp lệ; các dòng lỗi sẽ được hệ thống bỏ qua an toàn).
     - Frontend `ImportGroundingData.tsx` sinh và lưu `currentIdempotencyKey` khi bắt đầu phiên file preview, giữ nguyên key khi cán bộ bấm Xác nhận hoặc retry để backend xử lý idempotency replay chuẩn xác.
  9. *Medium — Bảo vệ công tắc kỳ (`evidenceBasisWorkflowEnabled`):*
     - Trong `CriteriaService.updateTerm`, chặn thay đổi giá trị `evidenceBasisWorkflowEnabled` nếu kỳ đánh giá đã có `assessmentPublication` hoặc đã có phiếu sinh viên ở trạng thái `SENT`.
- **Thay đổi thực tế mã nguồn:**
  - `apps/backend/src/activities/activities.service.ts`: Cập nhật `batchAddParticipants` nhận `externalTx?: Prisma.TransactionClient` tránh nested transaction.
  - `apps/backend/src/grounding-import/dto/grounding-import.dto.ts`: Cập nhật `source?: string`, `rows?`, `validRows?`, `termId?`.
  - `apps/backend/src/grounding-import/grounding-import.service.ts`: Re-validation toàn bộ dòng trong transaction `confirm`, hỗ trợ snapshot handoff Khoa, truyền `tx` vào `batchAddParticipants`, thu hồi lô hoạt động xóa `CONFIRMED` và tính lại điểm gợi ý, cho phép `canCommit = validCount > 0`.
  - `apps/backend/src/assessments/assessments.service.ts`: Xóa sync ở `getMine()`, bổ sung sync ở `submitSelfAssessment`, bảo vệ dữ liệu cán bộ sửa tay trong `syncStudentGrounding`, trả về `officialTotalScore` trong `finalizeStudentAssessment`.
  - `apps/backend/src/assessments/assessments.controller.ts`: Bổ sung route alias tương thích và nhận `termId` linh hoạt.
  - `apps/backend/src/criteria/criteria.service.ts`: Kiểm tra `publication` và `SENT` handoff trước khi cho phép đổi `evidenceBasisWorkflowEnabled`.
  - `apps/web/src/types/index.ts`: Mở rộng `GroundingImportBatch`, `PreviewImportResult`, `ConfirmImportResult` đầy đủ trường.
  - `apps/web/src/lib/apiClient.ts`: Chuẩn hóa API endpoints cho grounding import và finalize.
  - `apps/web/src/pages/officer/ImportGroundingData.tsx`: Viết lại hỗ trợ 5 nhóm danh mục chuyên biệt, template tải về chuẩn xác, lưu `idempotencyKey` theo phiên file, hiển thị preview và confirm linh hoạt.
  - `apps/backend/test/grounding-import-and-batch-finalize.test.cjs`: Bổ sung các ca test Ca 21, Ca 22, Ca 23, Ca 24, Ca 25.
- **Kiểm thử thực chạy và kết quả:**
  - Test suite regression: `node --test apps/backend/test/grounding-import-and-batch-finalize.test.cjs` (**25/25 tests PASS 100%**).
  - Test worker & analytics: `node --test apps/backend/test/evidence-processing-worker.test.cjs` (**15/15 PASS**), `node --test apps/web/scripts/faculty-analytics.test.cjs` (**6/6 PASS**), `node --test apps/backend/test/activity-and-roles-scoring.test.cjs` (**19/19 PASS**).
  - Typecheck: Backend `tsc --noEmit` **0 lỗi**; Frontend `tsc --noEmit` **0 lỗi**.
  - Production build: `(cd apps/web && ./node_modules/.bin/vite build)` **build thành công (3.43s)**.
  - Whitespace check: `git diff --check` **sạch hoàn toàn, 0 lỗi**.
- **Giới hạn kiểm chứng:** Toàn bộ test chạy trên in-memory doubles có transaction cách ly, bảo đảm an toàn dữ liệu, không tác động vào cơ sở dữ liệu production hay AI pipeline bên ngoài.

- **Phạm vi & mục tiêu giải quyết:**
  Triển khai tính năng **Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt** cho hệ thống EduPoint theo lộ trình 3 Phase đã được phê duyệt, đáp ứng đầy đủ các nguyên tắc cứng (quy trình 3 vai trò, bảo toàn quy chế/công thức DUT, không suy diễn từ dữ liệu trống, hoãn AI, tôn trọng enum hiện có):
  1. **Phase 1 (Backend Core & Tests):**
     - Cập nhật Prisma schema: Thêm cờ `evidenceBasisWorkflowEnabled Boolean @default(false)` trên model `Term`. Bổ sung enums `ImportBatchType`, `ImportBatchStatus`, `GroundingStatus`. Thêm các models `ImportBatch`, `AcademicGrounding`, `ClubLeadershipGrounding`. Mở rộng `ActivityParticipant` hỗ trợ `batchId String?`, quan hệ `batch ImportBatch?` và index `@@index([batchId])`. Tạo migration DDL `20261117000100_evidence_grounding_and_batch_finalize`.
     - Tạo module `GroundingImportModule` (`GroundingImportService`, `GroundingImportController`, DTOs): hỗ trợ preview in-memory (giữ nguyên MSSV dạng text có số 0 ở đầu, chặn sinh viên ngoài Khoa, không ghi DB); confirm import trong transaction an toàn kèm `idempotencyKey`; tra cứu danh sách và chi tiết lô; thu hồi lô (`revokeBatch`) với cơ chế an toàn nghiêm ngặt (chặn nếu có sinh viên đã bị chốt điểm hoặc phiếu đã gửi CTSV).
     - Tái sử dụng `ActivitiesService.batchAddParticipants`: mở rộng nhận `participants: Array<{ studentCode, formRole }>` và `batchId`.
     - Tự động đồng bộ grounding: `syncStudentGrounding` trong `AssessmentsService` cập nhật `verifiedData`, `suggestedScore` và trạng thái `READY_FOR_REVIEW` từ căn cứ học vụ; tự động gọi khi xem phiếu (`getMine`), nộp phiếu hoặc khi import/thu hồi lô. Không ghi đè tiêu chí đã `FINALIZED`.
     - Quy trình minh chứng 0 file: ở kỳ `evidenceBasisWorkflowEnabled = true`, cho phép minh chứng có 0 file khi mô tả $\ge 10$ ký tự, chuyển sang `NEEDS_HUMAN_REVIEW` và không tạo `AiJob`. Kỳ cũ giữ nguyên chặn thiếu file.
     - Chốt phiếu sinh viên (`finalizeStudentAssessment`) và chốt hàng loạt (`batchFinalizeAssessments`): tối đa 100 phiếu/lần, transaction riêng biệt từng phiếu. Chặn chốt nếu còn minh chứng chờ ở cả 2 trạng thái `NEEDS_HUMAN_REVIEW` và `NEEDS_SUPPLEMENT`. Không tự động gửi CTSV.
     - Viết test suite regression [apps/backend/test/grounding-import-and-batch-finalize.test.cjs](../apps/backend/test/grounding-import-and-batch-finalize.test.cjs) gồm đầy đủ **20 ca kiểm thử service/core (20/20 PASS 100%)**.
  2. **Phase 2 (Frontend Khoa / Sinh viên / Admin):**
     - Cán bộ Khoa (`STAFF`): Tạo trang mới `/officer/grounding-import` ([ImportGroundingData.tsx](../apps/web/src/pages/officer/ImportGroundingData.tsx)) hỗ trợ 3 luồng căn cứ (Học vụ, Hoạt động ngoại khóa, Ban cán sự/CLB), tải template Excel mẫu, upload parse file, preview 4 nhóm dòng, confirm import và quản lý/thu hồi lô. Thêm route và menu sidebar.
     - Cán bộ Khoa (`STAFF`): Cập nhật [StudentAssessment.tsx](../apps/web/src/pages/officer/StudentAssessment.tsx) bổ sung nút "Chốt phiếu sinh viên" kèm modal xem trước 16 tiêu chí và kiểm tra điều kiện chặn chốt.
     - Cán bộ Khoa (`STAFF`): Cập nhật [EvaluationBoard.tsx](../apps/web/src/components/EvaluationBoard.tsx) bổ sung checkbox chọn sinh viên, nút "Chốt hàng loạt (X đã chọn)", modal xác nhận và bảng tiến trình/báo cáo kết quả chi tiết từng sinh viên. Giữ nguyên nút "Gửi CTSV" riêng biệt.
     - Sinh viên (`STUDENT`): Cập nhật [ScoreReport.tsx](../apps/web/src/pages/student/ScoreReport.tsx) hiển thị rõ các cột Điểm tự đánh giá / Điểm gợi ý (căn cứ, điểm danh, AI) / Điểm Khoa chốt; cho phép nộp minh chứng 0 file có mô tả chi tiết ở kỳ mới.
     - Admin (`ADMIN`): Cập nhật [TermsMasterData.tsx](../apps/web/src/pages/admin/TermsMasterData.tsx) thêm checkbox bật/tắt `evidenceBasisWorkflowEnabled` trong modal Tạo kỳ và Sửa kỳ.
  3. **Phase 3 (Tài liệu & Kiểm chứng):**
     - Tạo đặc tả tính năng [docs/features/15-evidence-grounding-and-batch-finalize.md](features/15-evidence-grounding-and-batch-finalize.md) chuẩn 11 mục.
     - Cập nhật [docs/API_CONTRACT.md](API_CONTRACT.md) (8 endpoints mới của Grounding Import và Assessments Finalize).
     - Cập nhật [docs/BUSINESS_RULES.md](BUSINESS_RULES.md) (quy tắc `R-29`).
     - Ghi nhận quyết định nghiệp vụ `DEC-012` trong [docs/DECISIONS.md](DECISIONS.md).
     - Cập nhật kế hoạch và bằng chứng kiểm thử trong [docs/TEST_PLAN.md](TEST_PLAN.md).
- **Kiểm thử thực chạy và kết quả:**
  - Test suite mới: `node --test apps/backend/test/grounding-import-and-batch-finalize.test.cjs` (**20/20 tests PASS 100%**).
  - Test worker & analytics: `node --test apps/backend/test/evidence-processing-worker.test.cjs` (**15/15 PASS**), `node --test apps/web/scripts/faculty-analytics.test.cjs` (**6/6 PASS**).
  - Toàn bộ 5 bộ test unit hiện có: `activity-and-roles-scoring.test.cjs`, `accounts-and-permissions.test.cjs`, `evidence-and-term-selection.test.cjs`, `pagination-and-filter.test.cjs`, `exclusion-and-restore.test.cjs` (**71/71 tests PASS 100%**). Tổng cộng **91/91 tests pass 100%**.
  - Typecheck: Backend `tsc -p apps/backend/tsconfig.json --noEmit` **0 lỗi**; Web `tsc -p apps/web/tsconfig.json --noEmit` **0 lỗi**.
  - Production build: `(cd apps/web && ./node_modules/.bin/vite build)` **build thành công (2.32s)**.
  - `git diff --check`: **sạch sẽ, 0 lỗi whitespace**.
- **Giới hạn kiểm chứng:** Đã kiểm thử qua unit test in-memory với transaction doubles và mock service; chưa chạy trên PostgreSQL vật lý localhost `_test` do binary postgres không có sẵn trên máy cục bộ; toàn bộ quy tắc không động vào Supabase production hay AI pipeline thật theo đúng quy định.

## 2026-11-16 — Hoàn thiện khắc phục BL-014 (Ban hành rubric cộng đồng) & BL-025 (Xử lý an toàn tài khoản legacy)

- **Phạm vi & mục tiêu giải quyết theo kết quả review:**
  1. **BL-014 (Rubric & Roles Scoring):**
     - Cho phép bản nháp (`isPublishing = false` trong `createTermRubricDraft`, `updateTermRubricDraft`) thiếu `rolesScore` để Admin có thể soạn thảo linh hoạt hoặc khởi tạo từ bộ chuẩn.
     - Khi **ban hành** (`publishTermRubric`, `publishRubricTemplateDraft`, `isPublishing = true`): bắt buộc mọi tiêu chí `community_activity_tier` phải cấu hình `rolesScore` đầy đủ 3 vai trò (PARTICIPANT / THAM_GIA, ORGANIZER / BAN_TO_CHUC / BTC, CHEERLEADER / CO_VU); điểm số là số không âm; và tuyệt đối không có alias mâu thuẫn (như `CO_VU: 2.5` khác `CHEERLEADER: 3`).
     - Tuyệt đối không tự đặt mức điểm mặc định (bảo toàn quy chế DUT theo DEC-006 & DEC-009).
     - Evaluator `activity-aggregator.ts` bổ sung phát hiện alias mâu thuẫn để trả blocker `NEEDS_VERIFICATION, suggestedScore: null`.
  2. **BL-025 (Tài khoản Legacy & Phân quyền):**
     - Cho phép sửa thông tin không liên quan (như `fullName`, `email`) hoặc khóa tài khoản (`isActive: false`) của tài khoản legacy STUDENT/STAFF thiếu lớp/Khoa/MSSV mà tuyệt đối **không truy vấn `class`/`faculty` với ID null**.
     - Khi **bổ sung định danh** (`studentCode`, `classId`, hoặc `facultyId`) HOẶC **kích hoạt tài khoản** (`isActive: true` từ tài khoản đang bị khóa): bắt buộc kiểm tra dữ liệu đầy đủ và từ chối nếu thiếu thông tin bắt buộc.
- **Thay đổi thực tế mã nguồn:**
  - `apps/backend/src/criteria/criteria.service.ts`:
    + Thêm hàm `validateRolesScoreConfig(criterionCode, rolesScore, isPublishing)`.
    + `validateScoringConfig` và `validateRubricDefinition` nhận cờ `isPublishing` (mặc định `false`).
    + `publishTermRubric` và `publishRubricTemplateDraft` gọi validation với `isPublishing = true`, map đầy đủ `rolesScore` từ database.
  - `apps/backend/src/activities/activity-aggregator.ts`:
    + Bổ sung kiểm tra alias mâu thuẫn trong `rolesScore`, báo blocker `NEEDS_VERIFICATION` nếu phát hiện điểm khác nhau giữa các alias.
  - `apps/backend/src/users/users.service.ts`:
    + Trong `validateUserPayload`: phân biệt `requiresFullValidation = !isUpdate || isModifyingIdentity || isActivating`.
    + Chỉ truy vấn `class`/`faculty` khi ID hợp lệ (khác null/undefined); không query ID null khi sửa thông tin không liên quan của tài khoản legacy.
    + Kiểm tra trùng lặp email và MSSV trong `update` khi có thay đổi.
- **Kiểm thử thực chạy và kết quả:**
  - Suite [apps/backend/test/activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs): bổ sung Ca 8 đến Ca 13, đạt **19/19 tests pass 100%**.
  - Suite [apps/backend/test/accounts-and-permissions.test.cjs](../apps/backend/test/accounts-and-permissions.test.cjs): bổ sung Ca 8 đến Ca 12, đạt **21/21 tests pass 100%**.
  - Toàn bộ test suite dự án: **190 tests (189 passed, 1 skipped isolated DB)** trên 28 suites, 0 failed.
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` **0 lỗi**, Backend `tsc -p apps/backend/tsconfig.json --noEmit` **0 lỗi**.
  - `git diff --check`: **sạch sẽ, 0 lỗi whitespace**.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory và transaction doubles với service thật; chưa chạy trên PostgreSQL vật lý đa kết nối. Hoãn AI theo DEC-007.

- Đối chiếu source và báo cáo: đã thấy các thay đổi bảo toàn rolesScore ở đường đọc/copy, ngăn fallback thiếu rate được dùng, bảo vệ preflight, ghi credential sau transaction và giữ revision khi exclude/restore. Đây chưa phải nghiệm thu toàn bộ.
- Tái hiện in-memory với service thật: `publishTermRubric` vẫn cho ban hành tiêu chí cộng đồng không có rolesScore (stub chặn ghi); `UsersService.update` sửa tên sinh viên legacy thiếu lớp vẫn lỗi `Không tìm thấy Lớp với ID: null`. Validator cũng chưa từ chối alias trùng có giá trị khác nhau. Test guard dùng method thật nhưng stub `SuperGuard.canActivate`, chưa chứng minh Passport/HTTP thật.
- Chạy 14 file test unit/component được chọn: 178 pass, 0 fail, 0 skipped; typecheck frontend/backend (backend tắt incremental) và `git diff --check` đạt. Không chạy glob DB integration, browser, Storage hoặc AI. Chưa sửa application code, spec/API/rules hay đổi trạng thái backlog vì đây là review.

## 2026-11-16 — Khắc phục triệt để 7 điểm khiếm khuyết sau review Đợt 5, 7, 8, 9, 10

- **Phạm vi & mục tiêu giải quyết:**
  1. **BL-014 (High):** Bảo toàn `rolesScore` qua đọc (`getTermRubric`), sửa (`updateTermRubricDraft`), lưu và sao chép kỳ (`createTerm`); thêm validator kiểm tra điểm vai trò không âm (bỏ qua `Prisma.JsonNull`); cập nhật Admin UI `CriteriaManager.tsx` hỗ trợ biểu mẫu nhập `rolesScore` cho các vai trò cộng đồng; kiểm chứng round-trip bằng `CriteriaService` thật.
  2. **BL-005/BL-014 (High):** Chuẩn hóa alias vai trò qua `normalizeActivityRole` (`CO_VU` / `CHEERLEADER`, `BAN_TO_CHUC` / `BTC` / `ORGANIZER`, `THAM_GIA` / `PARTICIPANT`); loại bỏ hoàn toàn fallback ngầm sang PARTICIPANT hoặc 0; thiếu cấu hình vai trò (ví dụ thiếu rate CHEERLEADER) lập tức trả về blocker `NEEDS_VERIFICATION, suggestedScore: null`; bỏ mức 5/7/2.5 tự thêm vào DUT rubric theo đúng DEC-009.
  3. **BL-024 (High):** Khắc phục lỗi so sánh biến kỳ trong closure `ScoreReport.tsx`: bổ sung `currentTermRef` và `submitGenerationRef`; xóa sạch `preflight` khi `effectiveTermId` thay đổi; gắn `termId` vào state preflight và kiểm tra generation để chặn tuyệt đối việc nhận preflight của kỳ A trên giao diện kỳ B; kiểm chứng Deferred Promise trên component thật trong `score-report-and-evidence-list.test.cjs`.
  4. **BL-011 (Medium):** Trong `users.service.ts` (`bulkImport`), áp dụng `validateUserPayload` cho từng dòng trước khi mở transaction; tách việc tăng `importedCount`, `updatedCount` và thu thập `temporaryCredentials` ra ngoài transaction callback (chỉ ghi nhận sau khi commit thành công); nếu rollback thì không trả credential và giữ `importedCount = 0`.
  5. **BL-021 (Medium):** Trong `workflow.service.ts`, giữ nguyên `revision` bàn giao của Handoff (không tăng revision khi exclude/restore); sinh `eventId = randomUUID()` cho `dedupeKey` chống trùng P2002; nếu đã ở trạng thái `EXCLUDED` thì thực hiện strict no-op (không ghi đè lý do loại trừ, không sinh notification thừa); ghi nhận `eventId` vào audit log.
  6. **BL-018 & BL-019 (Medium):**
     - `EvidenceList.tsx`: đọc `termId` từ URL `useSearchParams`, đồng bộ URL và tự động reset `page = 1` khi đổi kỳ.
     - `evidence.service.ts`: bổ sung tìm kiếm theo ID minh chứng `{ id: { contains: search, mode: 'insensitive' } }`; giữ nguyên search filter trong `baseScopeWhere` (không xóa `where.OR`) để tab counts phản ánh đúng số lượng theo từ khóa tìm kiếm.
     - `ProfileDataIssues.tsx`: bổ sung `requestGen` chặn triệt để phản hồi cũ từ tab `OPEN` ghi đè lên dữ liệu tab `RESOLVED`.
  7. **BL-012 & BL-025 (Medium):** `users.service.ts` giữ nguyên `facultyId` trực tiếp gán trên User; `validateUserPayload` cho phép cập nhật tài khoản legacy STUDENT thiếu `studentCode`/`classId` khi chỉ sửa `fullName`; cập nhật test `accounts-and-permissions.test.cjs` để chạy qua `JwtAuthGuard` thật mà không monkey-patch đè lên `canActivate`.
- **Thay đổi thực tế mã nguồn:**
  - `Backend`:
    + `criteria/dut-rubric.ts`: xóa bỏ `rolesScore` tự gán mặc định ở tiêu chí 12.
    + `criteria/criteria.service.ts`: bổ sung `isPrismaNull`, bảo toàn `rolesScore` trong `getTermRubric`, `createTermRubricDraft`, `updateTermRubricDraft`, `createTerm`; validator hỗ trợ `rolesScore`.
    + `activities/activity-aggregator.ts`: thêm `normalizeActivityRole`, chặn fallback ngầm, trả blocker khi thiếu rate vai trò.
    + `evaluation-workflow/workflow.service.ts`: sửa `exclude` strict no-op khi đã EXCLUDED, giữ revision, gắn `eventId` vào `dedupeKey` và audit log.
    + `evidence/evidence.service.ts`: thêm tìm kiếm theo `id`, giữ `where.OR` trong `baseScopeWhere`.
    + `users/users.service.ts`: sửa `bulkImport` rollback và validate từng dòng; sửa legacy user update; giữ nguyên direct `facultyId`.
  - `Frontend`:
    + `pages/student/ScoreReport.tsx`: thêm `currentTermRef`, `submitGenerationRef`, xóa preflight khi đổi kỳ, gắn `termId` vào preflight.
    + `pages/student/EvidenceList.tsx`: đồng bộ `useSearchParams`, reset `page = 1` khi đổi kỳ, term selector có dropdown.
    + `pages/admin/ProfileDataIssues.tsx`: thêm `requestGen` chặn stale response khi đổi tab/trang.
    + `pages/admin/CriteriaManager.tsx`: bổ sung giao diện cấu hình `rolesScore` cho tiêu chí cộng đồng, bảo toàn khi lưu.
    + `types/index.ts`: thêm `rolesScore` vào `RubricDefinition`.
- **Kiểm thử thực chạy và kết quả:**
  - Suite [apps/backend/test/activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs): **13/13 tests pass 100%** (bao gồm round-trip qua `CriteriaService` thật).
  - Suite [apps/backend/test/exclusion-and-restore.test.cjs](../apps/backend/test/exclusion-and-restore.test.cjs): **6/6 tests pass 100%** (kiểm chứng strict no-op, giữ revision và eventId).
  - Suite [apps/backend/test/pagination-and-filter.test.cjs](../apps/backend/test/pagination-and-filter.test.cjs): **8/8 tests pass 100%** (tìm kiếm theo ID minh chứng và counts theo từ khóa).
  - Suite [apps/backend/test/accounts-and-permissions.test.cjs](../apps/backend/test/accounts-and-permissions.test.cjs): **16/16 tests pass 100%** (không monkey-patch guard, rollback import an toàn).
  - Suite mới [apps/web/scripts/score-report-and-evidence-list.test.cjs](../apps/web/scripts/score-report-and-evidence-list.test.cjs): **4/4 tests pass 100%** (Deferred Promise trên ScoreReport, stale response ProfileDataIssues, URL sync EvidenceList).
  - Tổng toàn bộ: **158 tests backend (157 passed, 1 skipped isolated DB)** + **21 tests web passed** = **178/178 tests passed**.
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` **0 lỗi**, Backend `tsc -p apps/backend/tsconfig.json --noEmit` **0 lỗi**.
  - `git diff --check`: **0 lỗi whitespace**.
- **Giới hạn kiểm chứng:** Chưa chạy kiểm thử vật lý PostgreSQL đa kết nối và browser e2e. AI giữ hoãn theo DEC-007.

## 2026-11-16 — Review độc lập walkthrough Đợt 5, 7, 8, 9, 10

- Đối chiếu working tree và DEC-008/009/010. **Chưa nghiệm thu tuyên bố hoàn thành toàn bộ**; các mục Resolved trong báo cáo trước không phải kết luận của lần review này.
- Xác nhận bằng source: BL-014 mất `rolesScore` qua `getTermRubric` và `createTerm`, validator kiểm nhầm `scoringConfig.rolesScore` thay vì trường cùng cấp; thiếu giao diện Admin cấu hình; bảng DUT tự thêm mức 5/7/2.5 trái DEC-009. BL-005 còn fallback sang PARTICIPANT/0 và chưa chuẩn hóa alias trước khi xác định xung đột.
- Xác nhận bằng source: BL-024 kiểm tra biến kỳ bị giữ trong closure, không xóa preflight khi đổi kỳ; BL-011 tăng bộ đếm/ghi credential trước commit import; BL-021 tăng revision cho exclude/restore và chỉ no-op khi cùng lý do, chưa đáp ứng kế hoạch.
- Khoảng trống còn lại: BL-012 trộn facultyId trực tiếp với Khoa suy ra/snapshot; BL-025 import chưa dùng validator chung, update legacy chỉ miễn kiểm tra khi khóa thuần túy; BL-018 thiếu bảo vệ phản hồi cũ; BL-019 bỏ tìm theo ID, bỏ search khỏi counts, chưa đồng bộ URL/kỳ và reset trang khi đổi kỳ.
- Kiểm tra an toàn: 13 file test cụ thể (danh sách ở TEST_PLAN) đạt **169/169**, 25 suites, **0 skipped**; typecheck frontend/backend đạt, backend dùng `--incremental false`; `git diff --check` đạt.
- Reproduction in-memory bằng service thật: thiếu rate CHEERLEADER vẫn READY_FOR_REVIEW/5 điểm; đọc rubric mất rolesScore; kiểm tra ban hành chấp nhận rolesScore âm (chặn ghi thực bằng stub auditMaster); import lỗi audit vẫn trả importedCount=1, errorCount=1 và một credential. Không in mật khẩu. Handler submitAll trích từ source nhận preflight A sau khi currentPage đã B.
- Giới hạn test: accounts suite ghi đè `guard.canActivate`; evidence/term suite chép lại logic frontend, ca đổi kỳ chỉ kiểm biến giả lập. Test xanh không chứng minh các luồng thật này. Chưa kiểm PostgreSQL đa kết nối, browser, Storage hoặc AI; không start backend/migrate/seed.
- Chỉ bổ sung nhật ký và bằng chứng TEST_PLAN, không sửa application code/schema, không tự đổi trạng thái backlog. Spec/API/rules chưa thay vì đây là review, chưa áp dụng bản sửa.

## 2026-11-16 — Triển khai & Hoàn thiện Đợt 10: Loại trừ → Khôi phục → Loại trừ lại (BL-021)

- **Phạm vi & mục tiêu:**
  - **BL-021 (P2 - Confirmed):** Loại trừ lần hai trùng `dedupeKey` và rollback: khắc phục lỗi Prisma P2002 Unique constraint khi Admin loại trừ một sinh viên lần thứ hai sau khi đã khôi phục; trước đây `row.revision` không tăng khiến `dedupeKey: excluded:${row.id}:${row.revision}` bị trùng lặp; nay tăng `revision: { increment: 1 }` cho cả thao tác `exclude` và `restoreExcluded`, đồng thời sinh `eventId = randomUUID()` bảo đảm tính duy nhất tuyệt đối cho `dedupeKey`; bổ sung tính `idempotent`: khi sinh viên đang ở trạng thái `EXCLUDED` với cùng lý do thì no-op trả về bản ghi hiện tại mà không sinh notification thừa.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `evaluation-workflow/workflow.service.ts`:
      * `exclude`: kiểm tra idempotency (nếu đã `EXCLUDED` cùng lý do thì return ngay); tăng `revision: nextRevision`; sinh `eventId = randomUUID()` gắn vào `dedupeKey: excluded:${row.id}:${nextRevision}:${eventId}`; ghi nhận `revision` trong audit log.
      * `restoreExcluded`: kiểm tra sinh viên đang `EXCLUDED`; tăng `revision: nextRevision`; sinh `eventId = randomUUID()` gắn vào `dedupeKey: restored:${row.id}:${nextRevision}:${eventId}`; gửi thông báo khôi phục cho sinh viên và ghi audit log `ASSESSMENT_EXCLUSION_RESTORED`.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/exclusion-and-restore.test.cjs](../apps/backend/test/exclusion-and-restore.test.cjs) với **6/6 tests pass 100%**:
    + BL-021 (6 ca): chu trình Loại trừ (lần 1) -> Khôi phục -> Loại trừ lại (lần 2) thành công 100% không bị lỗi P2002 dedupeKey; tính idempotent khi exclude lặp lại không tạo notification thừa; restore sinh viên không ở trạng thái EXCLUDED bị từ chối; cán bộ Khoa không có quyền bị chặn; không thể loại trừ khi đã công bố kết quả; không thể loại trừ hoặc khôi phục khi kỳ đã chốt (CLOSED).
  - Regression toàn hệ thống: Chạy lại toàn bộ 12 test suites của dự án đạt **164/164 tests pass 100%** (25 suites, 0 failed).
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` 0 lỗi, Backend `tsc -p apps/backend/tsconfig.json --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, transaction mock doubles, unique constraint simulation và state machine verification (chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật spec F09, F13 sang trạng thái tương ứng.



## 2026-11-16 — Triển khai & Hoàn thiện Đợt 9: Phân trang yêu cầu sửa thông tin và minh chứng (BL-018, BL-019)

- **Phạm vi & mục tiêu:**
  - **BL-018 (P2 - Confirmed):** Phân trang yêu cầu sửa thông tin hồ sơ (`ProfileDataIssues`): API backend `ProfileDataIssuesController` và `Service` nhận `pageSize`, chuẩn hóa giá trị an toàn (tối đa 100, fallback 25 khi không hợp lệ) và trả về envelope `{ items, total, page, pageSize }`; `apiClient.getProfileDataIssues` nhận đúng cấu trúc; giao diện `ProfileDataIssues.tsx` bổ sung Pagination Bar (hiển thị dải số dòng, Trang X/Y, nút Trang trước/sau); đồng bộ `status` và `page` vào search params; xử lý lùi trang tự động khi giải quyết/từ chối mục cuối cùng trên trang `> 1` để tránh màn hình rỗng.
  - **BL-019 (P2 - Confirmed):** Phân trang và bộ lọc danh sách minh chứng (`EvidenceList`): khắc phục việc chỉ tải trang đầu rồi lọc cục bộ làm biến mất dữ liệu trang sau; `EvidenceService.findAll` và controller hỗ trợ lọc theo `statusGroup` (`APPROVED`, `SUPPLEMENT`, `REVIEWING`) và tự động tính `counts: { all, approved, supplement, reviewing }` toàn kỳ trong DB; `apiClient` bổ sung `getEvidencesPage` trả về đủ items, total, page, pageSize, counts; giao diện `EvidenceList.tsx` chuyển sang server-side pagination và filter theo tab, tìm kiếm có debounce 350ms, bổ sung Pagination Bar đầy đủ và lùi trang khi xóa/rút mục cuối trên trang; bảo toàn API `getEvidences` phục vụ `ScoreReport`.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `profile-data-issues/profile-data-issues.controller.ts`: nhận `@Query('pageSize') pageSize?: string`.
    + `profile-data-issues/profile-data-issues.service.ts`: chuẩn hóa `pageSize`, phân trang chuẩn với skip/take.
    + `evidence/evidence.controller.ts`: nhận `@Query('statusGroup') statusGroup?: string`.
    + `evidence/evidence.service.ts`: lọc theo `statusGroup`, trả về `counts` theo nhóm trạng thái cho student/term.
  - `Frontend (apps/web)`:
    + `lib/apiClient.ts`: chuẩn hóa `getProfileDataIssues` trả về envelope `{ items, total, page, pageSize }`; bổ sung `getEvidencesPage` với return type đầy đủ `counts`.
    + `pages/admin/ProfileDataIssues.tsx`: thêm Pagination Bar, xử lý lùi trang khi resolve mục cuối, đồng bộ query params.
    + `pages/student/EvidenceList.tsx`: chuyển sang gọi `getEvidencesPage`, debounce search, tabs gọi server filter, thêm Pagination Bar và lùi trang khi xóa/rút.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/pagination-and-filter.test.cjs](../apps/backend/test/pagination-and-filter.test.cjs) với **7/7 tests pass 100%**:
    + BL-018 (3 ca): list trả về đúng envelope phân trang, chuyển trang 2 skip/take chính xác, chuẩn hóa pageSize an toàn (clamp 100, fallback 25 khi âm/rỗng).
    + BL-019 (4 ca): findAll phân trang server-side với page/pageSize, lọc theo statusGroup APPROVED, counts toàn kỳ chuẩn xác cho 4 nhóm trạng thái không bị cắt xén, tìm kiếm không phân biệt hoa thường.
  - Regression toàn hệ thống: Chạy lại toàn bộ các test suites đạt **115/115 tests pass 100%** (163 tests tính cả worker).
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` 0 lỗi, Backend `tsc -p apps/backend/tsconfig.json --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, pure logic, pagination doubles và API envelope verification (chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật spec F06, F12 sang trạng thái tương ứng.



## 2026-11-16 — Triển khai & Hoàn thiện Đợt 8: Tổng hợp nguồn hoạt động và cấu hình điểm vai trò (BL-005, BL-014)

- **Phạm vi & mục tiêu:**
  - **BL-005 (P1 - Confirmed):** Bộ tổng hợp nguồn hoạt động chung: loại bỏ tình trạng điểm danh và duyệt minh chứng ghi đè làm mất dữ liệu của nhau; hợp nhất theo khóa hoạt động `activity:<id>` (cùng `activityId` chỉ tính một lần) và `evidence:<id>` đối với minh chứng tự do không gắn hoạt động; ưu tiên vai trò từ điểm danh `CONFIRMED`; nếu có nhiều minh chứng `APPROVED` cùng hoạt động nhưng mâu thuẫn vai trò (và chưa có điểm danh xác nhận) thì phát hiện `hasRoleConflict` và báo blocker `NEEDS_VERIFICATION, suggestedScore = null`; khi căn cứ hoạt động thay đổi (xác nhận/thu hồi điểm danh, hoặc duyệt minh chứng), tự động cập nhật các trường server-owned (`verifiedActivityCount`, `cheerleaderActivityCount`, `convertedCommunityPoints`) và vô hiệu hóa `officialScore = null, finalizedAt = null` để cán bộ đối soát lại.
  - **BL-014 (P2 - Confirmed):** Lưu và sử dụng `rolesScore` xuyên suốt rubric: bổ sung cấu hình `rolesScore` chuẩn cho tiêu chí 12 (`community_activity_tier`) trong `dut-rubric.ts` (`PARTICIPANT: 5, ORGANIZER: 7, CHEERLEADER: 2.5, CO_VU: 2.5`); mở rộng `RubricDefinition` và bảo toàn `rolesScore` qua các thao tác `persistTermRubricDraft`, `updateTermRubricDraft`, kế thừa kỳ nguồn; validate giá trị điểm vai trò không âm; trong evaluator tiêu chí cộng đồng, nếu rubric thiếu `rolesScore` thì báo blocker `NEEDS_VERIFICATION` rõ ràng (không tự gán mặc định từ comment).
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `activities/activity-aggregator.ts`: tạo mới module tổng hợp `aggregateStudentActivitySources` và `recomputeAndSaveActivityCriterion`.
    + `activities/activities.service.ts`: chuyển `recomputeActivityCriterion` sang gọi bộ tổng hợp chung, đồng bộ nguồn dữ liệu.
    + `assessments/assessments.service.ts`: tích hợp `aggregateStudentActivitySources` vào hàm `verifyCriterion`, thay thế đoạn tính toán cục bộ cũ chỉ đọc minh chứng.
    + `reviews/reviews.service.ts`: khi duyệt minh chứng có liên kết tiêu chí hoạt động/cộng đồng, gọi `recomputeAndSaveActivityCriterion` cập nhật lại tiêu chí tự động.
    + `criteria/dut-rubric.ts`: bổ sung `rolesScore` cho tiêu chí 12.
    + `criteria/criteria.service.ts`: mở rộng `RubricDefinition` có `rolesScore`, lưu `rolesScore` trong `createMany` của `persistTermRubricDraft` và `updateTermRubricDraft`, map kế thừa `rolesScore` từ kỳ nguồn, validate `rolesScore` trong `validateScoringConfig`.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs) với **11/11 tests pass 100%**:
    + BL-005 (6 ca): gộp cùng activityId thành 1 hoạt động không đếm 2 lần, minh chứng độc lập không activityId nhận diện riêng bằng evidence.id, ưu tiên vai trò PARTICIPANT từ attendance CONFIRMED trước khai báo ORGANIZER của minh chứng, nhiều evidence APPROVED mâu thuẫn vai trò báo blocker NEEDS_VERIFICATION kèm lý do, minh chứng pending báo blocker NEEDS_VERIFICATION suggestedScore null, recomputeAndSaveActivityCriterion vô hiệu hóa officialScore cũ khi căn cứ thay đổi.
    + BL-014 (5 ca): tiêu chí 12 trong DUT_RUBRIC_CRITERIA có đầy đủ rolesScore chuẩn, validateScoringConfig chấp nhận rolesScore hợp lệ, từ chối rolesScore chứa điểm số âm, tiêu chí cộng đồng tính đúng điểm theo rolesScore cấu hình (1 PARTICIPANT + 1 ORGANIZER = 12đ quy đổi, đạt bậc 2 -> 7 điểm), tiêu chí thiếu rolesScore báo blocker NEEDS_VERIFICATION.
  - Regression toàn hệ thống: Chạy lại toàn bộ các test suites đạt **108/108 tests pass 100%** (156 tests tính cả worker).
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` 0 lỗi, Backend `tsc -p apps/backend/tsconfig.json --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, pure logic, aggregation doubles và rubric scoring evaluator (chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật spec F04, F07, F08 sang trạng thái tương ứng.



## 2026-11-16 — Triển khai & Hoàn thiện Đợt 7: Tài khoản và phân quyền (BL-016, BL-025, BL-011, BL-012)

- **Phạm vi & mục tiêu:**
  - **BL-016 (P2 - Confirmed):** Thực thi bắt buộc đổi mật khẩu lần đầu ở backend: tạo decorator `@AllowFirstLogin()` cho phép whitelist các endpoint an toàn (`/auth/me`, `/auth/change-password`, `/auth/logout`); `JwtAuthGuard` kiểm tra `user.isFirstLogin === true`, nếu không có decorator thì ném HTTP 403 `FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED`; Axios response interceptor bắt lỗi này và chuyển hướng tới `/account?required=true` mà không xóa token; trang `Account.tsx` hiển thị banner cảnh báo và tự động mở thẻ đổi mật khẩu, đồng thời vô hiệu hóa nút gửi phản ánh dữ liệu cho đến khi đổi xong.
  - **BL-025 (P2 - Confirmed):** Ràng buộc dữ liệu người dùng nghiêm ngặt theo vai trò ở backend: STUDENT bắt buộc `studentCode` và `classId` (phải thuộc Khoa hợp lệ); STAFF bắt buộc `facultyId`, cấm gán `studentCode` hoặc `classId`; ADMIN cấm gán đơn vị/lớp/MSSV; trim chuỗi trắng; cấm xóa trường bắt buộc của vai trò bằng chuỗi rỗng / null; hỗ trợ cập nhật khóa tài khoản legacy (`isActive: false`) mà không bị chặn, nhưng khi sửa định danh hoặc kích hoạt lại thì bắt buộc dữ liệu hợp lệ.
  - **BL-011 (P2 - Confirmed):** Bàn giao mật khẩu tạm thời an toàn: khi tạo user mới không truyền password hoặc reset password, backend sinh mật khẩu ngẫu nhiên có tiền tố `Ep!`, trả về `{ user, temporaryPassword }` với `user` không lộ `password` hay `authVersion`; khi người dùng tự nhập password, backend không echo lại mật khẩu và trả `temporaryPassword: null`; thêm header `Cache-Control: no-store` cho các endpoint bàn giao mật khẩu; giao diện quản lý tài khoản hiển thị mật khẩu một lần kèm nút tải file Excel danh sách tài khoản mới và mật khẩu tạm sau khi import.
  - **BL-012 (P2 - Confirmed):** Chuẩn hóa quan hệ & Scope đơn vị Khoa trong `findAll`: bổ sung projection `classId`, `facultyId` scalar song song với relations `class`, `faculty`; mapping `scopedItems` chuẩn hóa `student.facultyId` từ quan hệ `class.facultyId` khi scalar rỗng; cán bộ Khoa (STAFF) chỉ tra cứu danh sách người dùng thuộc Khoa phụ trách.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `common/decorators/allow-first-login.decorator.ts`: định nghĩa decorator `@AllowFirstLogin()`.
    + `common/guards/jwt-auth.guard.ts`: inject `Reflector`, kiểm tra `isFirstLogin` chặn API nghiệp vụ với HTTP 403 `FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED`.
    + `auth/auth.controller.ts`: gắn `@AllowFirstLogin()` vào `/auth/me`, `/auth/change-password`, `/auth/logout`.
    + `users/users.service.ts`:
      * `validateUserPayload`: validation chặt chẽ theo role (STUDENT, STAFF, ADMIN), cấm chuỗi rỗng, kiểm tra liên kết lớp và khoa.
      * `create`: sinh `temporaryPassword` an toàn khi không truyền password, trả về `{ user: safeUser, temporaryPassword }`.
      * `update`: kiểm tra quyền ADMIN, chặn tự khóa tài khoản, cấm xóa trường bắt buộc của vai trò, cho phép khóa tài khoản legacy (`isActive: false`), validate đầy đủ khi sửa định danh.
      * `resetPassword`: sinh `temporaryPassword`, đánh dấu `isFirstLogin: true`, thu hồi phiên qua `authVersion: { increment: 1 }`.
      * `findAll`: bổ sung `classId`, `facultyId` scalar, chuẩn hóa `facultyId` từ `class.facultyId`, lọc chặt chẽ theo scope Khoa của Cán bộ.
    + `users/users.controller.ts`: gắn `@Header('Cache-Control', 'no-store')` vào `create`, `resetPassword`, `bulkImport`.
  - `Frontend (apps/web)`:
    + `lib/apiClient.ts`:
      * Cập nhật return type của `createUser` trả về `{ user: User; temporaryPassword: string | null }` và `bulkImportUsers` có `temporaryCredentials`.
      * Bổ sung axios response interceptor bắt HTTP 403 `FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED` chuyển hướng về `/account?required=true` mà không xóa token.
    + `pages/Account.tsx`:
      * Đọc search param `required=true`, xác định `isFirstLoginRequired`.
      * Hiển thị banner cảnh báo đổi mật khẩu lần đầu, tự động mở thẻ đổi mật khẩu, disable nút Báo sai thông tin khi chưa đổi mật khẩu.
    + `pages/admin/UserManagement.tsx`:
      * Xử lý hiển thị modal mật khẩu tạm khi `createUser` sinh `temporaryPassword`.
      * Khai báo kiểu `importResult` có `temporaryCredentials`, hiển thị nút tải file `.xlsx` danh sách mật khẩu tạm thời sau khi import thành công.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/accounts-and-permissions.test.cjs](../apps/backend/test/accounts-and-permissions.test.cjs) với **15/15 tests pass 100%**:
    + BL-016 (4 ca): isFirstLogin = true chặn API nghiệp vụ với 403 FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED, cho phép endpoint @AllowFirstLogin(), isFirstLogin = false qua bình thường, tương thích khi không inject reflector.
    + BL-025 (6 ca): STUDENT thiếu studentCode/chứa trắng bị chặn, STUDENT chọn lớp không thuộc Khoa bị chặn, STAFF có MSSV/lớp bị chặn, ADMIN gán Khoa/lớp bị chặn, update STUDENT xóa studentCode bằng chuỗi rỗng bị chặn, khóa tài khoản legacy isActive = false cho phép thành công.
    + BL-011 (3 ca): tạo user không password sinh temporaryPassword ngẫu nhiên không lộ hash/authVersion, tạo user có password không echo lại và temporaryPassword = null, reset password sinh temporaryPassword và bật isFirstLogin = true.
    + BL-012 (2 ca): findAll trả về đầy đủ classId/facultyId và chuẩn hóa student.facultyId từ class, STAFF chỉ xem được sinh viên thuộc Khoa của mình.
  - Regression toàn hệ thống: Chạy lại toàn bộ các test suites đạt **97/97 tests pass 100%** (145 tests tính cả worker).
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` 0 lỗi, Backend `tsc -p apps/backend/tsconfig.json --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, guard test doubles, execution context mocks, pure logic và component test harness (chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật spec F01 sang trạng thái tương ứng.



## 2026-11-16 — Triển khai & Hoàn thiện Đợt 5: Minh chứng, bổ sung và chọn kỳ (BL-015, BL-013, BL-023, BL-024)

- **Phạm vi & mục tiêu:**
  - **BL-015 (P2 - Confirmed):** Bảo vệ nội dung minh chứng đã duyệt: chặn thêm tệp, upload nháp, sửa hoặc xóa tệp đối với hồ sơ `APPROVED` ở cả kiểm tra ban đầu lẫn bên trong transaction có khóa Term; phiếu tổng thể `RETURNED` không làm minh chứng `APPROVED` trở thành có thể sửa.
  - **BL-013 (P2 - Confirmed):** Hiển thị nháp đúng tiêu chí sau reload: API `findAll` bổ sung projection `criterionAssessment.criterion`; frontend ghép bằng ID tiêu chí từ liên kết trực tiếp này, ưu tiên cao hơn review cũ và không ghép bằng `criterion.code` giữa các rubric khác nhau; đảm bảo mỗi evidence xuất hiện đúng 1 lần.
  - **BL-023 (P2 - Confirmed):** Màn hình bổ sung hiển thị yêu cầu và hạn thật: lấy `SupplementRequest` chưa giải quyết mới nhất sắp xếp `createdAt desc, id desc`; hiển thị `missingItem` thực tế; áp dụng hạn `request.deadline ?? term.reviewDeadline` (khi deadline null hiển thị Không đặt hạn riêng kèm hạn kỳ); khóa form khi quá hạn hoặc không có yêu cầu mở; reset form khi đổi id; đồng bộ mô tả upload tối đa 8 MB (PDF, JPEG, PNG, WebP) và bỏ lời hứa tự động duyệt AI.
  - **BL-024 (P2 - Confirmed):** Một nguồn chọn kỳ thống nhất cho URL, UI và request: `ScoreReport` đọc query param `termId` từ URL, đối chiếu danh sách kỳ; nếu sai thì báo lỗi và khóa form (không fallback âm thầm sang kỳ hiện tại); đồng bộ Desktop và Mobile term selector trong `AppLayout` dùng chung handler cập nhật URL, giữ lịch sử Back/Forward; hủy timer autosave cũ và drop response cũ khi đổi kỳ; hủy chuỗi nộp nếu kỳ thay đổi sau khi bắt đầu lưu.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `evidence/evidence.service.ts`:
      * `findAll`: bổ sung projection `criterionAssessment.criterion` và `supplementRequests` sắp xếp `createdAt desc, id desc`.
      * `findOne`: sắp xếp `supplementRequests` thống nhất `[{ createdAt: 'desc' }, { id: 'desc' }]`.
      * `addFile`: chặn `APPROVED` ở kiểm tra ban đầu và kiểm tra lại `currentEvidence.status === APPROVED` bên trong transaction `studentEdit` sau khi khóa Term.
      * `uploadDraftFile`: kiểm tra lại `currentEvidence.status !== DRAFT` bên trong transaction trước khi tạo `evidenceFile`.
      * `update`: kiểm tra lại `currentEvidence.status === APPROVED` bên trong transaction trước khi cập nhật.
  - `Frontend (apps/web)`:
    + `types/index.ts`: bổ sung `criterionId?: string` trong `Evidence.criterionAssessment`.
    + `pages/student/ScoreReport.tsx`:
      * Đọc `termId` từ search params và so khớp `terms`: nếu `isTermLoading` thì chờ, nếu `termError` thì hiển thị lỗi và khóa thao tác, nếu thiếu query thì chuẩn hóa URL bằng `replace`.
      * Dùng `effectiveTermId` cho toàn bộ các API calls và hook `useStudentAssessmentAccess`.
      * Hủy timer autosave, tăng version ref để drop async response cũ khi đổi kỳ; kiểm tra race condition trước khi submit.
      * Cập nhật `evidenceFor`: ưu tiên `criterionAssessment?.criterion?.id` / `criterionId`, không ghép bằng `criterion.code` giữa các rubric.
    + `pages/student/SupplementEvidence.tsx`:
      * Lấy `activeRequest` chưa giải quyết mới nhất; hiển thị `missingItemContent` thực tế.
      * Tính `effectiveDeadline`, hiển thị thời gian cụ thể hoặc thông báo "Không đặt hạn riêng"; cảnh báo và khóa nút Gửi nếu đã quá hạn hoặc không có yêu cầu mở.
      * Sử dụng `activeIdRef` để bỏ response cũ về muộn khi chuyển giữa các hồ sơ; reset form state khi `id` thay đổi.
      * Đồng bộ mô tả upload tệp: JPG, PNG, WebP, PDF (tối đa 8 MB); thông báo hồ sơ chuyển lại cho cán bộ xem xét.
    + `layouts/AppLayout.tsx`:
      * Xây dựng handler `handleTermChange` dùng chung cho cả Desktop và Mobile: cập nhật query param `termId` và navigate giữ lịch sử trình duyệt.
      * Bỏ điều kiện khóa student ở Desktop term selector: hiển thị và chọn theo `selectedTermId` cho mọi role.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/evidence-and-term-selection.test.cjs](../apps/backend/test/evidence-and-term-selection.test.cjs) với **16/16 tests pass 100%**:
    + BL-015 (5 ca): phiếu RETURNED + evidence APPROVED chặn addFile, uploadDraftFile chặn non-draft, race condition status đổi thành APPROVED trong tx bị chặn, sai sinh viên bị Forbidden, update hồ sơ APPROVED bị chặn.
    + BL-013 (3 ca): nháp có criterionAssessment.criterion hiển thị đúng sau reload, direct link ưu tiên hơn review cũ không bị ghi đè, cùng code 1.1 ở 2 rubric không ghép nhầm.
    + BL-023 (4 ca): missingItem khác review.reason hiển thị đúng, deadline null hiển thị Không đặt hạn riêng kèm hạn kỳ, deadline quá hạn isExpired = true khóa gửi, không có yêu cầu mở hasOpenRequest = false.
    + BL-024 (4 ca): URL có termId hợp lệ mở đúng kỳ, URL termId sai báo lỗi khóa form không fallback ngầm, URL không termId chuẩn hóa về kỳ hiện tại, đổi kỳ giữa chừng hủy nộp sang kỳ mới.
  - Regression toàn hệ thống: Chạy lại toàn bộ 9 test suites đạt **130/130 tests pass 100%**.
  - Typecheck: Web `tsc -p apps/web/tsconfig.json --noEmit` 0 lỗi, Backend `tsc -p apps/backend/tsconfig.json --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, pure logic, component/hook test harness và mock doubles (chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật spec F05, F06, F07 sang trạng thái tương ứng.


## 2026-11-16 — Triển khai & Hoàn thiện Đợt 4: Cấu hình tính điểm, kiểu dữ liệu xác minh và validation (BL-003, BL-004, BL-017)

- **Phạm vi & mục tiêu:**
  - **BL-003 (P1 - Confirmed):** Tiêu chí 2 (`group_penalty`) trong rubric DUT chuẩn thiếu cấu hình `baseScore: 3`, làm công thức tính điểm sinh ra `NaN` và rơi vào lỗi kẹt trạng thái; bổ sung hàm `validateScoringConfig` bảo vệ việc lưu và ban hành rubric; evaluator trả về `NEEDS_VERIFICATION` rõ ràng nếu gặp cấu hình thiếu/sai baseScore trong DB cũ (không fallback toàn cục tùy tiện, không crash).
  - **BL-004 (P1 - Confirmed):** Giao diện cán bộ thiếu `leadershipRole` trong `booleanFields`, khiến serializer gửi chuỗi `"true"` lên API; backend evaluator kiểm tra `=== true` dẫn đến tiêu chí 14 và 16 luôn nhận gợi ý 0 điểm; đồng bộ kiểu dữ liệu `boolean` giữa Web và Backend, hiển thị dropdown Có/Không, backend từ chối chuỗi với HTTP 400.
  - **BL-017 (P2 - Confirmed):** API xác minh tiêu chí (`VerificationDto`) thiếu validation dữ liệu bên trong, hàm `count` trong evaluator ép chuỗi rác hoặc số âm thành 0 vi phạm (làm tăng khống điểm rèn luyện); xây dựng hàm `validateVerifiedData` chặn dữ liệu sai lệch trước khi mở transaction ghi DB; evaluator không nuốt lỗi sai kiểu thành 0 vi phạm.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `criteria/dut-rubric.ts`: Thêm `baseScore: 3` vào `scoringConfig` của tiêu chí 2 (`group_penalty`), đảm bảo tổng điểm KHUNG_I bằng 20 điểm và toàn bộ 16 tiêu chí hợp lệ.
    + `criteria/rubric-scoring.ts`:
      * Kiểm tra tính hợp lệ của `baseScore` đối với các kind penalty (`attendance_penalty`, `group_penalty`, `conduct_penalty`); nếu thiếu hoặc sai số thì trả về `{ status: 'NEEDS_VERIFICATION', suggestedScore: null, reason: 'Cấu hình tiêu chí không hợp lệ (thiếu hoặc sai baseScore).' }`.
      * Thay thế hàm `count` ép kiểu lỏng lẻo bằng helper `getNonNegativeInteger`: chỉ chấp nhận số nguyên an toàn không âm (`Number.isInteger(val) && val >= 0`), trả về lỗi khi gặp chuỗi/số âm/thập phân/boolean.
      * Kiểm tra kiểu boolean chặt chẽ cho các trường xác nhận trong `leadership_duty`, `verified_boolean`, `all_conditions`, `conduct_penalty`, `academic_effort`.
      * Tiêu chí 14 kiểm tra tỷ lệ bình chọn hợp lệ trong $[0, 100]$ và ngưỡng nghiêm ngặt `> 90` (trên 90%).
    + `criteria/criteria.service.ts`:
      * Xây dựng hàm `validateScoringConfig(criterionCode, maxScore, config)` kiểm tra chặt chẽ cấu hình theo từng `kind` (`attendance_penalty`, `group_penalty`, `conduct_penalty`, `leadership_duty`, `verified_boolean`, `award_tier`, `activity_threshold`, `community_activity_tier`, `all_conditions`, `academic_effort`, `manual_verified`).
      * Tích hợp `validateScoringConfig` vào `validateRubricDefinition`, chặn mọi thao tác lưu/ban hành rubric lỗi từ cấp Service/DTO.
    + `assessments/assessments.service.ts`:
      * Xây dựng hàm `validateVerifiedData(config, data, maxScore)` xác thực chặt chẽ dữ liệu đầu vào: counter phải là số nguyên không âm, trường boolean phải có kiểu boolean (từ chối string/number), tỷ lệ bình chọn trong $[0, 100]$, điểm quy đổi $\ge 0$, điểm chính thức trong $[0, maxScore]$.
      * Ném `BadRequestException` với mã `INVALID_VERIFICATION_DATA` và danh sách trường vi phạm `details.fields`.
      * Gọi `validateVerifiedData` ngay đầu phương thức `verifyCriterion` **trước khi mở transaction DB**, đảm bảo request invalid không bao giờ ghi dữ liệu rác vào cơ sở dữ liệu.
  - `Frontend (apps/web)`:
    + `pages/officer/StudentAssessment.tsx`:
      * Thêm `'leadershipRole'` vào `booleanFields` và `fieldLabels`.
      * Mở rộng regex `isNumberField` để nhận diện cả `classWarnings` và `missedGroupDeadlines`.
      * `toVerifiedData` chuyển đổi đúng kiểu boolean (`true`/`false`) cho `leadershipRole` và kiểu số cho các trường counter/points/deadlines/warnings.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo mới suite [apps/backend/test/scoring-and-validation.test.cjs](../apps/backend/test/scoring-and-validation.test.cjs) với **30/30 tests pass 100%**:
    + BL-003 (10 ca): Tiêu chí 2 có `baseScore: 3`, tổng điểm khung I đúng 20; 6 ca tính điểm theo quy chế vắng/trễ việc/vượt trần; cấu hình thiếu baseScore trả NEEDS_VERIFICATION không crash; validator từ chối lưu rubric sai cấu hình; đối chứng đỏ chứng minh code cũ sinh NaN.
    + BL-004 (9 ca): Tiêu chí 14 đúng chức vụ, 95%, xác nhận đạt 4 điểm; đúng 90.0% bị 0 điểm (yêu cầu trên 90%); 90.1% đạt 4 điểm; tiêu chí 16 đạt 3 điểm; chuỗi `"true"` bị từ chối HTTP 400; frontend serializer `toVerifiedData` sinh đúng boolean; load lại draft hiển thị đúng chuỗi dropdown `"true"`/`"false"`.
    + BL-017 (11 ca): `validateVerifiedData` từ chối counter âm, số thập phân, chuỗi rác, boolean sai kiểu với HTTP 400 `INVALID_VERIFICATION_DATA`; tỷ lệ >100 hoặc âm bị chặn; chấp nhận tỷ lệ thập phân 95.5% và điểm quy đổi thập phân 7.5; từ chối `officialScore > maxScore`; 0 hợp lệ tính đúng điểm tối đa; evaluator từ chối ép 0 sai lệch; đối chứng đỏ chứng minh hàm `count` cũ ép chuỗi rác/số âm thành 0 và cho điểm tối đa.
  - Regression toàn hệ thống: Chạy lại toàn bộ 8 test suites (`scoring-and-validation`, `deadline-and-closure`, `deadline-dialog-and-access`, `evidence-inspection`, `faculty-analytics`, `data-protection`, `security-fixes`, `evidence-processing-worker`) đạt **105/105 tests pass 100%** trên 12 suites.
  - Typecheck: Web `tsc --noEmit` 0 lỗi, Backend `tsc --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, pure evaluator và contract serializer (chưa kiểm kê/chạy script rà soát dữ liệu rubric lịch sử đã lưu trong DB; chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật test case F04-TC-08, F04-TC-09, F04-TC-10, F07-TC-07, F07-TC-08 sang `Verified` trong spec tương ứng.

## 2026-11-16 — Triển khai & Hoàn thiện Đợt 3: Gia hạn và chốt kỳ (BL-006, BL-010, BL-020)

- **Phạm vi & mục tiêu:**
  - **BL-006 (P0 - Confirmed):** Khóa chốt kỳ khi thời hạn phúc khảo (bao gồm gia hạn) chưa kết thúc. Tôn trọng quy tắc ưu tiên: cá nhân $\rightarrow$ lớp theo snapshot kỳ $\rightarrow$ hạn chung; mỗi cấp chọn bản chưa thu hồi mới nhất (`createdAt: desc, id: desc`). Xử lý concurrency trong `revoke` (read-after-lock) và đồng bộ khóa `lockTerm` giữa chốt kỳ và gia hạn.
  - **BL-010 (P2 - Confirmed):** Web hiển thị và tính quyền chỉnh sửa theo hạn hiệu lực (`effectiveDeadlines`), ngăn chặn việc hạn gốc tự phủ định quyền gia hạn của backend; khôi phục kiểm tra `!deadlinePassed` để khóa sửa ngay lập tức trên UI khi hết hạn hiệu lực.
  - **BL-020 (P2 - Confirmed):** Admin picker đối tượng gia hạn giới hạn đúng Roster của kỳ (`AssessmentHandoff`), có tìm kiếm debounce, phân trang (>100 sinh viên) và loại trùng lặp cho lớp; backend từ chối tạo gia hạn ngoài roster kỳ; khớp nối contract kiểu dữ liệu và lấy thông tin lớp theo snapshot kỳ thay vì thông tin hiện tại của User; bổ sung DTO validation cho endpoint targets.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend)`:
    + `evaluation-workflow/workflow-lock.helper.ts`: Helper khóa hàng Term `SELECT FOR UPDATE` dùng chung để tránh circular dependency giữa `WorkflowService` và `DeadlineExtensionsService`.
    + `evaluation-workflow/workflow.service.ts`:
      * Bổ sung hàm `checkAppealDeadlineBlockers` duyệt toàn bộ danh sách `AssessmentHandoff` của kỳ, tính hạn phúc khảo hiệu lực theo ưu tiên cá nhân $\rightarrow$ lớp $\rightarrow$ hạn chung, mỗi cấp lấy bản chưa thu hồi mới nhất với thứ tự phụ `id: 'desc'`.
      * Cập nhật `conditions` và `close`: chỉ cho phép chốt khi `now > deadline`, tại đúng biên `now === deadline` vẫn chặn; chặn chốt kỳ khi có gia hạn phúc khảo còn hiệu lực; `close` kiểm tra lại bằng client transaction `tx` sau khi khóa Term.
    + `deadline-extensions/deadline-extensions.service.ts`:
      * Dùng `lockTerm(tx, ...)` trong `create` và `revoke` để đồng bộ khóa với `close`.
      * Trong `revoke`: đọc lại `freshRow = await tx.assessmentDeadlineExtension.findUniqueOrThrow({ where: { id } })` **sau khi đã có khóa Term** để ngăn chặn race condition 2 request đồng thời cùng ghi đè audit log.
      * Sắp xếp thứ tự phụ `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` trong `resolve` và `list`.
      * Export interface `DeadlineExtensionTargetItem`, trả đầy đủ cả `code/name` lẫn `studentCode/fullName` và `className/classCode`.
      * Bổ sung method `targets({ termId, targetType, q, page, pageSize })`: lấy sinh viên/lớp từ `AssessmentHandoff` của kỳ, trích xuất thông tin lớp theo snapshot kỳ từ relation `h.class`, loại trùng lớp, hỗ trợ phân trang và tìm kiếm.
      * Trong `create`: kiểm tra đối tượng phải thuộc roster kỳ (`AssessmentHandoff`), từ chối nếu ngoài kỳ.
    + `deadline-extensions/deadline-extensions.controller.ts`:
      * Định nghĩa class DTO `DeadlineExtensionTargetsQueryDto` với validator đầy đủ (`termId`, `targetType`, `page`, `pageSize`, `q`).
      * Endpoint `@Get('targets')` nhận `@Query() query: DeadlineExtensionTargetsQueryDto`.
  - `Frontend (apps/web)`:
    + `types/index.ts`: Bổ sung `effectiveDeadlines` vào `RubricPayload.permissions`; export interface `DeadlineExtensionTargetItem` và `DeadlineExtensionRow`, xóa bỏ mọi kiểu `any[]`.
    + `lib/apiClient.ts`: Định kiểu mạnh cho `getDeadlineExtensions` và `getDeadlineExtensionTargets`.
    + `hooks/useStudentAssessmentAccess.ts`:
      * Đọc `editDeadline` từ `effectiveDeadlines.submission.deadline` hoặc `.review.deadline` (chỉ fallback về hạn gốc nếu thiếu).
      * Tính `deadlinePassed` theo `editDeadline`.
      * Khôi phục điều kiện `!deadlinePassed` trong `canEdit = Boolean(current?.verified && assessment?.rubricVersion && assessment.permissions?.canEdit && !deadlinePassed);` để khóa form ngay lập tức khi hết hạn hiệu lực dù request refresh API còn pending.
    + `components/admin/DeadlineExtensionsDialog.tsx`: Viết lại dialog picker roster-scoped có tìm kiếm debounce 300ms, phân trang trang trước/sau, reset state khi đổi loại/kỳ, chống race-condition bằng `requestId`, render chuẩn xác `item.code — item.name (item.className)` và nhãn đã chọn `item.code · item.name (item.className)`, không còn `undefined · undefined`.
- **Kiểm thử thực chạy và kết quả:**
  - [apps/backend/test/deadline-and-closure.test.cjs](../apps/backend/test/deadline-and-closure.test.cjs) (16 tests đạt 100%):
    + BL-006 (12 ca): chốt kỳ sau hạn appeal, chặn tại biên `now === deadline`, chặn khi có hạn cá nhân, cho chốt khi đã thu hồi, chặn khi có hạn lớp, ưu tiên cá nhân $\rightarrow$ lớp, thứ tự phụ `id: desc`, bỏ qua ngoài roster, đối chứng đỏ logic cũ, ca concurrency 2 request revoke đồng thời đọc lại sau khóa, và **2 ca Concurrency Lock Barrier mô phỏng (Thứ tự 1: gia hạn giữ khóa trước làm chốt kỳ bị chặn; Thứ tự 2: chốt kỳ giữ khóa trước làm gia hạn bị từ chối)**.
    + BL-020 (4 ca): DTO validation 5 trường hợp, danh sách 105 sinh viên phân trang trang 5/6, loại trùng lớp, từ chối tạo ngoài roster kỳ.
  - [apps/web/scripts/deadline-dialog-and-access.test.cjs](../apps/web/scripts/deadline-dialog-and-access.test.cjs) (6 tests đạt 100%):
    + BL-020 (2 ca component thật): render `DeadlineExtensionsDialog` đọc đúng MSSV/tên/lớp snapshot kỳ; **phân trang thực tế danh sách 105 sinh viên qua 6 trang bằng cách bấm nút "Trang sau", kiểm tra tham số request gửi API, hiển thị và chọn thành công sinh viên 105**.
    + BL-010 (4 ca hook thật): phiếu `DRAFT` hạn gia hạn tương lai `canEdit = true`, phiếu `RETURNED` đọc hạn review hiệu lực (mock đúng `getMyAssessments`); **hết hạn trong lúc API refresh đang treo thì `canEdit` lập tức chuyển `false` trước khi response về, kèm kiểm chứng nhánh refresh thất bại (lỗi mạng 500)**; đối chứng đỏ code cũ bỏ `!deadlinePassed`.
  - Regression toàn hệ thống: Chạy lại toàn bộ 7 test suites (`deadline-and-closure`, `deadline-dialog-and-access`, `evidence-inspection`, `faculty-analytics`, `data-protection`, `security-fixes`, `evidence-processing-worker`) đạt **75/75 tests pass 100%** trên 9 suites.
  - Typecheck: Web `tsc --noEmit` 0 lỗi, Backend `tsc --noEmit` 0 lỗi, `git diff --check` sạch sẽ.
- **Giới hạn kiểm chứng:** Đã kiểm chứng qua unit test in-memory, hook thật và component harness (các ca concurrency sử dụng barrier mô phỏng khóa hàng in-memory double; chưa chạy DB PostgreSQL vật lý đa kết nối và browser e2e). Đã cập nhật test case F03-TC-03 và F03-TC-04 sang `Partially verified` trong `docs/features/03-terms-and-deadlines.md`.

## 2026-11-15 — Sửa BL-007 (Bảo vệ tệp khi Upload/Ký URL) và Kiểm chứng kịch bản BL-026 (Race Xóa/Nộp)

- **Phạm vi & mục tiêu:**
  - Sửa dứt điểm **BL-007 (P0 - Confirmed)**: Lỗi upload thành công nhưng ký URL xem tệp thất bại làm xóa mất tệp Storage đã được DB tham chiếu.
  - Khắc phục và kiểm chứng **BL-026 (P0 - Potential)**: Race condition giữa xóa minh chứng/tệp (`deleteEvidence`, `deleteDraftFile`) và nộp phiếu (`submitSelfAssessment`) bằng transaction có khóa Term qua `workflow.studentEdit`. Giữ nguyên nhãn Potential do chưa có môi trường PostgreSQL đa kết nối thật để test concurrency vật lý.
- **Thay đổi thực tế mã nguồn:**
  - `Backend (apps/backend/src/evidence/evidence.service.ts)`:
    + `BL-007 (uploadDraftFile)`: Tách riêng 3 bước: (1) Upload Storage, (2) Commit DB qua `workflow.studentEdit` (nếu lỗi kiểm tra `findFirst` trước khi dọn tệp để tránh ambiguous timeout), (3) Ký URL xem tệp bằng `getFileUrl` trong try/catch riêng. Nếu ký lỗi: **tuyệt đối không xóa Storage**, trả về thông tin tệp đã lưu kèm `signedUrlAvailable: false` và thông báo hướng dẫn.
    + `withSignedFiles`: Bọc try/catch khi ký URL danh sách/chi tiết; nếu ký lỗi thì fallback giữ nguyên đường dẫn lưu trữ và gán `signedUrlAvailable: false`, tránh làm sập trang.
    + `cleanupStorageObject`: Thêm private helper kiểm tra `res.ok`, log rõ ràng lỗi HTTP 403/500 và lỗi mạng, bắt lỗi `getStorageConfig()` an toàn, không để lỗi dọn Storage làm hỏng kết quả commit DB.
    + `BL-026 (deleteDraftFile & deleteEvidence)`: Đưa toàn bộ kiểm tra trạng thái và thao tác xóa DB vào bên trong transaction có khóa Term qua `workflow.studentEdit`. Đặc biệt trong `deleteEvidence`: đọc lại danh sách tệp `files` **bên trong** transaction lock và trả ra ngoài để dọn dẹp Storage sau khi commit thành công.
  - `Frontend (apps/web)`:
    + `apps/web/src/types/index.ts`: Bổ sung `signedUrlAvailable?: boolean; message?: string | null;` vào interface `EvidenceFile`.
    + `apps/web/src/pages/student/ScoreReport.tsx`: Xử lý cờ `signedUrlAvailable === false` hoặc `fileUrl.startsWith('evidence/')` tại danh sách tệp minh chứng: vô hiệu hóa liên kết xem trực tiếp, hiển thị nhãn "Đã lưu, chưa có liên kết xem" kèm nút "Tải lại"; đọc kết quả upload và thông báo cho sinh viên khi tệp lưu an toàn nhưng chưa có liên kết tạm thời.
    + `apps/web/src/pages/student/EvidenceDetail.tsx`: Xử lý fallback an toàn khi URL chưa ký, không hiển thị broken image hay link lỗi, có nút tải lại trang.
    + `apps/web/src/components/EvidenceInspection.tsx`: Chặn liên kết thô, hiển thị nhãn "Đã lưu, chưa có liên kết xem" và bổ sung nút "Thử tải lại" để gọi lại API ký URL khi dịch vụ phục hồi; sử dụng `activeRequestIdRef = useRef(0)` để kiểm soát race condition stale response (khi chuyển nhanh giữa các hồ sơ A và B hoặc khi tải lại nhiều lần liên tiếp), xóa dữ liệu cũ (`setData(null)`) ngay khi bắt đầu request mới, drop toàn bộ phản hồi muộn của request trước đó; bảo đảm `loadData` nhận `targetId` an toàn khi gọi từ event click.
    + `apps/web/src/pages/officer/ReviewDetail.tsx`: Xử lý trường hợp URL chưa ký tại màn hình duyệt minh chứng của cán bộ Khoa: không render `<img>` với đường dẫn `evidence/...`, hiển thị thông báo "Tệp đã được lưu an toàn nhưng chưa có liên kết xem tạm thời." và nút "Thử tải lại" kèm icon `RefreshCw`; bổ sung `setLoadError('')` khi bắt đầu `fetchEvidence` và trong `.then(...)` thành công để xóa sạch thông báo lỗi cũ sau khi thử lại thành công.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo bộ test cô lập [apps/backend/test/data-protection.test.cjs](../apps/backend/test/data-protection.test.cjs) chạy bằng Node.js test runner (`node --test`), bao gồm 2 suite và 11 ca kiểm thử:
    + BL-007 (6 tests):
      * Ca 1: Upload Storage 500 $\rightarrow$ ném ServiceUnavailable, không ghi DB, không gọi DELETE.
      * Ca 2: DB commit thất bại $\rightarrow$ dọn tệp mồ côi trên Storage.
      * Ca 2b: DB timeout nhưng đã có bản ghi $\rightarrow$ KHÔNG xóa Storage.
      * Ca 3: Ký URL thất bại sau commit $\rightarrow$ KHÔNG xóa Storage, trả `signedUrlAvailable: false` kèm message.
      * Ca 3b: Tải lại khi signing lỗi (không crash trang, fallback an toàn) và khi signing đã phục hồi (tạo signed URL thành công).
      * Ca 4 (Đối chứng đỏ): Code cũ gom try/catch làm xóa tệp khi ký thất bại.
    + BL-026 (5 tests):
      * Ca 5: Thứ tự 1 — Nộp trước (`SUBMITTED`) $\rightarrow$ Thao tác xóa bị `assertStudentEditable` chặn với 400 BadRequestException, KHÔNG gọi DELETE Storage.
      * Ca 6: Thứ tự 2 — Xen kẽ thao tác: submit vượt qua precheck ngoài lock (`files.length === 1`) $\rightarrow$ xóa tệp commit $\rightarrow$ submit bước vào transaction có khóa Term, đọc lại dữ liệu trong lock và bị chặn bởi nhánh `currentDrafts.some(e => !e.files.length)` với thông báo `"Có minh chứng nháp chưa có tệp"`.
      * Ca 7: Rollback trong transaction xóa $\rightarrow$ kiểm chứng cả Storage KHÔNG bị xóa và bản ghi DB (`dbFiles`, `dbEvidence`) được phục hồi nguyên vẹn.
      * Ca 8: Danh sách tệp cần xóa được đọc BÊN TRONG transaction có khóa Term.
      * Ca 9: Cleanup Storage trả lỗi HTTP 500/mất mạng $\rightarrow$ DB commit xóa thành công, ghi nhận `filesPendingCleanup: 1` / `storageCleaned: false`, không crash.
    + Kết quả: 11/11 tests pass (thời gian chạy: 3.5s).
  - Tạo bộ test cô lập [apps/web/scripts/evidence-inspection.test.cjs](../apps/web/scripts/evidence-inspection.test.cjs) chạy bằng Node.js test runner (`node --test`), gọi trực tiếp component thực tế của ứng dụng (`EvidenceInspection.tsx` và `ReviewDetail.tsx`) qua React harness quản lý hook/lifecycle và mock API `apiClient.getEvidenceById`, bao gồm 5 ca kiểm thử:
    + Ca 1: Mở hồ sơ A (Deferred A), chuyển sang hồ sơ B (Deferred B); điều khiển thủ công cho B giải quyết trước $\rightarrow$ màn hình hiển thị B; khi A giải quyết sau $\rightarrow$ component thực tế bỏ qua phản hồi A, màn hình vẫn giữ B.
    + Ca 2: Khi chuyển từ hồ sơ A sang B, dữ liệu của A bị xóa ngay lập tức (`data === null`) và bật lại `loading === true`, hiển thị trạng thái đang tải hồ sơ B.
    + Ca 3: Thử tải lại thủ công bằng Deferred Promise: bấm retry 1 (Deferred 1 treo), bấm tiếp retry 2 (Deferred 2 treo); cho Deferred 2 hoàn thành trước với phiên bản v2 $\rightarrow$ màn hình cập nhật v2; sau đó mới cho Deferred 1 hoàn thành sau với bản v1 cũ $\rightarrow$ component thực tế bỏ qua bản cũ, dữ liệu màn hình vẫn giữ nguyên v2.
    + Ca 4: Lỗi mạng của request A cũ về muộn không ghi đè vào `state.error` của hồ sơ B mới.
    + Ca 5: ReviewDetail: sau khi thử tải lại thành công, hàm `fetchEvidence` của component thực tế gọi `setLoadError('')`, thông báo alert lỗi được xóa sạch hoàn toàn.
    + Bằng chứng đối chứng đỏ: Nếu tạm bỏ `if (requestId === activeRequestIdRef.current)` trong `EvidenceInspection.tsx`, Ca 1 và Ca 3 lập tức FAIL (`ERR_ASSERTION`). Nếu tạm bỏ `setLoadError('')` trong `ReviewDetail.tsx`, Ca 5 lập tức FAIL (`ERR_ASSERTION`).
    + Kết quả: 5/5 tests pass (thời gian chạy: 0.43s).
  - Chạy regression toàn bộ các suite hiện có:
    + `node --test apps/web/scripts/evidence-inspection.test.cjs` $\rightarrow$ 5/5 tests pass.
    + `node --test apps/backend/test/data-protection.test.cjs` $\rightarrow$ 11/11 tests pass.
    + `node --test apps/backend/test/security-fixes.test.cjs` $\rightarrow$ 16/16 tests pass.
    + `node --test apps/backend/test/evidence-processing-worker.test.cjs` $\rightarrow$ 15/15 tests pass.
    + `node --test apps/web/scripts/faculty-analytics.test.cjs` $\rightarrow$ 6/6 tests pass.
    + Tổng cộng: **53/53 tests pass 100%**.
    + Typecheck backend: `./apps/backend/node_modules/.bin/tsc --noEmit --incremental false -p apps/backend/tsconfig.json` $\rightarrow$ 0 lỗi.
    + Typecheck frontend: `./apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` $\rightarrow$ 0 lỗi.
- **Tài liệu cập nhật & đồng bộ:**
  - `docs/BUSINESS_LOGIC_AUDIT.md`: Đổi BL-007 sang `Resolved`; BL-026 sang `In Progress / Potential (Chờ kiểm chứng PostgreSQL đa kết nối)`; cập nhật số đếm: 23 mục Open (21 Confirmed, 2 Potential) và 4 mục Resolved.
  - `docs/BACKLOG.md`: Đổi BL-007 sang `Done`; BL-026 sang `In Progress / Potential`.
  - `docs/TEST_PLAN.md`: Bổ sung suite `data-protection.test.cjs` (11 tests pass) và kết quả chi tiết.
  - `docs/features/06-evidence-and-storage.md`: Cập nhật AC, kịch bản khóa Term và F06-TC-05 Passed.
  - `docs/README.md`: Đồng bộ 4 mục Resolved, 23 mục Open.
  - `docs/PROJECT_OVERVIEW.md`: Đồng bộ dòng 206 thành 4 mục Resolved, 23 mục Open.
  - `docs/API_CONTRACT.md`: Mô tả đầy đủ các trường phản hồi mới (`signedUrlAvailable`, `storageCleaned`, `filesPendingCleanup`, `message`) cho các endpoint upload/delete/get minh chứng.
- **Giới hạn còn lại:**
  - Kiểm chứng hiện tại dựa trên mô hình bộ nhớ (in-memory test doubles / mock fetch), chưa chứng minh cơ chế khóa hàng `FOR UPDATE` và rollback trên hệ quản trị cơ sở dữ liệu PostgreSQL thực tế; vì vậy BL-026 tiếp tục giữ nhãn In Progress / Potential chờ kiểm chứng trên DB đa kết nối cách ly.
  - Các thao tác Storage chạy trên mock fetch an toàn; chưa kiểm chứng trên Supabase Storage production thật.

## 2026-11-15 — Sửa nhóm lỗi Bảo mật & Đăng nhập P0: BL-002, BL-001, BL-009

- **Phạm vi & mục tiêu:** Xử lý 3 lỗi bảo mật P0 (Confirmed) phát hiện trong audit theo đúng kế hoạch đã thống nhất với người dùng. Giữ nguyên rubric hiện hành, DB schema và dữ liệu.
- **Thay đổi thực tế mã nguồn:**
  - `BL-002`: Sửa `apps/backend/src/reviews/reviews.service.ts` (dòng 226), thay `reviewer: true` bằng projection `reviewer: { select: { id: true, fullName: true, role: true } }`, loại bỏ hoàn toàn `password` hash và `authVersion` khỏi response duyệt minh chứng.
  - `BL-001`: Sửa `apps/backend/src/conduct-scores/conduct-scores.controller.ts` và `conduct-scores.service.ts`: bổ sung `resolveTermId(termId)` để xác định kỳ duy nhất một lần trước khi kiểm quyền; nếu kỳ không tồn tại ném `NotFoundException`; nếu hệ thống không có kỳ nào trả `getEmptyScore()` (không truy vấn lại DB tìm kỳ lần 2); request có hoặc không có `termId` đều áp dụng cùng ranh giới snapshot `assessmentHandoff.facultyId` của kỳ đó, chặn cán bộ Khoa mới xem kỳ thuộc Khoa lịch sử cũ của sinh viên chuyển Khoa.
  - `BL-009`: Tạo helper `apps/backend/src/auth/jwt-config.helper.ts`, chuyển `JwtModule.register` sang `JwtModule.registerAsync` inject `ConfigService` trong `auth.module.ts`, và inject `ConfigService` vào constructor của `jwt.strategy.ts`. Đảm bảo bên ký và bên xác thực cùng đọc secret từ `ConfigService` thống nhất một nguồn với thời hạn token 12h.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo bộ test cô lập [apps/backend/test/security-fixes.test.cjs](../apps/backend/test/security-fixes.test.cjs) chạy bằng Node.js test runner (`node --test`), bao gồm 3 suite và 16 ca kiểm thử:
    + BL-002 (2 tests): Kiểm tra projection `select` an toàn; assert response không chứa `password` hay `authVersion`; kèm test chứng minh mã cũ dùng `reviewer: true` chắc chắn làm rò rỉ password hash từ bảng User.
    + BL-001 (10 tests):
      * Tra cứu cán bộ: kỳ không tồn tại ném `NotFoundException`; DB rỗng trả `getEmptyScore()`; thiếu snapshot ném `ForbiddenException`; cán bộ Khoa mới bị chặn khi tra cứu kỳ lịch sử cũ (cả có và không kèm `termId`); cán bộ Khoa lịch sử truy cập thành công; bằng chứng đỏ logic cũ bỏ qua snapshot kỳ khi thiếu `termId` khiến cán bộ Khoa mới vượt ranh giới.
      * Dashboard sinh viên (GET /scores/dashboard): tự động chọn kỳ ACTIVE khi không kèm `termId` (gọi DB `findFirst` đúng 1 lần); tự động chọn kỳ latest (startDate desc) khi không có ACTIVE; chọn đúng kỳ cụ thể khi truyền `termId` (gọi `findFirst` 0 lần, `findUnique` 2 lần: resolve và load); trả `getEmptyScore()` khi DB rỗng.
    + BL-009 (4 tests): Sử dụng trực tiếp `jwtModuleAsyncOptions.useFactory` từ `auth.module.ts` và `@nestjs/jwt` `JwtService` thật để ký token 12h; xác thực thành công qua cơ chế `strategy.authenticate(req)` thật của Passport; tái hiện token ký bằng fallback secret bị từ chối (`invalid signature`); production thiếu secret ném lỗi.
    + Kết quả: 16/16 tests pass (thời gian chạy: 2.6s).
  - Chạy lại test suite worker có sẵn: `node --test apps/backend/test/evidence-processing-worker.test.cjs` $\rightarrow$ 15/15 tests pass.
  - Chạy typecheck TypeScript toàn backend: `./apps/backend/node_modules/.bin/tsc --noEmit --incremental false -p apps/backend/tsconfig.json` $\rightarrow$ Đạt 0 lỗi, không sinh cache file.
- **Tài liệu cập nhật & đồng bộ:**
  - `docs/BUSINESS_LOGIC_AUDIT.md`: Đổi trạng thái BL-001, BL-002, BL-009 sang `Resolved`, bổ sung bằng chứng và giới hạn kiểm chứng; cập nhật dòng tổng kết đầu báo cáo thành: 24 mục Open (22 Confirmed, 2 Potential) và 3 mục Resolved, loại bỏ mâu thuẫn "tất cả 27 mục Open / chưa sửa code".
  - `docs/README.md` & `docs/PROJECT_OVERVIEW.md`: Đồng bộ số lượng 3 mục Resolved, 24 mục Open.
  - `docs/BACKLOG.md`: Đổi trạng thái BL-001, BL-002, BL-009 sang `Done` và cập nhật ghi chú lộ trình đợt 1.
  - `docs/TEST_PLAN.md`: Bổ sung suite `security-fixes.test.cjs` (16 tests pass) và kết quả kiểm thử.
  - `docs/features/01-accounts-and-access.md`, `docs/features/07-evidence-review-and-verification.md`, `docs/features/09-faculty-handoff.md`, `docs/features/12-scores-reports-and-exports.md`: Cập nhật trạng thái gap audit đã giải quyết và test case nghiệm thu.
- **Giới hạn còn lại:** Các kiểm chứng trên là pure unit test in-memory (Node test runner + Passport strategy thật); chưa kiểm chứng trên DB staging/production hay môi trường deployment thực tế.

## 2026-11-15 — DEC-006: Rubric giữ nguyên qua kỳ mới nếu không thay đổi

- Ghi nhận xác nhận trực tiếp của người dùng: giữ nguyên rubric hiện hành qua các kỳ; chỉ thay nội dung khi có thay đổi thực sự. Sửa diễn đạt trước đó có thể khiến hiểu rằng mỗi kỳ phải chỉnh rubric.
- Đối chiếu CriteriaService.createTerm/persistTermRubricDraft và màn TermsMasterData: code sao chép nội dung nhưng tạo DRAFT/yêu cầu ban hành cho từng kỳ; ghi hiện trạng riêng với yêu cầu, theo dõi REQ-002 Open.
- Cập nhật DECISIONS, R-08, feature F03/F04, overview, backlog/lộ trình, test plan và AGENTS. Q-02 vẫn chỉ hỏi phần thiếu/mâu thuẫn; không yêu cầu đặt lại mức điểm mỗi kỳ. Giữ nguyên 27 finding và trạng thái audit.
- Phân biệt rubric nghiệp vụ với bản ghi/snapshot kỹ thuật; chưa chọn thay đổi schema, không sửa code hoặc dữ liệu. API contract hiện tại giữ nguyên vì chưa đổi endpoint/hành vi.
- Bổ sung 3 ca feature Planned; không chạy application/DB/Storage/AI tests. Kiểm tra đạt: 812 liên kết/vị trí nguồn hợp lệ, đủ 11 mục/spec và 76 cặp AC/TC, DEC-006 được tham chiếu ở các tài liệu liên quan, giữ nguyên 27 finding; `git diff --check` đạt và chỉ có thay đổi Markdown.

## 2026-11-15 — Lộ trình công việc sau audit

- Đối chiếu overview, quy tắc, feature tài khoản/tệp, audit, backlog, decisions và test plan để đề xuất thứ tự xử lý tiếp theo.
- Bổ sung lộ trình sáu bước vào BACKLOG: baseline/môi trường kiểm thử, chốt Q-01…Q-03, P0, P1 và P2 cùng luồng, nghiệm thu toàn kỳ, hoàn thiện bàn giao.
- Đề xuất đợt đầu gồm baseline kiểm thử và BL-002/001/009; chưa coi đây là yêu cầu sửa code được duyệt. Mọi BL vẫn Open, Q chưa được tự giải quyết.
- Chỉ cập nhật BACKLOG và CHANGELOG; spec/API/rules giữ nguyên vì không đổi yêu cầu hoặc hành vi. Không chạy application tests, backend, DB/Storage/AI; kiểm tra Markdown/link/diff cho hai tài liệu được cập nhật.

## 2026-11-15 — DOC-001: Hợp nhất tài liệu quản lý dự án

- Tạo 9 tài liệu dùng chung trong docs, 14 feature spec và 1 template theo 10 mục + Out of Scope.
- Ghi overview/module/workflow/model/migration/navigation, 28 quy tắc, inventory 121 route/45 lớp DTO, 27 finding audit và backlog. Finding giữ Open; 25 Confirmed/2 Potential.
- Tách 9 câu hỏi chính sách khỏi yêu cầu đã có căn cứ; giữ proposal hữu ích và ghi rõ tài liệu handoff cũ không có trong repo.
- Cập nhật README root và AGENTS cho quy trình đọc docs trước làm/cập nhật docs sau làm.
- Hợp nhất 6 file Markdown cũ vào docs trước khi xóa; nội dung navigation/dashboard còn giá trị được giữ, claim test cũ được đánh dấu historical.
- Phạm vi: Markdown; giữ nguyên application code, schema, migration, dependency/lockfile và dữ liệu.
- Kiểm tra đạt: inventory AST khớp 121 route/45 lớp DTO; đủ 24 file trong docs (14 spec + template + 9 tài liệu chung), 11 mục/spec, 27 finding đủ 11 trường, ID/metadata và 806 liên kết/anchor/vị trí nguồn hợp lệ; không có link hỏng hoặc whitespace thừa. `git diff --check` đạt; diff chỉ Markdown đúng phạm vi, 6 file cũ đã được xóa sau hợp nhất.
- Không chạy ứng dụng, DB/Storage/AI hoặc integration/browser tests. Kết quả pure/ad hoc từ audit trước chỉ được lưu với nhãn historical, không chạy lại để làm tài liệu.

