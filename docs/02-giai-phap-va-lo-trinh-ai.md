# 02. Phân tích bài toán AI & Kế hoạch triển khai mới

> **Vai trò tài liệu:** Phân tích nguyên nhân gốc rễ khiến hướng tiếp cận cũ bị tắc và đề xuất **kế hoạch kỹ thuật AI mới** (Local-First Document AI, Hybrid Rubric Matching, Internal Event Catalog, Lean Golden Set) kèm lộ trình thực thi 5 giai đoạn.  
> **Cập nhật:** 22/11/2026.

---

## 1. Vì sao kế hoạch cũ bị tắc? (Phân tích nguyên nhân gốc rễ)

Đối chiếu dữ liệu pilot thực tế và codebase `apps/ai-service`, có **5 sai lầm chiến lược** cần sửa ngay:

1. **Đặt cược quá lâu vào Tesseract thuần trên giấy khen Việt Nam:**
   - Dữ liệu `pilot_ocr_error_analysis.json` (17 mẫu) cho thấy ngay cả nhóm ảnh chất lượng `PASS`, Tesseract vẫn có **CER = 41.9% / WER = 61.5%** (nhóm `REVIEW`: CER = 77.1%).
   - Lý do kỹ thuật: Giấy khen/giấy xác nhận có nền hoa văn, khung màu, phông chữ nghệ thuật/serif, con dấu đỏ đè lên chữ và ảnh chụp góc nghiêng. Tesseract LSTM được tối ưu cho văn bản scan nền trắng sạch, nên dù thêm tiền xử lý (adaptive threshold, upscale, PSM 3/6/11) vẫn **không thể vượt trần chất lượng** cho loại tài liệu này.
2. **Trích xuất thực thể bằng Regex trên văn bản OCR nhiễu nặng:**
   - Khi 4/10 ký tự bị sai hoặc mất dấu (`à→a`, `đ→d`, rớt khoảng trắng, vỡ bố cục cột), regex cho `Họ tên`, `MSSV`, `Ngày cấp`, `Tên hoạt động`, `CCCD` sụp đổ hàng loạt (thể hiện rõ qua `layer_metrics.md`).
3. **Kế hoạch gán nhãn 500 tài liệu / 5.000 dòng để fine-tune Tesseract là bất khả thi và sai công nghệ:**
   - Hiện tại kho `docs/Minh chứng Lọc` có 117 file nhưng **0 mẫu đã hoàn tất duyệt nhãn**. Chờ gán nhãn 5.000 dòng để fine-tune một engine đời cũ (Tesseract) sẽ tốn hàng tháng nhân lực mà vẫn thua xa các model Document AI pretrained hiện đại cho tiếng Việt.
4. **Điểm tin cậy cộng tuyến tính + kho phôi rỗng khiến 100% hồ sơ kẹt trần 89:**
   - Khi `templates/registry.json` rỗng và ELA hay báo nhiễu, hệ thống không tách biệt được "hồ sơ rất sạch, đáng tin" với "hồ sơ thật sự đáng ngờ", làm mất giá trị giảm tải cho cán bộ.
5. **Rubric bằng keyword cứng & Luồng 2 cào HTML DuckDuckGo quá mong manh:**
   - `criterion_evaluator.py` chỉ kiểm tra chuỗi con cố định (`"lop truong"`, `"khen thuong"`...) nên dễ bỏ sót hoặc chấm sai ngữ cảnh.
   - `web_search_verifier.py` parse HTML DuckDuckGo dễ bị chặn IP/đổi cấu trúc và tìm sót các hoạt động cấp Khoa/CLB không đăng báo.

---

## 2. Kiến trúc giải pháp AI mới (Local-First Document AI — Tối ưu CPU 8GB RAM)

Nguyên tắc cốt lõi:
- **Chạy 100% nội bộ (Local / On-Premise)** để tuân thủ tuyệt đối `D8` & `D9` (không gửi ảnh/PII ra API bên ngoài).
- **Ngân sách tài nguyên chặt cho máy CPU 8GB RAM:** Giữ **`uvicorn --workers 1`** và giới hạn **tối đa 1 lượt suy luận OCR đồng thời** để tránh nhân đôi RAM PyTorch. Bắt buộc **đo Peak RSS thực tế dưới tải đồng thời** (mục tiêu ≤ 1.5 GB; nếu VietOCR PyTorch vượt ngưỡng thì ưu tiên export VietOCR sang ONNX hoặc dùng RapidOCR ONNX thuần). Đo thực tế **P50 & P95 latency** trên Golden Set (thực tế CPU thường **5–15 giây/ảnh** tùy số dòng chữ, không giả định cố định 2–4s; giữ timeout worker ≥ 60s). **Loại bỏ** các model quá nặng (Local VLM 4B–7B, `bge-m3` 2.2GB, LLM 3B thường trực).
- **ONNX-First & chứng minh bằng benchmark thực nghiệm** trên Golden Set.

### 2.1. Nâng cấp Lớp 3 (OCR) & Lớp 4 (Structured Extraction) — Trọng tâm số 1

Thay thế kiến trúc cũ (`Tesseract → Regex trên text phẳng`) bằng pipeline **ONNX-First siêu nhẹ 3 tầng**:

| Tầng | Đầu vào / Điều kiện | Công nghệ đề xuất (CPU 8GB RAM) | Ngân sách RAM & Tốc độ |
|---|---|---|---|
| **Tầng A (Ưu tiên 1)** | PDF có text layer (chứng nhận điện tử xuất từ hệ thống) | `PyMuPDF (fitz)` giữ nguyên | ~20 MB RAM, `< 50ms`, CER ≈ 0%. |
| **Tầng B (Lõi chính cho ảnh & PDF scan)** | Ảnh chụp, ảnh scan, PDF scan | **RapidOCR (`rapidocr-onnxruntime`, trọng số PP-OCRv4 Detector, `use_rec=False`)** + **VietOCR (`vgg_seq2seq` dùng `predict_batch` theo dòng)** | Cần đo Peak RSS thực tế (PyTorch overhead có thể vượt 800 MB khi tải đồng thời → khóa `workers=1` & cân nhắc export ONNX); latency CPU thực tế đo theo **P50/P95** (thường 5–15s/ảnh tùy số dòng chữ). |
| **Tầng C (Fallback)** | Khi model ONNX/VietOCR lỗi hoặc thiếu gói | **Tesseract 5 (`vie+eng`)** hiện có | ~100 MB RAM; đảm bảo hệ thống không bao giờ HTTP 500, tự gắn cờ `REVIEW`. |

#### Bóc tách thực thể có cấu trúc (Lớp 4) — Layout-Aware + Anti-Hallucination
Thay vì chạy LLM 3B tốn 3GB RAM trên CPU, tận dụng trực tiếp **tọa độ bounding box `[x1, y1, x2, y2]`** do RapidOCR Detector trả về:
- **Layout-Aware Parser (`< 20ms`, ~0 MB RAM thêm):**
  - Sắp xếp và gom các dòng chữ theo tọa độ hình học `(y_center, x_left)` + chiều cao font chữ (`bbox_height`) để giữ đúng cấu trúc cột/nhãn của giấy khen, giấy xác nhận và giấy hiến máu.
  - Khớp theo neo nhãn không gian (ví dụ: tìm giá trị cùng hàng bên phải hoặc ngay dòng dưới các nhãn `"Họ và tên"`, `"Sinh viên"`, `"MSSV"`, `"CCCD"`, `"Ngày ... tháng ... năm"`, `"Lượng máu"`).
  - Hậu kiểm chặt bằng **Pydantic Schema**: chuẩn hóa Unicode NFC, kiểm tra định dạng MSSV (9 số DUT), CCCD (12 số), ngày hợp lệ (`YYYY-MM-DD`), thể tích máu (`250/350/450 ml`).
- **3 quy tắc an toàn bắt buộc của Lớp 4:**
  1. **Evidence Span & BBox:** Mỗi trường trích xuất kèm đoạn text nguồn và tọa độ `[x1, y1, x2, y2]` để UI highlight trực tiếp cho cán bộ đối chiếu.
  2. **Không tự điền từ Form:** Tuyệt đối không lấy họ tên/MSSV khai báo điền ngược vào kết quả đọc. Trường không đọc được bắt buộc trả `null` (`MISSING`).
  3. **Mở rộng có điều kiện:** Nếu sau benchmark vẫn còn ca văn bản tự do quá phức tạp, chỉ kích hoạt tùy chọn `Qwen2.5-1.5B-Instruct` (GGUF Q4_K_M ~1GB RAM, on-demand) cho riêng các hồ sơ `REVIEW`.

### 2.2. Nâng cấp Lớp 2, 5, 6 — Xác minh định danh, Trùng lặp, QR & Phôi

1. **Lớp 2 — Trùng lặp toàn kho có ngữ cảnh (Context-Aware Duplicate):**
   - Lưu bảng riêng hoặc cột index `(sha256, phash_int64, student_id, term_id, evidence_id)` trong PostgreSQL thay vì chỉ quét vài `AiPipelineRun` gần nhất.
   - Phân tách rõ 3 mức trùng:
     - `EXACT_OTHER_STUDENT`: Trùng file với sinh viên khác → **Hard Flag (`INVALID`)**.
     - `EXACT_PREVIOUS_TERM`: Dùng lại đúng giấy của học kỳ trước → **Hard Flag (`INVALID`)**.
     - `NEAR_DUPLICATE_PHASH` (Hamming ≤ 10): Nghi chụp lại màn hình / cắt viền → **Cảnh báo (`REVIEW`)**, hiện ảnh cũ bên cạnh cho cán bộ so sánh.
2. **Lớp 5 — Đối chiếu 3 chiều chuẩn hóa (`MATCH / MISMATCH / MISSING`):**
   - Tách logic chuẩn hóa tiếng Việt (xử lý thứ tự họ–đệm–tên, thiếu dấu nhẹ, viết tắt tên đệm) với ngưỡng rõ ràng:
     - Tên: `≥ 85%` (hoặc khớp token không dấu 100%) → `PASS`; `70–84%` → `REVIEW`; `< 70%` → `MISMATCH`.
     - MSSV / CCCD: Khớp 100% → `PASS`; Đọc ra mã khác rõ ràng (confidence cao, không `ambiguous`) → `MISMATCH`; Không đọc ra → `MISSING` (tuyệt đối không gán sai).
     - Ngày cấp/tham gia: So với `[termStartDate, termEndDate]` (có biên dung sai cấu hình cho giấy cấp trễ vài ngày sau sự kiện cuối kỳ).
3. **Lớp 6 — Ưu tiên QR & Kho phôi tinh gọn, hạ vai trò ELA:**
   - **QR Verification (nâng cấp từ spec cũ):** Quét trên **mọi tệp đính kèm và mọi trang PDF** (giới hạn tối đa 5 trang), thử các biến thể (xoay 90°/180°/270°, phóng to vùng góc, tăng tương phản) bằng `pyzbar` / `OpenCV QRCodeDetector`. Khi QR trỏ tới domain chính thống (`dut.udn.vn`, `udn.vn`, hệ thống chứng nhận điện tử của trường/Đoàn) và khớp tên SV + hoạt động → tín hiệu xác thực mạnh nhất (`PASS`).
   - **Template Registry tinh gọn:** Thu thập và đăng ký **10–15 phôi phổ biến nhất của DUT/Đoàn–Hội/Hiến máu** vào `templates/registry.json` (kèm phiên bản, ngày hiệu lực, layout anchors). Với chứng nhận ngoài trường (không thuộc kho phôi), trạng thái phôi ghi `NOT_APPLICABLE` thay vì phạt kẹt vĩnh viễn như giấy lỗi.
   - **ELA & Dấu đỏ:** Chuyển thành **chỉ báo phụ cho cán bộ (`ADVISORY`)**, không trừ điểm nặng vô lý với ảnh nén lại qua mạng xã hội và không bao giờ tự reject.

### 2.3. Nâng cấp Luồng 2 — CSDL Sự kiện Nội bộ trước khi Tra cứu Web

Thay vì phụ thuộc 100% vào cào HTML DuckDuckGo:
1. **Tầng 1 — `InternalEventCatalog` (CSDL Sự kiện Nội bộ trong PostgreSQL):**
   - Cán bộ Khoa / Đoàn–Hội / CTSV nhập hoặc đồng bộ danh sách hoạt động chính thức của học kỳ `(tên sự kiện, đơn vị tổ chức, ngày diễn ra, tiêu chí rubric mặc định, URL thông báo chính thức)`.
   - Khi sinh viên nộp minh chứng, AI so khớp trực tiếp (fuzzy + semantic) với `InternalEventCatalog` → **nhanh (< 20ms), chính xác cao, không phụ thuộc mạng ngoài, không lo bị rate-limit**.
2. **Tầng 2 — Tra cứu Web Allow-list (`D1`) + Cache:**
   - Chỉ gọi khi Tầng 1 không tìm thấy.
   - Giữ nguyên allow-list chính thức (`dut.udn.vn`, `udn.vn`, domain Đoàn–Hội), query tuyệt đối không chứa PII.
   - Thêm **cache kết quả tìm kiếm 7 ngày** theo `(normalized_activity_name, year, organizer)` và thay HTML scraping mong manh bằng provider có cấu trúc (SearXNG self-host hoặc Google CSE / Brave Search API khi cấu hình key; giữ DuckDuckGo làm fallback).

### 2.4. Nâng cấp Lớp 7 — Hybrid Rubric Matcher siêu nhẹ & Tái thiết kế điểm tin cậy

1. **Hybrid Rubric Matcher tối ưu CPU 8GB (thay `criterion_evaluator.py` thuần keyword):**
   - **Tầng 1 (Deterministic Rules):** Xử lý điều kiện định lượng/bắt buộc (mức giải thưởng, chức vụ cán bộ lớp, số lượng hoạt động, tỷ lệ bình chọn > 90%, ngày trong kỳ).
   - **Tầng 2 (Lightweight Vietnamese Classifier / Embedding):**
     - **Ưu tiên 1 (siêu nhẹ, `< 50 MB RAM`, `< 5ms`):** **TF-IDF (word + char n-gram) + LogisticRegression / LinearSVC** huấn luyện trực tiếp trên tập gán nhãn `docs/dataset-final-20261102/data_tracker.xlsx` — giải thích được từ khóa đóng góp, không gây tải RAM.
     - **Ưu tiên 2 (nếu cần hiểu ngữ nghĩa sâu hơn):** Model ONNX quantized INT8 cỡ nhỏ (~130–180 MB RAM, ví dụ `paraphrase-multilingual-MiniLM-L12-v2` ONNX INT8), tuyệt đối không dùng model > 1GB như `bge-m3`.
   - Trả về 4 trạng thái chuẩn: `MATCHED`, `PARTIAL_REVIEW`, `NOT_MATCHED`, `UNVERIFIABLE` kèm danh sách điều kiện đạt/thiếu và câu trích dẫn bằng chứng.
2. **Tái thiết kế Score Breakdown theo 3 trục minh bạch (`D6`):**
   - Thay vì một con số cộng dồn khó hiểu, trả rõ 3 trục độc lập cùng tổng điểm định hướng (vẫn giữ trần 89 theo `D2` khi còn bước xác thực chưa hoàn tất):
     - **Trục 1 — Toàn vẹn Định danh & Học kỳ (`identityScore`)**: Đúng người, đúng kỳ, không trùng lặp.
     - **Trục 2 — Tín hiệu Xác thực Nguồn (`authenticityScore`)**: QR chính thống / CSDL sự kiện nội bộ / Allow-list web / Phôi chuẩn.
     - **Trục 3 — Mức khớp Tiêu chí Rubric (`rubricFitScore`)**: Khớp yêu cầu của tiêu chí sinh viên chọn.
   - **Luồng 3 (Ảnh sự kiện — khi tắt mặt theo `D3`):** Quy tắc phân hạng B/C rõ ràng:
     - **Hạng B (`YELLOW_STRONG`):** Không trùng kho + (Banner/Backdrop OCR khớp hoạt động **VÀ** có nguồn đối chứng từ CSDL nội bộ/Allow-list **VÀ** EXIF ngày chụp khớp hoặc hợp lệ).
     - **Hạng C (`YELLOW_WEAK`):** Thiếu 1 trong các tín hiệu trên hoặc ảnh không có EXIF/chữ bối cảnh.
     - Mọi ảnh sự kiện đều vào **Duyệt 2 cấp (`D5`/`D7`)**, không bao giờ tự duyệt.

---

## 3. Chiến lược dữ liệu tinh gọn (Lean Golden Evaluation Set)

**Bỏ yêu cầu gán nhãn 500–5.000 mẫu trước khi làm.** Áp dụng chiến lược dữ liệu thực dụng ngay trên 117 tệp sẵn có tại `docs/Minh chứng Lọc`:

1. **Bước 1 — Chốt Golden Set 50–60 tài liệu đại diện (từ 117 tệp local):**
   - Gom nhóm trùng lặp (`SHA-256` & `pHash`) vào cùng `group_id` trước khi chọn, đảm bảo **không có bản trùng** trong tập đánh giá.
   - Phân tầng đủ các nhóm thực tế: Giấy khen DUT (15), Giấy xác nhận Khoa/Đoàn/CLB (15), Giấy hiến máu (8), Chứng nhận online/có QR/PDF (10), Ảnh chụp khó — mờ/nghiêng/lóa/nền màu (10).
   - **Chỉ cần người duyệt gán nhãn 6 trường JSON chuẩn** (`studentName`, `studentCode`/`citizenId`, `activityName`, `organizer`, `issuedDate`, `expectedCriterionCode`) + nhãn `quality_pass` (thời gian làm ~2–3 giờ, thay vì gõ lại từng dòng toàn văn hàng nghìn câu!).
   - Khóa Golden Set làm **tập benchmark độc lập** (chỉ đọc local, tuyệt đối không đẩy ảnh/PII lên cloud hay git công khai).
2. **Bước 2 — Benchmark thực nghiệm A/B cho CPU 8GB (Data-Driven Selection):**
   - Chạy cùng Golden Set trên 3 cấu hình nhẹ chạy được trên CPU 8GB RAM:
     - **Baseline:** Tesseract 5 (`vie+eng`) + Regex hiện tại.
     - **Candidate 1 (ONNX siêu nhẹ ~250 MB RAM):** `rapidocr-onnxruntime` (PP-OCRv4 Det + Rec đa ngữ) + Layout-Aware Parser.
     - **Candidate 2 (Chuyên tiếng Việt ~700 MB RAM):** `rapidocr-onnxruntime` (PP-OCRv4 Detector) + `VietOCR (vgg_seq2seq)` + Layout-Aware Parser.
   - Đo 4 chỉ số thật kèm **khoảng tin cậy Wilson 95% (95% CI)** và **số ca lỗi tuyệt đối** (vì trên 50–60 mẫu, 1 ca lệch đã đổi ~2%): **Field Exact-Match (MSSV/CCCD/Ngày)**, **Name Match Accuracy**, **Số ca False-Accept định danh**, **Latency P50/P95 & Peak RSS dưới tải đồng thời**.
   - **Quy tắc chọn:** Chỉ đưa vào production cấu hình giảm **≥ 50% số lỗi trường định danh** so với Baseline, có **0 ca False-Accept định danh** trên Golden Set, và ổn định trong ngân sách RAM/timeout thực đo.
3. **Bước 3 — Vòng lặp cải thiện từ dữ liệu vận hành (Active Learning an toàn):**
   - Trong giai đoạn `SHADOW` và `ASSIST`, lưu các ca cán bộ **override** (sửa lại kết quả AI) dưới dạng danh sách cần rà soát để bổ sung rule/ngưỡng và mở rộng Golden Set lên 150–200 mẫu có kiểm soát PII.

---

## 4. Lộ trình thực thi mới (5 Giai đoạn rõ ràng)

| Giai đoạn | Mục tiêu cốt lõi | Hạng mục triển khai chính | File / Khu vực tác động | Tiêu chí qua cổng (Go/No-Go) |
|---|---|---|---|---|
| **P1: Khóa nền & Golden Set** *(1 tuần)* | Khóa hợp đồng M2 hiện tại và có thước đo thật trước khi đổi lõi AI. | 1. Hoàn tất 6 ca smoke test thủ công M2.<br>2. Chốt Golden Set 50–60 mẫu từ 117 tệp local (chỉ 6 trường JSON + chất lượng).<br>3. Viết script benchmark A/B thống nhất đo Field Exact-Match & False-Accept. | `apps/ai-service/tools/`<br>`docs/Minh chứng Lọc/dataset-local/` | M2 manual smoke 6/6 PASS; Golden Set đã duyệt nhãn, 0 lỗi schema; có bảng số đo Baseline chính xác. |
| **P2: Thay lõi OCR & Extraction (Lớp 3–4)** *(2 tuần)* | Giải quyết triệt để nút thắt đọc tiếng Việt có dấu & bóc tách JSON trong ngân sách tài nguyên đo thực tế. | 1. Tích hợp **RapidOCR (`use_rec=False`) + VietOCR (`predict_batch`)** sau interface chung `DocumentExtractor`; khóa `workers=1` & giới hạn concurrency.<br>2. Xây **Layout-Aware Parser** theo tọa độ BBox + Pydantic Schema + Evidence Span + Anti-Hallucination.<br>3. Giữ Tesseract làm fallback khi lỗi engine. | `apps/ai-service/src/ocr_extractor.py`<br>`apps/ai-service/src/vietnamese_ocr_engine.py`<br>`apps/ai-service/src/schemas.py` | Trên Golden Set 50–60 mẫu (báo cáo kèm **Wilson 95% CI**): giảm **≥ 50% lỗi trường định danh** so với Tesseract; **0 ca False-Accept định danh**; đo Peak RSS dưới tải đồng thời & P50/P95 thực tế; 0 outbound HTTP. |
| **P3: Xác minh kho, QR, CSDL Sự kiện & Phôi (Lớp 2, 6, Luồng 2)** *(1.5–2 tuần)* | Xóa tình trạng kẹt trần 89 và loại bỏ phụ thuộc mong manh vào DuckDuckGo. | 1. Bảng/index duplicate toàn kho xuyên học kỳ (phân biệt trùng chính SV vs khác SV).<br>2. Nâng cấp QR quét đa tệp/đa trang PDF/xoay ảnh.<br>3. Xây `InternalEventCatalog` (CSDL sự kiện nội bộ) + cache web search allow-list (`D1`).<br>4. Nạp 10–15 phôi DUT chuẩn vào `templates/registry.json`; gắn `NOT_APPLICABLE` cho giấy ngoài trường. | `apps/ai-service/src/qr_verifier.py`<br>`apps/ai-service/src/web_search_verifier.py`<br>`apps/ai-service/src/template_matcher.py`<br>`apps/backend/prisma/schema.prisma`<br>`apps/backend/src/evidence/` | Trùng lặp xuyên kỳ phát hiện đúng 100% test; QR đọc được trên PDF & ảnh xoay; hồ sơ đủ điều kiện thật đạt `GREEN (≥ 90)` hợp lệ, hồ sơ thiếu vẫn bị chặn ở `≤ 89`. |
| **P4a: Hybrid Rubric ML, Luồng 3 & Che giấy hiến máu** *(2 tuần)* | Tích hợp Model ML tự train (NLP + CV) và bảo vệ dữ liệu nhạy cảm `D5`. | 1. Nâng cấp `criterion_evaluator.py` sang **Hybrid (Rule + Model ML tự train)**, báo cáo `mean ± std` qua `StratifiedGroupKFold` & Confusion Matrix.<br>2. Chốt rule phân hạng B/C cho Luồng 3 không dùng khuôn mặt (`D3/D7`) kết hợp Model CV tách riêng nội dung khỏi chất lượng ảnh.<br>3. Cơ chế ảnh che tách biệt cho giấy hiến máu + signed URL ngắn hạn + audit mở ảnh gốc (`D5`). | `apps/ai-service/src/predictor.py`<br>`apps/ai-service/src/criterion_evaluator.py`<br>`apps/ai-service/src/pipeline_orchestrator.py`<br>`apps/backend/src/evidence/` | Rubric ML vượt baseline keyword (báo cáo `mean ± std` + Confusion Matrix); tập test CV 100% ảnh SV tự chụp; BCS không thấy CCCD đầy đủ/lượng máu/ngày sinh/URL gốc; Cố vấn mở ảnh gốc có đủ 4 trường audit. |
| **P4b (V2 — Sau lõi AI): Duyệt 2 cấp đầy đủ & Batch Approval** *(1.5–2 tuần)* | Hoàn thiện quy trình Cố vấn/BCS → Khoa & duyệt hàng loạt (`D5/D7`) mà không làm quá tải P4a. | 1. Workflow 2 cấp (Cấp 1 xác nhận tham gia → Cấp 2 Khoa chốt cuối).<br>2. Batch Approval cấp Khoa chỉ cho hồ sơ đã xác nhận Cấp 1 và không có cảnh báo, ghi audit riêng từng hồ sơ. | `apps/backend/src/reviews/`<br>`apps/web/src/pages/officer/` | Cấp 1 không chốt điểm; Batch chặn 100% hồ sơ có cảnh báo hoặc thiếu xác nhận Cấp 1; mỗi item có audit riêng. |
| **P5: Shadow Rollout, Vận hành & Go-Live (`M7`)** *(2 tuần)* | Kiểm chứng trên dữ liệu thực tế học kỳ mà không ảnh hưởng người dùng trước khi bật `ASSIST`. | 1. Diễn tập migration & restore backup trên staging (`P0-OPS-01`).<br>2. Chạy `AI_MODE=SHADOW` ít nhất 1 đợt thu minh chứng thực tế, đo tỷ lệ khớp với quyết định cán bộ, độ trễ P95, Peak RSS và tỷ lệ timeout.<br>3. Bật `AI_MODE=ASSIST` thí điểm theo 1–2 Khoa kèm nút rollback về `OFF` tức thì và rút mẫu kiểm toán 5–10% ca XANH. | `apps/backend/`<br>Monitoring / Runbook / Config | 0 sự cố lộ PII vào log/audit; báo cáo pilot thực tế kèm 95% CI; cán bộ nghiệp vụ ký duyệt mở rộng toàn trường. |

---

## 5. Những việc kiên quyết KHÔNG làm trong kế hoạch mới

- **Không** fine-tune Tesseract từ dữ liệu chưa duyệt hoặc bỏ công gán nhãn 5.000 dòng OCR khi chưa benchmark `RapidOCR + VietOCR`.
- **Không** nạp Local VLM (4B–7B) hay embedding nặng (`bge-m3`) trên máy CPU 8GB RAM (nguy cơ OOM và treo worker).
- **Không** gửi ảnh minh chứng hay văn bản OCR có PII lên OpenAI/Gemini/Claude API bên ngoài khi chưa có phê duyệt chính thức (`D8`/`D9`).
- **Không** bật bất kỳ phát hiện/nhận dạng khuôn mặt nào trước khi Nhà trường phê duyệt pháp lý và consent (`D3`/`D4`).
- **Không** để AI tự động `APPROVED` hoặc `REJECTED`, và không bao giờ coi riêng điểm ELA hay "không tìm thấy bài báo trên web" là bằng chứng giả mạo.
- **Không** mở Headless Browser (Chrome/Playwright) để search live Google/Facebook cho từng hồ sơ trên CPU 8GB (tốn 400–800 MB RAM/tab, chậm và dễ dính CAPTCHA).

---

## 6. Phương án Tự huấn luyện Mô hình AI / Học máy cho Đề tài (Chốt CPU 8GB)

Để vừa đáp ứng yêu cầu **tự huấn luyện mô hình AI/ML thật** (có dataset train/val/test, so sánh thực nghiệm, đo chỉ số `F1 / Accuracy / Confusion Matrix` và nhúng trực tiếp vào Web), vừa **nhàn về mặt thu thập dữ liệu (không vướng PII)** và **chạy mượt trên CPU 8GB**, dự án chốt kiến trúc **1 Pretrained (đã tích hợp xong) + 2 Model TỰ TRAIN (1 NLP + 1 Computer Vision)**:

### 6.1. Tổng quan vai trò từng khối

| Khối | Trạng thái | Công nghệ | Giải quyết luồng nào trên Web? | Tài nguyên CPU 8GB |
|---|---|---|---|---|
| **OCR Tiếng Việt** | **Pretrained (Đã xong)** | `RapidOCR (PP-OCRv4 ONNX)` + `VietOCR (vgg_seq2seq)` | Đọc chữ giấy khen, giấy hiến máu (Luồng 1) & chữ banner sự kiện (Luồng 3). Đã chạy thật trên Web + `/ai-lab` + `/ai-test`. | ~550–800 MB RAM |
| **Model TỰ TRAIN #1 (NLP)** | **Chốt triển khai** | Baseline `TF-IDF + LinearSVC` so với **`SetFit`** (`MiniLM-L12` / `vietnamese-bi-encoder`) hoặc **`PhoBERT-base-v2` ONNX INT8** | **Lớp 7:** Phân loại `(Tên hoạt động + Nội dung OCR)` vào đúng **16 tiêu chí Rubric DUT**, thay keyword cứng trong `criterion_evaluator.py`. | ~50–130 MB RAM, `< 150 ms` |
| **Model TỰ TRAIN #2 (CV)** | **Chốt triển khai** | Transfer Learning **`MobileNetV3-Small`** hoặc **`EfficientNet-B0`** (train Colab T4 miễn phí 15 phút → xuất ONNX) | **Luồng 1 + Luồng 3:** Phân loại 7 lớp ảnh (loại minh chứng + bối cảnh **ảnh người tham gia sự kiện** + lọc ảnh rác/selfie) mà không vướng sinh trắc học mặt (`D3/D4`). | ~15–20 MB ONNX, `~30 ms/ảnh` |
| **Luồng 2 (Xác thực hoạt động)** | **HTTP + DB Nội bộ** | `InternalEventCatalog` (crawler HTTP định kỳ `dut.udn.vn`) → Live Search API allow-list (`D1`, không PII) + Cache 7 ngày | Kiểm tra sự kiện có tồn tại thật không; Playwright chỉ dùng làm fallback cho trang QR dạng SPA nếu cần. | ~10 MB RAM |

---

### 6.2. Chi tiết Model TỰ TRAIN #1 — NLP Phân loại 16 Tiêu chí Rubric DUT

- **Đầu vào:** `(Tên hoạt động + Nội dung OCR từ giấy/banner + Vai trò khai báo)`.
- **Đầu ra:** Mã tiêu chí Rubric phù hợp nhất (`Mục 4, 5, 8, 9, 10, 12, 13, 14, 15, 16`) + xác suất tin cậy + cảnh báo nếu sinh viên chọn nhầm mục.
- **Chiến lược dữ liệu thực tế & chống ảo giác số liệu trên tập nhỏ:**
  1. **Tận dụng ngay dữ liệu thật đã có** trong `docs/dataset-final-20261102/data_tracker.xlsx` (hiện 51 mẫu đã gán nhãn / 73 mẫu chờ duyệt, 42–79 `group_id` độc lập).
  2. **Đánh giá trung thực trên tập ít mẫu:** Vì nhiều lớp chỉ có 1–7 mẫu nên kết quả giữa các fold dao động mạnh — **bắt buộc báo cáo `mean ± std` qua các fold của `StratifiedGroupKFold` và Ma trận nhầm lẫn (Confusion Matrix) theo từng lớp**, tuyệt đối không chỉ báo cáo 1 con số Accuracy gộp.
  3. **Mở rộng tự động có kiểm soát:** Nếu cào thêm tiêu đề công khai từ `dut.udn.vn` / ĐH Đà Nẵng, **bắt buộc kiểm tra `robots.txt` và điều khoản sử dụng**, áp dụng `rate-limit`, ghi rõ nguồn công khai phục vụ mục đích học thuật. Dùng model baseline sinh nhãn nháp (`pseudo_labeled_suggestions.csv`) để duyệt nhanh; **tập Test luôn giữ 100% mẫu thật do người duyệt.**
- **Bảng so sánh thực nghiệm cho báo cáo:** `Keyword cứng (hiện tại)` vs `TF-IDF (word + char_wb) + LogisticRegression / LinearSVC / ComplementNB` (đã triển khai tại `research/activity-classification/train_baseline.py`) vs `SetFit` (`MiniLM-L12` / `vietnamese-bi-encoder`).

---

### 6.3. Chi tiết Model TỰ TRAIN #2 — Computer Vision cho Loại Minh chứng & Ảnh Sự kiện (Luồng 1 & Luồng 3)

- **Nguyên tắc tách biệt Chất lượng ảnh và Loại nội dung (tránh False Positive):**
  - **Lớp 1 (Quality Gate)** chịu trách nhiệm riêng cho ảnh mờ/thiếu sáng/nghiêng.
  - **Model CV** chỉ phân loại **nội dung** gồm **7 lớp** (KHÔNG gộp "ảnh mờ" vào lớp không hợp lệ để tránh gắn cờ đỏ nhầm ảnh sự kiện thật nhưng hơi mờ):
    1. `GIAY_KHEN_GCN` — Giấy khen, giấy chứng nhận, quyết định.
    2. `GIAY_HIEN_MAU` — Giấy chứng nhận hiến máu tình nguyện.
    3. `SU_KIEN_HOI_TRUONG` — Hội thảo, hội nghị, sinh hoạt công dân, lễ trao giải *(khớp Mục 8, 10)*.
    4. `SU_KIEN_TINH_NGUYEN` — Mùa hè xanh, áo xanh tình nguyện, dọn vệ sinh, điểm hiến máu *(khớp Mục 12)*.
    5. `SU_KIEN_VAN_NGHE_THE_THAO` — Hội thao, giải chạy, văn nghệ sân khấu *(khớp Mục 9)*.
    6. `SU_KIEN_CLB_NGAY_HOI` — Gian hàng, ngày hội việc làm, sinh hoạt CLB/Ban tổ chức *(khớp Mục 4, 13)*.
    7. `KHONG_PHAI_MINH_CHUNG` — Ảnh selfie ở nhà, phong cảnh, ảnh rác không liên quan hoạt động → **Cảnh báo ĐỎ / Hạng C** (vẫn qua duyệt người).
- **Chống Domain Shift & tuân thủ pháp lý dữ liệu ảnh:**
  - Ảnh bìa tin trên web trường thường chụp đẹp/chuyên nghiệp, khác xa ảnh sinh viên tự chụp điện thoại → dễ học "phông nền đẹp" thay vì ngữ cảnh thật.
  - **Bắt buộc:** Tập **Test CV phải gồm 100% ảnh sinh viên tự chụp bằng điện thoại** (từ kho ảnh thật / nhóm tự chụp), tuyệt đối không dùng ảnh bìa web trường để báo cáo kết quả Test! Khi train từ ảnh web cần thêm augmentation mô phỏng chụp điện thoại (nén JPEG, lóa sáng, nghiêng, crop lệch).
  - Trước khi cào ảnh bìa từ `dut.udn.vn`, kiểm tra `robots.txt`/điều khoản sử dụng; không phát tán ảnh chứa người thật ra ngoài môi trường học thuật cục bộ và ghi rõ nguồn công khai trong báo cáo.
- *(Ghi chú về nhận diện khuôn mặt: nếu cần phần nghiên cứu đối chiếu mặt trong báo cáo, dùng pretrained `InsightFace / ArcFace ONNX` đánh giá ngưỡng Cosine Similarity trên tập công khai LFW hoặc ảnh tự chụp của nhóm; trên hệ thống Web vẫn giữ cờ `FACE_MATCHING_ENABLED=false` mặc định theo `D3/D4`.)*

---

### 6.4. Tác động lên Frontend (FE) khi tích hợp 2 Model tự train

- **Không phải thay đổi kiến trúc FE, đăng nhập, DB hay quy trình duyệt của cán bộ:**
  - **Model #1 (NLP):** thay trực tiếp ruột của `criterion_evaluator.py`, đổ kết quả vào trường `criterionAssessment` và `suggestions` đã có sẵn trên `AiResultPanel`, `EvidenceDetail`, `ReviewDetail`, `AiTestConsole`.
  - **Model #2 (CV):** đổ kết quả vào `sceneVision.sceneContext` và `documentChecks` đã có sẵn trên `AiResultPanel`.
- **Cập nhật hiển thị tùy chọn rất nhẹ (~10–15 dòng mỗi chỗ để demo với giảng viên):**
  - Hiện thêm nhãn tên model + xác suất dự đoán (ví dụ: *`Model ML tự huấn luyện (tfidf_complement_nb v1.0.0): Dự đoán phù hợp nhất với Mục 12 (99%)`* và *`Bối cảnh ảnh (MobileNetV3): Sự kiện Tình nguyện (92%)`*).

---

### 6.5. Hướng mở rộng sau Go-Live (Chỉ làm sau khi có dữ liệu vận hành thật)

- **Luồng 2 Pairwise Matching:** Fine-tune model so khớp cặp `(Hoạt động OCR/Form ↔ Tiêu đề & Snippet bài báo)` thay `SequenceMatcher` để bắt đúng trường hợp viết khác từ và loại bỏ bài báo sai năm.
- **Meta-Model Tabular (`LightGBM + SHAP` — Đưa vào sau cùng):** Chỉ triển khai **sau khi đã chạy `SHADOW` / `ASSIST` và thu thập đủ nhãn quyết định thật của cán bộ**; tuyệt đối không hiệu chuẩn điểm sớm trên dữ liệu nhỏ/tổng hợp để tránh khớp nhiễu (overfitting).
