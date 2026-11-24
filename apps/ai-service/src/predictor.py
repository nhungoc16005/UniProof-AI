"""
Rubric Criterion ML Predictor (CPU 8GB Lightweight Inference).

Ưu tiên tải lazy mô hình Transformer đã lượng tử hóa ONNX INT8 (train trên Kaggle):
  - Biến môi trường RUBRIC_ONNX_DIR, hoặc các thư mục mặc định trong apps/ai-service/model/:
    rubric_xlmr_quantized / rubric_minilm_quantized / rubric_phobert_quantized
  - Áp dụng hiệu chuẩn nhiệt độ (Temperature Scaling) từ rubric_classifier_meta.json.
Nếu chưa có tệp ONNX INT8, tự động fallback về rubric_classifier.joblib (TF-IDF + Linear).
Chỉ dùng hỗ trợ gợi ý tiêu chí và giải thích cho cán bộ; không tự chốt điểm.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import unicodedata
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parents[1] / "model"
MODEL_PATH = MODEL_DIR / "rubric_classifier.joblib"
META_PATH = MODEL_DIR / "rubric_classifier_meta.json"
ONNX_CANDIDATE_DIRS = (
    MODEL_DIR / "rubric_phobert_quantized",
    MODEL_DIR / "rubric_xlmr_quantized",
    MODEL_DIR / "rubric_minilm_quantized",
)

ORDERED_LABELS: list[str] = [
    "KHONG_HOP_LE",
    "MUC_4",
    "MUC_5",
    "MUC_8",
    "MUC_9",
    "MUC_10",
    "MUC_12",
    "MUC_13",
    "MUC_14",
    "MUC_15",
    "MUC_16",
]

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
_BACKEND: Optional[str] = None  # "onnx" | "joblib" | None
_MODEL: Any = None
_ONNX_SESSION: Any = None
_ONNX_TOKENIZER: Any = None
_META: dict[str, Any] = {}
_LOAD_ATTEMPTED = False


def _normalize_vi_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip().lower()
    decomposed = unicodedata.normalize("NFD", cleaned)
    ascii_ver = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").replace("đ", "d")
    return f"{cleaned} {ascii_ver}".strip()


def _resolve_onnx_dir() -> Optional[Path]:
    env_dir = os.environ.get("RUBRIC_ONNX_DIR", "").strip()
    if env_dir:
        p = Path(env_dir)
        if (p / "model_quantized.onnx").exists():
            return p
    for cand in ONNX_CANDIDATE_DIRS:
        if (cand / "model_quantized.onnx").exists():
            return cand
    return None


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exps = np.exp(shifted)
    return exps / np.sum(exps, axis=-1, keepdims=True)


def _ensure_loaded() -> tuple[Optional[str], dict[str, Any]]:
    global _BACKEND, _MODEL, _ONNX_SESSION, _ONNX_TOKENIZER, _META, _LOAD_ATTEMPTED
    if _LOAD_ATTEMPTED:
        return _BACKEND, _META
    with _LOCK:
        if _LOAD_ATTEMPTED:
            return _BACKEND, _META
        _LOAD_ATTEMPTED = True

        # 1. Ưu tiên Transformer ONNX INT8 (tự train trên Kaggle)
        onnx_dir = _resolve_onnx_dir()
        if onnx_dir is not None:
            try:
                import onnxruntime as ort
                from transformers import AutoTokenizer

                sess_opts = ort.SessionOptions()
                sess_opts.intra_op_num_threads = max(1, min(4, os.cpu_count() or 2))
                sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                _ONNX_SESSION = ort.InferenceSession(
                    str(onnx_dir / "model_quantized.onnx"),
                    sess_options=sess_opts,
                    providers=["CPUExecutionProvider"],
                )
                _ONNX_TOKENIZER = AutoTokenizer.from_pretrained(str(onnx_dir))
                onnx_meta = onnx_dir / "rubric_classifier_meta.json"
                if onnx_meta.exists():
                    _META = json.loads(onnx_meta.read_text(encoding="utf-8"))
                _BACKEND = "onnx"
                logger.info("Loaded Rubric Transformer ONNX INT8 from %s", onnx_dir)
                return _BACKEND, _META
            except Exception as exc:
                logger.warning("Không tải được ONNX INT8 tại %s (%s); fallback về joblib.", onnx_dir, exc)
                _ONNX_SESSION = None
                _ONNX_TOKENIZER = None

        # 2. Fallback về TF-IDF + Classifier (.joblib)
        if not MODEL_PATH.exists():
            return None, {}
        try:
            import joblib

            _MODEL = joblib.load(MODEL_PATH)
            if META_PATH.exists():
                _META = json.loads(META_PATH.read_text(encoding="utf-8"))
            _BACKEND = "joblib"
        except Exception as exc:
            logger.warning("Không tải được rubric_classifier.joblib: %s", exc)
            _MODEL = None
            _BACKEND = None
    return _BACKEND, _META


def is_rubric_model_available() -> bool:
    backend, _ = _ensure_loaded()
    return backend is not None


def _predict_onnx(combined: str, meta: dict[str, Any]) -> tuple[list[str], list[float]]:
    enc = _ONNX_TOKENIZER(
        combined,
        return_tensors="np",
        truncation=True,
        padding=True,
        max_length=256,
    )
    input_names = {inp.name for inp in _ONNX_SESSION.get_inputs()}
    ort_inputs = {
        k: v.astype(np.int64)
        for k, v in enc.items()
        if k in input_names
    }
    logits = _ONNX_SESSION.run(None, ort_inputs)[0]
    temperature = float(meta.get("temperature") or 1.0)
    temperature = max(0.2, min(5.0, temperature))
    probs = _softmax(logits / temperature)[0]
    labels = meta.get("testMetrics", {}).get("confusion_matrix", {}).get("labels") or ORDERED_LABELS
    return [str(lbl) for lbl in labels], [float(p) for p in probs]


def predict_rubric_criterion(ocr_text: str, activity_name: str = "") -> Optional[dict[str, Any]]:
    """Dự đoán tiêu chí Rubric DUT phù hợp nhất từ nội dung OCR + tên hoạt động."""
    backend, meta = _ensure_loaded()
    if backend is None:
        return None
    combined = f"{activity_name or ''}\n{ocr_text or ''}".strip()
    if not combined:
        return None
    try:
        if backend == "onnx":
            classes, probs = _predict_onnx(combined, meta)
        else:
            normalized = _normalize_vi_text(combined)
            probs = [float(p) for p in _MODEL.predict_proba([normalized])[0]]
            classes = [str(c) for c in _MODEL.classes_]
    except Exception as exc:
        logger.debug("Rubric ML prediction failed (%s): %s", backend, exc)
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
        "inferenceBackend": backend,
    }
