# ==============================================================================
# LỚP 0, 1, 2, 6: TIẾP NHẬN, KIỂM TRA CHẤT LƯỢNG & PHÂN TÍCH GIAN LẬN ẢNH (FORENSICS)
# ==============================================================================

import io
import hashlib
from typing import Tuple, List
from PIL import Image, ImageChops
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import imagehash
except ImportError:
    imagehash = None

from .config import settings
from .schemas import DocumentMarkCheckResult, QualityCheckResult, ForensicCheckResult


class QualityAndForensicsService:

    @staticmethod
    def inspect_quality(image_bytes: bytes) -> QualityCheckResult:
        """
        Lớp 0 & 1: Kiểm tra định dạng, kích thước, độ mờ nét (Laplacian blur), độ sáng.
        """
        # Kiểm tra dung lượng
        size_mb = len(image_bytes) / (1024 * 1024)
        if size_mb > 8.0:
            return QualityCheckResult(
                passed=False,
                blurScore=0.0,
                brightness=0.0,
                skewAngle=0.0,
                errorDetails=f"Dung lượng tệp {size_mb:.1f}MB vượt quá giới hạn 8MB quy định."
            )

        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.verify()  # Kiểm tra tính toàn vẹn của tệp ảnh
            # Reopen sau verify vì verify đóng tệp
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            return QualityCheckResult(
                passed=False,
                blurScore=0.0,
                brightness=0.0,
                skewAngle=0.0,
                errorDetails=f"Định dạng tệp không hợp lệ hoặc bị hỏng: {str(e)}"
            )

        # Chuyển sang numpy array
        np_image = np.array(pil_image)
        
        # 1. Tính độ sáng trung bình (Brightness)
        brightness = float(np.mean(np_image))
        
        # 2. Tính độ mờ nét (Laplacian Blur Variance)
        blur_score = 150.0  # Fallback nếu cv2 chưa cài
        skew_angle = 0.0

        if cv2 is not None:
            gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            blur_score = float(laplacian.var())

            # Ước lượng góc nghiêng méo (Skew angle via MinAreaRect trên Canny edges)
            try:
                edges = cv2.Canny(gray, 50, 150, apertureSize=3)
                pts = np.argwhere(edges > 0)
                if len(pts) > 50:
                    rect = cv2.minAreaRect(pts)
                    angle = rect[-1]
                    if angle < -45:
                        angle = -(90 + angle)
                    else:
                        angle = -angle
                    skew_angle = round(float(angle), 2)
            except Exception:
                skew_angle = 0.0

        # Đánh giá đạt chuẩn chất lượng
        is_too_dark = brightness < 35.0
        is_too_bright = brightness > 245.0
        is_too_blurry = blur_score < settings.BLUR_LAPLACIAN_THRESHOLD
        sharpness_score = min(
            100.0,
            blur_score / max(settings.BLUR_LAPLACIAN_THRESHOLD * 2, 1) * 100,
        )
        brightness_score = max(0.0, 100.0 - abs(brightness - 140.0) / 140.0 * 100)
        skew_score = max(0.0, 100.0 - min(abs(skew_angle), 45.0) / 45.0 * 100)
        quality_score = round(
            sharpness_score * 0.7 + brightness_score * 0.2 + skew_score * 0.1,
            1,
        )
        quality_passed = (
            not is_too_blurry
            and not is_too_dark
            and not is_too_bright
            and quality_score >= 70
        )

        if is_too_blurry or quality_score < 70:
            return QualityCheckResult(
                passed=quality_passed,
                blurScore=round(blur_score, 2),
                brightness=round(brightness, 2),
                skewAngle=skew_angle,
                qualityScore=quality_score,
                errorDetails=(
                    "Ảnh chưa đạt ngưỡng chất lượng 70/100. Vui lòng chụp lại rõ, đủ sáng và ít nghiêng hơn."
                    if quality_score < 70
                    else "Ảnh quá mờ nét, không thể đọc rõ thông tin. Vui lòng chụp lại rõ ràng hơn."
                )
            )

        if is_too_dark or is_too_bright:
            return QualityCheckResult(
                passed=False,
                blurScore=round(blur_score, 2),
                brightness=round(brightness, 2),
                skewAngle=skew_angle,
                qualityScore=quality_score,
                errorDetails="Ảnh quá tối hoặc bị lóa sáng quá mức. Vui lòng chụp lại với ánh sáng đều."
            )

        return QualityCheckResult(
            passed=True,
            blurScore=round(blur_score, 2),
            brightness=round(brightness, 2),
            skewAngle=skew_angle,
            qualityScore=quality_score,
            errorDetails=None
        )

    @staticmethod
    def inspect_document_marks(image_bytes: bytes) -> DocumentMarkCheckResult:
        if cv2 is None:
            return DocumentMarkCheckResult(
                signatureStatus="UNAVAILABLE",
                sealStatus="UNAVAILABLE",
                signatureEvidence="OpenCV chưa khả dụng; không phân tích được vùng chữ ký.",
                sealEvidence="OpenCV chưa khả dụng; không phân tích được vùng dấu.",
            )

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            rgb = np.array(image)
            height, width = rgb.shape[:2]
            hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
            lower_red = cv2.inRange(hsv, np.array([0, 70, 40]), np.array([12, 255, 255]))
            upper_red = cv2.inRange(hsv, np.array([165, 70, 40]), np.array([180, 255, 255]))
            red_mask = cv2.bitwise_or(lower_red, upper_red)
            seal_contours, _ = cv2.findContours(
                red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            minimum_seal_area = max(100.0, width * height * 0.0005)
            seal_found = any(
                cv2.contourArea(contour) >= minimum_seal_area
                and 0.55
                <= (
                    cv2.boundingRect(contour)[2]
                    / max(cv2.boundingRect(contour)[3], 1)
                )
                <= 1.8
                for contour in seal_contours
            )

            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            signature_region = gray[int(height * 0.68):, :]
            edges = cv2.Canny(signature_region, 50, 150)
            lines = cv2.HoughLinesP(
                edges,
                rho=1,
                theta=np.pi / 180,
                threshold=18,
                minLineLength=max(24, int(width * 0.035)),
                maxLineGap=8,
            )
            signature_lines = [] if lines is None else [
                line[0]
                for line in lines
                if abs(float(line[0][3] - line[0][1])) >= 2
                and abs(float(line[0][3] - line[0][1])) <= signature_region.shape[0] * 0.65
            ]
            signature_found = len(signature_lines) >= 3

            return DocumentMarkCheckResult(
                signatureStatus="PRESENT" if signature_found else "NOT_DETECTED",
                sealStatus="PRESENT" if seal_found else "NOT_DETECTED",
                signatureEvidence=(
                    "Có các nét mảnh giao nhau ở vùng cuối trang; đây chỉ là dấu hiệu hình ảnh, không xác thực chữ ký."
                    if signature_found
                    else "Không phát hiện cụm nét giống chữ ký ở vùng cuối trang; không thể kết luận chữ ký vắng mặt."
                ),
                sealEvidence=(
                    "Có cụm mực đỏ gần tròn; đây chỉ là dấu hiệu hình ảnh, không xác thực con dấu."
                    if seal_found
                    else "Không phát hiện cụm mực đỏ gần tròn; dấu màu khác hoặc dấu mờ có thể bị bỏ sót."
                ),
            )
        except (OSError, ValueError, cv2.error) as error:
            return DocumentMarkCheckResult(
                signatureStatus="UNAVAILABLE",
                sealStatus="UNAVAILABLE",
                signatureEvidence=f"Không phân tích được vùng chữ ký: {error}",
                sealEvidence=f"Không phân tích được vùng dấu: {error}",
            )

    @staticmethod
    def inspect_forensics(image_bytes: bytes) -> ForensicCheckResult:
        """
        Lớp 2 & 6: Băm SHA-256, pHash phát hiện chụp lại màn hình, ELA quét dán đè can thiệp số.
        """
        # 1. Băm SHA-256
        sha256_hash = hashlib.sha256(image_bytes).hexdigest()

        # 2. Perceptual Hash (pHash)
        phash_str = "0000000000000000"
        try:
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            if imagehash is not None:
                phash_str = str(imagehash.phash(pil_image))
            else:
                # Basic fallback hash
                resized = pil_image.resize((8, 8), Image.Resampling.LANCZOS).convert("L")
                pixels = list(resized.tobytes())
                avg = sum(pixels) / len(pixels)
                bits = "".join(["1" if p > avg else "0" for p in pixels])
                phash_str = f"{int(bits, 2):016x}"
        except Exception:
            pass

        # 3. Error Level Analysis (ELA) phát hiện vùng ảnh bị chỉnh sửa ghép số / dán chữ
        ela_score, is_tampered, warnings = QualityAndForensicsService._run_ela(image_bytes)

        return ForensicCheckResult(
            sha256=sha256_hash,
            pHash=phash_str,
            elaAnomalyScore=round(ela_score, 3),
            isTampered=is_tampered,
            warnings=warnings
        )

    @staticmethod
    def _run_ela(image_bytes: bytes) -> Tuple[float, bool, List[str]]:
        """
        Error Level Analysis (ELA): Nén lại ảnh JPEG ở mức chất lượng 90%.
        Ảnh nguyên bản có độ sai khác nén đồng đều. Ảnh có vùng dán ghép số/chữ
        sẽ xuất hiện các đốm pixel sai khác cường độ cao bất thường.
        """
        warnings = []
        try:
            original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            buffer = io.BytesIO()
            original.save(buffer, "JPEG", quality=90)
            buffer.seek(0)
            resaved = Image.open(buffer)

            # Tính độ sai biệt giữa ảnh gốc và ảnh nén lại
            diff = ImageChops.difference(original, resaved)

            # Tính điểm bất thường ELA (chuẩn hóa về 0.0 - 1.0)
            diff_array = np.array(diff)
            high_diff_pixels = np.sum(diff_array > 30)
            total_pixels = diff_array.size
            ela_ratio = float(high_diff_pixels / total_pixels) if total_pixels > 0 else 0.0

            is_tampered = ela_ratio > settings.ELA_ANOMALY_THRESHOLD
            if is_tampered:
                warnings.append("Phát hiện vùng chữ/số có dấu hiệu dán đè hoặc can thiệp kỹ thuật số (ELA Anomaly).")

            return ela_ratio, is_tampered, warnings
        except Exception as e:
            return 0.0, False, [f"Lỗi trong quá trình quét ELA: {str(e)}"]
