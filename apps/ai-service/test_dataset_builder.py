import sys
import tempfile
import unittest
import unicodedata
from unittest import mock
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
from build_evidence_dataset import build_dataset, redact_ocr_text, select_pilot_samples


class DatasetBuilderTests(unittest.TestCase):
    def test_redacts_labeled_identifiers_and_standalone_person_names(self):
        source = (
            "Ho va ten: Nguyen Van An\n"
            "MSSV: 102210001\n"
            "nguyen.an@example.edu\n"
            "Dinh Nguyen Thai Binh\n"
            "GIAY CHUNG NHAN\n"
        )

        result, flags = redact_ocr_text(source)

        self.assertNotIn("Nguyen Van An", result)
        self.assertNotIn("102210001", result)
        self.assertNotIn("nguyen.an@example.edu", result)
        self.assertNotIn("Dinh Nguyen Thai Binh", result)
        self.assertIn("GIAY CHUNG NHAN", result)
        self.assertTrue(flags)

    def test_redacts_entire_name_field_line_and_extracted_values(self):
        source = (
            "Họ và tên: Nguyen Van An followed by additional field details "
            "that extend beyond a typical OCR line length\n"
            "Sinh viên: Tran Thi Binh\n"
            "Participant: Nguyen Van An\n"
            "Participant ID: 102210001\n"
            "MSSV: A1\n"
        )

        result, flags = redact_ocr_text(
            source,
            extracted_names=("Nguyen Van An",),
            extracted_identifiers=("102210001",),
        )

        self.assertNotIn("Nguyen Van An", result)
        self.assertNotIn("Tran Thi Binh", result)
        self.assertNotIn("102210001", result)
        self.assertNotIn("MSSV: A1", result)
        self.assertIn("[REDACTED_NAME]", result)
        self.assertIn("extracted_name", flags)
        self.assertIn("extracted_identifier", flags)
        self.assertIn("normalized_identifier_label", flags)

    def test_redacts_decomposed_unicode_name_labels(self):
        source = unicodedata.normalize("NFD", "Họ và tên: Nguyen Van An")

        result, flags = redact_ocr_text(source)

        self.assertNotIn("Nguyen Van An", result)
        self.assertIn("normalized_name_label", flags)

    def test_builds_pseudonymous_manifest_and_empty_annotation_rows(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            output = root / "dataset"
            source.mkdir()
            image = Image.new("RGB", (240, 120), "white")
            ImageDraw.Draw(image).text((10, 10), "GIAY CHUNG NHAN", fill="black")
            image.save(source / "private-name.png")

            with mock.patch(
                "build_evidence_dataset.OcrExtractorService.extract_and_parse",
                return_value=type(
                    "Ocr",
                    (),
                    {
                        "rawText": "GIAY CHUNG NHAN",
                        "available": True,
                        "errorDetails": None,
                        "studentNameExtracted": None,
                        "studentCodeExtracted": None,
                        "bloodDonation": None,
                    },
                )(),
            ), mock.patch(
                "build_evidence_dataset.QualityAndForensicsService.inspect_quality",
                return_value=type(
                    "Quality",
                    (),
                    {
                        "passed": True,
                        "blurScore": 123.0,
                        "brightness": 190.0,
                        "skewAngle": 0.0,
                        "errorDetails": None,
                    },
                )(),
            ):
                summary = build_dataset(source, output)

            manifest = (output / "manifest.jsonl").read_text(encoding="utf-8")
            annotations = (output / "annotations.csv").read_text(encoding="utf-8-sig")
            self.assertEqual(summary["sample_count"], 1)
            self.assertEqual(summary["pilot_sample_count"], 1)
            self.assertNotIn("private-name.png", manifest)
            self.assertIn('"quality_status": "PASS"', manifest)
            self.assertIn('"ocr_available": true', manifest)
            self.assertIn('"labels": null', manifest)
            self.assertIn("expected_transcription", annotations)
            self.assertIn("document_type", annotations)
            self.assertIn("annotation_status", annotations)
            self.assertTrue((output / "pilot_annotations.csv").exists())
            self.assertTrue((output / "pilot_source_map.csv").exists())
            self.assertTrue((output / "PILOT_README.md").exists())
            self.assertIn("training_ready", (output / "summary.json").read_text(encoding="utf-8"))

    def test_pilot_selection_covers_pdf_reviews_duplicates_and_file_types(self):
        records = []
        for index in range(27):
            records.append({
                "sample_id": f"id-{index:02}",
                "file_type": "pdf" if index == 0 else ("png" if index % 2 else "jpg"),
                "quality_status": "REVIEW" if 1 <= index <= 7 else "PASS",
                "sha256": f"hash-{index // 2}" if index in (8, 9) else f"hash-{index}",
            })

        selected = select_pilot_samples(records, size=20)

        self.assertEqual(len(selected), 20)
        self.assertIn("pdf", {record["file_type"] for record in selected})
        self.assertIn("jpg", {record["file_type"] for record in selected})
        self.assertIn("png", {record["file_type"] for record in selected})
        self.assertTrue(any(record["quality_status"] == "REVIEW" for record in selected))
        hashes = [record["sha256"] for record in selected]
        self.assertEqual(sum(count > 1 for count in (hashes.count(value) for value in set(hashes))), 1)
        self.assertEqual(max(hashes.count(value) for value in set(hashes)), 2)


if __name__ == "__main__":
    unittest.main()
