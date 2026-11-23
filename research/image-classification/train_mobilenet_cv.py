"""
Script Transfer Learning MobileNetV3-Small (Computer Vision 7 lớp) cho Luồng 1 & Luồng 3.
Chạy tốt trên Google Colab GPU T4 (~10-15 phút) hoặc CPU với tập nhỏ, xuất trực tiếp sang
ONNX (~10-15 MB) tại apps/ai-service/model/event_scene_classifier.onnx.

Cấu trúc thư mục yêu cầu:
  research/image-classification/datasets/
    train/<CLASS_NAME>/*.jpg
    test/<CLASS_NAME>/*.jpg   (BẮT BUỘC 100% ảnh SV tự chụp điện thoại để tránh domain shift)

7 lớp nội dung (tách riêng khỏi chất lượng ảnh ở Lớp 1):
  GIAY_KHEN_GCN, GIAY_HIEN_MAU, SU_KIEN_HOI_TRUONG, SU_KIEN_TINH_NGUYEN,
  SU_KIEN_VAN_NGHE_THE_THAO, SU_KIEN_CLB_NGAY_HOI, KHONG_PHAI_MINH_CHUNG
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

CLASSES = [
    "GIAY_KHEN_GCN",
    "GIAY_HIEN_MAU",
    "SU_KIEN_HOI_TRUONG",
    "SU_KIEN_TINH_NGUYEN",
    "SU_KIEN_VAN_NGHE_THE_THAO",
    "SU_KIEN_CLB_NGAY_HOI",
    "KHONG_PHAI_MINH_CHUNG",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("datasets"))
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument(
        "--output-onnx",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "apps" / "ai-service" / "model" / "event_scene_classifier.onnx",
    )
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Augmentation mô phỏng ảnh chụp điện thoại (góc nghiêng, ánh sáng lệch, crop)
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.75, 1.0)),
        transforms.RandomHorizontalFlip(p=0.3),
        transforms.RandomRotation(degrees=10),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    train_ds = datasets.ImageFolder(args.data_dir / "train", transform=train_tf)
    test_ds = datasets.ImageFolder(args.data_dir / "test", transform=eval_tf)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=0)

    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(train_ds.classes))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for imgs, targets in train_loader:
            imgs, targets = imgs.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(imgs), targets)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item()) * len(targets)
        print(f"Epoch {epoch:02d}/{args.epochs} | train_loss={total_loss / max(1, len(train_ds)):.4f}")

    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for imgs, targets in test_loader:
            logits = model(imgs.to(device))
            preds = logits.argmax(dim=1).cpu().tolist()
            y_true.extend(targets.tolist())
            y_pred.extend(preds)

    metrics = {
        "classes": train_ds.classes,
        "test_samples": len(y_true),
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
    print(json.dumps(metrics, ensure_ascii=False, indent=2))

    args.output_onnx.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.randn(1, 3, 224, 224)
    model_cpu = model.to("cpu").eval()
    torch.onnx.export(
        model_cpu,
        dummy,
        str(args.output_onnx),
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=13,
    )
    meta_path = args.output_onnx.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported ONNX -> {args.output_onnx}")


if __name__ == "__main__":
    main()
