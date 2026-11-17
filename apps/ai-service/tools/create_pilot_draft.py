import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "ai-service"))

from src.ocr_extractor import OcrExtractorService

from build_evidence_dataset import redact_ocr_text


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def _draft_document_type(text: str, file_type: str) -> str:
    normalized = _normalize(text)
    if any(term in normalized for term in ("hien mau", "don vi mau", "blood donation")):
        return "GIAY_HIEN_MAU"
    if any(term in normalized for term in ("giay khen", "quyet dinh khen", "giay khen thuong")):
        return "GIAY_KHEN"
    if any(term in normalized for term in ("giay xac nhan", "xac nhan cua", "xac nhan tham gia")):
        return "GIAY_XAC_NHAN"
    if any(term in normalized for term in ("giay chung nhan", "chung nhan")):
        return "GIAY_CHUNG_NHAN"
    if file_type in {"jpg", "jpeg", "png", "jfif"} and len(normalized.split()) < 12:
        return "ANH_SU_KIEN_OR_UNREADABLE"
    return "UNKNOWN"


def _redact_candidate(value: str | None) -> str:
    if not value:
        return ""
    redacted, _ = redact_ocr_text(value)
    return redacted.strip()


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def create_draft(dataset_dir: Path) -> dict[str, Any]:
    dataset_dir = dataset_dir.resolve()
    pilot_rows = _read_csv(dataset_dir / "pilot_annotations.csv")
    manifest_rows = {
        row["sample_id"]: row
        for row in (json.loads(line) for line in (dataset_dir / "manifest.jsonl").read_text(encoding="utf-8").splitlines())
    }
    hash_counts: dict[str, int] = {}
    for row in manifest_rows.values():
        hash_counts[row["sha256"]] = hash_counts.get(row["sha256"], 0) + 1
    pilot_hash_counts: dict[str, int] = {}
    for pilot in pilot_rows:
        record = manifest_rows.get(pilot["sample_id"])
        if record is None:
            raise ValueError(f"Pilot sample is missing from the manifest: {pilot['sample_id']}")
        pilot_hash_counts[record["sha256"]] = pilot_hash_counts.get(record["sha256"], 0) + 1

    fields = [
        "sample_id",
        "ai_draft_document_type",
        "ai_draft_transcription_redacted",
        "ai_draft_activity_name",
        "ai_draft_issuer",
        "ai_draft_issue_date",
        "ai_draft_quality_suggestion",
        "ai_draft_duplicate_suggestion",
        "human_confirmation_needed",
        "review_notes",
    ]
    output_rows: list[dict[str, str]] = []
    type_counts: dict[str, int] = {}

    for pilot in pilot_rows:
        record = manifest_rows.get(pilot["sample_id"])
        if record is None:
            raise ValueError(f"Pilot sample is missing from the manifest: {pilot['sample_id']}")
        text, _ = redact_ocr_text(record.get("ocr_redacted", ""))
        activity = _redact_candidate(OcrExtractorService._extract_activity_name(text))
        issuer = _redact_candidate(OcrExtractorService._extract_organizer(text))
        issue_date = OcrExtractorService._extract_date(text) or ""
        document_type = _draft_document_type(text, record["file_type"])
        type_counts[document_type] = type_counts.get(document_type, 0) + 1
        if pilot_hash_counts[record["sha256"]] > 1:
            duplicate_suggestion = "EXACT_DUPLICATE_PAIR_IN_PILOT"
        elif hash_counts[record["sha256"]] > 1:
            duplicate_suggestion = "OTHER_COPY_EXISTS_OUTSIDE_PILOT"
        else:
            duplicate_suggestion = "NO_EXACT_DUPLICATE_FOUND"
        quality_suggestion = (
            "REVIEW" if record["quality_status"] != "PASS" else "AUTO_CHECK_PASS_REQUIRES_HUMAN_REVIEW"
        )
        output_rows.append({
            "sample_id": pilot["sample_id"],
            "ai_draft_document_type": document_type,
            "ai_draft_transcription_redacted": text,
            "ai_draft_activity_name": activity,
            "ai_draft_issuer": issuer,
            "ai_draft_issue_date": issue_date,
            "ai_draft_quality_suggestion": quality_suggestion,
            "ai_draft_duplicate_suggestion": duplicate_suggestion,
            "human_confirmation_needed": "yes",
            "review_notes": "AI/OCR draft only; not ground truth, validity decision, or training label.",
        })

    output_path = dataset_dir / "pilot_machine_draft.csv"
    with output_path.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output_rows)

    summary = {
        "sample_count": len(output_rows),
        "document_type_suggestions": type_counts,
        "exact_duplicate_groups_in_pilot": sum(count > 1 for count in pilot_hash_counts.values()),
        "human_confirmation_needed": len(output_rows),
        "ground_truth_written": False,
        "output": output_path.name,
    }
    (dataset_dir / "pilot_machine_draft_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    readme_path = dataset_dir / "PILOT_README.md"
    readme_text = readme_path.read_text(encoding="utf-8") if readme_path.exists() else "# Pilot annotation\n"
    draft_note = (
        "\n10. `pilot_machine_draft.csv` là OCR/AI gợi ý đã che định danh để tham khảo khi mở ảnh gốc. "
        "Transcript và trường trích xuất trong file này chưa được xác minh; hãy tự sửa từ ảnh gốc rồi mới chép "
        "bản đã xác nhận vào `pilot_annotations.csv`. Không dùng machine draft làm nhãn train.\n"
    )
    if "pilot_machine_draft.csv" not in readme_text:
        readme_path.write_text(readme_text.rstrip() + "\n" + draft_note, encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a redacted AI/OCR review draft for the local evidence pilot.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=PROJECT_ROOT / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    args = parser.parse_args()
    print(json.dumps(create_draft(args.dataset), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
