# ==============================================================================
# EduPoint / UniProof-AI — Settings & Constants
# ==============================================================================

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SERVICE_NAME: str = "UniProof-AI Service"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Thresholds
    BLUR_LAPLACIAN_THRESHOLD: float = float(os.getenv("BLUR_LAPLACIAN_THRESHOLD", "100.0"))
    TESSERACT_TIMEOUT_SECONDS: float = float(os.getenv("TESSERACT_TIMEOUT_SECONDS", "20"))
    ELA_ANOMALY_THRESHOLD: float = float(os.getenv("ELA_ANOMALY_THRESHOLD", "0.25"))
    FACE_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.75"))
    # Tắt toàn bộ xử lý khuôn mặt cho tới khi có phê duyệt của nhà trường.
    FACE_MATCHING_ENABLED: bool = False
    # D9: OCR có thể chứa PII; không gửi nội dung sang LLM ngoài khi tắt.
    EXTERNAL_LLM_EXTRACTION_ENABLED: bool = False

    # Luồng 1 contributions; these are points, not probabilities.
    SCORE_WEIGHT_BASE: float = float(os.getenv("SCORE_WEIGHT_BASE", "35"))
    SCORE_WEIGHT_QUALITY: float = float(os.getenv("SCORE_WEIGHT_QUALITY", "20"))
    SCORE_WEIGHT_OCR: float = float(os.getenv("SCORE_WEIGHT_OCR", "10"))
    SCORE_WEIGHT_NAME: float = float(os.getenv("SCORE_WEIGHT_NAME", "15"))
    SCORE_WEIGHT_STUDENT_CODE: float = float(os.getenv("SCORE_WEIGHT_STUDENT_CODE", "15"))
    SCORE_WEIGHT_WEB: float = float(os.getenv("SCORE_WEIGHT_WEB", "20"))
    SCORE_WEIGHT_QR: float = float(os.getenv("SCORE_WEIGHT_QR", "15"))
    SCORE_PENALTY_TAMPER: float = float(os.getenv("SCORE_PENALTY_TAMPER", "25"))

    # Lớp 6 — nhận diện phôi (template)
    TEMPLATE_MATCH_HAMMING_MAX: int = int(os.getenv("TEMPLATE_MATCH_HAMMING_MAX", "10"))
    TEMPLATE_MATCH_ASPECT_TOLERANCE: float = float(os.getenv("TEMPLATE_MATCH_ASPECT_TOLERANCE", "0.15"))
    TEMPLATE_REGISTRY_PATH: str = os.getenv("TEMPLATE_REGISTRY_PATH", "")
    
    # External APIs
    SERP_API_KEY: str = os.getenv("SERP_API_KEY", "")
    DUT_DOMAIN: str = "dut.udn.vn"

    # Luồng 2 — nguồn ngoài allow-list chính thống chỉ bật theo opt-in.
    ALLOW_ALL_PUBLIC_SOURCES: bool = False
    # Nguồn chính thống (đại học/đoàn - hội): cộng điểm cao hơn.
    OFFICIAL_SOURCE_DOMAINS: str = os.getenv(
        "OFFICIAL_SOURCE_DOMAINS",
        "dut.udn.vn,udn.vn",
    )
    # Mạng xã hội phổ biến (Facebook, Threads, Google/Blogspot, ...).
    SOCIAL_SOURCE_DOMAINS: str = os.getenv(
        "SOCIAL_SOURCE_DOMAINS",
        "facebook.com,fb.com,m.facebook.com,threads.net,threads.com,instagram.com,"
        "x.com,twitter.com,tiktok.com,youtube.com,youtu.be,linkedin.com,zalo.me,"
        "google.com,blogspot.com,wordpress.com,medium.com",
    )
    # Báo chí / trang tin.
    NEWS_SOURCE_DOMAINS: str = os.getenv(
        "NEWS_SOURCE_DOMAINS",
        "vnexpress.net,dantri.com.vn,tuoitre.vn,thanhnien.vn,nhandan.vn,vietnamnet.vn,"
        "tienphong.vn,laodong.vn,zingnews.vn,vtv.vn,baodanang.vn,danang.gov.vn",
    )
    
    # Download timeout
    DOWNLOAD_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
