import base64
import io
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw

from src.schemas import OcrCompareRequest
from src.vietnamese_ocr_engine import OcrTextBox, reconstruct_layout_lines


class LayoutReconstructionTests(unittest.TestCase):
    def test_reconstructs_same_row_left_to_right_and_orders_rows_top_to_bottom(self):
        boxes = [
            OcrTextBox(text="102230027", confidence=98.0, bbox=(180, 120, 320, 150)),
            OcrTextBox(text="Nguyễn Văn A", confidence=96.5, bbox=(180, 62, 360, 92)),
            OcrTextBox(text="Họ và tên:", confidence=97.0, bbox=(20, 60, 160, 90)),
            OcrTextBox(text="MSSV:", confidence=99.0, bbox=(20, 118, 120, 148)),
        ]
        result = reconstruct_layout_lines(boxes)
        self.assertEqual(
            result,
            "Họ và tên:  Nguyễn Văn A\nMSSV:  102230027",
        )

    def test_empty_boxes_returns_empty_string(self):
        self.assertEqual(reconstruct_layout_lines([]), "")


class CompareEndpointSchemaTests(unittest.TestCase):
    def test_compare_request_defaults_to_tesseract_and_rapidocr_vietocr(self):
        image = Image.new("RGB", (100, 40), "white")
        ImageDraw.Draw(image).text((5, 5), "DUT", fill="black")
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        req = OcrCompareRequest(fileBytesBase64=b64)
        self.assertEqual(req.engines, ["tesseract", "rapidocr_vietocr"])

    def test_extracts_vietnamese_uppercase_name_and_english_certificate_name_and_date(self):
        from src.ocr_extractor import OcrExtractorService

        vn_cert = (
            "MẠNG LƯỚI TÌNH NGUYỆN QUỐC GIA MIỀN NAM\n"
            "GIẤY CHỨNG NHẬN\n"
            "Chứng nhận Tình nguyện viên Online Mùa Hè Xanh\n"
            "NGUYỄN THỊ THÙY LINH\n"
            "TRƯỜNG ĐẠI HỌC KINH TẾ - ĐẠI HỌC ĐÀ NẴNG"
        )
        self.assertEqual(OcrExtractorService._extract_name(vn_cert), "NGUYỄN THỊ THÙY LINH")

        en_cert = (
            "CERTIFICATE of Participation\n"
            "This is to certify that\n"
            "Trần Đức Long\n"
            "has participated in the Da Nang Code League 2024\n"
            "08?Jun 2024"
        )
        self.assertEqual(OcrExtractorService._extract_name(en_cert), "Trần Đức Long")
        self.assertEqual(OcrExtractorService._extract_date(en_cert), "2024-06-08")


if __name__ == "__main__":
    unittest.main()
