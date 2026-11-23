import io
import logging
import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

from .schemas import (
    DeclaredStudent,
    OcrCompareEngineResult,
    OcrCompareRequest,
    OcrCompareResponse,
    UnifiedInspectionRequest,
    UnifiedInspectionResponse,
)
from .ocr_extractor import OcrExtractorService, configure_tesseract_environment
from .pipeline_orchestrator import UnifiedPipelineOrchestrator
from .criterion_evaluator import evaluate_criterion
from .predictor import is_rubric_model_available
from .vietnamese_ocr_engine import is_rapidocr_installed, is_vietocr_installed

logger = logging.getLogger(__name__)

app = FastAPI(
    title="UniProof-AI — Evidence AI Service",
    description="Phân tích minh chứng bằng kiểm tra ảnh, OCR, đối chiếu nguồn công khai và phân tích ảnh sự kiện.",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
def root() -> dict[str, str]:
    return {
        "service": "UniProof-AI Evidence AI Service",
        "version": "2.1.0",
        "status": "online",
        "docs": "/docs",
        "unifiedEndpoint": "/api/v1/evidence/inspect",
    }


@app.get("/health", tags=["General"])
def health_check() -> dict[str, Any]:
    configure_tesseract_environment()
    try:
        import pytesseract
    except ImportError:
        ocr_available = False
        ocr_message = "Chưa cài pytesseract."
    else:
        try:
            pytesseract.get_tesseract_version()
            installed_languages = set(pytesseract.get_languages(config=""))
            required_languages = set(os.getenv("TESSERACT_LANGUAGES", "vie+eng").split("+"))
            missing_languages = required_languages - installed_languages
            ocr_available = not missing_languages
            ocr_message = (
                f"Thiếu gói ngôn ngữ Tesseract: {', '.join(sorted(missing_languages))}."
                if missing_languages
                else None
            )
        except pytesseract.TesseractNotFoundError:
            ocr_available = False
            ocr_message = "Cần cài Tesseract OCR và gói ngôn ngữ vie+eng."
        except pytesseract.TesseractError as error:
            ocr_available = False
            ocr_message = f"Không kiểm tra được Tesseract OCR: {error}"
    try:
        import cv2

        face_detection_available = hasattr(cv2, "CascadeClassifier") and bool(
            getattr(getattr(cv2, "data", None), "haarcascades", None)
        )
    except ImportError:
        face_detection_available = False
    rapid_ok = is_rapidocr_installed()
    viet_ok = is_vietocr_installed()
    default_engine = os.getenv("OCR_ENGINE", "rapidocr_vietocr" if rapid_ok else "tesseract")
    return {
        "status": "healthy",
        "ocrAvailable": ocr_available or rapid_ok,
        "tesseractAvailable": ocr_available,
        "rapidOcrAvailable": rapid_ok,
        "vietOcrAvailable": viet_ok,
        "rubricMlModelAvailable": is_rubric_model_available(),
        "defaultOcrEngine": default_engine,
        "ocrMessage": ocr_message if not (ocr_available or rapid_ok) else None,
        "eventFaceDetectionAvailable": face_detection_available,
        "eventIdentityMatching": False,
        "eventIdentityMessage": "Hiện chỉ phát hiện khuôn mặt; chưa có mô hình đối chiếu danh tính.",
        "supportedSources": ["GIAY_KHEN", "GIAY_XAC_NHAN", "GIAY_HIEN_MAU", "VE_CHECKIN", "ANH_SU_KIEN"],
    }


@app.post(
    "/api/v1/evidence/compare-ocr",
    response_model=OcrCompareResponse,
    tags=["OCR Lab"],
    summary="So sánh A/B trực tiếp các engine OCR trên cùng một tệp minh chứng",
)
async def compare_ocr_engines(request: OcrCompareRequest) -> OcrCompareResponse:
    try:
        file_bytes = await UnifiedPipelineOrchestrator._extract_bytes(request.fileBytesBase64, None)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    img_w: int | None = None
    img_h: int | None = None
    try:
        preview_bytes = UnifiedPipelineOrchestrator._image_for_inspection(file_bytes)
        with Image.open(io.BytesIO(preview_bytes)) as img:
            normalized = ImageOps.exif_transpose(img)
            img_w, img_h = normalized.size
    except Exception:
        pass

    student = request.declaredStudent
    results: list[OcrCompareEngineResult] = []
    for engine in request.engines:
        started = time.perf_counter()
        extraction = OcrExtractorService.extract_and_parse(
            file_bytes,
            evidence_type=request.evidenceType,
            declared_name=student.fullName if student else None,
            declared_student_code=student.studentCode if student else None,
            declared_activity_name=request.activityName,
            declared_citizen_id=student.citizenId if student else None,
            ocr_engine=engine,
        )
        elapsed_ms = extraction.processingTimeMs or int((time.perf_counter() - started) * 1000)
        results.append(
            OcrCompareEngineResult(
                engine=engine,
                elapsedMs=elapsed_ms,
                boxCount=len(extraction.ocrBoxes or []),
                extraction=extraction,
            )
        )

    return OcrCompareResponse(
        success=True,
        imageWidth=img_w,
        imageHeight=img_h,
        results=results,
    )


@app.post(
    "/api/v1/evidence/inspect",
    response_model=UnifiedInspectionResponse,
    tags=["Evidence Inspection"],
)
async def inspect_evidence(request: UnifiedInspectionRequest) -> UnifiedInspectionResponse:
    try:
        result = await UnifiedPipelineOrchestrator.process(request)
        if request.criterion:
            result.criterionAssessment = evaluate_criterion(
                request.criterion,
                result.ocrExtraction.rawText if result.ocrExtraction else "",
                result.ocrExtraction.available if result.ocrExtraction else False,
                request.activityName or (result.ocrExtraction.activityNameExtracted if result.ocrExtraction else "") or "",
                quality_passed=result.qualityCheck.passed,
                student_code_mismatch=bool(
                    result.pipelineMode == "DOCUMENT_PIPELINE"
                    and result.ocrExtraction
                    and result.ocrExtraction.codeMismatch
                ),
                evidence_mismatch_reason=(
                    "Tên trên giấy không khớp hồ sơ sinh viên"
                    if result.breakdown.get("studentNameMismatch") is True
                    else "Ngày cấp trên giấy nằm ngoài khoảng ngày học kỳ"
                    if result.breakdown.get("termDateMismatch") is True
                    else "Số CCCD trên giấy hiến máu không khớp hồ sơ sinh viên"
                    if result.breakdown.get("citizenIdMismatch") is True
                    else None
                ),
            )
        return result
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except Exception as error:
        logger.exception("Evidence AI pipeline failed for evidence %s", request.evidenceId)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi nội bộ khi xử lý pipeline minh chứng.",
        ) from error


@app.post(
    "/evidence/process",
    tags=["Backend Compatibility"],
    summary="Tương thích với EvidenceProcessingWorker của NestJS",
)
async def process_for_backend(payload: dict[str, Any]) -> dict[str, Any]:
    evidence_id = payload.get("evidenceId")
    activity_name = payload.get("activityName")
    criterion = payload.get("criterion")
    files = payload.get("files") or []
    student_data = payload.get("declaredStudent") or payload.get("student") or {}
    if not evidence_id or not criterion or not criterion.get("id"):
        raise HTTPException(status_code=422, detail="Thiếu evidenceId hoặc criterion.id.")
    if not files or not files[0].get("url"):
        raise HTTPException(status_code=422, detail="Hồ sơ chưa có tệp minh chứng để phân tích.")
    full_name = student_data.get("fullName")
    if not full_name:
        raise HTTPException(status_code=422, detail="Thiếu họ tên sinh viên để đối chiếu OCR.")

    try:
        file_urls = [f["url"] for f in files if f.get("url")]
        request = UnifiedInspectionRequest(
            evidenceId=evidence_id,
            activityName=activity_name,
            evidenceType=payload.get("evidenceType") or "OTHER",
            declaredStudent=DeclaredStudent(
                fullName=full_name,
                studentCode=student_data.get("studentCode"),
                citizenId=student_data.get("citizenId"),
            ),
            participationDate=payload.get("participationDate"),
            termStartDate=payload.get("termStartDate"),
            termEndDate=payload.get("termEndDate"),
            fileUrl=files[0]["url"],
            fileUrls=file_urls,
            previousHashes=payload.get("previousHashes"),
            enableWebSearch=payload.get("enableWebSearch", True),
        )
        result = await UnifiedPipelineOrchestrator.process(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Evidence AI pipeline failed for evidence %s", evidence_id)
        raise HTTPException(status_code=500, detail="Lỗi nội bộ khi xử lý pipeline minh chứng.") from error

    criterion_assessment = evaluate_criterion(
        criterion,
        result.ocrExtraction.rawText if result.ocrExtraction else "",
        result.ocrExtraction.available if result.ocrExtraction else False,
        activity_name,
        quality_passed=result.qualityCheck.passed,
        student_code_mismatch=bool(
            result.pipelineMode == "DOCUMENT_PIPELINE"
            and result.ocrExtraction
            and result.ocrExtraction.codeMismatch
        ),
        evidence_mismatch_reason=(
            "Tên trên giấy không khớp hồ sơ sinh viên"
            if result.breakdown.get("studentNameMismatch") is True
            else "Ngày cấp trên giấy nằm ngoài khoảng ngày học kỳ"
            if result.breakdown.get("termDateMismatch") is True
            else None
        ),
    )
    suggestions = [{
        "criterionId": criterion["id"],
        "suggestedScore": criterion_assessment["suggestedScore"],
        "reasoning": (
            f"Tỷ lệ điều kiện rubric tìm thấy {criterion_assessment['matchScore'] if criterion_assessment['matchScore'] is not None else 'chưa xác định'}%. "
            f"{criterion_assessment['reason']} {result.recommendation}"
        ),
        "confidenceScore": result.aiConfidenceScore / 100,
    }]
    analysis = result.model_dump()
    analysis["criterionAssessment"] = criterion_assessment
    return {"suggestions": suggestions, "analysis": analysis, "criterionAssessment": criterion_assessment}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
