import base64
import io
import unittest
from unittest.mock import AsyncMock, patch

import fitz
from PIL import Image, ImageDraw

from src.config import settings
from src.face_verifier import FaceAndVisionService
from src.criterion_evaluator import evaluate_criterion
from src.ocr_extractor import OcrExtractorService
from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.quality_forensics import QualityAndForensicsService
from src.schemas import (
    DeclaredStudent,
    DocumentMarkCheckResult,
    ForensicCheckResult,
    OcrExtractionResult,
    QualityCheckResult,
    TemplateMatchResult,
    UnifiedInspectionRequest,
    WebVerificationResult,
)
from src.template_matcher import TemplateMatcher, TemplateRegistry
from src.web_search_verifier import WebSearchVerifierService


def image_bytes(with_text: bool = True) -> bytes:
    image = Image.new("RGB", (800, 600), (235, 235, 235))
    draw = ImageDraw.Draw(image)
    if with_text:
        draw.rectangle((20, 20, 780, 580), outline=(0, 0, 0), width=5)
        draw.text((60, 100), "EVIDENCE CERTIFICATE STUDENT ACTIVITY", fill=(0, 0, 0))
        draw.text((60, 180), "DUT TEST DOCUMENT 2026", fill=(0, 0, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def searchable_pdf() -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "Ho va ten: Nguyen Van A MSSV: 102210001\n"
        "Tham gia: Ngay hoi tinh nguyen DUT 2026\n"
        "Ngay 20 thang 7 nam 2026",
    )
    return document.tobytes()


def image_with_document_marks() -> bytes:
    image = Image.new("RGB", (800, 600), (245, 245, 245))
    draw = ImageDraw.Draw(image)
    draw.ellipse((570, 430, 690, 530), outline=(190, 20, 30), width=8)
    draw.line((120, 470, 240, 450), fill=(20, 20, 20), width=4)
    draw.line((140, 500, 260, 475), fill=(20, 20, 20), width=4)
    draw.line((180, 525, 285, 495), fill=(20, 20, 20), width=4)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class UnifiedPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_file_is_rejected_instead_of_using_sample_image(self):
        with self.assertRaisesRegex(ValueError, "phải có"):
            await UnifiedPipelineOrchestrator._extract_bytes(None, None)

    async def test_document_pipeline_does_not_invent_ocr_or_web_results(self):
        request = UnifiedInspectionRequest(
            evidenceId="doc-test",
            activityName="Unlisted student activity",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        no_ocr = OcrExtractionResult(
            rawText="",
            available=False,
            errorDetails="Tesseract is unavailable",
        )
        with (
            patch.object(OcrExtractorService, "extract_and_parse", return_value=no_ocr),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(return_value=WebVerificationResult(searched=False)),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        if result.ocrExtraction is None or result.webVerification is None:
            self.fail("Document pipeline response omitted expected analysis results")
        self.assertEqual(result.ocrExtraction.rawText, "")
        self.assertIsNone(result.ocrExtraction.studentNameExtracted)
        self.assertIsNone(result.webVerification.articleTitle)
        self.assertEqual(result.webVerification.confidenceBoost, 0)
        self.assertFalse(result.breakdown["ocrAvailable"])
        self.assertLess(result.aiConfidenceScore, 90)

    async def test_ocr_check_requires_review_when_student_name_was_not_extracted(self):
        request = UnifiedInspectionRequest(
            evidenceId="ocr-missing-name",
            declaredStudent=DeclaredStudent(fullName="Lê Thu Thu Trang"),
        )
        quality = QualityCheckResult(
            passed=True,
            blurScore=200,
            brightness=120,
            qualityScore=85,
        )
        ocr = OcrExtractionResult(
            rawText="GIẤY CHỨNG NHẬN\nĐã tham gia hoạt động tình nguyện",
            available=True,
            studentNameExtracted=None,
        )

        checks = UnifiedPipelineOrchestrator._document_checks(request, quality, ocr=ocr)

        ocr_check = next(check for check in checks if check.key == "ocr")
        self.assertEqual(ocr_check.status, "REVIEW")
        self.assertIn("tên sinh viên", ocr_check.details.lower())

    async def test_quality_gate_stops_ocr_forensics_and_web_search(self):
        request = UnifiedInspectionRequest(
            evidenceId="quality-gate-test",
            activityName="Pilot activity",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="PILOT TEST"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=True,
        )
        failed_quality = QualityCheckResult(
            passed=False,
            blurScore=12.0,
            brightness=120.0,
            skewAngle=0.0,
            errorDetails="Ảnh quá mờ.",
        )
        with (
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=failed_quality),
            patch.object(QualityAndForensicsService, "inspect_forensics", side_effect=AssertionError("forensics must stop")),
            patch.object(OcrExtractorService, "extract_and_parse", side_effect=AssertionError("OCR must stop")),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(side_effect=AssertionError("web search must stop")),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertFalse(result.qualityCheck.passed)
        self.assertIsNone(result.forensicCheck)
        self.assertFalse(result.ocrExtraction.available)
        self.assertFalse(result.webVerification.searched)
        self.assertEqual(result.breakdown["stoppedAt"], "QUALITY_GATE")
        self.assertEqual(result.aiConfidenceScore, 0)

    async def test_event_photo_detection_never_claims_identity_match_without_model(self):
        result = FaceAndVisionService.verify_face_in_event(image_bytes(with_text=False))
        self.assertFalse(result.matched)
        self.assertFalse(result.identityComparisonAvailable)
        self.assertEqual(result.confidenceBoost, 0)

    async def test_quality_score_below_seventy_stops_the_document_pipeline(self):
        quality = QualityAndForensicsService.inspect_quality(image_bytes(with_text=False))

        self.assertFalse(quality.passed)
        self.assertLess(quality.qualityScore, 70)
        self.assertEqual(quality.qualityThreshold, 70)

    async def test_document_mark_detector_reports_visible_red_seal_and_signature_like_strokes(self):
        marks = QualityAndForensicsService.inspect_document_marks(image_with_document_marks())

        self.assertEqual(marks.sealStatus, "PRESENT")
        self.assertEqual(marks.signatureStatus, "PRESENT")
        self.assertIn("không xác thực", marks.sealEvidence)
        self.assertIn("không xác thực", marks.signatureEvidence)

    async def test_searchable_pdf_extracts_real_text_and_student_code(self):
        result = OcrExtractorService.extract_and_parse(
            searchable_pdf(),
            evidence_type="GIAY_KHEN",
            declared_name="Nguyen Van A",
            declared_student_code="102210001",
        )
        self.assertIn("102210001", result.rawText)
        self.assertEqual(result.studentCodeExtracted, "102210001")
        self.assertEqual(result.studentNameExtracted, "Nguyen Van A")
        self.assertTrue(result.codeMatched)
        self.assertFalse(result.codeMismatch)

    async def test_date_extraction_accepts_accents_and_ocr_without_accents(self):
        self.assertEqual(
            OcrExtractorService._extract_date("Ngày 20 tháng 7 năm 2026"),
            "2026-07-20",
        )
        self.assertEqual(
            OcrExtractorService._extract_date("Ngay 20 thang 7 nam 2026"),
            "2026-07-20",
        )

    async def test_readable_but_mismatched_student_code_is_explicit(self):
        result = OcrExtractorService.extract_and_parse(
            searchable_pdf(),
            evidence_type="GIAY_KHEN",
            declared_name="Nguyen Van A",
            declared_student_code="102210002",
        )

        self.assertEqual(result.studentCodeExtracted, "102210001")
        self.assertFalse(result.codeMatched)
        self.assertTrue(result.codeMismatch)

    async def test_unreadable_student_code_is_not_classified_as_mismatch(self):
        result = OcrExtractorService.extract_and_parse(
            searchable_pdf(),
            evidence_type="GIAY_KHEN",
            declared_name="Nguyen Van A",
        )

        self.assertEqual(result.studentCodeExtracted, "102210001")
        self.assertFalse(result.codeMatched)
        self.assertFalse(result.codeMismatch)

    async def test_mismatched_student_code_forces_red_and_skips_web_search(self):
        request = UnifiedInspectionRequest(
            evidenceId="student-code-mismatch",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210002"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=True,
        )
        mismatched_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=False,
            codeMismatch=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=mismatched_ocr),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(side_effect=AssertionError("web search must stop on mismatch")),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.tier.value, "RED")
        self.assertEqual(result.aiConfidenceScore, 0)
        self.assertTrue(result.breakdown["studentCodeMismatch"])
        self.assertEqual(result.breakdown["stoppedAt"], "IDENTITY_CHECK")
        self.assertFalse(result.webVerification.searched)
        self.assertIn("MSSV", result.recommendation)

    async def test_clear_name_mismatch_forces_red_and_is_reported_in_checklist(self):
        request = UnifiedInspectionRequest(
            evidenceId="student-name-mismatch",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=True,
        )
        mismatched_ocr = OcrExtractionResult(
            rawText="Ho va ten: Le Van B\nMSSV: 102210001",
            studentNameExtracted="Le Van B",
            studentCodeExtracted="102210001",
            nameMatchRatio=35,
            codeMatched=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=80),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=mismatched_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="NOT_DETECTED",
                    sealStatus="NOT_DETECTED",
                    signatureEvidence="No signature signal",
                    sealEvidence="No seal signal",
                ),
            ),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(side_effect=AssertionError("web search must stop on identity mismatch")),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.tier.value, "RED")
        self.assertTrue(result.breakdown["studentNameMismatch"])
        self.assertFalse(result.webVerification.searched)
        identity_check = next(check for check in result.documentChecks if check.key == "identity")
        self.assertEqual(identity_check.status, "FAIL")

    async def test_ambiguous_ocr_identity_is_reviewed_without_red_or_identity_boost(self):
        request = UnifiedInspectionRequest(
            evidenceId="ambiguous-ocr-identity",
            activityName=None,
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Lê Thị Minh Châu", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        ambiguous_ocr = OcrExtractionResult(
            rawText="SINH VIÊN: Lê Thị Minh Châu\nMSSV: 102210001",
            studentNameExtracted="Lê Thị Minh Châu",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
            recognitionConfidence=91,
            recognitionMethod="original_gray:psm3",
            recognitionAmbiguous=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=80),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=ambiguous_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="1234567890abcdef"),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="NOT_DETECTED",
                    sealStatus="NOT_DETECTED",
                    signatureEvidence="No signature signal",
                    sealEvidence="No seal signal",
                ),
            ),
            patch.object(
                TemplateMatcher,
                "match",
                return_value=TemplateMatchResult(status="UNKNOWN"),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        identity_check = next(check for check in result.documentChecks if check.key == "identity")
        self.assertEqual(identity_check.status, "REVIEW")
        self.assertNotEqual(result.tier.value, "RED")
        self.assertEqual(result.aiConfidenceScore, 65)
        self.assertTrue(result.ocrExtraction.recognitionAmbiguous)

    async def test_ambiguous_candidate_mismatch_does_not_force_red(self):
        request = UnifiedInspectionRequest(
            evidenceId="ambiguous-ocr-mismatch",
            activityName=None,
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="Lê Thị Minh Châu", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        ambiguous_ocr = OcrExtractionResult(
            rawText="SINH VIÊN: Lê Thị Minh Chi\nMSSV: 102210002",
            studentNameExtracted="Lê Thị Minh Chi",
            studentCodeExtracted="102210002",
            nameMatchRatio=70,
            codeMatched=False,
            codeMismatch=True,
            recognitionAmbiguous=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=80),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=ambiguous_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="1234567890abcdef"),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="NOT_DETECTED",
                    sealStatus="NOT_DETECTED",
                    signatureEvidence="No signature signal",
                    sealEvidence="No seal signal",
                ),
            ),
            patch.object(
                TemplateMatcher,
                "match",
                return_value=TemplateMatchResult(status="UNKNOWN"),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertNotEqual(result.tier.value, "RED")
        self.assertFalse(result.breakdown["studentCodeMismatch"])
        self.assertFalse(result.breakdown["studentNameMismatch"])
        identity_check = next(check for check in result.documentChecks if check.key == "identity")
        self.assertEqual(identity_check.status, "REVIEW")

    async def test_issued_date_outside_term_forces_red_and_skips_public_search(self):
        request = UnifiedInspectionRequest(
            evidenceId="term-date-mismatch",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            termStartDate="2026-01-01T00:00:00",
            termEndDate="2026-06-30T00:00:00",
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=True,
        )
        matching_identity = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            issuedDateExtracted="2025-07-20",
            nameMatchRatio=100,
            codeMatched=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=80),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=matching_identity),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="NOT_DETECTED",
                    sealStatus="NOT_DETECTED",
                    signatureEvidence="No signature signal",
                    sealEvidence="No seal signal",
                ),
            ),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(side_effect=AssertionError("web search must stop on term mismatch")),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.tier.value, "RED")
        self.assertTrue(result.breakdown["termDateMismatch"])
        term_check = next(check for check in result.documentChecks if check.key == "term")
        self.assertEqual(term_check.status, "FAIL")

    async def test_missing_student_code_remains_a_scored_human_review_case(self):
        request = UnifiedInspectionRequest(
            evidenceId="student-code-missing",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210002"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        ocr_without_code = OcrExtractionResult(
            rawText="Giay chung nhan tham gia hoat dong",
            studentCodeExtracted=None,
            codeMatched=False,
            codeMismatch=False,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=ocr_without_code),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.aiConfidenceScore, 65)
        self.assertEqual(result.tier.value, "YELLOW_WEAK")
        self.assertFalse(result.breakdown["studentCodeMismatch"])

    async def test_unresolved_authenticity_checks_prevent_green_classification(self):
        request = UnifiedInspectionRequest(
            evidenceId="authenticity-review-required",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        matching_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(
                    passed=True,
                    blurScore=200,
                    brightness=120,
                    qualityScore=95,
                ),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=matching_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="PRESENT",
                    sealStatus="PRESENT",
                    signatureEvidence="Visual signature-like marks",
                    sealEvidence="Visual seal-like marks",
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.aiConfidenceScore, 89)
        self.assertEqual(result.tier.value, "YELLOW_STRONG")
        self.assertTrue(result.breakdown["authenticityReviewRequired"])
        self.assertIn("duplicate", result.breakdown["unresolvedAuthenticityChecks"])
        self.assertIn("template", result.breakdown["unresolvedAuthenticityChecks"])
        self.assertIn("không xếp XANH", result.recommendation)

    async def test_template_check_reflects_matcher_and_blocks_green(self):
        request = UnifiedInspectionRequest(
            evidenceId="template-check-reflects-matcher",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        matching_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
        )
        # Kho phôi rỗng: hành vi đúng là UNKNOWN -> REVIEW, không bịa MATCH.
        empty_registry = TemplateRegistry(templates=[], hamming_max=10, aspect_tolerance=0.15)
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=95),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=matching_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="PRESENT",
                    sealStatus="PRESENT",
                    signatureEvidence="Visual signature-like marks",
                    sealEvidence="Visual seal-like marks",
                ),
            ),
            patch("src.template_matcher.load_registry", return_value=empty_registry),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        if result.templateMatch is None:
            self.fail("Kết quả thiếu templateMatch")
        self.assertEqual(result.templateMatch.status, "UNKNOWN")
        template_check = next(check for check in result.documentChecks if check.key == "template")
        self.assertEqual(template_check.status, "REVIEW")
        self.assertNotEqual(result.tier.value, "GREEN")

    async def test_name_without_label_is_matched_against_declared_name(self):
        extracted = OcrExtractorService._extract_name(
            "DOAN THANH NIEN\nGIAY CHUNG NHAN\nDinh Nguyen Thai Binh\nDa tham gia",
            "Đinh Nguyễn Thái Bình",
        )

        self.assertEqual(extracted, "Dinh Nguyen Thai Binh")

    async def test_activity_extraction_handles_certificate_prose_and_plain_vietnamese(self):
        prose = (
            "Đã tham gia và có đóng góp tích cực cho công tác tổ chức "
            "Chương trình Chào đón Tân sinh viên Khóa 49."
        )
        field = "Hoạt động: Ngày hội tình nguyện mùa hè xanh."

        self.assertEqual(
            OcrExtractorService._extract_activity_name(prose),
            "Chương trình Chào đón Tân sinh viên Khóa 49",
        )
        self.assertEqual(
            OcrExtractorService._extract_activity_name(field),
            "Ngày hội tình nguyện mùa hè xanh",
        )

    async def test_public_source_prefers_official_domain_and_boosts_20(self):
        """Nhiều nguồn cùng đạt ngưỡng: ưu tiên nguồn chính thống (DUT) và cộng +20."""
        html = """
        <div class="result">
          <h2 class="result__title"><a href="https://www.facebook.com/dut/posts/999">Ngày hội tình nguyện DUT</a></h2>
          <a class="result__snippet">Sinh viên tham gia ngày hội tình nguyện tại DUT.</a>
        </div>
        <div class="result">
          <h2 class="result__title"><a href="https://dut.udn.vn/News/123">Ngày hội tình nguyện DUT</a></h2>
          <a class="result__snippet">Sinh viên tham gia ngày hội tình nguyện tại DUT.</a>
        </div>
        """

        class FakeResponse:
            text = html

            def raise_for_status(self):
                return None

        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.get.return_value = FakeResponse()

        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=fake_client):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        if result.articleUrl is None:
            self.fail("Expected a matching source result")
        self.assertEqual(result.articleUrl, "https://dut.udn.vn/News/123")
        self.assertEqual(result.confidenceBoost, 20)

    async def test_social_source_result_gets_smaller_boost(self):
        """Nguồn mạng xã hội chỉ được nhận khi bật cờ nguồn ngoài."""
        html = """
        <div class="result">
          <h2 class="result__title"><a href="https://www.facebook.com/dut/posts/123">Ngày hội tình nguyện DUT</a></h2>
          <a class="result__snippet">Sinh viên tham gia ngày hội tình nguyện tại DUT.</a>
        </div>
        """

        class FakeResponse:
            text = html

            def raise_for_status(self):
                return None

        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.get.return_value = FakeResponse()

        with (
            patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", True),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=fake_client),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertEqual(result.articleUrl, "https://www.facebook.com/dut/posts/123")
        self.assertEqual(result.confidenceBoost, 10)


    async def test_exact_stored_hash_marks_evidence_duplicate_and_forces_red(self):
        request = UnifiedInspectionRequest(
            evidenceId="duplicate-exact",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            previousHashes=[{"sha256": "deadbeef", "pHash": "00000000000000ff"}],
            enableWebSearch=False,
        )
        matching_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=95),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=matching_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="deadbeef", pHash="00000000000000ff"),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="PRESENT",
                    sealStatus="PRESENT",
                    signatureEvidence="s",
                    sealEvidence="e",
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertTrue(result.isDuplicate)
        self.assertEqual(result.duplicateMatchType, "EXACT")
        self.assertEqual(result.tier.value, "RED")
        duplicate_check = next(check for check in result.documentChecks if check.key == "duplicate")
        self.assertEqual(duplicate_check.status, "FAIL")

    async def test_similar_phash_within_hamming_distance_is_flagged(self):
        is_duplicate, match_type, matched_hash = UnifiedPipelineOrchestrator._check_duplicate(
            ForensicCheckResult(sha256="aaa", pHash="0000000000000003"),
            [{"sha256": "bbb", "pHash": "000000000000003f"}],
        )

        self.assertTrue(is_duplicate)
        self.assertEqual(match_type, "SIMILAR")
        self.assertEqual(matched_hash, "bbb")

    async def test_activity_name_mismatch_requires_review(self):
        request = UnifiedInspectionRequest(
            evidenceId="activity-mismatch",
            activityName="Ngay hoi tinh nguyen DUT",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        mismatched_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
            activityNameExtracted="Cuoc thi khac hoan toan",
            activityNameMatchRatio=12.0,
            activityNameMismatch=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=95),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=mismatched_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="PRESENT",
                    sealStatus="PRESENT",
                    signatureEvidence="s",
                    sealEvidence="e",
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        activity_check = next(check for check in result.documentChecks if check.key == "activity")
        self.assertEqual(activity_check.status, "REVIEW")
        self.assertIn("activity", result.breakdown["unresolvedAuthenticityChecks"])
        self.assertNotEqual(result.tier.value, "GREEN")

    async def test_blood_donation_cccd_mismatch_forces_red(self):
        request = UnifiedInspectionRequest(
            evidenceId="cccd-mismatch",
            activityName="Hien mau nhan dao",
            evidenceType="GIAY_HIEN_MAU",
            declaredStudent=DeclaredStudent(
                fullName="NGUYEN VAN A",
                studentCode="102210001",
                citizenId="012345678901",
            ),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        mismatched_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001\nCCCD: 012345678999",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
            citizenIdExtracted="012345678999",
            citizenIdMatched=False,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=95),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=mismatched_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="test", pHash="0" * 16),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="NOT_DETECTED",
                    sealStatus="NOT_DETECTED",
                    signatureEvidence="s",
                    sealEvidence="e",
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.tier.value, "RED")
        self.assertTrue(result.breakdown["citizenIdMismatch"])
        citizen_check = next(check for check in result.documentChecks if check.key == "citizen_id")
        self.assertEqual(citizen_check.status, "FAIL")
        self.assertIn("CCCD", result.recommendation)

    async def test_ocr_merges_text_from_all_attached_files(self):
        def pdf_with(text: str) -> bytes:
            document = fitz.open()
            page = document.new_page()
            page.insert_text((72, 72), text)
            return document.tobytes()

        result = OcrExtractorService.extract_and_parse_many(
            [
                pdf_with("Ho va ten: Nguyen Van A MSSV: 102210001"),
                pdf_with("Hoat dong: Ngay hoi tinh nguyen DUT 2026"),
            ],
            evidence_type="GIAY_KHEN",
            declared_name="Nguyen Van A",
            declared_student_code="102210001",
        )

        self.assertIn("102210001", result.rawText)
        self.assertIn("DUT 2026", result.rawText)
        self.assertEqual(result.studentCodeExtracted, "102210001")

    async def test_forensic_hash_is_consistent_and_changes_when_bytes_change(self):
        first = QualityAndForensicsService.inspect_forensics(image_bytes())
        second = QualityAndForensicsService.inspect_forensics(image_bytes())
        changed = QualityAndForensicsService.inspect_forensics(image_bytes(with_text=False))

        self.assertEqual(first.sha256, second.sha256)
        self.assertEqual(first.pHash, second.pHash)
        self.assertNotEqual(first.sha256, changed.sha256)

    async def test_unavailable_phash_is_never_reported_as_duplicate(self):
        is_duplicate, match_type, matched_hash = UnifiedPipelineOrchestrator._check_duplicate(
            ForensicCheckResult(sha256="aaaa", pHash="0" * 16),
            [{"sha256": "bbbb", "pHash": "0" * 16}],
        )

        self.assertFalse(is_duplicate)
        self.assertIsNone(match_type)
        self.assertIsNone(matched_hash)

    async def test_corrupt_image_bytes_are_rejected_with_actionable_message(self):
        with self.assertRaisesRegex(ValueError, "không phải ảnh/PDF hợp lệ"):
            UnifiedPipelineOrchestrator._image_for_inspection(b"<html>not an image</html>")

    async def test_pdf_without_pages_is_rejected(self):
        zero_page_pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
            b"trailer<</Root 1 0 R>>\n%%EOF"
        )
        with self.assertRaisesRegex(ValueError, "trang"):
            UnifiedPipelineOrchestrator._image_for_inspection(zero_page_pdf)

    async def test_empty_upload_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "rỗng"):
            await UnifiedPipelineOrchestrator._extract_bytes("data:image/png;base64,", None)

    async def test_invalid_base64_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Base64 hợp lệ"):
            await UnifiedPipelineOrchestrator._extract_bytes("@@not-base64@@", None)

    async def test_ela_anomaly_alone_never_auto_rejects(self):
        request = UnifiedInspectionRequest(
            evidenceId="ela-signal",
            activityName="DUT volunteer day",
            evidenceType="GIAY_KHEN",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            fileBytesBase64=base64.b64encode(image_bytes()).decode(),
            enableWebSearch=False,
        )
        matching_ocr = OcrExtractionResult(
            rawText="Ho va ten: Nguyen Van A\nMSSV: 102210001",
            studentNameExtracted="Nguyen Van A",
            studentCodeExtracted="102210001",
            nameMatchRatio=100,
            codeMatched=True,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=95),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=matching_ocr),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(
                    sha256="test",
                    pHash="00ff00ff00ff00ff",
                    elaAnomalyScore=0.9,
                    isTampered=True,
                    warnings=["Phát hiện vùng dán đè."],
                ),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_document_marks",
                return_value=DocumentMarkCheckResult(
                    signatureStatus="PRESENT",
                    sealStatus="PRESENT",
                    signatureEvidence="s",
                    sealEvidence="e",
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertNotEqual(result.tier.value, "RED")
        alteration = next(check for check in result.documentChecks if check.key == "alteration")
        self.assertEqual(alteration.status, "REVIEW")
        self.assertIn("không tự động kết luận giả mạo", result.recommendation)


class CriterionEvaluationTests(unittest.TestCase):
    def test_student_code_mismatch_prevents_positive_rubric_suggestion(self):
        result = evaluate_criterion(
            {"code": "14", "maxScore": 4, "scoringConfig": {"requiredData": ["leadershipRole"]}},
            "Lop truong hoan thanh tot nhiem vu",
            True,
            "Can bo lop",
            student_code_mismatch=True,
        )

        self.assertEqual(result["status"], "NOT_MATCHED")
        self.assertEqual(result["suggestedScore"], 0)
        self.assertIn("MSSV", result["reason"])

    def test_quality_failure_is_unverifiable_and_never_suggests_zero(self):
        criterion = {
            "code": "14",
            "maxScore": 4,
            "scoringConfig": {
                "kind": "leadership_duty",
                "passScore": 4,
                "requiredData": ["leadershipRole"],
            },
        }

        result = evaluate_criterion(
            criterion,
            "Lop truong hoan thanh tot nhiem vu",
            True,
            "Can bo lop",
            quality_passed=False,
        )

        self.assertEqual(result["status"], "UNVERIFIABLE")
        self.assertIsNone(result["matchScore"])
        self.assertIsNone(result["suggestedScore"])
        self.assertIn("Chất lượng tệp không đạt", result["reason"])

    def test_participation_certificate_does_not_qualify_for_leadership_duty(self):
        criterion = {
            "code": "14",
            "maxScore": 4,
            "scoringConfig": {
                "kind": "leadership_duty",
                "passScore": 4,
                "requiredData": ["leadershipRole", "collectiveApprovalPercent", "advisorConfirmation"],
            },
        }
        text = (
            "CAU LAC BO HRM. GIAY CHUNG NHAN. Dinh Nguyen Thai Binh "
            "Da tham gia du thi Vong 1 cuoc thi HR MASTERMIND. "
            "Xac nhan cua Ban chu nhiem Cau lac bo HRM."
        )

        result = evaluate_criterion(criterion, text, True, "Cuộc thi HR Mastermind")

        self.assertEqual(result["status"], "NOT_MATCHED")
        self.assertEqual(result["matchScore"], 33.3)
        self.assertEqual(result["threshold"], 60)
        self.assertEqual(result["suggestedScore"], 0)
        self.assertEqual(len(result["missingRequirements"]), 2)

    def test_leadership_certificate_meeting_all_conditions_suggests_rubric_score(self):
        criterion = {
            "code": "14",
            "maxScore": 4,
            "scoringConfig": {
                "kind": "leadership_duty",
                "passScore": 4,
                "requiredData": ["leadershipRole", "collectiveApprovalPercent", "advisorConfirmation"],
            },
        }
        text = (
            "Lop truong hoan thanh tot nhiem vu. Khao sat binh chon tap the dat 95%. "
            "Giang vien co van xac nhan."
        )

        result = evaluate_criterion(criterion, text, True, "Cán bộ lớp")

        self.assertEqual(result["status"], "MATCHED")
        self.assertEqual(result["matchScore"], 100)
        self.assertEqual(result["suggestedScore"], 4)

    def test_unreadable_document_is_not_automatically_scored_zero(self):
        criterion = {
            "code": "14",
            "maxScore": 4,
            "scoringConfig": {
                "kind": "leadership_duty",
                "requiredData": ["leadershipRole", "collectiveApprovalPercent", "advisorConfirmation"],
            },
        }

        result = evaluate_criterion(criterion, "", False, "Cán bộ lớp")

        self.assertEqual(result["status"], "UNVERIFIABLE")
        self.assertIsNone(result["suggestedScore"])

    def test_hr_competition_certificate_does_not_match_research_or_olympiad_criterion(self):
        criterion = {
            "code": "5",
            "maxScore": 3,
            "scoringConfig": {
                "kind": "award_tier",
                "scores": {"PARTICIPATED": 2, "CONSOLATION_OR_HIGHER": 3},
                "requiredData": ["awardTier"],
            },
        }

        result = evaluate_criterion(
            criterion,
            "Da tham gia du thi Vong 1 cuoc thi HR MASTERMIND",
            True,
            "Cuộc thi HR Mastermind",
        )

        self.assertEqual(result["status"], "NOT_MATCHED")
        self.assertEqual(result["suggestedScore"], 0)

    def test_school_level_award_and_official_role_suggest_full_score(self):
        criterion = {
            "code": "16",
            "maxScore": 3,
            "scoringConfig": {
                "kind": "verified_boolean",
                "passScore": 3,
                "requiredData": ["leadershipRole", "institutionAwardEvidence"],
            },
        }

        result = evaluate_criterion(
            criterion,
            "Bi thu Doan truong duoc tang giay khen cap Truong",
            True,
            "Cán bộ Đoàn được khen thưởng",
        )

        self.assertEqual(result["status"], "MATCHED")
        self.assertEqual(result["suggestedScore"], 3)


if __name__ == "__main__":
    unittest.main()
