# ==============================================================================
# LỚP 6: NHẬN DIỆN PHÔI GRID — so khớp bố cục với kho phôi được cấp quyền
# ==============================================================================
# Lưu ý: đây chỉ là TÍN HIỆU, không phải kết luận pháp lý. MISMATCH/UNKNOWN
# luôn chuyển cán bộ (REVIEW); không có đường tự động từ chối.

import io
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from PIL import Image

from .config import settings
from .schemas import TemplateMatchResult

try:
    import imagehash
except ImportError:
    imagehash = None


DEFAULT_REGISTRY_PATH = Path(__file__).resolve().parents[1] / "templates" / "registry.json"
PHASH_BITS = 64


def _compute_phash(image_bytes: bytes) -> Optional[str]:
    """Tính pHash; trả None khi không tính được (không dùng sentinel để tránh so nhầm)."""
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return None
    try:
        if imagehash is not None:
            return str(imagehash.phash(image))
        resized = image.resize((8, 8), Image.Resampling.LANCZOS).convert("L")
        pixels = list(resized.tobytes())
        average = sum(pixels) / len(pixels)
        bits = "".join("1" if value > average else "0" for value in pixels)
        return f"{int(bits, 2):016x}"
    except Exception:
        return None


def _aspect_ratio(image_bytes: bytes) -> Optional[float]:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
    except Exception:
        return None
    if not height:
        return None
    return width / height


def _hamming(left: str, right: str) -> Optional[int]:
    try:
        return bin(int(left, 16) ^ int(right, 16)).count("1")
    except (ValueError, TypeError):
        return None


def _parse_boundary(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _is_active(entry: dict[str, Any], today: date) -> bool:
    start = _parse_boundary(entry.get("effectiveFrom"))
    end = _parse_boundary(entry.get("effectiveTo"))
    if start and today < start:
        return False
    if end and today > end:
        return False
    return True


@dataclass
class TemplateRegistry:
    templates: list[dict[str, Any]]
    hamming_max: int
    aspect_tolerance: float

    def match(self, image_bytes: bytes, document_type: str) -> TemplateMatchResult:
        candidates = [
            entry
            for entry in self.templates
            if str(entry.get("documentType") or "") == document_type
            and entry.get("pHash")
            and _is_active(entry, date.today())
        ]
        if not candidates:
            return TemplateMatchResult(
                status="UNKNOWN",
                matchedTemplateId=None,
                confidence=0.0,
                evidence=(
                    "Kho phôi chưa có mẫu hợp lệ còn hiệu lực cho loại giấy này; "
                    "không thể kết luận khớp hay lệch phôi."
                ),
            )

        current_phash = _compute_phash(image_bytes)
        if not current_phash:
            return TemplateMatchResult(
                status="UNKNOWN",
                matchedTemplateId=None,
                confidence=0.0,
                evidence="Không tính được pHash của tệp; không đối chiếu được bố cục phôi.",
            )
        current_aspect = _aspect_ratio(image_bytes)

        scored: list[tuple[int, float, dict[str, Any]]] = []
        for entry in candidates:
            distance = _hamming(current_phash, str(entry.get("pHash")))
            if distance is None:
                continue
            similarity = round((1 - distance / PHASH_BITS) * 100, 1)
            scored.append((distance, similarity, entry))
        if not scored:
            return TemplateMatchResult(
                status="UNKNOWN",
                matchedTemplateId=None,
                confidence=0.0,
                evidence="pHash trong kho phôi không đọc được; không đối chiếu được bố cục.",
            )

        distance, similarity, best = min(scored, key=lambda item: item[0])
        reference_aspect = best.get("aspectRatio")
        aspect_ok = True
        if current_aspect and reference_aspect:
            try:
                reference_aspect = float(reference_aspect)
                difference = abs(current_aspect - reference_aspect) / max(abs(reference_aspect), 1e-6)
                aspect_ok = difference <= self.aspect_tolerance
            except (TypeError, ValueError):
                aspect_ok = True

        template_id = str(best.get("templateId") or "")
        if distance <= self.hamming_max and aspect_ok:
            return TemplateMatchResult(
                status="MATCH",
                matchedTemplateId=template_id,
                confidence=similarity,
                evidence=(
                    f"Bố cục khớp phôi {template_id} (khoảng cách pHash {distance}/{PHASH_BITS}, "
                    f"tương đồng {similarity}%). Đây là tín hiệu hình ảnh, không xác thực pháp lý."
                ),
            )
        return TemplateMatchResult(
            status="MISMATCH",
            matchedTemplateId=template_id,
            confidence=similarity,
            evidence=(
                f"Bố cục lệch so với phôi gần nhất {template_id} "
                f"(khoảng cách pHash {distance}/{PHASH_BITS}, tương đồng {similarity}%, tỉ lệ khung "
                f"{'trong ngưỡng' if aspect_ok else 'ngoài ngưỡng'}). Cần cán bộ kiểm tra, không kết luận giả mạo."
            ),
        )

    def describe(self) -> dict[str, Any]:
        return {
            "templateCount": len(self.templates),
            "hammingMax": self.hamming_max,
            "aspectTolerance": self.aspect_tolerance,
        }


def load_registry(path: Optional[Path | str] = None) -> TemplateRegistry:
    """Đọc kho phôi; thiếu/hỏng trả registry rỗng an toàn (mọi match → UNKNOWN)."""
    configured = path or settings.TEMPLATE_REGISTRY_PATH or DEFAULT_REGISTRY_PATH
    registry_path = Path(configured)
    hamming_max = settings.TEMPLATE_MATCH_HAMMING_MAX
    aspect_tolerance = settings.TEMPLATE_MATCH_ASPECT_TOLERANCE
    templates: list[dict[str, Any]] = []
    try:
        payload = json.loads(registry_path.read_text(encoding="utf-8"))
        raw_templates = payload.get("templates") if isinstance(payload, dict) else None
        if isinstance(raw_templates, list):
            templates = [entry for entry in raw_templates if isinstance(entry, dict)]
    except (OSError, ValueError):
        templates = []
    return TemplateRegistry(templates=templates, hamming_max=hamming_max, aspect_tolerance=aspect_tolerance)


class TemplateMatcher:
    @staticmethod
    def match(
        image_bytes: bytes,
        document_type: str,
        registry: Optional[TemplateRegistry] = None,
    ) -> TemplateMatchResult:
        active_registry = registry or load_registry()
        return active_registry.match(image_bytes, document_type)
