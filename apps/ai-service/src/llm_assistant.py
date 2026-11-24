"""
Trợ lý AI Hybrid có kiểm soát (Groq / OpenAI-compatible API) — Giai đoạn 3 (DEC-015).

4 Chốt chặn kỹ thuật bắt buộc:
  1. Tường lửa PII 3 lớp (PII Firewall):
     - Lớp 1: Xóa mờ theo hồ sơ SV đã biết (`studentName`, `studentCode`, `citizenId`, `ocrExtractedName`)
       bằng so khớp không dấu & cửa sổ trượt (bắt được cả tên lỗi dấu OCR như "Nguyền Thanh Hang", "DangNgocBaoPhuiong").
     - Lớp 2: Cắt bỏ nguyên dòng định danh (`Identity-Zone Line Dropping`) quanh các nhãn Họ tên, Sinh viên,
       Đồng chí, Trao cho / Awarded to, MSSV, CCCD, Ngày sinh, Chi đoàn/Lớp, Lượng máu...
     - Lớp 3: Quét khóa cuối Regex cho Email, SĐT, chuỗi số >= 8 chữ số và cụm tên in hoa độc lập.
     TUYỆT ĐỐI KHÔNG BAO GIỜ gửi ảnh gốc ra bên ngoài.
  2. Smart Gatekeeper: Chỉ gọi API khi PhoBERT nội bộ có độ tin cậy < 0.65, khoảng cách Top1-Top2 < 0.15,
     hoặc ca nhạy cảm vai trò/cấp giải (Mục 5, 9, 13, 14, 15, 16) mà rule nội bộ chưa bóc tách được.
  3. Event-Level SQLite Cache (7 ngày): Cùng một sự kiện nộp bởi 100 sinh viên chỉ gọi Groq đúng 1 lần.
  4. Circuit Breaker & Graceful Fallback (timeout 4s): Tự động thử model dự phòng khi gặp HTTP 429;
     nếu lỗi mạng/timeout/tắt cờ thì trả `None` để giữ nguyên 100% kết quả PhoBERT ONNX nội bộ.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import threading
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

import httpx

from .config import settings
from .predictor import CRITERION_HUMAN_NAMES, CRITERION_LABEL_TO_CODE, ORDERED_LABELS

logger = logging.getLogger(__name__)

VALID_LABELS = set(ORDERED_LABELS)
VALID_ROLES = {"PARTICIPANT", "ORGANIZER", "CHEERLEADER", "LEADERSHIP", "UNKNOWN"}
VALID_AWARDS = {"AWARDED", "PARTICIPATED_ONLY", "EXCELLENT_DUTY", "SCHOOL_LEVEL_AWARD", "FACULTY_OR_CLUB_AWARD", "NONE"}
VALID_WEB_VERDICTS = {"VERIFIED_MATCH", "WRONG_YEAR_OR_EVENT", "INSUFFICIENT_INFO", "NOT_CHECKED"}

# Nhãn dòng định danh cần cắt bỏ nguyên dòng (so khớp trên văn bản đã bỏ dấu)
IDENTITY_LINE_MARKERS: tuple[str, ...] = (
    "ho va ten",
    "ho ten:",
    "sinh vien:",
    "ten sinh vien",
    "dong chi:",
    "dong chi ",
    "anh/chi",
    "ong/ba",
    "nguoi hien",
    "trao cho",
    "trao tang",
    "kinh tang",
    "presented to",
    "is awarded to",
    "awarded to",
    "this is to certify that",
    "certifies that",
    "mssv",
    "ma so sv",
    "ma sinh vien",
    "ma so:",
    "so the sv",
    "cccd",
    "cmnd",
    "so dinh danh",
    "ngay sinh",
    "sinh ngay",
    "date of birth",
    "noi sinh",
    "que quan",
    "dia chi:",
    "dien thoai",
    "sdt:",
    "email:",
    "chi doan:",
    "chi doan ",
    "chi hoi:",
    "chi hoi ",
    "lop:",
    "lop ",
    "luong mau",
    "the tich mau",
    "nhom mau",
)

# Nhãn mở đầu mà dòng NGAY TIẾP THEO thường là tên riêng sinh viên đứng một mình
SALUTATION_HEADERS: tuple[str, ...] = (
    "trao cho",
    "trao tang",
    "kinh tang",
    "presented to",
    "presented to/trao cho",
    "is awarded to",
    "awarded to",
    "anh/chi",
    "dong chi",
    "chung nhan sinh vien",
)

# Từ khóa tổ chức/sự kiện: dùng cụm từ rõ nghĩa để không nhầm với họ/tên đệm người Việt như "Đoàn", "Hội", "Trường"
EVENT_OR_ORG_KEYWORDS: tuple[str, ...] = (
    "truong dai hoc", "dai hoc", "khoa ", "doan thanh nien", "doan truong", "doan tncs",
    "tinh doan", "thanh doan", "hoi sinh vien", "lien chi", "cau lac bo", "clb ", "trung tam",
    "chien dich", "chuong trinh", "cuoc thi", "hoi thao", "hoi nghi", "ngay hoi",
    "giai ", "tinh nguyen", "hien mau", "van nghe", "the thao", "nghien cuu",
    "olympic", "cong tac vien", "ban to chuc", "ban chap hanh", "khen thuong", "giay khen",
    "chung nhan", "quyet dinh", "certificate", "volunteer", "campaign", "university",
    "workshop", "seminar", "competition", "award", "excellence", "participat",
    "thanh pho", "da nang", "viet nam", "bach khoa", "su pham", "kinh te",
)

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)")
LONG_DIGITS_RE = re.compile(r"\b\d{8,15}\b")
CLASS_CODE_RE = re.compile(r"\b\d{2}[A-Z]{2,6}\d?[A-Z]?\b")
DOB_RE = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-](?:19\d{2}|200\d|201\d)\b")

_MEM_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_LOCK = threading.Lock()

SYSTEM_PROMPT = """Bạn là chuyên gia thẩm định minh chứng Điểm rèn luyện của Trường Đại học Bách khoa - Đại học Đà Nẵng (DUT).
Văn bản đầu vào đã được ẩn danh hoàn toàn thông tin cá nhân sinh viên. Nhiệm vụ của bạn là đọc nội dung sự kiện/vai trò/khen thưởng và trả về DUY NHẤT một JSON object hợp lệ theo đúng schema dưới đây (không kèm markdown).

Danh sách 11 nhãn tiêu chí hợp lệ (`predictedLabel`):
- "MUC_4": Tham gia CLB học thuật, nhóm nghiên cứu, khởi nghiệp đổi mới sáng tạo, khóa tập huấn học thuật chuyên môn.
- "MUC_5": Tham gia hoặc đạt giải Nghiên cứu khoa học (NCKH), Olympic môn học, cuộc thi học thuật/lập trình/AI/ngoại ngữ.
- "MUC_8": Giáo dục chính trị, tư tưởng, sinh hoạt công dân, kỹ năng mềm, định hướng tân sinh viên, tài chính cá nhân.
- "MUC_9": Hoạt động văn hóa, văn nghệ, thể thao, giải chạy, hội thao, giao lưu văn hóa (vai trò tham gia hoặc cổ vũ).
- "MUC_10": Tuyên truyền pháp luật, phòng chống tội phạm, ma túy, tệ nạn xã hội, an toàn giao thông, không gian mạng.
- "MUC_12": Phục vụ cộng đồng, tình nguyện, công tác xã hội, Chủ nhật xanh, Mùa hè xanh, hiến máu, bảo vệ môi trường, gây quỹ thiện nguyện, sinh hoạt hè địa phương.
- "MUC_13": Thành viên Ban tổ chức (BTC), Cộng tác viên (CTV), hỗ trợ công tác tổ chức sự kiện của Lớp/Khoa/Trường/Đơn vị.
- "MUC_14": Cán bộ lớp, BCH Đoàn/Hội, BCN CLB hoàn thành tốt nhiệm vụ (có xác nhận hoặc bình chọn >90%).
- "MUC_15": Cán bộ lớp, Đoàn/Hội, CLB hoàn thành xuất sắc nhiệm vụ và có giấy khen cấp Khoa/CLB/Đơn vị.
- "MUC_16": Cán bộ đoàn thể/lớp được khen thưởng cấp Trường, Đại học Đà Nẵng hoặc cấp Thành phố/Trung ương trở lên.
- "KHONG_HOP_LE": Hóa đơn, chứng chỉ thương mại trực tuyến ngoài quy chế (Coursera/HubSpot/Udemy tự học không thuộc hoạt động Đoàn-Trường), bảng điểm học tập thuần túy, hoặc nội dung rác không liên quan.

Schema JSON bắt buộc:
{
  "predictedLabel": "<1 trong 11 nhãn trên>",
  "confidence": 0.85,
  "activityName": "<tên sự kiện ngắn gọn hoặc chuỗi rỗng>",
  "organizer": "<đơn vị tổ chức hoặc chuỗi rỗng>",
  "participantRole": "<PARTICIPANT | ORGANIZER | CHEERLEADER | LEADERSHIP | UNKNOWN>",
  "awardLevel": "<AWARDED | PARTICIPATED_ONLY | EXCELLENT_DUTY | SCHOOL_LEVEL_AWARD | FACULTY_OR_CLUB_AWARD | NONE>",
  "webMatchVerdict": "<VERIFIED_MATCH | WRONG_YEAR_OR_EVENT | INSUFFICIENT_INFO | NOT_CHECKED>",
  "reviewerSummaryVi": "<1-2 câu tiếng Việt ngắn gọn giải thích cho Cán bộ Khoa: sự kiện gì, vai trò gì, phù hợp mục nào, cần lưu ý kiểm tra gì; tuyệt đối không bịa thông tin>"
}"""


def _strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", str(text or ""))
    no_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return no_marks.replace("đ", "d").replace("Đ", "D").lower()


def _get_api_key() -> str:
    return (settings.GROQ_API_KEY or settings.LLM_API_KEY or "").strip()


def is_llm_assistant_enabled() -> bool:
    return bool(settings.EXTERNAL_LLM_EXTRACTION_ENABLED and _get_api_key())


def _scrub_known_name_fuzzy(line: str, known_names: list[str]) -> str:
    """Lớp 1: Xóa mờ tên sinh viên đã biết kể cả khi OCR sai dấu hoặc dính chữ (vd: DangNgocBaoPhuiong)."""
    out = line
    for raw_name in known_names:
        clean_name = re.sub(r"\s+", " ", str(raw_name or "")).strip()
        if len(clean_name) < 4:
            continue
        norm_name = _strip_accents(clean_name)
        name_tokens = [t for t in re.split(r"[^a-z0-9]+", norm_name) if t]
        if len(name_tokens) < 2:
            continue
        compact_name = "".join(name_tokens)

        # 1a. Trường hợp OCR làm dính liền chữ cái tên (vd: "DangNgocBaoPhuiong")
        words = list(re.finditer(r"[A-Za-zÀ-ỹ]{6,}", out))
        for m in reversed(words):
            cand_compact = re.sub(r"[^a-z0-9]", "", _strip_accents(m.group(0)))
            if len(cand_compact) >= max(6, len(compact_name) - 3):
                ratio = SequenceMatcher(None, compact_name, cand_compact).ratio()
                if ratio >= 0.74:
                    out = out[: m.start()] + "[REDACTED_STUDENT]" + out[m.end() :]

        # 1b. Cửa sổ trượt theo số từ của tên thật (bắt lỗi dấu/nhầm chữ OCR như "Nguyền Thanh Hang")
        word_matches = list(re.finditer(r"[A-Za-zÀ-ỹ]+", out))
        n = len(name_tokens)
        if len(word_matches) >= n:
            spans_to_redact: list[tuple[int, int]] = []
            for i in range(len(word_matches) - n + 1):
                window_text = " ".join(_strip_accents(word_matches[i + k].group(0)) for k in range(n))
                if SequenceMatcher(None, norm_name, window_text).ratio() >= 0.75:
                    spans_to_redact.append((word_matches[i].start(), word_matches[i + n - 1].end()))
            for start, end in reversed(spans_to_redact):
                out = out[:start] + "[REDACTED_STUDENT]" + out[end:]
    return out


def _looks_like_standalone_person_name(segment: str) -> bool:
    norm = _strip_accents(segment).strip()
    if not norm or any(kw in norm for kw in EVENT_OR_ORG_KEYWORDS):
        return False
    tokens = [t for t in re.findall(r"[A-Za-zÀ-ỹ.]+", segment) if len(t) >= 1]
    if not (2 <= len(tokens) <= 5):
        return False
    if any(ch.isdigit() for ch in segment):
        return False
    return len(segment.strip()) <= 45


def sanitize_event_text_for_llm(
    raw_text: str,
    activity_name: str = "",
    *,
    declared_student_name: str = "",
    declared_student_code: str = "",
    declared_citizen_id: str = "",
    ocr_extracted_name: str = "",
    ocr_extracted_code: str = "",
) -> str:
    """
    Tường lửa PII 3 lớp: chỉ giữ lại nội dung sự kiện, đơn vị tổ chức, vai trò, cấp giải.
    Tuyệt đối cắt bỏ vùng định danh cá nhân trước khi gửi sang LLM API.
    """
    known_names = [x for x in (declared_student_name, ocr_extracted_name) if x and len(str(x).strip()) >= 4]
    known_ids = [str(x).strip() for x in (declared_student_code, declared_citizen_id, ocr_extracted_code) if x and len(str(x).strip()) >= 5]

    combined_raw = f"{activity_name or ''}\n{raw_text or ''}".strip()
    if not combined_raw:
        return ""

    # Tách theo dòng và dấu gạch đứng '|' (cách ghép box của OCR)
    raw_segments = [seg.strip() for line in combined_raw.splitlines() for seg in line.split("|") if seg.strip()]

    kept_segments: list[str] = []
    skip_next_if_name = False

    for seg in raw_segments:
        # Lớp 1: Xóa mã định danh và tên sinh viên đã biết từ hồ sơ
        cleaned = seg
        for kid in known_ids:
            cleaned = re.sub(re.escape(kid), "[REDACTED_ID]", cleaned, flags=re.IGNORECASE)
        cleaned = _scrub_known_name_fuzzy(cleaned, known_names)

        norm_seg = re.sub(r"\s+", " ", _strip_accents(cleaned)).strip()

        # Nếu dòng ngay trước là nhãn "Trao cho / Is awarded to / Đồng chí", cắt bỏ dòng tên riêng đứng ngay sau
        if skip_next_if_name:
            skip_next_if_name = False
            if "[REDACTED_STUDENT]" in cleaned or _looks_like_standalone_person_name(cleaned):
                continue

        # Kiểm tra xem dòng hiện tại có phải tiêu đề xưng hô mở đầu cho dòng tên kế tiếp không
        if norm_seg.rstrip(":.") in SALUTATION_HEADERS:
            skip_next_if_name = True
            continue

        # Lớp 2: Cắt bỏ nguyên dòng chứa nhãn vùng định danh (trừ khi đồng thời chứa từ khóa tên sự kiện dài, khi đó cắt vế định danh)
        if any(marker in norm_seg for marker in IDENTITY_LINE_MARKERS):
            if not any(kw in norm_seg for kw in ("chuong trinh", "chien dich", "cuoc thi", "hoi thao", "hoi nghi", "giai ")):
                continue
            # Nếu 1 dòng gộp cả lớp/tên và tên chương trình, xóa phần trước từ khóa sự kiện
            cleaned = re.sub(
                r"^.*?(?=(?:da\s+tham\s+gia|da\s+tich\s+cuc|tham\s+gia|chuong\s+trinh|chien\s+dich|cuoc\s+thi|hoi\s+thao|hoi\s+nghi))",
                "",
                cleaned,
                flags=re.IGNORECASE,
            ).strip()
            if not cleaned:
                continue

        # Lớp 3: Quét khóa cuối Regex (Email, SĐT, chuỗi số >= 8 ký tự, mã lớp, ngày sinh, cụm tên IN HOA độc lập)
        cleaned = EMAIL_RE.sub("[REDACTED_EMAIL]", cleaned)
        cleaned = PHONE_RE.sub("[REDACTED_PHONE]", cleaned)
        cleaned = DOB_RE.sub("[REDACTED_DOB]", cleaned)
        cleaned = LONG_DIGITS_RE.sub("[REDACTED_ID]", cleaned)
        cleaned = CLASS_CODE_RE.sub("[REDACTED_CLASS]", cleaned)

        if cleaned.isupper() and _looks_like_standalone_person_name(cleaned):
            continue
        if cleaned in {"[REDACTED_STUDENT]", "[REDACTED_ID]", "[REDACTED_NAME]", "[REDACTED_POSSIBLE_NAME]"}:
            continue

        # Dọn các thẻ REDACTED đứng lẻ để payload gọn sạch
        cleaned = re.sub(r"\[REDACTED_[A-Z_]+\]", "", cleaned).strip(" -:|,.;")
        if len(cleaned) >= 3:
            kept_segments.append(cleaned)

    sanitized = " | ".join(kept_segments)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized[:1200]


class EventLlmCache:
    """Bộ nhớ đệm theo sự kiện (TTL 7 ngày) bằng SQLite, tự fallback sang RAM nếu ổ đĩa chỉ-đọc."""

    @staticmethod
    def make_key(sanitized_event_text: str, target_code: str, web_snippet: str = "") -> str:
        norm_payload = f"{settings.LLM_MODEL}|{target_code}|{_strip_accents(sanitized_event_text)}|{_strip_accents(web_snippet)[:240]}"
        return hashlib.sha256(norm_payload.encode("utf-8")).hexdigest()

    @staticmethod
    def get(key: str) -> Optional[dict[str, Any]]:
        now = time.time()
        ttl = max(60, int(settings.LLM_CACHE_TTL_SECONDS))
        with _CACHE_LOCK:
            mem_hit = _MEM_CACHE.get(key)
            if mem_hit and (now - mem_hit[0]) <= ttl:
                return dict(mem_hit[1])
            try:
                db_path = Path(settings.LLM_CACHE_PATH)
                if not db_path.exists():
                    return None
                with sqlite3.connect(str(db_path), timeout=2.0) as conn:
                    row = conn.execute("SELECT created_at, response_json FROM llm_event_cache WHERE cache_key = ?", (key,)).fetchone()
                    if row and (now - float(row[0])) <= ttl:
                        data = json.loads(row[1])
                        _MEM_CACHE[key] = (float(row[0]), data)
                        return dict(data)
            except Exception as exc:
                logger.debug("LLM cache read skipped: %s", exc)
        return None

    @staticmethod
    def set(key: str, value: dict[str, Any]) -> None:
        now = time.time()
        with _CACHE_LOCK:
            _MEM_CACHE[key] = (now, dict(value))
            try:
                db_path = Path(settings.LLM_CACHE_PATH)
                db_path.parent.mkdir(parents=True, exist_ok=True)
                with sqlite3.connect(str(db_path), timeout=2.0) as conn:
                    conn.execute(
                        "CREATE TABLE IF NOT EXISTS llm_event_cache (cache_key TEXT PRIMARY KEY, created_at REAL NOT NULL, response_json TEXT NOT NULL)"
                    )
                    conn.execute(
                        "INSERT OR REPLACE INTO llm_event_cache (cache_key, created_at, response_json) VALUES (?, ?, ?)",
                        (key, now, json.dumps(value, ensure_ascii=False)),
                    )
                    conn.commit()
            except Exception as exc:
                logger.debug("LLM SQLite cache write fallback to memory only: %s", exc)


def should_escalate_to_llm(
    *,
    ml_prediction: Optional[dict[str, Any]],
    target_code: str,
    rule_status: str,
    web_snippet: str = "",
) -> tuple[bool, Optional[str]]:
    """Smart Gatekeeper: quyết định có cần gọi LLM API hay trả kết quả nội bộ ngay."""
    if not is_llm_assistant_enabled():
        return False, None

    if ml_prediction is None:
        return True, "MISSING_LOCAL_ML"

    conf = float(ml_prediction.get("confidence") or 0.0)
    if conf < settings.LLM_GATEKEEPER_CONFIDENCE_THRESHOLD:
        return True, "LOW_ML_CONFIDENCE"

    # Khi OCR mất dấu tiếng Việt hoặc là tiếng Anh (lowDiacriticOcr), nâng ngưỡng cảnh giác lên 0.85 để chặn tự tin ảo của PhoBERT
    if ml_prediction.get("lowDiacriticOcr") and conf < 0.85:
        return True, "LOW_DIACRITIC_OR_ENGLISH_OCR"

    cands = ml_prediction.get("topCandidates") or []
    if len(cands) >= 2:
        margin = float(cands[0].get("probability") or 0.0) - float(cands[1].get("probability") or 0.0)
        if margin < settings.LLM_GATEKEEPER_MARGIN_THRESHOLD:
            return True, "SMALL_TOP2_MARGIN"

    pred_code = str(ml_prediction.get("predictedCriterionCode") or "")
    if target_code and pred_code and pred_code != target_code:
        return True, "CRITERION_MISMATCH_EXPLANATION"

    if target_code in {"5", "9", "13", "14", "15", "16"} and rule_status in {"NOT_MATCHED", "NEEDS_HUMAN_REVIEW", "UNVERIFIABLE"}:
        return True, "SENSITIVE_ROLE_OR_AWARD"

    if web_snippet.strip():
        return True, "EXTERNAL_WEB_SEMANTIC_CHECK"

    return False, None


def _parse_and_validate_llm_json(raw_content: str) -> Optional[dict[str, Any]]:
    cleaned = re.sub(r"<think>.*?</think>", "", str(raw_content or ""), flags=re.DOTALL | re.IGNORECASE).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx : end_idx + 1]
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        return None

    label = str(data.get("predictedLabel") or "").strip().upper()
    if label not in VALID_LABELS:
        return None

    try:
        conf = max(0.0, min(1.0, float(data.get("confidence", 0.7))))
    except (TypeError, ValueError):
        conf = 0.7

    role = str(data.get("participantRole") or "UNKNOWN").strip().upper()
    if role not in VALID_ROLES:
        role = "UNKNOWN"

    award = str(data.get("awardLevel") or "NONE").strip().upper()
    if award not in VALID_AWARDS:
        award = "NONE"

    web_verdict = str(data.get("webMatchVerdict") or "NOT_CHECKED").strip().upper()
    if web_verdict not in VALID_WEB_VERDICTS:
        web_verdict = "NOT_CHECKED"

    summary = re.sub(r"\s+", " ", str(data.get("reviewerSummaryVi") or "")).strip()[:360]
    return {
        "predictedLabel": label,
        "predictedCriterionCode": CRITERION_LABEL_TO_CODE.get(label),
        "predictedLabelName": CRITERION_HUMAN_NAMES.get(label, label),
        "confidence": round(conf, 4),
        "activityName": str(data.get("activityName") or "").strip()[:180],
        "organizer": str(data.get("organizer") or "").strip()[:180],
        "participantRole": role,
        "awardLevel": award,
        "webMatchVerdict": web_verdict,
        "reviewerSummaryVi": summary,
    }


def assist_rubric_evaluation(
    *,
    raw_ocr_text: str,
    activity_name: str = "",
    target_code: str = "",
    local_ml_prediction: Optional[dict[str, Any]] = None,
    web_snippet: str = "",
    declared_student_name: str = "",
    declared_student_code: str = "",
    declared_citizen_id: str = "",
    ocr_extracted_name: str = "",
    ocr_extracted_code: str = "",
    escalation_reason: str = "LOW_ML_CONFIDENCE",
    transport: Optional[httpx.BaseTransport] = None,
) -> Optional[dict[str, Any]]:
    """
    Thực thi truy vấn Groq / OpenAI-compatible LLM sau khi đi qua Tường lửa PII 3 lớp & Event Cache.
    Trả về `None` an toàn nếu tính năng tắt, văn bản rỗng sau lọc, hoặc gặp sự cố mạng/timeout.
    """
    if not is_llm_assistant_enabled():
        return None

    sanitized_text = sanitize_event_text_for_llm(
        raw_ocr_text,
        activity_name,
        declared_student_name=declared_student_name,
        declared_student_code=declared_student_code,
        declared_citizen_id=declared_citizen_id,
        ocr_extracted_name=ocr_extracted_name,
        ocr_extracted_code=ocr_extracted_code,
    )
    if len(sanitized_text) < 8:
        return None

    sanitized_web = sanitize_event_text_for_llm(web_snippet, "") if web_snippet else ""
    cache_key = EventLlmCache.make_key(sanitized_text, target_code, sanitized_web)
    cached = EventLlmCache.get(cache_key)
    if cached is not None:
        cached["cacheHit"] = True
        cached["escalationReason"] = escalation_reason
        return cached

    local_hint = (
        f"{local_ml_prediction.get('predictedLabel')} ({local_ml_prediction.get('confidence')})"
        if local_ml_prediction
        else "NONE"
    )
    user_prompt = (
        f"Tiêu chí sinh viên đang chọn: Mục {target_code or 'chưa rõ'}\n"
        f"Dự đoán sơ bộ từ PhoBERT nội bộ: {local_hint}\n"
        f"Nội dung sự kiện từ minh chứng (đã ẩn danh PII): {sanitized_text}\n"
    )
    if sanitized_web:
        user_prompt += f"Kết quả tra cứu web công khai (nếu có): {sanitized_web[:350]}\n"

    api_key = _get_api_key()
    url = f"{settings.LLM_API_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    models_to_try = [settings.LLM_MODEL]
    if settings.LLM_FALLBACK_MODEL and settings.LLM_FALLBACK_MODEL != settings.LLM_MODEL:
        models_to_try.append(settings.LLM_FALLBACK_MODEL)

    try:
        with httpx.Client(timeout=settings.LLM_TIMEOUT_SECONDS, transport=transport) as client:
            for model_name in models_to_try:
                payload = {
                    "model": model_name,
                    "temperature": 0.1,
                    "max_tokens": 1200,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                }
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code in (429, 404, 400) and model_name != models_to_try[-1]:
                    logger.info("LLM primary model %s returned HTTP %s; retrying fallback %s", model_name, resp.status_code, models_to_try[-1])
                    continue
                resp.raise_for_status()
                body = resp.json()
                content = body["choices"][0]["message"]["content"]
                parsed = _parse_and_validate_llm_json(content)
                if parsed is None:
                    logger.warning("LLM returned invalid schema/label from %s", model_name)
                    return None
                parsed["llmModel"] = model_name
                parsed["cacheHit"] = False
                parsed["escalationReason"] = escalation_reason
                parsed["sanitizedCharCount"] = len(sanitized_text)
                EventLlmCache.set(cache_key, parsed)
                return parsed
    except Exception as exc:
        logger.warning("Smart LLM escalation failed gracefully (%s); keeping local ONNX result.", exc)
        return None
    return None
