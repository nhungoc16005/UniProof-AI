"""CLI đánh giá Pipeline Luồng 1 theo lớp, đối chiếu nhãn người với dự đoán pipeline.

Đọc: `annotations.csv` (nhãn thật), `pipeline_predictions.csv` (dự đoán), `manifest.jsonl`.
Xuất: `layer_metrics.json` + `layer_metrics.md`. Thiếu nhãn thì báo NOT_EVIDENCED, không bịa số.
"""

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

from layer_metrics import (
    NOT_EVIDENCED,
    binary_metrics,
    brier_score,
    calibration_bins,
    confidence_to_unit,
    expected_calibration_error,
    field_exact_match,
    micro_f1,
    normalize_text,
    parse_bool,
    token_counts,
)

MATCH_LABELS = {"matched", "unmatched"}
DUPLICATE_POSITIVE = {"exact", "near"}
TEXT_FIELDS = ("issuer", "activity_name")


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _load_manifest(dataset_dir: Path) -> dict[str, dict[str, Any]]:
    path = dataset_dir / "manifest.jsonl"
    if not path.exists():
        return {}
    records: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        records[record["sample_id"]] = record
    return records


def _representatives(sample_ids: list[str], manifest: dict[str, dict[str, Any]]) -> set[str]:
    """Giữ một mẫu mỗi sha256 để bản trùng chính xác không tính trọng số hai lần."""
    by_digest: dict[str, list[str]] = defaultdict(list)
    for sample_id in sample_ids:
        digest = (manifest.get(sample_id) or {}).get("sha256") or sample_id
        by_digest[digest].append(sample_id)
    return {members[0] for members in by_digest.values()}


def _layer_duplicate(sample_ids: list[str], annotations: dict, predictions: dict) -> dict[str, Any]:
    is_duplicate = {"truePositive": 0, "falsePositive": 0, "falseNegative": 0}
    is_exact = {"truePositive": 0, "falsePositive": 0, "falseNegative": 0}
    evaluated = 0
    for sample_id in sample_ids:
        label = (annotations[sample_id].get("duplicate_review_label") or "").strip().casefold()
        if label not in {"exact", "near", "none"}:
            continue
        evaluated += 1
        predicted_type = (predictions[sample_id].get("predicted_duplicate_match_type") or "").strip().upper()
        predicted_positive = predicted_type in {"EXACT", "SIMILAR"}
        actual_positive = label in DUPLICATE_POSITIVE
        key = "truePositive" if predicted_positive and actual_positive else (
            "falsePositive" if predicted_positive else ("falseNegative" if actual_positive else None)
        )
        if key:
            is_duplicate[key] += 1

        exact_predicted = predicted_type == "EXACT"
        exact_actual = label == "exact"
        exact_key = "truePositive" if exact_predicted and exact_actual else (
            "falsePositive" if exact_predicted else ("falseNegative" if exact_actual else None)
        )
        if exact_key:
            is_exact[exact_key] += 1

    if not evaluated:
        return {"status": NOT_EVIDENCED, "reason": "Chưa có nhãn duplicate_review_label."}
    return {
        "status": "EVALUATED",
        "evaluatedSamples": evaluated,
        "isDuplicate": binary_metrics(**is_duplicate),
        "isExactDuplicate": binary_metrics(**is_exact),
    }


def _layer_extraction(sample_ids: list[str], annotations: dict, predictions: dict) -> dict[str, Any]:
    field_pairs: dict[str, list[tuple[Any, Any]]] = {
        "document_type": [],
        "issue_date": [],
        "issuer": [],
        "activity_name": [],
    }
    token_fields: dict[str, dict[str, int]] = {"issuer": {"truePositive": 0, "falsePositive": 0, "falseNegative": 0},
                                               "activity_name": {"truePositive": 0, "falsePositive": 0, "falseNegative": 0}}
    by_document_type: dict[str, list[bool]] = defaultdict(list)

    for sample_id in sample_ids:
        annotation = annotations[sample_id]
        prediction = predictions[sample_id]
        field_pairs["document_type"].append((annotation.get("document_type"), prediction.get("predicted_document_type")))
        field_pairs["issue_date"].append((annotation.get("expected_issue_date"), prediction.get("predicted_issue_date")))
        field_pairs["issuer"].append((annotation.get("expected_issuer"), prediction.get("predicted_issuer")))
        field_pairs["activity_name"].append(
            (annotation.get("expected_activity_name"), prediction.get("predicted_activity_name"))
        )
        for field in TEXT_FIELDS:
            counts = token_counts(annotation.get(f"expected_{field}"), prediction.get(f"predicted_{field}"))
            for key, value in counts.items():
                token_fields[field][key] += value

        expected_type = (annotation.get("document_type") or "").strip()
        if expected_type:
            by_document_type[expected_type].append(
                normalize_text(annotation.get("document_type")) == normalize_text(prediction.get("predicted_document_type"))
            )

    fields = {name: field_exact_match(pairs) for name, pairs in field_pairs.items()}
    text_micro = micro_f1(token_fields)
    evaluated = any(fields[name]["total"] for name in fields)
    if not evaluated:
        return {"status": NOT_EVIDENCED, "reason": "Chưa có nhãn trường trích xuất."}
    return {
        "status": "EVALUATED",
        "fields": fields,
        "textMicroF1": text_micro,
        "byDocumentType": {
            name: {
                "correct": sum(flags),
                "total": len(flags),
                "accuracy": (sum(flags) / len(flags)) if flags else None,
            }
            for name, flags in sorted(by_document_type.items())
        },
    }


def _layer_identity(sample_ids: list[str], annotations: dict, predictions: dict) -> dict[str, Any]:
    fields = {
        "student_code": ("expected_student_code_match", "predicted_student_code_match"),
        "student_name": ("expected_student_name_match", "predicted_student_name_match"),
        "term": ("expected_term_match", "predicted_term_match"),
    }
    report: dict[str, Any] = {}
    evaluated = False
    for name, (label_key, prediction_key) in fields.items():
        counts = {"truePositive": 0, "falsePositive": 0, "falseNegative": 0}
        false_accept = 0
        false_accept_denominator = 0
        samples = 0
        for sample_id in sample_ids:
            label = (annotations[sample_id].get(label_key) or "").strip().casefold()
            if label not in MATCH_LABELS:
                continue
            predicted = parse_bool(predictions[sample_id].get(prediction_key))
            if predicted is None:
                continue
            samples += 1
            actual = label == "matched"
            key = "truePositive" if predicted and actual else (
                "falsePositive" if predicted else ("falseNegative" if actual else None)
            )
            if key:
                counts[key] += 1
            if not actual:
                false_accept_denominator += 1
                if predicted:
                    false_accept += 1
        if not samples:
            report[name] = {"status": NOT_EVIDENCED, "reason": f"Chưa có nhãn {label_key}."}
            continue
        evaluated = True
        metrics = binary_metrics(**counts)
        metrics["falseAcceptCount"] = false_accept
        metrics["falseAcceptRate"] = (false_accept / false_accept_denominator) if false_accept_denominator else None
        report[name] = {"status": "EVALUATED", "samples": samples, **metrics}

    if not evaluated:
        return {"status": NOT_EVIDENCED, "reason": "Chưa có nhãn đối chiếu định danh."}
    return {"status": "EVALUATED", "fields": report}


def _layer_confidence(sample_ids: list[str], annotations: dict, predictions: dict) -> dict[str, Any]:
    confidences: list[float] = []
    outcomes: list[int] = []
    tier_green = {"truePositive": 0, "falsePositive": 0, "falseNegative": 0}
    for sample_id in sample_ids:
        confidence = confidence_to_unit(predictions[sample_id].get("ai_confidence"))
        decision = (annotations[sample_id].get("human_review_decision") or "").strip().casefold()
        if confidence is None or decision not in {"accept", "reject"}:
            continue
        outcome = 1 if decision == "accept" else 0
        confidences.append(confidence)
        outcomes.append(outcome)
        tier = (predictions[sample_id].get("tier") or "").strip().upper()
        predicted_positive = tier == "GREEN"
        actual_positive = outcome == 1
        key = "truePositive" if predicted_positive and actual_positive else (
            "falsePositive" if predicted_positive else ("falseNegative" if actual_positive else None)
        )
        if key:
            tier_green[key] += 1

    if not confidences:
        return {"status": NOT_EVIDENCED, "reason": "Chưa có nhãn human_review_decision để đo hiệu chuẩn."}
    return {
        "status": "EVALUATED",
        "evaluatedSamples": len(confidences),
        "eventRate": sum(outcomes) / len(outcomes),
        "expectedCalibrationError": expected_calibration_error(confidences, outcomes),
        "brierScore": brier_score(confidences, outcomes),
        "bins": calibration_bins(confidences, outcomes),
        "greenTier": binary_metrics(**tier_green),
    }


def evaluate_layers(
    dataset_dir: Path,
    predictions_path: Path,
    annotations_path: Optional[Path] = None,
) -> dict[str, Any]:
    annotations_path = annotations_path or (dataset_dir / "annotations.csv")
    if not annotations_path.exists():
        raise ValueError(f"Không tìm thấy tệp nhãn: {annotations_path}. Hãy gán nhãn trước khi đánh giá.")
    if not predictions_path.exists():
        raise ValueError(
            f"Không tìm thấy tệp dự đoán: {predictions_path}. "
            "Hãy chạy tools/run_pipeline_predictions.py để sinh dự đoán."
        )

    annotations = _read_csv(annotations_path)
    predictions = _read_csv(predictions_path)
    if not annotations or not predictions:
        raise ValueError("Tệp nhãn hoặc tệp dự đoán rỗng; không có gì để đánh giá.")

    annotation_by_id = {row["sample_id"]: row for row in annotations}
    prediction_by_id = {row["sample_id"]: row for row in predictions}
    if len(annotation_by_id) != len(annotations):
        raise ValueError("Trùng sample_id trong tệp nhãn.")
    if len(prediction_by_id) != len(predictions):
        raise ValueError("Trùng sample_id trong tệp dự đoán.")

    common = sorted(set(annotation_by_id) & set(prediction_by_id))
    if not common:
        raise ValueError("Không có sample_id nào vừa có nhãn vừa có dự đoán; kiểm tra lại hai tệp.")

    manifest = _load_manifest(dataset_dir)
    representatives = _representatives(common, manifest)
    representative_ids = sorted(representatives)
    exact_duplicate_excluded = len(common) - len(representative_ids)

    report = {
        "metric": "pipeline_layer_evaluation",
        "annotationFile": annotations_path.name,
        "predictionFile": predictions_path.name,
        "commonSamples": len(common),
        "representativeSamples": len(representative_ids),
        "exactDuplicateSamplesExcluded": exact_duplicate_excluded,
        "layers": {
            "layer2_duplicate": _layer_duplicate(common, annotation_by_id, prediction_by_id),
            "layer4_extraction": _layer_extraction(representative_ids, annotation_by_id, prediction_by_id),
            "layer5_identity": _layer_identity(representative_ids, annotation_by_id, prediction_by_id),
            "layer7_confidence": _layer_confidence(representative_ids, annotation_by_id, prediction_by_id),
        },
        "limitations": [
            "Kết quả chỉ đúng với số mẫu đã gán nhãn; mẫu lớn hơn có thể thay đổi kết luận.",
            "Lớp 4/5/7 loại phần dư của bản trùng chính xác; Lớp 2 giữ nguyên để đo trùng lặp.",
            "Không đo độ xác thực giấy tờ hay kết luận pháp lý; chỉ đo tính khớp giữa nhãn người và tín hiệu pipeline.",
        ],
    }
    return report


def _format_rate(metrics: dict[str, Any]) -> str:
    precision = metrics.get("precision")
    recall = metrics.get("recall")
    f1 = metrics.get("f1")
    def _show(value: Optional[float]) -> str:
        return "NOT_EVIDENCED" if value is None else f"{value:.3f}"
    return f"precision={_show(precision)} recall={_show(recall)} f1={_show(f1)} support={metrics.get('support')}"


def render_markdown(report: dict[str, Any]) -> str:
    layers = report["layers"]
    lines = [
        "# Báo cáo đo lường theo lớp — Pipeline Luồng 1",
        "",
        f"- Tệp nhãn: `{report['annotationFile']}`",
        f"- Tệp dự đoán: `{report['predictionFile']}`",
        f"- Mẫu chung: {report['commonSamples']} (bản trùng chính xác loại bớt: {report['exactDuplicateSamplesExcluded']})",
        "",
        "## Lớp 2 — Trùng lặp",
        "",
    ]
    duplicate = layers["layer2_duplicate"]
    if duplicate["status"] == NOT_EVIDENCED:
        lines.append(f"- NOT_EVIDENCED: {duplicate['reason']}")
    else:
        lines.append(f"- Là trùng: {_format_rate(duplicate['isDuplicate'])}")
        lines.append(f"- Là trùng chính xác: {_format_rate(duplicate['isExactDuplicate'])}")

    lines += ["", "## Lớp 4 — Trích xuất trường", ""]
    extraction = layers["layer4_extraction"]
    if extraction["status"] == NOT_EVIDENCED:
        lines.append(f"- NOT_EVIDENCED: {extraction['reason']}")
    else:
        for field, metrics in extraction["fields"].items():
            accuracy = metrics["accuracy"]
            shown = "NOT_EVIDENCED" if accuracy is None else f"{accuracy:.3f}"
            lines.append(f"- {field}: accuracy={shown} (n={metrics['total']})")
        lines.append(f"- micro-F1 văn bản: {_format_rate(extraction['textMicroF1'])}")

    lines += ["", "## Lớp 5 — Đối chiếu định danh", ""]
    identity = layers["layer5_identity"]
    if identity["status"] == NOT_EVIDENCED:
        lines.append(f"- NOT_EVIDENCED: {identity['reason']}")
    else:
        for field, metrics in identity["fields"].items():
            if metrics["status"] == NOT_EVIDENCED:
                lines.append(f"- {field}: NOT_EVIDENCED: {metrics['reason']}")
                continue
            rate = metrics["falseAcceptRate"]
            shown = "NOT_EVIDENCED" if rate is None else f"{rate:.3f}"
            lines.append(f"- {field}: {_format_rate(metrics)} false_accept={metrics['falseAcceptCount']} ({shown})")

    lines += ["", "## Lớp 7 — Hiệu chuẩn điểm tin cậy", ""]
    confidence = layers["layer7_confidence"]
    if confidence["status"] == NOT_EVIDENCED:
        lines.append(f"- NOT_EVIDENCED: {confidence['reason']}")
    else:
        ece = confidence["expectedCalibrationError"]
        brier = confidence["brierScore"]
        lines.append(f"- ECE: {'NOT_EVIDENCED' if ece is None else f'{ece:.3f}'}")
        lines.append(f"- Brier: {'NOT_EVIDENCED' if brier is None else f'{brier:.3f}'}")
        lines.append(f"- Tỉ lệ chấp nhận: {confidence['eventRate']:.3f} (n={confidence['evaluatedSamples']})")
        lines.append(f"- Tier GREEN: {_format_rate(confidence['greenTier'])}")

    lines += ["", "## Giới hạn", ""]
    lines += [f"- {item}" for item in report["limitations"]]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Đánh giá Pipeline Luồng 1 theo lớp so với nhãn người.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    parser.add_argument("--predictions", type=Path, default=None, help="Mặc định: <dataset>/pipeline_predictions.csv")
    parser.add_argument("--annotations", type=Path, default=None, help="Mặc định: <dataset>/annotations.csv")
    args = parser.parse_args()

    predictions_path = args.predictions or (args.dataset / "pipeline_predictions.csv")
    report = evaluate_layers(args.dataset, predictions_path, args.annotations)

    json_path = args.dataset / "layer_metrics.json"
    md_path = args.dataset / "layer_metrics.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")

    print(json.dumps({
        "common_samples": report["commonSamples"],
        "representative_samples": report["representativeSamples"],
        "layers": {name: layer["status"] for name, layer in report["layers"].items()},
        "report": json_path.name,
        "markdown": md_path.name,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
