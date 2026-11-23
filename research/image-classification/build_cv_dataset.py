"""
Tạo bộ dữ liệu hình ảnh 7 lớp cho MobileNetV3-Small (research/image-classification/datasets/{train,test}):
  1. GIAY_KHEN_GCN
  2. GIAY_HIEN_MAU
  3. SU_KIEN_HOI_TRUONG
  4. SU_KIEN_TINH_NGUYEN
  5. SU_KIEN_VAN_NGHE_THE_THAO
  6. SU_KIEN_CLB_NGAY_HOI
  7. KHONG_PHAI_MINH_CHUNG
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent / "datasets"


def render_class_sample(cls_name: str, idx: int, rng: np.random.Generator) -> Image.Image:
    w, h = 320, 240
    if cls_name == "GIAY_KHEN_GCN":
        img = Image.new("RGB", (w, h), (252, 249, 238))
        d = ImageDraw.Draw(img)
        d.rectangle([10, 10, w - 10, h - 10], outline=(165, 110, 20), width=4)
        d.rectangle([18, 18, w - 18, h - 18], outline=(24, 52, 102), width=2)
        for y in (45, 78, 110, 138, 165):
            pad = int(rng.integers(35, 75))
            d.rectangle([pad, y, w - pad, y + 8], fill=(35, 50, 80))
        cx, cy = w - 68 + int(rng.integers(-8, 8)), h - 52 + int(rng.integers(-6, 6))
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=(185, 28, 28), width=3)
    elif cls_name == "GIAY_HIEN_MAU":
        img = Image.new("RGB", (w, h), (255, 246, 246))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, 46], fill=(185, 28, 28))
        d.rectangle([12, 56, w - 12, h - 12], outline=(153, 27, 27), width=3)
        # Red cross symbol
        d.rectangle([28, 12, 40, 36], fill=(255, 255, 255))
        d.rectangle([22, 18, 46, 30], fill=(255, 255, 255))
        for y in (80, 108, 136, 162):
            pad = int(rng.integers(30, 65))
            d.rectangle([pad, y, w - pad, y + 7], fill=(90, 30, 30))
    elif cls_name == "SU_KIEN_HOI_TRUONG":
        img = Image.new("RGB", (w, h), (35, 48, 78))
        d = ImageDraw.Draw(img)
        # Stage backdrop banner + podium + audience rows
        d.rectangle([30, 20, w - 30, 110], fill=(20, 95, 170), outline=(240, 200, 60), width=2)
        d.rectangle([w // 2 - 28, 105, w // 2 + 28, 165], fill=(120, 75, 35))
        for row_y in range(170, h - 10, 18):
            for cx in range(25, w - 25, 26):
                jx = int(rng.integers(-4, 4))
                d.ellipse([cx + jx - 7, row_y - 7, cx + jx + 7, row_y + 7], fill=(210, 180, 150))
    elif cls_name == "SU_KIEN_TINH_NGUYEN":
        img = Image.new("RGB", (w, h), (195, 232, 250))
        d = ImageDraw.Draw(img)
        # Sky + green ground + blue volunteer shirts + trees
        d.rectangle([0, 130, w, h], fill=(74, 148, 82))
        d.rectangle([40, 25, w - 40, 65], fill=(22, 163, 74))
        for cx in range(45, w - 40, 48):
            jx = int(rng.integers(-6, 6))
            d.rectangle([cx + jx - 14, 115, cx + jx + 14, 175], fill=(2, 132, 199))
            d.ellipse([cx + jx - 10, 92, cx + jx + 10, 114], fill=(235, 195, 165))
    elif cls_name == "SU_KIEN_VAN_NGHE_THE_THAO":
        img = Image.new("RGB", (w, h), (34, 139, 68))
        d = ImageDraw.Draw(img)
        # Sports pitch lines + goal + orange/yellow jerseys
        d.rectangle([16, 16, w - 16, h - 16], outline=(255, 255, 255), width=3)
        d.ellipse([w // 2 - 38, h // 2 - 38, w // 2 + 38, h // 2 + 38], outline=(255, 255, 255), width=3)
        d.line([(w // 2, 16), (w // 2, h - 16)], fill=(255, 255, 255), width=2)
        for _ in range(6):
            px, py = int(rng.integers(40, w - 40)), int(rng.integers(40, h - 40))
            d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(245, 158, 11))
    elif cls_name == "SU_KIEN_CLB_NGAY_HOI":
        img = Image.new("RGB", (w, h), (242, 238, 230))
        d = ImageDraw.Draw(img)
        # Outdoor booth tent canopy + standee + table
        d.polygon([(30, 80), (w // 2, 22), (w - 30, 80)], fill=(234, 88, 12))
        d.rectangle([45, 80, 75, 195], fill=(37, 99, 235))
        d.rectangle([95, 135, w - 45, 195], fill=(180, 140, 95))
    else:  # KHONG_PHAI_MINH_CHUNG
        bg_col = tuple(int(v) for v in rng.integers(30, 220, size=3))
        img = Image.new("RGB", (w, h), bg_col)
        d = ImageDraw.Draw(img)
        for _ in range(5):
            x0, y0 = int(rng.integers(0, w - 40)), int(rng.integers(0, h - 40))
            x1, y1 = int(rng.integers(x0 + 20, w)), int(rng.integers(y0 + 20, h))
            col = tuple(int(v) for v in rng.integers(0, 255, size=3))
            d.ellipse([x0, y0, x1, y1], fill=col)

    arr = np.array(img, dtype=np.float32)
    noise = rng.normal(0.0, 6.0, size=arr.shape).astype(np.float32)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB")


def main() -> None:
    classes = [
        "GIAY_KHEN_GCN",
        "GIAY_HIEN_MAU",
        "SU_KIEN_HOI_TRUONG",
        "SU_KIEN_TINH_NGUYEN",
        "SU_KIEN_VAN_NGHE_THE_THAO",
        "SU_KIEN_CLB_NGAY_HOI",
        "KHONG_PHAI_MINH_CHUNG",
    ]
    rng = np.random.default_rng(20261123)
    for split, count in (("train", 16), ("test", 6)):
        for cls_name in classes:
            folder = OUT_DIR / split / cls_name
            folder.mkdir(parents=True, exist_ok=True)
            for idx in range(1, count + 1):
                im = render_class_sample(cls_name, idx, rng)
                im.save(folder / f"{cls_name.lower()}_{split}_{idx:03d}.jpg", quality=90)
    print(f"Built 7-class CV dataset in {OUT_DIR} (train={16*7}, test={6*7})")


if __name__ == "__main__":
    main()
