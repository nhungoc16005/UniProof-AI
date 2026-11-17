# Vietnamese OCR Improvement Implementation Plan

> **For agentic workers:** Execute inline task-by-task. Preserve existing workspace changes and do not modify source annotations.

**Goal:** Improve Vietnamese-with-diacritics OCR for certificate images and expose uncertainty without guessing identity fields.

**Architecture:** Keep Tesseract and the existing PDF text-layer path. Add bounded image-preprocessing candidates and page-segmentation configurations, select OCR candidates using measured text confidence, and keep parsing separate from recognition. Do not fine-tune until human-reviewed line-image/transcription data is available.

**Tech Stack:** Python 3.11, Tesseract 5, pytesseract, Pillow, OpenCV, FastAPI, unittest/pytest.

---

## Files

- Modify `apps/ai-service/src/ocr_extractor.py`: preprocessing orchestration, Tesseract candidate execution, confidence extraction, and Vietnamese field parsing.
- Modify `apps/ai-service/src/schemas.py`: optional diagnostic OCR confidence/method fields, without changing score semantics.
- Create `apps/ai-service/test_ocr_extractor.py`: parser, preprocessing, selection, fallback, and real-engine checks.
- Modify `apps/ai-service/README.md`: describe OCR modes, language data, limitations, and verification command.
- Do not modify `docs/Minh chứng Lọc/dataset-local/annotations.csv`, `pilot_annotations.csv`, `pilot_visual_review.csv`, or any source image.
- Keep the OCR fine-tuning task deferred until approved line transcriptions and a document-level split exist.

## Task 1: Reproduce the Vietnamese field-parser gaps

**Files:**
- Create: `apps/ai-service/test_ocr_extractor.py`
- Modify: `apps/ai-service/src/ocr_extractor.py`

- [ ] Write the failing parser tests:

```python
import unittest

from src.ocr_extractor import OcrExtractorService


class VietnameseFieldParserTests(unittest.TestCase):
    def test_extracts_name_after_standalone_vietnamese_label(self):
        text = "SINH VIÊN:\nLê Thị Minh Châu\nCHI ĐOÀN: 49K30.02"
        self.assertEqual(
            OcrExtractorService._extract_name(text),
            "Lê Thị Minh Châu",
        )

    def test_extracts_student_code_after_ma_so_sinh_vien_label(self):
        text = "Mã số sinh viên: 102210001"
        self.assertEqual(
            OcrExtractorService._extract_student_code(text),
            "102210001",
        )
```

- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q` and verify both assertions fail against the current parser.
- [ ] Extend the name-label expression to accept a label whose value is on the following line; extend the student-code expression to accept `Mã số sinh viên`.
- [ ] From `apps/ai-service`, re-run `python -m pytest test_ocr_extractor.py -q` and then `python -m pytest test_unified.py test_flow1_flow2.py -q`.

## Task 2: Add deterministic preprocessing candidates

**Files:**
- Modify: `apps/ai-service/test_ocr_extractor.py`
- Modify: `apps/ai-service/src/ocr_extractor.py`

- [ ] Add a failing test using a small Pillow image that asserts preprocessing returns named candidates `original_gray`, `contrast_upscaled`, and `adaptive_threshold`, all in grayscale and with non-zero dimensions. Also assert EXIF orientation is normalized before candidate creation.
- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q` and verify it fails because candidate generation is not implemented.
- [ ] Implement a private helper that applies `ImageOps.exif_transpose`, makes a grayscale original, creates a contrast-enhanced upscale with a bounded scale factor, and creates an OpenCV adaptive-threshold candidate. Skip only the threshold candidate if OpenCV is unavailable; do not mutate the input image.
- [ ] Run the focused test and verify all available candidates are returned in stable order.

## Task 3: Run bounded Tesseract recognition candidates

**Files:**
- Modify: `apps/ai-service/test_ocr_extractor.py`
- Modify: `apps/ai-service/src/ocr_extractor.py`
- Modify: `apps/ai-service/src/schemas.py`

- [ ] Add failing tests with a patched pytesseract boundary to verify each prepared candidate uses `lang="vie+eng"` and its explicit page segmentation mode, reconstructs text by OCR line, and returns a non-negative-word mean confidence.
- [ ] Add a fallback test where the adaptive-threshold invocation raises `TesseractError` but the original candidate succeeds; assert the successful text is retained.
- [ ] Add tests where two successful OCR candidates extract different non-empty names or different non-empty student codes; assert `recognitionAmbiguous` is true. Missing fields in one candidate alone must not count as disagreement.
- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q` and confirm failures are caused by the missing candidate runner.
- [ ] Add a bounded runner with exactly three attempts: original grayscale + PSM 3, contrast-upscaled + PSM 6, adaptive threshold + PSM 11. Convert Tesseract word boxes into newline-separated lines and compute mean confidence from non-negative word confidences.
- [ ] Select the candidate with the highest mean word confidence; ties retain the earlier candidate in stable order. If every Tesseract invocation errors, return `available=False` with the existing engine error. If Tesseract succeeds but returns no words, return `available=True`, empty text, and the existing "OCR ran but found no readable text" message.
- [ ] Compare non-empty extracted names and student codes across successful candidates. Set `recognitionAmbiguous` only when candidates disagree on a non-empty value; absence from one candidate is not a disagreement.
- [ ] Add optional `recognitionConfidence`, `recognitionMethod`, and `recognitionAmbiguous` diagnostics to `OcrExtractionResult`. They must not be interpreted as probability or add score.
- [ ] From `apps/ai-service`, re-run `python -m pytest test_ocr_extractor.py -q` and verify individual candidate failures do not prevent remaining candidates from running.

## Task 4: Verify Vietnamese recognition and document integration

**Files:**
- Modify: `apps/ai-service/test_ocr_extractor.py`
- Modify: `apps/ai-service/src/ocr_extractor.py`
- Modify: `apps/ai-service/src/pipeline_orchestrator.py`
- Modify: `apps/ai-service/README.md`

- [ ] Add an integration test that creates a high-resolution Vietnamese text image with a system font, runs the configured local Tesseract when available, and asserts output contains the expected accented phrase. Skip with a clear reason when Tesseract or `vie`/`eng` is unavailable.
- [ ] Add failing orchestrator tests: when `recognitionAmbiguous` is true, identity checklist is `REVIEW`, candidate-derived name/MSSV mismatch cannot force tier RED, and no identity match boost is added.
- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q` before implementation and verify the ambiguity test fails on the intended missing behavior.
- [ ] Preserve only the `rawText` and parsed fields from the selected candidate; retain ambiguity from all successful candidates for human review.
- [ ] In the document pipeline, bypass mismatch-driven RED and name/code score boosts when `recognitionAmbiguous` is true. Add the identity check to unresolved authenticity checks only for this ambiguous case, so the result cannot be GREEN and is referred for review.
- [ ] Keep PDF text-layer extraction untouched; for scanned PDF pages pass each rendered page through the same preprocessing and recognition flow.
- [ ] Document `TESSERACT_LANGUAGES=vie+eng`, supported diagnostics, expected cost of multiple OCR passes, and why text may remain unreadable for low-resolution/cropped input.
- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q` and confirm the exact accented phrase is retained by at least one candidate.

## Task 5: Regression and API verification

**Files:**
- Test: `apps/ai-service/test_ocr_extractor.py`
- Test: `apps/ai-service/test_unified.py`
- Test: `apps/ai-service/test_flow1_flow2.py`
- Test: `apps/ai-service/test_pipeline.py`

- [ ] From `apps/ai-service`, run `python -m pytest test_ocr_extractor.py -q`.
- [ ] From `apps/ai-service`, run `python -m pytest test_unified.py test_flow1_flow2.py test_pipeline.py -q`.
- [ ] From the repository root, run `python -m compileall -q apps/ai-service/src`.
- [ ] Call `/health` and confirm OCR reports `vie+eng` available; submit one scan and one scanned PDF to `/api/v1/evidence/inspect`, confirming HTTP 200 and OCR diagnostics in the response.
- [ ] Do not report CER/WER improvement until a human-reviewed held-out set is available. Do not train or replace `traineddata` based on `needs_review` samples.

## Deferred: Fine-tuning

Fine-tuning is not part of this implementation pass because all 117 corpus annotations are incomplete and all 20 pilot samples remain `needs_review`. Reopen this task only after a reviewer approves transcriptions against the originals and line-image/transcription pairs can be split by source document into train, validation, and held-out test partitions.
