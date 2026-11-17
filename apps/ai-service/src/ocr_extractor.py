import io
import os
import re
import shutil
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

from PIL import Image, ImageEnhance, ImageOps

from .config import settings
from .schemas import BloodDonationData, EvidenceType, OcrExtractionResult


@dataclass(frozen=True)
class _RecognitionResult:
    text: str
    available: bool
    error: Optional[str] = None
    confidence: Optional[float] = None
    method: Optional[str] = None
    ambiguous: bool = False
    word_count: int = 0


_TESSERACT_CANDIDATES = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
)


def resolve_tesseract_cmd() -> Optional[str]:
    """Tìm tesseract.exe ngay cả khi Tesseract không nằm trên PATH."""
    configured = os.getenv("TESSERACT_CMD")
    if configured and Path(configured).exists():
        return configured
    found = shutil.which("tesseract")
    if found:
        return found
    local_app_data = os.getenv("LOCALAPPDATA")
    candidates = list(_TESSERACT_CANDIDATES)
    if local_app_data:
        candidates.append(str(Path(local_app_data) / "Programs" / "Tesseract-OCR" / "tesseract.exe"))
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def resolve_tessdata_dir() -> Optional[str]:
    """Ưu tiên thư mục tessdata cấu hình qua env, sau đó thư mục tessdata của dự án."""
    configured = os.getenv("TESSERACT_TESSDATA_DIR")
    if configured and Path(configured).is_dir():
        return configured
    project_tessdata = Path(__file__).resolve().parent.parent / "tessdata"
    if project_tessdata.is_dir():
        return str(project_tessdata)
    return None


def configure_tesseract_environment() -> None:
    """Cấu hình pytesseract trỏ đúng tesseract.exe và tessdata (gồm gói vie+eng)."""
    try:
        import pytesseract
    except ImportError:
        return
    tesseract_cmd = resolve_tesseract_cmd()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    tessdata_dir = resolve_tessdata_dir()
    if tessdata_dir and not os.getenv("TESSDATA_PREFIX"):
        os.environ["TESSDATA_PREFIX"] = tessdata_dir


class OcrExtractorService:
    @staticmethod
    def _prepare_ocr_candidates(image: Image.Image) -> list[tuple[str, Image.Image]]:
        """Create bounded OCR variants without changing the caller's image."""
        normalized = ImageOps.exif_transpose(image).convert("L")
        original = normalized.copy()

        max_dimension = max(normalized.size)
        scale = max(1.0, min(2.0, 2400.0 / max_dimension))
        scaled_size = (
            max(1, round(normalized.width * scale)),
            max(1, round(normalized.height * scale)),
        )
        contrast = ImageOps.autocontrast(normalized)
        contrast = ImageEnhance.Contrast(contrast).enhance(1.35)
        contrast = contrast.resize(scaled_size, Image.Resampling.LANCZOS)
        candidates = [
            ("original_gray", original),
            ("contrast_upscaled", contrast),
        ]

        try:
            import cv2
            import numpy as np

            pixels = np.asarray(contrast)
            minimum_dimension = min(pixels.shape)
            block_size = min(31, minimum_dimension if minimum_dimension % 2 else minimum_dimension - 1)
            if block_size >= 3:
                threshold = cv2.adaptiveThreshold(
                    pixels,
                    255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY,
                    block_size,
                    11,
                )
                candidates.append(("adaptive_threshold", Image.fromarray(threshold, mode="L")))
        except ImportError:
            pass
        return candidates

    @staticmethod
    def extract_and_parse(
        file_bytes: bytes,
        evidence_type: str = EvidenceType.GIAY_KHEN.value,
        declared_name: Optional[str] = None,
        declared_student_code: Optional[str] = None,
        declared_activity_name: Optional[str] = None,
        declared_citizen_id: Optional[str] = None,
    ) -> OcrExtractionResult:
        recognition = OcrExtractorService._extract_text_detailed(file_bytes)
        return OcrExtractorService.parse_text(
            recognition.text,
            recognition.available,
            recognition.error,
            evidence_type,
            declared_name,
            declared_student_code,
            declared_activity_name,
            declared_citizen_id,
            recognition_confidence=recognition.confidence,
            recognition_method=recognition.method,
            recognition_ambiguous=recognition.ambiguous,
        )

    @staticmethod
    def extract_and_parse_many(
        files: list[bytes],
        evidence_type: str = EvidenceType.GIAY_KHEN.value,
        declared_name: Optional[str] = None,
        declared_student_code: Optional[str] = None,
        declared_activity_name: Optional[str] = None,
        declared_citizen_id: Optional[str] = None,
    ) -> OcrExtractionResult:
        """OCR mọi tệp đính kèm, gộp văn bản rồi trích xuất một lần.

        Đảm bảo không bỏ sót nội dung nằm ở tệp thứ hai trở đi (P0-B).
        """
        recognitions: list[_RecognitionResult] = []
        for file_bytes in files:
            recognitions.append(OcrExtractorService._extract_text_detailed(file_bytes))
        texts = [result.text for result in recognitions if result.available and result.text]
        merged = "\n".join(texts).strip()
        if not texts:
            any_available = any(result.available for result in recognitions)
            return OcrExtractionResult(
                rawText="",
                available=any_available,
                errorDetails=next(
                    (
                        result.error
                        for result in recognitions
                        if result.error
                    ),
                    "OCR không đọc được nội dung từ các tệp minh chứng.",
                ),
            )
        confidence_samples = [
            (result.confidence, result.word_count)
            for result in recognitions
            if result.confidence is not None and result.word_count
        ]
        total_words = sum(count for _confidence, count in confidence_samples)
        confidence = (
            round(sum(value * count for value, count in confidence_samples) / total_words, 1)
            if total_words
            else None
        )
        methods = [result.method for result in recognitions if result.method]
        ambiguous = (
            any(result.ambiguous for result in recognitions)
            or OcrExtractorService._fields_disagree(texts)
        )
        return OcrExtractorService.parse_text(
            merged,
            True,
            None,
            evidence_type,
            declared_name,
            declared_student_code,
            declared_activity_name,
            declared_citizen_id,
            recognition_confidence=confidence,
            recognition_method=";".join(dict.fromkeys(methods)) or None,
            recognition_ambiguous=ambiguous,
        )

    @staticmethod
    def parse_text(
        raw_text: str,
        available: bool,
        error: Optional[str],
        evidence_type: str = EvidenceType.GIAY_KHEN.value,
        declared_name: Optional[str] = None,
        declared_student_code: Optional[str] = None,
        declared_activity_name: Optional[str] = None,
        declared_citizen_id: Optional[str] = None,
        recognition_confidence: Optional[float] = None,
        recognition_method: Optional[str] = None,
        recognition_ambiguous: bool = False,
    ) -> OcrExtractionResult:
        student_name = OcrExtractorService._extract_name(raw_text, declared_name)
        student_code = OcrExtractorService._extract_student_code(raw_text)
        blood_data = None
        if evidence_type == EvidenceType.GIAY_HIEN_MAU.value or "hiến máu" in raw_text.lower():
            blood_data = OcrExtractorService._extract_blood_donation_data(raw_text)

        name_ratio = 0.0
        if declared_name and student_name:
            name_ratio = round(
                SequenceMatcher(
                    None,
                    OcrExtractorService._normalize(declared_name),
                    OcrExtractorService._normalize(student_name),
                ).ratio()
                * 100,
                1,
            )

        code_matched = bool(
            declared_student_code
            and student_code
            and declared_student_code.strip() == student_code.strip()
        )
        code_mismatch = bool(
            declared_student_code
            and student_code
            and declared_student_code.strip() != student_code.strip()
        )

        # Activity name match
        ocr_activity_name = OcrExtractorService._extract_activity_name(raw_text)
        activity_name_ratio = 0.0
        activity_name_mismatch = False
        if declared_activity_name and ocr_activity_name:
            activity_name_ratio = round(
                SequenceMatcher(
                    None,
                    OcrExtractorService._normalize(declared_activity_name),
                    OcrExtractorService._normalize(ocr_activity_name),
                ).ratio()
                * 100,
                1,
            )
            activity_name_mismatch = activity_name_ratio < 50

        # CCCD verification for blood donation
        citizen_id_matched: Optional[bool] = None
        citizen_id_extracted: Optional[str] = None
        if blood_data and blood_data.citizenId:
            citizen_id_extracted = blood_data.citizenId
            if declared_citizen_id:
                citizen_id_matched = declared_citizen_id.strip() == blood_data.citizenId.strip()

        return OcrExtractionResult(
            rawText=raw_text,
            available=available,
            errorDetails=error,
            studentNameExtracted=student_name,
            studentCodeExtracted=student_code,
            activityNameExtracted=ocr_activity_name,
            organizerExtracted=OcrExtractorService._extract_organizer(raw_text),
            issuedDateExtracted=OcrExtractorService._extract_date(raw_text),
            certificateNumber=OcrExtractorService._extract_cert_number(raw_text),
            bloodDonation=blood_data,
            nameMatchRatio=name_ratio,
            codeMatched=code_matched,
            codeMismatch=code_mismatch,
            activityNameMatchRatio=activity_name_ratio,
            activityNameMismatch=activity_name_mismatch,
            citizenIdMatched=citizen_id_matched,
            citizenIdExtracted=citizen_id_extracted,
            recognitionConfidence=recognition_confidence,
            recognitionMethod=recognition_method,
            recognitionAmbiguous=recognition_ambiguous,
        )

    @staticmethod
    def _extract_text(file_bytes: bytes) -> tuple[str, bool, Optional[str]]:
        result = OcrExtractorService._extract_text_detailed(file_bytes)
        return result.text, result.available, result.error

    @staticmethod
    def _extract_text_detailed(file_bytes: bytes) -> _RecognitionResult:
        images: list[Image.Image] = []
        if file_bytes.startswith(b"%PDF"):
            try:
                import fitz
            except ImportError:
                return _RecognitionResult("", False, "Chưa cài PyMuPDF để đọc tệp PDF.")
            try:
                document: Any = fitz.open(stream=file_bytes, filetype="pdf")
                max_pages = int(__import__("os").getenv("OCR_PDF_MAX_PAGES", "20"))
                pages = [document.load_page(index) for index in range(min(document.page_count, max_pages))]
                pdf_text = "\n".join(str(page.get_text()) for page in pages).strip()
                if pdf_text:
                    return _RecognitionResult(
                        pdf_text,
                        True,
                        method="pdf_text_layer",
                        word_count=len(pdf_text.split()),
                    )
                images = []
                for page in pages:
                    image_data = page.get_pixmap(
                            matrix=fitz.Matrix(2, 2),
                            alpha=False,
                    ).tobytes("png")
                    images.append(Image.open(io.BytesIO(image_data)))
            except Exception as error:
                return _RecognitionResult("", False, f"Không đọc được PDF: {error}")
        else:
            try:
                images = [Image.open(io.BytesIO(file_bytes))]
            except Exception as error:
                return _RecognitionResult("", False, f"Không đọc được ảnh: {error}")

        try:
            import pytesseract  # noqa: F401
        except ImportError:
            return _RecognitionResult(
                "",
                False,
                "Chưa cài pytesseract và Tesseract OCR; không thể trích xuất văn bản.",
            )

        configure_tesseract_environment()
        language = os.getenv("TESSERACT_LANGUAGES", "vie+eng")
        results = [
            OcrExtractorService._recognize_image(image, language)
            for image in images
        ]
        text_results = [result for result in results if result.available and result.text]
        if not text_results:
            if any(result.available for result in results):
                return _RecognitionResult(
                    "",
                    True,
                    "OCR đã chạy nhưng không tìm thấy văn bản đọc được.",
                )
            error = next(
                (result.error for result in results if result.error),
                "Không tìm thấy chương trình Tesseract OCR trên máy chủ.",
            )
            return _RecognitionResult("", False, error)

        word_count = sum(result.word_count for result in text_results)
        confidence_results = [
            result for result in text_results
            if result.confidence is not None and result.word_count
        ]
        confidence = (
            round(
                sum(result.confidence * result.word_count for result in confidence_results)
                / sum(result.word_count for result in confidence_results),
                1,
            )
            if confidence_results
            else None
        )
        texts = [result.text for result in text_results]
        methods = [result.method for result in text_results if result.method]
        return _RecognitionResult(
            text="\n".join(texts).strip(),
            available=True,
            confidence=confidence,
            method=";".join(dict.fromkeys(methods)) or None,
            ambiguous=(
                any(result.ambiguous for result in text_results)
                or OcrExtractorService._fields_disagree(texts)
            ),
            word_count=word_count,
        )

    @staticmethod
    def _recognize_image(image: Image.Image, language: str) -> _RecognitionResult:
        import pytesseract

        attempts = (
            ("original_gray", 3),
            ("contrast_upscaled", 6),
            ("adaptive_threshold", 11),
        )
        prepared = dict(OcrExtractorService._prepare_ocr_candidates(image))
        successful: list[tuple[str, int, str, float, int]] = []
        errors: list[str] = []
        invoked = False

        for candidate_name, page_mode in attempts:
            candidate = prepared.get(candidate_name)
            if candidate is None:
                continue
            try:
                data = pytesseract.image_to_data(
                    candidate,
                    lang=language,
                    config=f"--oem 1 --psm {page_mode}",
                    output_type=pytesseract.Output.DICT,
                    timeout=settings.TESSERACT_TIMEOUT_SECONDS,
                )
                invoked = True
            except pytesseract.TesseractNotFoundError:
                errors.append("Không tìm thấy chương trình Tesseract OCR trên máy chủ.")
                continue
            except pytesseract.TesseractError as error:
                errors.append(f"Tesseract OCR lỗi: {error}")
                continue
            except RuntimeError as error:
                errors.append(
                    "OCR quá thời gian xử lý; cán bộ cần kiểm tra trực tiếp tệp minh chứng."
                    if "timeout" in str(error).lower()
                    else "OCR gặp lỗi khi xử lý tệp; cán bộ cần kiểm tra trực tiếp tệp minh chứng."
                )
                continue

            words = [str(value).strip() for value in data.get("text", [])]
            confidences = data.get("conf", [])
            block_numbers = data.get("block_num", [])
            paragraph_numbers = data.get("par_num", [])
            line_numbers = data.get("line_num", [])
            lines: dict[tuple[str, str, str], list[str]] = {}
            valid_confidences: list[float] = []
            word_count = 0
            for index, word in enumerate(words):
                if not word:
                    continue
                word_count += 1
                block = str(block_numbers[index]) if index < len(block_numbers) else "1"
                paragraph = str(paragraph_numbers[index]) if index < len(paragraph_numbers) else "1"
                line = str(line_numbers[index]) if index < len(line_numbers) else "1"
                lines.setdefault((block, paragraph, line), []).append(word)
                if index < len(confidences):
                    try:
                        confidence = float(confidences[index])
                    except (TypeError, ValueError):
                        continue
                    if confidence >= 0:
                        valid_confidences.append(confidence)
            text = "\n".join(" ".join(line_words) for line_words in lines.values()).strip()
            if text:
                mean_confidence = (
                    sum(valid_confidences) / len(valid_confidences)
                    if valid_confidences
                    else 0.0
                )
                successful.append((
                    candidate_name,
                    page_mode,
                    text,
                    mean_confidence,
                    word_count,
                ))

        if not successful:
            if invoked:
                return _RecognitionResult(
                    "",
                    True,
                    "OCR đã chạy nhưng không tìm thấy văn bản đọc được.",
                )
            return _RecognitionResult(
                "",
                False,
                errors[0] if errors else "Không có candidate OCR khả dụng.",
            )

        selected = max(successful, key=lambda result: result[3])
        names = {
            name
            for _candidate, _page_mode, text, _confidence, _count in successful
            if (name := OcrExtractorService._extract_name(text))
        }
        student_codes = {
            code
            for _candidate, _page_mode, text, _confidence, _count in successful
            if (code := OcrExtractorService._extract_student_code(text))
        }
        return _RecognitionResult(
            text=selected[2],
            available=True,
            confidence=round(selected[3], 1),
            method=f"{selected[0]}:psm{selected[1]}",
            ambiguous=len(names) > 1 or len(student_codes) > 1,
            word_count=selected[4],
        )

    @staticmethod
    def _fields_disagree(texts: list[str]) -> bool:
        names = {
            name
            for text in texts
            if (name := OcrExtractorService._extract_name(text))
        }
        student_codes = {
            code
            for text in texts
            if (code := OcrExtractorService._extract_student_code(text))
        }
        return len(names) > 1 or len(student_codes) > 1

    @staticmethod
    def _normalize(value: str) -> str:
        decomposed = unicodedata.normalize("NFD", value.casefold())
        return re.sub(r"[^a-z0-9]", "", "".join(c for c in decomposed if unicodedata.category(c) != "Mn"))

    @staticmethod
    def _extract_name(text: str, declared_name: Optional[str] = None) -> Optional[str]:
        patterns = (
            r"(?:họ\s*và\s*tên|họ\s*tên|sinh\s*viên|người\s*hiến|"
            r"ho\s*va\s*ten|ho\s*ten|sinh\s*vien|nguoi\s*hien)"
            r"\s*[:\-]\s*(.+?)(?=\s+(?:mssv|mã\s*sinh\s*viên|ma\s*sinh\s*vien|cccd|cmnd)\s*[:\-]|\n|$)",
            r"(?:chứng nhận|tặng)[ \t]+(?:sinh viên[ \t]+)?([^\n,;]{5,60})",
        )
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = re.sub(r"\s+", " ", match.group(1)).strip(" :-")
                if len(candidate.split()) >= 2:
                    return candidate
        if declared_name:
            expected = OcrExtractorService._normalize(declared_name)
            candidates = [
                re.sub(r"\s+", " ", line).strip(" :-")
                for line in text.splitlines()
                if len(line.split()) >= 2 and len(line.strip()) <= 80
            ]
            matches = [
                (SequenceMatcher(None, expected, OcrExtractorService._normalize(candidate)).ratio(), candidate)
                for candidate in candidates
            ]
            if matches:
                ratio, candidate = max(matches, key=lambda match: match[0])
                if ratio >= 0.75:
                    return candidate
        return None

    @staticmethod
    def _extract_student_code(text: str) -> Optional[str]:
        match = re.search(
            r"(?:MSSV|Mã\s*(?:sinh\s*viên|số\s*(?:SV|sinh\s*viên))|"
            r"Ma\s*(?:sinh\s*vien|so\s*(?:SV|sinh\s*vien))|Student\s*ID)"
            r"\s*[:.]?\s*(\d{8,12})",
            text,
            re.IGNORECASE,
        )
        return match.group(1) if match else None

    @staticmethod
    def _extract_activity_name(text: str) -> Optional[str]:
        field_match = re.search(
            r"(?:tên\s*(?:hoạt động|sự kiện|chương trình)|hoạt động|sự kiện|"
            r"ten\s*(?:hoat dong|su kien|chuong trinh)|hoat dong|su kien)"
            r"\s*[:\-]\s*([^\n.;]{5,120})",
            text,
            re.IGNORECASE,
        )
        if field_match:
            return field_match.group(1).strip()

        activity_match = re.search(
            r"\b(?:chương trình|chuong trinh|cuộc thi|cuoc thi|hội thi|hoi thi|"
            r"ngày hội|ngay hoi|chiến dịch|chien dich|giải thưởng|giai thuong)"
            r"\s+[^\n.;]{4,120}",
            text,
            re.IGNORECASE,
        )
        return activity_match.group(0).strip() if activity_match else None

    @staticmethod
    def _extract_organizer(text: str) -> Optional[str]:
        match = re.search(
            r"(?:đơn vị tổ chức|ban tổ chức|trường đại học|đoàn trường|hội sinh viên)\s*[:\-]?\s*([^\n]{3,100})",
            text,
            re.IGNORECASE,
        )
        return match.group(0).strip() if match else None

    @staticmethod
    def _extract_date(text: str) -> Optional[str]:
        decomposed = unicodedata.normalize("NFD", text.casefold())
        normalized = "".join(
            character
            for character in decomposed
            if unicodedata.category(character) != "Mn"
        ).replace("đ", "d")
        match = re.search(
            r"(?:ngay\s*)?(\d{1,2})\s*(?:[/.-]|thang\s*)(\d{1,2})\s*(?:[/.-]|nam\s*)(\d{4})",
            normalized,
            re.IGNORECASE,
        )
        if not match:
            return None
        day, month, year = (int(value) for value in match.groups())
        try:
            from datetime import date
            return date(year, month, day).isoformat()
        except ValueError:
            return None

    @staticmethod
    def _extract_cert_number(text: str) -> Optional[str]:
        match = re.search(r"(?:số\s*(?:QĐ|quyết định)?|QĐ)\s*[:.]?\s*([A-Za-z0-9/-]{3,30})", text, re.IGNORECASE)
        return match.group(1).strip() if match else None

    @staticmethod
    def _extract_blood_donation_data(text: str) -> BloodDonationData:
        volume_match = re.search(r"\b(250|350|450)\s*(?:ml|mL)\b", text)
        citizen_match = re.search(r"(?:CCCD|CMND|Số định danh)\s*[:.]?\s*(\d{9,12})", text, re.IGNORECASE)
        birth_match = re.search(r"(?:Ngày sinh|Sinh ngày)\s*[:.]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", text, re.IGNORECASE)
        donation_match = re.search(r"(?:Ngày hiến|Hiến ngày)\s*[:.]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", text, re.IGNORECASE)
        return BloodDonationData(
            bloodVolumeMl=int(volume_match.group(1)) if volume_match else None,
            citizenId=citizen_match.group(1) if citizen_match else None,
            birthDate=birth_match.group(1) if birth_match else None,
            donationDate=donation_match.group(1) if donation_match else None,
        )
