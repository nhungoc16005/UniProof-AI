# Task riêng người C — AI/ML, OCR và RAG

**Gửi riêng cho người C có thể dùng tài liệu này làm backlog.** C làm độc lập song song với A/B; không yêu cầu BE/Web/Mobile hoàn thiện mới bắt đầu. Tất cả ô task chưa làm; các file model/dataset/script hiện đang rỗng.

## 1. Phạm vi sở hữu và giao tiếp

- `research/activity-classification`: dữ liệu, training, baseline, thí nghiệm, báo cáo; không deploy notebook/training vào Core.
- `apps/ai-service`: FastAPI inference PhoBERT, schema, health/readiness, model artifacts và Docker.
- `packages/ai-core`: OCR, extraction, classification HTTP client, hỗ trợ xác minh, mapping/recommendation, RAG, anomaly adapters.
- A giữ Rule Engine, RBAC, storage permissions, queue, database migration và review/điểm. C không tự ghi `final_score`, không gọi duyệt hồ sơ và không sở hữu business transaction.
- C nhận dữ liệu/fixture có quyền truy cập từ A; không cần production DB hoặc tài khoản FE. Adapter xác minh dùng repository interface hoặc fixture, không nhúng query DB nghiệp vụ tùy ý vào model.

Ưu tiên **C0 hợp đồng → C1 dữ liệu/model → C2 OCR và gợi ý → C3 RAG → C4 đóng gói**. Gói OCR/classification và gói RAG có thể được bàn giao riêng; không ép chờ toàn bộ AI nâng cao mới nghiệm thu một khả năng đã đạt.

## 2. C0 — Hợp đồng và môi trường

| Xong | ID / Cỡ | Task của C | Phụ thuộc | Sản phẩm và tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | AI-01 · M | Chốt interface versioned với A: OCR/extraction/classification/recommendation/RAG, nullability, error, timeout, labels; tạo fixture JSON | PL-02, PL-03 | TypeScript/Pydantic cùng hiểu payload; có success/ABSTAINED/NO_MATCH/timeout/malformed/certificate-only; không trả điểm cuối |
| [ ] | AI-02 · S | Môi trường Python training/inference và TS ai-core tách biệt; lock dependency; script test độc lập | AI-01 | Cài và smoke inference trên CPU sạch được; thiếu model báo not-ready; không load file weights 0 byte như model thật |

## 3. C1 — Dataset, baseline, PhoBERT

| Xong | ID / Cỡ | Task của C | Phụ thuộc | Sản phẩm và tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | AI-03 · L | Xây taxonomy và annotation guide; thu thập/làm sạch/gán nhãn hoạt động; map mục 8/9/10/12/13 sang criterion version | AI-01, PL-03 | Có label dictionary, ví dụ/ca dễ nhầm, nguồn dữ liệu và provenance; không nhầm nhãn hoạt động với 5 khung I–V; nhãn không biết được xử lý rõ |
| [ ] | AI-04 · M | Split train/val/test cố định 70/15/15 nếu dữ liệu cho phép; dedup/group theo sự kiện/template/nguồn; ẩn danh | AI-03 | Có manifest/checksum/seed và thống kê từng nhãn; cùng mẫu/sự kiện không rò giữa train/test; synthetic và real tách báo cáo; test set khóa trước tuning |
| [ ] | AI-05 · M | TF-IDF + Logistic Regression baseline; script train/evaluate | AI-04, AI-02 | Chạy lại ra metrics; Accuracy, Macro-F1, P/R/F1 từng nhãn và confusion matrix; lưu config cùng artifact |
| [ ] | AI-06 · L | Fine-tune PhoBERT; segmentation/tokenizer nhất quán; early stopping/tuning trên validation | AI-05 | Artifact model/tokenizer/label map có version; so sánh baseline trên cùng split; ghi hyperparameter, seed, máy, thời gian; không tune bằng test |
| [ ] | AI-07 · M | Error analysis + calibration/abstention + đối chứng LLM zero-shot nếu có budget | AI-06 | Báo cáo lỗi từng nhãn, hard cases, coverage-risk curve; ngưỡng lấy từ val; nêu cỡ test và giới hạn; nếu thiếu key/budget thì ghi đối chứng chưa chạy |
| [ ] | AI-08 · L | FastAPI classify + health/readiness; export_model; Docker inference; HTTP client ai-core | AI-06, AI-01 | `POST /api/ai/classify` validate input, label/confidence/all_scores/version; model load một lần; giới hạn text/batch/concurrency; timeout/auth nội bộ; benchmark CPU có số đo |

## 4. C2 — OCR, extraction, mapping và xác minh hỗ trợ

| Xong | ID / Cỡ | Task của C | Phụ thuộc | Sản phẩm và tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | AI-09 · L | OCR adapter + extraction JSON; chọn engine bằng mẫu tiếng Việt, ảnh xoay/mờ và PDF nhiều trang | AI-01, AI-02 | Text/page/bbox/confidence và structured fields; không tìm thấy trả null; giữ provenance từng file/trang; validate output; fixture và report field accuracy/CER-WER phù hợp |
| [ ] | AI-10 · M | Chọn embedding tiếng Việt và chunker theo Điều/Khoản/trang; xác định vector dimension và document version | AI-01, AI-02 | Báo A model/dimension/index requirements; chunk giữ source location; không index file .docx rỗng; fixture quy chế có nguồn hoặc nhãn synthetic |
| [ ] | AI-11 · L | Map classification→Top-K criterion hợp lệ và đề xuất/lý do/citation; gọi interface nhận cap từ BE | AI-08, AI-09, AI-10 | Không tự tạo criterion_id; unknown→NO_MATCH; confidence thấp→ABSTAINED; suggested_score tách final_recommended_score do A tính; không tự ghi final_score |
| [ ] | AI-12 · L | Hỗ trợ so khớp identity/role/date; tách nội bộ I1–I3 và ngoài trường L1–L5; nguồn L1 + gap | AI-09, AI-01 | Có fixture đúng/sai/không đủ chứng cứ; role không đọc được ≠ mismatch chắc chắn; L4 không xác nhận tham gia; L5 không tự REJECT/VERIFIED; URL check cần SSRF protection thuộc adapter đã thống nhất với A |
| [ ] | AI-13 · M | Anomaly: near-duplicate/perceptual hash, consistency, Web Detection tùy budget | AI-09, AI-12 | Trả risk signals có lý do/nguồn; không trả “FAKE”; mẫu dùng chung hợp lệ không bị coi gian lận mặc định; provider lỗi là step skipped có lý do |

**Ranh giới BE/C ở AI-12:** A cung cấp hồ sơ/scope/danh sách điểm danh/nguồn đã lưu và quyết định trạng thái nghiệp vụ. C phân tích độ khớp từ dữ liệu được cung cấp. HTTP 200 từ một URL chỉ chứng minh truy cập được, chưa chứng minh chứng nhận hay sự tham gia hợp lệ.

## 5. C3 — RAG và đánh giá độc lập

| Xong | ID / Cỡ | Task của C | Phụ thuộc | Sản phẩm và tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | AI-14 · L | Retrieval + answer + citation; service/library runner độc lập | AI-10 | Chỉ tài liệu published/đúng hiệu lực; thiếu căn cứ→NO_EVIDENCE; đáp án ANSWERED có citation trỏ được nguồn thật; không biến OCR thành instruction |
| [ ] | AI-15 · M | Bộ benchmark OCR/classification/mapping/verification/RAG/end-to-end; golden fixtures và ablation | AI-07, AI-11…14 | Báo riêng từng module và mẫu số; citation correctness/groundedness, score MAE, false-positive/negative, abstention, cost/latency; thử injection và câu ngoài quy chế; không lấy “có citation” thay cho “citation đúng” |
| [ ] | AI-16 · M | Ground Truth/metrics export CSV/JSON và schema nhập về Admin A08/A09 sau này | AI-04, AI-15 | Records có dataset/model/config version, split, nguồn, ground truth, prediction; không xuất MSSV/ảnh thật chưa xử lý; backend/FE có fixture render metrics |

## 6. C4 — Đóng gói và bàn giao

| Xong | ID / Cỡ | Task của C | Phụ thuộc | Sản phẩm và tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | AI-17 · M | CLI/demo harness độc lập cho OCR→extract→classify→mapping/verify; demo RAG riêng; fault injection | AI-08…16 | Người A chạy bằng README và fixture, không cần FE; có mô phỏng timeout/429/invalid JSON/model unavailable; lỗi được chuẩn hóa, không lộ key/PII |
| [ ] | AI-18 · M | Gói release AI và checklist MC: tag/version, artifact checksum, model card, cấu hình, benchmark, limitation, rollback | AI-17 | A kiểm tra contract và chạy smoke; B kiểm tra fixture trạng thái; đủ checklist MC; khả năng chưa đạt giữ tắt |

## 7. Bộ bàn giao MC bắt buộc

- [ ] Code, dependency lock, README chạy độc lập và `.env.example` không có secret.
- [ ] Model weights/tokenizer/label map thật, version/hash, nơi tải artifact nếu không commit weights.
- [ ] OpenAPI classify + JSON schema chung + fixture output đã validate cho A/B.
- [ ] Dataset manifest, annotation guide, split không leakage và báo cáo baseline/PhoBERT/nhãn lỗi.
- [ ] Report OCR, verification, mapping, RAG cho khả năng bàn giao; test input xấu/thiếu file/timeout/429/LLM sai JSON.
- [ ] Model/config/prompt/dataset version; latency p50/p95, memory, máy đo, giới hạn file/trang/text và chi phí mẫu.
- [ ] Mục tiêu phân loại **Macro-F1 ≥ 0,85** theo tổng quan được kiểm tra trên test giữ riêng. Chưa đạt thì ghi thực tế và giữ tính năng phân loại tắt ở bản phát hành; không đổi test/che nhãn khó để đạt số.
- [ ] Các ca an toàn trong golden suite đạt: AI không ghi điểm cuối, L5 không kết luận giả, L4 không xác nhận tham gia, thiếu căn cứ có abstention, RAG không bịa citation.
- [ ] A và C ghi nhận gói sẵn sàng tích hợp; B đã có dữ liệu đủ hiển thị trạng thái. Đây là bàn giao nội bộ có bằng chứng, không chỉ nói “AI chạy được trên máy C”.

**Khi C chậm:** A/B vẫn hoàn thành M5. **Khi C xong sớm:** tiếp tục kiểm thử/hoàn thiện gói độc lập; chưa ghép production flow trước M5. **Khi một module chưa đạt:** bàn giao module đã đạt với capability riêng, module lỗi tiếp tục tắt.
