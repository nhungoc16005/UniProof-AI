import base64
import io
import json
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from PIL import Image

from src.config import settings
from src.criterion_evaluator import evaluate_criterion
from src.face_verifier import FaceAndVisionService
from src.ocr_extractor import OcrExtractorService
from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.predictor import MODEL_PATH, META_PATH, is_rubric_model_available, predict_rubric_criterion
from src.quality_forensics import QualityAndForensicsService
from src.schemas import (
    DeclaredStudent,
    ExifMetadataResult,
    ForensicCheckResult,
    OcrExtractionResult,
    QualityCheckResult,
    SceneVisionResult,
    TierClassification,
    UnifiedInspectionRequest,
    WebVerificationResult,
)


def _dummy_png_b64() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), "white").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


class TrainedRubricModelTests(unittest.TestCase):
    def test_model_artifact_and_metadata_exist_with_cv_mean_std_and_confusion_matrix(self):
        self.assertTrue(MODEL_PATH.exists(), "rubric_classifier.joblib must exist after training")
        self.assertTrue(META_PATH.exists(), "rubric_classifier_meta.json must exist after training")
        self.assertTrue(is_rubric_model_available())

        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(meta["trainSampleCount"], 100)
        best = meta["cvBenchmark"][meta["bestCvModel"]]
        self.assertIn("macro_f1_fold_mean", best)
        self.assertIn("macro_f1_fold_std", best)
        self.assertIn("confusion_matrix", best)

    def test_predicts_core_dut_rubric_criteria_with_valid_top3_probabilities(self):
        cases = [
            ("Da Nang Code League 2024", "Certificate of participation Hackathon lập trình cuộc thi học thuật", "MUC_5"),
            ("Workshop Kỹ năng AI thực chiến", "Khóa tập huấn kỹ năng mềm ứng dụng AI cho sinh viên", "MUC_8"),
            ("Hội thao Sinh viên Bách khoa 2026", "Giải chạy sinh viên khỏe văn nghệ thể thao", "MUC_9"),
            ("Chiến dịch Mùa hè xanh 2026", "Tình nguyện viên hỗ trợ cộng đồng hiến máu nhân đạo", "MUC_12"),
            ("Ngày hội việc làm DUT Job Fair 2025", "Thành viên Ban tổ chức cộng tác viên hỗ trợ chương trình", "MUC_13"),
        ]
        for activity, text, expected_label in cases:
            pred = predict_rubric_criterion(text, activity)
            self.assertIsNotNone(pred)
            self.assertEqual(pred["predictedLabel"], expected_label, f"Mismatch for {activity}")
            self.assertGreaterEqual(pred["confidence"], 0.0)
            self.assertLessEqual(pred["confidence"], 1.0)
            self.assertEqual(len(pred["topCandidates"]), 3)
            probs = [c["probability"] for c in pred["topCandidates"]]
            self.assertEqual(probs, sorted(probs, reverse=True))

    def test_evaluate_criterion_attaches_ml_prediction_and_preserves_safety_gates(self):
        criterion_12 = {
            "id": "crit-12",
            "code": "12",
            "maxScore": 10,
            "scoringConfig": {"kind": "activity_threshold", "requiredData": ["verifiedActivityCount"], "tiers": [{"min": 1, "score": 5}]},
        }
        # Quality failure must stay UNVERIFIABLE (never 0)
        q_fail = evaluate_criterion(criterion_12, "Mùa hè xanh", True, "Mùa hè xanh", quality_passed=False)
        self.assertEqual(q_fail["status"], "UNVERIFIABLE")
        self.assertIsNone(q_fail["suggestedScore"])

        # Student code mismatch must force NOT_MATCHED 0đ
        id_fail = evaluate_criterion(criterion_12, "Mùa hè xanh", True, "Mùa hè xanh", student_code_mismatch=True)
        self.assertEqual(id_fail["status"], "NOT_MATCHED")
        self.assertEqual(id_fail["suggestedScore"], 0)

        # Valid volunteer text attaches mlPrediction
        ok = evaluate_criterion(
            criterion_12,
            "Trường ĐH Bách khoa chứng nhận sinh viên tham gia chiến dịch tình nguyện Mùa hè xanh 2026",
            True,
            "Chiến dịch Mùa hè xanh 2026",
        )
        self.assertIn("mlPrediction", ok)
        self.assertEqual(ok["mlPrediction"]["predictedLabel"], "MUC_12")


class EventPhotoRankAndPipelineTests(unittest.IsolatedAsyncioTestCase):
    def _event_request(self) -> UnifiedInspectionRequest:
        return UnifiedInspectionRequest(
            evidenceId="ev-photo-test",
            activityName="Chiến dịch Mùa hè xanh DUT 2026",
            evidenceType="ANH_SU_KIEN",
            declaredStudent=DeclaredStudent(fullName="Trần Đức Long", studentCode="102230027"),
            fileBytesBase64=_dummy_png_b64(),
            enableWebSearch=True,
        )

    async def test_event_photo_with_all_signals_is_hang_b_and_never_green(self):
        with (
            patch.object(settings, "FACE_MATCHING_ENABLED", False),
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=QualityCheckResult(passed=True, blurScore=200, brightness=130, qualityScore=92)),
            patch.object(QualityAndForensicsService, "inspect_forensics", return_value=ForensicCheckResult(sha256="abc", pHash="0" * 16)),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=OcrExtractionResult(rawText="CHIEN DICH MUA HE XANH DUT 2026", available=True)),
            patch.object(FaceAndVisionService, "verify_face_in_event", side_effect=AssertionError("D3: face must not run")),
            patch.object(FaceAndVisionService, "extract_exif", return_value=ExifMetadataResult(matchesDeclaredDate=True)),
            patch.object(FaceAndVisionService, "analyze_scene_vision", return_value=SceneVisionResult(matchesActivity=True)),
            patch("src.pipeline_orchestrator.WebSearchVerifierService.verify_event", new=AsyncMock(return_value=WebVerificationResult(searched=True, articleUrl="https://dut.udn.vn/tin/1", confidenceBoost=20))),
        ):
            res = await UnifiedPipelineOrchestrator.process(self._event_request())

        self.assertEqual(res.pipelineMode, "EVENT_PHOTO_PIPELINE")
        self.assertLessEqual(res.aiConfidenceScore, 89.0)
        self.assertEqual(res.tier, TierClassification.YELLOW_STRONG)
        self.assertEqual(res.classification, "HANG_B")
        self.assertEqual(res.faceVerification.status, "NOT_CHECKED")
        self.assertIsNotNone(res.rubricPrediction)

    async def test_event_photo_missing_exif_drops_to_hang_c_and_stays_hitl(self):
        with (
            patch.object(settings, "FACE_MATCHING_ENABLED", False),
            patch.object(QualityAndForensicsService, "inspect_quality", return_value=QualityCheckResult(passed=True, blurScore=200, brightness=130, qualityScore=92)),
            patch.object(QualityAndForensicsService, "inspect_forensics", return_value=ForensicCheckResult(sha256="abc", pHash="0" * 16)),
            patch.object(OcrExtractorService, "extract_and_parse", return_value=OcrExtractionResult(rawText="CHIEN DICH MUA HE XANH DUT 2026", available=True)),
            patch.object(FaceAndVisionService, "verify_face_in_event", side_effect=AssertionError("D3: face must not run")),
            patch.object(FaceAndVisionService, "extract_exif", return_value=ExifMetadataResult(matchesDeclaredDate=None)),
            patch.object(FaceAndVisionService, "analyze_scene_vision", return_value=SceneVisionResult(matchesActivity=True)),
            patch("src.pipeline_orchestrator.WebSearchVerifierService.verify_event", new=AsyncMock(return_value=WebVerificationResult(searched=True, articleUrl="https://dut.udn.vn/tin/1", confidenceBoost=20))),
        ):
            res = await UnifiedPipelineOrchestrator.process(self._event_request())

        self.assertLessEqual(res.aiConfidenceScore, 89.0)
        self.assertEqual(res.tier, TierClassification.YELLOW_WEAK)
        self.assertEqual(res.classification, "HANG_C")


if __name__ == "__main__":
    unittest.main()
