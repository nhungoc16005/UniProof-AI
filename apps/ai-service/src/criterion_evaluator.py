import re
import unicodedata
from typing import Any

from .predictor import predict_rubric_criterion


MATCH_THRESHOLD = 60

REQUIREMENT_LABELS = {
    "leadershipRole": "Giấy tờ nêu rõ chức vụ cán bộ lớp/Đoàn/Hội/CLB",
    "collectiveApprovalPercent": "Có bình chọn/khảo sát tập thể đạt trên 90%",
    "advisorConfirmation": "Có xác nhận của cố vấn/chủ nhiệm/đơn vị phụ trách",
    "excellentDutyConfirmation": "Có xác nhận hoàn thành xuất sắc nhiệm vụ",
    "awardEvidence": "Có quyết định khen thưởng/giấy khen hoặc kết quả đạt giải",
    "institutionAwardEvidence": "Có khen thưởng cấp Trường trở lên",
    "eligibleMembership": "Có giấy xác nhận/quyết định thành viên CLB/nhóm đủ điều kiện",
    "organizerConfirmation": "Có vai trò ban tổ chức/cộng tác viên và xác nhận của đơn vị",
    "awardTier": "Có kết quả tham gia/đạt giải nghiên cứu khoa học hoặc Olympic",
    "verifiedActivityCount": "Có căn cứ tham gia hoạt động thuộc tiêu chí",
}

ROLE_TERMS = (
    "lop truong", "lop pho", "bi thu", "pho bi thu", "uy vien ban chap hanh",
    "ban can su", "ban chap hanh", "chu nhiem clb", "pho chu nhiem",
    "can bo lop", "can bo doan", "can bo hoi", "thanh vien ban chu nhiem",
)
AWARD_TERMS = (
    "khen thuong", "giay khen", "quyet dinh khen", "duoc tang", "dat giai",
    "giai nhat", "giai nhi", "giai ba", "giai khuyen khich", "xuat sac",
)
CONFIRMATION_TERMS = ("xac nhan", "chung nhan", "quyet dinh")
AUTHORITY_TERMS = (
    "giang vien", "co van", "chu nhiem", "don vi phu trach",
    "ban chu nhiem", "doan truong", "hoi sinh vien", "nha truong",
)


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _contains(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _matches_requirement(key: str, text: str, activity_name: str, criterion: dict[str, Any]) -> bool | None:
    combined = f"{text}\n{activity_name}"
    if key == "leadershipRole":
        return _contains(combined, ROLE_TERMS)
    if key == "collectiveApprovalPercent":
        has_poll = _contains(combined, ("binh chon", "khao sat", "tap the", "dong thuan"))
        percentages = [float(value.replace(",", ".")) for value in re.findall(r"(?<!\d)(\d{1,3}(?:[.,]\d+)?)\s*%", combined)]
        return has_poll and any(value > 90 for value in percentages)
    if key == "advisorConfirmation":
        return _contains(combined, CONFIRMATION_TERMS) and _contains(combined, AUTHORITY_TERMS)
    if key == "excellentDutyConfirmation":
        return _contains(combined, ("hoan thanh xuat sac nhiem vu", "hoan thanh tot nhiem vu", "hoan thanh xuat sac"))
    if key == "awardEvidence":
        return _contains(combined, AWARD_TERMS)
    if key == "institutionAwardEvidence":
        has_award = _contains(combined, AWARD_TERMS)
        school_level = _contains(combined, ("cap truong", "toan truong", "truong dai hoc", "dai hoc da nang", "udn"))
        return has_award and school_level
    if key == "eligibleMembership":
        membership = _contains(combined, ("thanh vien", "la thanh vien", "tham gia clb", "tham gia cau lac bo", "nhom nghien cuu"))
        authority = _contains(combined, ("truong", "khoa", "doan thanh nien", "hoi sinh vien"))
        has_official_document = _contains(combined, CONFIRMATION_TERMS)
        return membership and authority and has_official_document
    if key == "organizerConfirmation":
        organizer = _contains(combined, ("ban to chuc", "cong tac vien", "tinh nguyen vien", "organizer"))
        confirmed = _contains(combined, CONFIRMATION_TERMS) and _contains(combined, AUTHORITY_TERMS)
        return organizer and confirmed
    if key == "awardTier":
        related = _contains(combined, ("nghien cuu khoa hoc", "olympic"))
        return related and _contains(combined, ("tham gia", "du thi", "dat giai", "giai"))
    if key == "verifiedActivityCount":
        code = str(criterion.get("code") or "")
        activity_groups = {
            "8": ("sinh hoat cong dan", "ky nang mem", "giao duc chinh tri", "noi quy"),
            "9": ("van hoa", "van nghe", "the thao"),
            "10": ("tuyen truyen", "phong chong toi pham", "te nan xa hoi", "phap luat"),
        }
        specific_terms = activity_groups.get(code)
        if specific_terms and not _contains(combined, specific_terms):
            return False
        participation = _contains(combined, ("tham gia", "du thi", "tinh nguyen", "hoat dong", "ngay hoi"))
        organizer = _contains(combined, ("truong", "khoa", "doan", "hoi sinh vien", "ban to chuc"))
        return participation and (organizer or not specific_terms)
    return None


def _score_for_full_match(config: dict[str, Any], max_score: float, key: str, text: str) -> float | None:
    kind = config.get("kind")
    if key == "awardTier":
        tiers = config.get("scores") or {}
        tier = "CONSOLATION_OR_HIGHER" if _contains(text, AWARD_TERMS) else "PARTICIPATED"
        return float(tiers.get(tier, max_score))
    if kind == "leadership_duty":
        return float(config.get("passScore", max_score))
    if kind == "verified_boolean":
        return float(config.get("passScore", max_score))
    if kind == "activity_threshold":
        tiers = config.get("tiers") or []
        return float(max((tier.get("score", 0) for tier in tiers if tier.get("min", 0) <= 1), default=0))
    return max_score


def evaluate_criterion(
    criterion: dict[str, Any],
    ocr_text: str,
    ocr_available: bool,
    activity_name: str,
    quality_passed: bool = True,
    student_code_mismatch: bool = False,
    evidence_mismatch_reason: str | None = None,
) -> dict[str, Any]:
    config = criterion.get("scoringConfig") or {}
    required = config.get("requiredData") or []
    max_score = float(criterion.get("maxScore") or 0)
    if not quality_passed:
        return {
            "status": "UNVERIFIABLE",
            "matchScore": None,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": None,
            "matchedRequirements": [],
            "missingRequirements": [REQUIREMENT_LABELS.get(key, key) for key in required],
            "reason": "Chất lượng tệp không đạt; yêu cầu ảnh rõ hơn trước khi đối chiếu rubric hoặc gợi ý điểm.",
        }
    if not ocr_available or not ocr_text.strip():
        return {
            "status": "UNVERIFIABLE",
            "matchScore": None,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": None,
            "matchedRequirements": [],
            "missingRequirements": [REQUIREMENT_LABELS.get(key, key) for key in required],
            "reason": "OCR không đọc được nội dung; không thể xác định mức phù hợp hoặc kết luận 0 điểm.",
        }
    if student_code_mismatch or evidence_mismatch_reason:
        mismatch_reason = evidence_mismatch_reason or "MSSV trích xuất được không khớp hồ sơ sinh viên"
        return {
            "status": "NOT_MATCHED",
            "matchScore": 0.0,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": 0,
            "matchedRequirements": [],
            "missingRequirements": [mismatch_reason],
            "reason": f"{mismatch_reason}; phân loại ĐỎ, gợi ý 0 điểm. Cán bộ cần đối chiếu ảnh gốc trước khi chốt.",
        }

    ml_prediction = predict_rubric_criterion(ocr_text, activity_name)

    def _with_ml(payload: dict[str, Any]) -> dict[str, Any]:
        if ml_prediction is not None:
            payload["mlPrediction"] = ml_prediction
            target_code = str(criterion.get("code") or "")
            pred_label = ml_prediction.get("predictedLabel")
            pred_code = ml_prediction.get("predictedCriterionCode")
            conf = float(ml_prediction.get("confidence") or 0.0)
            if pred_label == "KHONG_HOP_LE" and conf >= 0.65:
                payload["status"] = "NOT_MATCHED"
                payload["suggestedScore"] = 0
                payload["reason"] = (
                    f"Model ML ({ml_prediction['modelName']} v{ml_prediction.get('modelVersion', '2.0')}) phân loại tài liệu thuộc nhóm "
                    f"'{ml_prediction['predictedLabelName']}' (độ tin cậy {round(conf * 100)}%); gợi ý 0 điểm, cần cán bộ kiểm tra."
                )
            elif pred_code and target_code and pred_code != target_code and conf >= 0.65:
                payload["reason"] = (
                    f"{payload['reason']} [Model ML ({ml_prediction['modelName']}) dự đoán minh chứng phù hợp hơn với "
                    f"{ml_prediction['predictedLabelName']} — độ tin cậy {round(conf * 100)}%.]"
                )
        return payload

    text = _normalize(ocr_text)
    activity = _normalize(activity_name)
    evaluated = [(key, _matches_requirement(key, text, activity, criterion)) for key in required]
    known = [(key, matched) for key, matched in evaluated if matched is not None]
    matched = [REQUIREMENT_LABELS.get(key, key) for key, value in known if value]
    missing = [REQUIREMENT_LABELS.get(key, key) for key, value in evaluated if value is not True]
    if not known:
        return _with_ml({
            "status": "UNVERIFIABLE",
            "matchScore": None,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": None,
            "matchedRequirements": [],
            "missingRequirements": [REQUIREMENT_LABELS.get(key, key) for key in required],
            "reason": "Tiêu chí cần dữ liệu học vụ/xác minh tổng hợp; một tệp minh chứng không đủ để tính điểm.",
        })

    match_score = round(sum(value is True for _, value in known) / len(required) * 100, 1)
    if len(known) < len(required):
        return _with_ml({
            "status": "UNVERIFIABLE",
            "matchScore": match_score,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": None,
            "matchedRequirements": matched,
            "missingRequirements": missing,
            "reason": "Một phần điều kiện không thể kiểm tra chỉ từ OCR; cần cán bộ đối chiếu rubric và hồ sơ gốc.",
        })
    if match_score < MATCH_THRESHOLD:
        return _with_ml({
            "status": "NOT_MATCHED",
            "matchScore": match_score,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": 0,
            "matchedRequirements": matched,
            "missingRequirements": missing,
            "reason": f"Tỷ lệ điều kiện rubric tìm thấy {match_score}% thấp hơn ngưỡng {MATCH_THRESHOLD}%; gợi ý 0 điểm. Cán bộ vẫn cần xác nhận.",
        })
    if not all(value is True for _, value in known):
        return _with_ml({
            "status": "NEEDS_HUMAN_REVIEW",
            "matchScore": match_score,
            "threshold": MATCH_THRESHOLD,
            "suggestedScore": None,
            "matchedRequirements": matched,
            "missingRequirements": missing,
            "reason": "Chưa đủ tất cả điều kiện bắt buộc để gợi ý điểm khác 0; cần cán bộ xác minh.",
        })

    scoring_key = required[0] if required else ""
    score = _score_for_full_match(config, max_score, scoring_key, text)
    return _with_ml({
        "status": "MATCHED",
        "matchScore": match_score,
        "threshold": MATCH_THRESHOLD,
        "suggestedScore": min(max_score, max(0, score)) if score is not None else None,
        "matchedRequirements": matched,
        "missingRequirements": missing,
        "reason": "OCR có dấu hiệu đáp ứng các điều kiện được kiểm tra; điểm chỉ là gợi ý và cần cán bộ xác nhận với hồ sơ gốc.",
    })
