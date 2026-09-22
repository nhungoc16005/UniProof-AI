# FS-AI01 — Evidence Processing Pipeline (AI xử lý nền)

> ⚙️ **Phân loại: System & Technical Specification** — Không phải UI Page.
> Đặc tả tiến trình nền bất đồng bộ (BullMQ / Redis Worker) kết nối giữa Core Backend và các dịch vụ AI (Google Vision OCR, Claude Information Extraction, PhoBERT Classification, Verification Engine, Rule Engine).
> **Traceable APIs**: `[EVD-04]` (Kích hoạt pipeline), `[EVD-07]` (Polling trạng thái), `[EVD-08]` (SSE stream), `[PIPE-01..11]` (Đọc kết quả từng công đoạn & Rerun).

| Mã Spec | Phiên bản | Ngày cập nhật | Tác giả |
|---|---|---|---|
| **FS-AI01** | 2.0 (Chuẩn hóa) | 2026-09-21 | Team EduPoint |

---

## 1. 🎯 Objective

Định nghĩa chi tiết pipeline xử lý minh chứng tự động chạy nền (BullMQ worker), bao gồm 6 bước tuần tự: **OCR → Extraction → Classification → Verification → Anomaly Detection → Rule Engine**. Pipeline này là "não" của hệ thống — xử lý mọi minh chứng sinh viên nộp mà không chặn request.

**Tại sao cần spec riêng:**
- Pipeline này không có giao diện nhưng là phần phức tạp nhất về mặt kỹ thuật
- 3 thành viên (Backend, AI-Core, AI-Service) đều liên quan → cần spec rõ ràng để tránh miss
- Input/output mỗi bước phải khớp nhau (output bước trước = input bước sau)

---

## 2. 👤 User Story

> **As the** hệ thống EduPoint,
> **I want to** tự động xử lý minh chứng sinh viên nộp qua pipeline 6 bước chạy nền,
> **so that** kết quả (tiêu chí, điểm, mức xác minh, cảnh báo) sẵn sàng cho cán bộ duyệt mà sinh viên không phải chờ.

---

## 3. 📊 Pipeline Overview

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐
│  1. OCR  │───▶│2. Extract│───▶│3. Classify   │───▶│4. Verify     │───▶│5. Anomaly│───▶│6. Rule   │
│          │    │  (Claude) │    │  (PhoBERT)   │    │  (5 mức)     │    │ (GVision)│    │  Engine  │
│ GCV/Tess │    │ JSON out  │    │ HTTP→ai-svc  │    │ Claude+Rules │    │ Web Det  │    │ Chấm điểm│
└──────────┘    └──────────┘    └──────────────┘    └──────────────┘    └──────────┘    └──────────┘
     │               │                │                    │                 │               │
     ▼               ▼                ▼                    ▼                 ▼               ▼
  OcrResult    ExtractedData    Classification      VerificationResult  AnomalyFlag    FinalScore
  (DB save)    (DB save)        (DB save)           (DB save)           (DB save)      (DB save)
```

---

## 4. Chi tiết từng bước

### 4.1 Bước 1 — OCR (Đọc ảnh/PDF)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `packages/ai-core/src/ocr/` |
| **Engine** | Google Cloud Vision API (primary) hoặc Tesseract (fallback/dev) |
| **Input** | `EvidenceFile[]` (URLs ảnh/PDF từ Supabase Storage) |
| **Output** | `OcrResult { rawText: string, confidence: number, language: string }` |
| **Lưu DB** | Table `ocr_results` (evidenceId FK) |

**Xử lý đặc biệt:**
- PDF nhiều trang → OCR từng trang, nối kết quả
- Ảnh bị xoay → Google Vision auto-detect orientation
- Nếu confidence < 0.3 → gắn flag `LOW_OCR_QUALITY` → chuyển cán bộ

### 4.2 Bước 2 — Extraction (Trích xuất cấu trúc — Claude)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `packages/ai-core/src/extraction/` |
| **Engine** | Claude API (TypeScript SDK) — structured output (JSON schema) |
| **Input** | `OcrResult.rawText` |
| **Output** | `ExtractedData { studentName, studentId, activityName, organizer, dateRange, extractedRole, verificationUrls[], qrCodes[] }` |
| **Lưu DB** | Update `ocr_results.structured_data` (JSON column) |

**Prompt strategy:**
```
Từ nội dung OCR bên dưới, trích xuất các trường thông tin sau dạng JSON:
- studentName: Họ tên sinh viên
- studentId: Mã số sinh viên
- activityName: Tên hoạt động
- organizer: Đơn vị tổ chức
- dateRange: Thời gian (start, end)
- extractedRole: Vai trò tham gia (nếu có ghi)
- verificationUrls: Các URL/link xác minh (nếu có)
- qrCodes: Nội dung QR code (nếu có)

Nếu không tìm thấy trường nào, để null. Không bịa dữ liệu.
```

### 4.3 Bước 3 — Classification (Phân loại hoạt động — PhoBERT)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `packages/ai-core/src/classification/client.ts` |
| **Engine** | HTTP call → `apps/ai-service` (FastAPI + PhoBERT fine-tuned) |
| **Input** | `{ text: activityName + organizer }` |
| **Output** | `{ label: string, confidence: number, allScores: { label: string, score: number }[] }` |
| **Lưu DB** | Table `ai_suggestions` (classification field) |

**Labels (mục tiêu):** Mục 8, Mục 9, Mục 10, Mục 12, Mục 13 (tương ứng các tiêu chí chính)

**Lưu ý:** KHÔNG dùng LLM (Claude) để phân loại — dùng PhoBERT fine-tuned vì đây là bài toán text classification thuần tuý, model nhẹ hơn và có thể đo lường chính xác bằng F1-score.

### 4.4 Bước 4 — Verification (Xác minh 5 mức)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `packages/ai-core/src/verification/` |
| **Engine** | Rule-based + Claude (đối chiếu) + HTTP lookup |
| **Input** | `ExtractedData` + `ParticipationRole (SV tự khai)` |
| **Output** | `VerificationResult { level: 1-5, source: string, roleMatch: boolean, roleMatchDetail: string }` |
| **Lưu DB** | Table `verification_results` (evidenceId FK) |

**5 mức xác minh (từ cao → thấp):**

| Mức | Phương pháp | Ví dụ |
|-----|-------------|-------|
| 1 | QR/URL xác minh → truy cập được → xác nhận | Scan QR → link hợp lệ có tên SV |
| 2 | Đối chiếu danh sách tham gia nội bộ | MSSV có trong DS tham gia Mùa hè xanh |
| 3 | Xác minh qua email/hệ thống trường | Email xác nhận từ @dut.udn.vn |
| 4 | Xác minh qua website công khai | Tên SV xuất hiện trên website đơn vị |
| 5 | Chỉ có ảnh, không xác minh thêm được | Ảnh chụp giấy CN nhưng không đối chiếu được |

**So khớp vai trò:**
- `extractedRole` (AI trích xuất từ MC) vs `participationRole` (SV tự khai)
- Nếu khớp → `roleMatch: true` → tăng confidence
- Nếu không khớp → `roleMatch: false` → gắn flag cảnh báo cho cán bộ

### 4.5 Bước 5 — Anomaly Detection (Phát hiện bất thường)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `packages/ai-core/src/anomaly/` |
| **Engine** | Google Cloud Vision Web Detection + hash comparison |
| **Input** | `EvidenceFile[]` (ảnh gốc) |
| **Output** | `AnomalyFlag[] { type: DUPLICATE|WEB_DETECTION|INCONSISTENCY, severity: LOW|MEDIUM|HIGH, detail: object }` |
| **Lưu DB** | Table `anomaly_flags` (evidenceId FK) |

**Các loại check:**
1. **DUPLICATE**: Hash ảnh (perceptual hash) → so sánh với tất cả ảnh MC đã nộp → similarity > 90% → flag
2. **WEB_DETECTION**: Google Vision Web Detection → nếu ảnh match ảnh mẫu trống trên web → flag "Nghi ngờ mẫu chưa điền"
3. **INCONSISTENCY**: MSSV trên MC ≠ MSSV đăng nhập, hoặc ngày trên MC ≠ ngày hoạt động

> ⚠️ **QUAN TRỌNG**: Anomaly flag là **tín hiệu phụ**, KHÔNG tự kết luận thật/giả. Lý do: false positive (mẫu dùng chung hợp lệ), false negative (ảnh riêng không có trên mạng). Mọi flag đều cần cán bộ xem xét.

### 4.6 Bước 6 — Rule Engine (Tính điểm)

| Thuộc tính | Giá trị |
|------------|---------|
| **Module** | `apps/backend/src/rule-engine/` |
| **Engine** | Code thuần TypeScript (if-else + lookup table) hoặc `json-rules-engine` |
| **Input** | `Classification` + `VerificationResult` + `ParticipationRole` + `Criterion config` |
| **Output** | `{ suggestedScore: number, criterion: string, reasoning: string[], cap: number, accumulated: number }` |
| **Lưu DB** | Table `ai_suggestions` (score fields) |

**Logic:**
1. Từ `classification.label` → mapping sang `criterionId`
2. Từ `participationRole` → tra bảng điểm theo vai trò (Criterion config)
3. Kiểm tra **trần điểm (cap)**: điểm tích luỹ HK + điểm đề xuất ≤ cap → OK
4. Nếu vượt cap → chốt ở mức cap
5. Ghi reasoning (danh sách lý do dạng text)

**Ví dụ:**
```typescript
// Input: Mục 8, ACTIVE_MEMBER, cap=6, accumulated=2
// Lookup: Mục 8 + ACTIVE_MEMBER → 4 điểm
// Check: 2 (đã tích) + 4 (mới) = 6 ≤ 6 (cap) → OK
// Output: suggestedScore = 4, remainingCap = 0
```

---

## 5. 📡 Pipeline Trigger & Flow

### 5.1 Trigger (BullMQ)

```typescript
// Khi SV nộp evidence → backend push job vào queue
await evidenceQueue.add('process-evidence', {
  evidenceId: 'ev-001',
  fileUrls: ['https://...'],
  studentId: 'user-001',
  participationRole: 'ACTIVE_MEMBER',
  activityId: 'act-001',        // null nếu hoạt động mới
  activityName: 'Mùa hè xanh',
  organizerName: 'Đoàn TN'
});
```

### 5.2 Worker (Processor)

```typescript
// apps/backend/src/jobs/processors/evidence-processing.processor.ts
@Processor('evidence')
export class EvidenceProcessingProcessor {
  async process(job: Job) {
    const { evidenceId, fileUrls, ... } = job.data;

    // Cập nhật status → PROCESSING
    await this.evidenceService.updateStatus(evidenceId, 'PROCESSING');

    // 1. OCR
    const ocrResult = await aiCore.ocr.extract(fileUrls);
    await this.saveOcrResult(evidenceId, ocrResult);

    // 2. Extraction (Claude)
    const extracted = await aiCore.extraction.extract(ocrResult.rawText);
    await this.saveExtractedData(evidenceId, extracted);

    // 3. Classification (HTTP → ai-service)
    const classification = await aiCore.classification.classify(extracted.activityName);
    await this.saveClassification(evidenceId, classification);

    // 4. Verification (5 mức)
    const verification = await aiCore.verification.verify(extracted, job.data.participationRole);
    await this.saveVerification(evidenceId, verification);

    // 5. Anomaly Detection
    const anomalies = await aiCore.anomaly.detect(fileUrls, evidenceId);
    await this.saveAnomalies(evidenceId, anomalies);

    // 6. Rule Engine
    const score = await this.ruleEngine.calculate(classification, verification, job.data);
    await this.saveSuggestion(evidenceId, score);

    // Quyết định trạng thái cuối
    const finalStatus = this.determineStatus(verification, anomalies, score);
    await this.evidenceService.updateStatus(evidenceId, finalStatus);

    // Gửi notification cho SV
    await this.notificationService.notifyStudent(job.data.studentId, evidenceId, finalStatus);
  }

  private determineStatus(verification, anomalies, score): string {
    if (anomalies.some(a => a.severity === 'HIGH')) return 'NEEDS_REVIEW';
    if (verification.level >= 2 && score.confidence >= threshold) return 'VERIFIED';
    if (verification.level >= 2) return 'ACCEPTABLE';
    if (verification.level === 5) return 'NEEDS_SUPPLEMENT'; // Chỉ có ảnh
    return 'NEEDS_REVIEW'; // Cán bộ xem xét
  }
}
```

---

## 6. ⚠️ Error Handling

| Bước | Lỗi | Xử lý |
|------|------|--------|
| OCR | GCV API timeout/quota | Fallback sang Tesseract. Nếu vẫn lỗi → status = `OCR_FAILED` → retry 3 lần |
| Extraction | Claude API error | Retry 3 lần (exponential backoff). Nếu vẫn lỗi → status = `EXTRACTION_FAILED` → chuyển cán bộ |
| Classification | ai-service unreachable | Retry 3 lần. Nếu lỗi → skip classification → status = `NEEDS_REVIEW` |
| Verification | URL check timeout | Timeout 10s/URL. Skip URL → giảm mức xác minh |
| Anomaly | GCV Web Detection quota | Skip anomaly step → ghi log → pipeline vẫn tiếp tục |
| Rule Engine | Criterion config missing | Log error → status = `NEEDS_REVIEW` → cán bộ chấm thủ công |
| Toàn pipeline | Uncaught exception | BullMQ auto-retry (max 3). Sau 3 lần → status = `PROCESSING_FAILED` → alert admin |

---

## 7. 📊 Monitoring & Metrics

| Metric | Mô tả | Alert threshold |
|--------|--------|-----------------|
| `pipeline.duration` | Tổng thời gian pipeline (ms) | > 5 phút |
| `pipeline.step.duration` | Thời gian từng bước | OCR > 30s, Claude > 60s |
| `pipeline.success_rate` | Tỷ lệ pipeline hoàn thành | < 90% |
| `pipeline.retry_count` | Số lần retry | > 5/hour |
| `ocr.confidence_avg` | Confidence OCR trung bình | < 0.5 |
| `classification.accuracy` | Tỷ lệ đề xuất khớp kết quả duyệt | < 80% |
| `queue.depth` | Số job đang chờ trong queue | > 100 |
