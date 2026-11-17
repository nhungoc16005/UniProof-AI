import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
from analyze_ocr_pilot import align_characters


class OcrErrorAnalysisTests(unittest.TestCase):
    def test_counts_character_insertions_deletions_and_substitutions(self):
        result = align_characters("máy", "ma")

        self.assertEqual(result["distance"], 2)
        self.assertEqual(
            result["operations"],
            {"substitution": 1, "deletion": 1},
        )
        self.assertEqual(result["diacritic_only_substitutions"], 1)

    def test_reports_insertions_without_exposing_phrases(self):
        result = align_characters("ac", "abc")

        self.assertEqual(result["distance"], 1)
        self.assertEqual(result["operations"], {"insertion": 1})
        self.assertEqual(result["top_substitutions"], [])


if __name__ == "__main__":
    unittest.main()
