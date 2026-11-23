import io
import unittest
from unittest.mock import patch

import numpy as np
import pytesseract
from PIL import Image, ImageDraw, ImageFont

from src.ocr_extractor import (
    OcrExtractorService,
    configure_tesseract_environment,
    resolve_tesseract_cmd,
)


class VietnameseFieldParserTests(unittest.TestCase):
    def test_extracts_name_after_standalone_vietnamese_label(self):
        text = "SINH VIÊN:\nLê Thị Minh Châu\nCHI ĐOÀN: 49K30.02"

        self.assertEqual(
            OcrExtractorService._extract_name(text),
            "Lê Thị Minh Châu",
        )

    def test_extracts_student_code_after_ma_so_sinh_vien_label(self):
        text = "Mã số sinh viên: 102210001"

        self.assertEqual(
            OcrExtractorService._extract_student_code(text),
            "102210001",
        )

    def test_does_not_parse_chi_doan_line_as_student_name(self):
        text = (
            "GIẤY CHỨNG NHẬN\n"
            "Chi đoàn: 49K50.2 Liên Chi đoàn: Khoa Quản trị kinh doanh\n"
            "Đã tham gia cổ vũ Vòng Chung kết Cuộc thi học thuật"
        )

        self.assertIsNone(
            OcrExtractorService._extract_name(text, declared_name="Lê Thu Thu Trang")
        )


class OcrPreprocessingTests(unittest.TestCase):
    def test_creates_stable_grayscale_candidates_and_normalizes_exif_orientation(self):
        image = Image.new("RGB", (120, 80), "white")
        ImageDraw.Draw(image).text((8, 20), "Giấy chứng nhận", fill="black")
        image.getexif()[274] = 6

        candidates = OcrExtractorService._prepare_ocr_candidates(image)

        names = [name for name, _candidate in candidates]
        self.assertEqual(names[:2], ["original_gray", "contrast_upscaled"])
        self.assertIn("adaptive_threshold", names)
        self.assertEqual(candidates[0][1].size, (80, 120))
        self.assertTrue(all(candidate.mode == "L" for _, candidate in candidates))
        self.assertTrue(all(candidate.width > 0 and candidate.height > 0 for _, candidate in candidates))
        self.assertEqual(image.size, (120, 80), "preprocessing must not mutate its input")

    def test_adaptive_threshold_candidate_is_binary(self):
        image = Image.new("L", (120, 80), 235)
        draw = ImageDraw.Draw(image)
        draw.text((8, 20), "SINH VIEN", fill=15)

        candidates = dict(OcrExtractorService._prepare_ocr_candidates(image))
        threshold = np.asarray(candidates["adaptive_threshold"])

        self.assertEqual(set(np.unique(threshold)).issubset({0, 255}), True)


class TesseractCandidateTests(unittest.TestCase):
    @staticmethod
    def _data(lines):
        words = []
        confidences = []
        blocks = []
        paragraphs = []
        line_numbers = []
        for line_number, line, confidence in lines:
            for word in line.split():
                words.append(word)
                confidences.append(str(confidence))
                blocks.append("1")
                paragraphs.append("1")
                line_numbers.append(str(line_number))
        return {
            "text": words,
            "conf": confidences,
            "block_num": blocks,
            "par_num": paragraphs,
            "line_num": line_numbers,
        }

    def test_uses_three_vietnamese_psm_attempts_and_selects_highest_confidence(self):
        image = Image.new("RGB", (400, 160), "white")
        results = [
            self._data([(1, "SINH VIÊN:", 80), (2, "Lê Thị Minh Châu", 80)]),
            self._data([(1, "SINH VIÊN:", 94), (2, "Lê Thị Minh Châu", 94)]),
            self._data([(1, "SINH VIÊN:", 70), (2, "Lê Thị Minh Châu", 70)]),
        ]

        with patch("pytesseract.image_to_data", side_effect=results) as image_to_data:
            result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertEqual(result.text, "SINH VIÊN:\nLê Thị Minh Châu")
        self.assertEqual(result.confidence, 94.0)
        self.assertEqual(result.method, "contrast_upscaled:psm6")
        self.assertFalse(result.ambiguous)
        self.assertEqual(image_to_data.call_count, 3)
        self.assertEqual(
            [call.kwargs["lang"] for call in image_to_data.call_args_list],
            ["vie+eng"] * 3,
        )
        self.assertEqual(
            [call.kwargs["config"] for call in image_to_data.call_args_list],
            ["--oem 1 --psm 3", "--oem 1 --psm 6", "--oem 1 --psm 11"],
        )

    def test_reports_ambiguity_when_candidates_read_different_names(self):
        image = Image.new("RGB", (400, 160), "white")
        results = [
            self._data([(1, "SINH VIÊN: Lê Thị Minh Châu", 90)]),
            self._data([(1, "SINH VIÊN: Lê Thị Minh Chi", 94)]),
            pytesseract.TesseractError(1, "threshold candidate failed"),
        ]

        with patch("pytesseract.image_to_data", side_effect=results):
            result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertEqual(result.text, "SINH VIÊN: Lê Thị Minh Chi")
        self.assertTrue(result.ambiguous)

    def test_reports_ambiguity_when_candidates_read_different_student_codes(self):
        image = Image.new("RGB", (400, 160), "white")
        results = [
            self._data([(1, "MSSV: 102210001", 90)]),
            self._data([(1, "MSSV: 102210002", 94)]),
            pytesseract.TesseractError(1, "threshold candidate failed"),
        ]

        with patch("pytesseract.image_to_data", side_effect=results):
            result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertTrue(result.ambiguous)

    def test_missing_identity_field_in_one_candidate_is_not_ambiguous(self):
        image = Image.new("RGB", (400, 160), "white")
        results = [
            self._data([(1, "SINH VIÊN: Lê Thị Minh Châu", 90)]),
            self._data([(1, "GIẤY CHỨNG NHẬN", 94)]),
            pytesseract.TesseractError(1, "threshold candidate failed"),
        ]

        with patch("pytesseract.image_to_data", side_effect=results):
            result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertFalse(result.ambiguous)

    def test_candidate_error_does_not_discard_successful_recognition(self):
        image = Image.new("RGB", (400, 160), "white")
        results = [
            self._data([(1, "Giấy chứng nhận", 91)]),
            pytesseract.TesseractError(1, "contrast candidate failed"),
            pytesseract.TesseractError(1, "threshold candidate failed"),
        ]

        with patch("pytesseract.image_to_data", side_effect=results):
            result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertTrue(result.available)
        self.assertEqual(result.text, "Giấy chứng nhận")
        self.assertEqual(result.method, "original_gray:psm3")


class LocalVietnameseTesseractTests(unittest.TestCase):
    def test_reads_vietnamese_diacritics_with_local_tesseract(self):
        if not resolve_tesseract_cmd():
            self.skipTest("Tesseract executable is not installed")

        configure_tesseract_environment()
        languages = pytesseract.get_languages(config="")
        if not {"vie", "eng"}.issubset(languages):
            self.skipTest("Tesseract vie+eng language data is not installed")

        try:
            font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 64)
        except OSError:
            self.skipTest("Arial test font is not installed")

        image = Image.new("RGB", (1500, 300), "white")
        ImageDraw.Draw(image).text(
            (40, 80),
            "Chứng nhận sinh viên tình nguyện",
            font=font,
            fill="black",
        )

        result = OcrExtractorService._recognize_image(image, "vie+eng")

        self.assertTrue(result.available)
        self.assertIn("Chứng nhận sinh viên tình nguyện", result.text)
        self.assertIsNotNone(result.confidence)

    def test_full_extraction_parses_vietnamese_name_and_student_code(self):
        if not resolve_tesseract_cmd():
            self.skipTest("Tesseract executable is not installed")

        configure_tesseract_environment()
        languages = pytesseract.get_languages(config="")
        if not {"vie", "eng"}.issubset(languages):
            self.skipTest("Tesseract vie+eng language data is not installed")

        try:
            font = ImageFont.truetype(r"C:\Windows\Fonts\cour.ttf", 52)
        except OSError:
            self.skipTest("Courier New test font is not installed")

        image = Image.new("RGB", (1500, 500), "white")
        draw = ImageDraw.Draw(image)
        draw.text((40, 40), "GIẤY CHỨNG NHẬN", font=font, fill="black")
        draw.text((40, 145), "SINH VIÊN:", font=font, fill="black")
        draw.text((40, 215), "Lê Thị Minh Châu", font=font, fill="black")
        draw.text((40, 305), "Mã số sinh viên: 102210001", font=font, fill="black")
        output = io.BytesIO()
        image.save(output, format="PNG")

        result = OcrExtractorService.extract_and_parse(
            output.getvalue(),
            declared_name="Lê Thị Minh Châu",
            declared_student_code="102210001",
        )

        self.assertTrue(result.available)
        self.assertEqual(result.studentNameExtracted, "Lê Thị Minh Châu")
        self.assertEqual(result.studentCodeExtracted, "102210001")
        self.assertIn("Lê Thị Minh Châu", result.rawText)
        self.assertIn("102210001", result.rawText)


if __name__ == "__main__":
    unittest.main()
