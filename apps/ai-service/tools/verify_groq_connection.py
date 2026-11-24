"""
Kiểm tra nhanh kết nối Groq API + Tường lửa PII 3 lớp + Event Cache 7 ngày sau khi điền GROQ_API_KEY vào apps/ai-service/.env.

Cách chạy:
  venv/bin/python apps/ai-service/tools/verify_groq_connection.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

AI_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = AI_DIR / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

sys.path.insert(0, str(AI_DIR))

from src.config import settings  # noqa: E402
from src.criterion_evaluator import evaluate_criterion  # noqa: E402
from src.llm_assistant import is_llm_assistant_enabled, sanitize_event_text_for_llm  # noqa: E402


def main() -> None:
    sample_ocr = (
        "Presented to\nNguyễn Thanh Hằng\nMSSV: 102210099 | Lớp: 24CDT1\n"
        "Certificate of participation in Da Nang Code League 2024 Hackathon programming contest"
    )
    sanitized = sanitize_event_text_for_llm(
        sample_ocr,
        "Da Nang Code League 2024",
        declared_student_name="Nguyễn Thanh Hằng",
        declared_student_code="102210099",
    )
    print("1. PII Firewall output:", sanitized)

    if not is_llm_assistant_enabled():
        print(
            "\n2. Trạng thái Groq API: ĐANG TẮT.\n"
            "   Hãy tạo file apps/ai-service/.env từ apps/ai-service/.env.example và đặt:\n"
            "     EXTERNAL_LLM_EXTRACTION_ENABLED=true\n"
            "     GROQ_API_KEY=gsk_...\n"
            "   rồi chạy lại lệnh này để test live!"
        )
        return

    criterion_5 = {
        "code": "5",
        "maxScore": 3,
        "scoringConfig": {"kind": "award_tier", "requiredData": ["awardTier"], "scores": {"PARTICIPATED": 2, "CONSOLATION_OR_HIGHER": 3}},
    }
    t0 = time.perf_counter()
    res1 = evaluate_criterion(
        criterion_5,
        sample_ocr,
        True,
        "Da Nang Code League 2024",
        declared_student_name="Nguyễn Thanh Hằng",
        declared_student_code="102210099",
    )
    t1 = time.perf_counter()
    res2 = evaluate_criterion(
        criterion_5,
        sample_ocr.replace("Nguyễn Thanh Hằng", "Trần Văn Bình").replace("102210099", "102210888"),
        True,
        "Da Nang Code League 2024",
        declared_student_name="Trần Văn Bình",
        declared_student_code="102210888",
    )
    t2 = time.perf_counter()
    print(f"\n2. Lần gọi 1 (Live Groq `{settings.LLM_MODEL}`): {(t1 - t0) * 1000:.1f} ms")
    print(json.dumps(res1.get("llmAssistant"), ensure_ascii=False, indent=2))
    print(f"\n3. Lần gọi 2 (Khác SV nhưng cùng sự kiện -> Event Cache): {(t2 - t1) * 1000:.2f} ms | cacheHit={res2.get('llmAssistant', {}).get('cacheHit')}")


if __name__ == "__main__":
    main()
