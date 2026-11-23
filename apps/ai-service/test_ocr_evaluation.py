import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
from evaluate_ocr_pilot import evaluate_pilot, normalize_transcription


class OcrPilotEvaluationTests(unittest.TestCase):
    def test_normalization_excludes_identity_and_class_codes_but_keeps_vietnamese_diacritics(self):
        tokens = normalize_transcription(
            "Giấy chứng nhận\n"
            "Sinh viên: [REDACTED_PERSON]\n"
            "Chi đoàn: 49K30.2\n"
            "Đã hoàn thành công tác trong chiến dịch Mùa hè Xanh 2024."
        )

        self.assertEqual(
            tokens,
            [
                "giấy", "chứng", "nhận", "chi", "đoàn", "đã", "hoàn", "thành",
                "công", "tác", "trong", "chiến", "dịch", "mùa", "hè", "xanh", "2024",
            ],
        )

    def test_requires_explicit_review_confirmation(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, "Confirm that pilot transcriptions"):
                evaluate_pilot(Path(temporary))

    def test_evaluates_once_per_exact_duplicate_group_and_reports_micro_metrics(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pilot_annotations.csv").write_text(
                "sample_id,expected_transcription\n"
                "sample-1,Đã tham gia\n"
                "sample-2,Đã tham gia\n"
                "sample-3,Giấy chứng nhận\n",
                encoding="utf-8",
            )
            (root / "pilot_machine_draft.csv").write_text(
                "sample_id,ai_draft_transcription_redacted\n"
                "sample-1,Đã tham gia\n"
                "sample-2,hoàn toàn sai\n"
                "sample-3,Giấy chứng nhận\n",
                encoding="utf-8",
            )
            records = [
                {"sample_id": "sample-1", "sha256": "same"},
                {"sample_id": "sample-2", "sha256": "same"},
                {"sample_id": "sample-3", "sha256": "unique"},
            ]
            (root / "manifest.jsonl").write_text(
                "".join(json.dumps(record) + "\n" for record in records),
                encoding="utf-8",
            )

            report = evaluate_pilot(root, transcripts_reviewed=True)

        self.assertEqual(report["sample_count"], 3)
        self.assertEqual(report["unique_document_count"], 2)
        self.assertEqual(report["evaluated_document_count"], 2)
        self.assertEqual(report["exact_duplicate_samples_excluded"], 1)
        self.assertEqual(report["cer"]["micro"], 0)
        self.assertEqual(report["wer"]["micro"], 0)
        self.assertEqual(len(report["per_sample"]), 2)

    def test_rejects_missing_transcriptions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pilot_annotations.csv").write_text(
                "sample_id,expected_transcription\nsample-1,\n",
                encoding="utf-8",
            )
            (root / "pilot_machine_draft.csv").write_text(
                "sample_id,ai_draft_transcription_redacted\nsample-1,some text\n",
                encoding="utf-8",
            )
            (root / "manifest.jsonl").write_text(
                json.dumps({"sample_id": "sample-1", "sha256": "hash"}) + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "reviewed transcription"):
                evaluate_pilot(root, transcripts_reviewed=True)

    def test_records_manual_exclusions_and_rejects_unknown_samples(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pilot_annotations.csv").write_text(
                "sample_id,expected_transcription\n"
                "sample-1,Đã tham gia\n"
                "sample-2,Đã tham gia\n"
                "sample-3,Giấy chứng nhận\n",
                encoding="utf-8",
            )
            (root / "pilot_machine_draft.csv").write_text(
                "sample_id,ai_draft_transcription_redacted\n"
                "sample-1,Đã tham gia\n"
                "sample-2,Đã tham gia\n"
                "sample-3,Giấy chứng nhận\n",
                encoding="utf-8",
            )
            (root / "manifest.jsonl").write_text(
                "\n".join([
                    json.dumps({"sample_id": "sample-1", "sha256": "duplicate"}),
                    json.dumps({"sample_id": "sample-2", "sha256": "duplicate"}),
                    json.dumps({"sample_id": "sample-3", "sha256": "unique"}),
                ]) + "\n",
                encoding="utf-8",
            )

            report = evaluate_pilot(
                root,
                transcripts_reviewed=True,
                excluded_samples={"sample-2": "Reference is incomplete for this document."},
            )

            self.assertEqual(report["evaluated_document_count"], 1)
            self.assertEqual(
                report["skipped_samples"],
                [{
                    "sample_id": "sample-1",
                    "excluded_sample_id": "sample-2",
                    "reason": "Reference is incomplete for this document.",
                }],
            )
            with self.assertRaisesRegex(ValueError, "unknown sample_id"):
                evaluate_pilot(
                    root,
                    transcripts_reviewed=True,
                    excluded_samples={"unknown": "No matching annotation."},
                )


if __name__ == "__main__":
    unittest.main()
