"""
Benchmark thực tế Peak RSS (RAM) và P50/P95 Latency trên CPU (mục tiêu CPU 8GB RAM: Peak RSS <= 1536 MB)
cho pipeline OCR (RapidOCR) + Phân loại Rubric ML (ONNX INT8 hoặc joblib fallback).

Cách chạy:
  venv/bin/python apps/ai-service/tools/benchmark_cpu_8gb.py --limit 15
"""

from __future__ import annotations

import argparse
import json
import platform
import resource
import sys
import time
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

from src.ocr_extractor import OcrExtractorService
from src.predictor import predict_rubric_criterion


def get_peak_rss_mb() -> float:
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS trả bytes; Linux trả kilobytes
    if platform.system() == "Darwin":
        return usage / (1024 * 1024)
    return usage / 1024.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=REPO_ROOT / "docs" / "Minh chứng Lọc")
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--ocr-engine", default="rapidocr")
    args = parser.parse_args()

    exts = {".jpg", ".jpeg", ".png", ".jfif"}
    files = sorted([p for p in args.input_dir.iterdir() if p.is_file() and p.suffix.lower() in exts])[: args.limit]
    if not files:
        raise SystemExit(f"Không tìm thấy ảnh trong {args.input_dir}")

    ocr_times_ms: list[float] = []
    ml_times_ms: list[float] = []
    total_times_ms: list[float] = []
    backend_used = None

    for p in files:
        img_bytes = p.read_bytes()
        t0 = time.perf_counter()
        ocr_res = OcrExtractorService.extract_and_parse(img_bytes, ocr_engine=args.ocr_engine)
        t1 = time.perf_counter()
        act_name = getattr(getattr(ocr_res, "parsedFields", None), "activityName", None) or ""
        pred = predict_rubric_criterion(ocr_res.rawText, act_name)
        t2 = time.perf_counter()

        ocr_times_ms.append((t1 - t0) * 1000.0)
        ml_times_ms.append((t2 - t1) * 1000.0)
        total_times_ms.append((t2 - t0) * 1000.0)
        if pred:
            backend_used = f"{pred.get('inferenceBackend')} ({pred.get('modelName')})"

    peak_rss_mb = round(get_peak_rss_mb(), 1)
    report = {
        "samples_tested": len(files),
        "ocr_engine": args.ocr_engine,
        "ml_backend": backend_used,
        "peak_rss_mb": peak_rss_mb,
        "within_1536mb_budget": peak_rss_mb <= 1536.0,
        "ocr_latency_ms": {
            "p50": round(float(np.percentile(ocr_times_ms, 50)), 1),
            "p95": round(float(np.percentile(ocr_times_ms, 95)), 1),
        },
        "ml_latency_ms": {
            "p50": round(float(np.percentile(ml_times_ms, 50)), 2),
            "p95": round(float(np.percentile(ml_times_ms, 95)), 2),
        },
        "total_latency_ms": {
            "p50": round(float(np.percentile(total_times_ms, 50)), 1),
            "p95": round(float(np.percentile(total_times_ms, 95)), 1),
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
