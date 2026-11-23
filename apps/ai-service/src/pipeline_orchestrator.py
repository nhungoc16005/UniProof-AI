import base64
import binascii
import io
import os
from datetime import date
from urllib.parse import urlparse

import httpx
from PIL import Image

from .config import settings
from .face_verifier import FaceAndVisionService
from .ocr_extractor import OcrExtractorService
from .predictor import predict_rubric_criterion
from .qr_verifier import QrVerifierService
from .quality_forensics import QualityAndForensicsService
from .template_matcher import TemplateMatcher
from .schemas import (
    EvidenceType,
    FaceVerificationResult,
    DocumentCheckItem,
    DocumentMarkCheckResult,
    ForensicCheckResult,
    OcrExtractionResult,
    QrVerificationResult,
    TemplateMatchResult,
    TierClassification,
    UnifiedInspectionRequest,
    UnifiedInspectionResponse,
    WebVerificationResult,
)
from .web_search_verifier import WebSearchVerifierService


class UnifiedPipelineOrchestrator:
    MAX_FILE_BYTES = 8 * 1024 * 1024

    @classmethod
    async def process(cls, req: UnifiedInspectionRequest) -> UnifiedInspectionResponse:
        file_bytes_list = await cls._collect_files(req)
        activity_name = (req.activityName or "").strip()
        files_processed = len(file_bytes_list)
        file_bytes = file_bytes_list[0]
        image_bytes = cls._image_for_inspection(file_bytes)
        quality = QualityAndForensicsService.inspect_quality(image_bytes)
        if not quality.passed:
            document_checks = cls._document_checks(req, quality)
            return UnifiedInspectionResponse(
                success=True,
                evidenceId=req.evidenceId,
                evidenceType=req.evidenceType,
                pipelineMode="DOCUMENT_PIPELINE",
                qualityCheck=quality,
                forensicCheck=None,
                ocrExtraction=OcrExtractionResult(
                    rawText="",
                    available=False,
                    errorDetails="Đã dừng pipeline vì chất lượng tệp không đạt; vui lòng chụp lại rõ hơn.",
                ),
                webVerification=WebVerificationResult(searched=False),
                documentChecks=document_checks,
                aiConfidenceScore=0.0,
                tier=TierClassification.RED,
                classification=cls._classification(TierClassification.RED),
                recommendation=(
                    "Tệp chưa đạt yêu cầu chất lượng. Hãy tải ảnh rõ nét, đủ sáng và không bị nghiêng; "
                    "OCR, đối chiếu và chấm tiêu chí chưa được thực hiện."
                ),
                breakdown={
                    "qualityPassed": False,
                    "qualityScore": quality.qualityScore,
                    "ocrAvailable": False,
                    "stoppedAt": "QUALITY_GATE",
                    "webSearchSkipped": True,
                },
                scoreBreakdown=cls._score_breakdown(
                    0.0, document_checks, quality=quality,
                    ocr=OcrExtractionResult(rawText="", available=False),
                    web=WebVerificationResult(searched=False), qr=None,
                    forensics=None, unresolved=True,
                ),
                filesProcessed=files_processed,
            )
        forensics = QualityAndForensicsService.inspect_forensics(image_bytes)
        is_duplicate, duplicate_match_type, duplicate_matched_hash = cls._check_duplicate(
            forensics, req.previousHashes
        )
        is_event_photo = req.evidenceType == EvidenceType.ANH_SU_KIEN.value
        if len(file_bytes_list) == 1:
            ocr = OcrExtractorService.extract_and_parse(
                file_bytes,
                req.evidenceType,
                req.declaredStudent.fullName,
                req.declaredStudent.studentCode,
                activity_name,
                req.declaredStudent.citizenId,
                ocr_engine=req.ocrEngine,
            )
        else:
            ocr = OcrExtractorService.extract_and_parse_many(
                file_bytes_list,
                req.evidenceType,
                req.declaredStudent.fullName,
                req.declaredStudent.studentCode,
                activity_name,
                req.declaredStudent.citizenId,
                ocr_engine=req.ocrEngine,
            )
        recognition_ambiguous = not is_event_photo and ocr.recognitionAmbiguous
        code_mismatch = not is_event_photo and not recognition_ambiguous and ocr.codeMismatch
        name_mismatch = (
            not is_event_photo
            and not recognition_ambiguous
            and ocr.studentNameExtracted is not None
            and ocr.nameMatchRatio < 70
        )
        activity_name_mismatch = (
            not is_event_photo
            and ocr.activityNameExtracted is not None
            and ocr.activityNameMismatch
        )
        citizen_id_mismatch = (
            not is_event_photo
            and req.evidenceType == EvidenceType.GIAY_HIEN_MAU.value
            and ocr.citizenIdMatched is False
        )
        term_match = cls._issued_date_matches_term(ocr.issuedDateExtracted, req)
        term_mismatch = term_match is False
        synthetic_graphic, synthetic_reason = (False, None)
        if not is_event_photo and ocr and ocr.available and len((ocr.rawText or "").strip()) >= 120:
            synthetic_graphic, synthetic_reason = QualityAndForensicsService.detect_synthetic_graphic(image_bytes)
            if synthetic_graphic and synthetic_reason:
                forensics.isTampered = True
                if synthetic_reason not in forensics.warnings:
                    forensics.warnings.append(synthetic_reason)
        identity_mismatch = code_mismatch or name_mismatch or citizen_id_mismatch
        skip_public_search = identity_mismatch or term_mismatch or is_duplicate or synthetic_graphic

        # Bước 1: Quét mã QR trên chứng nhận (nếu có) để mở đường dẫn xác minh công khai.
        qr = None
        if not is_event_photo:
            qr = await QrVerifierService.verify(
                QrVerifierService.decode(image_bytes),
                activity_name or None,
                req.declaredStudent.fullName,
                ocr.organizerExtracted,
            )

        # Bước 2: Tra cứu nguồn hoạt động công khai (cổng tin DUT / bài báo).
        if req.enableWebSearch and not skip_public_search:
            year = str(req.participationDate.year) if req.participationDate else None
            web = await WebSearchVerifierService.verify_event(
                activity_name,
                year,
                ocr.organizerExtracted,
            )
        elif skip_public_search:
            web = WebVerificationResult(
                searched=False,
                errorDetails="Đã bỏ qua tra cứu công khai do thông tin định danh hoặc ngày cấp không khớp.",
            )
        else:
            web = WebVerificationResult(searched=False)

        rubric_pred = predict_rubric_criterion(
            ocr.rawText if ocr and ocr.available else "",
            activity_name or (ocr.activityNameExtracted if ocr else "") or "",
        )
        common = {
            "success": True,
            "evidenceId": req.evidenceId,
            "evidenceType": req.evidenceType,
            "qualityCheck": quality,
            "forensicCheck": forensics,
            "webVerification": web,
            "filesProcessed": files_processed,
            "isDuplicate": is_duplicate,
            "duplicateMatchType": duplicate_match_type,
            "matchedHash": duplicate_matched_hash,
            "rubricPrediction": rubric_pred,
        }

        if is_event_photo:
            face = (
                FaceAndVisionService.verify_face_in_event(image_bytes)
                if settings.FACE_MATCHING_ENABLED
                else FaceVerificationResult(
                    status="NOT_CHECKED",
                    statusMessage="Đã tắt xử lý khuôn mặt theo cấu hình; không thực hiện phát hiện hoặc đối chiếu.",
                )
            )
            exif = FaceAndVisionService.extract_exif(image_bytes, req.participationDate)
            scene = FaceAndVisionService.analyze_scene_vision(
                ocr.rawText,
                activity_name,
                ocr.available,
            )
            score = 35.0
            if quality.passed:
                score += 20
            if scene.matchesActivity:
                score += 15
            if exif.matchesDeclaredDate:
                score += 10
            if web.confidenceBoost:
                score += 10
            if forensics.isTampered:
                score -= 20
            # D2/D3/D7 (P1-M5-03): Ảnh sự kiện luôn HITL (trần 89, không bao giờ GREEN).
            # Khi tắt xử lý mặt: Hạng B (YELLOW_STRONG) chỉ khi đủ banner + bài viết đối chứng + EXIF khớp ngày;
            # thiếu 1 tín hiệu trở lên -> Hạng C (YELLOW_WEAK).
            score = max(0.0, min(89.0, score))
            has_all_event_signals = bool(
                scene.matchesActivity
                and exif.matchesDeclaredDate
                and (web.articleUrl or web.confidenceBoost)
                and not forensics.isTampered
            )
            if is_duplicate:
                tier = TierClassification.RED
            elif has_all_event_signals and score >= 75:
                tier = TierClassification.YELLOW_STRONG
            else:
                tier = TierClassification.YELLOW_WEAK if score >= 60 else TierClassification.RED
            return UnifiedInspectionResponse(
                **common,
                pipelineMode="EVENT_PHOTO_PIPELINE",
                ocrExtraction=ocr,
                faceVerification=face,
                sceneVision=scene,
                exifData=exif,
                aiConfidenceScore=round(score, 1),
                tier=tier,
                classification=cls._classification(tier),
                recommendation=(
                    "Ảnh đã qua phân tích chất lượng, OCR bối cảnh, EXIF và tra cứu nguồn công khai. "
                    "AI không xử lý khuôn mặt theo cấu hình (D3); mọi ảnh sự kiện luôn chuyển cán bộ xác minh (HITL)."
                ),
                breakdown={
                    "qualityPassed": quality.passed,
                    "facesDetected": face.facesDetected,
                    "sceneMatched": scene.matchesActivity,
                    "dateMatched": exif.matchesDeclaredDate,
                    "webBoost": web.confidenceBoost,
                    "tampered": forensics.isTampered,
                    "eventRankRule": "HANG_B_ALL_SIGNALS" if has_all_event_signals else "HANG_C_PARTIAL_SIGNALS",
                },
            )

        score = 0.0 if identity_mismatch or term_mismatch or is_duplicate or synthetic_graphic else settings.SCORE_WEIGHT_BASE
        if not identity_mismatch and not term_mismatch and not is_duplicate and not synthetic_graphic:
            if quality.passed:
                score += settings.SCORE_WEIGHT_QUALITY
            if ocr.available and ocr.rawText:
                score += settings.SCORE_WEIGHT_OCR
            if ocr.nameMatchRatio >= 85 and not recognition_ambiguous:
                score += settings.SCORE_WEIGHT_NAME
            if ocr.codeMatched and not recognition_ambiguous:
                score += settings.SCORE_WEIGHT_STUDENT_CODE
            if web.confidenceBoost:
                score += min(web.confidenceBoost, settings.SCORE_WEIGHT_WEB)
            if qr and qr.matchesDeclared:
                score += min(qr.confidenceBoost, settings.SCORE_WEIGHT_QR)
            if forensics.isTampered:
                score -= settings.SCORE_PENALTY_TAMPER
        score = max(0.0, min(100.0, score))
        document_marks = QualityAndForensicsService.inspect_document_marks(image_bytes)
        template_match = TemplateMatcher.match(image_bytes, req.evidenceType)
        document_checks = cls._document_checks(
            req,
            quality,
            forensics=forensics,
            ocr=ocr,
            web=web,
            qr=qr,
            document_marks=document_marks,
            template_match=template_match,
            code_mismatch=code_mismatch,
            name_mismatch=name_mismatch,
            term_match=term_match,
            activity_name_mismatch=activity_name_mismatch,
            citizen_id_mismatch=citizen_id_mismatch,
            duplicate_checked=req.previousHashes is not None,
            duplicate_match_type=duplicate_match_type,
        )
        authenticity_check_keys = {check.key for check in document_checks}
        unresolved_authenticity_checks = [
            check.key
            for check in document_checks
            if check.key in authenticity_check_keys and check.status != "PASS"
        ]
        score, authenticity_review_required = cls._cap_unresolved_score(score, document_checks)
        tier = (
            TierClassification.RED
            if identity_mismatch or term_mismatch or is_duplicate or synthetic_graphic
            else cls._tier(score)
        )
        if synthetic_graphic:
            recommendation = (
                f"{synthetic_reason} Hệ thống phân loại ĐỎ (0 điểm) do tài liệu là ảnh đồ họa tự dựng, "
                "cần cán bộ kiểm tra bản gốc."
            )
        elif is_duplicate:
            recommendation = (
                f"Tệp trùng với minh chứng đã lưu trong cùng học kỳ (dạng {duplicate_match_type}); "
                "phân loại ĐỎ và chuyển cán bộ kiểm tra để loại trừ gian lận nộp lại."
            )
        elif citizen_id_mismatch:
            recommendation = (
                "Số CCCD đọc được trên giấy hiến máu không khớp hồ sơ sinh viên; phân loại ĐỎ "
                "và cần cán bộ đối chiếu ảnh gốc để loại trừ lỗi OCR."
            )
        elif code_mismatch:
            recommendation = (
                "MSSV đọc được trên giấy không khớp hồ sơ sinh viên; phân loại ĐỎ và bỏ qua tra cứu công khai. "
                "Cần đối chiếu ảnh gốc để loại trừ lỗi OCR trước khi chốt kết quả."
            )
        elif name_mismatch:
            recommendation = (
                "Tên đọc được trên giấy khác đáng kể với hồ sơ; phân loại ĐỎ và cần cán bộ đối chiếu ảnh gốc "
                "để loại trừ lỗi OCR."
            )
        elif term_mismatch:
            recommendation = (
                "Ngày cấp trên giấy nằm ngoài khoảng ngày của học kỳ đang xét; phân loại ĐỎ, cần cán bộ xác minh."
            )
        elif not ocr.available:
            recommendation = (
                "Chưa chạy được OCR trên máy chủ. Cần cài Tesseract OCR với gói ngôn ngữ vie+eng; "
                "kết quả hiện chỉ gồm kiểm tra chất lượng và dấu hiệu kỹ thuật."
            )
        elif not ocr.rawText:
            recommendation = "OCR không đọc được nội dung; cán bộ cần kiểm tra trực tiếp tệp gốc."
        elif forensics.isTampered:
            recommendation = "Có dấu hiệu ảnh bất thường theo ELA; không tự động kết luận giả mạo, cần cán bộ kiểm tra."
        elif authenticity_review_required:
            recommendation = (
                "Các bước OCR/danh tính, trùng lặp, dấu hiệu chỉnh sửa, chữ ký/con dấu, nguồn công khai hoặc phôi "
                "còn cần xem xét; không xếp XANH và cần cán bộ xác minh trước khi chốt."
            )
        else:
            recommendation = "Đã phân tích chất lượng, OCR, dấu hiệu kỹ thuật và nguồn công khai; cán bộ quyết định kết quả cuối."
        return UnifiedInspectionResponse(
            **common,
            pipelineMode="DOCUMENT_PIPELINE",
            ocrExtraction=ocr,
            documentMarks=document_marks,
            templateMatch=template_match,
            documentChecks=document_checks,
            qrVerification=qr,
            aiConfidenceScore=round(score, 1),
            tier=tier,
            classification=cls._classification(tier),
            recommendation=recommendation,
            breakdown={
                "qualityPassed": quality.passed,
                "qualityScore": quality.qualityScore,
                "ocrAvailable": ocr.available,
                "ocrRecognitionConfidence": ocr.recognitionConfidence,
                "ocrRecognitionMethod": ocr.recognitionMethod,
                "ocrRecognitionAmbiguous": ocr.recognitionAmbiguous,
                "nameMatchRatio": ocr.nameMatchRatio,
                "studentNameMismatch": name_mismatch,
                "studentCodeMatched": ocr.codeMatched,
                "studentCodeMismatch": code_mismatch,
                "termDateMatched": term_match,
                "termDateMismatch": term_mismatch,
                "activityNameExtracted": ocr.activityNameExtracted,
                "activityNameMatchRatio": ocr.activityNameMatchRatio,
                "activityNameMismatch": activity_name_mismatch,
                "citizenIdExtracted": ocr.citizenIdExtracted,
                "citizenIdMatched": ocr.citizenIdMatched,
                "citizenIdMismatch": citizen_id_mismatch,
                "filesProcessed": files_processed,
                "webBoost": web.confidenceBoost,
                "qrDetected": bool(qr and qr.detected),
                "qrUrl": qr.verificationUrl if qr else None,
                "qrMatchScore": qr.matchScore if qr else None,
                "qrMatched": qr.matchesDeclared if qr else None,
                "qrBoost": qr.confidenceBoost if qr else 0,
                "tampered": forensics.isTampered,
                "syntheticGraphicMismatch": synthetic_graphic,
                "syntheticGraphicReason": synthetic_reason,
                "templateMatchStatus": template_match.status,
                "templateMatchId": template_match.matchedTemplateId,
                "authenticityReviewRequired": authenticity_review_required,
                "unresolvedAuthenticityChecks": unresolved_authenticity_checks,
                **(
                    {"stoppedAt": "IDENTITY_CHECK", "webSearchSkipped": True}
                    if skip_public_search
                    else {}
                ),
            },
                scoreBreakdown=cls._score_breakdown(
                    score, document_checks, quality=quality, ocr=ocr, web=web,
                    qr=qr, forensics=forensics, unresolved=authenticity_review_required,
                ),
        )

    @staticmethod
    def _issued_date_matches_term(
        issued_date: str | None,
        request: UnifiedInspectionRequest,
    ) -> bool | None:
        if not issued_date or not request.termStartDate or not request.termEndDate:
            return None
        try:
            issued = date.fromisoformat(issued_date)
        except ValueError:
            return None
        return request.termStartDate.date() <= issued <= request.termEndDate.date()

    @staticmethod
    def _document_checks(
        request: UnifiedInspectionRequest,
        quality,
        *,
        forensics=None,
        ocr: OcrExtractionResult | None = None,
        web: WebVerificationResult | None = None,
        qr: QrVerificationResult | None = None,
        document_marks: DocumentMarkCheckResult | None = None,
        template_match: TemplateMatchResult | None = None,
        code_mismatch: bool = False,
        name_mismatch: bool = False,
        term_match: bool | None = None,
        activity_name_mismatch: bool = False,
        citizen_id_mismatch: bool = False,
        duplicate_checked: bool = False,
        duplicate_match_type: str | None = None,
    ) -> list[DocumentCheckItem]:
        if not quality.passed:
            quality_status = "FAIL"
        else:
            quality_status = "PASS"
        quality_check = DocumentCheckItem(
            key="quality",
            label="Chất lượng ảnh",
            status=quality_status,
            details=(
                f"{quality.qualityScore}/100 (ngưỡng 70), độ nét Laplacian "
                f"{quality.blurScore}, độ sáng {quality.brightness}, góc nghiêng {quality.skewAngle}°."
            ),
        )
        missing_identity_fields = []
        if ocr:
            if not (ocr.studentNameExtracted or "").strip():
                missing_identity_fields.append("tên sinh viên")
            if (
                request.declaredStudent.studentCode
                and not (ocr.studentCodeExtracted or "").strip()
            ):
                missing_identity_fields.append("MSSV")
        ocr_has_text = bool(ocr and ocr.available and ocr.rawText)
        ocr_needs_review = bool(
            ocr
            and (
                not ocr_has_text
                or ocr.recognitionAmbiguous
                or missing_identity_fields
            )
        )
        if ocr and ocr.rawText:
            if ocr.recognitionAmbiguous:
                ocr_details = (
                    f"Đã nhận dạng {len(ocr.rawText)} ký tự nhưng các candidate bất đồng "
                    "ở trường định danh; cần đối chiếu ảnh gốc."
                )
            elif missing_identity_fields:
                ocr_details = (
                    f"Đã nhận dạng {len(ocr.rawText)} ký tự nhưng chưa trích xuất được "
                    f"{', '.join(missing_identity_fields)}; cần đối chiếu ảnh gốc."
                )
            else:
                ocr_details = (
                    f"Đã nhận dạng {len(ocr.rawText)} ký tự và trích xuất được "
                    "các trường định danh yêu cầu."
                )
        else:
            ocr_details = (
                (ocr.errorDetails or "OCR không đọc được nội dung.")
                if ocr
                else "Pipeline dừng trước OCR do chất lượng ảnh."
            )
        checks = [
            quality_check,
            DocumentCheckItem(
                key="duplicate",
                label="Trùng lặp",
                status=(
                    "FAIL" if duplicate_match_type
                    else "PASS" if duplicate_checked
                    else "NOT_CHECKED"
                ),
                details=(
                    f"Tệp trùng với minh chứng đã lưu trong cùng học kỳ (dạng {duplicate_match_type})."
                    if duplicate_match_type
                    else "Đã đối chiếu SHA-256/pHash với kho hồ sơ cùng học kỳ; không phát hiện trùng."
                    if duplicate_checked
                    else "Đã tính SHA-256/pHash nhưng chưa có dữ liệu kho để đối chiếu."
                ),
            ),
            DocumentCheckItem(
                key="ocr",
                label="OCR và trích xuất",
                status=(
                    "REVIEW" if ocr_needs_review
                    else "PASS" if ocr_has_text
                    else "REVIEW" if ocr
                    else "NOT_CHECKED"
                ),
                details=ocr_details,
            ),
            DocumentCheckItem(
                key="identity",
                label="Đối chiếu danh tính",
                status=(
                    "REVIEW" if ocr and ocr.recognitionAmbiguous
                    else "FAIL" if code_mismatch or name_mismatch
                    else "PASS" if ocr and ocr.nameMatchRatio >= 85
                    and (not request.declaredStudent.studentCode or ocr.codeMatched)
                    else "REVIEW"
                ),
                details=(
                    "Các candidate OCR đọc tên hoặc MSSV không nhất quán; cần đối chiếu trực tiếp ảnh gốc."
                    if ocr and ocr.recognitionAmbiguous
                    else "MSSV trên giấy không khớp hồ sơ."
                    if code_mismatch
                    else "Tên trên giấy khác đáng kể so với hồ sơ (khớp dưới 70%)."
                    if name_mismatch
                    else (
                        f"Tỷ lệ khớp tên {ocr.nameMatchRatio}%; MSSV "
                        f"{'khớp' if ocr.codeMatched else 'chưa đối chiếu được'}."
                        if ocr
                        else "Chưa đủ dữ liệu OCR để đối chiếu tên/MSSV."
                    )
                ),
            ),
            DocumentCheckItem(
                key="term",
                label="Ngày cấp và học kỳ",
                status="PASS" if term_match is True else "FAIL" if term_match is False else "REVIEW",
                details=(
                    "Ngày cấp nằm trong khoảng ngày học kỳ."
                    if term_match is True
                    else "Ngày cấp nằm ngoài khoảng ngày học kỳ."
                    if term_match is False
                    else "Chưa đủ ngày cấp hoặc khoảng ngày học kỳ để đối chiếu."
                ),
            ),
            DocumentCheckItem(
                key="activity",
                label="Tên hoạt động trên form ↔ OCR",
                status=(
                    "REVIEW" if activity_name_mismatch
                    else "PASS" if ocr and ocr.activityNameExtracted
                    and ocr.activityNameMatchRatio >= 50
                    else "NOT_CHECKED"
                ),
                details=(
                    f"Tên hoạt động đọc được khác đáng kể so với form (khớp {ocr.activityNameMatchRatio}%)."
                    if activity_name_mismatch
                    else (
                        f"Tên hoạt động đọc được khớp form ({ocr.activityNameMatchRatio}%): "
                        f"\"{ocr.activityNameExtracted}\"."
                        if ocr and ocr.activityNameExtracted and request.activityName
                        else (
                            f"OCR đọc được tên hoạt động \"{ocr.activityNameExtracted}\" "
                            "(form không khai báo nên không đối chiếu)."
                            if ocr and ocr.activityNameExtracted
                            else "OCR không trích được tên hoạt động trên giấy để đối chiếu với form."
                        )
                    )
                ),
            ),
            DocumentCheckItem(
                key="citizen_id",
                label="Đối chiếu CCCD (giấy hiến máu)",
                status=(
                    "FAIL" if citizen_id_mismatch
                    else "PASS" if ocr and ocr.citizenIdMatched is True
                    else "REVIEW" if request.evidenceType == EvidenceType.GIAY_HIEN_MAU.value
                    and ocr and ocr.citizenIdExtracted
                    else "NOT_CHECKED"
                ),
                details=(
                    "Số CCCD trên giấy không khớp hồ sơ sinh viên."
                    if citizen_id_mismatch
                    else "Số CCCD trên giấy khớp hồ sơ; giá trị đã được ẩn."
                    if ocr and ocr.citizenIdMatched is True
                    else "Đọc được CCCD trên giấy nhưng hồ sơ chưa có CCCD để đối chiếu."
                    if request.evidenceType == EvidenceType.GIAY_HIEN_MAU.value
                    and ocr and ocr.citizenIdExtracted
                    else "Chỉ áp dụng đối chiếu CCCD cho giấy hiến máu."
                ),
            ),
            DocumentCheckItem(
                key="alteration",
                label="Dấu hiệu chỉnh sửa",
                status="REVIEW" if forensics else "NOT_CHECKED",
                details=(
                    "Chưa chạy ELA."
                    if forensics is None
                    else "ELA có tín hiệu bất thường; cần người kiểm tra, không thể tự kết luận giả mạo."
                    if forensics.isTampered
                    else "Không thấy tín hiệu ELA vượt ngưỡng; điều này không chứng minh giấy là thật."
                ),
            ),
            DocumentCheckItem(
                key="signature_seal",
                label="Chữ ký và dấu",
                status="REVIEW" if document_marks else "NOT_CHECKED",
                details=(
                    f"Chữ ký: {document_marks.signatureStatus} — {document_marks.signatureEvidence} "
                    f"Dấu: {document_marks.sealStatus} — {document_marks.sealEvidence}"
                    if document_marks
                    else "Chưa phân tích do ảnh không đạt cổng chất lượng."
                ),
            ),
            DocumentCheckItem(
                key="source",
                label="Nguồn hoạt động công khai",
                status=(
                    "PASS" if web and web.articleUrl
                    else "REVIEW" if web and web.searched
                    else "NOT_CHECKED"
                ),
                details=(
                    f"Tìm thấy nguồn trên tên miền DUT: {web.articleTitle} — {web.articleUrl}."
                    if web and web.articleUrl
                    else "Đã tra cứu nhưng không tìm thấy nguồn phù hợp; điều này không chứng minh hoạt động không tồn tại."
                    if web and web.searched
                    else (web.errorDetails or "Không thực hiện tra cứu nguồn công khai.")
                    if web
                    else "Chưa chạy tra cứu do chất lượng ảnh không đạt."
                ),
            ),
            DocumentCheckItem(
                key="qr",
                label="Mã QR & tra cứu website",
                status=(
                    "PASS" if qr and qr.fetched and qr.matchesDeclared
                    else "REVIEW" if qr and qr.fetched and qr.matchesDeclared is False
                    else "NOT_CHECKED"
                ),
                details=(
                    f"QR mở trang {qr.verificationUrl} khớp thông tin khai báo (cộng {qr.confidenceBoost} điểm)."
                    if qr and qr.fetched and qr.matchesDeclared
                    else f"Trang trong QR không khớp thông tin khai báo: {qr.verificationUrl}."
                    if qr and qr.fetched
                    else (qr.errorDetails or "Không tìm thấy mã QR trên tệp.")
                    if qr
                    else "Chưa quét mã QR do ảnh không đạt cổng chất lượng."
                ),
            ),
            DocumentCheckItem(
                key="template",
                label="Phôi/chủ thể cấp",
                status=(
                    "PASS" if template_match and template_match.status == "MATCH"
                    else "REVIEW" if template_match and template_match.status in {"MISMATCH", "UNKNOWN"}
                    else "NOT_CHECKED"
                ),
                details=(
                    template_match.evidence
                    if template_match
                    else "Chưa đối chiếu phôi do ảnh không đạt cổng chất lượng."
                ),
            ),
        ]
        point_by_key = {
            "quality": settings.SCORE_WEIGHT_QUALITY if quality.passed else 0.0,
            "ocr": settings.SCORE_WEIGHT_OCR if ocr_has_text else 0.0,
            "identity": (settings.SCORE_WEIGHT_NAME if ocr and ocr.nameMatchRatio >= 85 else 0.0)
            + (settings.SCORE_WEIGHT_STUDENT_CODE if ocr and ocr.codeMatched else 0.0),
            "source": min(web.confidenceBoost, settings.SCORE_WEIGHT_WEB) if web else 0.0,
            "qr": min(qr.confidenceBoost, settings.SCORE_WEIGHT_QR) if qr and qr.matchesDeclared else 0.0,
            "alteration": -settings.SCORE_PENALTY_TAMPER if forensics and forensics.isTampered else 0.0,
        }
        for check in checks:
            check.score_delta = point_by_key.get(check.key, 0.0)
            if check.key == "identity" and check.status != "PASS":
                check.score_delta = 0.0
        return checks

    @classmethod
    async def _collect_files(cls, req: UnifiedInspectionRequest) -> list[bytes]:
        """Gom byte của tất cả tệp đính kèm để OCR không bỏ sót tệp nào (P0-B)."""
        collected: list[bytes] = []
        if req.fileBytesBase64:
            collected.append(await cls._extract_bytes(req.fileBytesBase64, None))
        if req.fileUrl:
            collected.append(await cls._extract_bytes(None, req.fileUrl))
        for url in req.fileUrls or []:
            if url and url != req.fileUrl:
                collected.append(await cls._extract_bytes(None, url))
        if not collected:
            raise ValueError("Yêu cầu phải có fileBytesBase64 hoặc fileUrl.")
        return collected

    PHASH_UNAVAILABLE = "0" * 16

    @staticmethod
    def _phash_distance(left: str, right: str) -> int:
        try:
            return bin(int(left, 16) ^ int(right, 16)).count("1")
        except (ValueError, TypeError):
            return 999

    @classmethod
    def _usable_phash(cls, value: str | None) -> str | None:
        """pHash toàn số 0 là sentinel 'không tính được'; không dùng để so trùng (tránh trùng giả)."""
        text = str(value or "")
        if not text or text == cls.PHASH_UNAVAILABLE:
            return None
        return text

    @classmethod
    def _check_duplicate(
        cls,
        forensics: ForensicCheckResult,
        previous_hashes: list[dict[str, str]] | None,
    ) -> tuple[bool, str | None, str | None]:
        """So SHA-256 (trùng tuyệt đối) và pHash (trùng gần đúng) với kho đã lưu (P0-C)."""
        if not forensics or not previous_hashes:
            return False, None, None
        current_sha = (forensics.sha256 or "").lower()
        current_phash = cls._usable_phash(forensics.pHash)
        for item in previous_hashes:
            if not isinstance(item, dict):
                continue
            previous_sha = str(item.get("sha256") or "").lower()
            if current_sha and previous_sha and previous_sha == current_sha:
                return True, "EXACT", previous_sha
        if not current_phash:
            return False, None, None
        for item in previous_hashes:
            if not isinstance(item, dict):
                continue
            previous_phash = cls._usable_phash(item.get("pHash"))
            if previous_phash and cls._phash_distance(current_phash, previous_phash) <= 10:
                return True, "SIMILAR", str(item.get("sha256") or previous_phash)
        return False, None, None

    @classmethod
    async def _extract_bytes(cls, b64_string: str | None, url: str | None) -> bytes:
        if b64_string:
            encoded = b64_string.split(",", 1)[-1] if b64_string.startswith("data:") else b64_string
            try:
                content = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error) as error:
                raise ValueError("Tệp minh chứng không phải Base64 hợp lệ.") from error
        elif url:
            if url.startswith("data:"):
                encoded = url.split(",", 1)[-1]
                try:
                    content = base64.b64decode(encoded, validate=True)
                except (ValueError, binascii.Error) as error:
                    raise ValueError("Tệp minh chứng không phải Base64 hợp lệ.") from error
            else:
                parsed = urlparse(url)
                allowed_hosts = {
                    host.strip().lower()
                    for host in os.getenv("AI_ALLOWED_FILE_HOSTS", "").split(",")
                    if host.strip()
                }
                host = (parsed.hostname or "").lower()
                is_local = host in {"localhost", "127.0.0.1"} or host.endswith(".test")
                if (parsed.scheme != "https" and not (is_local and parsed.scheme in {"http", "https"})) or not (
                    host.endswith(".supabase.co") or host in allowed_hosts or is_local
                ):
                    raise ValueError("URL tệp phải là HTTPS từ Supabase hoặc AI_ALLOWED_FILE_HOSTS.")
                try:
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
                        async with client.stream("GET", url) as response:
                            response.raise_for_status()
                            length = int(response.headers.get("content-length", "0") or "0")
                            if length > cls.MAX_FILE_BYTES:
                                raise ValueError("Tệp minh chứng vượt giới hạn 8 MB.")
                            chunks = []
                            size = 0
                            async for chunk in response.aiter_bytes():
                                size += len(chunk)
                                if size > cls.MAX_FILE_BYTES:
                                    raise ValueError("Tệp minh chứng vượt giới hạn 8 MB.")
                                chunks.append(chunk)
                            content = b"".join(chunks)
                except httpx.HTTPError as error:
                    raise ValueError(f"Không tải được tệp minh chứng: {error}") from error
        else:
            raise ValueError("Yêu cầu phải có fileBytesBase64 hoặc fileUrl.")

        if not content:
            raise ValueError("Tệp minh chứng rỗng.")
        if len(content) > cls.MAX_FILE_BYTES:
            raise ValueError("Tệp minh chứng vượt giới hạn 8 MB.")
        return content

    @staticmethod
    def _image_for_inspection(file_bytes: bytes) -> bytes:
        if file_bytes.startswith(b"%PDF"):
            try:
                import fitz
            except ImportError as error:
                raise ValueError("Chưa cài PyMuPDF để đọc tệp PDF.") from error
            try:
                document = fitz.open(stream=file_bytes, filetype="pdf")
                if not document.page_count:
                    raise ValueError("PDF không có trang.")
                page = document.load_page(0)
                return page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")
            except (RuntimeError, ValueError) as error:
                raise ValueError(f"Không thể đọc trang đầu của PDF: {error}") from error
        try:
            with Image.open(io.BytesIO(file_bytes)) as image:
                image.verify()
        except Exception as error:
            raise ValueError(f"Định dạng minh chứng không phải ảnh/PDF hợp lệ: {error}") from error
        return file_bytes

    @staticmethod
    def _score_breakdown(score: float, checks: list[DocumentCheckItem], *, quality, ocr, web, qr, forensics, unresolved: bool) -> list[dict]:
        status_by_key = {check.key: check.status for check in checks}
        status_by_component = {"quality": "quality", "ocr": "ocr", "identity": "identity", "public_source": "source", "qr": "qr", "tamper_penalty": "alteration"}
        components = [
            ("quality", settings.SCORE_WEIGHT_QUALITY, settings.SCORE_WEIGHT_QUALITY if quality.passed else 0.0, "qualityCheck"),
            ("ocr", settings.SCORE_WEIGHT_OCR, settings.SCORE_WEIGHT_OCR if ocr.available and ocr.rawText else 0.0, "ocrExtraction"),
            ("identity", settings.SCORE_WEIGHT_NAME + settings.SCORE_WEIGHT_STUDENT_CODE, (settings.SCORE_WEIGHT_NAME if ocr.nameMatchRatio >= 85 else 0.0) + (settings.SCORE_WEIGHT_STUDENT_CODE if ocr.codeMatched else 0.0), "OCR + hồ sơ sinh viên"),
            ("public_source", settings.SCORE_WEIGHT_WEB, min(web.confidenceBoost, settings.SCORE_WEIGHT_WEB), "webVerification"),
            ("qr", settings.SCORE_WEIGHT_QR, min(qr.confidenceBoost, settings.SCORE_WEIGHT_QR) if qr and qr.matchesDeclared else 0.0, "qrVerification"),
            ("tamper_penalty", settings.SCORE_PENALTY_TAMPER, -settings.SCORE_PENALTY_TAMPER if forensics and forensics.isTampered else 0.0, "forensicCheck"),
        ]
        rows = [{"component": key, "weight": weight, "score": round(points, 1), "source": source, "status": status_by_key.get(status_by_component[key], "NOT_CHECKED")} for key, weight, points, source in components]
        residual = round(score - sum(row["score"] for row in rows), 1)
        rows.insert(0, {"component": "base_and_routing", "weight": settings.SCORE_WEIGHT_BASE, "score": residual, "source": "pipeline policy", "status": "REVIEW" if unresolved else "PASS"})
        return rows

    @staticmethod
    def _cap_unresolved_score(score: float, checks: list[DocumentCheckItem]) -> tuple[float, bool]:
        unresolved = any(check.status != "PASS" for check in checks)
        if unresolved and score >= 90:
            return 89.0, True
        return score, unresolved

    @staticmethod
    def _tier(score: float) -> TierClassification:
        if score >= 90:
            return TierClassification.GREEN
        if score >= 75:
            return TierClassification.YELLOW_STRONG
        if score >= 60:
            return TierClassification.YELLOW_WEAK
        return TierClassification.RED

    @staticmethod
    def _classification(tier: TierClassification) -> str:
        if tier == TierClassification.GREEN:
            return "HANG_A"
        if tier == TierClassification.YELLOW_STRONG:
            return "HANG_B"
        return "HANG_C"
