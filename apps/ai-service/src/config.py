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
    # DEC-015 (D8/D9): Mặc định false. Khi bật, CHỈ gửi văn bản sự kiện đã qua Tường lửa PII 3 lớp (0 gửi ảnh gốc, 0 gửi PII).
    EXTERNAL_LLM_EXTRACTION_ENABLED: bool = os.getenv("EXTERNAL_LLM_EXTRACTION_ENABLED", "false").lower() == "true"

    # Groq / OpenAI-compatible Smart LLM Assistant (Giai đoạn 3 — Selective API Escalation)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_API_BASE_URL: str = os.getenv("LLM_API_BASE_URL", "https://api.groq.com/openai/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
    LLM_FALLBACK_MODEL: str = os.getenv("LLM_FALLBACK_MODEL", "openai/gpt-oss-20b")
    LLM_GATEKEEPER_CONFIDENCE_THRESHOLD: float = float(os.getenv("LLM_GATEKEEPER_CONFIDENCE_THRESHOLD", "0.65"))
    LLM_GATEKEEPER_MARGIN_THRESHOLD: float = float(os.getenv("LLM_GATEKEEPER_MARGIN_THRESHOLD", "0.15"))
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "8.0"))
    LLM_CACHE_TTL_SECONDS: int = int(os.getenv("LLM_CACHE_TTL_SECONDS", str(7 * 24 * 3600)))
    LLM_CACHE_PATH: str = os.getenv("LLM_CACHE_PATH", "/tmp/edupoint_llm_event_cache.sqlite3")

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

    # Luồng 2 — Bật tìm kiếm mọi nguồn công khai (báo chí, mạng xã hội, trang sự kiện).
    # Sinh viên DUT đi hoạt động ngoài trường là phổ biến; giới hạn chỉ dut.udn.vn sẽ bỏ
    # sót phần lớn minh chứng hợp lệ. Phân tầng độ tin cậy vẫn được áp dụng.
    ALLOW_ALL_PUBLIC_SOURCES: bool = True
    # Nguồn chính thống (đại học/đoàn - hội trong và ngoài DUT): cộng điểm cao nhất.
    OFFICIAL_SOURCE_DOMAINS: str = os.getenv(
        "OFFICIAL_SOURCE_DOMAINS",
        # Trường & hệ thống ĐHĐN
        "dut.udn.vn,udn.vn,udn.edu.vn,"
        # Các trường ĐH lớn tại Đà Nẵng và VN (hay tổ chức cuộc thi liên trường)
        "due.udn.vn,ued.udn.vn,dlu.edu.vn,hust.edu.vn,hcmut.edu.vn,uit.edu.vn,"
        # Cơ quan nhà nước / đoàn thể
        "doanthanhnien.vn,hoinongdan.org.vn,tuoitre.hcm.gov.vn,"
        "danang.gov.vn,moet.gov.vn,molisa.gov.vn,"
        # Nền tảng học thuật / cuộc thi lập trình có uy tín
        "icpc.global,icpc.asia,codeforces.com,hackerrank.com,topcoder.com,"
        "codelearn.io,devpost.com,kaggle.com,olympiavn.org,"
        # Nền tảng chứng chỉ online (Coursera, edX, v.v.)
        "coursera.org,edx.org,udemy.com,linkedin.com/learning,futurelearn.com,"
        # Tổ chức kỹ thuật quốc tế
        "ieee.org,acm.org,isoc.org",
    )
    # Mạng xã hội & blog: trang fanpage sự kiện, kết quả đăng Facebook, v.v.
    SOCIAL_SOURCE_DOMAINS: str = os.getenv(
        "SOCIAL_SOURCE_DOMAINS",
        "facebook.com,fb.com,m.facebook.com,threads.net,threads.com,instagram.com,"
        "x.com,twitter.com,tiktok.com,youtube.com,youtu.be,linkedin.com,zalo.me,"
        "google.com,blogspot.com,wordpress.com,medium.com,"
        # Nền tảng VN
        "kenh14.vn,cafef.vn,cafebiz.vn,genk.vn,techz.vn",
    )
    # Báo chí / trang tin chính thống trong và ngoài nước.
    NEWS_SOURCE_DOMAINS: str = os.getenv(
        "NEWS_SOURCE_DOMAINS",
        # Báo lớn toàn quốc
        "vnexpress.net,dantri.com.vn,tuoitre.vn,thanhnien.vn,nhandan.vn,vietnamnet.vn,"
        "tienphong.vn,laodong.vn,zingnews.vn,vtv.vn,vov.vn,baochinhphu.vn,"
        # Báo Đà Nẵng & miền Trung
        "baodanang.vn,baoquangnam.vn,baothuathienhue.vn,kontum.gov.vn,"
        # Trang tin công nghệ / IT / startup VN
        "ictnews.vn,techsignin.com,topdev.vn,itviec.com,toidicodedao.com,"
        # Báo quốc tế (khi cuộc thi quốc tế)
        "techcrunch.com,theverge.com,wired.com,bbc.com,reuters.com",
    )
    
    # Download timeout
    DOWNLOAD_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
