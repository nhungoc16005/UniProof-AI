import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))

from validate_annotations import REQUIRED_WHEN_COMPLETE, validate_annotations

HEADER = [
    "sample_id",
    "document_type",
    "expected_activity_name",
    "expected_issuer",
    "expected_issue_date",
    "expected_student_name_match",
    "expected_student_code_match",
    "expected_term_match",
    "validity_label",
    "quality_label",
    "template_match_label",
    "suspected_tampering_label",
    "duplicate_review_label",
    "human_review_decision",
    "annotation_status",
]


def complete_row(sample_id: str) -> dict[str, str]:
    row = {field: "unknown" for field in HEADER}
    row.update({
        "sample_id": sample_id,
        "document_type": "GIAY_CHUNG_NHAN",
        "expected_student_name_match": "matched",
        "expected_student_code_match": "unmatched",
        "validity_label": "unclear",
        "quality_label": "pass",
        "template_match_label": "unknown",
        "suspected_tampering_label": "unclear",
        "duplicate_review_label": "none",
        "human_review_decision": "escalate",
        "annotation_status": "complete",
    })
    for field in REQUIRED_WHEN_COMPLETE:
        row.setdefault(field, "unknown")
    return row


class ValidateAnnotationsTests(unittest.TestCase):
    def _setup(self, annotations: list[dict], manifest: list[dict]) -> Path:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        dataset = Path(temporary.name)
        (dataset / "manifest.jsonl").write_text(
            "\n".join(json.dumps(record) for record in manifest) + "\n",
            encoding="utf-8",
        )
        with (dataset / "annotations.csv").open("w", encoding="utf-8-sig", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=HEADER, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(annotations)
        return dataset

    def test_valid_annotations_pass(self):
        dataset = self._setup(
            [complete_row("s1"), complete_row("s2")],
            [
                {"sample_id": "s1", "sha256": "aaa", "duplicate_group": "aaa", "split": "train"},
                {"sample_id": "s2", "sha256": "bbb", "duplicate_group": "bbb", "split": "train"},
            ],
        )

        report = validate_annotations(dataset)

        self.assertTrue(report["valid"])
        self.assertEqual(report["violationCount"], 0)
        self.assertEqual(report["completeSamples"], 2)

    def test_invalid_enum_is_reported(self):
        row = complete_row("s1")
        row["validity_label"] = "maybe"
        dataset = self._setup(
            [row],
            [{"sample_id": "s1", "sha256": "aaa", "duplicate_group": "aaa", "split": "train"}],
        )

        report = validate_annotations(dataset)

        self.assertFalse(report["valid"])
        self.assertTrue(any(v["type"] == "invalid_enum" for v in report["violations"]))

    def test_missing_required_field_when_complete_is_reported(self):
        row = complete_row("s1")
        row["template_match_label"] = ""
        dataset = self._setup(
            [row],
            [{"sample_id": "s1", "sha256": "aaa", "duplicate_group": "aaa", "split": "train"}],
        )

        report = validate_annotations(dataset)

        self.assertFalse(report["valid"])
        self.assertTrue(any(
            v["type"] == "missing_required_field" and v.get("field") == "template_match_label"
            for v in report["violations"]
        ))

    def test_duplicate_group_across_splits_is_reported(self):
        dataset = self._setup(
            [complete_row("s1"), complete_row("s2")],
            [
                {"sample_id": "s1", "sha256": "same", "duplicate_group": "same", "split": "train"},
                {"sample_id": "s2", "sha256": "same", "duplicate_group": "same", "split": "test"},
            ],
        )

        report = validate_annotations(dataset)

        self.assertFalse(report["valid"])
        self.assertTrue(any(v["type"] == "duplicate_group_split_leak" for v in report["violations"]))

    def test_incomplete_rows_are_listed_without_violation(self):
        dataset = self._setup(
            [{"sample_id": "s1", "annotation_status": "needs_review"}],
            [{"sample_id": "s1", "sha256": "aaa", "duplicate_group": "aaa", "split": "train"}],
        )

        report = validate_annotations(dataset)

        self.assertTrue(report["valid"])
        self.assertEqual(report["incompleteSampleIds"], ["s1"])


if __name__ == "__main__":
    unittest.main()
