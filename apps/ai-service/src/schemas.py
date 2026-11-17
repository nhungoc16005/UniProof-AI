# ==============================================================================
# UNIFIED EVIDENCE AI SERVICE SCHEMAS
# Hợp nhất dữ liệu xử lý cho cả 2 nguồn: Giấy tờ (GCN/PDF) & Ảnh chụp sự kiện
# ==============================================================================

from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class EvidenceType(str, Enum):
    GIAY_KHEN = "GIAY_KHEN"
    GIAY_XAC_NHAN = "GIAY_XAC_NHAN"
    GIAY_HIEN_MAU = "GIAY_HIEN_MAU"
    VE_CHECKIN = "VE_CHECKIN"
    ANH_SU_KIEN = "ANH_SU_KIEN"
    OTHER = "OTHER"


class TierClassification(str, Enum):
    GREEN = "GREEN"                 # >= 90: Hợp lệ cao, tạm tính điểm
    YELLOW_STRONG = "YELLOW_STRONG" # 75 - 89: Hạng B (Vàng mạnh: thấy mặt/có bài báo) -> Duyệt hàng loạt
    YELLOW_WEAK = "YELLOW_WEAK"     # 60 - 74: Hạng C (Vàng yếu: mờ/chưa có bài báo) -> Duyệt kỹ
    RED = "RED"                     # < 60: Từ chối (chỉnh sửa, gian lận, sai người)


class DeclaredStudent(BaseModel):
    studentCode: Optional[str] = Field(default=None, description="MSSV sinh viên (vd: 102210001)")
    fullName: str = Field(..., description="Họ và tên đầy đủ của sinh viên")
    citizenId: Optional[str] = Field(default=None, description="Số CCCD 12 số (dùng cho Giấy hiến máu)")


# --- Request duy nhất cho cả 2 nguồn ---
class UnifiedInspectionRequest(BaseModel):
    evidenceId: str = Field(..., description="UUID của minh chứng")
    activityName: Optional[str] = Field(default=None, description="Tên hoạt động sinh viên tự khai (có thể bỏ trống; AI tự trích xuất từ tệp)")
    evidenceType: str = Field(default="GIAY_KHEN", description="GIAY_KHEN | GIAY_HIEN_MAU | GIAY_XAC_NHAN | ANH_SU_KIEN")
    declaredStudent: DeclaredStudent
    participationDate: Optional[datetime] = None
    fileUrl: Optional[str] = None
    fileBytesBase64: Optional[str] = None
    studentAvatarUrl: Optional[str] = None
    studentAvatarBase64: Optional[str] = None
    termStartDate: Optional[datetime] = None
    termEndDate: Optional[datetime] = None
    enableWebSearch: bool = Field(default=True, description="Kích hoạt Luồng 2 tra cứu Cổng tin DUT (+20 điểm)")
    previousHashes: Optional[List[Dict[str, str]]] = Field(default=None, description="List of {sha256, pHash} từ kho đã lưu để kiểm tra trùng lặp")
    fileUrls: Optional[List[str]] = Field(default=None, description="Tất cả URL tệp đính kèm cần xử lý (OCR mọi tệp, không chỉ tệp đầu)")


# --- Components ---
class QualityCheckResult(BaseModel):
    passed: bool
    blurScore: float = Field(..., description="Laplacian variance (> 100 đạt)")
    brightness: float = Field(..., description="Độ sáng (30 - 250)")
    skewAngle: float = 0.0
    qualityScore: float = Field(default=0.0, ge=0, le=100, description="Điểm chất lượng ảnh ước lượng, không phải xác suất")
    qualityThreshold: float = 70.0
    errorDetails: Optional[str] = None


class DocumentMarkCheckResult(BaseModel):
    signatureStatus: str = Field(..., description="PRESENT | NOT_DETECTED | UNAVAILABLE")
    sealStatus: str = Field(..., description="PRESENT | NOT_DETECTED | UNAVAILABLE")
    signatureEvidence: str
    sealEvidence: str


class DocumentCheckItem(BaseModel):
    key: str
    label: str
    status: Literal["PASS", "REVIEW", "FAIL", "NOT_CHECKED"]
    details: str
    score_delta: float = 0.0
    evidence: Dict[str, Any] = Field(default_factory=dict)
    message_vi: str = ""

    def model_post_init(self, __context: Any) -> None:
        if not self.message_vi:
            self.message_vi = self.details
        if not self.evidence:
            self.evidence = {"source": self.key}


class ForensicCheckResult(BaseModel):
    sha256: str
    pHash: str
    elaAnomalyScore: float = Field(default=0.0, description="Điểm ELA quét dán đè (> 0.25 là can thiệp)")
    isTampered: bool = False
    warnings: List[str] = Field(default_factory=list)


class TemplateMatchResult(BaseModel):
    status: str = Field(..., description="MATCH | MISMATCH | UNKNOWN")
    matchedTemplateId: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0, le=100, description="Mức tương đồng 0-100, không phải xác suất")
    evidence: str = ""


class BloodDonationData(BaseModel):
    bloodVolumeMl: Optional[int] = Field(default=None, description="Lượng máu hiến (ml): 250, 350, 450")
    citizenId: Optional[str] = Field(default=None, description="Số CCCD trên giấy hiến máu")
    birthDate: Optional[str] = None
    donationDate: Optional[str] = None


class OcrExtractionResult(BaseModel):
    rawText: str
    available: bool = True
    errorDetails: Optional[str] = None
    recognitionConfidence: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
        description="Mean Tesseract word confidence; diagnostic only, not an authenticity probability.",
    )
    recognitionMethod: Optional[str] = None
    recognitionAmbiguous: bool = False
    studentNameExtracted: Optional[str] = None
    studentCodeExtracted: Optional[str] = None
    activityNameExtracted: Optional[str] = None
    organizerExtracted: Optional[str] = None
    issuedDateExtracted: Optional[str] = None
    certificateNumber: Optional[str] = None
    bloodDonation: Optional[BloodDonationData] = None
    nameMatchRatio: float = 0.0
    codeMatched: bool = False
    codeMismatch: bool = False
    activityNameMatchRatio: float = 0.0
    activityNameMismatch: bool = False
    citizenIdMatched: Optional[bool] = None   # None = not applicable / not checked
    citizenIdExtracted: Optional[str] = None


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class FaceVerificationResult(BaseModel):
    status: str = Field(default="NOT_CHECKED", description="PASS | REVIEW | FAIL | NOT_CHECKED")
    facesDetected: int = 0
    matched: bool = False
    bestSimilarityScore: float = 0.0
    matchedFaceBoundingBox: Optional[BoundingBox] = None
    confidenceBoost: int = 0
    identityComparisonAvailable: bool = False
    statusMessage: Optional[str] = None


class ExifMetadataResult(BaseModel):
    captureDate: Optional[str] = None
    cameraModel: Optional[str] = None
    matchesDeclaredDate: Optional[bool] = None


class SceneVisionResult(BaseModel):
    detectedBannerText: Optional[str] = None
    sceneContext: Optional[str] = None
    matchesActivity: Optional[bool] = None
    available: bool = True


class WebVerificationResult(BaseModel):
    searched: bool = False
    queryUsed: Optional[str] = None
    articleTitle: Optional[str] = None
    articleUrl: Optional[str] = None
    snippet: Optional[str] = None
    matchScore: Optional[float] = None
    confidenceBoost: int = Field(default=0, description="+20 nếu tìm thấy bài báo đối chứng")
    errorDetails: Optional[str] = None


class QrVerificationResult(BaseModel):
    detected: bool = False
    rawText: Optional[str] = None
    verificationUrl: Optional[str] = None
    fetched: bool = False
    pageTitle: Optional[str] = None
    matchScore: Optional[float] = None
    matchesDeclared: Optional[bool] = None
    confidenceBoost: int = Field(default=0, description="+15 nếu trang tra cứu trong QR khớp thông tin khai báo")
    errorDetails: Optional[str] = None


class ScoreBreakdownItem(BaseModel):
    component: str
    weight: float
    score: float
    source: str
    status: Literal["PASS", "REVIEW", "FAIL", "NOT_CHECKED"]


# --- Output duy nhất hợp nhất cho cả 2 nguồn ---
class UnifiedInspectionResponse(BaseModel):
    schemaVersion: Literal["1.0"] = "1.0"
    success: bool
    evidenceId: str
    evidenceType: str
    pipelineMode: str = Field(..., description="DOCUMENT_PIPELINE | EVENT_PHOTO_PIPELINE")
    qualityCheck: QualityCheckResult
    forensicCheck: Optional[ForensicCheckResult] = None
    ocrExtraction: Optional[OcrExtractionResult] = None
    faceVerification: Optional[FaceVerificationResult] = None
    sceneVision: Optional[SceneVisionResult] = None
    exifData: Optional[ExifMetadataResult] = None
    documentMarks: Optional[DocumentMarkCheckResult] = None
    templateMatch: Optional[TemplateMatchResult] = None
    documentChecks: List[DocumentCheckItem] = Field(default_factory=list)
    webVerification: WebVerificationResult
    qrVerification: Optional[QrVerificationResult] = None
    aiConfidenceScore: float = Field(..., description="Thang điểm 0 - 100")
    tier: TierClassification
    classification: str = Field("HANG_B", description="HANG_A | HANG_B (Vàng mạnh) | HANG_C (Vàng yếu)")
    recommendation: str
    breakdown: Dict[str, Any] = {}
    scoreBreakdown: List[ScoreBreakdownItem] = Field(default_factory=list)
    isDuplicate: bool = False
    duplicateMatchType: Optional[str] = None   # "EXACT" | "SIMILAR" | None
    matchedHash: Optional[str] = None
    filesProcessed: int = 1
    auditSampled: bool = False
