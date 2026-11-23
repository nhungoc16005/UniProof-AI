import argparse
import csv
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from evaluate_ocr_pilot import normalize_transcription


def _base_character(character: str) -> str:
    decomposed = unicodedata.normalize("NFD", character)
    return "".join(part for part in decomposed if not unicodedata.combining(part))


def align_characters(reference: str, hypothesis: str) -> dict[str, Any]:
    distances = [
        [0] * (len(hypothesis) + 1)
        for _ in range(len(reference) + 1)
    ]
    for row in range(len(reference) + 1):
        distances[row][0] = row
    for column in range(len(hypothesis) + 1):
        distances[0][column] = column

    for row in range(1, len(reference) + 1):
        for column in range(1, len(hypothesis) + 1):
            distances[row][column] = min(
                distances[row - 1][column] + 1,
                distances[row][column - 1] + 1,
                distances[row - 1][column - 1]
                + (reference[row - 1] != hypothesis[column - 1]),
            )

    operations: Counter[str] = Counter()
    substitutions: Counter[tuple[str, str]] = Counter()
    diacritic_only = 0
    row, column = len(reference), len(hypothesis)
    while row or column:
        diagonal_cost = (
            distances[row - 1][column - 1]
            + (reference[row - 1] != hypothesis[column - 1])
            if row and column
            else None
        )
        if (
            row
            and column
            and reference[row - 1] == hypothesis[column - 1]
            and distances[row][column] == diagonal_cost
        ):
            row -= 1
            column -= 1
        elif (
            row
            and column
            and reference[row - 1] != hypothesis[column - 1]
            and _base_character(reference[row - 1]) == _base_character(hypothesis[column - 1])
            and distances[row][column] == diagonal_cost
        ):
            expected, actual = reference[row - 1], hypothesis[column - 1]
            operations["substitution"] += 1
            substitutions[(expected, actual)] += 1
            diacritic_only += 1
            row -= 1
            column -= 1
        elif row and distances[row][column] == distances[row - 1][column] + 1:
            operations["deletion"] += 1
            row -= 1
        elif (
            row
            and column
            and distances[row][column] == diagonal_cost
        ):
            expected, actual = reference[row - 1], hypothesis[column - 1]
            operations["substitution"] += 1
            substitutions[(expected, actual)] += 1
            row -= 1
            column -= 1
        else:
            operations["insertion"] += 1
            column -= 1

    return {
        "distance": distances[-1][-1],
        "operations": dict(operations),
        "diacritic_only_substitutions": diacritic_only,
        "substitution_counts": dict(substitutions),
        "top_substitutions": [
            {"reference_char": pair[0], "ocr_char": pair[1], "count": count}
            for pair, count in substitutions.most_common(10)
        ],
    }


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def analyze_pilot(dataset_dir: Path) -> dict[str, Any]:
    baseline_path = dataset_dir / "pilot_ocr_baseline_samples.csv"
    if not baseline_path.exists():
        raise ValueError("Run evaluate_ocr_pilot.py first to create the scored sample list.")

    annotations = {
        row["sample_id"]: row for row in _read_csv(dataset_dir / "pilot_annotations.csv")
    }
    drafts = {
        row["sample_id"]: row for row in _read_csv(dataset_dir / "pilot_machine_draft.csv")
    }
    manifest = {
        record["sample_id"]: record
        for record in (
            json.loads(line)
            for line in (dataset_dir / "manifest.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    }
    scored_samples = _read_csv(baseline_path)
    if not scored_samples:
        raise ValueError("The baseline has no scored samples to analyze.")

    totals: Counter[str] = Counter()
    confusion_counts: Counter[tuple[str, str]] = Counter()
    diacritic_only = 0
    reference_characters = 0
    groups: dict[str, dict[str, int]] = defaultdict(lambda: {
        "documents": 0,
        "reference_characters": 0,
        "character_errors": 0,
        "reference_words": 0,
        "word_errors": 0,
    })
    per_sample: list[dict[str, Any]] = []

    for scored in scored_samples:
        sample_id = scored["sample_id"]
        if sample_id not in annotations or sample_id not in drafts or sample_id not in manifest:
            raise ValueError(f"Scored sample is missing a source record: {sample_id}")

        reference_words = normalize_transcription(
            annotations[sample_id]["expected_transcription"]
        )
        hypothesis_words = normalize_transcription(
            drafts[sample_id]["ai_draft_transcription_redacted"]
        )
        reference = " ".join(reference_words)
        hypothesis = " ".join(hypothesis_words)
        aligned = align_characters(reference, hypothesis)
        if aligned["distance"] != int(scored["character_errors"]):
            raise ValueError(f"Character alignment disagrees with baseline for {sample_id}.")

        char_count = len(reference)
        word_count = len(reference_words)
        char_errors = aligned["distance"]
        word_errors = int(scored["word_errors"])
        reference_characters += char_count
        totals.update(aligned["operations"])
        diacritic_only += aligned["diacritic_only_substitutions"]
        confusion_counts.update(aligned["substitution_counts"])

        group_name = manifest[sample_id].get("quality_status", "unknown")
        group = groups[group_name]
        group["documents"] += 1
        group["reference_characters"] += char_count
        group["character_errors"] += char_errors
        group["reference_words"] += word_count
        group["word_errors"] += word_errors
        per_sample.append({
            "sample_id": sample_id,
            "cer": char_errors / char_count if char_count else 0,
            "wer": word_errors / word_count if word_count else 0,
            "character_errors": char_errors,
            "word_errors": word_errors,
        })

    error_count = sum(totals.values())
    return {
        "metric": "privacy_filtered_ocr_error_analysis",
        "evaluated_document_count": len(scored_samples),
        "reference_characters": reference_characters,
        "character_edit_operations": dict(totals),
        "diacritic_only_substitutions": diacritic_only,
        "diacritic_only_share_of_substitutions": (
            diacritic_only / totals["substitution"] if totals["substitution"] else 0
        ),
        "top_character_substitutions": [
            {"reference_char": pair[0], "ocr_char": pair[1], "count": count}
            for pair, count in confusion_counts.most_common(10)
        ],
        "quality_groups": {
            name: {
                **values,
                "cer_micro": values["character_errors"] / values["reference_characters"],
                "wer_micro": values["word_errors"] / values["reference_words"],
            }
            for name, values in sorted(groups.items())
            if values["documents"] >= 3
        },
        "worst_samples": sorted(
            per_sample,
            key=lambda sample: (sample["cer"], sample["wer"]),
            reverse=True,
        )[:5],
        "limitations": [
            "This is an exploratory error breakdown of the current small pilot, not a population estimate.",
            "Only privacy-filtered text from the scored baseline is analyzed; images and raw transcripts are not written to this report.",
            "Error categories can overlap conceptually; a character edit does not identify its visual cause.",
            "All pilot rows remain marked needs_review for the full annotation record, so this report does not certify training readiness.",
        ],
        "total_character_errors": error_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an aggregate, privacy-filtered OCR error analysis for the local pilot."
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    args = parser.parse_args()
    report = analyze_pilot(args.dataset)
    report_path = args.dataset / "pilot_ocr_error_analysis.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "evaluated_document_count": report["evaluated_document_count"],
        "character_edit_operations": report["character_edit_operations"],
        "diacritic_only_substitutions": report["diacritic_only_substitutions"],
        "quality_groups": report["quality_groups"],
        "report": report_path.name,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
