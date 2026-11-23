"""
Chuẩn hóa dataset từ docs/dataset-final-20261102/data_tracker.xlsx cho bài toán
Phân loại Hoạt động / Minh chứng vào Tiêu chí Rubric DUT.

- Giữ nguyên 100% nhãn gốc của 51 mẫu đã gán trong Excel (label_source='HUMAN_EXCEL').
- Bổ sung bảng gán nhãn đã rà soát theo Bộ tiêu chí DUT cho 72 mẫu còn lại
  (loại bỏ DOC-0020-B bị gắn UNREADABLE) -> tổng 123 mẫu thật trên ~78 group_id.
- Chia tập theo group_id (GroupShuffleSplit), đảm bảo 0% rò rỉ dữ liệu trùng.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

REPO_ROOT = Path(__file__).resolve().parents[2]
EXCEL_PATH = REPO_ROOT / "docs" / "dataset-final-20261102" / "data_tracker.xlsx"
OUT_DIR = Path(__file__).resolve().parent / "datasets"

# Ánh xạ từ nhãn gốc trong data_tracker.xlsx sang mã tiêu chí Rubric DUT (dut-rubric.ts)
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

# Gán nhãn đã đối chiếu trực tiếp nội dung 72 dòng chưa gán nhãn trong data_tracker.xlsx
# theo đúng mô tả 16 tiêu chí trong apps/backend/src/criteria/dut-rubric.ts
CURATED_UNLABELED_MAP: dict[str, str] = {
    # MUC_5: NCKH / Olympic / Cuộc thi học thuật
    "DOC-0006": "MUC_5",   # Design Thinking for Human Challenges Competition 2026
    "DOC-0029": "MUC_5",   # Chung kết BK English 2025
    "DOC-0030": "MUC_5",   # BK Smart Campus
    "DOC-0036": "MUC_5",   # Chung kết cuộc thi hùng biện tiếng Nhật 2025
    "DOC-0041": "MUC_5",   # Đề tài NCKH học tập cá nhân hóa
    "DOC-0042": "MUC_5",   # Giải thưởng Sinh viên NCKH 2019
    "DOC-0043": "MUC_5",   # Giải thưởng Sinh viên NCKH 2018 (Giải Nhì)
    "DOC-0044": "MUC_5",   # Giải thưởng Sinh viên NCKH 2020 (Giải Khuyến khích)
    "DOC-0045": "MUC_5",   # Đề tài NCKH SV cấp Trường
    "DOC-0046": "MUC_5",   # Hội nghị Sinh viên NCKH toàn quốc lần IV
    "DOC-0047": "MUC_5",   # Đề tài Khảo sát kỹ năng xây dựng prompt LLMs
    "DOC-0055": "MUC_5",   # Vòng 1 Cuộc thi HR MASTERMIND
    "DOC-0080": "MUC_5",   # Cuộc thi MARKETING BATTLEGROUND
    "DOC-0087": "MUC_5",   # Cuộc thi học thuật DYNAMIC DUE
    "DOC-0088": "MUC_5",   # Cuộc thi Greenovation - Ý tưởng Đại học Xanh
    "DOC-0089": "MUC_5",   # Cuộc thi học thuật Economic Arena
    "DOC-0109": "MUC_5",   # Cuộc thi học thuật DYNAMIC DUE
    "DOC-0110": "MUC_5",   # Cuộc Thi Olympic Mác - Lênin và Tư tưởng Hồ Chí Minh
    "DOC-0113": "MUC_5",   # Vòng chung kết Cuộc thi BK Smart Campus

    # MUC_8: Giáo dục chính trị, kỹ năng mềm, tập huấn, talkshow định hướng
    "DOC-0005": "MUC_8",   # VNUK Career Discovery Workshop Series 2025
    "DOC-0007": "MUC_8",   # K25 FRESHMEN - DISCOVER UED
    "DOC-0026": "MUC_8",   # Unitour — AI thực chiến
    "DOC-0032": "MUC_8",   # Hành vi tài chính — cấp độ Sơ cấp
    "DOC-0034": "MUC_8",   # Yamaha Riding Station (Đoàn trường phối hợp kỹ năng)
    "DOC-0038": "MUC_8",   # Unitour — AI thực chiến
    "DOC-0057": "MUC_8",   # Khóa học online bình đẳng giới trong thanh niên
    "DOC-0065": "MUC_8",   # Talkshow Sinh viên 5 Tốt
    "DOC-0097": "MUC_8",   # Chương trình Phổ Cập AI - Tập huấn Kỹ Năng AI
    "DOC-0104": "MUC_8",   # Talkshow Truyền thông bình đẳng giới

    # MUC_9: Văn hóa, văn nghệ, thể thao
    "DOC-0013": "MUC_9",   # Văn nghệ kỷ niệm 50 năm ĐHBK
    "DOC-0014": "MUC_9",   # Cuộc thi Khoảnh Khắc Tri Ân
    "DOC-0017": "MUC_9",   # Giải chạy Sinh viên khỏe — Unitour Đà Nẵng
    "DOC-0023": "MUC_9",   # Korean in Da Nang 2026 (Giao lưu văn hóa nghệ thuật)
    "DOC-0031": "MUC_9",   # Korean in Da Nang 2026
    "DOC-0037": "MUC_9",   # Văn nghệ kỷ niệm 50 năm ĐHBK
    "DOC-0040": "MUC_9",   # The Cover Show — Hội trại Truyền thống 2026
    "DOC-0054": "MUC_9",   # Ngày hội giao lưu văn hóa quốc tế DUE 2025
    "DOC-0071": "MUC_9",   # Cuộc thi Sinh viên Tài năng Thanh lịch Miss & Mister DUE
    "DOC-0072": "MUC_9",   # Cuộc thi Tìm kiếm tài năng DUE - SHINE YOUR VOICE
    "DOC-0093": "MUC_9",   # IT ESPORTS: ARENA OF VALOR 2024
    "DOC-0094": "MUC_9",   # K23 - Bén lửa sinh ra (FIT DUT)
    "DOC-0099": "MUC_9",   # Ngày hội giao lưu văn hóa quốc tế DUE 2025

    # MUC_10: Tuyên truyền, pháp luật, ứng xử văn minh
    "DOC-0059": "MUC_10",  # Cuộc thi Ứng xử văn minh trên không gian mạng

    # MUC_12: Phục vụ cộng đồng, tình nguyện, hiến máu
    "DOC-0001": "MUC_12",  # AirAsia RedRun Danang (Volunteer)
    "DOC-0008": "MUC_12",  # Tết Gắn Kết 12 - Chiến dịch Tình nguyện Đông Xuân
    "DOC-0009": "MUC_12",  # Tết Gắn Kết 12 - Gây quỹ tình nguyện
    "DOC-0012": "MUC_12",  # Tình nguyện Đông 2024 — Đêm Giáng Sinh Ấm Áp
    "DOC-0015": "MUC_12",  # Tình nguyện hè 2025 — Chạm Tre - Khắc Tuổi Trẻ
    "DOC-0020": "MUC_12",  # Hiến máu tình nguyện
    "DOC-0024": "MUC_12",  # Kà Đâu Ngày Nắng Về 2026 (Tình nguyện)
    "DOC-0025": "MUC_12",  # Xuân Yêu Thương 2026 (Tình nguyện gây quỹ)
    "DOC-0027": "MUC_12",  # Trung Thu Nhân Ái (CLB Môi trường)
    "DOC-0061": "MUC_12",  # VnExpress Marathon Da Nang 2025 (Tình nguyện viên)
    "DOC-0068": "MUC_12",  # 2024 VinFast IRONMAN 70.3 Viet Nam (Volunteer)
    "DOC-0076": "MUC_12",  # 2025 IRONMAN 70.3 Đà Nẵng (Tình nguyện viên)
    "DOC-0081": "MUC_12",  # VnExpress Marathon Da Nang Midnight 2024 (Volunteer)
    "DOC-0082": "MUC_12",  # Tình nguyện hỗ trợ Đại lễ Phật giáo
    "DOC-0100": "MUC_12",  # 2025 IRONMAN 70.3 DA NANG (Tình nguyện viên)

    # MUC_13: Ban tổ chức / Cộng tác viên hoạt động của Trường, Khoa, Đoàn, Hội
    "DOC-0011": "MUC_13",  # Series Điều K24 có thể chưa biết (Đội Tư vấn SV)
    "DOC-0016": "MUC_13",  # Series Điều K24 có thể chưa biết (Đội Tư vấn SV)
    "DOC-0018": "MUC_13",  # Vinh danh tân khoa & chào đón tân SV BKSTART (Hỗ trợ CT)
    "DOC-0022": "MUC_13",  # Workshop Level up yourself (Thành viên BTC)
    "DOC-0052": "MUC_13",  # Hội ngộ 2025 - TẮT ĐÈN (Tham gia tổ chức)
    "DOC-0067": "MUC_13",  # Ngày hội Đa văn hóa DUE 2024 (Cộng tác viên)
    "DOC-0077": "MUC_13",  # Công tác tổ chức Dự án Green University DUE (BTC)
    "DOC-0086": "MUC_13",  # Chương trình NexTrade 2025 (Ban tổ chức)
    "DOC-0105": "MUC_13",  # Chương trình Chào đón Tân SV Khóa 49 (BTC/Hỗ trợ)
    "DOC-0112": "MUC_13",  # Ngày hội việc làm DUT Job Fair 2025 (Cộng tác viên)
    "DOC-0116": "MUC_13",  # Chương trình Trạm xuân (Đội Tư vấn SV)
    "DOC-0118": "MUC_13",  # Chương trình Trại Đội Vũ Khúc Thiên Hà (Đội Tư vấn SV)
    "DOC-0119": "MUC_13",  # Chương trình Sinh nhật Đội 16 năm (Đội Tư vấn SV)

    # KHONG_HOP_LE: không thuộc tiêu chí minh chứng ngoại khóa (học lực -> Mục 3 học vụ)
    "DOC-0084": "KHONG_HOP_LE",  # Khen thưởng Đạt thành tích học tập loại Giỏi
}


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

    labeled = pd.DataFrame(rows)
    labeled_cols = ["sample_id", "group_id", "raw_label", "criterion_label", "label_source", "text"]
    labeled[labeled_cols].to_csv(OUT_DIR / "labeled_all.csv", index=False, encoding="utf-8-sig")

    # Chia train / val / test theo group_id (70 / 15 / 15) không rò rỉ nhóm
    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=42)
    train_idx, temp_idx = next(gss1.split(labeled, labeled["criterion_label"], labeled["group_id"]))
    train_df = labeled.iloc[train_idx].copy()
    temp_df = labeled.iloc[temp_idx].copy()

    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=42)
    val_rel, test_rel = next(gss2.split(temp_df, temp_df["criterion_label"], temp_df["group_id"]))
    val_df = temp_df.iloc[val_rel].copy()
    test_df = temp_df.iloc[test_rel].copy()

    train_df[labeled_cols].to_csv(OUT_DIR / "train.csv", index=False, encoding="utf-8-sig")
    val_df[labeled_cols].to_csv(OUT_DIR / "val.csv", index=False, encoding="utf-8-sig")
    test_df[labeled_cols].to_csv(OUT_DIR / "test.csv", index=False, encoding="utf-8-sig")

    summary = {
        "source": str(EXCEL_PATH),
        "total_rows": int(len(df)),
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
