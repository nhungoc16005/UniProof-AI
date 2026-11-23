"""Test case tự động cho Luồng 1 và Luồng 2.

- Luồng 1: pipeline kiểm tra minh chứng (UnifiedPipelineOrchestrator).
- Luồng 2: tra cứu đối chiếu nguồn công khai (WebSearchVerifierService).

Bổ sung độ phủ cho các hàm đã có trong test_unified.py:
- Luồng 2: ngưỡng nhận/cộng điểm, phân tầng nguồn, lỗi mạng, làm sạch truy vấn.
- Luồng 1: học kỳ, CCCD khớp, cộng điểm web, pipeline ảnh sự kiện, ngưỡng phân loại.
"""

import base64
import io
import unittest
from datetime import datetime
from unittest.mock import AsyncMock, patch

import httpx
from PIL import Image, ImageDraw

from src.config import Settings, settings
from src.face_verifier import FaceAndVisionService
from src.ocr_extractor import OcrExtractorService
from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.quality_forensics import QualityAndForensicsService
from src.schemas import (
    DeclaredStudent,
    DocumentMarkCheckResult,
    ExifMetadataResult,
    FaceVerificationResult,
    ForensicCheckResult,
    OcrExtractionResult,
    QualityCheckResult,
    QrVerificationResult,
    SceneVisionResult,
    TierClassification,
    UnifiedInspectionRequest,
    WebVerificationResult,
)
from src.web_search_verifier import WebSearchVerifierService


def image_bytes() -> bytes:
    image = Image.new("RGB", (800, 600), (235, 235, 235))
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 780, 580), outline=(0, 0, 0), width=5)
    draw.text((60, 100), "EVIDENCE CERTIFICATE STUDENT ACTIVITY", fill=(0, 0, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def html_client(html: str) -> AsyncMock:
    """httpx.AsyncClient giả lập trả về một trang HTML cố định."""

    class FakeResponse:
        text = html

        def raise_for_status(self):
            return None

    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.return_value = FakeResponse()
    return client


def failing_client(error: Exception) -> AsyncMock:
    """httpx.AsyncClient giả lập ném lỗi khi gọi GET."""
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.side_effect = error
    return client


def result_html(title: str, url: str, snippet: str) -> str:
    return f"""
    <div class="result">
      <h2 class="result__title"><a href="{url}">{title}</a></h2>
      <a class="result__snippet">{snippet}</a>
    </div>
    """


class Luong2PublicSourceTests(unittest.IsolatedAsyncioTestCase):
    """Luồng 2 — tra cứu đối chiếu sự kiện trên nguồn công khai."""

    async def test_empty_activity_name_returns_error_without_search(self):
        result = await WebSearchVerifierService.verify_event("   ")

        self.assertFalse(result.searched)
        self.assertEqual(result.confidenceBoost, 0)
        self.assertIn("Không có tên hoạt động", result.errorDetails or "")

    async def test_query_uses_only_activity_year_and_organizer(self):
        html = "<div class='no-results'>Không có kết quả</div>"
        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)):
            result = await WebSearchVerifierService.verify_event(
                "Ngày hội tình nguyện DUT",
                "2026",
                "Đoàn Thanh niên DUT",
            )

        query = result.queryUsed or ""
        self.assertNotIn("site:", query)
        self.assertIn("Ngày hội tình nguyện DUT", query)
        self.assertIn("Đoàn Thanh niên DUT", query)
        self.assertIn("2026", query)
        for sensitive in ("NGUYEN VAN A", "102210001", "012345678901"):
            self.assertNotIn(sensitive, query)

    async def test_default_settings_reject_external_search_results(self):
        self.assertFalse(Settings(_env_file=None).ALLOW_ALL_PUBLIC_SOURCES)
        self.assertFalse(Settings(_env_file=None).FACE_MATCHING_ENABLED)
        html = result_html(
            "Ngày hội tình nguyện DUT",
            "https://vnexpress.net/ngay-hoi-tinh-nguyen",
            "Ngày hội tình nguyện DUT năm 2026.",
        )
        with (
            patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", False),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")
        self.assertIsNone(result.articleUrl)
        self.assertEqual(result.confidenceBoost, 0)

    async def test_no_results_returns_searched_without_boost(self):
        html = "<div class='no-results'>Không có kết quả</div>"
        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertTrue(result.searched)
        self.assertIsNone(result.articleUrl)
        self.assertEqual(result.confidenceBoost, 0)
        self.assertIsNone(result.errorDetails)

    async def test_result_below_accept_threshold_is_ignored(self):
        html = result_html(
            "Bán vé máy bay giá rẻ đi Đà Nẵng",
            "https://vnexpress.net/tin-tuc",
            "Khuyến mãi vé máy bay nội địa.",
        )
        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertTrue(result.searched)
        self.assertIsNone(result.articleUrl)
        self.assertEqual(result.confidenceBoost, 0)

    async def test_match_between_accept_and_boost_gets_no_boost(self):
        html = result_html(
            "Ngày hội tình nguyện DUT",
            "https://dut.udn.vn/News/1",
            "Sinh viên tham gia.",
        )
        with (
            patch.object(WebSearchVerifierService, "_similarity", staticmethod(lambda a, b: 0.6)),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertEqual(result.articleUrl, "https://dut.udn.vn/News/1")
        self.assertEqual(result.confidenceBoost, 0)
        self.assertEqual(result.matchScore, 0.6)

    async def test_news_source_gets_smaller_boost_when_external_sources_enabled(self):
        html = result_html(
            "Ngày hội tình nguyện DUT",
            "https://vnexpress.net/ngay-hoi-tinh-nguyen",
            "Sinh viên DUT tham gia ngày hội tình nguyện.",
        )
        with (
            patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", True),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertEqual(result.articleUrl, "https://vnexpress.net/ngay-hoi-tinh-nguyen")
        self.assertEqual(result.confidenceBoost, 10)

    async def test_public_source_gets_smaller_boost(self):
        html = result_html(
            "Ngày hội tình nguyện DUT",
            "https://example.com/ngay-hoi-tinh-nguyen",
            "Sinh viên DUT tham gia ngày hội tình nguyện.",
        )
        with (
            patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", True),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertEqual(result.articleUrl, "https://example.com/ngay-hoi-tinh-nguyen")
        self.assertEqual(result.confidenceBoost, 10)

    async def test_official_source_beats_news_by_priority(self):
        html = result_html(
            "Ngày hội tình nguyện DUT",
            "https://vnexpress.net/ngay-hoi-tinh-nguyen",
            "Sinh viên DUT tham gia ngày hội tình nguyện.",
        ) + result_html(
            "Ngày hội tình nguyện DUT",
            "https://dut.udn.vn/News/evt",
            "Sinh viên DUT tham gia ngày hội tình nguyện.",
        )
        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertEqual(result.articleUrl, "https://dut.udn.vn/News/evt")
        self.assertEqual(result.confidenceBoost, 20)

    async def test_timeout_is_reported_as_searched_with_error(self):
        with patch(
            "src.web_search_verifier.httpx.AsyncClient",
            return_value=failing_client(httpx.TimeoutException("quá hạn")),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertTrue(result.searched)
        self.assertEqual(result.confidenceBoost, 0)
        self.assertIn("hết thời gian chờ", result.errorDetails or "")

    async def test_http_error_is_reported_as_searched_with_error(self):
        with patch(
            "src.web_search_verifier.httpx.AsyncClient",
            return_value=failing_client(httpx.ConnectError("mất kết nối")),
        ):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertTrue(result.searched)
        self.assertEqual(result.confidenceBoost, 0)
        self.assertIn("thất bại", result.errorDetails or "")

    async def test_source_tier_classification(self):
        self.assertEqual(WebSearchVerifierService._source_tier("https://dut.udn.vn/x"), "official")
        self.assertIsNone(WebSearchVerifierService._source_tier("notaurl"))
        self.assertIsNone(WebSearchVerifierService._source_tier("http://localhost"))

        with patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", True):
            self.assertEqual(WebSearchVerifierService._source_tier("https://vnexpress.net/x"), "news")
            self.assertEqual(WebSearchVerifierService._source_tier("https://www.facebook.com/x"), "social")
            self.assertEqual(WebSearchVerifierService._source_tier("https://example.com/x"), "public")
        with patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", False):
            self.assertIsNone(WebSearchVerifierService._source_tier("https://example.com/x"))

    async def test_redirect_url_is_unwrapped_to_official_domain(self):
        raw = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fdut.udn.vn%2FNews%2F1"
        resolved = WebSearchVerifierService._resolve_result_url(raw)

        self.assertEqual(resolved, "https://dut.udn.vn/News/1")
        self.assertEqual(WebSearchVerifierService._source_tier(resolved), "official")

    async def test_snippet_is_truncated_to_500_chars(self):
        long_snippet = "Ngày hội tình nguyện DUT " + ("mô tả chi tiết " * 60)
        html = result_html("Ngày hội tình nguyện DUT", "https://dut.udn.vn/News/9", long_snippet)
        with patch("src.web_search_verifier.httpx.AsyncClient", return_value=html_client(html)):
            result = await WebSearchVerifierService.verify_event("Ngày hội tình nguyện DUT", "2026")

        self.assertIsNotNone(result.snippet)
        self.assertLessEqual(len(result.snippet or ""), 500)


class Luong1DocumentPipelineTests(unittest.IsolatedAsyncioTestCase):
    """Luồng 1 — pipeline kiểm tra minh chứng tài liệu."""

    def _request(self, **overrides) -> UnifiedInspectionRequest:
        payload = {
            "evidenceId": "flow1-case",
            "activityName": "DUT volunteer day",
            "evidenceType": "GIAY_KHEN",
            "declaredStudent": DeclaredStudent(fullName="NGUYEN VAN A", studentCode="102210001"),
            "fileBytesBase64": base64.b64encode(image_bytes()).decode(),
            "enableWebSearch": False,
        }
        payload.update(overrides)
        return UnifiedInspectionRequest(**payload)

    @staticmethod
    def _matching_ocr(**overrides) -> OcrExtractionResult:
        payload = {
            "rawText": "Ho va ten: Nguyen Van A MSSV: 102210001",
            "studentNameExtracted": "Nguyen Van A",
            "studentCodeExtracted": "102210001",
            "nameMatchRatio": 100,
            "codeMatched": True,
        }
        payload.update(overrides)
        return OcrExtractionResult(**payload)

    async def test_issued_date_within_term_passes_term_check(self):
        request = self._request(
            termStartDate=datetime(2026, 1, 1),
            termEndDate=datetime(2026, 6, 30),
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(
                OcrExtractorService,
                "extract_and_parse",
                return_value=self._matching_ocr(issuedDateExtracted="2026-03-15"),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="t", pHash="0" * 16),
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

        self.assertTrue(result.breakdown["termDateMatched"])
        term_check = next(check for check in result.documentChecks if check.key == "term")
        self.assertEqual(term_check.status, "PASS")

    async def test_issued_date_matches_term_unit_boundaries(self):
        request = self._request(
            termStartDate=datetime(2026, 1, 1),
            termEndDate=datetime(2026, 6, 30),
        )

        self.assertTrue(UnifiedPipelineOrchestrator._issued_date_matches_term("2026-03-15", request))
        self.assertFalse(UnifiedPipelineOrchestrator._issued_date_matches_term("2025-12-31", request))
        self.assertIsNone(UnifiedPipelineOrchestrator._issued_date_matches_term("khong-phai-ngay", request))
        self.assertIsNone(UnifiedPipelineOrchestrator._issued_date_matches_term(None, request))
        self.assertIsNone(
            UnifiedPipelineOrchestrator._issued_date_matches_term("2026-03-15", self._request())
        )

    async def test_matched_citizen_id_passes_check(self):
        request = self._request(
            evidenceType="GIAY_HIEN_MAU",
            declaredStudent=DeclaredStudent(
                fullName="NGUYEN VAN A",
                studentCode="102210001",
                citizenId="012345678901",
            ),
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(
                OcrExtractorService,
                "extract_and_parse",
                return_value=self._matching_ocr(
                    rawText="Ho va ten: Nguyen Van A MSSV: 102210001 CCCD: 012345678901",
                    citizenIdExtracted="012345678901",
                    citizenIdMatched=True,
                ),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="t", pHash="0" * 16),
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

        self.assertFalse(result.breakdown["citizenIdMismatch"])
        citizen_check = next(check for check in result.documentChecks if check.key == "citizen_id")
        self.assertEqual(citizen_check.status, "PASS")

    async def test_public_source_boost_is_recorded_and_marked_pass(self):
        request = self._request(enableWebSearch=True)
        web = WebVerificationResult(
            searched=True,
            articleTitle="Ngày hội tình nguyện DUT",
            articleUrl="https://dut.udn.vn/News/evt",
            matchScore=0.9,
            confidenceBoost=20,
        )
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=self._matching_ocr()),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="t", pHash="0" * 16),
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
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(return_value=web),
            ) as verify_event,
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        verify_event.assert_awaited_once()
        self.assertEqual(result.breakdown["webBoost"], 20)
        source_check = next(check for check in result.documentChecks if check.key == "source")
        self.assertEqual(source_check.status, "PASS")

    async def test_identity_mismatch_reports_public_search_skip(self):
        request = self._request(enableWebSearch=True)
        with (
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(
                OcrExtractorService,
                "extract_and_parse",
                return_value=self._matching_ocr(codeMatched=False, codeMismatch=True),
            ),
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(side_effect=AssertionError("web search must stop")),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertFalse(result.webVerification.searched)
        self.assertIn("bỏ qua tra cứu công khai", result.webVerification.errorDetails or "")
        self.assertEqual(result.breakdown["stoppedAt"], "IDENTITY_CHECK")

    async def test_event_photo_pipeline_scores_with_scene_and_web_boost(self):
        request = self._request(evidenceType="ANH_SU_KIEN", enableWebSearch=True)
        with (
            patch.object(settings, "FACE_MATCHING_ENABLED", False),
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="t", pHash="0" * 16),
            ),
            patch.object(
                OcrExtractorService,
                "extract_and_parse",
                return_value=self._matching_ocr(rawText="NGAY HOI TINH NGUYEN DUT", organizerExtracted="DUT"),
            ) as ocr_extract,
            patch.object(
                FaceAndVisionService,
                "verify_face_in_event",
                side_effect=AssertionError("face processing must be disabled by default"),
            ),
            patch.object(
                FaceAndVisionService,
                "extract_exif",
                return_value=ExifMetadataResult(matchesDeclaredDate=True),
            ) as exif_extract,
            patch.object(
                FaceAndVisionService,
                "analyze_scene_vision",
                return_value=SceneVisionResult(matchesActivity=True),
            ) as scene_analysis,
            patch(
                "src.pipeline_orchestrator.WebSearchVerifierService.verify_event",
                new=AsyncMock(
                    return_value=WebVerificationResult(
                        searched=True, articleUrl="https://dut.udn.vn/News/x", confidenceBoost=10
                    )
                ),
            ),
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.pipelineMode, "EVENT_PHOTO_PIPELINE")
        self.assertEqual(result.aiConfidenceScore, 89.0)
        self.assertEqual(result.tier, TierClassification.YELLOW_STRONG)
        self.assertEqual(result.classification, "HANG_B")
        self.assertEqual(result.faceVerification.status, "NOT_CHECKED")
        self.assertEqual(result.faceVerification.facesDetected, 0)
        self.assertEqual(result.breakdown["webBoost"], 10)
        self.assertTrue(result.breakdown["sceneMatched"])
        ocr_extract.assert_called_once()
        exif_extract.assert_called_once()
        scene_analysis.assert_called_once_with("NGAY HOI TINH NGUYEN DUT", "DUT volunteer day", True)

    async def test_provider_query_excludes_student_identity_sentinels(self):
        sentinels = ("PRIVATE FULLNAME 73A", "STUDENTCODE 1022XYZ", "CITIZENID 079123456789")
        request = self._request(
            activityName="DUT volunteer day",
            declaredStudent=DeclaredStudent(fullName=sentinels[0], studentCode=sentinels[1], citizenId=sentinels[2]),
            participationDate=datetime(2026, 5, 10),
            enableWebSearch=True,
        )
        client = html_client("<div class='no-results'>No results</div>")
        with (
            patch.object(settings, "ALLOW_ALL_PUBLIC_SOURCES", False),
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90)),
            patch.object(QualityAndForensicsService, "inspect_forensics", return_value=ForensicCheckResult(sha256="hash", pHash="0" * 16)),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=self._matching_ocr(
                studentNameExtracted=sentinels[0], studentCodeExtracted=sentinels[1],
                nameMatchRatio=100, codeMatched=True, organizerExtracted="DUT Student Union",
            )),
            patch("src.pipeline_orchestrator.QrVerifierService.verify", new=AsyncMock(return_value=QrVerificationResult())),
            patch("src.web_search_verifier.httpx.AsyncClient", return_value=client),
        ):
            await UnifiedPipelineOrchestrator.process(request)

        provider_url = client.get.await_args.args[0]
        from urllib.parse import parse_qs, urlparse
        provider_query = parse_qs(urlparse(provider_url).query).get("q", [""])[0]
        for sentinel in sentinels:
            self.assertNotIn(sentinel, provider_query)
        self.assertIn("DUT volunteer day", provider_query)
        self.assertIn("2026", provider_query)
        self.assertIn("DUT Student Union", provider_query)

    async def test_tier_thresholds_mapping(self):
        self.assertEqual(UnifiedPipelineOrchestrator._tier(100), TierClassification.GREEN)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(90), TierClassification.GREEN)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(89), TierClassification.YELLOW_STRONG)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(75), TierClassification.YELLOW_STRONG)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(74.9), TierClassification.YELLOW_WEAK)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(60), TierClassification.YELLOW_WEAK)
        self.assertEqual(UnifiedPipelineOrchestrator._tier(59.9), TierClassification.RED)

    async def test_collect_files_without_attachment_is_rejected(self):
        request = UnifiedInspectionRequest(
            evidenceId="no-file",
            activityName="DUT volunteer day",
            declaredStudent=DeclaredStudent(fullName="NGUYEN VAN A"),
        )

        with self.assertRaisesRegex(ValueError, "phải có"):
            await UnifiedPipelineOrchestrator._collect_files(request)

    async def test_multiple_attachments_are_all_processed(self):
        request = self._request(
            fileUrls=["https://project.supabase.co/storage/a.png"],
        )
        with (
            patch.object(
                UnifiedPipelineOrchestrator,
                "_extract_bytes",
                new=AsyncMock(return_value=image_bytes()),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_quality",
                return_value=QualityCheckResult(passed=True, blurScore=200, brightness=120, qualityScore=90),
            ),
            patch.object(
                QualityAndForensicsService,
                "inspect_forensics",
                return_value=ForensicCheckResult(sha256="t", pHash="0" * 16),
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
            patch.object(
                OcrExtractorService,
                "extract_and_parse_many",
                return_value=self._matching_ocr(),
            ) as extract_many,
        ):
            result = await UnifiedPipelineOrchestrator.process(request)

        self.assertEqual(result.filesProcessed, 2)
        extract_many.assert_called_once()
        self.assertEqual(len(extract_many.call_args.args[0]), 2)

    async def test_duplicate_check_without_store_is_not_flagged(self):
        is_duplicate, match_type, matched_hash = UnifiedPipelineOrchestrator._check_duplicate(
            ForensicCheckResult(sha256="aaaa", pHash="00ff00ff00ff00ff"),
            None,
        )

        self.assertFalse(is_duplicate)
        self.assertIsNone(match_type)
        self.assertIsNone(matched_hash)


if __name__ == "__main__":
    unittest.main()
