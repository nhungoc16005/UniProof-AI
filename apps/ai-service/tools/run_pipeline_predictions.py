"""CLI chạy Pipeline Luồng 1 trên bộ dữ liệu local và ghi `pipeline_predictions.csv`.

Đọc `source_map.csv` + `annotations.csv` (+ `pipeline_declarations.csv` tùy chọn). Mẫu thiếu tệp
gốc bị bỏ qua kèm ghi chú. Thiếu thông tin khai báo thì trường định danh để trống (không bịa).
"""

import argparse
import asyncio
import base64
import csv
import sys
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from layer_metrics import normalize_text, parse_bool
from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.schemas import DeclaredStudent, UnifiedInspectionRequest

PREDICTION_FIELDS = [
    "sample_id",
    "status",
    "predicted_document_type",
    "predicted_issue_date",
    "predicted_issuer",
    "predicted_activity_name",
    "predicted_student_code_match",
    "predicted_student_name_match",
    "predicted_term_match",
    "predicted_duplicate_match_type",
    "ai_confidence",
    "tier",
    "pipeline_mode",
    "note",
]


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _classify_document_type(raw_text: str) -> Optional[str]:
    text = normalize_text(raw_text)
    if not text:
        return None
    if "hien mau" in text:
        return "GIAY_HIEN_MAU"
    if "xac nhan" in text:
        return "GIAY_XAC_NHAN"
    if "khen" in text:
        return "GIAY_KHEN"
    if "chung nhan" in text:
        return "GIAY_CHUNG_NHAN"
    return None


def _to_iso_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = str(value).strip()
    for separator in ("T", " "):
        if separator in text:
            text = text.split(separator)[0]
    return text or None


def _term_match(response: Any) -> Optional[bool]:
    for check in response.documentChecks:
        if check.key == "term":
            if check.status == "PASS":
                return True
            if check.status == "FAIL":
                return False
            return None
    return None


async def _predict_one(request: UnifiedInspectionRequest) -> Any:
    return await UnifiedPipelineOrchestrator.process(request)


def run_predictions(
    dataset_dir: Path,
    source_dir: Path,
    source_map_path: Path,
    annotations_path: Path,
    declarations_path: Optional[Path],
    output_path: Path,
    limit: Optional[int] = None,
    document_type: Optional[str] = None,
) -> dict[str, Any]:
    source_map = {row["sample_id"]: row.get("source_relative_path", "") for row in _read_csv(source_map_path)}
    annotations = _read_csv(annotations_path)
    declarations = {row["sample_id"]: row for row in _read_csv(declarations_path)} if declarations_path else {}

    rows: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    processed = 0

    for annotation in annotations:
        sample_id = annotation["sample_id"]
        if document_type and (annotation.get("document_type") or "").strip() != document_type:
            continue
        if limit is not None and processed >= limit:
            break

        relative = source_map.get(sample_id)
        if not relative:
            skipped.append({"sample_id": sample_id, "reason": "không có trong source_map.csv"})
            continue
        file_path = source_dir / relative
        if not file_path.exists():
            skipped.append({"sample_id": sample_id, "reason": f"thiếu tệp gốc: {relative}"})
            continue

        declaration = declarations.get(sample_id, {})
        declared_name = (declaration.get("full_name") or "").strip()
        declared_code = (declaration.get("student_code") or "").strip() or None
        declared_citizen = (declaration.get("citizen_id") or "").strip() or None
        evidence_type = (declaration.get("evidence_type") or annotation.get("document_type") or "GIAY_CHUNG_NHAN").strip()

        request = UnifiedInspectionRequest(
            evidenceId=sample_id,
            activityName=(declaration.get("activity_name") or "").strip() or "Hoạt động chưa khai báo",
            evidenceType=evidence_type,
            declaredStudent=DeclaredStudent(fullName=declared_name, studentCode=declared_code, citizenId=declared_citizen),
            fileBytesBase64=base64.b64encode(file_path.read_bytes()).decode(),
            enableWebSearch=False,
        )
        try:
            response = asyncio.run(_predict_one(request))
        except Exception as error:  # noqa: BLE001 - ghi lý do, không làm sập cả bộ chạy
            skipped.append({"sample_id": sample_id, "reason": f"lỗi pipeline: {error}"})
            continue

        ocr = response.ocrExtraction
        raw_text = ocr.rawText if ocr else ""
        code_match = None
        name_match = None
        if declared_code is not None and ocr is not None:
            code_match = bool(ocr.codeMatched)
        if declared_name and ocr is not None:
            name_match = ocr.nameMatchRatio >= 60

        rows.append({
            "sample_id": sample_id,
            "status": "ok",
            "predicted_document_type": _classify_document_type(raw_text) or "",
            "predicted_issue_date": _to_iso_date(ocr.issuedDateExtracted) if ocr else "",
            "predicted_issuer": (ocr.organizerExtracted or "") if ocr else "",
            "predicted_activity_name": (ocr.activityNameExtracted or "") if ocr else "",
            "predicted_student_code_match": "" if code_match is None else str(code_match).lower(),
            "predicted_student_name_match": "" if name_match is None else str(name_match).lower(),
            "predicted_term_match": "" if _term_match(response) is None else str(_term_match(response)).lower(),
            "predicted_duplicate_match_type": response.duplicateMatchType or "",
            "ai_confidence": response.aiConfidenceScore,
            "tier": response.tier.value,
            "pipeline_mode": response.pipelineMode,
            "note": "" if declared_name else "thiếu khai báo sinh viên; cờ định danh để trống",
        })
        processed += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=PREDICTION_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    return {"written": len(rows), "skipped": skipped, "output": output_path.name}


def main() -> None:
    parser = argparse.ArgumentParser(description="Chạy Pipeline Luồng 1 để sinh pipeline_predictions.csv.")
    default_dataset = Path(__file__).resolve().parents[3] / "docs" / "Minh chứng Lọc" / "dataset-local"
    parser.add_argument("--dataset", type=Path, default=default_dataset)
    parser.add_argument("--source-dir", type=Path, default=None, help="Mặc định: thư mục cha của --dataset")
    parser.add_argument("--source-map", type=Path, default=None, help="Mặc định: <dataset>/source_map.csv")
    parser.add_argument("--annotations", type=Path, default=None, help="Mặc định: <dataset>/annotations.csv")
    parser.add_argument("--declarations", type=Path, default=None, help="Tùy chọn: pipeline_declarations.csv")
    parser.add_argument("--output", type=Path, default=None, help="Mặc định: <dataset>/pipeline_predictions.csv")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--document-type", default=None)
    args = parser.parse_args()

    dataset_dir = args.dataset
    result = run_predictions(
        dataset_dir=dataset_dir,
        source_dir=args.source_dir or dataset_dir.parent,
        source_map_path=args.source_map or (dataset_dir / "source_map.csv"),
        annotations_path=args.annotations or (dataset_dir / "annotations.csv"),
        declarations_path=args.declarations,
        output_path=args.output or (dataset_dir / "pipeline_predictions.csv"),
        limit=args.limit,
        document_type=args.document_type,
    )

    import json

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
