import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
from create_pilot_draft import create_draft


class PilotDraftTests(unittest.TestCase):
    def test_creates_redacted_review_draft_without_changing_gold_annotations(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pilot_annotations.csv").write_text(
                "sample_id,expected_transcription,annotation_status\nsample-1,,\n",
                encoding="utf-8",
            )
            (root / "manifest.jsonl").write_text(
                json.dumps({
                    "sample_id": "sample-1",
                    "sha256": "same-hash",
                    "file_type": "png",
                    "quality_status": "PASS",
                    "ocr_redacted": "GIAY CHUNG NHAN\n"
                                    "Ho va ten: [REDACTED_NAME]\n"
                                    "Tham gia: Ngay hoi tinh nguyen DUT 2026\n"
                                    "Ngay 20 thang 7 nam 2026",
                }, ensure_ascii=False) + "\n"
                + json.dumps({
                    "sample_id": "sample-2",
                    "sha256": "same-hash",
                    "file_type": "jpg",
                    "quality_status": "REVIEW",
                    "ocr_redacted": "",
                }, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

            summary = create_draft(root)

            with (root / "pilot_machine_draft.csv").open(encoding="utf-8-sig", newline="") as source:
                draft = list(csv.DictReader(source))
            gold_csv = (root / "pilot_annotations.csv").read_text(encoding="utf-8")
            self.assertEqual(len(draft), 1)
            self.assertEqual(draft[0]["ai_draft_document_type"], "GIAY_CHUNG_NHAN")
            self.assertNotIn("Ho va ten:", draft[0]["ai_draft_transcription_redacted"])
            self.assertEqual(draft[0]["human_confirmation_needed"], "yes")
            self.assertIn("expected_transcription,annotation_status\nsample-1,,", gold_csv)
            self.assertFalse(summary["ground_truth_written"])
            self.assertEqual(summary["exact_duplicate_groups_in_pilot"], 0)
            self.assertTrue((root / "pilot_machine_draft_summary.json").exists())


if __name__ == "__main__":
    unittest.main()
