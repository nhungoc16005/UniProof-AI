"""CLI kiểm tra tính hợp lệ của tệp nhãn (quy trình con người).

Kiểm tra: sample_id duy nhất & thuộc manifest; enum hợp lệ; trường bắt buộc khi
`annotation_status=complete`; bản trùng chính xác không lệch split.
Xuất `annotation_validation.json`; thoát mã ≠ 0 khi có vi phạm.
"""

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ENUMS: dict[str, set[str]] = {
    "document_type": {"GIAY_KHEN", "GIAY_HIEN_MAU", "GIAY_XAC_NHAN", "GIAY_CHUNG_NHAN", "ANH_SU_KIEN"},
    "expected_student_name_match": {"matched", "unmatched", "unknown"},
    "expected_student_code_match": {"matched", "unmatched", "unknown"},
    "expected_term_match": {"matched", "unmatched", "unknown"},
    "validity_label": {"valid", "invalid", "unclear"},
    "quality_label": {"pass", "review", "fail"},
    "template_match_label": {"match", "mismatch", "unknown"},
    "suspected_tampering_label": {"yes", "no", "unclear"},
    "duplicate_review_label": {"exact", "near", "none", "unknown"},
    "human_review_decision": {"accept", "reject", "escalate"},
    "annotation_status": {"complete", "needs_review"},
}

REQUIRED_WHEN_COMPLETE = [
    "document_type",
    "expected_activity_name",
    "expected_issuer",
    "expected_issue_date",
    "expected_student_name_match",
    "expected_student_code_match",
    "expected_term_match",
    "validity_label",
    "quality_label",
    "template_match_label",
    "suspected_tampering_label",
    "duplicate_review_label",
    "human_review_decision",
]


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _load_manifest(dataset_dir: Path) -> dict[str, dict[str, Any]]:
    path = dataset_dir / "manifest.jsonl"
    if not path.exists():
        return {}
    records: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            records[record["sample_id"]] = record
    return records


def validate_annotations(dataset_dir: Path, annotations_path: Path | None = None) -> dict[str, Any]:
    annotations_path = annotations_path or (dataset_dir / "annotations.csv")
    if not annotations_path.exists():
        raise ValueError(f"Không tìm thấy tệp nhãn: {annotations_path}.")

    annotations = _read_csv(annotations_path)
    manifest = _load_manifest(dataset_dir)
    violations: list[dict[str, Any]] = []

    seen: set[str] = set()
    for position, row in enumerate(annotations, start=2):
        sample_id = (row.get("sample_id") or "").strip()
        if not sample_id:
            violations.append({"line": position, "type": "missing_sample_id"})
            continue
        if sample_id in seen:
            violations.append({"line": position, "type": "duplicate_sample_id", "sample_id": sample_id})
            continue
        seen.add(sample_id)
        if manifest and sample_id not in manifest:
            violations.append({"line": position, "type": "unknown_sample_id", "sample_id": sample_id})

        for field, allowed in ENUMS.items():
            value = (row.get(field) or "").strip()
            if value and value not in allowed:
                violations.append({
                    "line": position,
                    "type": "invalid_enum",
                    "sample_id": sample_id,
                    "field": field,
                    "value": value,
                    "allowed": sorted(allowed),
                })

        if (row.get("annotation_status") or "").strip() == "complete":
            for field in REQUIRED_WHEN_COMPLETE:
                if not (row.get(field) or "").strip():
                    violations.append({
                        "line": position,
                        "type": "missing_required_field",
                        "sample_id": sample_id,
                        "field": field,
                    })

    splits_by_group: dict[str, set[str]] = defaultdict(set)
    samples_by_group: dict[str, list[str]] = defaultdict(list)
    for row in annotations:
        sample_id = (row.get("sample_id") or "").strip()
        record = manifest.get(sample_id)
        if not record:
            continue
        group = record.get("duplicate_group") or record.get("sha256") or sample_id
        splits_by_group[group].add(str(record.get("split") or "unspecified"))
        samples_by_group[group].append(sample_id)
    for group, splits in splits_by_group.items():
        if len(splits) > 1:
            violations.append({
                "type": "duplicate_group_split_leak",
                "duplicate_group": group,
                "splits": sorted(splits),
                "samples": sorted(samples_by_group[group]),
            })

    complete = [row for row in annotations if (row.get("annotation_status") or "").strip() == "complete"]
    incomplete = [
        (row.get("sample_id") or "").strip()
        for row in annotations
        if (row.get("annotation_status") or "").strip() != "complete"
    ]

    return {
        "annotationFile": annotations_path.name,
        "totalRows": len(annotations),
        "uniqueSamples": len(seen),
        "completeSamples": len(complete),
        "incompleteSamples": len(incomplete),
        "incompleteSampleIds": incomplete,
        "violationCount": len(violations),
        "violations": violations,
        "valid": not violations,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Kiểm tra tính hợp lệ của tệp nhãn người.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    parser.add_argument("--annotations", type=Path, default=None, help="Mặc định: <dataset>/annotations.csv")
    args = parser.parse_args()

    report = validate_annotations(args.dataset, args.annotations)
    output_path = args.dataset / "annotation_validation.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in (
        "annotationFile", "totalRows", "completeSamples", "incompleteSamples",
        "violationCount", "valid",
    )}, ensure_ascii=False, indent=2))
    if not report["valid"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
