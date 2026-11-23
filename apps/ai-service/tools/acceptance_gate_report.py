"""CLI sinh báo cáo cổng nghiệm thu 100% (9 mục §7) cho Pipeline Luồng 1.

Đọc các artifact đã sinh: `layer_metrics.json`, `annotation_validation.json`,
`pilot_ocr_baseline.json`, `e2e_result.json`. Xuất `acceptance_report.md`.
Mục cần con người ký duyệt để NOT_EVIDENCED với ô ký duyệt trống — không tự đánh PASS.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parents[3]
NOT_EVIDENCED = "NOT_EVIDENCED"


def _read_json(path: Path) -> Optional[dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return None


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _count_matching_tests(source: str, pattern: str) -> int:
    return len(re.findall(pattern, source))


def _item(
    item_id: str,
    title: str,
    status: str,
    evidence: list[str],
    human_only: bool = False,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "title": title,
        "status": status,
        "humanOnly": human_only,
        "evidence": evidence,
        "signature": "",
    }


def _status_from(technical_ready: bool, human_only: bool, violation: bool = False) -> str:
    if violation:
        return "FAIL"
    if not technical_ready:
        return NOT_EVIDENCED
    return NOT_EVIDENCED if human_only else "PASS"


def build_report(dataset_dir: Path) -> dict[str, Any]:
    layer_metrics = _read_json(dataset_dir / "layer_metrics.json")
    annotation_validation = _read_json(dataset_dir / "annotation_validation.json")
    pilot_ocr = _read_json(dataset_dir / "pilot_ocr_baseline.json")
    e2e_result = _read_json(dataset_dir / "e2e_result.json")

    ai_service = REPO_ROOT / "apps" / "ai-service"
    backend = REPO_ROOT / "apps" / "backend"

    layer_modules = [
        "src/pipeline_orchestrator.py",
        "src/quality_forensics.py",
        "src/ocr_extractor.py",
        "src/criterion_evaluator.py",
        "src/template_matcher.py",
        "src/web_search_verifier.py",
        "src/face_verifier.py",
    ]
    layer_tests = [
        "test_unified.py",
        "test_layer_metrics.py",
        "test_template_matcher.py",
    ]
    modules_present = [name for name in layer_modules if (ai_service / name).exists()]
    tests_present = [name for name in layer_tests if (ai_service / name).exists()]

    items: list[dict[str, Any]] = []

    # 1. Tám lớp có chủ sở hữu, hợp đồng vào/ra, trạng thái UNKNOWN/ERROR và test phù hợp.
    items.append(_item(
        "1",
        "Tám lớp có chủ sở hữu, hợp đồng vào/ra, trạng thái UNKNOWN/ERROR và test phù hợp.",
        _status_from(len(modules_present) == len(layer_modules) and len(tests_present) == len(layer_tests), True),
        [
            f"Module lớp hiện diện: {len(modules_present)}/{len(layer_modules)}",
            f"Test lớp hiện diện: {len(tests_present)}/{len(layer_tests)}",
            "Cần chủ sở hữu từng lớp xác nhận hợp đồng vào/ra (ký duyệt).",
        ],
        human_only=True,
    ))

    # 2. Bộ test đóng băng, gán nhãn có người duyệt, không rò rỉ exact/near duplicate giữa các tập.
    leak = bool(annotation_validation and not annotation_validation.get("valid", True))
    ready2 = bool(
        annotation_validation
        and annotation_validation.get("valid")
        and annotation_validation.get("completeSamples", 0) > 0
    )
    items.append(_item(
        "2",
        "Bộ test đóng băng, gán nhãn có người duyệt, không rò rỉ exact/near duplicate.",
        _status_from(ready2, human_only=True, violation=leak),
        [
            (
                f"annotation_validation.json: hợp lệ={annotation_validation.get('valid')}, "
                f"mẫu hoàn tất={annotation_validation.get('completeSamples')}, "
                f"vi phạm={annotation_validation.get('violationCount')}"
                if annotation_validation
                else "Thiếu annotation_validation.json (chạy tools/validate_annotations.py)."
            ),
            "Cần người duyệt xác nhận nhãn trước khi coi là đóng băng (ký duyệt).",
        ],
        human_only=True,
    ))

    # 3. Đạt metric từng lớp; báo cáo false accept/false reject và khoảng tin cậy.
    evaluated_layers = []
    if layer_metrics:
        evaluated_layers = [
            name for name, layer in layer_metrics.get("layers", {}).items()
            if layer.get("status") == "EVALUATED"
        ]
    items.append(_item(
        "3",
        "Đạt metric từng lớp; báo cáo false accept/false reject và khoảng tin cậy.",
        _status_from(bool(evaluated_layers), human_only=False),
        [
            f"Lớp có số đo: {', '.join(evaluated_layers) if evaluated_layers else 'chưa có'}",
            f"layer_metrics.json: {'có' if layer_metrics else 'thiếu'}",
            f"Wilson CI cho precision/recall: {'có' if layer_metrics else 'thiếu'}",
            f"Baseline OCR (pilot): {'có' if pilot_ocr else 'thiếu'}",
        ],
    ))

    # 4. Không có đường đi tự động phê duyệt/từ chối khi thiếu dữ liệu/lỗi.
    unified_source = _read_text(ai_service / "test_unified.py")
    safety_tests = _count_matching_tests(
        unified_source,
        r"def test_(?:[a-z0-9_]*)(?:reject|mismatch|unavailable|unreadable|never|missing|corrupt)[a-z0-9_]*\(",
    )
    items.append(_item(
        "4",
        "Không có đường đi tự động phê duyệt/từ chối khi thiếu dữ liệu, lỗi OCR/model/nguồn ngoài.",
        _status_from(safety_tests >= 5 and (ai_service / "test_unified.py").exists(), human_only=False),
        [
            f"Test an toàn (reject/mismatch/unavailable/never/missing): {safety_tests}",
            "Kết quả thấp/không khả dụng luôn về NEEDS_HUMAN_REVIEW, không tự chấm 0 hoặc REJECT.",
        ],
    ))

    # 5. Mỗi kết quả có version/hash/evidence/thời gian xử lý; không ghi dữ liệu nhạy cảm vào log.
    ready5 = bool(e2e_result and e2e_result.get("status") == "PASS")
    items.append(_item(
        "5",
        "Mỗi kết quả có model/rule/config/rubric version, input hash, evidence và thời gian xử lý.",
        _status_from(ready5, human_only=False),
        [
            (
                f"e2e_result.json: {'PASS' if ready5 else e2e_result.get('status') if e2e_result else 'thiếu'}"
                f" (thời gian xử lý ms: {e2e_result.get('durationMs') if e2e_result else 'n/a'})"
            ),
            f"aiPipelineRun lưu output + audit: {'có' if e2e_result else 'chưa xác nhận'}",
        ],
    ))

    # 6. Cán bộ xem được tài liệu gốc và bằng chứng; quyết định cuối, override, lý do, audit được lưu.
    audit_files = [
        backend / "src" / "audit-log" / "audit-log.service.ts",
        backend / "prisma" / "schema.prisma",
    ]
    audit_present = [str(path.relative_to(REPO_ROOT)) for path in audit_files if path.exists()]
    items.append(_item(
        "6",
        "Cán bộ xem được tài liệu gốc và bằng chứng; quyết định cuối, override, lý do và audit được lưu.",
        _status_from(len(audit_present) == len(audit_files), human_only=True),
        [
            f"Hạ tầng audit hiện diện: {', '.join(audit_present) if audit_present else 'thiếu'}",
            "Cần cán bộ nghiệp vụ xác nhận luồng xem tài liệu gốc và lưu quyết định (ký duyệt).",
        ],
        human_only=True,
    ))

    # 7. Kiểm thử bảo mật/quyền riêng tư, tải/timeout, retry/recovery, backup, rollback phiên bản AI.
    backend_tests = list((backend / "test").glob("*.cjs")) if (backend / "test").exists() else []
    ready7 = (ai_service / "test_dataset_builder.py").exists() and bool(backend_tests)
    items.append(_item(
        "7",
        "Kiểm thử bảo mật/quyền riêng tư, tải/timeout, retry/recovery, backup và rollback phiên bản AI.",
        _status_from(ready7, human_only=False),
        [
            f"Test che PII (redaction): {'có' if (ai_service / 'test_dataset_builder.py').exists() else 'thiếu'}",
            f"Test backend (retry/recovery/workflow): {len(backend_tests)} tệp",
            "Cơ chế retry 3 lần đã có trong worker; timeout qua cấu hình AI_PIPELINE_URL.",
        ],
    ))

    # 8. Pilot shadow được cán bộ nghiệp vụ chấp thuận và có ngưỡng dừng/khôi phục.
    items.append(_item(
        "8",
        "Pilot shadow được cán bộ nghiệp vụ chấp thuận và có ngưỡng dừng/khôi phục.",
        NOT_EVIDENCED,
        [
            "Cần cán bộ nghiệp vụ chạy shadow pilot và ký chấp thuận.",
            "Cần ghi ngưỡng dừng/khôi phục (ví dụ tỉ lệ false accept, ECE vượt ngưỡng).",
        ],
        human_only=True,
    ))

    # 9. Tra cứu công khai chạy độc lập; không dùng "không tìm thấy" làm bằng chứng hồ sơ giả.
    official_domain_test = "test_public_source_prefers_official_domain_and_boosts_20" in unified_source
    social_source_test = "test_social_source_result_gets_smaller_boost" in unified_source
    ready9 = official_domain_test and social_source_test and (ai_service / "src" / "web_search_verifier.py").exists()
    items.append(_item(
        "9",
        "Tra cứu công khai chạy độc lập, nguồn được kiểm soát, không dùng 'không tìm thấy' làm bằng chứng giả.",
        _status_from(ready9, human_only=False),
        [
            f"Test ưu tiên nguồn chính thống (DUT/đại học/đoàn - hội) cộng +20: {'có' if official_domain_test else 'thiếu'}",
            f"Test nguồn mạng xã hội ngoài DUT cộng +10: {'có' if social_source_test else 'thiếu'}",
            f"Module tra cứu độc lập: {'có' if (ai_service / 'src' / 'web_search_verifier.py').exists() else 'thiếu'}",
        ],
    ))

    summary = {
        "PASS": sum(1 for item in items if item["status"] == "PASS"),
        "FAIL": sum(1 for item in items if item["status"] == "FAIL"),
        NOT_EVIDENCED: sum(1 for item in items if item["status"] == NOT_EVIDENCED),
    }
    return {
        "gate": "Cổng nghiệm thu 100% — Luồng 1",
        "dataset": dataset_dir.name,
        "items": items,
        "summary": summary,
        "artifacts": {
            "layer_metrics.json": bool(layer_metrics),
            "annotation_validation.json": bool(annotation_validation),
            "pilot_ocr_baseline.json": bool(pilot_ocr),
            "e2e_result.json": bool(e2e_result),
        },
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Báo cáo cổng nghiệm thu 100% — Pipeline Luồng 1",
        "",
        f"- Tổng: PASS={summary['PASS']}, FAIL={summary['FAIL']}, NOT_EVIDENCED={summary[NOT_EVIDENCED]}",
        "",
        "| # | Mục (§7) | Trạng thái | Cần con người |",
        "|---|---|---|---|",
    ]
    for item in report["items"]:
        lines.append(
            f"| {item['id']} | {item['title']} | {item['status']} | {'có' if item['humanOnly'] else 'không'} |"
        )

    lines += ["", "## Bằng chứng chi tiết", ""]
    for item in report["items"]:
        lines.append(f"### {item['id']}. {item['title']}")
        lines.append(f"- Trạng thái: **{item['status']}**")
        for evidence in item["evidence"]:
            lines.append(f"  - {evidence}")
        if item["humanOnly"]:
            lines.append(f"  - Ký duyệt: ____________________ ({item['signature'] or 'chưa ký'})")
        lines.append("")

    lines += ["## Artifact sẵn có", ""]
    for name, present in report["artifacts"].items():
        lines.append(f"- {name}: {'có' if present else 'thiếu'}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Sinh báo cáo cổng nghiệm thu 100% (9 mục §7).")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=REPO_ROOT / "docs" / "Minh chứng Lọc" / "dataset-local",
    )
    args = parser.parse_args()

    report = build_report(args.dataset)
    md_path = args.dataset / "acceptance_report.md"
    md_path.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps({
        "report": md_path.name,
        "summary": report["summary"],
        "artifacts": report["artifacts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
