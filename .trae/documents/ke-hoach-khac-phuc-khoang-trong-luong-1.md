# Kế hoạch khắc phục các khoảng trống còn lại của Luồng 1

**Ngày lập:** 2026-11-10
**Phạm vi:** Chỉ Luồng 1 (kiểm tra minh chứng). Không đụng Luồng 2 (tra cứu công khai) ngoài phần đã có.
**Tham chiếu cổng nghiệm thu:** `docs/ke-hoach-hoan-thien-pipeline-minh-chung.md` §7.

## 1. Tóm tắt (Summary)

Pipeline Luồng 1 đã chạy được gần hết luồng nhưng **chưa có bằng chứng đo lường**, **Lớp 6 còn giả (check `template` luôn `NOT_CHECKED`)**, **Lớp 8 chỉ test được nhánh AI-unavailable**, và **chưa có công cụ ép/nghiệm thu quy trình gán nhãn của con người**. Kế hoạch này bổ sung 4 khối đó, có sửa code pipeline (`pipeline_orchestrator.py`, worker backend) và thêm bộ test/CLI. Mục tiêu: chuyển các mục §7 từ "thiếu bằng chứng" sang "có báo cáo/test tái lập được".

Không có thay đổi nào cho phép AI tự phê duyệt/từ chối. Mọi kết quả vẫn chỉ là **tín hiệu gợi ý + chuyển cán bộ**.

## 2. Phân tích hiện trạng (Current State Analysis)

Đã kiểm chứng bằng đọc mã nguồn:

| Khu vực | Hiện trạng | Bằng chứng |
|---|---|---|
| Lớp 2 – trùng lặp | `_check_duplicate` so SHA-256 + pHash hamming ≤ 10 cứng; **chưa có precision/recall, chưa hiệu chỉnh ngưỡng** | [pipeline_orchestrator.py](file:///d:/UniProof-AI/apps/ai-service/src/pipeline_orchestrator.py#L537-L579) |
| Lớp 4 – trích xuất | Có regex trường nhưng **không có evaluator exact-match/F1 theo trường** | [ocr_extractor.py](file:///d:/UniProof-AI/apps/ai-service/src/ocr_extractor.py) |
| Lớp 5 – đối chiếu | Có `nameMatchRatio`, `codeMatched`, `citizenIdMatched`; **chưa đo false-accept định danh** | [pipeline_orchestrator.py](file:///d:/UniProof-AI/apps/ai-service/src/pipeline_orchestrator.py#L93-L112) |
| Lớp 6 – phôi | **Check `template` hard-code `NOT_CHECKED`**, không có module/kho phôi | [pipeline_orchestrator.py](file:///d:/UniProof-AI/apps/ai-service/src/pipeline_orchestrator.py#L513-L518) |
| Lớp 7 – điểm tin cậy | Công thức cộng/trừ heuristic; **chưa có ECE/Brier, chưa theo dõi tier vs quyết định cán bộ** | [pipeline_orchestrator.py](file:///d:/UniProof-AI/apps/ai-service/src/pipeline_orchestrator.py#L189-L240) |
| Lớp 8 – HITL E2E | Test E2E tự skip khi thiếu `TEST_DATABASE_URL`; **chỉ chạy nhánh `AI_PIPELINE_URL=''` (fallback), chưa chạy nhánh AI trực tuyến** | [workflow.integration.test.cjs](file:///d:/UniProof-AI/apps/backend/test/workflow.integration.test.cjs#L6-L14) |
| Quy trình nhãn | Có `pilot_annotations.csv`, `PILOT_README.md`; **chưa có validator/ép schema, chưa có báo cáo cổng nghiệm thu** | [pilot_annotations.csv](file:///d:/UniProof-AI/docs/Minh%20ch%E1%BB%A9ng%20L%E1%BB%8Dc/dataset-local/pilot_annotations.csv) |

Hạ tầng đo lường sẵn có (tái sử dụng style, không thay thế): [evaluate_ocr_pilot.py](file:///d:/UniProof-AI/apps/ai-service/tools/evaluate_ocr_pilot.py), [build_evidence_dataset.py](file:///d:/UniProof-AI/apps/ai-service/tools/build_evidence_dataset.py), [analyze_ocr_pilot.py](file:///d:/UniProof-AI/apps/ai-service/tools/analyze_ocr_pilot.py).

Điểm cần lưu ý: `test_unified.py` hiện có thể đang assert `template` là `NOT_CHECKED`; đổi hành vi sẽ phải cập nhật test tương ứng.

## 3. Thay đổi đề xuất (Proposed Changes)

### Khu vực 1 — Khung đo lường & nghiệm thu

**1.1. Thêm `apps/ai-service/tools/layer_metrics.py`** (mới, hàm thuần, không I/O)
- `wilson_interval(successes, total, z=1.96) -> tuple[float, float]` — khoảng tin cậy tỉ lệ.
- `binary_metrics(tp, fp, fn) -> dict` → `{precision, recall, f1, support}` (trả `None` khi mẫu số bằng 0, không bịa số).
- `field_exact_match(pairs: list[tuple[str|None, str|None]]) -> dict` → `{correct, total, accuracy}` (đã chuẩn hóa dấu/case/khoảng trắng).
- `micro_f1(per_field: dict[str, dict]) -> dict` — gộp theo trường.
- `expected_calibration_error(confidences, outcomes, bins=10) -> float`, `brier_score(confidences, outcomes) -> float`, `calibration_bins(...) -> list[dict]`.

**1.2. Thêm `apps/ai-service/tools/evaluate_pipeline_layers.py`** (mới, CLI)
- Hàm `evaluate_layers(dataset_dir: Path, predictions_path: Path) -> dict`.
- Đầu vào: `annotations.csv` (nhãn thật), `pipeline_predictions.csv` (dự đoán), `manifest.jsonl` (loại rò rỉ exact-duplicate giữa các tập theo `duplicate_group`, dùng lại logic `by_digest` như `evaluate_ocr_pilot.py`).
- Không có nhãn → `raise ValueError` thông báo hành động được (giống `evaluate_ocr_pilot`).
- Tính:
  - **Lớp 2:** `duplicate_review_label` (exact/near/none) ↔ `predicted_duplicate_match_type` (EXACT/SIMILAR/None): precision/recall/F1 cho "là trùng" và riêng "EXACT", kèm Wilson CI.
  - **Lớp 4:** exact-match cho `document_type`, `expected_issue_date`, `expected_issuer`, `expected_activity_name` ↔ trường dự đoán; micro-F1 cho trường văn bản; báo theo từng loại giấy.
  - **Lớp 5:** `expected_student_code_match` / `expected_student_name_match` / `expected_term_match` ↔ cờ dự đoán; **false-accept định danh** và precision của mismatch.
  - **Lớp 7:** `ai_confidence` (0–100 → 0–1) ↔ outcome = `human_review_decision == 'accept'`; ECE, Brier, precision/recall theo tier.
- Xuất `layer_metrics.json` + `layer_metrics.md` (kèm số mẫu, Wilson CI, và nhãn `NOT_EVIDENCED` khi support = 0).

**1.3. Thêm `apps/ai-service/tools/run_pipeline_predictions.py`** (mới, CLI)
- Đọc `source_map.csv` + `annotations.csv` (+ `pipeline_declarations.csv` tùy chọn cho `fullName/studentCode/citizenId/termStart/termEnd`).
- Với mỗi mẫu có file gốc tồn tại: dựng `UnifiedInspectionRequest` và `await UnifiedPipelineOrchestrator.process(...)`; ghi `pipeline_predictions.csv`.
- Cờ `--limit`, `--document-type`; bỏ qua mẫu thiếu file kèm ghi chú. Khi thiếu `pipeline_declarations.csv`, các cờ định danh để `null` (không bịa) — evaluator tự bỏ qua ô null.

**1.4. Thêm `apps/ai-service/test_layer_metrics.py`** (mới)
- Kiểm tra Wilson bounds, `binary_metrics` khi mẫu số 0, `micro_f1`, ECE/Brier trên input biết trước.
- Một ca end-to-end `evaluate_layers` trên dataset tạm (`tempfile` + CSV viết tay) theo đúng phong cách [test_ocr_evaluation.py](file:///d:/UniProof-AI/apps/ai-service/test_ocr_evaluation.py).

### Khu vực 2 — Lớp 6: kho phôi & nhận diện chỉnh sửa

**2.1. Thêm `apps/ai-service/src/template_matcher.py`** (mới)
- `load_registry(path: Path | None = None) -> TemplateRegistry` (đọc `templates/registry.json`; thiếu/hỏng → registry rỗng an toàn).
- `TemplateRegistry.match(image_bytes, document_type) -> TemplateMatchResult`:
  - Ứng viên = mẫu cùng `documentType` còn hiệu lực theo `effectiveFrom/effectiveTo`.
  - So `pHash` (hamming ≤ `TEMPLATE_MATCH_HAMMING_MAX`) + tỉ lệ khung hình trong `TEMPLATE_MATCH_ASPECT_TOLERANCE`.
  - Không có ứng viên / registry rỗng → `status="UNKNOWN"`.
  - Trả `{status: MATCH|MISMATCH|UNKNOWN, matchedTemplateId, confidence, evidence}`.

**2.2. Thêm `apps/ai-service/templates/registry.json`** (mới, schema v1)
```
{ "schemaVersion": 1, "templates": [] }
```
Mỗi mục khi thêm: `{templateId, documentType, source, effectiveFrom, effectiveTo, version, pHash, aspectRatio, fileRef}`.
Kèm `apps/ai-service/templates/README.md`: hướng dẫn chỉ thêm phôi **được cấp quyền**, ghi nguồn/ngày hiệu lực/version.

**2.3. Sửa `apps/ai-service/src/schemas.py`**
- Thêm model `TemplateMatchResult` (`status`, `matchedTemplateId`, `confidence`, `evidence`).
- Thêm `templateMatch: Optional[TemplateMatchResult] = None` vào `UnifiedInspectionResponse`.

**2.4. Sửa `apps/ai-service/src/config.py`**
- Thêm `TEMPLATE_MATCH_HAMMING_MAX: int = 10`, `TEMPLATE_MATCH_ASPECT_TOLERANCE: float = 0.15`, `TEMPLATE_REGISTRY_PATH: str = ""`.

**2.5. Sửa `apps/ai-service/src/pipeline_orchestrator.py`**
- Trong nhánh `DOCUMENT_PIPELINE`: gọi `TemplateMatcher.match(image_bytes, req.evidenceType)` sau bước forensics; đưa `templateMatch` vào response.
- Truyền `template_match` vào `_document_checks`; **thay** khối hard-code `NOT_CHECKED` tại dòng 513–518 bằng:
  - `PASS` khi `status == "MATCH"`,
  - `REVIEW` khi `status in {"MISMATCH", "UNKNOWN"}` (không tự từ chối, chỉ chuyển cán bộ),
  - `NOT_CHECKED` chỉ khi module/kho không khả dụng.
- Giữ `template` trong `authenticity_check_keys` để MISMATCH/UNKNOWN vẫn chặn xếp XANH (điểm ≥ 90 hạ về 89) — hiện đã đúng, chỉ đổi nguồn trạng thái.
- **Không** thêm bất kỳ đường tự động RED/REJECT mới nào từ template.

**2.6. Sửa `apps/backend/src/evidence/evidence-processing.worker.ts`**
- Thêm `templateMatch: analysis?.templateMatch ?? null` vào `runOutput` để `aiPipelineRun.output` lưu được (documentChecks đã bao gồm key `template`).

**2.7. Test**
- Mới `apps/ai-service/test_template_matcher.py`: registry rỗng → `UNKNOWN`; ảnh khớp mẫu → `MATCH`; ảnh lệch → `MISMATCH`; mẫu hết hiệu lực bị loại.
- Sửa/bổ sung `apps/ai-service/test_unified.py`: check `template` phản ánh matcher (không còn hằng `NOT_CHECKED`); registry rỗng ⇒ `REVIEW`/`UNKNOWN` và **không** xếp GREEN.

### Khu vực 3 — Lớp 8: E2E trên DB test

**3.1. Sửa `apps/backend/test/workflow.integration.test.cjs`**
- Thêm comment đầu file: cách chạy (`TEST_DATABASE_URL` phải là DB local có `_test` trong path).
- Thêm sub-test mới `AI online E2E: job → AI → hàng đợi → quyết định → audit`:
  - Khởi động mock AI server bằng `node:http` trả JSON có `suggestions` + `analysis` (đủ `pipelineMode`, `tier`, `aiConfidenceScore`, `documentChecks` có key `template`, `forensicCheck`, `ocrExtraction`, `isDuplicate`).
  - Gán `process.env.AI_PIPELINE_URL = baseUrl(mock)`, tạo job mới qua luồng `supplement`/`submit`, rồi `await worker.processNext()`.
  - Assert: `aiProcessingJob.status === 'COMPLETED'`; `evidence.status === 'NEEDS_HUMAN_REVIEW'`; `aiPipelineRun.output.documentChecks` chứa `template`; có `ocrResult`, `verificationResult`, `aiSuggestion`; và **có** `anomalyFlag` khi mock trả `isDuplicate`.
  - Đo `Date.now()` trước/sau, log thời gian xử lý (phục vụ mục §7 "đo thời gian xử lý/tồn đọng").
  - Khôi phục `process.env.AI_PIPELINE_URL = ''` sau sub-test để không ảnh hưởng các test khác.

**3.2. Sửa `apps/backend/package.json`**
- Giữ nguyên `test` / `test:integration`; bổ sung `"test:e2e": "node --test test/workflow.integration.test.cjs"` làm bí danh rõ nghĩa cho chạy E2E có DB test.

### Khu vực 4 — Quy trình con người (nhãn/phê duyệt)

**4.1. Thêm `apps/ai-service/tools/validate_annotations.py`** (mới, CLI)
- `validate_annotations(dataset_dir: Path) -> dict`: kiểm tra
  - `sample_id` duy nhất và thuộc `manifest.jsonl`;
  - enum hợp lệ cho `document_type`, `*_match`, `validity_label`, `quality_label`, `template_match_label`, `suspected_tampering_label`, `duplicate_review_label`, `human_review_decision`, `annotation_status`;
  - khi `annotation_status == "complete"` thì không còn trường bắt buộc để trống;
  - exact-duplicate cùng `duplicate_group` phải cùng `split` (chống rò rỉ);
  - đếm và liệt kê mẫu chưa hoàn tất.
- Xuất `annotation_validation.json`; thoát mã lỗi ≠ 0 nếu có vi phạm.

**4.2. Thêm `apps/ai-service/tools/acceptance_gate_report.py`** (mới, CLI)
- Đọc `layer_metrics.json`, `annotation_validation.json`, `pilot_ocr_baseline.json`, và `e2e_result.json` (nếu có).
- Xuất `docs/Minh chứng Lọc/dataset-local/acceptance_report.md`: ánh xạ **9 mục checkbox §7** sang `PASS / FAIL / NOT_EVIDENCED`, mỗi mục kèm liên kết bằng chứng (file + số liệu). Các mục con người (shadow pilot, ký duyệt) để `NOT_EVIDENCED` với ô ký duyệt trống — không tự đánh PASS.

**4.3. Thêm `apps/ai-service/test_validate_annotations.py`** (mới)
- Ca hợp lệ; ca enum sai; ca thiếu trường khi `complete`; ca duplicate khác split.

## 4. Giả định & Quyết định (Assumptions & Decisions)

- **Được sửa pipeline:** cho phép sửa `pipeline_orchestrator.py` và worker backend như mô tả mục 2.5–2.6.
- **Không đổi hợp đồng API hiện có** trừ việc **thêm** trường `templateMatch` (tuỳ chọn) — backend cũ vẫn chạy.
- **Kho phôi khởi tạo rỗng** (`templates: []`): hành vi đúng là `UNKNOWN` → `REVIEW`, không xếp GREEN. Đây là trạng thái trung thực cho tới khi có phôi được cấp quyền.
- **Ngưỡng pHash 10 và ELA 0.25 giữ nguyên**; việc hiệu chỉnh dựa trên `layer_metrics` và do người duyệt (chưa tự đổi trong kế hoạch này).
- **`pipeline_predictions.csv`** là hợp đồng dữ liệu giữa bộ chạy và bộ đo; evaluator chạy được độc lập với dữ liệu tổng hợp, nên test không cần file gốc.
- **Không huấn luyện model** trong kế hoạch này (đúng §5 của spec).
- Không tạo tài liệu thừa; chỉ thêm `README.md` cho `templates/` và báo cáo do CLI sinh.

## 5. Kiểm chứng (Verification)

1. **AI service – test đơn vị** (từ `apps/ai-service`):
   ```powershell
   python -m unittest discover -s . -p "test_*.py" -t .
   ```
   Kỳ vọng: toàn bộ test cũ pass + test mới `test_layer_metrics.py`, `test_template_matcher.py`, `test_validate_annotations.py` pass.
2. **AI service – CLI chạy được**:
   ```powershell
   python tools\validate_annotations.py --dataset "..\..\docs\Minh chứng Lọc\dataset-local"
   python tools\run_pipeline_predictions.py --dataset "..\..\docs\Minh chứng Lọc\dataset-local" --limit 5
   python tools\evaluate_pipeline_layers.py --dataset "..\..\docs\Minh chứng Lọc\dataset-local"
   python tools\acceptance_gate_report.py --dataset "..\..\docs\Minh chứng Lọc\dataset-local"
   ```
   Kỳ vọng: sinh `annotation_validation.json`, `pipeline_predictions.csv`, `layer_metrics.json/.md`, `acceptance_report.md`; evaluator báo rõ `NOT_EVIDENCED` khi thiếu nhãn thay vì bịa số.
3. **Backend – typecheck & unit**:
   ```powershell
   cd apps\backend
   npx tsc --noEmit
   npm test
   ```
   Kỳ vọng: `tsc` exit 0; 19 test cũ vẫn pass.
4. **Backend – E2E trên DB test** (cần `TEST_DATABASE_URL` trỏ DB local có `_test`):
   ```powershell
   cd apps\backend
   $env:TEST_DATABASE_URL = "<postgres local>/edupoint_test"
   npm run test:e2e
   ```
   Kỳ vọng: sub-test "AI online E2E" chạy nhánh AI trực tuyến (mock server) và pass; log thời gian xử lý.
5. **Kiểm chứng không phá cổng an toàn:** test `test_unified.py` phải xác nhận khi kho phôi rỗng thì `template=REVIEW`, tier **không** phải GREEN, và điểm ≥ 90 bị hạ về 89.

## 6. Thứ tự thực thi đề xuất

1. Khu vực 2 (Lớp 6) — vì có sửa `pipeline_orchestrator.py` và ảnh hưởng test hiện có.
2. Khu vực 1 (khung đo lường) — phụ thuộc hợp đồng `pipeline_predictions.csv`.
3. Khu vực 4 (quy trình nhãn/nghiệm thu) — dùng `layer_metrics.json`.
4. Khu vực 3 (E2E) — độc lập, chạy cuối.
