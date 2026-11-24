# Kế hoạch kiểm chứng EduPoint

<a id="hybrid-groq-vietocr-20261125"></a>

## 2026-11-25 — Kiểm thử Giai đoạn 3 Hybrid Groq LLM, Tường lửa PII 3 lớp & VietOCR Offline

- **Unit tests (`apps/ai-service`):** `python -m unittest test_llm_assistant test_ml_and_flows test_template_matcher` → **16/16 PASS** (`2,64s`). Xác nhận Tường lửa PII 3 lớp cắt sạch tên lỗi dấu OCR/dính chữ/MSSV/CCCD/lượng máu, Smart Gatekeeper bỏ qua API khi đủ tự tin, Event Cache SQLite 7 ngày khử trùng lặp liên sinh viên (`0` HTTP call ở lần 2), retry fallback model khi `429/404` và fallback về ONNX khi `500`.
- **Kiểm thử Live Groq (`verify_groq_connection.py`):** `openai/gpt-oss-120b` phản hồi JSON hợp lệ trên văn bản đã lọc PII, phân loại đúng `Da Nang Code League 2024` → `MUC_5` (`confidence: 0,86`), lần gọi 2 trúng cache (`cacheHit=True`).
- **Kiểm thử lại 17 tệp gốc (16 ảnh qua `RapidOCR + VietOCR` offline + 1 PDF):** Riêng `PhoBERT FP32` nội bộ đạt **8/17 (`47,06%`)**, nhóm `conf ≥ 0,65` đạt **8/13**; khi bật **Hybrid `PhoBERT + Groq Gatekeeper`** (`7/17` lượt gọi API) đạt **11/17 (`64,71%`)**. Giữ bước Cán bộ Khoa kiểm tra cuối; chưa chạy lại backend worker và UI E2E.

<a id="phobert-fp32-local-20261125"></a>

## 2026-11-25 — Kiểm thử PhoBERT ONNX FP32 mới

- **Artifact và môi trường:** `phobert_fp32.onnx` (515,3 MiB), SHA-256 `ad78422a4dc6586b08752fc6127ab1fa4b376439680c0499938ea3bbb7d550aa`. Xác nhận phiên suy luận của predictor trong workspace nạp đúng file bằng ONNX Runtime 1.32.0, `CPUExecutionProvider`. Chạy offline với kết nối mạng Python bị chặn.
- **Cùng 70 mẫu văn bản:** Top-1 **59/70 (84,29%)**, top-3 **63/70**, macro-F1 **0,8200**. Trùng cả 11 ca sai và nhãn dự đoán sai trong báo cáo Kaggle. Bản INT8 đã đo trước đó đạt **54/70**, top-3 **61/70**, macro-F1 **0,7640**. Hai file ONNX được kiểm thử ở hai lượt riêng.
- **Cùng 17 tệp gốc:** 16 ảnh qua RapidOCR và 1 PDF đọc lớp văn bản. Dùng văn bản và tên hoạt động trích từ tệp, FP32 đạt top-1 **8/17 (47,06%)**, top-3 **10/17**. INT8 ở lượt trước đạt top-1 **9/17**, top-3 **12/17**. Trong nhóm tệp đạt confidence `≥ 0,65`, cả hai lượt đều có **7/12** dự đoán đúng. Bộ tệp nhỏ, tập trung vào Mục 12 (11/17), chưa đại diện minh chứng mới.
- **Regression:** `test_ml_and_flows` và `test_template_matcher` đạt **12/12**, gồm ca `Da Nang Code League 2024` từng sai với INT8. Trên 16 ảnh, phép đo cục bộ RapidOCR + FP32 ghi P50 **1,30 giây**, P95 **2,01 giây**. Peak RSS tiến trình **1.134,1 MiB**. Chưa chạy backend, Storage, API ngoài, UI hay kiểm tải đồng thời.

## 2026-11-25 — Kiểm thử lại PhoBERT ONNX INT8 và luồng đọc tệp local

- **Môi trường:** Python 3.11.15, ONNX Runtime 1.32.0 với `CPUExecutionProvider`, dùng `src.predictor.predict_rubric_criterion` từ workspace `65342c8`. File `model_quantized.onnx` có SHA-256 `ffaf065c707cf5898515f20aa888ea26d9bb41ea3952219ef4fb752e2a218652`. Chạy offline, chặn kết nối socket Python trong phép đo.
- **Văn bản:** Chạy lần lượt 70 dòng `datasets_v3/test.csv` qua predictor. Kết quả top-1 **54/70 (77,14%)**, top-3 **61/70**, macro-F1 **0,7640**. Không thấy `group_id` hoặc văn bản trùng sau chuẩn hóa chữ hoa/thường và khoảng trắng với train/val. Mốc **59/70** trong metadata là số đo từ logits PyTorch trước khi xuất ONNX. Kiểm thêm cách đệm token và kích thước lô trên ONNX vẫn đạt 54/70, một số nhãn dự đoán thay đổi. Chưa đối chiếu được logits theo mẫu với checkpoint PyTorch.
- **Tệp minh chứng gốc:** Ghép 17 mẫu `REAL_OCR_*` của test với file và nhãn có sẵn theo `sample_id`, kiểm trùng SHA-256 với các tệp gốc tra được từ train/val. Đọc 16 ảnh bằng RapidOCR và 1 PDF bằng lớp văn bản. Đưa văn bản và tên hoạt động OCR trích được qua predictor, đạt top-1 **9/17 (52,94%)**, top-3 **12/17**. Nếu chỉ đưa văn bản thì top-1 **8/17**. Trong 17 tệp, Mục 12 chiếm 11 và cả 9 ca đúng đều thuộc mục này. Mẫu nhỏ và lệch lớp, chưa đại diện tập minh chứng mới.
- **Mô phỏng ngưỡng `0,65`:** Văn bản có **51/61** dự đoán đúng trong nhóm đạt ngưỡng, **9/70** dưới ngưỡng. Tệp gốc có **7/12** dự đoán đúng trong nhóm đạt ngưỡng, **5/17** dưới ngưỡng. Đây là phép đo ngưỡng trên predictor. Chưa kiểm thử cổng gọi API, workflow duyệt hồ sơ, backend, Storage hoặc UI.

## 2026-11-23 — Train lại toàn bộ AI từ A đến Z (Pipeline A/B/C)

- **Pipeline A** (`research/activity-classification`, chạy `prepare_dataset → train_baseline → evaluate → error_analysis → export_model`): 259 mẫu / 239 `group_id` / 11 lớp. CV 5-fold `tfidf_linear_svc` Accuracy `0.8842 ± 0.0439`, Macro-F1 `0.8849 ± 0.0470`. Test mù 52 mẫu (mô hình chỉ học train+val): ML `45/52`, Accuracy `0.8654` (Wilson `[0.7473, 0.9332]`), Macro-F1 `0.8417`; keyword baseline `44/52`, Accuracy `0.8462`, Macro-F1 `0.8497`. Chênh lệch nằm trong khoảng tin cậy, chưa chứng minh ML vượt baseline.
- **Sửa phương pháp đánh giá:** `evaluate.py` trước đây đánh giá cố định `tfidf_logreg` thay vì mô hình được xuất; `error_analysis.py` dùng model production đã học cả test (rò rỉ). Cả hai nay fit mô hình thắng CV trên train+val. Số `84.62% / Macro-F1 0.8241` ghi ở mục dưới là của `tfidf_logreg`, không phải mô hình production.
- **Pipeline B** (`build_cv_dataset → train_mobilenet_cv --epochs 12`): test 42 ảnh tổng hợp accuracy `1.0`; kiểm tra ngoài phân phối 5 ảnh phôi đều ra lớp giấy tờ (0.52–0.88). Chưa có test ảnh thật — kết quả không đại diện thực tế.
- **Pipeline C:** `register_templates.py` đăng ký lại 5 phôi mô phỏng.
- **Regression:** `python -m unittest test_m2_contract_quality test_template_matcher test_ml_and_flows` → 23/23 OK; `node --test test/evidence-processing-worker.test.cjs` → 26/26 pass; khởi động lại FastAPI, `GET /health` → `rubricMlModelAvailable: true`. Chưa chạy lại seed đối chứng và browser E2E sau lần train này.

## 2026-11-23 — Huấn luyện Rubric Classifier v2.0.0 (11 lớp), MobileNetV3 CV (7 lớp), Kho phôi Lớp 6 & Forensics chống giả mạo

- **Rubric Classifier v2.0.0 (`research/activity-classification/`):** Mở rộng dataset lên **259 mẫu / 239 `group_id` độc lập** phủ đủ 11 lớp (`MUC_4, 5, 8, 9, 10, 12, 13, 14, 15, 16 + KHONG_HOP_LE`). 5-fold `StratifiedGroupKFold` đạt **Accuracy `88.42% ± 4.39%`**, **Macro-F1 `0.8851`** (tăng từ `0.5308` ở v1.0.0). Tập Test độc lập (`52 mẫu`, 0% trùng `group_id`) đạt **Accuracy `84.62%` (Wilson 95% CI `[72.48%, 91.99%]`)**, **Macro-F1 `0.8241`**, **Weighted-F1 `0.8385`**.
- **MobileNetV3-Small CV (`research/image-classification/`):** Huấn luyện 7 lớp hình ảnh (`GIAY_HIEN_MAU`, `GIAY_KHEN_GCN`, `SU_KIEN_HOI_TRUONG`, `SU_KIEN_TINH_NGUYEN`, `SU_KIEN_VAN_NGHE_THE_THAO`, `SU_KIEN_CLB_NGAY_HOI`, `KHONG_PHAI_MINH_CHUNG`, train=112, test=42), xuất TorchScript `apps/ai-service/model/event_scene_classifier.pt` và tích hợp vào `FaceAndVisionService`.
- **Kho phôi Lớp 6 & Unit Tests Python (`apps/ai-service/`):** Đăng ký 5 phôi chuẩn vào `apps/ai-service/templates/registry.json`; `test_m2_contract_quality.py` đạt **11/11**, `test_template_matcher.py` + `test_ml_and_flows.py` đạt **12/12**; Backend `evidence-processing-worker.test.cjs` đạt **26/26**.

## 2026-11-23 — Mở khóa DEC-014: Vá BL-008/BL-022 và chạy thật FastAPI AI Service

- **Backend:** `npx tsc --noEmit` đạt sạch; `node --test test/evidence-processing-worker.test.cjs` đạt **26/26** (bao gồm regression `BL-008` timeout bao trùm `response.json()` và `BL-022` `addSource` chuyển `PROCESSING` → `NEEDS_HUMAN_REVIEW`).
- **Web:** `npx tsc --noEmit` đạt; `node --test scripts/*.test.cjs` đạt **31/31** (đã mở lại mục "Chạy thử AI" cho `STAFF`/`ADMIN`, ẩn với `STUDENT`).
- **FastAPI AI Service (`apps/ai-service`, port 8000):** `GET /health` trả `healthy`, `ocrAvailable: true` (`rapidocr_vietocr` + `tesseract`), `rubricMlModelAvailable: true`.
- **Chạy thật end-to-end (Backend `AI_MODE=ASSIST` ↔ FastAPI AI ↔ Supabase Storage ↔ PostgreSQL):** Đã nạp 18 phôi chứng nhận PNG phân biệt theo 5 loại đúng cửa sổ học kỳ `2026_1` (`2026-09-01`..`2027-01-15`) và đẩy `AiProcessingJob`; worker đã gọi thành công pipeline, lưu thật `OcrResult`, `VerificationResult`, `AiSuggestion`, `AiPipelineRun` (điểm tin cậy ~80–89/100, gợi ý đúng trần tiêu chí, `isDuplicate: false`). Chưa chạy browser E2E tự động.

## 2026-11-23 — Hoàn thiện Frontend 4 gói (EvidenceDetail, Menu/Copy, Đồng bộ Khoa, Bản in A4)

- **Web:** `npx tsc --noEmit` đạt sạch; toàn bộ `node --test scripts/*.test.cjs` đạt **31/31** (`deadline-dialog-and-access.test.cjs`, `evidence-inspection.test.cjs`, `faculty-analytics.test.cjs`, `score-report-and-evidence-list.test.cjs`, 0 lỗi). Chưa chạy browser E2E tự động.

## 2026-11-23 — Chuẩn hóa quy tắc minh chứng 16 tiêu chí & dữ liệu minh chứng mẫu `2026_1`

- **Backend:** `npm run build` (`nest build`) đạt; `node --test test/grounding-import-and-batch-finalize.test.cjs` bổ sung `Ca 13b` đạt (xác nhận miễn cảnh báo cho `TC1, 2, 3, 6, 7, 11` và minh chứng đã `APPROVED`, cảnh báo đúng mã cho `TC4, TC5, TC14`). Lưu ý: 2 ca cũ `Ca 10` và `BL-033` trong suite phụ thuộc `AI_MODE=ASSIST` khi `.env` đặt `AI_MODE=OFF` (không thuộc phạm vi thay đổi lần này).
- **Web:** `npx tsc --noEmit` đạt; `node --test scripts/score-report-and-evidence-list.test.cjs` đạt **14/14** (bao gồm ca kiểm tra phân loại đủ 16 tiêu chí của `getCriterionEvidencePolicy`).
- **Dữ liệu kỳ `2026_1` & Supabase Storage:** Chạy `apps/backend/scripts/seed-sample-evidences-2026-1.cjs` (có `--dry-run` trước và kiểm tra idempotency) tạo 18 hồ sơ minh chứng mẫu (18 ảnh PNG chứng nhận thật trên Supabase Storage) cho 8 sinh viên Khoa CNTT (`SUBMITTED` / `NEEDS_HUMAN_REVIEW`). Kiểm tra ký URL trực tiếp từ Supabase Storage trả `HTTP 200 OK`. Chưa chạy browser E2E.

<a id="p1-suite-results"></a>

## 2026-11-23 — P1 và concurrency trên PostgreSQL 17

- Backend unit **198/198**, Web **30/30**, PostgreSQL integration **26/26**. Không có lỗi hoặc ca bị bỏ qua trong lượt cuối. Typecheck Backend/Web và `git diff --check` đạt.
- Docker PostgreSQL **17.12** với pgvector trên localhost. Áp dụng baseline nguyên văn theo quy trình bên dưới, Prisma báo đủ **15 migration**. Trên DB đã có schema cũ, fixture `CriterionAssessment` nhận `clubGroundingIds = []`, giữ điểm, trạng thái và dữ liệu xác minh. Bản ghi mới cũng nhận `[]`. Các migration đã có giữ nguyên.
- Ca BL-026/027 xác nhận kết nối thứ hai chờ khóa qua `pg_blocking_pids`. Kiểm hai thứ tự xóa/nộp, lưu điểm null, vượt trần và tắt F15 trước khi submit. Storage dùng giả lập. Không kết nối Supabase production hoặc AI ngoài. Chưa chạy browser E2E.

| Nhóm | Suite | Đạt / Tổng |
|---|---|---:|
| Backend | `accounts-and-permissions.test.cjs` | 22/22 |
| Backend | `activity-and-roles-scoring.test.cjs` | 19/19 |
| Backend | `data-protection.test.cjs` | 11/11 |
| Backend | `deadline-and-closure.test.cjs` | 16/16 |
| Backend | `evidence-and-term-selection.test.cjs` | 16/16 |
| Backend | `evidence-processing-worker.test.cjs` | 15/15 |
| Backend | `exclusion-and-restore.test.cjs` | 6/6 |
| Backend | `grounding-import-and-batch-finalize.test.cjs` | 26/26 |
| Backend | `grounding-import-values.test.cjs` | 2/2 |
| Backend | `pagination-and-filter.test.cjs` | 10/10 |
| Backend | `scoring-and-validation.test.cjs` | 39/39 |
| Backend | `security-fixes.test.cjs` | 16/16 |
| Web | `deadline-dialog-and-access.test.cjs` | 6/6 |
| Web | `evidence-inspection.test.cjs` | 5/5 |
| Web | `faculty-analytics.test.cjs` | 6/6 |
| Web | `score-report-and-evidence-list.test.cjs` | 13/13 |
| PostgreSQL | `grounding-db.integration.test.cjs` | 3/3 |
| PostgreSQL | `submission-concurrency.integration.test.cjs` | 6/6 |
| PostgreSQL | `workflow.integration.test.cjs` | 17/17 |

## 2026-11-23 — Regression BL-031, BL-033, BL-035, BL-037

- Backend **75/75 ca đạt**, gồm `grounding-import-and-batch-finalize.test.cjs`, `pagination-and-filter.test.cjs` và `scoring-and-validation.test.cjs`. Dùng DB doubles và `ResponseInterceptor` thật để kiểm lô một phiếu thành công/một phiếu bị chặn, điểm đã chốt khác điểm gợi ý, publication, 21 hồ sơ có mục cần bổ sung ngoài trang đầu và 51 thông báo có mục chưa đọc duy nhất ở vị trí 51.
- Web **29/29 ca đạt** với `node --test scripts/*.test.cjs`. Các regression mới render component với transport giả lập, kiểm bảng chốt và modal, điểm gợi ý 0 trên phiếu sinh viên, số liệu toàn kỳ và danh sách bổ sung khi đổi kỳ/lỗi tải, badge và trạng thái tab Chưa đọc trước/sau khi đánh dấu tất cả.
- Typecheck Backend/Web và `git diff --check` đạt. Chưa chạy PostgreSQL integration hoặc browser E2E cho đợt này.

## 2026-11-23 — Regression P0 trên PostgreSQL 17

- PostgreSQL Docker 17.12, pgvector trong `public`. Deploy trực tiếp từ DB trống gặp Prisma `P1014` ở baseline. Quy trình bên dưới áp dụng nguyên văn baseline rồi deploy 13 migration còn lại. Prisma báo đủ 14 migration và schema up to date.
- `workflow.integration.test.cjs` và `grounding-db.integration.test.cjs` đạt **17/17 ca theo Node**, không bỏ qua. BL-028 đối chiếu dữ liệu và audit trước/sau ở cả ba đường chốt, có lô thành công một phần. BL-029 kiểm hai kỳ có cùng MSSV, từ chối thiếu/lệch kỳ, replay đúng kỳ và xung đột khóa khác kỳ. Sửa fixture `startDate`, response tạo tài khoản và trạng thái kỳ grounding để hai suite chạy độc lập.
- `grounding-import-and-batch-finalize.test.cjs` và `grounding-import-values.test.cjs` đạt **27/27**. `score-report-and-evidence-list.test.cjs` đạt **7/7**, gồm ba ca dùng component nhập thật và workbook giả lập trong bộ nhớ để kiểm đổi kỳ, preview trả muộn, thay hoạt động/file và retry.
- Typecheck Backend/Web và `git diff --check` đạt. Kiểm nguồn xác nhận batch dùng cùng transaction để khóa hàng `Term`, kiểm quyền, ghi điểm và audit. Chưa chạy browser E2E, Storage hoặc pipeline ngoài.

<a id="postgresql-17-local"></a>

## Dựng PostgreSQL 17 local

Compose khởi tạo `pgvector/pgvector:pg17` với volume riêng và chạy [SQL bật extension vector](../apps/backend/prisma/init-local-postgres.sql) cho DB mặc định. Với DB test tạo riêng, chạy cùng SQL trong DB đó trước khi áp dụng baseline.

Với **DB local mới**, trỏ cả `DATABASE_URL` và `DIRECT_URL` vào cùng DB. Để chạy integration, đặt tên DB kết thúc bằng `_test` và đặt `TEST_DATABASE_URL` trỏ cùng địa chỉ localhost. Chạy các bước sau từ `apps/backend` sau khi đã đặt biến môi trường.

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f prisma/migrations/20261018000000_baseline_existing_supabase/migration.sql
./node_modules/.bin/prisma migrate resolve --applied 20261018000000_baseline_existing_supabase
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
AI_PIPELINE_URL= node --test --test-concurrency=1 test/*.integration.test.cjs
```

Baseline đặt `search_path` thành rỗng trong session. Trên PG17 và Prisma 5.22, chạy `migrate deploy` trực tiếp từ DB rỗng đã gặp `P1014` ở `_prisma_migrations`. Áp dụng baseline trong session `psql` riêng rồi ghi nhận bằng Prisma cho phép chạy các migration còn lại và bảo toàn checksum. Chỉ áp dụng bước baseline cho DB local mới. Nếu lần chạy một bước đã thất bại, dùng DB test mới để làm lại quy trình.

## 2026-11-17 — Regression sửa F15

- `grounding-import-values.test.cjs` kiểm tra trực tiếp parser FE và validator BE: ô trống giữ thiếu, giá trị sai không biến thành điểm/dữ liệu hợp lệ.
- 6 file test `grounding-import-values`, `grounding-import-and-batch-finalize`, `activity-and-roles-scoring`, `accounts-and-permissions`, `evidence-processing-worker`, `faculty-analytics`: **89/89 pass**, không dùng DB.
- `grounding-db.integration.test.cjs` trên PostgreSQL localhost `_test`: **1/1 pass**, kiểm tra import đồng thời, bỏ qua căn cứ trùng, provenance với ghi chú tùy ý, thu hồi/nhập lại, giữ sửa tay, và thu hồi điểm danh CONFIRMED rồi nhập lại nháp.
- Backend/frontend typecheck, `git diff --check` đạt. Prisma migrate deploy 14 migrations trên bản sao tạm sau khi loại hai lệnh baseline không tương thích PostgreSQL 16; không chứng minh migrations gốc chạy nguyên bản trên database mới.
- Chưa kiểm browser E2E mới, transaction tranh chấp chốt/thu hồi và chuyển công tắc kỳ, hay Storage; không tuyên bố toàn bộ F15 hoàn tất.
- Cần kiểm tra và đối soát dữ liệu F15 đã được áp dụng trước migration provenance nếu có: không tự đoán `academicGroundingId` từ ghi chú cũ; bản ghi thiếu liên kết được giữ an toàn như dữ liệu thủ công, có thể cần xử lý riêng khi thu hồi lô.

Đợt tài liệu ngày 2026-11-15 chỉ thay Markdown. Không chạy backend, DB integration, browser fixture, migration, seed hoặc pipeline thật để xác nhận tài liệu. Mọi ca feature hiện là **Planned**, trừ bằng chứng test cụ thể được ghi rõ dưới đây.

## Phân loại bằng chứng

### Kiểm thử xác minh & Nghiệm thu toàn diện sau review (2026-11-16)

Đã giải quyết dứt điểm 7 điểm khiếm khuyết được chỉ ra trong review độc lập, bổ sung đầy đủ unit test in-memory và component test cho mã nguồn thật:

### Kiểm thử tính năng Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt (2026-11-17)

Đã hoàn thành toàn diện 3 Phase theo kế hoạch đã phê duyệt, bao gồm 20 ca kiểm thử hồi quy service/core backend và build production frontend:

1. **Test Suite Backend Core & Service Regression:**
   - File test: [apps/backend/test/grounding-import-and-batch-finalize.test.cjs](../apps/backend/test/grounding-import-and-batch-finalize.test.cjs) (**20/20 tests PASS 100%**).
   - Ca 1: MSSV dạng text giữ số 0 ở đầu ("0102210001"), preview VALID.
   - Ca 2: Dữ liệu học vụ có trường thiếu / sai kiểu -> Validator phát hiện và Preview đánh dấu ERROR.
   - Ca 3: MSSV ngoài phạm vi Khoa của cán bộ -> Preview đánh dấu ERROR.
   - Ca 4: Trùng lặp sinh viên + tiêu chí trong cùng file -> Dòng thứ 2 đánh dấu ERROR.
   - Ca 5: Preview tuyệt đối KHÔNG ghi vào database (chỉ đọc).
   - Ca 6: Confirm import ghi đúng dòng hợp lệ; hỗ trợ idempotencyReplay khi gửi trùng idempotencyKey.
   - Ca 7: Tái sử dụng batchAddParticipants nhận participants: [{ studentCode, formRole }] và gán batchId.
   - Ca 8: Sau khi import AcademicGrounding, tự động đồng bộ vào CriterionAssessment (verifiedData, suggestedScore, READY_FOR_REVIEW).
   - Ca 9: Tiêu chí đã FINALIZED trước đó không bị ghi đè điểm chính thức khi đồng bộ grounding.
   - Ca 10: getMine tự động đồng bộ căn cứ học vụ khi sinh viên hoặc cán bộ mở xem phiếu.
   - Ca 11: Ở kỳ evidenceBasisWorkflowEnabled = true, minh chứng 0 file có mô tả >= 10 ký tự nộp thành công, chuyển sang NEEDS_HUMAN_REVIEW và KHÔNG tạo AiJob.
   - Ca 12: Ở kỳ evidenceBasisWorkflowEnabled = false (kỳ cũ), minh chứng 0 file bị chặn như quy tắc cũ.
   - Ca 13: Preflight không cảnh báo thiếu minh chứng nếu đã có điểm danh CONFIRMED hoặc căn cứ học vụ / CLB.
   - Ca 14: Lô chưa có sinh viên nào bị chốt điểm -> Thu hồi thành công, tự động reset điểm đề xuất liên quan.
   - Ca 15: Có ít nhất một dòng trong lô đã được dùng để chốt điểm (FINALIZED) -> Chặn toàn bộ lô.
   - Ca 16: Có ít nhất một sinh viên trong lô đã được gửi lên Admin (SENT) -> Chặn toàn bộ lô.
   - Ca 17: Chốt một phiếu sinh viên: Chuyển toàn bộ tiêu chí READY_FOR_REVIEW thành FINALIZED với officialScore = suggestedScore.
   - Ca 18: Chặn chốt phiếu khi còn minh chứng ở trạng thái NEEDS_HUMAN_REVIEW hoặc NEEDS_SUPPLEMENT.
   - Ca 19: Chốt hàng loạt tối đa 100 phiếu, transaction riêng từng phiếu: phiếu lỗi không ảnh hưởng phiếu hợp lệ.
   - Ca 20: Chốt hàng loạt từ chối khi danh sách vượt quá 100 phiếu.

2. **Frontend Typecheck & Production Build:**
   - Typecheck frontend (`apps/web`): 0 lỗi.
   - Typecheck backend (`apps/backend`): 0 lỗi.
   - Production bundle build: `vite build` thành công trong 2.32s (`dist/assets/index-BraYyZfv.js`).

1. **BL-014 & BL-005 (Activity Aggregator & Roles Scoring):**
   - File test: [apps/backend/test/activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs) (**13/13 tests pass 100%**).
   - Kiểm chứng tiêu chí 12 không tự gán mặc định trong `DUT_RUBRIC_CRITERIA` theo DEC-009; thiếu rate `CHEERLEADER` lập tức báo blocker `NEEDS_VERIFICATION, suggestedScore: null` (không fallback ngầm sang PARTICIPANT hoặc 0).
   - Kiểm chứng round-trip bằng `CriteriaService` thật: cập nhật draft có `rolesScore` → đọc lại qua `getTermRubric` → sao chép qua `createTerm` bảo toàn 100% cấu hình vai trò `rolesScore`.
   - Kiểm chứng `validateScoringConfig` chấp nhận `rolesScore` hợp lệ và từ chối `rolesScore` chứa điểm số âm.

2. **BL-024 (ScoreReport term switch & Preflight):**
   - File test: [apps/web/scripts/score-report-and-evidence-list.test.cjs](../apps/web/scripts/score-report-and-evidence-list.test.cjs) (**4/4 tests pass 100%**).
   - Kiểm chứng Deferred Promise: khi bắt đầu nộp ở kỳ A và đổi sang kỳ B trong lúc request preflight đang treo, `submitGenerationRef` và `currentTermRef` hủy kết quả kỳ A, `preflight` bị xóa sạch khi đổi kỳ và tuyệt đối không hiển thị xác nhận nộp kỳ A trên màn hình kỳ B.

1. **BL-005 & BL-014 (Activity Aggregator & Roles Scoring):**
   - File test: [apps/backend/test/activity-and-roles-scoring.test.cjs](../apps/backend/test/activity-and-roles-scoring.test.cjs) (**19/19 tests pass 100%**).
   - Kiểm chứng round-trip qua `CriteriaService` thật: bảo toàn 100% `rolesScore` qua các chặng draft -> getTermRubric -> createTerm (kế thừa kỳ nguồn).
   - Tuân thủ DEC-006 & DEC-009: `DUT_RUBRIC_CRITERIA` không tự ý gán mặc định bảng điểm vai trò.
   - Bản nháp (draft: isPublishing = false) cho phép thiếu `rolesScore` (Ca 8).
   - Khi ban hành (publishTermRubric / isPublishing = true): bắt buộc đủ 3 vai trò (Tham gia, Ban tổ chức, Cổ vũ), điểm hợp lệ không âm; thiếu vai trò hoặc có alias mâu thuẫn (như CO_VU: 2.5 vs CHEERLEADER: 3) bị từ chối ngay lập tức (Ca 9, 10, 11).
   - Alias tương đương cùng điểm (ví dụ THAM_GIA/PARTICIPANT: 5, BAN_TO_CHUC/ORGANIZER: 7, CO_VU/CHEERLEADER: 2.5) ban hành thành công (Ca 12).
   - Aggregator phát hiện alias mâu thuẫn và thiếu vai trò báo blocker `NEEDS_VERIFICATION, suggestedScore: null` (Ca 2, Ca 13).

2. **BL-011, BL-012, BL-025 (Accounts, Permissions & Scope):**
   - File test: [apps/backend/test/accounts-and-permissions.test.cjs](../apps/backend/test/accounts-and-permissions.test.cjs) (**21/21 tests pass 100%**).
   - Kiểm chứng `bulkImport` áp dụng `validateUserPayload` từng dòng trước khi mở transaction; khi rollback không tăng `importedCount` và không trả `temporaryCredentials`.
   - `findAll` giữ nguyên `facultyId` trực tiếp gán trên User; cán bộ Khoa chỉ xem sinh viên thuộc Khoa mình.
   - Cho phép sửa thông tin không liên quan (như `fullName`, `email`) hoặc khóa tài khoản (`isActive: false`) của tài khoản legacy STUDENT/STAFF thiếu lớp/Khoa/MSSV mà tuyệt đối **không truy vấn class/faculty với ID null** (Ca 8, Ca 9).
   - Khi bổ sung định danh (studentCode) hoặc kích hoạt tài khoản (`isActive: true` từ tài khoản đang bị khóa) thì bắt buộc kiểm tra dữ liệu đầy đủ và từ chối nếu thiếu thông tin bắt buộc (Ca 10, Ca 11, Ca 12).
   - Kiểm chứng `JwtAuthGuard` thật chạy qua prototype không monkey-patch đè lên `canActivate`.

3. **BL-021 (Chu trình Loại trừ → Khôi phục → Loại trừ lại):**
   - File test: [apps/backend/test/exclusion-and-restore.test.cjs](../apps/backend/test/exclusion-and-restore.test.cjs) (**6/6 tests pass 100%**).
   - Giữ nguyên `revision` bàn giao của Handoff (không tự tăng revision sai ngữ cảnh); sinh `eventId = randomUUID()` cho `dedupeKey` bảo đảm tính duy nhất tuyệt đối.
   - Đã ở trạng thái `EXCLUDED` là strict no-op: gọi lặp lại kể cả với lý do khác không ghi đè lý do cũ và không sinh notification thừa; ghi nhận `eventId` vào audit log.

4. **BL-018 & BL-019 (Pagination, Filter & Evidence List):**
   - File test: [apps/backend/test/pagination-and-filter.test.cjs](../apps/backend/test/pagination-and-filter.test.cjs) (**8/8 tests pass 100%**) và [apps/web/scripts/score-report-and-evidence-list.test.cjs](../apps/web/scripts/score-report-and-evidence-list.test.cjs).
   - `ProfileDataIssues.tsx`: `requestGen` chặn triệt để phản hồi cũ từ tab `OPEN` ghi đè lên tab `RESOLVED`.
   - `EvidenceList.tsx`: đồng bộ query `?termId=...` vào URL; tự động reset `page = 1` khi đổi kỳ.
   - `evidence.service.ts`: hỗ trợ tìm kiếm theo ID minh chứng; không xóa filter search khỏi `baseScopeWhere` để tab counts phản ánh đúng số lượng theo từ khóa.

**Tổng kết kiểm thử tự động:**
- Backend: **169 tests (168 passed, 1 skipped isolated DB)** trong 10 suites (`node --test apps/backend/test/*.test.cjs`).
- Web: **21 tests passed 100%** trong 4 suites (`node --test apps/web/scripts/*.test.cjs`).
- Toàn bộ **189 pure/in-memory unit tests đạt 100%**, không có failure hay timeout.
- TypeScript compiler: **0 lỗi** trên cả `apps/web` và `apps/backend`.
- `git diff --check`: **sạch sẽ, 0 lỗi whitespace**.

### Review độc lập ngày 2026-11-16 — Đợt 5, 7, 8, 9, 10

Chạy trực tiếp `node --test` với 13 file sau, không dùng glob integration:

- Backend (`apps/backend/test/`): `accounts-and-permissions.test.cjs`, `activity-and-roles-scoring.test.cjs`, `pagination-and-filter.test.cjs`, `exclusion-and-restore.test.cjs`, `evidence-and-term-selection.test.cjs`, `scoring-and-validation.test.cjs`, `deadline-and-closure.test.cjs`, `data-protection.test.cjs`, `security-fixes.test.cjs`, `evidence-processing-worker.test.cjs`.
- Web (`apps/web/scripts/`): `deadline-dialog-and-access.test.cjs`, `evidence-inspection.test.cjs`, `faculty-analytics.test.cjs`.
- Kết quả: **169 tests pass, 25 suites, 0 fail, 0 skipped**, khoảng 17.2 giây. Không có DB integration trong lệnh này. Typecheck hai app đạt; backend tắt incremental. `git diff --check` đạt.
- Không dùng tổng test làm bằng chứng nghiệm thu: test guard ghi đè method đang được kiểm; một số test frontend chép lại thuật toán và không mount component thật. Cần test guard thật qua Passport/metadata/filter và component thật với Deferred Promise khi đổi kỳ/preflight/retry.
- Reproduction ad hoc bằng source/service thật và doubles, không lưu regression mới: thiếu CHEERLEADER rate bị fallback thành 5 điểm; `getTermRubric` bỏ rolesScore; validator publish cho qua rolesScore âm; lỗi audit import vẫn trả credential/count thành công; handler submitAll nhận preflight kỳ A khi currentPage là B. Các kết quả này chứng minh còn thiếu ca kiểm thử, không phải production/DB reproduction.
- Cần bổ sung: round-trip rubric đọc/lưu/copy kỳ giữ nguyên rolesScore, publish thiếu/âm/alias sai bị chặn; import rollback không tăng count/credential; exclude đã EXCLUDED khác lý do vẫn no-op và revision giữ nguyên; pagination/search/counts/URL và phản hồi cũ trên component thật. Giữ AI hoãn theo DEC-007, DB concurrency chưa kiểm chứng.

| Mức | Chứng minh được | Không chứng minh được |
|---|---|---|
| Source inspection | Điều kiện/nhánh/quan hệ và mismatch contract | Deployment/schema đã áp dụng, thứ tự concurrency thật |
| Pure/in-memory | Công thức, serialization, policy và interleaving được mô hình | FK/transaction isolation, Storage/network thật |
| DB integration cách ly | Ràng buộc và transaction trên DB test cụ thể | Production giống cấu hình hoặc dữ liệu test |
| Browser end to end cách ly | UI→API→DB test và điều hướng qua browser | Production hoàn hảo, mọi thiết bị hoặc mọi ca biên |
| Kiểm tra dịch vụ ngoài được phép | Pipeline/storage môi trường được cấp | Không suy từ mock sang dịch vụ thật |

## Kết quả historical của audit

Cuộc trao đổi audit trước ghi nhận 15 worker tests và 6 faculty analytics tests đạt;23 ca tái hiện in-memory có chọn lọc gồm 2 mô hình race. Các harness ad hoc không được lưu vào repository; chưa có regression suite tái chạy cho toàn bộ 27 finding. Không coi số này là test đã chạy lại trong đợt tài liệu.

Tài liệu navigation/dashboard cũ từng ghi build/integration/browser đã đạt với fixture 108 sinh viên,9 lớp,8 state,6 minhchứng. Đây là báo cáo lịch sử, không được tái xác nhận ở đợt này; test fixture hiện cần rà trường startDate bắt buộc của Activity trước khi sử dụng. Không dùng claim cũ làm điều kiện đóng backlog.

## Suite hiện có và cách chọn an toàn

| Nguồn | Loại / giới hạn |
|---|---|
| [exclusion & restore backend unit](../apps/backend/test/exclusion-and-restore.test.cjs) | In-memory doubles & State machine test; kiểm BL-021 (6 ca: chu trình Loại trừ (lần 1) -> Khôi phục -> Loại trừ lại (lần 2) thành công 100% không bị lỗi P2002 dedupeKey, tính idempotent khi exclude lặp lại không tạo notification thừa, restore sinh viên không ở trạng thái EXCLUDED bị từ chối, cán bộ Khoa không có quyền bị chặn, không thể loại trừ khi đã công bố kết quả, không thể loại trừ hoặc khôi phục khi kỳ đã chốt CLOSED); 6/6 tests pass |
| [pagination & filter backend unit](../apps/backend/test/pagination-and-filter.test.cjs) | In-memory doubles & Pagination envelope test; kiểm BL-018 (3 ca: list ProfileDataIssues trả về envelope { items, total, page, pageSize }, chuyển trang 2 skip/take chính xác, chuẩn hóa pageSize an toàn tối đa 100 và fallback 25 khi âm), BL-019 (4 ca: findAll Evidence phân trang server-side với page/pageSize, lọc statusGroup APPROVED, counts toàn kỳ chuẩn xác cho 4 nhóm trạng thái không bị cắt xén, tìm kiếm không phân biệt hoa thường); 7/7 tests pass |
| [activity & roles scoring backend unit](../apps/backend/test/activity-and-roles-scoring.test.cjs) | In-memory doubles & Aggregator test; kiểm BL-005 (6 ca: gộp cùng activityId thành 1 hoạt động không đếm 2 lần, minh chứng độc lập không activityId nhận diện riêng bằng evidence.id, ưu tiên vai trò PARTICIPANT từ attendance CONFIRMED trước khai báo ORGANIZER của minh chứng, nhiều evidence APPROVED mâu thuẫn vai trò báo blocker NEEDS_VERIFICATION kèm lý do, minh chứng pending báo blocker NEEDS_VERIFICATION suggestedScore null, recomputeAndSaveActivityCriterion vô hiệu hóa officialScore cũ khi căn cứ thay đổi), BL-014 (5 ca: tiêu chí 12 trong DUT_RUBRIC_CRITERIA có đầy đủ rolesScore chuẩn, validateScoringConfig chấp nhận rolesScore hợp lệ, từ chối rolesScore chứa điểm số âm, tiêu chí cộng đồng tính đúng điểm theo rolesScore cấu hình, tiêu chí thiếu rolesScore báo blocker NEEDS_VERIFICATION); 11/11 tests pass |
| [accounts & permissions backend unit](../apps/backend/test/accounts-and-permissions.test.cjs) | In-memory doubles, ExecutionContext mock & Guard test; kiểm BL-016 (4 ca: user.isFirstLogin = true chặn API nghiệp vụ với HTTP 403 FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED, cho phép @AllowFirstLogin(), user thường qua bình thường, tương thích khi không inject reflector), BL-025 (6 ca: validate ràng buộc vai trò STUDENT bắt buộc MSSV/lớp thuộc Khoa, STAFF bắt buộc Khoa cấm MSSV/lớp, ADMIN cấm gán Khoa/lớp, cấm chuỗi rỗng/khoảng trắng, update cấm xóa trường bắt buộc của vai trò, cho phép khóa tài khoản legacy isActive: false), BL-011 (3 ca: tạo user không password sinh temporaryPassword ngẫu nhiên không lộ hash/authVersion, tạo user có password không echo lại và temporaryPassword: null, reset password sinh temporaryPassword và bật isFirstLogin: true), BL-012 (2 ca: findAll trả về đầy đủ classId/facultyId và chuẩn hóa student.facultyId từ class, STAFF chỉ xem được sinh viên thuộc Khoa của mình); 15/15 tests pass |
| [evidence & term selection backend unit](../apps/backend/test/evidence-and-term-selection.test.cjs) | In-memory doubles & Logic test; kiểm BL-015 (5 ca: phiếu RETURNED + evidence APPROVED chặn addFile, uploadDraftFile chặn non-draft, race condition status đổi thành APPROVED trong tx bị chặn, sai sinh viên bị Forbidden, update hồ sơ APPROVED bị chặn), BL-013 (3 ca: nháp có criterionAssessment.criterion hiển thị đúng sau reload, direct link ưu tiên hơn review cũ không bị ghi đè, cùng code 1.1 ở 2 rubric không ghép nhầm), BL-023 (4 ca: missingItem khác review.reason hiển thị đúng, deadline null hiển thị Không đặt hạn riêng kèm hạn kỳ, deadline quá hạn isExpired = true khóa gửi, không có yêu cầu mở hasOpenRequest = false), BL-024 (4 ca: URL có termId hợp lệ mở đúng kỳ, URL termId sai báo lỗi khóa form không fallback ngầm, URL không termId chuẩn hóa về kỳ hiện tại, đổi kỳ giữa chừng hủy nộp sang kỳ mới); 16/16 tests pass |
| [scoring & validation backend unit](../apps/backend/test/scoring-and-validation.test.cjs) | In-memory doubles, React Component Harness & Evaluator; kiểm BL-003 (15 ca: tiêu chí 2 có baseScore: 3, 6 ca tính điểm theo quy chế vắng/trễ việc/vượt trần, all_conditions bắt buộc communityViolations không cho 10 điểm khi thiếu dữ liệu, dữ liệu null/undefined trả NEEDS_VERIFICATION, cấu hình cũ tiers [null] trong activity_threshold và community_activity_tier không crash, config thiếu baseScore trả NEEDS_VERIFICATION không crash, validator từ chối lưu rubric sai cấu hình, đối chứng đỏ), BL-004 (8 ca: leadershipRole boolean tiêu chí 14 >90% được 4đ, tiêu chí 16 được 3đ, 90.0% bị 0đ, string "true" bị từ chối HTTP 400, render component thật CriterionCard từ StudentAssessment.tsx thao tác Có/Không gửi đúng boolean true/false), BL-017 (16 ca: validateVerifiedData từ chối counter âm/thập phân/chuỗi rác/boolean, validation enum từ chối mảng/object cho awardTier và academicTier, evaluator từ chối tính điểm mảng/object, mã lỗi qua HttpExceptionFilter thật trả đúng contract { error: { code: "INVALID_VERIFICATION_DATA" } }, gọi verifyCriterion thật với DB doubles chứng minh request invalid KHÔNG ghi DB/audit, tỷ lệ >100 hoặc âm, chấp nhận tỷ lệ thập phân 95.5% và điểm cộng đồng thập phân 7.5, từ chối officialScore > maxScore, 0 hợp lệ tính đúng điểm, evaluator từ chối ép 0 sai lệch, đối chứng đỏ hàm count cũ); 39/39 tests pass |
| [deadline & closure backend unit](../apps/backend/test/deadline-and-closure.test.cjs) | In-memory doubles, Term lock queue & DTO validation; kiểm BL-006 (11 ca: khóa chốt kỳ khi còn gia hạn phúc khảo hiệu lực, ưu tiên cá nhân → lớp, id: desc, ca biên now === deadline, đối chứng đỏ, 2 ca lock concurrency: 2 revoke đồng thời đọc lại sau khóa, xen kẽ chốt kỳ và gia hạn), BL-020 (4 ca: DTO validation query, 105 sinh viên phân trang trang 5/6, snapshot lớp, loại trùng lớp, từ chối đối tượng ngoài kỳ); 15/15 tests pass |
| [deadline dialog & access web unit](../apps/web/scripts/deadline-dialog-and-access.test.cjs) | React Component & Hook Harness chạy mã nguồn thật; kiểm BL-020 (2 ca dialog thật: MSSV/tên/lớp snapshot không undefined, phân trang 105 sinh viên 6 trang), BL-010 (4 ca hook thật: DRAFT, RETURNED, thời điểm hết hạn khóa ngay trên UI, đối chứng đỏ); 6/6 tests pass |
| [data protection unit](../apps/backend/test/data-protection.test.cjs) | In-memory doubles; kiểm BL-007 (tách 3 bước upload/commit/ký, lỗi ký không xóa Storage, fallback signedUrlAvailable: false, đối chứng đỏ/xanh) và BL-026 (5 ca đối chứng kịch bản race condition nộp/xóa, lock Term, đọc file trong lock, cleanup sau commit, rollback an toàn); 11/11 tests pass |
| [security fixes unit](../apps/backend/test/security-fixes.test.cjs) | In-memory doubles & Passport authenticate thật; kiểm BL-001 (scope/kỳ & dashboard sinh viên), BL-002 (select reviewer an toàn), BL-009 (JWT registerAsync factory + token 12h); 16/16 tests pass |
| [worker unit](../apps/backend/test/evidence-processing-worker.test.cjs) | In-memory doubles; kiểm worker/lease/recovery/version; đọc harness trước khi chạy |
| [faculty analytics unit](../apps/web/scripts/faculty-analytics.test.cjs) | Thuần tính toán: state, tổng hợp lớp, trùng/thiếu/empty và thứ tự |
| [workflow integration](../apps/backend/test/workflow.integration.test.cjs) | Ghi fixture PostgreSQL; không chạy trong audit/docs read-only |
| [browser smoke](../apps/backend/test/browser-smoke.cjs), [UX checks](../apps/backend/test/ux-checks.cjs) | Có phụ thuộc môi trường/fixture/backend, phải kiểm setup |
| [navigation smoke](../apps/web/scripts/navigation-smoke.cjs), [faculty charts checks](../apps/web/scripts/faculty-charts.checks.cjs) | Browser + fixture; có nhánh charts-only; không tự chạy DB thật |
| [workflow integrity script](../apps/backend/scripts/check-workflow-integrity.cjs) | Có truy cập DB; dù thiết kế đọc số lượng vẫn không tự kết nối môi trường thật khi chưa thuộc phạm vi |

Lệnh pure có thể dùng sau khi inspect harness và xác nhận không gọi DB/AI:

```sh
# cwd: apps/backend
node --test test/evidence-processing-worker.test.cjs
node --test test/security-fixes.test.cjs
node --test test/data-protection.test.cjs
node --test test/deadline-and-closure.test.cjs
node --test test/scoring-and-validation.test.cjs
node --test test/evidence-and-term-selection.test.cjs
node --test test/accounts-and-permissions.test.cjs
node --test test/activity-and-roles-scoring.test.cjs
node --test test/pagination-and-filter.test.cjs
node --test test/exclusion-and-restore.test.cjs
```

```sh
# cwd: apps/web
node --test scripts/faculty-analytics.test.cjs
node --test scripts/evidence-inspection.test.cjs
node --test scripts/deadline-dialog-and-access.test.cjs
```

Không dùng `npm test` backend cho audit vì glob bao gồm workflow.integration.test.cjs. Không chạy backend để “chỉ xem Swagger”: EvidenceProcessingWorker khởi động cùng ứng dụng.

## Ma trận regression của audit

Mỗi BL giữ kịch bản chi tiết trong [audit](BUSINESS_LOGIC_AUDIT.md). Đây là danh sách việc test cần có, không là kết quả Passed.

| Finding | Tầng cần kiểm tra | Kỳ vọng/bằng chứng |
|---|---|---|
| [BL-001](BUSINESS_LOGIC_AUDIT.md#bl-001) | Service/API doubles | **Passed (unit):** Đạt 5/5 ca trong security-fixes.test.cjs; kỳ không tồn tại ném NotFoundException, DB rỗng trả empty score, thiếu snapshot ném ForbiddenException, request có/không termId với sinh viên chuyển Khoa đều dùng cùng ranh giới snapshot Khoa. |
| [BL-002](BUSINESS_LOGIC_AUDIT.md#bl-002) | Service/API doubles | **Passed (unit):** Đạt 2/2 ca trong security-fixes.test.cjs; reviewer dùng projection select an toàn { id, fullName, role }, payload và chuỗi JSON không chứa password/authVersion; bắt được lỗi nếu code cũ dùng reviewer: true. |
| [BL-003](BUSINESS_LOGIC_AUDIT.md#bl-003) | Pure/service doubles | **Passed (unit):** Đạt 15/15 ca trong scoring-and-validation.test.cjs; tiêu chí 2 mặc định có baseScore: 3 và tổng điểm khung I đúng 20; tính đúng 6 ca theo quy chế (không vi phạm: 3đ, vắng không phép 1 lần: 1đ, vắng có phép 1 lần: 3đ, vắng có phép 2 lần: 2đ, trễ hạn nhóm: 0đ, điểm trừ vượt trần: 0đ); all_conditions bắt buộc communityViolations không cho 10 điểm khi thiếu dữ liệu vi phạm; dữ liệu null/undefined trả NEEDS_VERIFICATION; cấu hình cũ tiers [null] trong activity_threshold và community_activity_tier không crash; config thiếu baseScore trả NEEDS_VERIFICATION rõ ràng không crash; validateScoringConfig từ chối lưu rubric sai cấu hình; đối chứng đỏ chứng minh code cũ sinh NaN. |
| [BL-004](BUSINESS_LOGIC_AUDIT.md#bl-004) | Contract/form + browser cách ly | **Passed (unit/component thật):** Đạt 8/8 ca trong scoring-and-validation.test.cjs; tiêu chí 14 đúng chức vụ, 95%, xác nhận đạt 4 điểm; đúng 90.0% bị 0 điểm (yêu cầu trên 90%); 90.1% đạt 4 điểm; tiêu chí 16 đạt 3 điểm; string "true" bị backend validateVerifiedData từ chối HTTP 400; render component thật CriterionCard từ StudentAssessment.tsx thao tác chọn Có/Không gửi đúng boolean true/false lên API. |
| [BL-005](BUSINESS_LOGIC_AUDIT.md#bl-005) | Service/API + DB cách ly | CONFIRMED roster không có Evidence, chỉ Evidence, cả hai cùng hoạt động và hai nguồn khác hoạt động; kết quả không đổi theo thứ tự lưu. |
| [BL-006](BUSINESS_LOGIC_AUDIT.md#bl-006) | Service/API + DB cách ly | **Passed (unit/concurrency):** Đạt 12/12 ca trong deadline-and-closure.test.cjs; chốt kỳ thành công khi hết hạn gốc và không có gia hạn; chặn khi tại đúng thời điểm biên (now === deadline); chặn khi có gia hạn cá nhân hoặc lớp còn hiệu lực; ưu tiên cá nhân → lớp; thứ tự phụ id: desc; gia hạn ngoài roster không chặn kỳ; đối chứng đỏ logic cũ; 3 ca concurrency lock (revoke đồng thời đọc lại sau khóa, và 2 ca concurrency lock barrier mô phỏng tranh chấp cả 2 thứ tự chốt kỳ/gia hạn). |
| [BL-007](BUSINESS_LOGIC_AUDIT.md#bl-007) | Service doubles rồi DB/Storage cách ly | **Passed (unit):** Đạt 6/6 ca trong data-protection.test.cjs (tách riêng 3 bước upload/commit/ký; lỗi ký không xóa tệp đã lưu trong DB, trả phản hồi an toàn signedUrlAvailable: false; đối chứng đỏ/xanh chứng minh code cũ xóa tệp, code mới giữ tệp) và 5/5 ca trong evidence-inspection.test.cjs (gọi trực tiếp component thực tế EvidenceInspection và ReviewDetail với Deferred Promise điều khiển thủ công: retry 2 hoàn thành trước, retry 1 trả về sau không ghi đè; xóa sạch error khi retry thành công; có đối chứng đỏ chứng minh code lỗi làm test fail). |
| [BL-008](BUSINESS_LOGIC_AUDIT.md#bl-008) | Pure/service doubles | Mock response có headers tức thì, body treo; sau deadline job kết thúc đúng trạng thái và poller nhận job tiếp. |
| [BL-009](BUSINESS_LOGIC_AUDIT.md#bl-009) | Pure/service doubles | **Passed (unit):** Đạt 4/4 ca trong security-fixes.test.cjs qua Passport strategy thật; token 12h ký bằng secret từ ConfigService được xác thực thành công; token ký bằng fallback bị invalid signature; production thiếu secret ném lỗi. |
| [BL-010](BUSINESS_LOGIC_AUDIT.md#bl-010) | Contract/form + browser cách ly | **Passed (unit/hook thật):** Đạt 4/4 ca trong deadline-dialog-and-access.test.cjs chạy trực tiếp hook thật `useStudentAssessmentAccess`; mock đúng `getMyAssessments`; hook đọc effectiveDeadlines, khi hạn gốc đã qua nhưng có gia hạn tương lai thì canEdit=true, editDeadline cập nhật đúng hạn gia hạn; phiếu RETURNED đọc hạn review hiệu lực; khi hết hạn trong lúc API refresh đang treo thì canEdit lập tức chuyển false trước khi response về, kèm kiểm chứng nhánh refresh thất bại (lỗi 500); đối chứng đỏ chứng minh code cũ bỏ !deadlinePassed cho phép sửa sai khi đã hết hạn. |
| [BL-011](BUSINESS_LOGIC_AUDIT.md#bl-011) | Service/API + DB cách ly | Tạo không password và import thành công: Admin nhận được phương thức bàn giao; response/log không lộ credential lâu dài. |
| [BL-012](BUSINESS_LOGIC_AUDIT.md#bl-012) | Contract/form + browser cách ly | User có class.id nhưng không có scalar, lọc theo lớp phải vẫn đúng hoặc API bổ sung scalar theo hợp đồng. |
| [BL-013](BUSINESS_LOGIC_AUDIT.md#bl-013) | Contract/form + browser cách ly | Tạo nháp chưa review, reload; hiển thị đúng một lần tại tiêu chí, sửa/xóa được trong quyền. |
| [BL-014](BUSINESS_LOGIC_AUDIT.md#bl-014) | Service/API + DB cách ly | Tạo→lưu→ban hành rubric có role rates, đọc lại giữ nguyên và điểm danh tính đúng; thiếu rates hiển thị blocker trước sử dụng. |
| [BL-015](BUSINESS_LOGIC_AUDIT.md#bl-015) | Service doubles rồi DB/Storage cách ly | RETURNED tổng nhưng Evidence APPROVED: thêm file bị chặn hoặc chuyển trạng thái đúng cùng audit/version. |
| [BL-016](BUSINESS_LOGIC_AUDIT.md#bl-016) | Service/API + DB cách ly | Token firstLogin gọi API ghi bị chặn, đổi mật khẩu xong gọi được; không chặn endpoint cần cho bước đổi. |
| [BL-017](BUSINESS_LOGIC_AUDIT.md#bl-017) | Pure/service doubles | **Passed (unit/DB doubles):** Đạt 16/16 ca trong scoring-and-validation.test.cjs; validateVerifiedData từ chối counter âm (-2), số thập phân (1.5), chuỗi rác ("abc"), boolean (true) với HTTP 400 INVALID_VERIFICATION_DATA; validation enum từ chối mảng/object cho awardTier và academicTier; evaluator từ chối tính điểm mảng/object; mã lỗi qua HttpExceptionFilter thật trả đúng contract { error: { code: "INVALID_VERIFICATION_DATA" } }; gọi verifyCriterion thật với DB doubles chứng minh request invalid KHÔNG ghi DB/audit, request valid ghi đúng; tỷ lệ >100 hoặc âm bị chặn; chấp nhận tỷ lệ thập phân 95.5% và điểm quy đổi thập phân 7.5; từ chối officialScore > maxScore; 0 hợp lệ tính đúng điểm tối đa; evaluator từ chối ép 0 khi gặp dữ liệu vi phạm sai kiểu; đối chứng đỏ chứng minh hàm count cũ ép chuỗi rác/số âm thành 0 và cho điểm tối đa. |
| [BL-018](BUSINESS_LOGIC_AUDIT.md#bl-018) | Contract/form + browser cách ly | Fixture26 hoặc 51 issues qua double HTTP, kiểm total/pageSize, chuyển trang và xử lý item cuối. |
| [BL-019](BUSINESS_LOGIC_AUDIT.md#bl-019) | Contract/form + browser cách ly | 21+ minh chứng, hồ sơ mục tiêu ở trang 2; tìm/đổi trạng thái và mở chi tiết vẫn truy cập được. |
| [BL-020](BUSINESS_LOGIC_AUDIT.md#bl-020) | Contract/form + browser cách ly | **Passed (unit/component thật):** Đạt 4/4 ca trong deadline-and-closure.test.cjs (targets DTO validation, 105 sinh viên phân trang trang 5/6, loại trùng lớp, từ chối ngoài roster) và 2/2 ca trong deadline-dialog-and-access.test.cjs (component thật DeadlineExtensionsDialog render đúng MSSV, họ tên, lớp snapshot không bị undefined · undefined; bấm chuyển trang thực tế qua 6 trang, kiểm tra tham số request gửi API, hiển thị và chọn thành công sinh viên 105). |
| [BL-021](BUSINESS_LOGIC_AUDIT.md#bl-021) | Service doubles rồi DB/Storage cách ly | Chạy chuỗi exclude/restore/exclude trong DB test cách ly; hai sự kiện tồn tại, trạng thái cuối EXCLUDED. |
| [BL-022](BUSINESS_LOGIC_AUDIT.md#bl-022) | Pure/service doubles | PROCESSING + job active, addSource→job CANCELLED và trạng thái xét thủ công; response cũ không đổi lại. |
| [BL-023](BUSINESS_LOGIC_AUDIT.md#bl-023) | Contract/form + browser cách ly | Yêu cầu có comment khác missingItem, deadline khác mẫu và deadline=null; UI phản ánh đúng cả3. |
| [BL-024](BUSINESS_LOGIC_AUDIT.md#bl-024) | Contract/form + browser cách ly | Deep link kỳ cũ, Back/Forward, reload, selector mobile390px; title/API/payload đều cùng kỳ. |
| [BL-025](BUSINESS_LOGIC_AUDIT.md#bl-025) | Service/API + DB cách ly | Create STUDENT thiếu mã/lớp, STAFF thiếu Khoa bị từ chối; bản hợp lệ được nhận. |
| [BL-026](BUSINESS_LOGIC_AUDIT.md#bl-026) | DB concurrency cách ly + barrier | **In Progress / Potential (unit đối chứng đạt 5/5 ca):** Đạt 5/5 ca trong data-protection.test.cjs (nộp trước chặn xóa và không gọi DELETE Storage; xóa tệp trước khiến nộp bị chặn; rollback giữ nguyên Storage; đọc file trong lock; cleanup lỗi không phá hỏng DB). Chờ môi trường PostgreSQL đa kết nối thật để kiểm chứng concurrency DB vật lý. |
| [BL-027](BUSINESS_LOGIC_AUDIT.md#bl-027) | DB concurrency cách ly + barrier | Đạt ở [PostgreSQL 17](#p1-suite-results) với barrier cho lưu null, vượt trần và đổi cờ F15 trước submit. |

## Feature acceptance

14 spec trong [features](README.md) có Fxx-AC-yy và Fxx-TC-yy. Với task cụ thể, chuyển mô tả test thành Given/When/Then, chỉ rõ role/kỳ/roster/rubric/state/deadline/dữ liệu vào/ra; liên kết thêm BL/Q nếu có.

Bắt buộc kiểm tra các chiều liên quan đến thay đổi: happy path; sai chủ/Khoa/role; inactive/token cũ; deadline gốc/gia hạn/đúng biên; dữ liệu lịch sử; yêu cầu lặp; xung đột version; rollback/partial failure; stale response khi đổi kỳ; phân trang/aggregate/export. Không mở rộng suite chỉ để chạy thêm nếu kiểm tra liên quan đã đủ và không có lo ngại mới.

Không đánh dấu toàn feature Verified chỉ vì một test thuần hoặc build thành công. Khi không kiểm được, ghi “Not run” và lý do/môi trường còn thiếu.

DEC-006 đã được người dùng xác nhận: rubric không thay đổi thì tiếp tục dùng nguyên nội dung qua kỳ mới. Bổ sung F03-TC-06 và F04-TC-06/07: mở hai kỳ dùng cùng nội dung; chỉ thay khi có thay đổi được xác nhận; thay đổi kỳ sau không làm đổi rubric/kết quả lịch sử. Các ca này đã đạt trên [PostgreSQL 17](#p1-suite-results) với bản sao PUBLISHED riêng của kỳ và phiên bản mới khi chỉnh sửa.

## Browser scenarios được giữ từ tài liệu cũ

- Ba role; menu STAFF5/ADMIN5, tab con, active chi tiết, redirect; refresh/Back/Forward, termId/returnTo và deep link.
- Khoa dashboard đủ 108 sinhviên/9 lớp nếu fixture được tái tạo đúng;8 state không đếm trùng; tải 2 trang với pageSize=100; lỗi trang 2 có retry, response kỳ cũ không ghi đè.
- Biểu đồ lớp 8 dòng ban đầu/mở rộng/bảng/bàn phím; donut 3 approved/1 rejected/2 remaining theo fixture 6; tổng0 hiển thị empty.
- Theo lớp 4 KPI hành động, KPI không thay theo lớp đang chọn; badge approved+rejected nhưng list riêng.
- Mobile390px, kỳ rỗng/historical/CLOSED; ba deadline đúng nghĩa và chỉ xem khi khóa.
- Excel toàn tập lọc, điểm publication mới nhất, danh sách dài hơn trang; appeals liên quan lazy-load đủ trang và mở đúng đơn.
- Upload/signing/cleanup, supplement missingItem/deadline thật, form boolean leadershipRole và gia hạn được phản ánh đúng.

Harness browser có điều kiện localhost và tên DB chứa `_test`, không dùng Supabase. Chỉ chuẩn bị/chạy khi một task cho phép fixture DB và đã đọc cleanup/setup; biến TEST_DATABASE_URL phải do môi trường test cấp, không ghi secret vào tài liệu.

Lệnh tham khảo để chạy sau khi có fixture cách ly hợp lệ (chưa chạy ở đợt tài liệu):

```sh
# cwd: apps/web; TEST_DATABASE_URL đã được cấu hình an toàn
node scripts/navigation-smoke.cjs
# chỉ kiểm biểu đồ trong harness
FACULTY_CHARTS_ONLY=1 node scripts/navigation-smoke.cjs
```

## Test Suite F15 — Căn cứ chấm điểm, Import Excel và Chốt phiếu hàng loạt

File thực thi: `apps/backend/test/grounding-import-and-batch-finalize.test.cjs`
Lệnh chạy: `node --test test/grounding-import-and-batch-finalize.test.cjs` từ `apps/backend`.
Kết quả: **25/25 passed** (100%), bao gồm:
- Ca 1–5: MSSV text giữ số 0 ở đầu, validator phát hiện trường thiếu/sai kiểu, kiểm tra phạm vi Khoa, trùng lặp MSSV, Preview chỉ đọc tuyệt đối in-memory.
- Ca 6–10: Confirm import hỗ trợ idempotency key, tái sử dụng `batchAddParticipants`, tự động đồng bộ căn cứ vào phiếu, bảo toàn tiêu chí đã `FINALIZED`, `getMine` chỉ đọc (đồng bộ diễn ra khi nộp phiếu).
- Ca 11–13: Minh chứng 0 file ở kỳ mới (`evidenceBasisWorkflowEnabled = true`) chuyển `NEEDS_HUMAN_REVIEW` không tạo AI job; kỳ cũ bị chặn; preflight bỏ qua khi đã có căn cứ/điểm danh.
- Ca 14–16: Thu hồi lô an toàn; chặn thu hồi nếu có sinh viên đã `FINALIZED` hoặc `SENT`.
- Ca 17–20: Chốt phiếu chuyển `READY_FOR_REVIEW` sang `FINALIZED`, chặn khi còn minh chứng chờ xử lý (`NEEDS_HUMAN_REVIEW` hoặc `NEEDS_SUPPLEMENT`), chốt hàng loạt độc lập tối đa 100 phiếu, từ chối khi vượt quá 100 phiếu.
- Ca 21–25 (Khắc phục 9 điểm review): Re-validation độc lập trong confirm transaction (chặn sinh viên sai Khoa, dữ liệu vi phạm schema); `batchAddParticipants` nhận `externalTx` không lồng transaction; thu hồi lô hoạt động xóa sạch bản ghi `CONFIRMED` và tính lại điểm gợi ý; bảo vệ căn cứ cán bộ sửa tay; `CriteriaService.updateTerm` chặn đổi `evidenceBasisWorkflowEnabled` khi kỳ đã có publication hoặc handoff `SENT`.

## Kiểm chứng tài liệu

Kiểm link tương đối/anchor/source line; đủ 14 feature+template; đủ 11 mục/spec; R IDs/BL IDs/AC/TC không trùng; route inventory khớp controller; DTO kế thừa ghi đúng; không link tới file đã xóa; diff chỉ Markdown đúng phạm vi. Kết quả thực chạy ghi ở [CHANGELOG](CHANGELOG.md).

Không cần build hay viết test ứng dụng cho thay đổi thuần tài liệu. Kiểm tra diff và tài liệu là validation phù hợp cho công việc này.

