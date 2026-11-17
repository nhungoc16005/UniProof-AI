# ==============================================================================
# QUÉT MÃ QR TRÊN CHỨNG NHẬN & TRA CỨU ĐƯỜNG DẪN XÁC MINH CÔNG KHAI
# Luồng: đọc QR (nếu có) -> lấy URL tra cứu -> mở trang -> đối chiếu thông tin khai báo
# ==============================================================================

import io
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

try:
    import cv2
except ImportError:
    cv2 = None

import numpy as np
from PIL import Image

from .schemas import QrVerificationResult


class QrVerifierService:
    ACCEPT_THRESHOLD = 0.55   # ngưỡng coi là khớp hoạt động khai báo
    MATCH_BOOST = 15          # điểm cộng khi trang trong QR khớp thông tin khai báo

    @staticmethod
    def decode(image_bytes: bytes) -> Optional[str]:
        """Đọc nội dung mã QR trên ảnh. Trả về None nếu không có mã hoặc chưa cài OpenCV."""
        if cv2 is None:
            return None
        try:
            with Image.open(io.BytesIO(image_bytes)) as image:
                rgb = np.array(image.convert("RGB"))
        except Exception:
            return None
        bgr = rgb[:, :, ::-1]
        try:
            data, _points, _ = cv2.QRCodeDetector().detectAndDecode(bgr)
        except Exception:
            return None
        if not data:
            return None
        return data.strip() or None

    @staticmethod
    async def verify(
        qr_text: Optional[str],
        activity_name: Optional[str] = None,
        student_name: Optional[str] = None,
        organizer: Optional[str] = None,
    ) -> QrVerificationResult:
        if not qr_text:
            return QrVerificationResult(detected=False, errorDetails="Không tìm thấy mã QR trên tệp minh chứng.")
        result = QrVerificationResult(detected=True, rawText=qr_text)

        url = QrVerifierService._extract_url(qr_text)
        if not url:
            result.errorDetails = "Mã QR không chứa đường dẫn tra cứu (URL) để đối chiếu công khai."
            return result
        result.verificationUrl = url

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                response = await client.get(url, headers={"User-Agent": "UniProof-AI qr verifier/1.0"})
                response.raise_for_status()
        except httpx.TimeoutException:
            result.errorDetails = "Truy cập đường dẫn trong mã QR hết thời gian chờ."
            return result
        except httpx.HTTPError as error:
            result.errorDetails = f"Không truy cập được đường dẫn trong mã QR: {error}"
            return result

        result.fetched = True
        title, body = QrVerifierService._page_text(response.text)
        result.pageTitle = title
        haystack = f"{title} {body}"

        activity_score = QrVerifierService._similarity(activity_name, haystack) if activity_name else 0.0
        student_hit = bool(student_name) and QrVerifierService._contains(haystack, student_name)
        organizer_hit = bool(organizer) and QrVerifierService._contains(haystack, organizer)

        result.matchScore = round(activity_score, 2)
        result.matchesDeclared = bool(
            (activity_name and activity_score >= QrVerifierService.ACCEPT_THRESHOLD)
            or student_hit
            or (organizer_hit and not activity_name)
        )
        if result.matchesDeclared:
            result.confidenceBoost = QrVerifierService.MATCH_BOOST
        elif not activity_name and not student_hit:
            result.errorDetails = "Đã mở trang trong mã QR nhưng chưa có dữ liệu khai báo để đối chiếu."
        else:
            result.errorDetails = "Nội dung trang trong mã QR chưa khớp thông tin khai báo (hoạt động/tên sinh viên)."
        return result

    @staticmethod
    def _extract_url(text: str) -> Optional[str]:
        match = re.search(r"https?://[^\s\"'<>]+", text)
        if not match:
            return None
        url = match.group(0).rstrip(").,;")
        host = (urlparse(url).hostname or "").lower()
        if "." not in host:
            return None
        return url

    @staticmethod
    def _page_text(html: str) -> tuple[str, str]:
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.get_text(" ", strip=True) if soup.title else ""
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        body = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
        return title, body[:6000]

    @staticmethod
    def _normalize(value: str) -> str:
        decomposed = unicodedata.normalize("NFD", value.casefold())
        normalized = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
        return re.sub(r"[^a-z0-9 ]", " ", normalized.replace("đ", "d"))

    @staticmethod
    def _similarity(activity_name: str, candidate: str) -> float:
        activity = QrVerifierService._normalize(activity_name)
        result = QrVerifierService._normalize(candidate)
        if not activity.strip() or not result.strip():
            return 0.0
        sequence = SequenceMatcher(None, activity, result).ratio()
        activity_tokens = {word for word in activity.split() if len(word) > 2}
        result_tokens = set(result.split())
        token_overlap = len(activity_tokens & result_tokens) / len(activity_tokens) if activity_tokens else 0.0
        return max(sequence, token_overlap)

    @staticmethod
    def _contains(haystack: str, needle: str) -> bool:
        compact_haystack = QrVerifierService._normalize(haystack).replace(" ", "")
        compact_needle = QrVerifierService._normalize(needle).replace(" ", "")
        return bool(compact_needle) and compact_needle in compact_haystack
