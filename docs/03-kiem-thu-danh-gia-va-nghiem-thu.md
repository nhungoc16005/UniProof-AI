# 03. Tiêu chuẩn Đánh giá, Kiểm thử & Nghiệm thu AI

> **Vai trò tài liệu:** Quy chuẩn đo lường chất lượng AI, ma trận kiểm thử tự động, quy trình smoke test thủ công và checklist nghiệm thu trước khi vận hành chính thức.  
> **Cập nhật:** 22/11/2026 (đồng bộ hoàn toàn với `D1–D10` và kế hoạch 5 giai đoạn tại `02-giai-phap-va-lo-trinh-ai.md`).

---

## 1. Bộ chỉ số đo lường AI bắt buộc (Không công bố số liệu ảo)

Mọi tuyên bố "AI đạt chuẩn" chỉ hợp lệ khi đo trên **Golden Set đã được người duyệt xác nhận** (nhóm trùng lặp theo `group_id`, không rò rỉ dữ liệu). Các trường hợp chưa có dữ liệu đo ghi rõ `NOT_EVIDENCED`.

| Lớp / Thành phần | Chỉ số chính | Ngưỡng mục tiêu nghiệm thu | Ghi chú an toàn |
|---|---|---|---|
| **Lớp 0–1: Chất lượng ảnh** | Recall phát hiện ảnh không đọc được / False Reject ảnh đọc được | Recall **≥ 95%**, False Reject **≤ 5%** | Không dùng chất lượng ảnh để kết luận giấy thật/giả. |
| **Lớp 2: Trùng lặp kho** | Precision cảnh báo trùng chính xác (SHA-256) & pHash | Exact Precision **≥ 99%**, báo cáo riêng FP/FN cho pHash | pHash gần giống chỉ cảnh báo `REVIEW`, không tự từ chối. |
| **Lớp 3: OCR tiếng Việt** | CER toàn văn / CER trường định danh (MSSV, ngày, mã) | Toàn văn **≤ 10%**, Định danh **≤ 5%** | Báo cáo tách riêng theo loại giấy (giấy khen, hiến máu, PDF, ảnh chụp). |
| **Lớp 4: Trích xuất JSON** | Exact-Match (MSSV, CCCD, Ngày) & Micro-F1 trường văn bản | Báo cáo kèm **Wilson 95% CI** & số ca lỗi tuyệt đối (giảm ≥ 50% lỗi so với baseline; mục tiêu dài hạn ≥ 92–95%) | Thiếu thông tin trả `null`, không được tự bịa từ Form. |
| **Lớp 5: Đối chiếu 3 chiều** | False-Accept định danh & Precision của cờ `MISMATCH` | **0 ca False-Accept** trên Golden Set 50–60 mẫu (báo cáo Wilson 95% CI; dài hạn ≤ 0.5%) | Phân biệt rõ `MISSING` (`REVIEW`) và `MISMATCH` (`INVALID`). |
| **Lớp 6: QR & Phôi** | Tỷ lệ đọc QR trên bộ ảnh/PDF có QR; False Alert phôi | QR Decode **≥ 95%** (ảnh rõ/xoay); 0 auto-reject vì ELA/phôi | Giấy ngoài trường trả `NOT_APPLICABLE` / `UNKNOWN`, không phạt cứng. |
| **Lớp 7: Rubric Matcher (NLP)** | Macro/Weighted-F1 qua `StratifiedGroupKFold` (`mean ± std`) + Confusion Matrix | Vượt baseline keyword; báo cáo rõ `mean ± std` và ma trận nhầm lẫn từng lớp | Thiếu dữ liệu trả `UNVERIFIABLE`, không ép 0 điểm. |
| **Luồng 3: CV Phân loại ảnh** | Macro-F1 trên tập Test **100% ảnh SV tự chụp** (tách riêng khỏi chất lượng ảnh) | Không dùng ảnh bìa web làm tập Test cuối; tách lỗi mờ sang Lớp 1 | Mọi ảnh sự kiện vẫn qua duyệt người (HITL). |
| **Vận hành & HITL (CPU 8GB)** | Latency **P50/P95**, **Peak RSS dưới tải đồng thời**, rò PII | Khóa `workers=1`, đo thực tế Peak RSS & P95 trên Golden Set, rò PII **= 0** | Lỗi AI / timeout luôn rơi an toàn về `NEEDS_HUMAN_REVIEW`. |

---

## 2. Lệnh chạy kiểm thử tự động hiện có

- **AI Service (`apps/ai-service`):**
  ```powershell
  python -m pytest -q
  # hoặc chạy tập trung 2 luồng & OCR:
  python -m pytest test_unified.py test_flow1_flow2.py test_ocr_extractor.py test_m2_contract_quality.py -q
  ```
- **Backend (`apps/backend`):**
  - Worker unit test: `test/evidence-processing-worker.test.cjs`
  - Integration PostgreSQL thật: `test/workflow.integration.test.cjs`
- **Frontend (`apps/web`):**
  - Component test panel gợi ý AI: `apps/web/src/components/AiResultPanel.test.tsx`

---

## 3. Ma trận Test Case chuẩn hóa (Đồng bộ D1–D10)

### 3.1. Luồng 1 — Pipeline kiểm tra minh chứng giấy tờ

| Mã TC | Nhóm | Kịch bản kiểm thử | Kết quả bắt buộc |
|---|---|---|---|
| **TC-L1-01** | Tiếp nhận | Thiếu tệp, payload rỗng, Base64 hỏng, MIME giả, PDF 0 trang, tệp > 8MB | Trả lỗi `422` kèm thông báo tiếng Việt hành động được; không dùng ảnh mẫu thay thế. |
| **TC-L1-02** | Chất lượng | Ảnh mờ / tối / nghiêng làm điểm chất lượng `< 70` | Dừng sớm tại `QUALITY_GATE`; không gọi OCR/forensics/web; rubric trả `UNVERIFIABLE` (không ép 0). |
| **TC-L1-03** | Trùng lặp | Trùng SHA-256 với SV khác hoặc học kỳ trước; pHash Hamming ≤ 10; pHash sentinel `0×16` | Exact trùng → cờ `FAIL` + `RED`/`INVALID`; pHash tương đồng → cảnh báo `REVIEW`; sentinel `0×16` không báo trùng giả. |
| **TC-L1-04** | OCR & Bảo mật | Engine OCR lỗi/timeout; các nhánh OCR bất đồng tên/MSSV (`recognitionAmbiguous=true`); kiểm tra outbound HTTP | Engine lỗi/timeout → `REVIEW`, không HTTP 500; `ambiguous=true` → `REVIEW` (không ép `RED`, không cộng điểm); **0 request** ra LLM bên ngoài (`D9`). |
| **TC-L1-05** | Đối chiếu 3 chiều | Sai MSSV / Tên `< 70%` / Sai CCCD hiến máu / Ngày cấp ngoài `Term` | `tier=RED`, trạng thái worker `INVALID` (không `REJECTED`), bỏ qua cộng điểm nguồn, ghi rõ lý do tiếng Việt. |
| **TC-L1-06** | Thiếu dữ liệu | Không đọc được MSSV (`MISSING`) hoặc tên khớp `70–84%` | Ghi `REVIEW` (tuyệt đối không gán `MISMATCH`); điểm bị chặn trần `≤ 89`. |
| **TC-L1-07** | QR & Phôi & ELA | QR nằm ở trang 2 PDF hoặc xoay 90°; phôi rỗng/không khớp; ELA > 0.25 | QR đọc và xác minh được URL; ELA hoặc phôi `UNKNOWN` **không bao giờ** tự `RED`/từ chối và giữ kết quả ở hàng chờ người duyệt. |
| **TC-L1-08** | Trần điểm (`D2`) | Mọi bước đọc đều tốt nhưng còn ≥ 1 checker xác thực `REVIEW`/`NOT_CHECKED` vs tất cả `PASS` | Còn bước chưa xong → trần tối đa `89` (`YELLOW_STRONG`); chỉ `≥ 90` (`GREEN`) khi toàn bộ checker liên quan đã triển khai và `PASS`. |
| **TC-L1-09** | Rubric | Giấy tham gia nộp vào tiêu chí Cán bộ lớp; giấy đủ điều kiện; ảnh mờ không đọc được | Sai tiêu chí → `NOT_MATCHED` (gợi ý 0); đủ điều kiện → `MATCHED` + điểm gợi ý; không đọc được → `UNVERIFIABLE` (`suggestedScore=null`). |

### 3.2. Luồng 2 — CSDL Sự kiện Nội bộ & Tra cứu Allow-list (`D1`)

| Mã TC | Kịch bản kiểm thử | Kết quả bắt buộc |
|---|---|---|
| **TC-L2-01** | Mặc định `ALLOW_ALL_PUBLIC_SOURCES=false` với kết quả từ `dut.udn.vn` và báo chí/Facebook | Chỉ nhận domain thuộc allow-list chính thống (`+20` khi khớp `≥ 0.70`); chặn nguồn ngoài allow-list. |
| **TC-L2-02** | Bật cờ nguồn ngoài theo cấu hình (`news` / `social`) | Ưu tiên thứ tự `official (+20) > news/ngoài (+10) > social (tối đa +5, tín hiệu yếu)`. |
| **TC-L2-03** | Kiểm tra chống rò PII trong query tìm kiếm | URL gửi tới provider chứa sentinel họ tên / MSSV / CCCD → **FAIL test**; query chỉ gồm tên hoạt động, đơn vị, năm. |
| **TC-L2-04** | Tra cứu timeout / HTTP error / không tìm thấy bài viết | Trả `searched=true`, `confidenceBoost=0`, không báo giả mạo, không làm hỏng pipeline. |
| **TC-L2-05** | Có khớp trong `InternalEventCatalog` (sau P3) | Trả kết quả đối chứng trực tiếp từ CSDL nội bộ, không cần gọi web ngoài. |

### 3.3. Luồng 3 & Quy trình HITL / Phân quyền 2 cấp (`D3, D5, D7, D10`)

| Mã TC | Kịch bản kiểm thử | Kết quả bắt buộc |
|---|---|---|
| **TC-L3-01** | `FACE_MATCHING_ENABLED=false` (mặc định `D3`) | Verifier mặt không bao giờ được gọi; response không có count/bbox/embedding; checker mặt trả `NOT_CHECKED`; EXIF và scene OCR vẫn chạy. |
| **TC-L3-02** | Phân hạng B/C cho ảnh sự kiện không dùng mặt | Đủ banner + nguồn đối chứng + EXIF hợp lệ → Hạng B (`YELLOW_STRONG`); thiếu tín hiệu → Hạng C (`YELLOW_WEAK`); **cả hai luôn HITL**, không tự `APPROVED`. |
| **TC-HITL-01** | Chế độ `AI_MODE=OFF \| SHADOW \| ASSIST` (`D10`) | `OFF`: như luồng tiền AI; `SHADOW`: lưu `AiPipelineRun`, không hiện UI/không đổi trạng thái hay queue; `ASSIST`: hiện gợi ý, người duyệt quyết định. |
| **TC-HITL-02** | Hợp đồng trạng thái & Audit (`M1`) | AI không bao giờ ghi `REJECTED`; người duyệt từ chối thiếu căn cứ bị chặn; sentinel họ tên/MSSV/CCCD không rò vào `AuditLog` hay log hệ thống. |
| **TC-HITL-03** | Quyền duyệt 2 cấp & Che giấy hiến máu (`D5, D7`) | BCS lớp gọi API chỉ nhận ảnh đã che (CCCD 3 số cuối, ẩn lượng máu/ngày sinh), gọi ảnh gốc bị `403`, không có OCR gốc nhạy cảm; Cố vấn mở ảnh gốc thiếu lý do bị chặn và khi mở có đủ 4 trường audit `(actor, hồ sơ, thời điểm, lý do)`; Batch cấp Khoa từ chối hồ sơ chưa qua Cấp 1 hoặc còn cảnh báo. |

---

## 4. Quy trình Smoke Test thủ công cục bộ (Disposable Test DB)

Chỉ chạy trên **PostgreSQL cục bộ disposable** (`edupoint_test`) và dữ liệu chứng nhận **tổng hợp (synthetic)** — tuyệt đối không trỏ tới Supabase production hoặc giấy tờ sinh viên thật.

### Bước 1 — Khởi tạo môi trường test
1. Chạy container PostgreSQL + `pgvector` tại cổng `55432`, chạy `npx.cmd prisma migrate deploy` từ `apps/backend`.
2. Tạo tài khoản tổng hợp (`m2.admin@localhost.test`, `m2.officer@localhost.test`, `m2.student@localhost.test` — `Sinh viên Tổng hợp`, MSSV `SV00000001`) bằng:
   ```powershell
   $env:TEST_DATABASE_URL = $env:DATABASE_URL
   node scripts/seed-m2-manual-smoke.cjs
   ```
3. Khởi động 3 tiến trình cục bộ:
   - **AI Service (`:8000`):** `python -m uvicorn src.main:app --host 127.0.0.1 --port 8000` (kiểm tra `/health` trả `ocrAvailable: true`).
   - **Backend (`:3001`):** đặt `AI_MODE=ASSIST`, `AI_PIPELINE_URL=http://127.0.0.1:8000`, `EXTERNAL_LLM_EXTRACTION_ENABLED=false`, chạy `npm.cmd run start:dev`.
   - **Frontend (`:3000`):** đặt `VITE_API_URL=http://127.0.0.1:3001/api`, chạy `npm.cmd run dev -- --host 127.0.0.1`.

### Bước 2 — 6 Kịch bản Smoke Test bắt buộc (Cổng nghiệm thu M2)

Chuẩn bị ảnh chứng nhận tổng hợp (vẽ bằng PowerPoint/Paint) với nội dung: `Sinh viên Tổng hợp`, `SV00000001`, `Ngày hội Công nghệ Mở 2026`, `Đoàn Thanh niên DUT`, `18/10/2026`.

| # | Kịch bản | Kỳ vọng nghiệm thu | Kết quả |
|---|---|---|---|
| **1** | **Chứng nhận hợp lệ (`ASSIST`)** | Nộp thành công; cán bộ thấy bảng gợi ý AI, trạng thái từng checker và score breakdown; AI không tự `APPROVED`. | `[ ] PASS` |
| **2** | **Sai MSSV (`SV00000002`)** | Hiện cảnh báo đỏ/mâu thuẫn kèm lý do tiếng Việt; hồ sơ vẫn mở cho cán bộ kiểm tra; AI không ghi `REJECTED`. | `[ ] PASS` |
| **3** | **Thiếu dòng MSSV** | Checker danh tính báo `REVIEW`/`NOT_CHECKED` (thiếu/không đọc được), không kết luận MSSV sai; điểm `≤ 89`. | `[ ] PASS` |
| **4** | **Tắt AI Service (`ASSIST`)** | Sinh viên nộp bài không bị lỗi; sau retry giới hạn, hồ sơ vẫn ở hàng chờ cán bộ với lý do dịch vụ AI không khả dụng. | `[ ] PASS` |
| **5** | **Đổi sang `AI_MODE=OFF`** | Nộp bài và duyệt hoạt động nguyên vẹn như tiền AI; không hiện job/gợi ý/lỗi AI. | `[ ] PASS` |
| **6** | **Kiểm tra trần điểm 89 (`D2`)** | Với hồ sơ còn ≥ 1 checker `REVIEW`/`NOT_CHECKED`, điểm hiển thị `≤ 89` và ghi rõ là gợi ý, không phải xác suất hay quyết định cuối. | `[ ] PASS` |

---

## 5. Bảng theo dõi trạng thái & Cổng nghiệm thu tổng thể

`DONE` chỉ được đánh dấu khi **có code + test tự động pass + nghiệm thu xác nhận**.

| Hạng mục | Phase | Trạng thái | Ghi chú thực tế |
|---|---|---|---|
| Hợp đồng trạng thái, Audit pipeline, Hàng chờ cơ bản (`M1`) | Nền | **DONE** | Đã qua integration test PostgreSQL (16/16) và worker test (20/20). |
| Chốt an toàn `D1` (allow-list mặc định) & `D3` (tắt hoàn toàn mặt) | Nền | **DONE** | Đã có unit test xác nhận không gọi Haar/face verifier và chặn nguồn ngoài mặc định. |
| Nghiệm thu Smoke Test 6 ca của `M2` + Chốt Golden Set 50–60 mẫu | **P1** | **TODO** | `AiResultPanel.test.tsx` và build đã pass; chờ xác nhận thủ công 6 ca + duyệt nhãn Golden Set. |
| Thay lõi OCR (`RapidOCR ONNX + VietOCR`) & Layout-Aware Extraction có Evidence Span (CPU 8GB, RAM ≤ 1.5 GB) | **P2** | **TODO** | Trọng tâm giải quyết CER ~42–51% hiện tại; chọn model theo benchmark A/B trên Golden Set. |
| Trùng lặp toàn kho xuyên kỳ, QR đa trang/xoay, `InternalEventCatalog`, Kho 10–15 phôi DUT | **P3** | **TODO** | Giải quyết kẹt trần 89 và bỏ phụ thuộc hoàn toàn vào HTML scraping. |
| Hybrid Rubric Matcher siêu nhẹ (`Rule + TF-IDF Linear / MiniLM ONNX INT8`) | **P4** | **TODO** | Thay keyword cứng trong `criterion_evaluator.py`, dùng `data_tracker.xlsx` để huấn luyện & đánh giá. |
| Quy tắc phân hạng B/C Luồng 3 không mặt + Duyệt 2 cấp + Che ảnh hiến máu (`M5 + M6`) | **P4** | **TODO** | Tuân thủ chặt `D5` và `D7`; bắt buộc kiểm thử 403/signed URL/audit 4 trường. |
| Kế hoạch deploy migration Supabase an toàn (`P0-OPS-01`) & Shadow Rollout (`M7`) | **P5** | **TODO** | Bắt buộc backup + diễn tập restore staging, chạy `SHADOW` trước khi mở `ASSIST`. |
| Nhận dạng khuôn mặt sinh trắc học thật (`D4`) | Tương lai | **BLOCKED** | Chỉ mở lại khi Nhà trường phê duyệt pháp lý, consent, mã hóa và chính sách retention/xóa. |

### Checklist Go-Live Production (Chỉ bật `AI_MODE=ASSIST` khi đạt 100%)
- [ ] Golden Set đã duyệt nhãn, không rò trùng lặp, có báo cáo benchmark đạt ngưỡng Mục 1.
- [ ] Không tồn tại bất kỳ nhánh code nào cho phép AI tự ghi `APPROVED` hoặc `REJECTED`.
- [ ] `0` dữ liệu PII (họ tên, MSSV, CCCD, sức khỏe) rò ra query tìm kiếm, API bên ngoài, log hoặc audit tự động.
- [ ] Mỗi lần chạy lưu đủ: `model/rule/config/rubric version`, `inputHash`, `evidence`, thời gian xử lý.
- [ ] Phân quyền 2 cấp và ảnh che hiến máu đã kiểm thử tự động & thủ công.
- [ ] Đã diễn tập backup/restore Supabase, chạy `SHADOW` thành công và có công tắc rollback tức thì về `AI_MODE=OFF`.
