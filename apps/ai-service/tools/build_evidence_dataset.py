import argparse
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "ai-service"))

from src.ocr_extractor import OcrExtractorService
from src.quality_forensics import QualityAndForensicsService

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".jfif", ".pdf"}
NAME_LABEL = re.compile(
    r"(?i)(?:họ\s*(?:và\s*)?tên|ho\s*(?:va\s*)?ten|tên\s*sinh\s*viên|ten\s*sinh\s*vien|"
    r"sinh\s*viên|sinh\s*vien|người\s*hiến|nguoi\s*hien|student\s*name|full\s*name)"
    r"\s*[:\-]?\s*[^\n]{2,}"
)
IDENTIFIER_LABEL = re.compile(
    r"(?i)(?:mssv|mã\s*sinh\s*viên|student\s*id|cccd|cmnd|căn\s*cước(?:\s*công\s*dân)?)"
    r"\s*[:\-]?\s*[A-Z0-9][A-Z0-9 .-]{4,20}"
)
EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)")
LONG_NUMBER = re.compile(r"(?<!\d)\d{8,12}(?!\d)")
WORD = re.compile(r"[^\W\d_]+", re.UNICODE)
ORGANIZATION_WORDS = {
    "ban", "bo", "cau", "chi", "clb", "cong", "cua", "dai", "doan", "giay",
    "hoi", "hoc", "khoa", "lac", "lop", "nhan", "sinh", "thanh", "truong",
    "vien", "xac",
}
NAME_LABEL_PHRASES = ("ho va ten", "ho ten", "sinh vien", "nguoi hien", "student name", "full name")
IDENTIFIER_LABEL_PHRASES = (
    "mssv", "ma sinh vien", "student id", "cccd", "cmnd", "so dinh danh", "can cuoc",
)


def _normalize_label_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def _contains_name_label(line: str) -> bool:
    normalized = _normalize_label_text(line)
    return any(phrase in normalized for phrase in NAME_LABEL_PHRASES)


def _contains_identifier_label(line: str) -> bool:
    normalized = _normalize_label_text(line)
    return any(phrase in normalized for phrase in IDENTIFIER_LABEL_PHRASES)


def redact_ocr_text(
    text: str,
    extracted_names: tuple[str, ...] = (),
    extracted_identifiers: tuple[str, ...] = (),
) -> tuple[str, list[str]]:
    flags: list[str] = []
    redacted = NAME_LABEL.sub("[REDACTED_NAME]", text)
    if redacted != text:
        flags.append("labeled_name")

    for value in extracted_names:
        if value.strip():
            redacted = re.sub(re.escape(value.strip()), "[REDACTED_NAME]", redacted, flags=re.IGNORECASE)
            flags.append("extracted_name")
    for value in extracted_identifiers:
        if value.strip():
            redacted = re.sub(re.escape(value.strip()), "[REDACTED_ID]", redacted, flags=re.IGNORECASE)
            flags.append("extracted_identifier")

    updated = IDENTIFIER_LABEL.sub("[REDACTED_ID]", redacted)
    if updated != redacted:
        flags.append("labeled_identifier")
    redacted = updated

    for pattern, label, flag in (
        (EMAIL, "[REDACTED_EMAIL]", "email"),
        (PHONE, "[REDACTED_PHONE]", "phone"),
        (LONG_NUMBER, "[REDACTED_NUMBER]", "long_number"),
    ):
        updated = pattern.sub(label, redacted)
        if updated != redacted:
            flags.append(flag)
        redacted = updated

    output_lines: list[str] = []
    for line in redacted.splitlines():
        if "[REDACTED_" not in line and _contains_name_label(line):
            output_lines.append("[REDACTED_NAME]")
            flags.append("normalized_name_label")
            continue
        if "[REDACTED_" not in line and _contains_identifier_label(line):
            output_lines.append("[REDACTED_ID]")
            flags.append("normalized_identifier_label")
            continue
        words = WORD.findall(line.strip())
        normalized_words = {
            "".join(
                char for char in unicodedata.normalize("NFKD", word.casefold())
                if not unicodedata.combining(char)
            )
            for word in words
        }
        standalone_name = (
            2 <= len(words) <= 5
            and len(line.strip()) <= 80
            and "[REDACTED_" not in line
            and all(word[0].isupper() for word in words)
            and not normalized_words.intersection(ORGANIZATION_WORDS)
        )
        if standalone_name:
            output_lines.append("[REDACTED_POSSIBLE_NAME]")
            flags.append("possible_standalone_name")
        else:
            output_lines.append(line)
    return "\n".join(output_lines), sorted(set(flags))


def _read_first_page(file_path: Path, file_bytes: bytes) -> bytes:
    if file_path.suffix.lower() != ".pdf":
        return file_bytes
    import fitz

    with fitz.open(stream=file_bytes, filetype="pdf") as document:
        if not document.page_count:
            raise ValueError("PDF has no pages")
        return document.load_page(0).get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("png")


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def select_pilot_samples(records: list[dict[str, Any]], size: int = 20) -> list[dict[str, Any]]:
    if size < 1:
        raise ValueError("Pilot size must be at least one.")
    if len(records) <= size:
        return sorted(records, key=lambda record: record["sample_id"])

    ordered = sorted(records, key=lambda record: record["sample_id"])
    selected: list[dict[str, Any]] = []

    by_hash: dict[str, list[dict[str, Any]]] = {}
    for record in ordered:
        by_hash.setdefault(record["sha256"], []).append(record)
    duplicate_groups = [group for group in by_hash.values() if len(group) > 1]
    pilot_duplicate_hash = duplicate_groups[0][0]["sha256"] if duplicate_groups else None

    def add(record: dict[str, Any]) -> None:
        if record in selected or len(selected) >= size:
            return
        same_hash_count = sum(item["sha256"] == record["sha256"] for item in selected)
        if same_hash_count and (record["sha256"] != pilot_duplicate_hash or same_hash_count >= 2):
            return
        selected.append(record)

    # Keep one exact-duplicate pair to test duplicate handling without letting
    # duplicate-heavy groups dominate the pilot.
    for group in duplicate_groups[:1]:
        add(group[0])
        add(group[1])

    pdfs = [record for record in ordered if record["file_type"] == "pdf"]
    if pdfs:
        add(pdfs[0])

    quality_reviews = [record for record in ordered if record["quality_status"] != "PASS"]
    for record in quality_reviews:
        add(record)

    # Cover every available file type before filling remaining slots.
    for file_type in sorted({record["file_type"] for record in ordered}):
        candidates = [record for record in ordered if record["file_type"] == file_type]
        add(next((record for record in candidates if record not in selected), candidates[0]))

    # Prefer samples from underrepresented quality/type strata.
    while len(selected) < size:
        remaining = [record for record in ordered if record not in selected]
        if not remaining:
            break

        def diversity_key(record: dict[str, Any]) -> tuple[int, int, str]:
            same_stratum = sum(
                item["file_type"] == record["file_type"]
                and item["quality_status"] == record["quality_status"]
                for item in selected
            )
            same_hash = sum(item["sha256"] == record["sha256"] for item in selected)
            return same_stratum, same_hash, record["sample_id"]

        add(min(remaining, key=diversity_key))
    return selected


def _create_pilot_files(
    output_dir: Path,
    manifest_records: list[dict[str, Any]],
    source_map: list[dict[str, str]],
    size: int = 20,
) -> list[dict[str, Any]]:
    selected = select_pilot_samples(manifest_records, size)
    selected_ids = {record["sample_id"] for record in selected}
    _write_csv(
        output_dir / "pilot_source_map.csv",
        ["sample_id", "source_relative_path"],
        [entry for entry in source_map if entry["sample_id"] in selected_ids],
    )
    fields = [
        "sample_id", "document_type", "expected_transcription", "expected_activity_name", "expected_issuer",
        "expected_issue_date", "expected_student_name_match", "expected_student_code_match",
        "expected_term_match", "criterion_code", "criterion_conditions_json", "validity_label",
        "quality_label", "template_match_label", "suspected_tampering_label",
        "duplicate_review_label", "human_review_decision", "annotation_status", "review_notes",
    ]
    _write_csv(
        output_dir / "pilot_annotations.csv",
        fields,
        [{field: (record["sample_id"] if field == "sample_id" else "") for field in fields} for record in selected],
    )
    (output_dir / "PILOT_README.md").write_text(
        "# Hướng dẫn gán nhãn pilot 20 minh chứng\n\n"
        "1. Mở `pilot_source_map.csv` trên máy local để tìm file gốc theo `sample_id`. File này có thể chứa "
        "tên/đường dẫn nhạy cảm; không chia sẻ ra ngoài.\n"
        "2. Mở từng ảnh/PDF gốc, điền một dòng tương ứng trong `pilot_annotations.csv`. Không dùng OCR baseline "
        "làm transcript chuẩn và không đoán phần bị mờ; ghi `[UNREADABLE]` tại đoạn không đọc được.\n"
        "3. Transcript ghi nguyên văn, giữ dấu câu/số/ngày và xuống dòng bằng `\\n` nếu cần. Không chép thông "
        "tin cá nhân vào ghi chú; dùng kết quả `matched/unmatched/unknown` cho đối chiếu danh tính.\n"
        "4. Đánh giá nội dung trong giấy tờ, không tự kết luận giấy thật/giả. `validity_label` chỉ dùng khi có "
        "đối chiếu đáng tin cậy; nếu chưa xác minh nguồn thì ghi `unclear`. Không có hồ sơ sinh viên/học kỳ/"
        "rubric kèm theo thì các trường tương ứng ghi `unknown`/`unverifiable`.\n"
        "5. `criterion_conditions_json` dùng JSON, ví dụ "
        '`{\"leadershipRole\":\"met\",\"advisorConfirmation\":\"unverifiable\"}`. Chỉ đánh giá rubric khi có '
        "mô tả tiêu chí/điều kiện và bối cảnh học kỳ; thiếu dữ liệu thì `unverifiable`.\n"
        "6. Giá trị gợi ý: match fields `matched/unmatched/unknown`; validity `valid/invalid/unclear`; "
        "quality `pass/review/fail`; template `match/mismatch/unknown`; tampering `yes/no/unclear`; "
        "duplicate `exact/near/none/unknown`; human decision `accept/reject/escalate`.\n"
        "7. Đặt `annotation_status` thành `complete` khi đã rà đủ các trường có căn cứ; nếu còn thiếu dữ liệu "
        "hoặc cần trao đổi thì dùng `needs_review` và giải thích ngắn gọn.\n"
        "8. Đây là pilot để kiểm tra quy trình và đo baseline, không phải tập train/test cuối. Các trường hợp "
        "trùng chính xác được giữ chung trong pilot để bạn xác nhận; không tách chúng sang hai tập đánh giá.\n"
        "9. Lưu CSV đã điền trong thư mục local này. Chưa fine-tune hoặc tự động chấm hồ sơ từ pilot.\n",
        encoding="utf-8",
    )
    return selected


def build_dataset(source_dir: Path, output_dir: Path) -> dict[str, Any]:
    source_dir = source_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(
        (path for path in source_dir.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS),
        key=lambda path: path.relative_to(source_dir).as_posix().casefold(),
    )
    if not files:
        raise ValueError(f"No supported evidence files found in {source_dir}")

    manifest_path = output_dir / "manifest.jsonl"
    private_map: list[dict[str, str]] = []
    annotations: list[dict[str, str]] = []
    quality_counts: dict[str, int] = {}
    ocr_available_count = 0
    total_redactions = 0
    manifest_records: list[dict[str, Any]] = []

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for file_path in files:
            file_bytes = file_path.read_bytes()
            digest = hashlib.sha256(file_bytes).hexdigest()
            relative_path = file_path.relative_to(source_dir).as_posix()
            sample_id = uuid5(NAMESPACE_URL, f"{digest}:{relative_path}").hex[:16]
            split = "validation" if int(digest[:8], 16) % 5 == 0 else "train"

            try:
                page_image = _read_first_page(file_path, file_bytes)
                quality = QualityAndForensicsService.inspect_quality(page_image)
                quality_data = {
                    "passed": quality.passed,
                    "blurScore": quality.blurScore,
                    "brightness": quality.brightness,
                    "skewAngle": quality.skewAngle,
                    "hasError": bool(quality.errorDetails),
                }
                quality_status = "PASS" if quality.passed else "REVIEW"
                ocr = OcrExtractorService.extract_and_parse(file_bytes)
                extracted_names = tuple(
                    value for value in (ocr.studentNameExtracted,) if value
                )
                extracted_identifiers = tuple(
                    value for value in (
                        ocr.studentCodeExtracted,
                        ocr.bloodDonation.citizenId if ocr.bloodDonation else None,
                    ) if value
                )
                ocr_text, redaction_flags = redact_ocr_text(
                    ocr.rawText,
                    extracted_names=extracted_names,
                    extracted_identifiers=extracted_identifiers,
                )
                if ocr.available:
                    ocr_available_count += 1
                total_redactions += len(redaction_flags)
                record = {
                    "sample_id": sample_id,
                    "sha256": digest,
                    "duplicate_group": digest,
                    "split": split,
                    "file_type": file_path.suffix.lower().lstrip("."),
                    "file_size_bytes": len(file_bytes),
                    "quality_status": quality_status,
                    "quality": quality_data,
                    "ocr_available": ocr.available,
                    "ocr_error": None if ocr.available else "OCR_UNAVAILABLE",
                    "ocr_redacted": ocr_text,
                    "redaction_flags": redaction_flags,
                    "labels": None,
                }
            except Exception as error:
                quality_status = "ERROR"
                record = {
                    "sample_id": sample_id,
                    "sha256": digest,
                    "duplicate_group": digest,
                    "split": split,
                    "file_type": file_path.suffix.lower().lstrip("."),
                    "file_size_bytes": len(file_bytes),
                    "quality_status": quality_status,
                    "quality": None,
                    "ocr_available": False,
                    "ocr_error": f"Processing failed: {type(error).__name__}",
                    "ocr_redacted": "",
                    "redaction_flags": [],
                    "labels": None,
                }
            quality_counts[quality_status] = quality_counts.get(quality_status, 0) + 1
            manifest_records.append(record)
            manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
            private_map.append({"sample_id": sample_id, "source_relative_path": relative_path})
            annotations.append({
                "sample_id": sample_id,
                "document_type": "",
                "expected_transcription": "",
                "expected_activity_name": "",
                "expected_issuer": "",
                "expected_issue_date": "",
                "expected_student_name_match": "",
                "expected_student_code_match": "",
                "expected_term_match": "",
                "criterion_code": "",
                "criterion_conditions_json": "",
                "validity_label": "",
                "quality_label": "",
                "template_match_label": "",
                "suspected_tampering_label": "",
                "duplicate_review_label": "",
                "human_review_decision": "",
                "annotation_status": "",
                "review_notes": "",
            })

    _write_csv(output_dir / "source_map.csv", ["sample_id", "source_relative_path"], private_map)
    pilot_records = _create_pilot_files(output_dir, manifest_records, private_map)
    _write_csv(
        output_dir / "annotations.csv",
        [
            "sample_id", "document_type", "expected_transcription", "expected_activity_name", "expected_issuer",
            "expected_issue_date", "expected_student_name_match", "expected_student_code_match",
            "expected_term_match", "criterion_code", "criterion_conditions_json", "validity_label",
            "quality_label", "template_match_label", "suspected_tampering_label",
            "duplicate_review_label", "human_review_decision", "annotation_status", "review_notes",
        ],
        annotations,
    )
    summary = {
        "sample_count": len(files),
        "pilot_sample_count": len(pilot_records),
        "ocr_available_count": ocr_available_count,
        "quality_counts": quality_counts,
        "redacted_samples": total_redactions,
        "training_ready": False,
        "reason": "Ground-truth transcription and criterion labels have not been reviewed.",
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "README.md").write_text(
        "# Local evidence OCR dataset\n\n"
        "Generated locally from the source evidence folder; original files are referenced, not copied or uploaded.\n\n"
        "- `manifest.jsonl`: OCR baseline predictions, with heuristic redaction. Predictions are not ground truth.\n"
        "- `annotations.csv`: blank human-review template for corrected transcription and pipeline labels.\n"
        "- `source_map.csv`: private mapping from pseudonymous IDs to original paths. Keep local and do not share.\n"
        "- `pilot_annotations.csv` / `pilot_source_map.csv`: 20-sample local annotation pilot and its private file map.\n"
        "- `PILOT_README.md`: Vietnamese instructions for reviewing and labeling the pilot.\n"
        "- `summary.json`: counts from this run; `training_ready` remains false until annotations are verified.\n\n"
        "Recommended annotation values: match fields `matched`/`unmatched`/`unknown`; criterion conditions "
        "`met`/`missing`/`unverifiable`; validity `valid`/`invalid`/`unclear`; quality `pass`/`review`/`fail`; "
        "template `match`/`mismatch`/`unknown`; tampering `yes`/`no`/`unclear`; duplicate "
        "`exact`/`near`/`none`/`unknown`; human decision `accept`/`reject`/`escalate`.\n\n"
        "Exact duplicate files share a `duplicate_group` and are assigned to the same split. The split is for "
        "later evaluation only; review near-duplicates before training. Redaction is heuristic and may miss PII, "
        "so do not share the generated files without a privacy review. Add verified labels before training; "
        "never treat OCR predictions as labels.\n",
        encoding="utf-8",
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a local, redacted OCR annotation dataset from evidence files.")
    parser.add_argument("--input", type=Path, default=PROJECT_ROOT / "docs" / "Minh chứng Lọc")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "docs" / "Minh chứng Lọc" / "dataset-local")
    args = parser.parse_args()
    summary = build_dataset(args.input, args.output)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
