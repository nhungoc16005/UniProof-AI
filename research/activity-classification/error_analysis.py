"""
Phân tích lỗi (Error Analysis) trên tập Test của mô hình Phân loại Tiêu chí Rubric DUT.
Liệt kê các mẫu bị dự đoán nhầm, xác suất top-3 và lưu báo cáo chi tiết vào error_analysis_report.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from evaluate import _norm, resolve_best_model_name

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parent / "datasets"
MODEL_PATH = REPO_ROOT / "apps" / "ai-service" / "model" / "rubric_classifier.joblib"
OUT_PATH = Path(__file__).resolve().parent / "error_analysis_report.json"


def main() -> None:
    test_df = pd.read_csv(DATA_DIR / "test.csv")
    trainval_df = pd.concat(
        [pd.read_csv(DATA_DIR / "train.csv"), pd.read_csv(DATA_DIR / "val.csv")], ignore_index=True
    )
    # Không dùng model production (đã học cả test) để tránh rò rỉ; fit lại trên train+val.
    from train_baseline import make_candidates

    model = make_candidates()[resolve_best_model_name()]
    model.fit(trainval_df["text"].map(_norm).tolist(), trainval_df["criterion_label"].astype(str).tolist())
    classes = [str(c) for c in model.classes_]
    X_test = test_df["text"].map(_norm).tolist()
    probs = model.predict_proba(X_test)
    preds = [classes[int(row.argmax())] for row in probs]

    errors = []
    for idx, row in test_df.iterrows():
        true_lbl = str(row["criterion_label"])
        pred_lbl = preds[idx]
        if true_lbl != pred_lbl:
            row_probs = probs[idx]
            top3 = sorted(zip(classes, row_probs), key=lambda x: float(x[1]), reverse=True)[:3]
            errors.append(
                {
                    "sample_id": row["sample_id"],
                    "group_id": row["group_id"],
                    "true_label": true_lbl,
                    "predicted_label": pred_lbl,
                    "top3": [{"label": k, "prob": round(float(p), 4)} for k, p in top3],
                    "text_excerpt": str(row["text"])[:250],
                }
            )

    summary = {
        "total_test_samples": int(len(test_df)),
        "error_count": len(errors),
        "errors": errors,
    }
    OUT_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Error analysis complete: {len(errors)}/{len(test_df)} errors -> {OUT_PATH}")


if __name__ == "__main__":
    main()
