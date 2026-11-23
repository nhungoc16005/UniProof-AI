"""
Công cụ đăng ký Kho phôi chuẩn Lớp 6 (apps/ai-service/templates/registry.json).
Sinh phôi chuẩn đối chiếu cho 5 loại chứng nhận/giấy khen của ĐH Bách khoa - ĐHĐN & đơn vị phối hợp,
tính pHash 64-bit và aspectRatio chuẩn xác để TemplateMatcher đối chiếu bố cục.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[3]
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
FILES_DIR = AI_SERVICE_DIR / "templates" / "files"
REGISTRY_PATH = AI_SERVICE_DIR / "templates" / "registry.json"
RENDER_SCRIPT = REPO_ROOT / "apps" / "backend" / "scripts" / "render_certificate.py"

sys.path.insert(0, str(AI_SERVICE_DIR))
from src.template_matcher import _compute_phash  # noqa: E402

TEMPLATE_SPECS = [
    {
        "templateId": "GIAY_HIEN_MAU-BVHH-2026-v1",
        "themeKey": "hien-mau",
        "documentType": "GIAY_HIEN_MAU",
        "source": "Bệnh viện Huyết học - Truyền máu Đà Nẵng",
        "docTitle": "GIẤY CHỨNG NHẬN HIẾN MÁU TÌNH NGUYỆN",
        "subtitle": "Trân trọng chứng nhận sinh viên",
        "bodyText": "Đã tham gia hiến máu tình nguyện tại Ngày hội Hiến máu Nhân đạo do Bệnh viện Huyết học - Truyền máu Đà Nẵng phối hợp Trường ĐH Bách khoa tổ chức.",
        "criterionLabel": "TC12 - Hoạt động phục vụ cộng đồng, tình nguyện",
        "fileName": "tpl-giay-hien-mau-2026-v1.png",
    },
    {
        "templateId": "GIAY_CHUNG_NHAN-NCKH-DUT-2026-v1",
        "themeKey": "nckh",
        "documentType": "GIAY_CHUNG_NHAN",
        "source": "Trường Đại học Bách khoa - Đại học Đà Nẵng",
        "docTitle": "GIẤY CHỨNG NHẬN NGHIÊN CỨU KHOA HỌC",
        "subtitle": "Chứng nhận thành tích Nghiên cứu Khoa học Sinh viên",
        "bodyText": "Đã hoàn thành xuất sắc Đề tài Nghiên cứu Khoa học Sinh viên và đạt Giải cấp Trường theo Quyết định khen thưởng của Hiệu trưởng.",
        "criterionLabel": "TC5 - Nghiên cứu khoa học, Olympic môn học",
        "fileName": "tpl-giay-chung-nhan-nckh-2026-v1.png",
    },
    {
        "templateId": "GIAY_XAC_NHAN-DUTCUP-2026-v1",
        "themeKey": "the-thao",
        "documentType": "GIAY_XAC_NHAN",
        "source": "Đoàn Thanh niên - Hội Sinh viên Trường ĐH Bách khoa",
        "docTitle": "GIẤY CHỨNG NHẬN THAM GIA THỂ THAO",
        "subtitle": "Chứng nhận vận động viên tham gia giải đấu",
        "bodyText": "Đã tích cực tham gia thi đấu tại Giải bóng đá truyền thống sinh viên DUT Cup 2026 do Đoàn Thanh niên - Hội Sinh viên Trường Đại học Bách khoa tổ chức.",
        "criterionLabel": "TC9 - Hoạt động văn hóa, văn nghệ, thể thao",
        "fileName": "tpl-giay-xac-nhan-dutcup-2026-v1.png",
    },
    {
        "templateId": "GIAY_CHUNG_NHAN-KYNANG-DUT-2026-v1",
        "themeKey": "ky-nang-mem",
        "documentType": "GIAY_CHUNG_NHAN",
        "source": "Trung tâm Hỗ trợ Sinh viên & Quan hệ Doanh nghiệp ĐHBK",
        "docTitle": "CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC",
        "subtitle": "Chứng nhận đã hoàn thành chương trình đào tạo",
        "bodyText": "Đã hoàn thành chương trình tập huấn Kỹ năng Giao tiếp & Thuyết trình chuyên nghiệp (16 giờ học) với kết quả đạt yêu cầu xuất sắc.",
        "criterionLabel": "TC8 - Giáo dục chính trị, tư tưởng, kỹ năng mềm",
        "fileName": "tpl-chung-chi-ky-nang-2026-v1.png",
    },
    {
        "templateId": "GIAY_KHEN-DTN-DUT-2026-v1",
        "themeKey": "khen-thuong-can-bo",
        "documentType": "GIAY_KHEN",
        "source": "Ban Chấp hành Đoàn Trường Đại học Bách khoa",
        "docTitle": "GIẤY KHEN HOÀN THÀNH XUẤT SẮC NHIỆM VỤ",
        "subtitle": "Ban Chấp hành Đoàn Trường tuyên dương và khen thưởng",
        "bodyText": "Đã hoàn thành xuất sắc nhiệm vụ công tác Ban Cán sự Lớp và phong trào thanh niên học kỳ 1 năm học 2026-2027.",
        "criterionLabel": "TC15 - Hoàn thành xuất sắc nhiệm vụ và được khen thưởng",
        "fileName": "tpl-giay-khen-dtn-2026-v1.png",
    },
]


def main() -> None:
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for spec in TEMPLATE_SPECS:
        out_file = FILES_DIR / spec["fileName"]
        payload = {
            "themeKey": spec["themeKey"],
            "docTitle": spec["docTitle"],
            "subtitle": spec["subtitle"],
            "issuer": spec["source"],
            "studentName": "NGUYỄN VĂN MẪU PHÔI",
            "studentCode": "102210000",
            "classCode": "21TCLC_DT1",
            "bodyText": spec["bodyText"],
            "criterionLabel": spec["criterionLabel"],
            "serialNo": f"TPL-{spec['templateId']}",
            "issueDate": "15/10/2026",
            "realisticScan": True,
        }
        subprocess.run(
            [sys.executable, str(RENDER_SCRIPT), str(out_file)],
            input=json.dumps(payload).encode("utf-8"),
            check=True,
        )
        img_bytes = out_file.read_bytes()
        with Image.open(out_file) as im:
            w, h = im.size
        phash = _compute_phash(img_bytes)
        entries.append(
            {
                "templateId": spec["templateId"],
                "documentType": spec["documentType"],
                "source": spec["source"],
                "effectiveFrom": "2024-01-01",
                "effectiveTo": None,
                "version": "1",
                "pHash": phash,
                "aspectRatio": round(w / h, 4),
                "fileRef": f"templates/files/{spec['fileName']}",
            }
        )
    registry_payload = {"schemaVersion": 1, "templates": entries}
    REGISTRY_PATH.write_text(json.dumps(registry_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Registered {len(entries)} official templates -> {REGISTRY_PATH}")


if __name__ == "__main__":
    main()
