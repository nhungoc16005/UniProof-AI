import io
import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw

from src.template_matcher import (
    TemplateMatcher,
    TemplateRegistry,
    _compute_phash,
    load_registry,
)


def certificate_image() -> bytes:
    image = Image.new("RGB", (800, 600), (240, 240, 240))
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 780, 580), outline=(0, 0, 0), width=5)
    draw.text((60, 100), "GIAY CHUNG NHAN", fill=(0, 0, 0))
    draw.text((60, 180), "DUT TEST 2026", fill=(0, 0, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _flip_all_bits(hex_hash: str) -> str:
    value = int(hex_hash, 16) ^ ((1 << 64) - 1)
    return f"{value:016x}"


class TemplateMatcherTests(unittest.TestCase):
    def setUp(self):
        self.image = certificate_image()
        self.image_phash = _compute_phash(self.image)
        if not self.image_phash:
            self.skipTest("Không tính được pHash của ảnh kiểm thử")

    def _registry(self, templates):
        return TemplateRegistry(templates=templates, hamming_max=10, aspect_tolerance=0.15)

    def test_empty_registry_is_unknown_and_not_green(self):
        registry = self._registry([])

        result = TemplateMatcher.match(self.image, "GIAY_KHEN", registry=registry)

        self.assertEqual(result.status, "UNKNOWN")
        self.assertIsNone(result.matchedTemplateId)
        self.assertEqual(result.confidence, 0.0)

    def test_matching_template_returns_match(self):
        registry = self._registry(
            [
                {
                    "templateId": "TPL-KHEN-2026",
                    "documentType": "GIAY_KHEN",
                    "pHash": self.image_phash,
                    "aspectRatio": 800 / 600,
                    "effectiveFrom": "2026-01-01",
                }
            ]
        )

        result = TemplateMatcher.match(self.image, "GIAY_KHEN", registry=registry)

        self.assertEqual(result.status, "MATCH")
        self.assertEqual(result.matchedTemplateId, "TPL-KHEN-2026")
        self.assertEqual(result.confidence, 100.0)

    def test_different_layout_returns_mismatch(self):
        registry = self._registry(
            [
                {
                    "templateId": "TPL-KHEN-2026",
                    "documentType": "GIAY_KHEN",
                    "pHash": _flip_all_bits(self.image_phash),
                    "aspectRatio": 800 / 600,
                }
            ]
        )

        result = TemplateMatcher.match(self.image, "GIAY_KHEN", registry=registry)

        self.assertEqual(result.status, "MISMATCH")
        self.assertEqual(result.matchedTemplateId, "TPL-KHEN-2026")
        self.assertLess(result.confidence, 100.0)

    def test_expired_template_is_ignored(self):
        registry = self._registry(
            [
                {
                    "templateId": "TPL-KHEN-2025",
                    "documentType": "GIAY_KHEN",
                    "pHash": self.image_phash,
                    "aspectRatio": 800 / 600,
                    "effectiveFrom": "2025-01-01",
                    "effectiveTo": (date.today() - timedelta(days=1)).isoformat(),
                }
            ]
        )

        result = TemplateMatcher.match(self.image, "GIAY_KHEN", registry=registry)

        self.assertEqual(result.status, "UNKNOWN")

    def test_template_of_other_document_type_is_ignored(self):
        registry = self._registry(
            [
                {
                    "templateId": "TPL-GIAY-XACNHAN-2026",
                    "documentType": "GIAY_XAC_NHAN",
                    "pHash": self.image_phash,
                    "aspectRatio": 800 / 600,
                }
            ]
        )

        result = TemplateMatcher.match(self.image, "GIAY_KHEN", registry=registry)

        self.assertEqual(result.status, "UNKNOWN")

    def test_load_registry_missing_file_returns_empty_registry(self):
        with tempfile.TemporaryDirectory() as temporary:
            missing = Path(temporary) / "khong-ton-tai.json"

            registry = load_registry(missing)

        self.assertEqual(registry.templates, [])
        self.assertEqual(
            registry.match(self.image, "GIAY_KHEN").status,
            "UNKNOWN",
        )

    def test_load_registry_reads_templates_from_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "registry.json"
            path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "templates": [
                            {
                                "templateId": "TPL-KHEN-2026",
                                "documentType": "GIAY_KHEN",
                                "pHash": self.image_phash,
                                "aspectRatio": 800 / 600,
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            registry = load_registry(path)

        self.assertEqual(len(registry.templates), 1)
        self.assertEqual(
            registry.match(self.image, "GIAY_KHEN").status,
            "MATCH",
        )


if __name__ == "__main__":
    unittest.main()
