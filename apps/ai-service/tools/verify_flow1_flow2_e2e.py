"""Xác minh tích hợp THẬT Luồng 1 + Luồng 2 trên ảnh minh chứng thật, sinh `e2e_result.json`.

Luồng 1 chạy thật toàn bộ: cổng chất lượng, ELA/SHA-256/pHash, OCR Tesseract, đối chiếu
danh tính, phôi, chấm điểm và phân luồng. Chỉ giả lập DUY NHẤT lớp HTTP ra DuckDuckGo của
Luồng 2 (trả HTML có kết quả trên tên miền DUT) để chạy tất định, không cần internet. Nhờ đó
khẳng định được đường code Luồng 1 gọi Luồng 2 thật sự hoạt động: tra cứu chạy, lọc tên miền,
cộng điểm tin cậy và mở mục kiểm tra "source".

Ghi `e2e_result.json` (status + durationMs + version/config/rule + input hash + evidence) để
đóng mục #5 của cổng nghiệm thu.

Chạy:
    python apps/ai-service/tools/verify_flow1_flow2_e2e.py
Biến môi trường (tùy chọn): TESSERACT_CMD, TESSERACT_LANGUAGES, E2E_SAMPLE_ID.
"""

import argparse
import asyncio
import base64
import csv
import hashlib
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.pipeline_orchestrator import UnifiedPipelineOrchestrator
from src.schemas import DeclaredStudent, UnifiedInspectionRequest
from src.web_search_verifier import WebSearchVerifierService

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATASET = REPO_ROOT / "docs" / "Minh chứng Lọc" / "dataset-local"
DEFAULT_REVIEW_DIR = DEFAULT_DATASET / "can-doi-chieu"
AI_SERVICE_VERSION = "2.1.0"
DUT_PUBLIC_URL = "https://dut.udn.vn/News/evt-001"
SOCIAL_PUBLIC_URL = "https://www.facebook.com/DUT.UDN/posts/evt-001"


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _configure_ocr() -> dict[str, Any]:
    """Định vị Tesseract và chọn bộ ngôn ngữ cài sẵn, trả về thông tin đã dùng."""
    import pytesseract

    cmd = os.getenv("TESSERACT_CMD") or shutil.which("tesseract")
    if not cmd:
        for candidate in (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ):
            if Path(candidate).exists():
                cmd = candidate
                break
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd

    requested = os.getenv("TESSERACT_LANGUAGES", "vie+eng")
    try:
        available = set(pytesseract.get_languages(config=""))
    except Exception as error:  # noqa: BLE001 - báo rõ lý do thay vì làm sập
        return {
            "tesseractCmd": cmd,
            "requestedLanguages": requested,
            "usedLanguages": requested,
            "availableLanguages": [],
            "error": str(error),
        }
    wanted = [item.strip() for item in requested.split("+") if item.strip()]
    usable = [item for item in wanted if item in available]
    if not usable and "eng" in available:
        usable = ["eng"]
    used = "+".join(usable)
    if used:
        os.environ["TESSERACT_LANGUAGES"] = used
    return {
        "tesseractCmd": cmd,
        "requestedLanguages": requested,
        "usedLanguages": used or requested,
        "availableLanguages": sorted(available),
    }


def _ddg_html(activity_name: str) -> str:
    """HTML giả lập trang kết quả DuckDuckGo: 1 kết quả mạng xã hội (ngoài DUT) + 1 kết quả DUT.

    Cả hai đều đạt ngưỡng khớp như nhau, nhờ đó chứng minh Luồng 2 ưu tiên nguồn chính thống.
    """
    safe = (
        activity_name.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return f"""
    <div class="result">
      <h2 class="result__title"><a href="{SOCIAL_PUBLIC_URL}">{safe}</a></h2>
      <a class="result__snippet">Bài đăng trên Fanpage về hoạt động tình nguyện.</a>
    </div>
    <div class="result">
      <h2 class="result__title"><a href="{DUT_PUBLIC_URL}">{safe}</a></h2>
      <a class="result__snippet">Hoạt động do Trường Đại học Đà Nẵng tổ chức.</a>
    </div>
    """


def _ddg_html_social_only(activity_name: str) -> str:
    """HTML chỉ có kết quả mạng xã hội (ngoài DUT) để chứng minh mức cộng điểm tầng thấp (+10)."""
    safe = (
        activity_name.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return f"""
    <div class="result">
      <h2 class="result__title"><a href="{SOCIAL_PUBLIC_URL}">{safe}</a></h2>
      <a class="result__snippet">Bài đăng trên Fanpage về hoạt động tình nguyện.</a>
    </div>
    """


def _fake_async_client(html: str, recorder: dict[str, Any]):
    """Tạo lớp AsyncClient giả trả HTML cố định; ghi lại URL đã gọi để chứng minh luồng chạy."""

    class _FakeResponse:
        def __init__(self, text: str, status_code: int = 200) -> None:
            self.text = text
            self.status_code = status_code

        def raise_for_status(self) -> None:
            if self.status_code >= 400:
                raise RuntimeError(f"HTTP {self.status_code}")

    class _FakeAsyncClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self._html = html

        async def __aenter__(self) -> "_FakeAsyncClient":
            return self

        async def __aexit__(self, *exc: Any) -> bool:
            return False

        async def get(self, url: str, headers: Optional[dict] = None) -> _FakeResponse:
            recorder["called"] = True
            recorder["url"] = url
            return _FakeResponse(self._html)

    return _FakeAsyncClient


def _declared_from_ocr(response: Any) -> DeclaredStudent:
    """Khai báo sinh viên bám theo kết quả OCR để không tạo mismatch danh tính giả.

    OCR trích được tên/MSSV nào thì dùng đúng giá trị đó; nếu không trích được thì để trống
    (không bịa), nhờ vậy tra cứu công khai không bị bỏ qua vì lý do định danh.
    """
    ocr = getattr(response, "ocrExtraction", None)
    name = (getattr(ocr, "studentNameExtracted", None) or "").strip() or "Sinh viên khai báo"
    code = (getattr(ocr, "studentCodeExtracted", None) or "").strip() or None
    return DeclaredStudent(fullName=name, studentCode=code, citizenId=None)


async def _process(request: UnifiedInspectionRequest) -> Any:
    return await UnifiedPipelineOrchestrator.process(request)


async def verify(
    dataset_dir: Path,
    review_dir: Path,
    index_path: Path,
    sample_id: Optional[str] = None,
) -> dict[str, Any]:
    ocr_info = _configure_ocr()
    rows = _read_csv(index_path)
    if sample_id:
        rows = [row for row in rows if row["sample_id"] == sample_id]
    # Ưu tiên mẫu đã được gán nhãn chất lượng "pass" để vượt cổng chất lượng.
    rows.sort(key=lambda row: 0 if (row.get("quality") or "").strip() == "pass" else 1)

    checks: list[dict[str, Any]] = []
    started = time.perf_counter()

    def add_check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    selected: Optional[dict[str, Any]] = None
    for row in rows:
        file_path = review_dir / row.get("review_file", "")
        if not file_path.exists():
            continue
        raw = file_path.read_bytes()
        probe = UnifiedInspectionRequest(
            evidenceId=row["sample_id"],
            activityName=(row.get("activity") or "").strip() or "Hoạt động chưa khai báo",
            evidenceType=(row.get("document_type") or "GIAY_CHUNG_NHAN").strip(),
            declaredStudent=DeclaredStudent(fullName="Sinh viên khai báo", studentCode=None),
            fileBytesBase64=base64.b64encode(raw).decode(),
            enableWebSearch=False,
        )
        try:
            probe_response = await _process(probe)
        except Exception as error:  # noqa: BLE001 - thử mẫu kế tiếp
            add_check(f"probe:{row['sample_id']}", False, f"lỗi pipeline: {error}")
            continue
        if probe_response.pipelineMode == "DOCUMENT_PIPELINE" and probe_response.qualityCheck.passed:
            selected = {
                "row": row,
                "filePath": file_path,
                "raw": raw,
                "probe": probe_response,
            }
            break

    if selected is None:
        raise SystemExit("Không có ảnh minh chứng thật nào vượt cổng chất lượng để chạy xác minh.")

    row = selected["row"]
    raw = selected["raw"]
    probe = selected["probe"]
    activity_name = (row.get("activity") or "").strip() or "Hoạt động chưa khai báo"
    input_hash = hashlib.sha256(raw).hexdigest()

    add_check("luong1:vuot-cong-chat-luong", probe.qualityCheck.passed,
              f"qualityScore={probe.qualityCheck.qualityScore}, ngưỡng={probe.qualityCheck.qualityThreshold}")
    add_check("luong1:forensics-va-phash", probe.forensicCheck is not None,
              f"sha256={ (probe.forensicCheck.sha256 or '')[:12] }..., pHash={probe.forensicCheck.pHash}")

    # --- Lượt chạy THẬT có bật Luồng 2, chỉ giả lập HTTP ra DuckDuckGo ---
    request = UnifiedInspectionRequest(
        evidenceId=row["sample_id"],
        activityName=activity_name,
        evidenceType=(row.get("document_type") or "GIAY_CHUNG_NHAN").strip(),
        declaredStudent=_declared_from_ocr(probe),
        fileBytesBase64=base64.b64encode(raw).decode(),
        enableWebSearch=True,
    )

    recorder: dict[str, Any] = {}
    fake_client = _fake_async_client(_ddg_html(activity_name), recorder)
    with patch("src.web_search_verifier.httpx.AsyncClient", fake_client):
        response = await _process(request)

    # Gọi trực tiếp Luồng 2 với nguồn mạng xã hội ngoài DUT để chứng minh mức cộng điểm tầng thấp.
    social_recorder: dict[str, Any] = {}
    social_client = _fake_async_client(_ddg_html_social_only(activity_name), social_recorder)
    with patch("src.web_search_verifier.httpx.AsyncClient", social_client):
        social_web = await WebSearchVerifierService.verify_event(activity_name)

    duration_ms = int(round((time.perf_counter() - started) * 1000))

    web = response.webVerification
    source_check = next((check for check in response.documentChecks if check.key == "source"), None)
    template_check = next((check for check in response.documentChecks if check.key == "template"), None)

    add_check("luong2:goi-tra-cuu", bool(recorder.get("called")),
              f"URL đã gọi: {recorder.get('url')}")
    add_check("luong2:truy-van-mo-nguon-cong-khai",
              "site:" not in (web.queryUsed or ""),
              f"queryUsed={web.queryUsed}")
    add_check("luong2:tim-thay-nguon-tren-DUT", web.articleUrl == DUT_PUBLIC_URL,
              f"articleUrl={web.articleUrl}")
    add_check("luong2:uu-tien-nguon-chinh-thong", web.articleUrl == DUT_PUBLIC_URL,
              f"chọn nguồn chính thống DUT thay vì nguồn mạng xã hội {SOCIAL_PUBLIC_URL}")
    add_check("luong2:match>=0.70", (web.matchScore or 0) >= 0.70, f"matchScore={web.matchScore}")
    add_check("luong2:cong-20-diem", web.confidenceBoost == 20, f"confidenceBoost={web.confidenceBoost}")
    add_check("luong2:nguon-mang-xa-hoi-cong-10-diem",
              social_web.articleUrl == SOCIAL_PUBLIC_URL and social_web.confidenceBoost == 10,
              f"articleUrl={social_web.articleUrl}, confidenceBoost={social_web.confidenceBoost}")
    add_check("luong1:mo-muc-kiem-tra-nguon", bool(source_check) and source_check.status == "PASS",
              f"source={source_check.status if source_check else 'thiếu'}")
    add_check("luong1:breakdown-webBoost", response.breakdown.get("webBoost") == 20,
              f"webBoost={response.breakdown.get('webBoost')}")
    add_check("luong1:ghi-nhan-phoi", template_check is not None,
              f"template={template_check.status if template_check else 'thiếu'}")

    status = "PASS" if checks and all(check["ok"] for check in checks) else "FAIL"

    return {
        "artifact": "e2e_result",
        "scope": "Luồng 1 + Luồng 2 (tích hợp thật, giả lập lớp HTTP DuckDuckGo)",
        "status": status,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "durationMs": duration_ms,
        "inputHash": f"sha256:{input_hash}",
        "versions": {
            "aiService": AI_SERVICE_VERSION,
            "orchestrator": "UnifiedPipelineOrchestrator",
            "ocrEngine": f"tesseract ({ocr_info.get('usedLanguages')})",
            "forensics": "PIL/NumPy SHA-256 + pHash + ELA",
            "webSearchVerifier": "WebSearchVerifierService (DuckDuckGo HTML, mọi nguồn công khai, phân tầng điểm)",
        },
        "config": {
            "DUT_DOMAIN": "dut.udn.vn",
            "allowAllPublicSources": True,
            "qualityThreshold": probe.qualityCheck.qualityThreshold,
            "blurLaplacianThreshold": 100.0,
            "elaAnomalyThreshold": 0.25,
            "phashHammingMax": 10,
            "templateMatchHammingMax": 10,
            "webSearchTimeoutSeconds": 8.0,
            "webMatchAcceptThreshold": 0.55,
            "webConfidenceBoostThreshold": 0.70,
            "webConfidenceBoostOfficial": 20,
            "webConfidenceBoostOther": 10,
        },
        "rules": {
            "documentScore": {
                "base": 35,
                "qualityPass": 20,
                "ocrText": 10,
                "nameMatch85": 15,
                "codeMatched": 15,
                "webBoostMax": 20,
                "tamperedPenalty": -25,
                "authenticityGreenCap": 89,
            },
            "tierThresholds": {"GREEN": 90, "YELLOW_STRONG": 75, "YELLOW_WEAK": 60, "RED": 0},
            "rubricVersion": "criterion-rubric-v1",
        },
        "ocr": ocr_info,
        "sample": {
            "sampleId": row["sample_id"],
            "reviewFile": row.get("review_file"),
            "documentType": row.get("document_type"),
            "activityName": activity_name,
            "declaredFullName": request.declaredStudent.fullName,
            "declaredStudentCode": request.declaredStudent.studentCode,
        },
        "checks": checks,
        "evidence": {
            "probeWithoutWebSearch": {
                "pipelineMode": probe.pipelineMode,
                "aiConfidenceScore": probe.aiConfidenceScore,
                "tier": probe.tier.value,
                "ocrAvailable": bool(probe.ocrExtraction and probe.ocrExtraction.available),
                "ocrTextLength": len(probe.ocrExtraction.rawText) if probe.ocrExtraction else 0,
                "studentNameExtracted": probe.ocrExtraction.studentNameExtracted if probe.ocrExtraction else None,
                "webSearched": probe.webVerification.searched,
            },
            "withWebSearch": {
                "pipelineMode": response.pipelineMode,
                "aiConfidenceScore": response.aiConfidenceScore,
                "tier": response.tier.value,
                "webBoost": response.breakdown.get("webBoost"),
                "webVerification": web.model_dump(),
                "sourceCheck": source_check.model_dump() if source_check else None,
                "templateCheck": {
                    "status": template_check.status if template_check else None,
                    "details": template_check.details if template_check else None,
                },
                "documentCheckStatuses": {check.key: check.status for check in response.documentChecks},
            },
            "socialSourceOnly": {
                "articleUrl": social_web.articleUrl,
                "confidenceBoost": social_web.confidenceBoost,
                "matchScore": social_web.matchScore,
                "queryUsed": social_web.queryUsed,
            },
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Xác minh tích hợp thật Luồng 1 + Luồng 2 và sinh e2e_result.json.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--review-dir", type=Path, default=None, help="Mặc định: <dataset>/can-doi-chieu")
    parser.add_argument("--index", type=Path, default=None, help="Mặc định: <dataset>/can-doi-chieu/index.csv")
    parser.add_argument("--sample-id", default=os.getenv("E2E_SAMPLE_ID") or None)
    parser.add_argument("--output", type=Path, default=None, help="Mặc định: <dataset>/e2e_result.json")
    args = parser.parse_args()

    dataset_dir = args.dataset
    result = asyncio.run(
        verify(
            dataset_dir=dataset_dir,
            review_dir=args.review_dir or (dataset_dir / "can-doi-chieu"),
            index_path=args.index or (dataset_dir / "can-doi-chieu" / "index.csv"),
            sample_id=args.sample_id,
        )
    )

    output_path = args.output or (dataset_dir / "e2e_result.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "output": output_path.name,
        "status": result["status"],
        "durationMs": result["durationMs"],
        "sampleId": result["sample"]["sampleId"],
        "failedChecks": [check["name"] for check in result["checks"] if not check["ok"]],
    }, ensure_ascii=False, indent=2))

    if result["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
