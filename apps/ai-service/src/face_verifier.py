import io
import json
import re
import unicodedata
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

from PIL import Image

from .schemas import BoundingBox, ExifMetadataResult, FaceVerificationResult, SceneVisionResult
from .config import settings

try:
    import cv2
except ImportError:
    cv2 = None

_SCENE_MODEL_PATH = Path(__file__).resolve().parents[1] / "model" / "event_scene_classifier.pt"
_SCENE_META_PATH = Path(__file__).resolve().parents[1] / "model" / "event_scene_classifier.meta.json"
_SCENE_MODEL: Any = None
_SCENE_CLASSES: list[str] = []
_SCENE_LOAD_ATTEMPTED = False


def _load_scene_classifier() -> tuple[Any, list[str]]:
    global _SCENE_MODEL, _SCENE_CLASSES, _SCENE_LOAD_ATTEMPTED
    if _SCENE_LOAD_ATTEMPTED:
        return _SCENE_MODEL, _SCENE_CLASSES
    _SCENE_LOAD_ATTEMPTED = True
    if not _SCENE_MODEL_PATH.exists():
        return None, []
    try:
        import torch

        _SCENE_MODEL = torch.jit.load(str(_SCENE_MODEL_PATH), map_location="cpu").eval()
        if _SCENE_META_PATH.exists():
            meta = json.loads(_SCENE_META_PATH.read_text(encoding="utf-8"))
            _SCENE_CLASSES = [str(c) for c in meta.get("classes", [])]
    except Exception:
        _SCENE_MODEL = None
        _SCENE_CLASSES = []
    return _SCENE_MODEL, _SCENE_CLASSES


class FaceAndVisionService:
    @staticmethod
    def extract_exif(image_bytes: bytes, declared_date: Optional[datetime] = None) -> ExifMetadataResult:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            tags = image.getexif()
            capture_date = tags.get(36867) or tags.get(306)
            camera_model = tags.get(272)
            matches = None
            if capture_date and declared_date:
                try:
                    captured = datetime.strptime(str(capture_date)[:10], "%Y:%m:%d").date()
                    matches = abs((captured - declared_date.date()).days) <= 2
                except ValueError:
                    matches = None
            return ExifMetadataResult(
                captureDate=str(capture_date) if capture_date else None,
                cameraModel=str(camera_model) if camera_model else None,
                matchesDeclaredDate=matches,
            )
        except (OSError, ValueError):
            return ExifMetadataResult(matchesDeclaredDate=None)

    @staticmethod
    def verify_face_in_event(event_photo_bytes: bytes) -> FaceVerificationResult:
        if not settings.FACE_MATCHING_ENABLED:
            return FaceVerificationResult(
                status="NOT_CHECKED",
                facesDetected=0,
                matchedFaceBoundingBox=None,
                statusMessage="Đã tắt xử lý khuôn mặt theo cấu hình; không thực hiện phát hiện hoặc đối chiếu.",
            )
        if cv2 is None:
            return FaceVerificationResult(status="NOT_CHECKED", statusMessage="OpenCV chưa được cài; không thể phát hiện khuôn mặt.")
        try:
            image = Image.open(io.BytesIO(event_photo_bytes)).convert("RGB")
            import numpy as np

            gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
            classifier = getattr(cv2, "CascadeClassifier", None)
            data = getattr(cv2, "data", None)
            cascade_path = getattr(data, "haarcascades", None)
            if classifier is None or not cascade_path:
                return FaceVerificationResult(status="NOT_CHECKED", statusMessage="Bản OpenCV hiện tại không hỗ trợ Haar Cascade.")
            cascade = classifier(cascade_path + "haarcascade_frontalface_default.xml")
            if cascade.empty():
                return FaceVerificationResult(status="NOT_CHECKED", statusMessage="Không tải được mô hình phát hiện khuôn mặt OpenCV.")
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
            boxes = [tuple(int(value) for value in face) for face in faces]
            best_box = None
            if boxes:
                x, y, width, height = max(boxes, key=lambda box: box[2] * box[3])
                best_box = BoundingBox(x=x, y=y, width=width, height=height)
            return FaceVerificationResult(
                status="REVIEW",
                facesDetected=len(boxes),
                matched=False,
                bestSimilarityScore=0,
                matchedFaceBoundingBox=best_box,
                confidenceBoost=0,
                identityComparisonAvailable=False,
                statusMessage="Chỉ phát hiện khuôn mặt; chưa có mô hình đối chiếu danh tính với ảnh hồ sơ.",
            )
        except (OSError, ValueError):
            return FaceVerificationResult(status="NOT_CHECKED", statusMessage="Không đọc được ảnh để phát hiện khuôn mặt.")

    @staticmethod
    def classify_visual_scene(image_bytes: Optional[bytes]) -> Optional[tuple[str, float]]:
        if not image_bytes:
            return None
        model, classes = _load_scene_classifier()
        if model is None or not classes:
            return None
        try:
            import numpy as np
            import torch

            im = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224))
            arr = np.asarray(im, dtype=np.float32) / 255.0
            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            norm = ((arr - mean) / std).transpose((2, 0, 1))
            tensor = torch.from_numpy(norm).unsqueeze(0)
            with torch.no_grad():
                logits = model(tensor)
                probs = torch.softmax(logits, dim=-1)[0].cpu().numpy()
            idx = int(np.argmax(probs))
            return classes[idx], round(float(probs[idx]), 4)
        except Exception:
            return None

    @staticmethod
    def analyze_scene_vision(
        ocr_text: str,
        declared_activity: str,
        ocr_available: bool,
        image_bytes: Optional[bytes] = None,
    ) -> SceneVisionResult:
        cv_pred = FaceAndVisionService.classify_visual_scene(image_bytes)
        cv_suffix = f" · CV MobileNetV3: {cv_pred[0]} ({round(cv_pred[1] * 100)}%)" if cv_pred else ""
        if cv_pred and cv_pred[0] == "KHONG_PHAI_MINH_CHUNG" and cv_pred[1] >= 0.70:
            return SceneVisionResult(
                detectedBannerText=(ocr_text or "")[:500] or None,
                sceneContext=f"Model CV nhận diện ảnh không thuộc bối cảnh sự kiện/minh chứng{cv_suffix}",
                matchesActivity=False,
                available=True,
            )
        if not ocr_available:
            return SceneVisionResult(
                sceneContext=f"OCR chưa khả dụng{cv_suffix}",
                matchesActivity=None,
                available=False,
            )
        text = re.sub(r"\s+", " ", ocr_text).strip()
        if not text:
            return SceneVisionResult(
                sceneContext=f"OCR không tìm thấy chữ trên ảnh{cv_suffix}",
                matchesActivity=False,
                available=True,
            )
        normalize = lambda value: re.sub(
            r"[^a-z0-9 ]",
            "",
            "".join(
                c for c in unicodedata.normalize("NFD", value.casefold())
                if unicodedata.category(c) != "Mn"
            ),
        )
        activity_words = set(normalize(declared_activity).split())
        text_words = set(normalize(text).split())
        relevant = {word for word in activity_words if len(word) > 2}
        overlap = len(relevant & text_words) / len(relevant) if relevant else 0.0
        sequence_score = SequenceMatcher(None, normalize(declared_activity), normalize(text)).ratio()
        return SceneVisionResult(
            detectedBannerText=text[:500],
            sceneContext=f"Văn bản OCR trích xuất từ ảnh sự kiện{cv_suffix}",
            matchesActivity=overlap >= 0.3 or sequence_score >= 0.35,
            available=True,
        )
