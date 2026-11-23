"""
Rubric Criterion ML Predictor (CPU 8GB Lightweight Inference).

Tải lazy artifact huấn luyện tại apps/ai-service/model/rubric_classifier.joblib
(TF-IDF word+char_wb + Classifier, < 1 MB trên đĩa, < 10 MB RAM, < 5 ms/request).
Chỉ dùng hỗ trợ gợi ý tiêu chí và giải thích cho cán bộ; không tự chốt điểm.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import unicodedata
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[1] / "model" / "rubric_classifier.joblib"
META_PATH = Path(__file__).resolve().parents[1] / "model" / "rubric_classifier_meta.json"

CRITERION_LABEL_TO_CODE: dict[str, Optional[str]] = {
    "MUC_4": "4",
    "MUC_5": "5",
    "MUC_8": "8",
    "MUC_9": "9",
    "MUC_10": "10",
    "MUC_12": "12",
    "MUC_13": "13",
    "MUC_14": "14",
    "MUC_15": "15",
    "MUC_16": "16",
    "KHONG_HOP_LE": None,
}

CRITERION_HUMAN_NAMES: dict[str, str] = {
    "MUC_4": "Mục 4 (CLB học thuật / NCKH / Khởi nghiệp)",
    "MUC_5": "Mục 5 (NCKH / Olympic / Cuộc thi học thuật)",
    "MUC_8": "Mục 8 (Giáo dục chính trị / Kỹ năng mềm / Nội quy)",
    "MUC_9": "Mục 9 (Văn hóa / Văn nghệ / Thể thao)",
    "MUC_10": "Mục 10 (Tuyên truyền / Phòng chống tội phạm / TNXH)",
    "MUC_12": "Mục 12 (Phục vụ cộng đồng / Tình nguyện / Hiến máu)",
    "MUC_13": "Mục 13 (Ban tổ chức / Cộng tác viên)",
    "MUC_14": "Mục 14 (Cán bộ lớp / Đoàn / Hội hoàn thành tốt nhiệm vụ)",
    "MUC_15": "Mục 15 (Cán bộ lớp / Đoàn / Hội xuất sắc được khen thưởng)",
    "MUC_16": "Mục 16 (Cán bộ đoàn thể được khen thưởng cấp Trường trở lên)",
    "KHONG_HOP_LE": "Không thuộc tiêu chí tính điểm ngoại khóa",
}

_LOCK = threading.Lock()
_MODEL: Any = None
_META: dict[str, Any] = {}
_LOAD_ATTEMPTED = False


def _normalize_vi_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip().lower()
    decomposed = unicodedata.normalize("NFD", cleaned)
    ascii_ver = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").replace("đ", "d")
    return f"{cleaned} {ascii_ver}".strip()


def _ensure_loaded() -> tuple[Any, dict[str, Any]]:
    global _MODEL, _META, _LOAD_ATTEMPTED
    if _LOAD_ATTEMPTED:
        return _MODEL, _META
    with _LOCK:
        if _LOAD_ATTEMPTED:
            return _MODEL, _META
        _LOAD_ATTEMPTED = True
        if not MODEL_PATH.exists():
            return None, {}
        try:
            import joblib

            _MODEL = joblib.load(MODEL_PATH)
            if META_PATH.exists():
                _META = json.loads(META_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Không tải được rubric_classifier.joblib: %s", exc)
            _MODEL = None
    return _MODEL, _META


def is_rubric_model_available() -> bool:
    model, _ = _ensure_loaded()
    return model is not None


def predict_rubric_criterion(ocr_text: str, activity_name: str = "") -> Optional[dict[str, Any]]:
    """Dự đoán tiêu chí Rubric DUT phù hợp nhất từ nội dung OCR + tên hoạt động."""
    model, meta = _ensure_loaded()
    if model is None:
        return None
    combined = f"{activity_name or ''}\n{ocr_text or ''}".strip()
    if not combined:
        return None
    normalized = _normalize_vi_text(combined)
    try:
        probs = model.predict_proba([normalized])[0]
        classes = [str(c) for c in model.classes_]
    except Exception as exc:
        logger.debug("Rubric ML prediction failed: %s", exc)
        return None

    ranked = sorted(zip(classes, probs), key=lambda item: float(item[1]), reverse=True)
    top_label, top_prob = ranked[0]
    top_candidates = [
        {
            "label": label,
            "criterionCode": CRITERION_LABEL_TO_CODE.get(label),
            "labelName": CRITERION_HUMAN_NAMES.get(label, label),
            "probability": round(float(prob), 4),
        }
        for label, prob in ranked[:3]
    ]
    return {
        "predictedLabel": top_label,
        "predictedCriterionCode": CRITERION_LABEL_TO_CODE.get(top_label),
        "predictedLabelName": CRITERION_HUMAN_NAMES.get(top_label, top_label),
        "confidence": round(float(top_prob), 4),
        "topCandidates": top_candidates,
        "modelName": meta.get("modelName", "tfidf_logreg"),
        "modelVersion": meta.get("modelVersion", "1.0.0"),
    }
