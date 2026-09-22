# 📋 Master Traceability Matrix & Feature Specifications — EduPoint

> **Hệ sinh thái Đặc tả Kỹ thuật Hệ thống Đánh giá Điểm Rèn luyện EduPoint**
> 
> Bản đặc tả chuẩn hóa đồng bộ 100% với:
> - 🖥️ [EduPoint_ThietKe_Trang_FE.md](../../EduPoint_ThietKe_Trang_FE.md) *(Thiết kế 37 màn hình theo vai trò)*
> - 📡 [EduPoint_API_BE.md](../../EduPoint_API_BE.md) *(Hợp đồng API & mô hình 4 trục trạng thái)*
> - 🏗️ [cautruc.md](../../cautruc.md) & [EduPoint_Tinh_nang_Techstack_Giaodien.md](../01-tinh-nang-techstack/EduPoint_Tinh_nang_Techstack_Giaodien.md)

---

## 🧭 Nguyên tắc Phân định & Traceability

1. **Trace ID Giao diện**: Dùng mã trang từ file thiết kế FE (`C01–C07`, `S01–S09`, `O01–O10`, `A01–A11`) làm mỏ neo (*Trace ID chính*) liên kết giữa trải nghiệm người dùng và tài liệu phân tích nghiệp vụ.
2. **Trace ID API**: Mọi tính năng đều được liên kết trực tiếp với các mã endpoint chuẩn trong `EduPoint_API_BE.md` (`AUTH`, `REF`, `NOTI`, `CRI`, `ACT`, `EVD`, `PIPE`, `REV`, `OFF`, `EXT`, `APL`, `SCO`, `RAG`, `RPT`, `ADM`).
3. **Phân biệt UI Spec vs System/Technical Spec**:
   - Các thư mục `common/`, `student/`, `officer/`, `admin/` chứa **UI Feature Specs** (đặc tả tính năng có tương tác người dùng).
   - Thư mục `ai-pipeline/` chứa `FS-AI01`: **System & Technical Specification** (đặc tả tiến trình nền bất đồng bộ qua BullMQ Worker, PhoBERT, Claude, Google Vision, không phải màn hình UI).
4. **Mô hình 3 Vai trò (RBAC)**:
   - **`STUDENT` (Sinh viên)**: Mobile App (React Native / Expo).
   - **`OFFICER` (Cán bộ Khoa / CTSV)**: Web Desktop-first (React + Vite).
   - **`ADMIN` (Quản trị viên)**: Web Desktop-first. **Kiêm nhiệm**: Quản lý tiêu chí, Rule Engine, Knowledge Base RAG và toàn bộ Audit Log.

---

## 📊 Ma trận Truy vết Toàn diện (Traceability Matrix)

### 1. Nhóm Tính năng Dùng chung (*Common* — `C01` đến `C07`)

| Trace ID | Mã File Spec | Tên Tính Năng & Nghiệp Vụ | Vai Trò | Mức | Mã Endpoint API BE |
|:---:|:---|:---|:---:|:---:|:---|
| **`C01`** | [FS-C01](common/FS-C01-dang-nhap.md) | Xác thực & Đăng nhập Hệ thống | All Roles | **[MVP]** | `[AUTH-01]` `[AUTH-02]` `[AUTH-03]` |
| **`C02`** | [FS-C02](common/FS-C02-quen-dat-lai-mat-khau.md) | Quên & Đặt lại Mật khẩu | All Roles | **[MVP]** | `[AUTH-05]` `[AUTH-06]` |
| **`C03`** | [FS-C03](common/FS-C03-ho-so-ca-nhan.md) | Hồ sơ Cá nhân & Đổi Mật khẩu | All Roles | **[MVP]** | `[AUTH-04]` `[AUTH-07]` |
| **`C04`** | [FS-C04](common/FS-C04-chatbot-rag.md) | Hỏi đáp Quy chế Điểm Rèn luyện (RAG Chatbot) | S, O, A | **[MVP]** | `[RAG-01]` `[RAG-02]` `[RAG-03]` |
| **`C05`** | [FS-C05](common/FS-C05-trung-tam-thong-bao.md) | Trung tâm Thông báo Hệ thống | All Roles | **[MVP]** | `[NOTI-01]`..`[NOTI-04]` |
| **`C07`** | [FS-C07](common/FS-C07-xac-minh-cong-khai.md) | Cổng Xác nhận Công khai (Đơn vị ngoài trường) | Public/Ext | **[MVP]** | `[PUB-01]` `[PUB-02]` |

---

### 2. Nhóm Tính năng Sinh viên (*Student* — `S01` đến `S09`)

| Trace ID | Mã File Spec | Tên Tính Năng & Nghiệp Vụ | Vai Trò | Mức | Mã Endpoint API BE |
|:---:|:---|:---|:---:|:---:|:---|
| **`S01`** | [FS-S01](student/FS-S01-tong-quan-diem.md) | Tổng quan Điểm Rèn luyện (Dashboard) | STUDENT | **[MVP]** | `[SCO-01]` |
| **`S02`** | [FS-S02](student/FS-S02-tieu-chi-quy-che.md) | Tra cứu Tiêu chí & Quy chế | STUDENT | **[MVP]** | `[CRI-01]` `[CRI-02]` |
| **`S03`** | [FS-S03](student/FS-S03-nop-minh-chung-wizard.md) | Nộp Minh chứng (Wizard 3 bước) | STUDENT | **[MVP]** | `[EVD-01]`..`[EVD-04]`, `[ACT-01]` |
| **`S04`** | [FS-S04](student/FS-S04-danh-sach-minh-chung.md) | Danh sách Minh chứng của Tôi & Rút hồ sơ | STUDENT | **[MVP]** | `[EVD-05]` `[EVD-10]` |
| **`S05`** | [FS-S05](student/FS-S05-chi-tiet-minh-chung.md) | Chi tiết Minh chứng (OCR, Xác minh, Evidence Gap) | STUDENT | **[MVP]** | `[EVD-06..08]`, `[PIPE-01..08]` |
| **`S06`** | [FS-S06](student/FS-S06-bo-sung-minh-chung.md) | Bổ sung Minh chứng theo Yêu cầu | STUDENT | **[MVP]** | `[EVD-09]` |
| **`S07`** | [FS-S07](student/FS-S07-khieu-nai.md) | Khiếu nại Kết quả Đánh giá | STUDENT | **[MVP]** | `[APL-01]` `[APL-02]` |
| **`S08`** | [FS-S08](student/FS-S08-what-can-i-claim.md) | Gợi ý Tích lũy Điểm ("What Can I Claim?") | STUDENT | **[ADV]** | `[SCO-03]` |
| **`S09`** | [FS-S09](student/FS-S09-bang-diem-ren-luyen.md) | Bảng điểm Rèn luyện & Lịch sử các Kỳ | STUDENT | **[MVP]** | `[SCO-02]` `[SCO-04]` |

---

### 3. Nhóm Tính năng Cán bộ (*Officer* — `O01` đến `O10`)

| Trace ID | Mã File Spec | Tên Tính Năng & Nghiệp Vụ | Vai Trò | Mức | Mã Endpoint API BE |
|:---:|:---|:---|:---:|:---:|:---|
| **`O01`** | [FS-O01](officer/FS-O01-tong-quan-xu-ly.md) | Tổng quan Xử lý của Cán bộ (Officer Dashboard) | OFFICER | **[MVP]** | `[RPT-01]` `[OFF-02..03]` |
| **`O02`** | [FS-O02](officer/FS-O02-hang-doi-xu-ly.md) | Hàng đợi Xử lý Thông minh (Smart Queue & Fast-track) | OFFICER | **[MVP]** | `[OFF-01]` `[OFF-02]` `[REV-02]` |
| **`O03`** | [FS-O03](officer/FS-O03-xet-duyet-split-view.md) | Màn hình Xét duyệt Hồ sơ (Split-view 50:50) | OFFICER | **[MVP]** | `[EVD-06]`, `[PIPE-01..11]`, `[REV-01..05]` |
| **`O04`** | [FS-O04](officer/FS-O04-nguon-xac-minh-ngoai-truong.md) | Quản lý Nguồn Xác minh Ngoài trường (5 cấp L1–L5) | OFFICER | **[MVP/ADV]** | `[EXT-01]` `[EXT-02]` `[EXT-03]` |
| **`O05`** | [FS-O05](officer/FS-O05-hoat-dong-ngoai-truong.md) | Hoạt động Ngoài trường & Danh bạ Đơn vị | OFFICER | **[ADV]** | `[EXT-04]` |
| **`O06`** | [FS-O06](officer/FS-O06-hoat-dong-noi-bo-diem-danh.md) | Quản lý Hoạt động Nội bộ & Import Điểm danh | OFFICER | **[MVP]** | `[ACT-02]`..`[ACT-07]` |
| **`O07`** | [FS-O07](officer/FS-O07-xu-ly-khieu-nai.md) | Xử lý Khiếu nại Điểm Rèn luyện | OFFICER | **[MVP]** | `[APL-03]` `[APL-04]` `[APL-05]` |
| **`O08`** | [FS-O08](officer/FS-O08-tieu-chi-quy-tac-view.md) | Tra cứu Tiêu chí & Quy tắc Điểm (Chỉ xem) | OFFICER | **[MVP]** | `[CRI-01]` `[CRI-03]` |
| **`O09`** | [FS-O09](officer/FS-O09-tra-cuu-sinh-vien.md) | Tra cứu Hồ sơ & Bảng điểm Sinh viên | OFFICER, A | **[MVP]** | `[SCO-05]` |
| **`O10`** | [FS-O10](officer/FS-O10-bao-cao-thong-ke.md) | Báo cáo & Thống kê Điểm Rèn luyện | OFFICER, A | **[MVP]** | `[RPT-02]`..`[RPT-05]` |

---

### 4. Nhóm Tính năng Quản trị viên (*Administrator* — `A01` đến `A11`)

| Trace ID | Mã File Spec | Tên Tính Năng & Nghiệp Vụ | Vai Trò | Mức | Mã Endpoint API BE |
|:---:|:---|:---|:---:|:---:|:---|
| **`A01`** | [FS-A01](admin/FS-A01-tong-quan-he-thong.md) | Tổng quan Hệ thống (Admin System Dashboard) | ADMIN | **[MVP]** | `[ADM-DSH-01]` |
| **`A02`** | [FS-A02](admin/FS-A02-quan-ly-nguoi-dung-rbac.md) | Quản lý Người dùng & Phân quyền RBAC | ADMIN | **[MVP]** | `[ADM-USR-01]`..`[ADM-USR-06]` |
| **`A03`** | [FS-A03](admin/FS-A03-du-lieu-nen-ky-danh-gia.md) | Dữ liệu Nền (Khoa/Lớp) & Vòng đời Kỳ Đánh giá | ADMIN | **[MVP]** | `[ADM-ORG-01..03]`, `[ADM-TRM-01..05]` |
| **`A04`** | [FS-A04](admin/FS-A04-quan-ly-tieu-chi.md) | Quản lý Tiêu chí & Khung Điểm (Versioning) | ⚡ ADMIN | **[MVP]** | `[ADM-CRI-01]`..`[ADM-CRI-04]` |
| **`A05`** | [FS-A05](admin/FS-A05-rule-engine-management.md) | Quản trị Rule Engine (Soạn, Chạy thử, Publish) | ⚡ ADMIN | **[MVP/ADV]** | `[ADM-RUL-01]`..`[ADM-RUL-07]` |
| **`A06`** | [FS-A06](admin/FS-A06-knowledge-base-rag.md) | Quản lý Knowledge Base Quy chế (RAG Source) | ⚡ ADMIN | **[MVP]** | `[ADM-KB-01]`..`[ADM-KB-06]` |
| **`A07`** | [FS-A07](admin/FS-A07-cau-hinh-ai.md) | Cấu hình Tham số AI & Ngưỡng Quyết định | ADMIN | **[MVP]** | `[ADM-AI-01]`..`[ADM-AI-03]` |
| **`A08`** | [FS-A08](admin/FS-A08-ground-truth-dataset.md) | Quản lý Ground Truth Dataset (Dữ liệu Kiểm chuẩn) | ADMIN | **[ADV]** | `[ADM-GT-01]`..`[ADM-GT-05]` |
| **`A09`** | [FS-A09](admin/FS-A09-danh-gia-chat-luong-ai.md) | Đánh giá Chất lượng Mô hình AI (Evaluation Metrics) | ADMIN | **[ADV]** | `[ADM-EVAL-01]`..`[ADM-EVAL-05]` |
| **`A10`** | [FS-A10](admin/FS-A10-audit-log-toan-he-thong.md) | Nhật ký Kiểm toán Toàn hệ thống (Audit Log) | ⚡ ADMIN | **[MVP]** | `[ADM-AUD-01]` `[ADM-AUD-02]` |
| **`A11`** | [FS-A11](admin/FS-A11-giam-sat-job-suc-khoe.md) | Giám sát Hàng đợi Xử lý & Sức khỏe Hệ thống | ADMIN | **[ADV]** | `[ADM-JOB-01]`..`[ADM-JOB-04]` |

---

### 5. Hệ thống Xử lý Nền (*System & Technical Specification*)

| Mã Spec | Mã File Spec | Tên Tiến Trình Hệ Thống | Công Nghệ Thực Hiện | Traceable APIs |
|:---:|:---|:---|:---|:---|
| **`AI01`** | [FS-AI01](ai-pipeline/FS-AI01-evidence-processing-pipeline.md) | Evidence Processing Pipeline (6 bước ngầm: OCR $\rightarrow$ Claude $\rightarrow$ PhoBERT $\rightarrow$ Verify $\rightarrow$ Anomaly $\rightarrow$ Rule Engine) | BullMQ, Redis, Google Vision, Claude, PhoBERT (FastAPI) | `[EVD-04]` `[EVD-07]` `[EVD-08]` `[PIPE-01..11]` |

---

## 📂 Cấu trúc Thư mục Chuẩn hóa

```
docs/05-feature-specs/
├── README.md                                  ← (Bản ma trận tổng hợp này)
│
├── common/                                    ← C01–C07: Nhóm tính năng dùng chung
│   ├── FS-C01-dang-nhap.md
│   ├── FS-C02-quen-dat-lai-mat-khau.md
│   ├── FS-C03-ho-so-ca-nhan.md
│   ├── FS-C04-chatbot-rag.md
│   ├── FS-C05-trung-tam-thong-bao.md
│   └── FS-C07-xac-minh-cong-khai.md
│
├── student/                                   ← S01–S09: Nhóm tính năng Sinh viên
│   ├── FS-S01-tong-quan-diem.md
│   ├── FS-S02-tieu-chi-quy-che.md
│   ├── FS-S03-nop-minh-chung-wizard.md
│   ├── FS-S04-danh-sach-minh-chung.md
│   ├── FS-S05-chi-tiet-minh-chung.md
│   ├── FS-S06-bo-sung-minh-chung.md
│   ├── FS-S07-khieu-nai.md
│   ├── FS-S08-what-can-i-claim.md
│   └── FS-S09-bang-diem-ren-luyen.md
│
├── officer/                                   ← O01–O10: Nhóm tính năng Cán bộ
│   ├── FS-O01-tong-quan-xu-ly.md
│   ├── FS-O02-hang-doi-xu-ly.md
│   ├── FS-O03-xet-duyet-split-view.md
│   ├── FS-O04-nguon-xac-minh-ngoai-truong.md
│   ├── FS-O05-hoat-dong-ngoai-truong.md
│   ├── FS-O06-hoat-dong-noi-bo-diem-danh.md
│   ├── FS-O07-xu-ly-khieu-nai.md
│   ├── FS-O08-tieu-chi-quy-tac-view.md
│   ├── FS-O09-tra-cuu-sinh-vien.md
│   └── FS-O10-bao-cao-thong-ke.md
│
├── admin/                                     ← A01–A11: Nhóm tính năng Quản trị viên
│   ├── FS-A01-tong-quan-he-thong.md
│   ├── FS-A02-quan-ly-nguoi-dung-rbac.md
│   ├── FS-A03-du-lieu-nen-ky-danh-gia.md
│   ├── FS-A04-quan-ly-tieu-chi.md
│   ├── FS-A05-rule-engine-management.md
│   ├── FS-A06-knowledge-base-rag.md
│   ├── FS-A07-cau-hinh-ai.md
│   ├── FS-A08-ground-truth-dataset.md
│   ├── FS-A09-danh-gia-chat-luong-ai.md
│   ├── FS-A10-audit-log-toan-he-thong.md
│   └── FS-A11-giam-sat-job-suc-khoe.md
│
└── ai-pipeline/                               ← Tiến trình Xử lý Thông minh
    └── FS-AI01-evidence-processing-pipeline.md
```
