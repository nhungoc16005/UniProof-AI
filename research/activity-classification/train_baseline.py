"""
Huấn luyện & so sánh các mô hình Học máy phân loại Tiêu chí Rubric DUT (CPU 8GB).

Thực hiện:
1. Đọc datasets/labeled_all.csv (được chuẩn hóa từ data_tracker.xlsx).
2. Tiền xử lý văn bản tiếng Việt + TF-IDF kết hợp word n-gram (1,2) & char_wb n-gram (3,5)
   để chống lỗi dấu OCR.
3. So sánh 3 mô hình bằng StratifiedGroupKFold (chống rò rỉ group_id):
   - LogisticRegression (balanced)
   - LinearSVC + Calibrated probabilities (balanced)
   - ComplementNB (chuyên tập mất cân bằng)
4. Chọn mô hình tốt nhất theo Macro-F1, huấn luyện trên toàn bộ dữ liệu có nhãn và
   xuất artifact vào apps/ai-service/model/rubric_classifier.joblib (+ metadata JSON).
5. Tự động sinh nhãn gợi ý (pseudo-labeling) cho 73 mẫu chưa có nhãn trong
   datasets/unlabeled_pool.csv để hỗ trợ mở rộng dataset nhanh.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parent / "datasets"
MODEL_DIR = REPO_ROOT / "apps" / "ai-service" / "model"


def normalize_vi_text(text: str) -> str:
    """Chuẩn hóa nhẹ giữ nguyên dấu tiếng Việt, ghép thêm bản không dấu để chống nhiễu OCR."""
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip().lower()
    decomposed = unicodedata.normalize("NFD", cleaned)
    ascii_ver = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").replace("đ", "d")
    return f"{cleaned} {ascii_ver}".strip()


def build_features() -> FeatureUnion:
    return FeatureUnion(
        [
            (
                "word_tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=1,
                    max_features=8000,
                    sublinear_tf=True,
                ),
            ),
            (
                "char_tfidf",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(3, 5),
                    min_df=2,
                    max_features=10000,
                    sublinear_tf=True,
                ),
            ),
        ]
    )


def make_candidates() -> dict[str, Pipeline]:
    return {
        "tfidf_logreg": Pipeline(
            [
                ("features", build_features()),
                (
                    "clf",
                    LogisticRegression(
                        C=3.0,
                        class_weight="balanced",
                        max_iter=1000,
                        random_state=42,
                    ),
                ),
            ]
        ),
        "tfidf_linear_svc": Pipeline(
            [
                ("features", build_features()),
                (
                    "clf",
                    LinearSVC(C=1.5, class_weight="balanced", random_state=42),
                ),
            ]
        ),
        "tfidf_complement_nb": Pipeline(
            [
                ("features", build_features()),
                ("clf", ComplementNB(alpha=0.5)),
            ]
        ),
    }


def evaluate_models(df: pd.DataFrame) -> tuple[str, dict[str, dict]]:
    X = df["text"].map(normalize_vi_text).to_numpy()
    y = df["criterion_label"].to_numpy()
    groups = df["group_id"].to_numpy()

    # Lọc các lớp có >= 2 mẫu để chạy Cross-Validation hợp lệ (vẫn giữ toàn bộ lớp khi fit final).
    counts = pd.Series(y).value_counts()
    eval_mask = np.isin(y, counts[counts >= 2].index)
    X_eval, y_eval, g_eval = X[eval_mask], y[eval_mask], groups[eval_mask]

    n_splits = min(5, int(pd.Series(y_eval).value_counts().min()))
    n_splits = max(2, n_splits)
    cv = StratifiedGroupKFold(n_splits=n_splits)

    labels_sorted = sorted(pd.Series(y_eval).unique().tolist())
    results: dict[str, dict] = {}
    for name, _model in make_candidates().items():
        y_true_all: list[str] = []
        y_pred_all: list[str] = []
        fold_accs: list[float] = []
        fold_macro_f1s: list[float] = []
        fold_weighted_f1s: list[float] = []
        for train_idx, val_idx in cv.split(X_eval, y_eval, g_eval):
            clf = make_candidates()[name]
            clf.fit(X_eval[train_idx], y_eval[train_idx])
            preds = clf.predict(X_eval[val_idx])
            y_val = y_eval[val_idx]
            y_true_all.extend(y_val.tolist())
            y_pred_all.extend(preds.tolist())
            fold_accs.append(float(accuracy_score(y_val, preds)))
            fold_macro_f1s.append(float(f1_score(y_val, preds, average="macro", zero_division=0)))
            fold_weighted_f1s.append(float(f1_score(y_val, preds, average="weighted", zero_division=0)))

        acc = round(float(accuracy_score(y_true_all, y_pred_all)), 4)
        macro_f1 = round(float(f1_score(y_true_all, y_pred_all, average="macro", zero_division=0)), 4)
        weighted_f1 = round(float(f1_score(y_true_all, y_pred_all, average="weighted", zero_division=0)), 4)
        cm = confusion_matrix(y_true_all, y_pred_all, labels=labels_sorted).tolist()
        report = classification_report(y_true_all, y_pred_all, output_dict=True, zero_division=0)
        results[name] = {
            "cv_folds": n_splits,
            "evaluated_samples": int(len(X_eval)),
            "accuracy": acc,
            "accuracy_fold_mean": round(float(np.mean(fold_accs)), 4),
            "accuracy_fold_std": round(float(np.std(fold_accs)), 4),
            "macro_f1": macro_f1,
            "macro_f1_fold_mean": round(float(np.mean(fold_macro_f1s)), 4),
            "macro_f1_fold_std": round(float(np.std(fold_macro_f1s)), 4),
            "weighted_f1": weighted_f1,
            "weighted_f1_fold_mean": round(float(np.mean(fold_weighted_f1s)), 4),
            "weighted_f1_fold_std": round(float(np.std(fold_weighted_f1s)), 4),
            "confusion_matrix": {
                "labels": labels_sorted,
                "matrix": cm,
            },
            "per_class": {
                k: {
                    "precision": round(v["precision"], 4),
                    "recall": round(v["recall"], 4),
                    "f1": round(v["f1-score"], 4),
                    "support": int(v["support"]),
                }
                for k, v in report.items()
                if isinstance(v, dict) and k not in {"macro avg", "weighted avg"}
            },
        }
        print(
            f"[{name}] CV-{n_splits} | "
            f"Acc={np.mean(fold_accs):.4f}±{np.std(fold_accs):.4f} | "
            f"Macro-F1={np.mean(fold_macro_f1s):.4f}±{np.std(fold_macro_f1s):.4f} | "
            f"Weighted-F1={np.mean(fold_weighted_f1s):.4f}±{np.std(fold_weighted_f1s):.4f}"
        )

    best_name = max(results.keys(), key=lambda k: (results[k]["macro_f1"], results[k]["weighted_f1"]))
    return best_name, results


def main() -> None:
    labeled_path = DATA_DIR / "labeled_all.csv"
    if not labeled_path.exists():
        raise FileNotFoundError("Hãy chạy prepare_dataset.py trước để tạo labeled_all.csv.")

    df = pd.read_csv(labeled_path)
    print(f"Loaded {len(df)} labeled samples across {df['criterion_label'].nunique()} classes.")

    best_name, cv_results = evaluate_models(df)
    print(f"\n==> BEST MODEL: {best_name} (Macro-F1={cv_results[best_name]['macro_f1']})")

    # Fit final model trên toàn bộ dữ liệu có nhãn (dùng LogisticRegression nếu best cần >=2 mẫu/lớp cho CalibratedCV)
    X_all = df["text"].map(normalize_vi_text).to_numpy()
    y_all = df["criterion_label"].to_numpy()
    min_class_count = int(pd.Series(y_all).value_counts().min())
    final_model_name = best_name
    if best_name == "tfidf_linear_svc":
        # LinearSVC không có predict_proba trực tiếp -> dùng LogisticRegression có xác suất chuẩn hóa cho API production
        final_model_name = "tfidf_logreg"
        print("Note: chọn tfidf_logreg cho bản xuất production để trả về xác suất tin cậy (predict_proba).")

    final_model = make_candidates()[final_model_name]
    final_model.fit(X_all, y_all)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / "rubric_classifier.joblib"
    meta_path = MODEL_DIR / "rubric_classifier_meta.json"
    joblib.dump(final_model, model_path)

    meta = {
        "modelName": final_model_name,
        "bestCvModel": best_name,
        "modelVersion": "1.0.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "trainSampleCount": int(len(df)),
        "classes": [str(c) for c in final_model.classes_],
        "cvBenchmark": cv_results,
        "notes": "Baseline ML (TF-IDF word+char_wb) huấn luyện trên mẫu thật từ data_tracker.xlsx. Dùng hỗ trợ gợi ý tiêu chí Rubric, không tự động chốt điểm.",
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved model -> {model_path} ({model_path.stat().st_size / 1024:.1f} KB)")

    # Gợi ý nhãn nháp (Pseudo-labeling) cho 73 mẫu chưa có nhãn
    unlabeled_path = DATA_DIR / "unlabeled_pool.csv"
    if unlabeled_path.exists():
        unlabeled = pd.read_csv(unlabeled_path)
        if len(unlabeled):
            X_u = unlabeled["text"].map(normalize_vi_text).to_numpy()
            probs = final_model.predict_proba(X_u)
            best_idx = np.argmax(probs, axis=1)
            unlabeled["suggested_criterion"] = [str(final_model.classes_[i]) for i in best_idx]
            unlabeled["confidence"] = [round(float(probs[r, i]), 4) for r, i in enumerate(best_idx)]
            unlabeled["review_priority"] = np.where(unlabeled["confidence"] >= 0.70, "HIGH_CONF_CHECK", "NEEDS_MANUAL_LABEL")
            out_pseudo = DATA_DIR / "pseudo_labeled_suggestions.csv"
            unlabeled.sort_values("confidence", ascending=False).to_csv(out_pseudo, index=False, encoding="utf-8-sig")
            print(f"Generated pseudo-label suggestions for {len(unlabeled)} unlabeled samples -> {out_pseudo}")


if __name__ == "__main__":
    main()
