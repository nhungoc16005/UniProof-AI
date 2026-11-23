import base64
import io
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from PIL import Image, ImageFilter

from src.config import settings
from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.ocr_extractor import OcrExtractorService
from src.quality_forensics import QualityAndForensicsService
from src.schemas import (
    DeclaredStudent,
    DocumentCheckItem,
    DocumentMarkCheckResult,
    ForensicCheckResult,
    OcrExtractionResult,
    QualityCheckResult,
    TemplateMatchResult,
    UnifiedInspectionRequest,
    WebVerificationResult,
)


def image_payload(blurred=False):
    image = Image.new("RGB", (640, 480), (130, 130, 130))
    if blurred:
        image = image.filter(ImageFilter.GaussianBlur(radius=12))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class M2ContractQualityTests(unittest.IsolatedAsyncioTestCase):
    def test_checker_contract_has_status_delta_evidence_and_vietnamese_message(self):
        check = DocumentCheckItem(key="ocr", label="OCR", status="REVIEW", details="Cần xem lại")
        dumped = check.model_dump()
        self.assertEqual(dumped["status"], "REVIEW")
        self.assertEqual(dumped["score_delta"], 0)
        self.assertIsInstance(dumped["evidence"], dict)
        self.assertEqual(dumped["message_vi"], "Cần xem lại")
        self.assertEqual(dumped["evidence"]["source"], "ocr")
        with self.assertRaises(ValueError):
            DocumentCheckItem(key="x", label="x", status="UNKNOWN", details="x")

    def test_score_remains_90_only_when_every_checker_passes(self):
        passed = [DocumentCheckItem(key=key, label=key, status="PASS", details="Đạt") for key in ("quality", "ocr", "identity", "term")]
        self.assertEqual(UnifiedPipelineOrchestrator._cap_unresolved_score(90, passed), (90, False))
        with_unchecked = [*passed, DocumentCheckItem(key="optional", label="Optional", status="NOT_CHECKED", details="Chưa kiểm tra")]
        self.assertEqual(UnifiedPipelineOrchestrator._cap_unresolved_score(90, with_unchecked), (89, True))

    def test_synthetic_blurred_image_fails_quality_gate_below_70(self):
        result = QualityAndForensicsService.inspect_quality(image_payload(blurred=True))
        self.assertFalse(result.passed)
        self.assertLess(result.qualityScore, 70)
        self.assertTrue(result.errorDetails)

    def test_synthetic_skewed_image_uses_quality_weight_of_10_percent(self):
        from PIL import ImageDraw
        image = Image.new("RGB", (640, 480), (240, 240, 240))
        draw = ImageDraw.Draw(image)
        draw.rectangle((70, 60, 570, 420), outline=(0, 0, 0), width=8)
        draw.line((90, 130, 540, 130), fill=(10, 10, 10), width=5)
        image = image.rotate(12, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(240, 240, 240))
        output = io.BytesIO()
        image.save(output, format="PNG")
        quality = QualityAndForensicsService.inspect_quality(output.getvalue())
        self.assertGreaterEqual(abs(quality.skewAngle), 10)
        expected = round(
            min(100, quality.blurScore / max(settings.BLUR_LAPLACIAN_THRESHOLD * 2, 1) * 100) * 0.7
            + max(0, 100 - abs(quality.brightness - 140) / 140 * 100) * 0.2
            + max(0, 100 - min(abs(quality.skewAngle), 45) / 45 * 100) * 0.1,
            1,
        )
        self.assertEqual(quality.qualityScore, expected)

    def test_corrupt_and_unsupported_payloads_return_vietnamese_quality_reason(self):
        corrupt = QualityAndForensicsService.inspect_quality(b"not-an-image")
        self.assertFalse(corrupt.passed)
        self.assertRegex(corrupt.errorDetails or "", "[Đđ]|không|hợp lệ")
        with self.assertRaisesRegex(ValueError, "không phải ảnh/PDF hợp lệ"):
            UnifiedPipelineOrchestrator._image_for_inspection(b"unsupported-format")

    def test_missing_student_code_is_review_not_mismatch(self):
        req = UnifiedInspectionRequest(
            evidenceId="missing-code", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        ocr = OcrExtractionResult(rawText="Tên Synthetic Student", available=True, studentNameExtracted="Synthetic Student", nameMatchRatio=100)
        checks = UnifiedPipelineOrchestrator._document_checks(req, QualityCheckResult(passed=True, blurScore=180, brightness=130, qualityScore=90), ocr=ocr)
        identity = next(item for item in checks if item.key == "identity")
        self.assertEqual(identity.status, "REVIEW")
        self.assertFalse(ocr.codeMismatch)

    def test_ocr_unavailable_is_review_not_failure(self):
        req = UnifiedInspectionRequest(
            evidenceId="ocr-unavailable", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        ocr = OcrExtractionResult(rawText="", available=False, errorDetails="OCR chưa khả dụng")
        checks = UnifiedPipelineOrchestrator._document_checks(req, QualityCheckResult(passed=True, blurScore=180, brightness=130, qualityScore=90), ocr=ocr)
        self.assertEqual(next(item for item in checks if item.key == "ocr").status, "REVIEW")

    def test_tesseract_timeout_is_bounded_and_returns_review_reason(self):
        import pytesseract
        request = UnifiedInspectionRequest(
            evidenceId="ocr-timeout", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        with patch.object(pytesseract, "image_to_data", side_effect=RuntimeError("Tesseract process timeout")) as recognize:
            extraction = OcrExtractorService._recognize_image(Image.new("RGB", (320, 240), "white"), "vie+eng")
        self.assertFalse(extraction.available)
        self.assertIn("quá thời gian", extraction.error or "")
        self.assertTrue(all("timeout" in str(call.kwargs.get("timeout")) or call.kwargs.get("timeout") == settings.TESSERACT_TIMEOUT_SECONDS for call in recognize.call_args_list))
        ocr = OcrExtractionResult(rawText="", available=False, errorDetails=extraction.error)
        checks = UnifiedPipelineOrchestrator._document_checks(request, QualityCheckResult(passed=True, blurScore=180, brightness=130, qualityScore=90), ocr=ocr)
        self.assertEqual(next(item for item in checks if item.key == "ocr").status, "REVIEW")

    async def test_quality_gate_does_not_invoke_ocr_when_quality_below_70(self):
        request = UnifiedInspectionRequest(
            evidenceId="quality-gate", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        with (
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=QualityCheckResult(passed=False, blurScore=1, brightness=120, qualityScore=35, errorDetails="Ảnh mờ")),
            patch("src.pipeline_orchestrator.OcrExtractorService.extract_and_parse", side_effect=AssertionError("OCR gate should stop")),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)
        self.assertFalse(result.qualityCheck.passed)
        self.assertEqual(next(item for item in result.documentChecks if item.key == "quality").status, "FAIL")
        self.assertTrue(all(item.source and item.status for item in result.scoreBreakdown))

    def test_name_similarity_70_to_84_is_review_and_85_is_pass(self):
        req = UnifiedInspectionRequest(
            evidenceId="name-threshold", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        quality = QualityCheckResult(passed=True, blurScore=180, brightness=130, qualityScore=90)
        for ratio, expected in ((70, "REVIEW"), (84.9, "REVIEW"), (85, "PASS")):
            ocr = OcrExtractionResult(rawText="synthetic OCR", available=True, studentNameExtracted="Synthetic", studentCodeExtracted="TEST-001", nameMatchRatio=ratio, codeMatched=True)
            checks = UnifiedPipelineOrchestrator._document_checks(req, quality, ocr=ocr)
            self.assertEqual(next(item for item in checks if item.key == "identity").status, expected)

    async def test_external_llm_extraction_is_off_and_pipeline_makes_no_http_request(self):
        self.assertFalse(settings.EXTERNAL_LLM_EXTRACTION_ENABLED)
        request = UnifiedInspectionRequest(
            evidenceId="no-external-llm", evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Synthetic Student", studentCode="TEST-001"),
            fileBytesBase64=base64.b64encode(image_payload()).decode(), enableWebSearch=False,
        )
        ocr = OcrExtractionResult(rawText="Synthetic OCR", available=True, studentNameExtracted="Synthetic Student", studentCodeExtracted="TEST-001", nameMatchRatio=100, codeMatched=True)
        with (
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=QualityCheckResult(passed=True, blurScore=180, brightness=130, qualityScore=90)),
            patch.object(QualityAndForensicsService, "inspect_forensics", return_value=ForensicCheckResult(sha256="synthetic", pHash="1111111111111111")),
            patch.object(QualityAndForensicsService, "inspect_document_marks", return_value=DocumentMarkCheckResult(signatureStatus="NOT_DETECTED", sealStatus="NOT_DETECTED", signatureEvidence="Synthetic", sealEvidence="Synthetic")),
            patch("src.pipeline_orchestrator.OcrExtractorService.extract_and_parse", return_value=ocr),
            patch("src.pipeline_orchestrator.QrVerifierService.decode", return_value=None),
            patch("src.pipeline_orchestrator.QrVerifierService.verify", new=AsyncMock(return_value=None)),
            patch("src.pipeline_orchestrator.WebSearchVerifierService.verify_event", new=AsyncMock(return_value=WebVerificationResult(searched=False))),
            patch("src.pipeline_orchestrator.TemplateMatcher.match", return_value=TemplateMatchResult(status="UNKNOWN", evidence="Synthetic no registry")),
            patch.object(httpx, "AsyncClient", side_effect=AssertionError("external request must remain disabled")) as client,
        ):
            result = await UnifiedPipelineOrchestrator.process(request)
        self.assertEqual(result.schemaVersion, "1.0")
        self.assertEqual(client.call_count, 0)
        self.assertTrue(result.scoreBreakdown)
        self.assertAlmostEqual(sum(item.score for item in result.scoreBreakdown), result.aiConfidenceScore)
        self.assertTrue(all(item.source and item.status for item in result.scoreBreakdown))


if __name__ == "__main__":
    unittest.main()
