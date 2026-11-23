import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Any


PLACEHOLDER = re.compile(r"\[(?:REDACTED_[A-Z_]+|UNREADABLE)\]", re.IGNORECASE)
CLASS_CODE = re.compile(r"\b\d{2,3}[A-Z]{1,4}\d{1,3}(?:\.\d{1,2})?\b", re.IGNORECASE)
LONG_NUMBER = re.compile(r"(?<!\d)\d{8,12}(?!\d)")
EMAIL_OR_PHONE = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)",
    re.IGNORECASE,
)
WORD = re.compile(r"[^\W_]+", re.UNICODE)
IDENTITY_LABELS = (
    "ho va ten",
    "ho ten",
    "ten sinh vien",
    "sinh vien",
    "student name",
    "full name",
    "student id",
    "mssv",
    "cccd",
    "cmnd",
    "can cuoc",
    "dia chi",
    "address",
    "sinh ngay",
    "ngay sinh",
    "date of birth",
    "nguoi hien",
)


def _fold_for_labels(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def normalize_transcription(value: str) -> list[str]:
    tokens: list[str] = []
    for line in unicodedata.normalize("NFC", value).splitlines():
        folded = _fold_for_labels(line)
        if any(
            re.search(rf"(?:^|\s){re.escape(label)}(?:\s|$)", folded)
            and re.search(r"[:=]", line)
            for label in IDENTITY_LABELS
        ):
            continue
        if EMAIL_OR_PHONE.search(line):
            continue

        sanitized = PLACEHOLDER.sub(" ", line)
        sanitized = CLASS_CODE.sub(" ", sanitized)
        sanitized = LONG_NUMBER.sub(" ", sanitized)
        tokens.extend(WORD.findall(sanitized.casefold()))
    return tokens


def _edit_distance(left: list[str] | str, right: list[str] | str) -> int:
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for left_index, left_item in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_item in enumerate(right, start=1):
            current.append(min(
                current[-1] + 1,
                previous[right_index] + 1,
                previous[right_index - 1] + (left_item != right_item),
            ))
        previous = current
    return previous[-1]


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def evaluate_pilot(
    dataset_dir: Path,
    transcripts_reviewed: bool = False,
    excluded_samples: dict[str, str] | None = None,
) -> dict[str, Any]:
    if not transcripts_reviewed:
        raise ValueError("Confirm that pilot transcriptions were reviewed against originals before evaluation.")

    annotations = _read_csv(dataset_dir / "pilot_annotations.csv")
    drafts = _read_csv(dataset_dir / "pilot_machine_draft.csv")
    manifest = {
        record["sample_id"]: record
        for record in (
            json.loads(line)
            for line in (dataset_dir / "manifest.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    }

    annotation_by_id = {row["sample_id"]: row for row in annotations}
    draft_by_id = {row["sample_id"]: row for row in drafts}
    if len(annotation_by_id) != len(annotations):
        raise ValueError("Duplicate sample_id in pilot_annotations.csv.")
    if len(draft_by_id) != len(drafts):
        raise ValueError("Duplicate sample_id in pilot_machine_draft.csv.")
    if set(annotation_by_id) != set(draft_by_id):
        raise ValueError("Pilot annotation and OCR draft sample IDs do not match.")
    if not set(annotation_by_id).issubset(manifest):
        raise ValueError("A pilot sample is missing from manifest.jsonl.")
    if any(not row.get("expected_transcription", "").strip() for row in annotations):
        raise ValueError("Every pilot sample must have a reviewed transcription.")
    excluded_samples = excluded_samples or {}
    unknown_exclusions = set(excluded_samples) - set(annotation_by_id)
    if unknown_exclusions:
        raise ValueError(f"Exclusion refers to an unknown sample_id: {sorted(unknown_exclusions)[0]}")
    if any(not reason.strip() for reason in excluded_samples.values()):
        raise ValueError("Every excluded sample must have an explicit reason.")

    by_digest: dict[str, list[str]] = defaultdict(list)
    for sample_id in annotation_by_id:
        by_digest[manifest[sample_id]["sha256"]].append(sample_id)

    representatives: set[str] = set()
    duplicate_excluded = 0
    annotation_order = {row["sample_id"]: position for position, row in enumerate(annotations)}
    for sample_ids in by_digest.values():
        representative = max(
            sample_ids,
            key=lambda sample_id: (
                len(normalize_transcription(annotation_by_id[sample_id]["expected_transcription"])),
                -annotation_order[sample_id],
            ),
        )
        representatives.add(representative)
        duplicate_excluded += len(sample_ids) - 1
    exclusions_by_digest: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for sample_id, reason in excluded_samples.items():
        exclusions_by_digest[manifest[sample_id]["sha256"]].append((sample_id, reason))
    for exclusions in exclusions_by_digest.values():
        exclusions.sort(key=lambda exclusion: annotation_order[exclusion[0]])

    per_sample: list[dict[str, Any]] = []
    total_character_errors = 0
    total_reference_characters = 0
    total_word_errors = 0
    total_reference_words = 0
    skipped_samples: list[dict[str, str]] = []

    for sample_id in sorted(representatives):
        digest_exclusions = exclusions_by_digest.get(manifest[sample_id]["sha256"])
        if digest_exclusions:
            excluded_sample_id, reason = digest_exclusions[0]
            skipped_samples.append({
                "sample_id": sample_id,
                "excluded_sample_id": excluded_sample_id,
                "reason": reason,
            })
            continue
        reference_words = normalize_transcription(annotation_by_id[sample_id]["expected_transcription"])
        hypothesis_words = normalize_transcription(draft_by_id[sample_id]["ai_draft_transcription_redacted"])
        if not reference_words:
            skipped_samples.append({
                "sample_id": sample_id,
                "reason": "no_reference_text_after_privacy_filter",
            })
            continue

        reference_characters = list(" ".join(reference_words))
        hypothesis_characters = list(" ".join(hypothesis_words))
        character_errors = _edit_distance(reference_characters, hypothesis_characters)
        word_errors = _edit_distance(reference_words, hypothesis_words)
        cer = character_errors / len(reference_characters)
        wer = word_errors / len(reference_words)

        per_sample.append({
            "sample_id": sample_id,
            "reference_characters": len(reference_characters),
            "reference_words": len(reference_words),
            "character_errors": character_errors,
            "word_errors": word_errors,
            "cer": cer,
            "wer": wer,
        })
        total_character_errors += character_errors
        total_reference_characters += len(reference_characters)
        total_word_errors += word_errors
        total_reference_words += len(reference_words)

    if not per_sample or not total_reference_characters or not total_reference_words:
        raise ValueError("No comparable non-sensitive transcription text remains in the pilot.")

    return {
        "metric": "redacted_transcription_baseline",
        "sample_count": len(annotations),
        "unique_document_count": len(representatives),
        "evaluated_document_count": len(per_sample),
        "exact_duplicate_samples_excluded": duplicate_excluded,
        "skipped_samples": skipped_samples,
        "normalization": {
            "unicode": "NFC",
            "case_sensitive": False,
            "diacritics_preserved": True,
            "punctuation_ignored": True,
            "whitespace_normalized": True,
            "excluded_from_scoring": [
                "redaction and unreadable placeholders",
                "identity-field lines",
                "class codes",
                "email addresses and phone numbers",
                "8-to-12 digit identifiers",
            ],
        },
        "cer": {
            "micro": total_character_errors / total_reference_characters,
            "macro": mean(row["cer"] for row in per_sample),
            "errors": total_character_errors,
            "reference_characters": total_reference_characters,
        },
        "wer": {
            "micro": total_word_errors / total_reference_words,
            "macro": mean(row["wer"] for row in per_sample),
            "errors": total_word_errors,
            "reference_words": total_reference_words,
        },
        "per_sample": per_sample,
        "limitations": [
            "Pilot has only 20 samples and is not representative of the full evidence population.",
            "Scores cover only reviewed text remaining after privacy-field exclusions.",
            "Results measure this OCR draft against reviewed transcriptions, not document authenticity or rubric fit.",
            "No OCR model was trained or changed as part of this evaluation.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate the local OCR pilot against reviewed, privacy-filtered transcriptions."
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    parser.add_argument(
        "--transcripts-reviewed",
        action="store_true",
        help="Confirm pilot transcriptions were reviewed against the original documents.",
    )
    parser.add_argument(
        "--exclude-sample",
        action="append",
        default=[],
        metavar="SAMPLE_ID=REASON",
        help="Exclude a sample whose reference is not comparable; may be supplied more than once.",
    )
    args = parser.parse_args()
    exclusions: dict[str, str] = {}
    for item in args.exclude_sample:
        sample_id, separator, reason = item.partition("=")
        if not separator or not sample_id.strip() or not reason.strip():
            parser.error("--exclude-sample must be SAMPLE_ID=REASON.")
        exclusions[sample_id.strip()] = reason.strip()
    report = evaluate_pilot(
        args.dataset,
        transcripts_reviewed=args.transcripts_reviewed,
        excluded_samples=exclusions,
    )
    report_path = args.dataset / "pilot_ocr_baseline.json"
    samples_path = args.dataset / "pilot_ocr_baseline_samples.csv"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with samples_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(report["per_sample"][0]))
        writer.writeheader()
        writer.writerows(report["per_sample"])

    print(json.dumps({
        "sample_count": report["sample_count"],
        "unique_document_count": report["unique_document_count"],
        "evaluated_document_count": report["evaluated_document_count"],
        "exact_duplicate_samples_excluded": report["exact_duplicate_samples_excluded"],
        "cer_micro": report["cer"]["micro"],
        "cer_macro": report["cer"]["macro"],
        "wer_micro": report["wer"]["micro"],
        "wer_macro": report["wer"]["macro"],
        "skipped_samples": report["skipped_samples"],
        "report": report_path.name,
        "per_sample": samples_path.name,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
