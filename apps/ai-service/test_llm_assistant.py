import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from src.config import settings
from src.criterion_evaluator import evaluate_criterion
from src.llm_assistant import (
    _MEM_CACHE,
    assist_rubric_evaluation,
    sanitize_event_text_for_llm,
    should_escalate_to_llm,
)


class PiiFirewallAndGroqAssistantTests(unittest.TestCase):
    def setUp(self) -> None:
        _MEM_CACHE.clear()
        self._tmp = tempfile.TemporaryDirectory()
        self.cache_db = str(Path(self._tmp.name) / "llm_cache_test.sqlite3")

    def tearDown(self) -> None:
        self._tmp.cleanup()
        _MEM_CACHE.clear()

    def test_pii_firewall_strips_ocr_corrupted_names_and_identity_lines(self) -> None:
        noisy_ocr = """
        TRƯỜNG ĐẠI HỌC BÁCH KHOA - ĐẠI HỌC ĐÀ NẴNG
        GIẤY CHỨNG NHẬN
        Họ và tên: Nguyền Thanh Hang
        MSSV: 102210099 | Lớp: 24CDT1 | Chi đoàn: 24CDT1
        CCCD: 048204001234 | Ngày sinh: 15/08/2005 | Lượng máu: 350 ml
        SĐT: 0905 123 456 | Email: thanhhang@dut.udn.vn
        Is awarded to
        Le Chi Nhat Minh
        Đồng chí: Lê Nguyễn Yến Nhi
        TRAN DOAN NGOC HUYEN
        DangNgocBaoPhuiong
        Đã tích cực tham gia Chiến dịch Clean Up Son Tra – For a Green Son Tra 2026
        Vai trò: Outstanding Volunteer
        """
        sanitized = sanitize_event_text_for_llm(
            noisy_ocr,
            "Clean Up Son Tra 2026",
            declared_student_name="Nguyễn Thanh Hằng",
            declared_student_code="102210099",
            declared_citizen_id="048204001234",
            ocr_extracted_name="Đặng Ngọc Bảo Phương",
        )
        lowered = sanitized.lower()
        # Không một thông tin định danh nào được phép lọt qua tường lửa
        for forbidden in (
            "hang",
            "102210099",
            "048204001234",
            "24cdt1",
            "350 ml",
            "0905",
            "thanhhang@",
            "nhat minh",
            "yen nhi",
            "ngoc huyen",
            "phuiong",
        ):
            self.assertNotIn(forbidden, lowered, f"Leaked PII token: {forbidden} in {sanitized}")

        # Nhưng thông tin sự kiện & vai trò vẫn còn đầy đủ cho LLM phân tích
        self.assertIn("clean up son tra", lowered)
        self.assertIn("outstanding volunteer", lowered)

    def test_gatekeeper_skips_llm_when_local_phobert_is_confident_and_matched(self) -> None:
        with patch.object(settings, "EXTERNAL_LLM_EXTRACTION_ENABLED", True), patch.object(
            settings, "GROQ_API_KEY", "gsk_test_dummy"
        ):
            high_conf_pred = {
                "predictedLabel": "MUC_12",
                "predictedCriterionCode": "12",
                "confidence": 0.89,
                "topCandidates": [
                    {"label": "MUC_12", "probability": 0.89},
                    {"label": "MUC_9", "probability": 0.05},
                ],
            }
            escalate, reason = should_escalate_to_llm(
                ml_prediction=high_conf_pred,
                target_code="12",
                rule_status="MATCHED",
                web_snippet="",
            )
            self.assertFalse(escalate)
            self.assertIsNone(reason)

    def test_hybrid_rescues_english_certificate_caches_by_event_and_sends_zero_pii(self) -> None:
        captured_bodies: list[str] = []

        def _mock_handler(request: httpx.Request) -> httpx.Response:
            captured_bodies.append(request.content.decode("utf-8"))
            reply = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "predictedLabel": "MUC_5",
                                    "confidence": 0.91,
                                    "activityName": "Da Nang Code League 2024",
                                    "organizer": "FPT Software & DUT",
                                    "participantRole": "PARTICIPANT",
                                    "awardLevel": "PARTICIPATED_ONLY",
                                    "webMatchVerdict": "NOT_CHECKED",
                                    "reviewerSummaryVi": "Chứng nhận tham gia cuộc thi lập trình học thuật Da Nang Code League, phù hợp Mục 5.",
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            }
            return httpx.Response(200, json=reply)

        transport = httpx.MockTransport(_mock_handler)
        criterion_5 = {
            "code": "5",
            "maxScore": 3,
            "scoringConfig": {"kind": "award_tier", "requiredData": ["awardTier"], "scores": {"PARTICIPATED": 2, "CONSOLATION_OR_HIGHER": 3}},
        }

        with (
            patch.object(settings, "EXTERNAL_LLM_EXTRACTION_ENABLED", True),
            patch.object(settings, "GROQ_API_KEY", "gsk_test_dummy"),
            patch.object(settings, "LLM_CACHE_PATH", self.cache_db),
        ):
            # Sinh viên 1 nộp chứng nhận tiếng Anh (PhoBERT nội bộ chỉ đạt conf ~0.55 < 0.65)
            res1 = evaluate_criterion(
                criterion_5,
                "Presented to\nNguyen Van An\nMSSV: 102210111\nCertificate of participation in Da Nang Code League 2024 Hackathon programming contest",
                True,
                "Da Nang Code League 2024",
                declared_student_name="Nguyễn Văn An",
                declared_student_code="102210111",
                llm_transport=transport,
            )
            self.assertEqual(len(captured_bodies), 1)
            self.assertNotIn("Nguyen Van An", captured_bodies[0])
            self.assertNotIn("102210111", captured_bodies[0])
            self.assertEqual(res1["mlPrediction"]["predictedLabel"], "MUC_5")
            self.assertEqual(res1["mlPrediction"]["fusionSource"], "HYBRID_LLM_TIEBREAKER")
            self.assertEqual(res1["status"], "NEEDS_HUMAN_REVIEW")
            self.assertIsNone(res1["suggestedScore"])
            self.assertIn("Trợ lý Hybrid:", res1["reason"])
            self.assertFalse(res1["llmAssistant"]["cacheHit"])

            # Sinh viên 2 nộp CÙNG sự kiện nhưng tên & MSSV khác -> Trúng Event Cache 7 ngày (0 HTTP call thêm!)
            res2 = evaluate_criterion(
                criterion_5,
                "Presented to\nTran Thi Bich\nMSSV: 102210222\nCertificate of participation in Da Nang Code League 2024 Hackathon programming contest",
                True,
                "Da Nang Code League 2024",
                declared_student_name="Trần Thị Bích",
                declared_student_code="102210222",
                llm_transport=transport,
            )
            self.assertEqual(len(captured_bodies), 1, "Event cache must deduplicate identical events across students")
            self.assertTrue(res2["llmAssistant"]["cacheHit"])
            self.assertEqual(res2["mlPrediction"]["predictedLabel"], "MUC_5")

    def test_groq_429_retries_fallback_model_and_500_degrades_gracefully(self) -> None:
        models_called: list[str] = []

        def _rate_limit_then_ok(request: httpx.Request) -> httpx.Response:
            payload = json.loads(request.content.decode("utf-8"))
            models_called.append(payload["model"])
            if len(models_called) == 1:
                return httpx.Response(429, json={"error": "rate_limit"})
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "predictedLabel": "MUC_12",
                                        "confidence": 0.88,
                                        "reviewerSummaryVi": "Chiến dịch tình nguyện môi trường thuộc Mục 12.",
                                    }
                                )
                            }
                        }
                    ]
                },
            )

        with (
            patch.object(settings, "EXTERNAL_LLM_EXTRACTION_ENABLED", True),
            patch.object(settings, "GROQ_API_KEY", "gsk_test_dummy"),
            patch.object(settings, "LLM_CACHE_PATH", self.cache_db),
        ):
            out = assist_rubric_evaluation(
                raw_ocr_text="Outstanding Volunteer in World Cleanup Day 2026",
                activity_name="World Cleanup Day 2026",
                target_code="12",
                transport=httpx.MockTransport(_rate_limit_then_ok),
            )
            self.assertIsNotNone(out)
            self.assertEqual(models_called, [settings.LLM_MODEL, settings.LLM_FALLBACK_MODEL])
            self.assertEqual(out["llmModel"], settings.LLM_FALLBACK_MODEL)

            # Kiểm tra lỗi 500 -> graceful degradation trả None, không văng exception
            out_err = assist_rubric_evaluation(
                raw_ocr_text="Another different event text for 500 check",
                activity_name="Event 500",
                target_code="12",
                transport=httpx.MockTransport(lambda req: httpx.Response(500, text="server error")),
            )
            self.assertIsNone(out_err)


if __name__ == "__main__":
    unittest.main()
