"""
Local-First Vietnamese Document OCR Engine (CPU 8GB RAM Optimized).

Kiến trúc 2 giai đoạn nhẹ cho CPU:
1. Text Detection: RapidOCR (ONNX Runtime PP-OCRv4 Detector) — cắt vùng chữ tốt
   trên giấy khen nền hoa văn, khung màu và con dấu đỏ (~200-350 MB RAM).
2. Vietnamese Recognition: VietOCR (vgg_seq2seq trên CPU, greedy decode) — đọc
   chuẩn dấu tiếng Việt (à, á, ạ, đ, ậ...) trên từng dòng đã cắt.
3. Layout-Aware Reconstruction: sắp xếp các box theo (y_center, x_left) và gom
   cùng dòng để giữ nguyên cấu trúc nhãn-giá trị cho Lớp 4.

Tuân thủ D8/D9: chạy 100% nội bộ, không gửi ảnh hoặc PII ra API bên ngoài.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OcrTextBox:
    text: str
    confidence: float
    bbox: tuple[int, int, int, int]  # (x1, y1, x2, y2) in original image coords


@dataclass(frozen=True)
class EngineOcrResult:
    text: str
    available: bool
    engine: str
    confidence: Optional[float] = None
    elapsed_ms: int = 0
    boxes: list[OcrTextBox] = field(default_factory=list)
    error: Optional[str] = None


_LOCK = threading.Lock()
# Giới hạn tối đa 1 lượt suy luận OCR đồng thời trên CPU 8GB để tránh nhân đôi RAM PyTorch.
_OCR_CONCURRENCY_SEMAPHORE = threading.Semaphore(int(os.getenv("MAX_CONCURRENT_OCR", "1")))
_RAPIDOCR_INSTANCE: Any = None
_RAPIDOCR_ERROR: Optional[str] = None
_VIETOCR_INSTANCE: Any = None
_VIETOCR_ERROR: Optional[str] = None


def is_rapidocr_installed() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401

        return True
    except ImportError:
        return False


def is_vietocr_installed() -> bool:
    try:
        import vietocr  # noqa: F401

        return True
    except ImportError:
        return False


def _get_rapidocr() -> tuple[Any, Optional[str]]:
    global _RAPIDOCR_INSTANCE, _RAPIDOCR_ERROR
    if _RAPIDOCR_INSTANCE is not None or _RAPIDOCR_ERROR is not None:
        return _RAPIDOCR_INSTANCE, _RAPIDOCR_ERROR
    with _LOCK:
        if _RAPIDOCR_INSTANCE is not None or _RAPIDOCR_ERROR is not None:
            return _RAPIDOCR_INSTANCE, _RAPIDOCR_ERROR
        try:
            from rapidocr_onnxruntime import RapidOCR

            _RAPIDOCR_INSTANCE = RapidOCR()
        except Exception as exc:
            _RAPIDOCR_ERROR = f"Không khởi tạo được RapidOCR ONNX: {exc}"
            logger.warning(_RAPIDOCR_ERROR)
    return _RAPIDOCR_INSTANCE, _RAPIDOCR_ERROR


def _get_vietocr() -> tuple[Any, Optional[str]]:
    global _VIETOCR_INSTANCE, _VIETOCR_ERROR
    if _VIETOCR_INSTANCE is not None or _VIETOCR_ERROR is not None:
        return _VIETOCR_INSTANCE, _VIETOCR_ERROR
    with _LOCK:
        if _VIETOCR_INSTANCE is not None or _VIETOCR_ERROR is not None:
            return _VIETOCR_INSTANCE, _VIETOCR_ERROR
        try:
            from vietocr.tool.config import Cfg
            from vietocr.tool.predictor import Predictor

            model_name = os.getenv("VIETOCR_MODEL", "vgg_seq2seq")
            config = Cfg.load_config_from_name(model_name)
            config["device"] = "cpu"
            # Tắt beamsearch để nhanh gấp 3-4 lần trên CPU 8GB mà vẫn giữ độ chính xác cao.
            config["predictor"]["beamsearch"] = False
            config["cnn"]["pretrained"] = False
            _VIETOCR_INSTANCE = Predictor(config)
        except Exception as exc:
            _VIETOCR_ERROR = f"Không khởi tạo được VietOCR: {exc}"
            logger.warning(_VIETOCR_ERROR)
    return _VIETOCR_INSTANCE, _VIETOCR_ERROR


def _poly_to_bbox(poly: Any) -> tuple[int, int, int, int]:
    xs = [float(pt[0]) for pt in poly]
    ys = [float(pt[1]) for pt in poly]
    return int(round(min(xs))), int(round(min(ys))), int(round(max(xs))), int(round(max(ys)))


def reconstruct_layout_lines(boxes: list[OcrTextBox]) -> str:
    """Sắp xếp các box theo hàng ngang (y_center) và từ trái sang phải (x1)."""
    if not boxes:
        return ""
    enriched = []
    for box in boxes:
        x1, y1, x2, y2 = box.bbox
        height = max(1, y2 - y1)
        y_center = (y1 + y2) / 2.0
        enriched.append((y_center, x1, height, box))
    enriched.sort(key=lambda item: (item[0], item[1]))

    rows: list[list[tuple[float, int, int, OcrTextBox]]] = []
    for item in enriched:
        y_center, _x1, height, _box = item
        if not rows:
            rows.append([item])
            continue
        last_row = rows[-1]
        row_y = sum(entry[0] for entry in last_row) / len(last_row)
        row_h = min(min(entry[2] for entry in last_row), height)
        if abs(y_center - row_y) <= max(8.0, 0.55 * row_h):
            last_row.append(item)
        else:
            rows.append([item])

    lines: list[str] = []
    for row in rows:
        row.sort(key=lambda entry: entry[1])
        parts = [entry[3].text.strip() for entry in row if entry[3].text.strip()]
        if parts:
            lines.append("  ".join(parts))
    return "\n".join(lines).strip()


def _crop_with_padding(
    image: Image.Image,
    bbox: tuple[int, int, int, int],
    pad_x: int = 4,
    pad_y: int = 3,
) -> Image.Image:
    w, h = image.size
    x1, y1, x2, y2 = bbox
    cx1 = max(0, x1 - pad_x)
    cy1 = max(0, y1 - pad_y)
    cx2 = min(w, x2 + pad_x)
    cy2 = min(h, y2 + pad_y)
    if cx2 <= cx1:
        cx2 = min(w, cx1 + 1)
    if cy2 <= cy1:
        cy2 = min(h, cy1 + 1)
    return image.crop((cx1, cy1, cx2, cy2))


def recognize_pil_image(
    image: Image.Image,
    mode: str = "rapidocr_vietocr",
    max_side: int = 1600,
) -> EngineOcrResult:
    """
    Chạy OCR local trên 1 ảnh PIL.
    mode:
      - 'rapidocr_vietocr': PP-OCRv4 Det (ONNX) + VietOCR (vgg_seq2seq)
      - 'rapidocr': PP-OCRv4 Det + Rec (ONNX thuần, siêu nhẹ ~250MB RAM)
    """
    started = time.perf_counter()
    normalized = ImageOps.exif_transpose(image).convert("RGB")
    orig_w, orig_h = normalized.size
    scale = 1.0
    work_img = normalized
    longest = max(orig_w, orig_h)
    if longest > max_side:
        scale = max_side / float(longest)
        work_img = normalized.resize(
            (max(1, round(orig_w * scale)), max(1, round(orig_h * scale))),
            Image.Resampling.LANCZOS,
        )

    rapid_engine, rapid_err = _get_rapidocr()
    if rapid_engine is None:
        return EngineOcrResult(
            text="",
            available=False,
            engine=mode,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            error=rapid_err or "RapidOCR chưa khả dụng.",
        )

    use_vietocr = mode == "rapidocr_vietocr"
    viet_predictor = None
    actual_engine = "rapidocr"
    if use_vietocr:
        viet_predictor, _viet_err = _get_vietocr()
        if viet_predictor is not None:
            actual_engine = "rapidocr_vietocr"

    np_img = np.asarray(work_img)
    # Khi dùng VietOCR, chỉ chạy bước Detection (use_rec=False, use_cls=False) và predict_batch để nhanh gấp 4-5 lần trên CPU!
    with _OCR_CONCURRENCY_SEMAPHORE:
        try:
            if viet_predictor is not None:
                raw_result, _elapse = rapid_engine(np_img, use_det=True, use_cls=False, use_rec=False)
            else:
                raw_result, _elapse = rapid_engine(np_img)
        except Exception as exc:
            return EngineOcrResult(
                text="",
                available=False,
                engine=actual_engine,
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                error=f"RapidOCR xử lý thất bại: {exc}",
            )

        if not raw_result:
            return EngineOcrResult(
                text="",
                available=True,
                engine=actual_engine,
                confidence=0.0,
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                boxes=[],
                error="OCR đã chạy nhưng không phát hiện vùng chữ rõ ràng trên ảnh.",
            )

        inv_scale = 1.0 / scale
        boxes: list[OcrTextBox] = []
        confidences: list[float] = []

        if viet_predictor is not None:
            valid_bboxes: list[tuple[int, int, int, int]] = []
            crops: list[Image.Image] = []
            for poly in raw_result:
                if poly is None:
                    continue
                wx1, wy1, wx2, wy2 = _poly_to_bbox(poly)
                ox1 = max(0, int(round(wx1 * inv_scale)))
                oy1 = max(0, int(round(wy1 * inv_scale)))
                ox2 = min(orig_w, int(round(wx2 * inv_scale)))
                oy2 = min(orig_h, int(round(wy2 * inv_scale)))
                if ox2 - ox1 < 4 or oy2 - oy1 < 4:
                    continue
                valid_bboxes.append((ox1, oy1, ox2, oy2))
                crops.append(_crop_with_padding(normalized, (ox1, oy1, ox2, oy2)))

            if crops:
                try:
                    batch_res = viet_predictor.predict_batch(crops, return_prob=True)
                    texts_out, probs_out = batch_res
                except Exception as exc:
                    logger.debug("VietOCR predict_batch failed, fallback to per-crop: %s", exc)
                    texts_out, probs_out = [], []
                    for crop in crops:
                        try:
                            t, p = viet_predictor.predict(crop, return_prob=True)
                            texts_out.append(t)
                            probs_out.append(p)
                        except Exception:
                            texts_out.append("")
                            probs_out.append(0.0)

                for bbox, raw_t, raw_p in zip(valid_bboxes, texts_out, probs_out):
                    final_text = str(raw_t or "").strip()
                    if not final_text:
                        continue
                    prob_val = float(raw_p) if raw_p is not None else 0.85
                    conf_pct = round(prob_val * 100.0, 1) if prob_val <= 1.0 else round(prob_val, 1)
                    boxes.append(OcrTextBox(text=final_text, confidence=conf_pct, bbox=bbox))
                    confidences.append(conf_pct)
        else:
            for item in raw_result:
                if not item or len(item) < 3:
                    continue
                poly, rapid_text, rapid_conf = item[0], str(item[1] or "").strip(), float(item[2] or 0.0)
                wx1, wy1, wx2, wy2 = _poly_to_bbox(poly)
                ox1 = max(0, int(round(wx1 * inv_scale)))
                oy1 = max(0, int(round(wy1 * inv_scale)))
                ox2 = min(orig_w, int(round(wx2 * inv_scale)))
                oy2 = min(orig_h, int(round(wy2 * inv_scale)))
                if ox2 - ox1 < 4 or oy2 - oy1 < 4 or not rapid_text:
                    continue
                conf_pct = round(rapid_conf * 100.0, 1) if rapid_conf <= 1.0 else round(rapid_conf, 1)
                boxes.append(OcrTextBox(text=rapid_text, confidence=conf_pct, bbox=(ox1, oy1, ox2, oy2)))
                confidences.append(conf_pct)

    reconstructed = reconstruct_layout_lines(boxes)
    mean_conf = round(sum(confidences) / len(confidences), 1) if confidences else None
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return EngineOcrResult(
        text=reconstructed,
        available=True,
        engine=actual_engine,
        confidence=mean_conf,
        elapsed_ms=elapsed_ms,
        boxes=boxes,
        error=None if reconstructed else "OCR đã chạy nhưng không đọc được văn bản rõ ràng.",
    )
