"""
Đánh giá mù trên tập Test (datasets/test.csv) & so sánh Keyword Baseline vs ML Model.
Xuất báo cáo đầy đủ (Accuracy, Macro-F1, Weighted-F1, Wilson 95% CI, Confusion Matrix)
vào research/activity-classification/evaluation_report.json.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parent / "datasets"
MODEL_PATH = REPO_ROOT / "apps" / "ai-service" / "model" / "rubric_classifier.joblib"
OUT_REPORT = Path(__file__).resolve().parent / "evaluation_report.json"


def _norm(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip().lower()
    decomposed = unicodedata.normalize("NFD", cleaned)
    ascii_ver = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").replace("đ", "d")
    return f"{cleaned} {ascii_ver}".strip()


def wilson_ci(successes: int, total: int, z: float = 1.96) -> list[float]:
    if total <= 0:
        return [0.0, 0.0]
    p = successes / total
    denom = 1.0 + (z * z) / total
    center = (p + (z * z) / (2.0 * total)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + (z * z) / (4.0 * total)) / total)) / denom
    return [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]


def resolve_best_model_name() -> str:
    """Lấy tên mô hình thắng CV từ metadata để đánh giá đúng mô hình được xuất production."""
    meta_path = MODEL_PATH.with_name("rubric_classifier_meta.json")
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        name = meta.get("bestCvModel") or meta.get("modelName")
        if name:
            return str(name)
    return "tfidf_logreg"


def keyword_baseline_predict(text: str) -> str:
    """Mô phỏng bộ từ khóa cứng hiện có để làm đối chứng công bằng trên cùng tập Test."""
    t = _norm(text)
    if any(k in t for k in ("hieu truong", "giam doc dai hoc da nang", "thanh doan", "trung uong doan", "trung uong hoi", "cap truong", "cap dhdn", "sao thang gieng")) and any(k in t for k in ("can bo", "lop truong", "bi thu", "chi hoi", "chu nhiem clb", "ban can su")):
        return "MUC_16"
    if any(k in t for k in ("hoan thanh xuat sac nhiem vu",)) and any(k in t for k in ("giay khen", "khen thuong")):
        return "MUC_15"
    if any(k in t for k in ("hoan thanh tot nhiem vu", "tin nhiem", "binh chon", "90%")) and any(k in t for k in ("lop truong", "lop pho", "bi thu", "chi hoi", "ban can su", "chu nhiem clb", "uy vien bch")):
        return "MUC_14"
    if any(k in t for k in ("hien mau", "tinh nguyen", "mua he xanh", "xuan yeu thuong", "trung thu", "gay quy", "volunteer", "thien nguyen", "hien tang toc")):
        return "MUC_12"
    if any(k in t for k in ("ban to chuc", "cong tac vien", "doi tu van sinh vien", "ho tro chuong trinh", "tham gia to chuc")):
        return "MUC_13"
    if any(k in t for k in ("nghien cuu khoa hoc", "nckh", "olympic", "hackathon", "cuoc thi hoc thuat", "design thinking", "bk smart", "greenovation", "economic arena", "dynamic due")):
        return "MUC_5"
    if any(k in t for k in ("van nghe", "the thao", "giai chay", "esports", "giao luu van hoa", "miss & mister", "cover show", "hoi thao")):
        return "MUC_9"
    if any(k in t for k in ("tuyen truyen", "phong chong", "te nan xa hoi", "phap luat", "ung xu van minh", "hiv", "an ninh mang", "pccc")):
        return "MUC_10"
    if any(k in t for k in ("sinh hoat cong dan", "ky nang mem", "workshop", "talkshow", "tap huan", "khoa hoc online", "giao tiep", "thuyet trinh")):
        return "MUC_8"
    if any(k in t for k in ("cau lac bo", "clb hoc thuat", "nhom nghien cuu", "gdsc", "ieee student branch", "khoi nghiep")):
        return "MUC_4"
    return "KHONG_HOP_LE"


def main() -> None:
    train_df = pd.read_csv(DATA_DIR / "train.csv")
    val_df = pd.read_csv(DATA_DIR / "val.csv")
    test_df = pd.read_csv(DATA_DIR / "test.csv")

    # Đảm bảo 0% rò rỉ dữ liệu: kiểm tra không trùng group_id giữa (train+val) và test
    trainval_df = pd.concat([train_df, val_df], ignore_index=True)
    overlap = set(trainval_df["group_id"]) & set(test_df["group_id"])
    if overlap:
        raise ValueError(f"Phát hiện rò rỉ group_id giữa train/val và test: {overlap}")

    # Huấn luyện mô hình đánh giá CHỈ trên train+val (không chạm test.csv)
    from train_baseline import make_candidates

    model_name = resolve_best_model_name()
    eval_model = make_candidates()[model_name]
    eval_model.fit(
        trainval_df["text"].map(_norm).tolist(),
        trainval_df["criterion_label"].astype(str).tolist(),
    )

    y_true = test_df["criterion_label"].astype(str).tolist()
    X_test = test_df["text"].map(_norm).tolist()

    kw_preds = [keyword_baseline_predict(t) for t in test_df["text"].tolist()]
    ml_preds = [str(p) for p in eval_model.predict(X_test)]

    labels_sorted = sorted(set(y_true) | set(ml_preds) | set(kw_preds))

    def _summarize(preds: list[str]) -> dict:
        correct = sum(a == b for a, b in zip(y_true, preds))
        return {
            "test_samples": len(y_true),
            "correct": correct,
            "accuracy": round(float(accuracy_score(y_true, preds)), 4),
            "accuracy_wilson_95ci": wilson_ci(correct, len(y_true)),
            "macro_f1": round(float(f1_score(y_true, preds, average="macro", zero_division=0)), 4),
            "weighted_f1": round(float(f1_score(y_true, preds, average="weighted", zero_division=0)), 4),
            "confusion_matrix": {
                "labels": labels_sorted,
                "matrix": confusion_matrix(y_true, preds, labels=labels_sorted).tolist(),
            },
            "per_class": {
                k: {
                    "precision": round(v["precision"], 4),
                    "recall": round(v["recall"], 4),
                    "f1": round(v["f1-score"], 4),
                    "support": int(v["support"]),
                }
                for k, v in classification_report(y_true, preds, output_dict=True, zero_division=0).items()
                if isinstance(v, dict) and k not in {"macro avg", "weighted avg"}
            },
        }

    report = {
        "test_set_path": str(DATA_DIR / "test.csv"),
        "evaluated_model": model_name,
        "note": f"Mô hình chỉ học train+val; tập test giữ lại theo group_id ({len(test_df)} mẫu). Báo cáo kèm Wilson 95% CI do cỡ mẫu còn nhỏ.",
        "keyword_baseline": _summarize(kw_preds),
        "ml_model": _summarize(ml_preds),
    }
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("KEYWORD BASELINE:", {k: v for k, v in report["keyword_baseline"].items() if k not in {"confusion_matrix", "per_class"}})
    print("ML MODEL        :", {k: v for k, v in report["ml_model"].items() if k not in {"confusion_matrix", "per_class"}})


if __name__ == "__main__":
    main()
