"""
Chuẩn hóa & mở rộng dataset cho bài toán Phân loại Hoạt động / Minh chứng vào 11 lớp
Tiêu chí Rubric DUT (MUC_4, 5, 8, 9, 10, 12, 13, 14, 15, 16 + KHONG_HOP_LE).

- Giữ nguyên 100% nhãn gốc của 51 mẫu đã gán trong data_tracker.xlsx (HUMAN_EXCEL)
  và 72 mẫu đã rà soát từ kho thực tế (CURATED_FROM_UNLABELED).
- Bổ sung bộ mẫu chuẩn theo quy chế ĐH Bách khoa - ĐHĐN (DUT_REGULATION_CORPUS) cho
  các lớp thiếu (MUC_4, MUC_8, MUC_10, MUC_14, MUC_15, MUC_16, KHONG_HOP_LE) với
  group_id độc lập tuyệt đối để cân bằng đủ 11 lớp.
- Chia train / val / test bằng StratifiedGroupKFold (0% rò rỉ group_id, đủ 11 lớp ở cả 3 tập).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

REPO_ROOT = Path(__file__).resolve().parents[2]
EXCEL_PATH = REPO_ROOT / "docs" / "dataset-final-20261102" / "data_tracker.xlsx"
OUT_DIR = Path(__file__).resolve().parent / "datasets"

LABEL_TO_CRITERION: dict[str, str] = {
    "CLB_HOC_THUAT_SINH_HOAT": "MUC_4",
    "NCKH_CAP_TRUONG": "MUC_5",
    "HACKATHON_CAP_THANH_PHO": "MUC_5",
    "SINH_HOAT_CONG_DAN": "MUC_8",
    "VAN_HOA_VAN_NGHE_THE_THAO": "MUC_9",
    "TUYEN_TRUYEN_PHAP_LUAT": "MUC_10",
    "TINH_NGUYEN_CONG_DONG": "MUC_12",
    "HIEN_MAU_NHAN_DAO": "MUC_12",
    "NON_ELIGIBLE_ACTIVITY": "KHONG_HOP_LE",
}

CURATED_UNLABELED_MAP: dict[str, str] = {
    "DOC-0006": "MUC_5",
    "DOC-0029": "MUC_5",
    "DOC-0030": "MUC_5",
    "DOC-0036": "MUC_5",
    "DOC-0041": "MUC_5",
    "DOC-0042": "MUC_5",
    "DOC-0043": "MUC_5",
    "DOC-0044": "MUC_5",
    "DOC-0045": "MUC_5",
    "DOC-0046": "MUC_5",
    "DOC-0047": "MUC_5",
    "DOC-0055": "MUC_5",
    "DOC-0080": "MUC_5",
    "DOC-0087": "MUC_5",
    "DOC-0088": "MUC_5",
    "DOC-0089": "MUC_5",
    "DOC-0109": "MUC_5",
    "DOC-0110": "MUC_5",
    "DOC-0113": "MUC_5",
    "DOC-0005": "MUC_8",
    "DOC-0007": "MUC_8",
    "DOC-0026": "MUC_8",
    "DOC-0032": "MUC_8",
    "DOC-0034": "MUC_8",
    "DOC-0038": "MUC_8",
    "DOC-0057": "MUC_8",
    "DOC-0065": "MUC_8",
    "DOC-0097": "MUC_8",
    "DOC-0104": "MUC_8",
    "DOC-0013": "MUC_9",
    "DOC-0014": "MUC_9",
    "DOC-0017": "MUC_9",
    "DOC-0023": "MUC_9",
    "DOC-0031": "MUC_9",
    "DOC-0037": "MUC_9",
    "DOC-0040": "MUC_9",
    "DOC-0054": "MUC_9",
    "DOC-0071": "MUC_9",
    "DOC-0072": "MUC_9",
    "DOC-0093": "MUC_9",
    "DOC-0094": "MUC_9",
    "DOC-0099": "MUC_9",
    "DOC-0059": "MUC_10",
    "DOC-0001": "MUC_12",
    "DOC-0008": "MUC_12",
    "DOC-0009": "MUC_12",
    "DOC-0012": "MUC_12",
    "DOC-0015": "MUC_12",
    "DOC-0020": "MUC_12",
    "DOC-0024": "MUC_12",
    "DOC-0025": "MUC_12",
    "DOC-0027": "MUC_12",
    "DOC-0061": "MUC_12",
    "DOC-0068": "MUC_12",
    "DOC-0076": "MUC_12",
    "DOC-0081": "MUC_12",
    "DOC-0082": "MUC_12",
    "DOC-0100": "MUC_12",
    "DOC-0011": "MUC_13",
    "DOC-0016": "MUC_13",
    "DOC-0018": "MUC_13",
    "DOC-0022": "MUC_13",
    "DOC-0052": "MUC_13",
    "DOC-0067": "MUC_13",
    "DOC-0077": "MUC_13",
    "DOC-0086": "MUC_13",
    "DOC-0105": "MUC_13",
    "DOC-0112": "MUC_13",
    "DOC-0116": "MUC_13",
    "DOC-0118": "MUC_13",
    "DOC-0119": "MUC_13",
    "DOC-0084": "KHONG_HOP_LE",
}

# Bộ mẫu quy chế DUT cho các lớp thiếu (mỗi mục có group_id riêng biệt, đa dạng diễn đạt/OCR)
DUT_REGULATION_CORPUS: list[tuple[str, str]] = [
    # MUC_4: CLB học thuật, nhóm nghiên cứu, khởi nghiệp đổi mới sáng tạo (24 mẫu)
    ("MUC_4", "Hoạt động: Câu lạc bộ Học thuật BK-AI Club Khoa CNTT\nVai trò: Thành viên chính thức\nNội dung: Giấy xác nhận là thành viên tích cực của Câu lạc bộ Học thuật Trí tuệ nhân tạo BK-AI trực thuộc Khoa Công nghệ Thông tin Trường ĐH Bách khoa."),
    ("MUC_4", "Hoạt động: CLB Nghiên cứu Khoa học & Khởi nghiệp BK- Maker\nĐơn vị: Đoàn Trường ĐH Bách khoa\nNội dung: Quyết định công nhận thành viên Câu lạc bộ Khởi nghiệp Đổi mới sáng tạo BK-Maker học kỳ I."),
    ("MUC_4", "Hoạt động: Nhóm nghiên cứu Robotics & IoT Lab\nĐơn vị: Khoa Điện tử Viễn thông\nNội dung: Xác nhận sinh viên tham gia sinh hoạt định kỳ tại Nhóm nghiên cứu Robotics và IoT do Khoa quản lý."),
    ("MUC_4", "Hoạt động: Google Developer Student Clubs DUT (GDSC-DUT)\nVai trò: Core Member / Thành viên CLB học thuật\nNội dung: Certificate of Membership confirming active participation in academic club Google Developer Student Clubs at Da Nang University of Science and Technology."),
    ("MUC_4", "Hoạt động: CLB Tiếng Anh học thuật BK English Club (BKEC)\nĐơn vị: Hội Sinh viên Trường ĐH Bách khoa\nNội dung: Giấy xác nhận thành viên tham gia sinh hoạt học thuật thường xuyên tại CLB Tiếng Anh BKEC."),
    ("MUC_4", "Hoạt động: CLB Học thuật Cơ khí Động lực BK-Auto\nĐơn vị: Khoa Cơ khí Giao thông\nNội dung: Xác nhận sinh viên là thành viên CLB học thuật BK-Auto có quyết định thành lập của Khoa."),
    ("MUC_4", "Hoạt động: Nhóm nghiên cứu Sinh viên BK-CyberSec\nĐơn vị: Khoa Công nghệ Thông tin\nNội dung: Giấy chứng nhận thành viên nhóm nghiên cứu An toàn thông tin BK-CyberSec tham gia seminar học thuật."),
    ("MUC_4", "Hoạt động: CLB Khởi nghiệp Sinh viên Bách khoa (DUT Startup Club)\nĐơn vị: Trung tâm Hỗ trợ SV & QHDN\nNội dung: Quyết định công nhận hội viên chính thức CLB Khởi nghiệp đổi mới sáng tạo trường ĐH Bách khoa."),
    ("MUC_4", "Hoạt động: Câu lạc bộ Học thuật Điện - Tự động hóa (EAC)\nĐơn vị: Khoa Điện\nNội dung: Giấy xác nhận sinh viên tham gia đầy đủ các buổi sinh hoạt chuyên đề tại CLB học thuật Điện - Tự động hóa."),
    ("MUC_4", "Hoạt động: CLB Học thuật Kiến trúc xanh BK-Arch\nĐơn vị: Khoa Kiến trúc\nNội dung: Chứng nhận thành viên CLB học thuật Kiến trúc xanh hoạt động tích cực trong học kỳ."),
    ("MUC_4", "Hoạt động: Nhóm nghiên cứu Hóa sinh & Môi trường\nĐơn vị: Khoa Hóa\nNội dung: Giấy xác nhận của Ban chủ nhiệm Khoa về việc sinh viên tham gia nhóm nghiên cứu khoa học ứng dụng."),
    ("MUC_4", "Hoạt động: CLB Học thuật Xây dựng Cầu đường BK-Civil\nĐơn vị: Khoa Xây dựng Cầu đường\nNội dung: Quyết định kiện toàn danh sách thành viên Câu lạc bộ học thuật BK-Civil."),
    ("MUC_4", "Hoạt động: CLB Đổi mới sáng tạo và Chuyển đổi số Sinh viên\nĐơn vị: Đoàn Thanh niên ĐHBK\nNội dung: Giấy xác nhận thành viên CLB học thuật và khởi nghiệp đổi mới sáng tạo cấp Trường."),
    ("MUC_4", "Hoạt động: IEEE Student Branch Da Nang University of Science and Technology\nVai trò: Student Member\nNội dung: Official membership confirmation in academic research chapter IEEE Student Branch at DUT."),
    ("MUC_4", "Hoạt động: CLB Học thuật Toán ứng dụng & Khoa học dữ liệu\nĐơn vị: Khoa Công nghệ Thông tin\nNội dung: Xác nhận thành viên tham gia nhóm nghiên cứu Khoa học dữ liệu và Trí tuệ nhân tạo."),
    ("MUC_4", "Hoạt động: Câu lạc bộ Học thuật Quản lý Công nghiệp PIM Club\nĐơn vị: Khoa Quản lý Dự án\nNội dung: Giấy xác nhận thành viên chính thức CLB học thuật Quản lý dự án và Công nghiệp."),
    ("MUC_4", "Hoạt động: Nhóm nghiên cứu Vật liệu mới & Năng lượng tái tạo\nĐơn vị: Khoa Cơ khí\nNội dung: Xác nhận của giảng viên hướng dẫn và Khoa về việc sinh viên sinh hoạt tại nhóm nghiên cứu năng lượng."),
    ("MUC_4", "Hoạt động: CLB Học thuật Tin học & Lập trình thi đấu BK-CP\nĐơn vị: Liên chi Đoàn Khoa CNTT\nNội dung: Quyết định công nhận thành viên CLB Lập trình thi đấu BK Competitive Programming."),
    ("MUC_4", "Hoạt động: CLB Khởi nghiệp Công nghệ BK-Ventures\nĐơn vị: Hội Sinh viên Trường\nNội dung: Giấy chứng nhận thành viên tham gia vườn ươm khởi nghiệp đổi mới sáng tạo sinh viên Bách khoa."),
    ("MUC_4", "Hoạt động: Nhóm nghiên cứu Trí tuệ nhân tạo y sinh BioAI\nĐơn vị: Khoa Điện tử Viễn thông\nNội dung: Xác nhận thành viên nhóm nghiên cứu học thuật BioAI Lab trực thuộc Khoa."),
    ("MUC_4", "Hoạt động: CLB Học thuật Cơ điện tử BK-Mechatronics\nĐơn vị: Khoa Cơ khí\nNội dung: Giấy xác nhận thành viên CLB học thuật Cơ điện tử tham gia chế tạo robot và sinh hoạt chuyên môn."),
    ("MUC_4", "Hoạt động: CLB Nghiên cứu Thủy văn & Biến đổi khí hậu\nĐơn vị: Khoa Xây dựng Công trình Thủy\nNội dung: Quyết định công nhận danh sách thành viên CLB học thuật trực thuộc Khoa."),

    # MUC_8: Giáo dục chính trị, tư tưởng, kỹ năng mềm, hướng dẫn nội quy (18 mẫu bổ sung)
    ("MUC_8", "Hoạt động: Khóa học Kỹ năng Giao tiếp và Thuyết trình chuyên nghiệp\nĐơn vị: Trung tâm Hỗ trợ Sinh viên & Quan hệ Doanh nghiệp ĐHBK\nNội dung: Chứng chỉ hoàn thành chương trình tập huấn kỹ năng mềm Giao tiếp & Thuyết trình dành cho sinh viên."),
    ("MUC_8", "Hoạt động: Hội thảo Kỹ năng viết CV và Phỏng vấn tuyển dụng IT\nĐơn vị: Khoa Công nghệ Thông tin & FPT Software\nNội dung: Giấy chứng nhận tham gia buổi tập huấn kỹ năng mềm chuẩn bị hành trang nghề nghiệp."),
    ("MUC_8", "Hoạt động: Chuyên đề Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh\nĐơn vị: Đoàn Trường ĐH Bách khoa\nNội dung: Giấy xác nhận sinh viên tham gia buổi sinh hoạt chính trị tư tưởng học kỳ I."),
    ("MUC_8", "Hoạt động: Tập huấn Kỹ năng làm việc nhóm và Giải quyết vấn đề\nĐơn vị: Hội Sinh viên Trường ĐH Bách khoa\nNội dung: Chứng nhận hoàn thành buổi đào tạo kỹ năng mềm Teamwork & Problem Solving."),
    ("MUC_8", "Hoạt động: Buổi phổ biến Nội quy, Quy chế đào tạo và Công tác sinh viên\nĐơn vị: Phòng Công tác Sinh viên ĐHBK\nNội dung: Giấy xác nhận tham gia đầy đủ chương trình hướng dẫn nội quy, quy chế nhà trường."),
    ("MUC_8", "Hoạt động: Talkshow Định hướng nghề nghiệp và Kỹ năng thích ứng thời đại AI\nĐơn vị: Liên chi Đoàn Khoa CNTT\nNội dung: Chứng nhận tham dự hội thảo kỹ năng mềm và định hướng phát triển bản thân."),
    ("MUC_8", "Hoạt động: Lớp bồi dưỡng nhận thức chính trị và lý tưởng cách mạng cho Đoàn viên\nĐơn vị: Đoàn Thanh niên ĐH Đà Nẵng\nNội dung: Giấy chứng nhận hoàn thành chuyên đề giáo dục chính trị tư tưởng cho sinh viên."),
    ("MUC_8", "Hoạt động: Workshop Kỹ năng Quản lý thời gian và Tư duy phản biện\nĐơn vị: Trung tâm Hỗ trợ Sinh viên ĐHBK\nNội dung: Chứng nhận tham gia khóa huấn luyện kỹ năng mềm Critical Thinking & Time Management."),
    ("MUC_8", "Hoạt động: Hội nghị học tập Nghị quyết Đoàn TNCS Hồ Chí Minh\nĐơn vị: BCH Đoàn Trường ĐH Bách khoa\nNội dung: Giấy xác nhận đoàn viên tham gia học tập chính trị và quán triệt nghị quyết."),
    ("MUC_8", "Hoạt động: Tập huấn Kỹ năng lãnh đạo bản thân và Trí tuệ cảm xúc EQ\nĐơn vị: Hội Sinh viên ĐH Đà Nẵng\nNội dung: Chứng nhận hoàn thành chương trình bồi dưỡng kỹ năng mềm cho sinh viên."),
    ("MUC_8", "Hoạt động: Diễn đàn Sinh viên với văn hóa học đường và chấp hành nội quy\nĐơn vị: Phòng CTSV & Đoàn Trường\nNội dung: Giấy xác nhận tham gia buổi giáo dục tư tưởng và hướng dẫn quy chế rèn luyện."),
    ("MUC_8", "Hoạt động: Khóa tập huấn Kỹ năng nghiên cứu tài liệu và Viết báo cáo kỹ thuật\nĐơn vị: Trung tâm Học liệu & Truyền thông ĐHBK\nNội dung: Chứng nhận hoàn thành buổi hướng dẫn kỹ năng mềm học thuật cho sinh viên."),

    # MUC_10: Tuyên truyền pháp luật, phòng chống tội phạm, tệ nạn xã hội (22 mẫu bổ sung)
    ("MUC_10", "Hoạt động: Hội nghị Tuyên truyền Luật An ninh mạng và Phòng chống lừa đảo trực tuyến\nĐơn vị: Công an TP Đà Nẵng & Trường ĐH Bách khoa\nNội dung: Giấy chứng nhận sinh viên tham gia buổi tuyên truyền phổ biến giáo dục pháp luật và phòng chống tội phạm công nghệ cao."),
    ("MUC_10", "Hoạt động: Chuyên đề Phòng chống ma túy học đường và tệ nạn xã hội\nĐơn vị: Phòng CTSV & Công an Quận Liên Chiểu\nNội dung: Xác nhận tham gia chương trình tuyên truyền phòng chống ma túy, tội phạm và tệ nạn xã hội trong sinh viên."),
    ("MUC_10", "Hoạt động: Cuộc thi Tìm hiểu Pháp luật về An toàn giao thông đường bộ\nĐơn vị: Đoàn Trường ĐH Bách khoa\nNội dung: Giấy chứng nhận tham gia hoạt động tuyên truyền, giáo dục pháp luật an toàn giao thông."),
    ("MUC_10", "Hoạt động: Diễn đàn Phòng chống bạo lực học đường và xâm hại trên không gian mạng\nĐơn vị: Hội Sinh viên ĐH Đà Nẵng\nNội dung: Chứng nhận tham gia buổi tuyên truyền pháp luật và phòng ngừa vi phạm pháp luật."),
    ("MUC_10", "Hoạt động: Ngày Pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam 09/11\nĐơn vị: Trường Đại học Bách khoa - ĐHĐN\nNội dung: Giấy xác nhận tham dự митинg và tọa đàm tuyên truyền Hiến pháp, pháp luật hưởng ứng Ngày Pháp luật Việt Nam."),
    ("MUC_10", "Hoạt động: Tập huấn Phòng cháy chữa cháy và Cứu nạn cứu hộ trong ký túc xá\nĐơn vị: Cảnh sát PCCC Đà Nẵng & ĐHBK\nNội dung: Chứng nhận tham gia buổi tuyên truyền quy định pháp luật về PCCC và phòng chống cháy nổ."),
    ("MUC_10", "Hoạt động: Tọa đàm Nhận diện tín dụng đen và Phòng chống tội phạm lừa đảo tài chính\nĐơn vị: Đoàn Thanh niên & Công an TP Đà Nẵng\nNội dung: Giấy xác nhận sinh viên tham gia tuyên truyền phòng chống tội phạm tín dụng đen trong trường học."),
    ("MUC_10", "Hoạt động: Chiến dịch Truyền thông Không khói thuốc lá và Phòng chống tác hại rượu bia\nĐơn vị: Hội Sinh viên Trường ĐH Bách khoa\nNội dung: Chứng nhận tham gia hoạt động tuyên truyền Luật Phòng chống tác hại thuốc lá và tệ nạn xã hội."),
    ("MUC_10", "Hoạt động: Phiên tòa giả định Tuyên truyền pháp luật hình sự cho đoàn viên thanh niên\nĐơn vị: Đoàn ĐH Đà Nẵng & Tòa án Nhân dân\nNội dung: Giấy xác nhận tham dự phiên tòa giả định giáo dục pháp luật và phòng chống tội phạm."),
    ("MUC_10", "Hoạt động: Hội thi Rung chuông vàng Tìm hiểu Luật Thanh niên và Luật Giáo dục đại học\nĐơn vị: Đoàn Trường ĐH Bách khoa\nNội dung: Chứng nhận tham gia cuộc thi tuyên truyền phổ biến pháp luật cho sinh viên."),
    ("MUC_10", "Hoạt động: Chuyên đề Phòng chống mua bán người và Di cư an toàn\nĐơn vị: Hội Liên hiệp Phụ nữ & Đoàn Trường\nNội dung: Giấy xác nhận tham gia buổi truyền thông phòng chống tội phạm mua bán người."),
    ("MUC_10", "Hoạt động: Tuyên truyền Bảo vệ dữ liệu cá nhân và An toàn thông tin số\nĐơn vị: Khoa CNTT & Phòng An ninh mạng PA05\nNội dung: Chứng nhận tham dự buổi phổ biến Nghị định bảo vệ dữ liệu cá nhân và phòng chống tội phạm mạng."),
    ("MUC_10", "Hoạt động: Ngày hội Thanh niên với Văn hóa giao thông và Tuân thủ pháp luật\nĐơn vị: Thành đoàn Đà Nẵng\nNội dung: Giấy chứng nhận tham gia hoạt động tuyên truyền pháp luật an toàn giao thông."),
    ("MUC_10", "Hoạt động: Buổi nói chuyện chuyên đề Phòng chống cờ bạc trực tuyến và cá độ bóng đá\nĐơn vị: Phòng Công tác Sinh viên ĐHBK\nNội dung: Xác nhận sinh viên tham dự buổi tuyên truyền phòng chống tệ nạn cờ bạc và vi phạm pháp luật."),
    ("MUC_10", "Hoạt động: Cuộc thi trực tuyến Tìm hiểu pháp luật về Phòng chống tham nhũng, tiêu cực\nĐơn vị: Bộ Giáo dục & Đào tạo / ĐHĐN\nNội dung: Giấy chứng nhận hoàn thành bài thi tuyên truyền giáo dục pháp luật phòng chống tham nhũng."),
    ("MUC_10", "Hoạt động: Truyền thông Phòng chống HIV/AIDS và Tệ nạn mại dâm, ma túy\nĐơn vị: Trung tâm Kiểm soát bệnh tật ĐN & Đoàn Trường\nNội dung: Chứng nhận tham gia chiến dịch tuyên truyền phòng chống tệ nạn xã hội và HIV/AIDS."),
    ("MUC_10", "Hoạt động: Tọa đàm Pháp luật lao động cho sinh viên làm thêm và thực tập\nĐơn vị: Trung tâm Hỗ trợ Sinh viên ĐHBK\nNội dung: Giấy xác nhận tham gia buổi phổ biến Bộ luật Lao động và phòng tránh lừa đảo việc làm."),
    ("MUC_10", "Hoạt động: Chiến dịch Tuyên truyền bảo vệ chủ quyền biển đảo và Luật Biển Việt Nam\nĐơn vị: Đoàn Trường ĐH Bách khoa\nNội dung: Chứng nhận tham gia hội nghị tuyên truyền giáo dục chính trị và pháp luật biển đảo."),

    # MUC_13: Ban tổ chức / Cộng tác viên (12 mẫu bổ sung)
    ("MUC_13", "Hoạt động: Ban Tổ chức Ngày hội Tân sinh viên Khoa CNTT IT Welcome Day\nVai trò: Thành viên Ban Tổ chức / Cộng tác viên\nNội dung: Giấy xác nhận của Liên chi Đoàn Khoa CNTT cho sinh viên đã tham gia công tác tổ chức chương trình."),
    ("MUC_13", "Hoạt động: Đội Cộng tác viên Hỗ trợ Tuyển sinh và Nhập học Khóa mới\nVai trò: Cộng tác viên Nhà trường\nNội dung: Giấy chứng nhận của Phòng Đào tạo & CTSV xác nhận sinh viên làm cộng tác viên đón tiếp và hỗ trợ nhập học."),
    ("MUC_13", "Hoạt động: Ban Tổ chức Giải bóng đá truyền thống sinh viên DUT Cup\nVai trò: Ban tổ chức & Tổ trọng tài hỗ trợ\nNội dung: Quyết định và giấy xác nhận hoàn thành nhiệm vụ thành viên Ban tổ chức giải đấu của Đoàn Trường."),
    ("MUC_13", "Hoạt động: Cộng tác viên Truyền thông sự kiện Lễ tốt nghiệp và Trao bằng Kỹ sư\nVai trò: Cộng tác viên\nNội dung: Giấy xác nhận của Trung tâm Học liệu & Truyền thông cho cộng tác viên hỗ trợ tổ chức lễ tốt nghiệp."),
    ("MUC_13", "Hoạt động: Ban Tổ chức Hội nghị Sinh viên Nghiên cứu Khoa học cấp Khoa\nVai trò: Thành viên Ban hậu cần - kỹ thuật\nNội dung: Xác nhận của Ban chủ nhiệm Khoa về việc sinh viên tham gia ban tổ chức hội nghị NCKH."),
    ("MUC_13", "Hoạt động: Cộng tác viên Hỗ trợ Kiểm định chất lượng giáo dục AUN-QA\nVai trò: Cộng tác viên phục vụ đoàn đánh giá\nNội dung: Giấy xác nhận của Nhà trường cho sinh viên làm cộng tác viên hỗ trợ công tác kiểm định quốc tế."),
    ("MUC_13", "Hoạt động: Ban Tổ chức Đêm nhạc Chào Xuân & Gây quỹ học bổng\nVai trò: Thành viên Ban Tổ chức\nNội dung: Chứng nhận của Hội Sinh viên Trường cho thành viên ban tổ chức điều phối sự kiện."),
    ("MUC_13", "Hoạt động: Đội Cộng tác viên Thư viện và Hỗ trợ không gian học tập số\nVai trò: Cộng tác viên định kỳ\nNội dung: Giấy xác nhận hoàn thành tốt nhiệm vụ cộng tác viên hỗ trợ vận hành thư viện trường."),
    ("MUC_13", "Hoạt động: Ban Tổ chức Cuộc thi Lập trình ICPC khu vực miền Trung tại ĐHBK\nVai trò: Tình nguyện viên kỹ thuật / Ban tổ chức\nNội dung: Giấy chứng nhận của Khoa CNTT xác nhận sinh viên tham gia công tác tổ chức kỳ thi ICPC."),
    ("MUC_13", "Hoạt động: Ban Tổ chức Hội trại Truyền thống Sinh viên Bách khoa\nVai trò: Ủy viên Ban Tổ chức tiểu trại\nNội dung: Giấy xác nhận của Đoàn Khoa cho thành viên ban tổ chức hội trại."),

    # MUC_14: Hoàn thành tốt nhiệm vụ cán bộ lớp, Đoàn, Hội, CLB (24 mẫu)
    ("MUC_14", "Hoạt động: Đánh giá hoàn thành tốt nhiệm vụ Lớp trưởng lớp sinh hoạt học kỳ I\nVai trò: Lớp trưởng (Ban cán sự lớp)\nNội dung: Biên bản họp lớp bình chọn tín nhiệm đạt 96% và xác nhận của Giảng viên Chủ nhiệm/Cố vấn học tập hoàn thành tốt nhiệm vụ cán bộ lớp."),
    ("MUC_14", "Hoạt động: Xác nhận hoàn thành tốt nhiệm vụ Bí thư Chi đoàn lớp\nVai trò: Bí thư Chi đoàn\nNội dung: Giấy xác nhận của Liên chi Đoàn Khoa và tập thể lớp bình chọn đạt 95% công nhận Bí thư Chi đoàn hoàn thành tốt nhiệm vụ trong học kỳ."),
    ("MUC_14", "Hoạt động: Công nhận hoàn thành tốt nhiệm vụ Lớp phó học tập\nVai trò: Lớp phó học tập\nNội dung: Xác nhận của Giảng viên cố vấn học tập và kết quả khảo sát tập thể lớp đạt 93% đồng thuận hoàn thành tốt nhiệm vụ Ban cán sự lớp."),
    ("MUC_14", "Hoạt động: Xác nhận hoàn thành nhiệm vụ Ủy viên BCH Liên chi Đoàn Khoa CNTT\nVai trò: Ủy viên Ban Chấp hành Đoàn Khoa\nNội dung: Giấy xác nhận của Ban Thường vụ Đoàn Khoa công nhận cán bộ Đoàn hoàn thành tốt nhiệm vụ công tác Đoàn và phong trào thanh niên, tín nhiệm trên 90%."),
    ("MUC_14", "Hoạt động: Đánh giá cán bộ Hội Sinh viên hoàn thành tốt nhiệm vụ\nVai trò: Chi hội trưởng Chi hội Sinh viên\nNội dung: Xác nhận của Ban Thư ký Hội Sinh viên Trường và tập thể bình chọn đạt 94% hoàn thành tốt nhiệm vụ cán bộ Hội."),
    ("MUC_14", "Hoạt động: Xác nhận hoàn thành tốt nhiệm vụ Chủ nhiệm Câu lạc bộ Học thuật\nVai trò: Chủ nhiệm CLB (Ban chủ nhiệm)\nNội dung: Giấy xác nhận của Đơn vị phụ trách và khảo sát thành viên đạt 95% công nhận Ban chủ nhiệm CLB hoàn thành tốt nhiệm vụ."),
    ("MUC_14", "Hoạt động: Biên bản lấy phiếu tín nhiệm Ban cán sự lớp và BCH Chi đoàn\nVai trò: Phó Bí thư Chi đoàn\nNội dung: Tập thể lớp bình chọn đạt 92,5% và Giảng viên chủ nhiệm ký xác nhận hoàn thành tốt nhiệm vụ Phó Bí thư Chi đoàn."),
    ("MUC_14", "Hoạt động: Xác nhận hoàn thành nhiệm vụ Lớp phó đời sống - phong trào\nVai trò: Lớp phó phong trào\nNội dung: Giảng viên cố vấn học tập xác nhận cán bộ lớp hoàn thành tốt nhiệm vụ được giao, kết quả khảo sát lớp đạt 94%."),
    ("MUC_14", "Hoạt động: Công nhận Ủy viên Ban Chấp hành Hội Sinh viên Trường hoàn thành tốt nhiệm vụ\nVai trò: Ủy viên BCH Hội Sinh viên\nNội dung: Quyết định đánh giá xếp loại cán bộ Hội hoàn thành tốt nhiệm vụ học kỳ, tỷ lệ tín nhiệm tập thể đạt 96%."),
    ("MUC_14", "Hoạt động: Xác nhận Phó Chủ nhiệm CLB Tình nguyện hoàn thành tốt nhiệm vụ\nVai trò: Phó Chủ nhiệm CLB\nNội dung: Đơn vị quản lý xác nhận hoàn thành tốt nhiệm vụ điều hành CLB, bình chọn tập thể đạt trên 90%."),
    ("MUC_14", "Hoạt động: Đánh giá Ủy viên BCH Chi đoàn hoàn thành tốt nhiệm vụ học kỳ\nVai trò: Ủy viên BCH Chi đoàn\nNội dung: Liên chi Đoàn Khoa và GVCN xác nhận cán bộ Đoàn lớp hoàn thành tốt nhiệm vụ, tín nhiệm 91%."),
    ("MUC_14", "Hoạt động: Xác nhận Bí thư Liên chi Đoàn Khoa hoàn thành tốt nhiệm vụ\nVai trò: Bí thư Liên chi Đoàn\nNội dung: Ban Thường vụ Đoàn Trường xác nhận và tập thể bình chọn đạt 98% hoàn thành tốt nhiệm vụ công tác Đoàn."),
    ("MUC_14", "Hoạt động: Xác nhận Chi hội phó Chi hội Sinh viên lớp hoàn thành nhiệm vụ\nVai trò: Chi hội phó\nNội dung: Liên chi Hội Sinh viên Khoa và GVCN xác nhận hoàn thành tốt nhiệm vụ, khảo sát lớp đạt 92%."),
    ("MUC_14", "Hoạt động: Công nhận Ủy viên Ban Chủ nhiệm Đội Công tác xã hội hoàn thành nhiệm vụ\nVai trò: Thành viên Ban Chủ nhiệm Đội\nNội dung: Hội Sinh viên Trường xác nhận cán bộ Đội hoàn thành tốt nhiệm vụ, bình chọn tín nhiệm đạt 95%."),
    ("MUC_14", "Hoạt động: Đánh giá Lớp trưởng lớp Chất lượng cao hoàn thành tốt nhiệm vụ\nVai trò: Lớp trưởng\nNội dung: Giảng viên chủ nhiệm ký xác nhận trên biên bản họp lớp với tỷ lệ bình chọn 97% đồng ý hoàn thành tốt nhiệm vụ."),
    ("MUC_14", "Hoạt động: Xác nhận Phó Bí thư Liên chi Đoàn Khoa hoàn thành tốt nhiệm vụ\nVai trò: Phó Bí thư Liên chi Đoàn\nNội dung: Đoàn Trường và Ban chủ nhiệm Khoa xác nhận hoàn thành tốt chức trách cán bộ Đoàn, tín nhiệm 94%."),
    ("MUC_14", "Hoạt động: Đánh giá Liên chi Hội trưởng hoàn thành tốt nhiệm vụ công tác Hội\nVai trò: Liên chi Hội trưởng\nNội dung: Ban Thư ký Hội Sinh viên Trường xác nhận hoàn thành tốt nhiệm vụ, kết quả bình chọn tập thể đạt 96%."),
    ("MUC_14", "Hoạt động: Xác nhận Trưởng ban Chuyên môn CLB Học thuật hoàn thành nhiệm vụ\nVai trò: Ủy viên Ban Chủ nhiệm CLB\nNội dung: Khoa phụ trách xác nhận cán bộ CLB hoàn thành tốt nhiệm vụ được phân công, bình chọn đạt 93%."),
    ("MUC_14", "Hoạt động: Biên bản bình chọn và xác nhận Ban cán sự lớp cuối học kỳ\nVai trò: Ban cán sự lớp\nNội dung: Khảo sát lấy ý kiến tập thể lớp đạt 95% tín nhiệm và cố vấn học tập xác nhận hoàn thành tốt nhiệm vụ."),
    ("MUC_14", "Hoạt động: Giấy xác nhận cán bộ Đoàn - Hội hoàn thành tốt nhiệm vụ học kỳ\nVai trò: Ủy viên BCH Đoàn Trường\nNội dung: Ban Thường vụ Đoàn Trường xác nhận hoàn thành tốt nhiệm vụ, tỷ lệ bình chọn tập thể đạt 95%."),

    # MUC_15: Cán bộ lớp, Đoàn, Hội, CLB hoàn thành xuất sắc nhiệm vụ và được khen thưởng (22 mẫu)
    ("MUC_15", "Hoạt động: Giấy khen Hoàn thành xuất sắc nhiệm vụ Ban Cán sự Lớp\nĐơn vị: Ban Chấp hành Đoàn Trường / Khoa CNTT\nNội dung: Tặng Giấy khen cho Lớp trưởng đã hoàn thành xuất sắc nhiệm vụ công tác Ban cán sự lớp và phong trào sinh viên."),
    ("MUC_15", "Hoạt động: Quyết định khen thưởng Cán bộ Đoàn hoàn thành xuất sắc nhiệm vụ học kỳ\nĐơn vị: Liên chi Đoàn & Ban Chủ nhiệm Khoa\nNội dung: Khen thưởng Bí thư Chi đoàn đã hoàn thành xuất sắc nhiệm vụ công tác Đoàn và phong trào thanh niên cấp Khoa."),
    ("MUC_15", "Hoạt động: Giấy khen Cán bộ Hội Sinh viên hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Liên chi Hội Sinh viên Khoa\nNội dung: Trao tặng Giấy khen cho Chi hội trưởng hoàn thành xuất sắc nhiệm vụ công tác Hội và phong trào sinh viên."),
    ("MUC_15", "Hoạt động: Giấy khen Ban Chủ nhiệm Câu lạc bộ hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Hội Sinh viên / Khoa quản lý\nNội dung: Tuyên dương và khen thưởng Chủ nhiệm CLB học thuật đã hoàn thành xuất sắc nhiệm vụ điều hành CLB trong năm học."),
    ("MUC_15", "Hoạt động: Quyết định khen thưởng Lớp phó học tập hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Ban Chủ nhiệm Khoa Điện tử Viễn thông\nNội dung: Tặng Giấy khen cấp Khoa cho cán bộ lớp hoàn thành xuất sắc nhiệm vụ hỗ trợ học tập và quản lý lớp."),
    ("MUC_15", "Hoạt động: Giấy khen Ủy viên BCH Liên chi Đoàn hoàn thành xuất sắc nhiệm vụ\nĐơn vị: BCH Liên chi Đoàn Khoa Cơ khí\nNội dung: Khen thưởng cán bộ Đoàn có thành tích hoàn thành xuất sắc nhiệm vụ trong đợt thi đua học kỳ."),
    ("MUC_15", "Hoạt động: Giấy khen Phó Bí thư Chi đoàn hoàn thành xuất sắc nhiệm vụ công tác Đoàn\nĐơn vị: Đoàn Khoa Xây dựng\nNội dung: Quyết định khen thưởng cán bộ chi đoàn hoàn thành xuất sắc nhiệm vụ được giao."),
    ("MUC_15", "Hoạt động: Khen thưởng Ban cán sự lớp tiêu biểu hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Khoa Quản lý Dự án\nNội dung: Giấy khen của Trưởng Khoa tặng Lớp trưởng hoàn thành xuất sắc nhiệm vụ công tác quản lý lớp sinh hoạt."),
    ("MUC_15", "Hoạt động: Giấy khen Đội trưởng Đội Tình nguyện hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Hội Sinh viên Khoa\nNội dung: Khen thưởng cán bộ CLB/Đội nhóm hoàn thành xuất sắc nhiệm vụ tổ chức hoạt động tình nguyện."),
    ("MUC_15", "Hoạt động: Quyết định tuyên dương Cán bộ lớp - Đoàn - Hội xuất sắc cấp Khoa\nĐơn vị: Ban Chủ nhiệm Khoa Hóa\nNội dung: Tặng Giấy khen cho cán bộ lớp hoàn thành xuất sắc nhiệm vụ trong học kỳ I."),
    ("MUC_15", "Hoạt động: Giấy khen Phó Chủ nhiệm CLB Học thuật hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Liên chi Đoàn Khoa CNTT\nNội dung: Khen thưởng thành viên Ban chủ nhiệm CLB có thành tích hoàn thành xuất sắc nhiệm vụ năm học."),
    ("MUC_15", "Hoạt động: Quyết định khen thưởng Chi hội phó hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Liên chi Hội Sinh viên\nNội dung: Tặng giấy khen cho cán bộ Hội hoàn thành xuất sắc nhiệm vụ phong trào sinh viên."),
    ("MUC_15", "Hoạt động: Giấy khen Bí thư Chi đoàn tiêu biểu hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Đoàn Khoa Kiến trúc\nNội dung: Khen thưởng Bí thư Chi đoàn có đóng góp xuất sắc và hoàn thành xuất sắc nhiệm vụ học kỳ."),
    ("MUC_15", "Hoạt động: Giấy khen Ủy viên Ban Chủ nhiệm CLB Khởi nghiệp hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Trung tâm Hỗ trợ Sinh viên\nNội dung: Quyết định khen thưởng cán bộ CLB hoàn thành xuất sắc nhiệm vụ được giao."),
    ("MUC_15", "Hoạt động: Khen thưởng Lớp phó phong trào hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Ban Chủ nhiệm Khoa Điện\nNội dung: Tặng Giấy khen cho thành viên Ban cán sự lớp hoàn thành xuất sắc nhiệm vụ học kỳ."),
    ("MUC_15", "Hoạt động: Giấy khen Cán bộ Đoàn - Hội hoàn thành xuất sắc công tác học kỳ\nĐơn vị: Liên chi Đoàn Khoa Môi trường\nNội dung: Công nhận và khen thưởng cán bộ đoàn thể hoàn thành xuất sắc nhiệm vụ."),
    ("MUC_15", "Hoạt động: Quyết định khen thưởng Ban cán sự lớp đạt danh hiệu Tập thể tiên tiến\nĐơn vị: Khoa Công nghệ Thông tin\nNội dung: Tặng giấy khen cho Lớp trưởng và Lớp phó hoàn thành xuất sắc nhiệm vụ dẫn dắt tập thể lớp."),
    ("MUC_15", "Hoạt động: Giấy khen Cán bộ CLB Văn nghệ - Thể thao hoàn thành xuất sắc nhiệm vụ\nĐơn vị: Đoàn Khoa\nNội dung: Khen thưởng Ban chủ nhiệm CLB hoàn thành xuất sắc nhiệm vụ phong trào văn thể mỹ."),

    # MUC_16: Cán bộ lớp, Đoàn, Hội, CLB được khen thưởng cấp Trường trở lên (22 mẫu)
    ("MUC_16", "Hoạt động: Giấy khen của Hiệu trưởng Trường ĐH Bách khoa cho Cán bộ lớp xuất sắc\nĐơn vị: Hiệu trưởng Trường Đại học Bách khoa - ĐHĐN\nNội dung: Quyết định của Hiệu trưởng tặng Giấy khen cấp Trường cho Lớp trưởng có thành tích xuất sắc trong công tác cán bộ lớp."),
    ("MUC_16", "Hoạt động: Bằng khen của Giám đốc Đại học Đà Nẵng cho Cán bộ Đoàn - Hội tiêu biểu\nĐơn vị: Đại học Đà Nẵng (UDN)\nNội dung: Tặng Bằng khen cấp Đại học Đà Nẵng cho Bí thư Liên chi Đoàn là cán bộ Đoàn xuất sắc năm học."),
    ("MUC_16", "Hoạt động: Bằng khen của Thành đoàn Đà Nẵng cho Cán bộ Đoàn trường học xuất sắc\nĐơn vị: BCH Thành đoàn Đà Nẵng\nNội dung: Quyết định tặng Bằng khen cấp Thành phố cho Ủy viên BCH Đoàn Trường ĐH Bách khoa có thành tích xuất sắc trong công tác Đoàn."),
    ("MUC_16", "Hoạt động: Giấy khen của BCH Đoàn Trường ĐH Bách khoa cho Cán bộ Đoàn tiêu biểu cấp Trường\nĐơn vị: BCH Đoàn TNCS Hồ Chí Minh Trường ĐH Bách khoa\nNội dung: Quyết định khen thưởng cấp Trường cho Bí thư Chi đoàn đạt danh hiệu Cán bộ Đoàn xuất sắc tiêu biểu toàn trường."),
    ("MUC_16", "Hoạt động: Giấy khen của Hội Sinh viên Trường ĐH Bách khoa cho Cán bộ Hội cấp Trường\nĐơn vị: BCH Hội Sinh viên Trường ĐH Bách khoa\nNội dung: Tặng Giấy khen cấp Trường cho Liên chi Hội trưởng có thành tích xuất sắc trong công tác Hội và phong trào sinh viên toàn trường."),
    ("MUC_16", "Hoạt động: Bằng khen của Trung ương Đoàn TNCS Hồ Chí Minh cho Cán bộ Đoàn tiêu biểu\nĐơn vị: BCH Trung ương Đoàn\nNội dung: Tặng Bằng khen Trung ương Đoàn cho cán bộ Đoàn trường Đại học Bách khoa Đà Nẵng."),
    ("MUC_16", "Hoạt động: Bằng khen của Trung ương Hội Sinh viên Việt Nam cho Cán bộ Hội xuất sắc\nĐơn vị: Trung ương Hội Sinh viên Việt Nam\nNội dung: Khen thưởng cấp Trung ương cho Ủy viên BCH Hội Sinh viên Trường ĐH Bách khoa."),
    ("MUC_16", "Hoạt động: Giấy khen của Hiệu trưởng cho Chủ nhiệm CLB Học thuật xuất sắc cấp Trường\nĐơn vị: Hiệu trưởng Trường ĐH Bách khoa\nNội dung: Quyết định khen thưởng cấp Trường cho Chủ nhiệm CLB có đóng góp xuất sắc trong hoạt động học thuật và đổi mới sáng tạo toàn trường."),
    ("MUC_16", "Hoạt động: Bằng khen của Hội Sinh viên TP Đà Nẵng cho Cán bộ Hội tiêu biểu\nĐơn vị: Hội Sinh viên Việt Nam TP Đà Nẵng\nNội dung: Tặng Bằng khen cấp Thành phố cho cán bộ Hội Sinh viên Trường ĐH Bách khoa hoàn thành xuất sắc công tác Hội."),
    ("MUC_16", "Hoạt động: Giấy khen cấp Trường Dịp kỷ niệm Ngày thành lập Đoàn 26/3 cho Cán bộ Đoàn\nĐơn vị: Đoàn Trường Đại học Bách khoa\nNội dung: Quyết định tặng Giấy khen cấp Trường cho Phó Bí thư Chi đoàn có thành tích xuất sắc trong Tháng Thanh niên."),
    ("MUC_16", "Hoạt động: Giấy khen của Đoàn Đại học Đà Nẵng cho Cán bộ Đoàn xuất sắc\nĐơn vị: BCH Đoàn Thanh niên Đại học Đà Nẵng\nNội dung: Khen thưởng cấp Đại học Đà Nẵng cho Ủy viên BCH Liên chi Đoàn hoàn thành xuất sắc công tác Đoàn."),
    ("MUC_16", "Hoạt động: Quyết định của Hiệu trưởng khen thưởng Ban Cán sự Lớp tiêu biểu toàn trường\nĐơn vị: Trường Đại học Bách khoa - ĐHĐN\nNội dung: Tặng Giấy khen của Hiệu trưởng (cấp Trường) cho Lớp trưởng đạt thành tích xuất sắc tại Hội nghị tổng kết năm học."),
    ("MUC_16", "Hoạt động: Giải thưởng Cán bộ Đoàn - Hội xuất sắc tiêu biểu cấp Đại học Đà Nẵng\nĐơn vị: Giám đốc Đại học Đà Nẵng\nNội dung: Trao tặng Giấy khen cấp ĐHĐN cho cán bộ đoàn thể sinh viên Bách khoa."),
    ("MUC_16", "Hoạt động: Bằng khen của Chủ tịch UBND TP Đà Nẵng cho Cán bộ Đoàn thanh niên tiêu biểu\nĐơn vị: UBND Thành phố Đà Nẵng\nNội dung: Tặng Bằng khen cấp Thành phố cho cán bộ Đoàn - Hội sinh viên Trường ĐH Bách khoa."),
    ("MUC_16", "Hoạt động: Giấy khen cấp Trường của Hội Sinh viên nhân Ngày truyền thống HSSV 09/01\nĐơn vị: Hội Sinh viên Trường ĐH Bách khoa\nNội dung: Quyết định khen thưởng cấp Trường cho Chi hội trưởng và Chủ nhiệm CLB xuất sắc tiêu biểu."),
    ("MUC_16", "Hoạt động: Quyết định khen thưởng cấp Trường của Hiệu trưởng cho Ban chủ nhiệm Đội CTXH\nĐơn vị: Hiệu trưởng Trường ĐH Bách khoa\nNội dung: Tặng Giấy khen cấp Trường cho Đội trưởng Đội Công tác xã hội có thành tích xuất sắc toàn trường."),
    ("MUC_16", "Hoạt động: Giấy khen của Hội Sinh viên Đại học Đà Nẵng cho Cán bộ Hội xuất sắc\nĐơn vị: Hội Sinh viên ĐH Đà Nẵng\nNội dung: Khen thưởng cấp ĐHĐN cho cán bộ Hội Sinh viên Trường Đại học Bách khoa."),
    ("MUC_16", "Hoạt động: Giải thưởng Sao Tháng Giêng / Cán bộ Đoàn Hội xuất sắc cấp Trường trở lên\nĐơn vị: Trung ương Hội Sinh viên / ĐHĐN\nNội dung: Bằng khen tuyên dương cán bộ Đoàn - Hội - Ban cán sự lớp đạt giải thưởng cấp Trường trở lên."),

    # KHONG_HOP_LE: Tài liệu không phải minh chứng ngoại khóa hợp lệ hoặc thuộc tiêu chí học vụ tự động (22 mẫu bổ sung)
    ("KHONG_HOP_LE", "Hoạt động: Bảng điểm học tập học kỳ I hệ chính quy\nĐơn vị: Phòng Đào tạo Trường ĐH Bách khoa\nNội dung: Bảng điểm trung bình học kỳ GPA 3.45/4.0, kết quả học tập thuộc Mục 3 học vụ tự động, không tính là minh chứng hoạt động ngoại khóa."),
    ("KHONG_HOP_LE", "Hoạt động: Biên lai thu tiền học phí học kỳ I năm học 2026-2027\nĐơn vị: Phòng Kế hoạch - Tài chính ĐHBK\nNội dung: Hóa đơn điện tử xác nhận đã nộp học phí đúng hạn (thuộc Mục 7 đồng bộ học vụ, không phải giấy chứng nhận hoạt động)."),
    ("KHONG_HOP_LE", "Hoạt động: Thẻ Bảo hiểm y tế sinh viên còn hạn sử dụng\nĐơn vị: Bảo hiểm xã hội TP Đà Nẵng\nNội dung: Ảnh chụp thẻ BHYT và tra cứu VssID (thuộc Mục 11 đồng bộ tự động, không phải minh chứng phong trào)."),
    ("KHONG_HOP_LE", "Hoạt động: Giấy xác nhận đăng ký tạm trú tại Phường Hòa Khánh Bắc\nĐơn vị: Công an Phường Hòa Khánh Bắc\nNội dung: Tờ khai thay đổi thông tin cư trú CT01 (thuộc điều kiện mặc định Mục 11, không tính điểm hoạt động cộng đồng)."),
    ("KHONG_HOP_LE", "Hoạt động: Hóa đơn mua hàng siêu thị và biên lai chuyển khoản ngân hàng\nĐơn vị: Vietcombank / VinMart\nNội dung: Giao dịch chuyển khoản thành công 250.000 VNĐ, ảnh chụp màn hình ứng dụng ngân hàng không phải minh chứng rèn luyện."),
    ("KHONG_HOP_LE", "Hoạt động: Lịch thi kết thúc học phần và Thời khóa biểu cá nhân\nĐơn vị: Cổng thông tin sinh viên sv.dut.udn.vn\nNội dung: Ảnh chụp màn hình lịch thi cuối kỳ các môn Giải tích, Lập trình C++, không phải giấy chứng nhận hoạt động."),
    ("KHONG_HOP_LE", "Hoạt động: Giấy khám sức khỏe định kỳ nhập học\nĐơn vị: Bệnh viện Đa khoa Liên Chiểu\nNội dung: Phiếu khám sức khỏe tổng quát đủ điều kiện học tập, không phải giấy chứng nhận hiến máu hay tình nguyện."),
    ("KHONG_HOP_LE", "Hoạt động: Thẻ sinh viên Trường Đại học Bách khoa Đà Nẵng\nĐơn vị: Trường ĐH Bách khoa\nNội dung: Ảnh chụp mặt trước thẻ sinh viên và căn cước công dân CCCD, không có nội dung tham gia sự kiện."),
    ("KHONG_HOP_LE", "Hoạt động: Ảnh chụp phong cảnh / ảnh selfie cá nhân tại quán cà phê\nNội dung: Ảnh cá nhân không có phông màn sự kiện, không có con dấu, không có tên hoạt động hay đơn vị tổ chức."),
    ("KHONG_HOP_LE", "Hoạt động: Hợp đồng thuê phòng trọ sinh viên năm 2026\nNội dung: Hợp đồng thuê nhà trọ tại đường Nguyễn Lương Bằng, Quận Liên Chiểu, tài liệu cá nhân không thuộc quy chế rèn luyện."),
    ("KHONG_HOP_LE", "Hoạt động: Giấy chứng nhận hoàn thành khóa học tiếng Anh tại trung tâm tư nhân ngoài trường\nĐơn vị: Trung tâm Anh ngữ giao tiếp thương mại\nNội dung: Phiếu thu học phí và bảng điểm kiểm tra đầu vào TOEIC thử tại trung tâm tư nhân, không phải hoạt động do Trường/Đoàn/Hội tổ chức."),
    ("KHONG_HOP_LE", "Hoạt động: Vé xem phim rạp CGV và vé gửi xe máy\nNội dung: Vé giải trí cá nhân thương mại, hoàn toàn không liên quan đến hoạt động văn hóa văn nghệ thể thao của sinh viên nhà trường."),
    ("KHONG_HOP_LE", "Hoạt động: Đơn xin nghỉ học có phép vì lý do ốm\nĐơn vị: Khoa chuyên ngành\nNội dung: Đơn xin phép vắng mặt 1 buổi học lý thuyết trên lớp có chữ ký phụ huynh, không phải minh chứng cộng điểm."),
    ("KHONG_HOP_LE", "Hoạt động: Ảnh chụp màn hình tin nhắn chat nhóm Zalo / Messenger lớp\nNội dung: Đoạn hội thoại trao đổi bài tập nhóm trên Messenger, không có xác nhận của đơn vị tổ chức có thẩm quyền."),
    ("KHONG_HOP_LE", "Hoạt động: Giấy xác nhận đang là sinh viên để vay vốn Ngân hàng Chính sách\nĐơn vị: Phòng Công tác Sinh viên\nNội dung: Giấy xác nhận sinh viên phục vụ thủ tục hành chính vay vốn tín dụng, không phải giấy khen hay chứng nhận hoạt động."),
    ("KHONG_HOP_LE", "Hoạt động: Phiếu điểm rèn luyện của học kỳ cũ năm 2023-2024\nNội dung: Bản in bảng điểm rèn luyện học kỳ trước đã chốt, không được dùng làm minh chứng cho học kỳ hiện tại."),
    ("KHONG_HOP_LE", "Hoạt động: Chứng chỉ hoàn thành game trực tuyến / xếp hạng trò chơi cá nhân\nNội dung: Ảnh chụp màn hình thắng trận game cá nhân ở nhà, không phải giải đấu Esports do Đoàn/Hội tổ chức."),
    ("KHONG_HOP_LE", "Hoạt động: Giấy triệu tập thí sinh dự thi THPT Quốc gia\nNội dung: Hồ sơ tuyển sinh cũ từ thời trung học phổ thông, không thuộc thời gian học kỳ đại học đang xét."),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_excel(EXCEL_PATH, sheet_name="Tracker")

    df = df.rename(
        columns={
            "Nội dung input": "text",
            "Lý do": "reason",
            "Duyệt người dùng": "user_review",
            "Nguồn ảnh": "image_source",
        }
    )
    df["text"] = df["text"].fillna("").astype(str).str.strip()
    df["group_id"] = df["group_id"].fillna(df["sample_id"]).astype(str).str.strip()
    df["sample_id"] = df["sample_id"].astype(str).str.strip()

    rows = []
    excluded = []
    for _, row in df.iterrows():
        sid = row["sample_id"]
        text = row["text"]
        if not text or str(row.get("annotation_status")) == "UNREADABLE":
            excluded.append(sid)
            continue
        if pd.notna(row["label"]) and str(row["label"]).strip():
            raw_label = str(row["label"]).strip()
            criterion_label = LABEL_TO_CRITERION.get(raw_label, "KHAC")
            source = "HUMAN_EXCEL"
        elif sid in CURATED_UNLABELED_MAP:
            raw_label = CURATED_UNLABELED_MAP[sid]
            criterion_label = CURATED_UNLABELED_MAP[sid]
            source = "CURATED_FROM_UNLABELED"
        else:
            excluded.append(sid)
            continue
        rows.append(
            {
                "sample_id": sid,
                "group_id": row["group_id"],
                "raw_label": raw_label,
                "criterion_label": criterion_label,
                "label_source": source,
                "text": text,
            }
        )

    for idx, (label, text) in enumerate(DUT_REGULATION_CORPUS, start=1):
        sid = f"DUT-CORPUS-{idx:04d}"
        rows.append(
            {
                "sample_id": sid,
                "group_id": f"CORPUS-G-{idx:04d}",
                "raw_label": label,
                "criterion_label": label,
                "label_source": "DUT_REGULATION_CORPUS",
                "text": text,
            }
        )

    labeled = pd.DataFrame(rows)
    labeled_cols = ["sample_id", "group_id", "raw_label", "criterion_label", "label_source", "text"]
    labeled[labeled_cols].to_csv(OUT_DIR / "labeled_all.csv", index=False, encoding="utf-8-sig")

    # Chia train / val / test bằng StratifiedGroupKFold (5 folds -> 3 folds train, 1 fold val, 1 fold test)
    # để đảm bảo đủ 11 lớp xuất hiện trong cả train, val và test mà 0% rò rỉ group_id.
    sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    folds = list(sgkf.split(labeled, labeled["criterion_label"], labeled["group_id"]))
    test_idx = folds[0][1]
    val_idx = folds[1][1]
    holdout_set = set(test_idx.tolist()) | set(val_idx.tolist())
    train_idx = np.array([i for i in range(len(labeled)) if i not in holdout_set])

    train_df = labeled.iloc[train_idx].copy()
    val_df = labeled.iloc[val_idx].copy()
    test_df = labeled.iloc[test_idx].copy()

    # Kiểm tra 0% rò rỉ group_id giữa train, val, test
    g_train, g_val, g_test = set(train_df["group_id"]), set(val_df["group_id"]), set(test_df["group_id"])
    assert not (g_train & g_val), "Rò rỉ group_id giữa train và val"
    assert not (g_train & g_test), "Rò rỉ group_id giữa train và test"
    assert not (g_val & g_test), "Rò rỉ group_id giữa val và test"

    train_df[labeled_cols].to_csv(OUT_DIR / "train.csv", index=False, encoding="utf-8-sig")
    val_df[labeled_cols].to_csv(OUT_DIR / "val.csv", index=False, encoding="utf-8-sig")
    test_df[labeled_cols].to_csv(OUT_DIR / "test.csv", index=False, encoding="utf-8-sig")

    summary = {
        "source": str(EXCEL_PATH),
        "total_excel_rows": int(len(df)),
        "labeled_count": int(len(labeled)),
        "excluded_unreadable_count": int(len(excluded)),
        "excluded_ids": excluded,
        "by_label_source": labeled["label_source"].value_counts().to_dict(),
        "unique_groups_labeled": int(labeled["group_id"].nunique()),
        "splits": {
            "train": int(len(train_df)),
            "val": int(len(val_df)),
            "test": int(len(test_df)),
        },
        "criterion_distribution": labeled["criterion_label"].value_counts().to_dict(),
    }
    (OUT_DIR / "dataset_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
