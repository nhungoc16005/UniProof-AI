"""
Kiểm tra & xác nhận artifact mô hình xuất sang apps/ai-service/model/rubric_classifier.joblib.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib

REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = REPO_ROOT / "apps" / "ai-service" / "model" / "rubric_classifier.joblib"
META_PATH = REPO_ROOT / "apps" / "ai-service" / "model" / "rubric_classifier_meta.json"


def main() -> None:
    if not MODEL_PATH.exists() or not META_PATH.exists():
        raise FileNotFoundError("Chưa có artifact mô hình. Hãy chạy train_baseline.py trước.")
    model = joblib.load(MODEL_PATH)
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    print(
        json.dumps(
            {
                "modelPath": str(MODEL_PATH),
                "sizeKB": round(MODEL_PATH.stat().st_size / 1024, 1),
                "modelName": meta.get("modelName"),
                "modelVersion": meta.get("modelVersion"),
                "classCount": len(model.classes_),
                "classes": [str(c) for c in model.classes_],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
