import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))

from evaluate_pipeline_layers import evaluate_layers
from layer_metrics import (
    NOT_EVIDENCED,
    binary_metrics,
    brier_score,
    expected_calibration_error,
    field_exact_match,
    micro_f1,
    normalize_text,
    token_counts,
    wilson_interval,
)

ANNOTATION_HEADER = [
    "sample_id",
    "document_type",
    "expected_issue_date",
    "expected_issuer",
    "expected_activity_name",
    "expected_student_code_match",
    "expected_student_name_match",
    "expected_term_match",
    "duplicate_review_label",
    "human_review_decision",
]
PREDICTION_HEADER = [
    "sample_id",
    "predicted_document_type",
    "predicted_issue_date",
    "predicted_issuer",
    "predicted_activity_name",
    "predicted_student_code_match",
    "predicted_student_name_match",
    "predicted_term_match",
    "predicted_duplicate_match_type",
    "ai_confidence",
    "tier",
]


class LayerMetricsTests(unittest.TestCase):
    def test_wilson_interval_is_bounded_and_matches_known_case(self):
        lower, upper = wilson_interval(0, 10)
        self.assertGreaterEqual(lower, 0.0)
        self.assertAlmostEqual(upper, 0.278, places=2)

        high_lower, high_upper = wilson_interval(10, 10)
        self.assertAlmostEqual(high_lower, 0.722, places=2)
        self.assertLessEqual(high_upper, 1.0)

        self.assertEqual(wilson_interval(0, 0), (0.0, 1.0))

    def test_binary_metrics_return_none_when_denominator_is_zero(self):
        empty = binary_metrics(0, 0, 0)
        self.assertIsNone(empty["precision"])
        self.assertIsNone(empty["recall"])
        self.assertIsNone(empty["f1"])

        perfect = binary_metrics(2, 0, 0)
        self.assertEqual(perfect["precision"], 1.0)
        self.assertEqual(perfect["recall"], 1.0)
        self.assertEqual(perfect["f1"], 1.0)

        no_true_positive = binary_metrics(0, 1, 1)
        self.assertEqual(no_true_positive["precision"], 0.0)
        self.assertEqual(no_true_positive["recall"], 0.0)
        self.assertEqual(no_true_positive["f1"], 0.0)

    def test_field_exact_match_normalizes_and_skips_missing(self):
        result = field_exact_match(
            [
                ("Đoàn Thanh Niên", "doan thanh nien"),
                ("2023-10-13", "2023-10-13"),
                (None, "bịa"),
                ("unknown", "bịa"),
            ]
        )

        self.assertEqual(result["correct"], 2)
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["accuracy"], 1.0)

    def test_micro_f1_aggregates_token_counts(self):
        per_field = {
            "issuer": token_counts("bcd hien mau", "bcd hien mau"),
            "activity": token_counts("hien mau tinh nguyen", "hien mau tinh nghien"),
        }

        result = micro_f1(per_field)

        self.assertEqual(result["truePositive"], 6)
        self.assertEqual(result["falsePositive"], 1)
        self.assertEqual(result["falseNegative"], 1)
        self.assertAlmostEqual(result["f1"], 6 / 7)

    def test_calibration_error_and_brier_on_known_input(self):
        self.assertAlmostEqual(expected_calibration_error([0.9, 0.4], [1, 0]), 0.25)
        self.assertAlmostEqual(brier_score([0.9, 0.4], [1, 0]), 0.085)
        self.assertIsNone(expected_calibration_error([], []))
        self.assertIsNone(brier_score([], []))

    def test_normalize_text_folds_accents_and_punctuation(self):
        self.assertEqual(normalize_text("  HỘI Sinh-Viên! "), "hoi sinh vien")


class EvaluateLayersEndToEndTests(unittest.TestCase):
    def _write_csv(self, path: Path, header: list[str], rows: list[dict]) -> None:
        with path.open("w", encoding="utf-8-sig", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=header)
            writer.writeheader()
            writer.writerows(rows)

    def test_evaluates_all_layers_and_marks_not_evidenced(self):
        with tempfile.TemporaryDirectory() as temporary:
            dataset = Path(temporary)
            (dataset / "manifest.jsonl").write_text(
                "\n".join(
                    json.dumps({"sample_id": sample_id, "sha256": digest})
                    for sample_id, digest in (("s1", "aaa"), ("s2", "aaa"), ("s3", "bbb"))
                )
                + "\n",
                encoding="utf-8",
            )
            self._write_csv(
                dataset / "annotations.csv",
                ANNOTATION_HEADER,
                [
                    {
                        "sample_id": "s1",
                        "document_type": "GIAY_CHUNG_NHAN",
                        "expected_issue_date": "2023-10-13",
                        "expected_issuer": "Doan Thanh Nien",
                        "expected_activity_name": "Chao don Tan sinh vien",
                        "expected_student_code_match": "matched",
                        "expected_student_name_match": "matched",
                        "expected_term_match": "unknown",
                        "duplicate_review_label": "exact",
                        "human_review_decision": "accept",
                    },
                    {
                        "sample_id": "s2",
                        "document_type": "GIAY_CHUNG_NHAN",
                        "duplicate_review_label": "exact",
                    },
                    {
                        "sample_id": "s3",
                        "document_type": "GIAY_HIEN_MAU",
                        "expected_issue_date": "2024-01-01",
                        "expected_issuer": "BCD Hien Mau",
                        "expected_activity_name": "Hien mau tinh nguyen",
                        "expected_student_code_match": "unmatched",
                        "expected_student_name_match": "unknown",
                        "duplicate_review_label": "none",
                        "human_review_decision": "reject",
                    },
                ],
            )
            self._write_csv(
                dataset / "pipeline_predictions.csv",
                PREDICTION_HEADER,
                [
                    {
                        "sample_id": "s1",
                        "predicted_document_type": "GIAY_CHUNG_NHAN",
                        "predicted_issue_date": "2023-10-13",
                        "predicted_issuer": "Doan Thanh Nien",
                        "predicted_activity_name": "Chao don Tan sinh vien",
                        "predicted_student_code_match": "true",
                        "predicted_student_name_match": "true",
                        "predicted_term_match": "",
                        "predicted_duplicate_match_type": "EXACT",
                        "ai_confidence": "90",
                        "tier": "GREEN",
                    },
                    {
                        "sample_id": "s2",
                        "predicted_duplicate_match_type": "EXACT",
                        "ai_confidence": "90",
                        "tier": "GREEN",
                    },
                    {
                        "sample_id": "s3",
                        "predicted_document_type": "GIAY_XAC_NHAN",
                        "predicted_issue_date": "2024-01-01",
                        "predicted_issuer": "BCD Hien Mau",
                        "predicted_activity_name": "Hien mau tinh nghien",
                        "predicted_student_code_match": "true",
                        "predicted_duplicate_match_type": "",
                        "ai_confidence": "40",
                        "tier": "YELLOW_WEAK",
                    },
                ],
            )

            report = evaluate_layers(dataset, dataset / "pipeline_predictions.csv")

        layers = report["layers"]
        self.assertEqual(report["commonSamples"], 3)
        self.assertEqual(report["exactDuplicateSamplesExcluded"], 1)

        duplicate = layers["layer2_duplicate"]
        self.assertEqual(duplicate["isDuplicate"]["recall"], 1.0)
        self.assertEqual(duplicate["isExactDuplicate"]["truePositive"], 2)

        extraction = layers["layer4_extraction"]
        self.assertEqual(extraction["fields"]["document_type"]["accuracy"], 0.5)
        self.assertEqual(extraction["fields"]["issue_date"]["accuracy"], 1.0)

        identity = layers["layer5_identity"]["fields"]
        self.assertEqual(identity["student_code"]["falseAcceptCount"], 1)
        self.assertEqual(identity["student_code"]["falseAcceptRate"], 1.0)
        self.assertEqual(identity["term"]["status"], NOT_EVIDENCED)

        confidence = layers["layer7_confidence"]
        self.assertAlmostEqual(confidence["expectedCalibrationError"], 0.25)
        self.assertAlmostEqual(confidence["brierScore"], 0.085)
        self.assertEqual(confidence["greenTier"]["precision"], 1.0)


if __name__ == "__main__":
    unittest.main()
