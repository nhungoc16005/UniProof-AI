"""
Script chạy trên Google Colab (GPU T4 miễn phí) để fine-tune SetFit (Few-Shot Deep Learning)
so sánh với TF-IDF baseline trên đúng 3 file train.csv / val.csv / test.csv.

Cách chạy trên Colab:
  !pip install -q setfit sentence-transformers scikit-learn pandas
  !python train_setfit_colab.py --data-dir ./datasets
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
from sklearn.metrics import accuracy_score, f1_score


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("datasets"))
    parser.add_argument("--base-model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    parser.add_argument("--output-dir", type=Path, default=Path("setfit_rubric_model"))
    args = parser.parse_args()

    from datasets import Dataset
    from setfit import SetFitModel, Trainer, TrainingArguments

    train_df = pd.read_csv(args.data_dir / "train.csv")
    test_df = pd.read_csv(args.data_dir / "test.csv")

    labels = sorted(train_df["criterion_label"].unique().tolist())
    label2id = {lbl: idx for idx, lbl in enumerate(labels)}
    id2label = {idx: lbl for lbl, idx in label2id.items()}

    train_ds = Dataset.from_dict(
        {"text": train_df["text"].tolist(), "label": [label2id[x] for x in train_df["criterion_label"]]}
    )

    model = SetFitModel.from_pretrained(args.base_model, labels=labels)
    training_args = TrainingArguments(
        batch_size=16,
        num_epochs=1,
        num_iterations=15,
        evaluation_strategy="no",
        seed=42,
    )
    trainer = Trainer(model=model, args=training_args, train_dataset=train_ds)
    trainer.train()

    preds_raw = model.predict(test_df["text"].tolist())
    preds = [id2label[int(p)] if isinstance(p, (int, float)) else str(p) for p in preds_raw]
    y_true = test_df["criterion_label"].astype(str).tolist()

    metrics = {
        "base_model": args.base_model,
        "test_samples": len(y_true),
        "accuracy": round(float(accuracy_score(y_true, preds)), 4),
        "macro_f1": round(float(f1_score(y_true, preds, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_true, preds, average="weighted", zero_division=0)), 4),
    }
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(args.output_dir))
    (args.output_dir / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
