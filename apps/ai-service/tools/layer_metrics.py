"""Hàm đo lường thuần cho khung nghiệm thu Pipeline Luồng 1.

Không đọc/ghi tệp, không gọi mạng. Mọi hàm trả `None` khi mẫu số bằng 0
(hoặc đánh dấu NOT_EVIDENCED) để không bịa số khi thiếu nhãn.
"""

import math
import re
import unicodedata
from typing import Any, Optional, Sequence

MISSING_TOKENS = {"", "unknown", "unverifiable", "none", "n/a", "na", "null"}
NOT_EVIDENCED = "NOT_EVIDENCED"


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    return str(value).strip().casefold() in MISSING_TOKENS


def _as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize_text(value: Any) -> str:
    """Chuẩn hóa để so khớp: bỏ dấu, thường hóa, gom khoảng trắng, bỏ dấu câu."""
    if value is None:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(value).casefold())
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    without_marks = without_marks.replace("đ", "d")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", without_marks)).strip()


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Khoảng tin cậy Wilson cho một tỉ lệ. total<=0 trả khoảng rỗng (0, 1)."""
    successes = int(successes)
    total = int(total)
    if total <= 0:
        return (0.0, 1.0)
    proportion = successes / total
    denominator = 1 + z * z / total
    centre = (proportion + z * z / (2 * total)) / denominator
    margin = (z / denominator) * math.sqrt(
        proportion * (1 - proportion) / total + z * z / (4 * total * total)
    )
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def binary_metrics(truePositive: int, falsePositive: int, falseNegative: int) -> dict[str, Any]:
    """Precision/recall/F1 cho bài toán nhị phân. Trả None khi mẫu số bằng 0."""
    true_positive = int(truePositive)
    false_positive = int(falsePositive)
    false_negative = int(falseNegative)
    precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else None
    recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else None
    if precision is None or recall is None:
        f1 = None
    elif precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * precision * recall / (precision + recall)
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "support": true_positive + false_negative,
        "truePositive": true_positive,
        "falsePositive": false_positive,
        "falseNegative": false_negative,
        "recallInterval": wilson_interval(true_positive, true_positive + false_negative),
        "precisionInterval": wilson_interval(true_positive, true_positive + false_positive),
    }


def field_exact_match(pairs: Sequence[tuple[Any, Any]]) -> dict[str, Any]:
    """Độ chính xác khớp chính xác của một trường; bỏ qua ô nhãn trống/unknown."""
    correct = 0
    total = 0
    for expected, predicted in pairs:
        if _is_missing(expected):
            continue
        total += 1
        if normalize_text(expected) == normalize_text(predicted):
            correct += 1
    return {
        "correct": correct,
        "total": total,
        "accuracy": correct / total if total else None,
        "interval": wilson_interval(correct, total),
    }


def token_counts(expected: Any, predicted: Any) -> dict[str, int]:
    """Đếm token trùng/lệch giữa văn bản nhãn và văn bản dự đoán (micro-F1)."""
    expected_tokens = normalize_text(expected).split() if not _is_missing(expected) else []
    predicted_tokens = normalize_text(predicted).split() if not _is_missing(predicted) else []
    remaining = list(expected_tokens)
    matched = 0
    for token in predicted_tokens:
        if token in remaining:
            remaining.remove(token)
            matched += 1
    return {
        "truePositive": matched,
        "falsePositive": len(predicted_tokens) - matched,
        "falseNegative": len(expected_tokens) - matched,
    }


def micro_f1(per_field: dict[str, dict[str, int]]) -> dict[str, Any]:
    """Gộp tp/fp/fn theo trường rồi tính micro-F1."""
    true_positive = sum(int(counts.get("truePositive", 0)) for counts in per_field.values())
    false_positive = sum(int(counts.get("falsePositive", 0)) for counts in per_field.values())
    false_negative = sum(int(counts.get("falseNegative", 0)) for counts in per_field.values())
    result = binary_metrics(true_positive, false_positive, false_negative)
    result["perField"] = per_field
    return result


def calibration_bins(
    confidences: Sequence[float],
    outcomes: Sequence[int],
    bins: int = 10,
) -> list[dict[str, Any]]:
    """Chia độ tin cậy (0..1) vào bins đều nhau; trả độ chính xác và độ tin cậy trung bình mỗi bin."""
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for confidence, outcome in zip(confidences, outcomes):
        index = min(int(confidence * bins), bins - 1)
        buckets[index].append((confidence, outcome))
    result: list[dict[str, Any]] = []
    for index, entries in enumerate(buckets):
        result.append(
            {
                "lowerBound": index / bins,
                "upperBound": (index + 1) / bins,
                "count": len(entries),
                "averageConfidence": (sum(entry[0] for entry in entries) / len(entries)) if entries else None,
                "accuracy": (sum(entry[1] for entry in entries) / len(entries)) if entries else None,
            }
        )
    return result


def expected_calibration_error(
    confidences: Sequence[float],
    outcomes: Sequence[int],
    bins: int = 10,
) -> Optional[float]:
    """ECE: bình quân gia quyền |độ chính xác - độ tin cậy| theo bin. None nếu không có mẫu."""
    total = len(confidences)
    if total == 0:
        return None
    error = 0.0
    for bucket in calibration_bins(confidences, outcomes, bins):
        if not bucket["count"]:
            continue
        error += (bucket["count"] / total) * abs(bucket["accuracy"] - bucket["averageConfidence"])
    return error


def brier_score(confidences: Sequence[float], outcomes: Sequence[int]) -> Optional[float]:
    """Brier score: bình quân (độ tin cậy - kết quả)^2. None nếu không có mẫu."""
    if not confidences:
        return None
    return sum((confidence - outcome) ** 2 for confidence, outcome in zip(confidences, outcomes)) / len(confidences)


def parse_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    text = str(value).strip().casefold()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return None


def confidence_to_unit(value: Any) -> Optional[float]:
    """Chuẩn hóa điểm tin cậy 0..100 về 0..1."""
    score = _as_float(value)
    if score is None:
        return None
    if score < 0:
        return 0.0
    if score > 1:
        score = score / 100
    return max(0.0, min(1.0, score))


def not_evidenced(reason: str) -> dict[str, Any]:
    return {"status": NOT_EVIDENCED, "reason": reason}
