# GĐ6–GĐ7 — Hợp đồng tích hợp AI và nghiệm thu

Ưu tiên **P2**. Chỉ ghép vào luồng nghiệp vụ thật sau **M5** và **MC của khả năng đang ghép**. Chuẩn bị interface/fixture ở GĐ0–GĐ4 được phép làm sớm và không có nghĩa đã bật AI thật.

## 1. Hành vi khi AI chưa bật

Quy ước mới cần đưa vào PL-02/AI-01; chưa tồn tại trong source hiện tại:

| Thành phần | Chế độ Core |
|---|---|
| Feature flags | `AI_ENABLED=false`, `OCR_ENABLED=false`, `RAG_ENABLED=false`; capability gửi cho FE qua phần mở rộng của `/meta/enums` được mô tả trong OpenAPI |
| Khởi động | BE không cần model, AI key hoặc AI_SERVICE_URL; health AI=`DISABLED`; Redis/storage/DB vẫn là phụ thuộc Core |
| Nộp hồ sơ | `DRAFT → SUBMITTED → PROCESSING → PROCESSED`; bước xử lý Core hoàn tất thì `review_status=PENDING_REVIEW`. Bước OCR/extraction/classification/recommendation=`SKIPPED` với `reason=FEATURE_DISABLED` |
| Xác minh | Ban đầu `NEEDS_HUMAN_REVIEW`; đối chiếu dữ liệu nội bộ/nguồn do cán bộ xác nhận có thể cập nhật đúng kết quả. Không coi thông tin tự khai là nội dung đã OCR |
| Đề xuất AI | Endpoint đọc kết quả có `data:null` + `meta.availability=DISABLED/NOT_RUN`; không gán `suggested_score=0`, confidence=1 hay `NO_MATCH` cho AI chưa chạy |
| Điểm theo rule | Officer chọn tiêu chí/vai trò/điểm đề nghị; BE trả cap/checks và đánh giá lại lúc lưu quyết định; `suggested_score` từ AI vẫn null |
| Evidence Gap | Do yêu cầu cán bộ/rule sinh, ghi source=`OFFICER` hoặc `RULE`; không mạo nhận là AI đã phân tích |
| FE | Hiển thị “Hồ sơ được cán bộ xét duyệt”; menu chatbot/AI controls ẩn hoặc báo chưa bật. Không hiển thị một pipeline giả đang chạy |
| Mock | Chỉ bật trong dev/test; production/staging nghiệm thu không được tự fallback sang mock nếu AI/API lỗi |

`PROCESSED` có nghĩa tiến trình xử lý hiện được cấu hình đã kết thúc, không có nghĩa AI đã xử lý. Các step lưu SKIPPED và capability giúp FE không gây hiểu nhầm.

## 2. Hợp đồng BE ↔ C

Interface dưới đây là thiết kế cần hiện thực tại AI-01, không phải API đã có. Mọi enum cùng nguồn PL-02; không thêm phiên bản status riêng trong Python.

| Contract | Input tối thiểu | Output tối thiểu |
|---|---|---|
| OCR/extraction | request_id, run_id, evidence_id, input_revision, file refs được cấp quyền, mime, sha256 | text/fields theo file/trang/bbox; confidence nullable; nguồn OCR; quality; normalized data; engine/version |
| Classification | text, language, contract_version | label, confidence [0..1], all_scores, model_version; lỗi có code; nhãn không biết không tự map tiêu chí |
| Recommendation | extracted data, declared data có source, candidate criteria/version, rule cap snapshot, context được cấp quyền | RECOMMENDED/ABSTAINED/NO_MATCH/ERROR; top_k criterion IDs tồn tại, suggested_score nullable, reason, citations, versions |
| Verification support | extracted fields + declared fields + verified reference data + sources | activity_existence và participation độc lập; I1–I3 hoặc L1–L5; role match có UNKNOWN; flags, gap, source provenance |
| RAG indexing | document/version/effective dates + file refs | chunks với Điều/Khoản/trang, embedding model/dimension, document hash, index state |
| RAG answer | question, accessible context, effective term/time | ANSWERED/NO_EVIDENCE; answer, citations gắn document/chunk/version; latency/tokens nếu có |

**Sau output C:** A validate schema/criterion/citation/version; chạy Rule Engine để sinh `final_recommended_score`; chỉ REV-01 mới ghi `final_score`. Không cho C điều khiển `review_status=APPROVED` qua response.

**Tham chiếu file:** queue lưu storage key/file ID và revision, không lưu signed URL như địa chỉ lâu dài. Worker cấp URL ngắn hạn lúc chạy; retry lấy URL mới. AI không nhận service-role key hay quyền đọc toàn bộ bucket.

**Correlation:** mỗi lần chạy có `run_id`, `input_revision`, `contract_version`, model/prompt/config/rule version. Output về muộn của revision cũ hoặc hồ sơ đã WITHDRAWN/APPROVED chỉ lưu lịch sử phù hợp, không ghi đè state/quyết định mới.

**Deadline/retry:** cấu hình timeout từng bước, retry tối đa 2 lần cho lỗi tạm thời với backoff, không retry input invalid. C đo số liệu ở AI-08/15; A đặt deadline phù hợp. Quá deadline/retry thì step FAILED, dependent steps SKIPPED, gắn PIPELINE_ERROR và chuyển người xử lý. Core không treo vô thời hạn.

## 3. GĐ6 — Task tích hợp theo từng khả năng

| Xong | ID / Owner / Cỡ | Công việc | Phụ thuộc | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | INT-01 · A+C · L | Migrations PipelineRun/step/output/version, adapter runtime, contract validation, flags và feature capability | M5, MC gói pipeline, BE-23 | AI tắt Core vẫn boot; input_revision chống kết quả cũ; output invalid không đi vào quyết định; bật từng capability được |
| [ ] | INT-02 · A+C · L | Ghép OCR/extraction rồi classification/mapping vào worker; lưu lịch sử; chạy Rule Engine sau gợi ý | INT-01 | Nộp không chờ HTTP AI; kết quả từng bước thật; retry không nhân đôi; lỗi chuyển manual; không tự APPROVED |
| [ ] | INT-03 · B, A+C hỗ trợ · L | S05/O03 OCR fields/correction/bbox, Top-K, score compare, abstention, lịch sử; EVD-09 và PIPE endpoints | INT-02 | Bản gốc và bản sửa còn nguồn; Student chỉ bản rút gọn; no-result/ABSTAINED/NO_MATCH khác nhau; AI lỗi vẫn duyệt bằng Rule Engine |
| [ ] | INT-04 · A+C · L | Ghép KB chunk/index/publish/archive/reindex/retrieval; migrations pgvector đúng dimension; RAG API | M5, MC gói RAG, BE-23 | Tài liệu chưa publish/hết hiệu lực không dùng cho trả lời; citation lịch sử vẫn truy được theo quyền; index idempotent/versioned |
| [ ] | INT-05 · B · L | C04 + A06 đầy đủ + A07 cơ bản; citation drawer, retrieval sandbox, config version | INT-04, INT-03 | ANSWERED có citation; NO_EVIDENCE khác provider unavailable; history/config không sửa hồ sơ cũ; disable RAG trở về Core |
| [ ] | INT-06 · A+C+B · L | Persist Ground Truth/evaluation metrics; A08/A09 bản tối thiểu phục vụ báo cáo; ADM-GT/ADM-EVAL | INT-02, INT-04, AI-16 | Export ẩn danh; metric có dataset size/split/version; FE render số thật; không dùng dữ liệu user tùy ý làm train/test |
| [ ] | INT-07 · A+C · M | Ghép check-source L1 có SSRF protection, hỗ trợ verification/gap/anomaly; EXT-13, PIPE-03/04/08 | INT-02, BE-17, AI-12/13 | Chặn private/loopback IPv4/IPv6, recheck redirect/DNS, giới hạn tải/timeout; HTTP 200 không tự VERIFIED; L4 chỉ existence; C lỗi không biến L5 thành invalid |
| [ ] | INT-08 · B · M | Hoàn thiện O04/S06 Evidence Gap và hai câu hỏi xác minh; cập nhật chỉ số AI O01/O10/A01 | INT-07, INT-06 | Gap có action bổ sung cụ thể; risk chỉ Officer/Admin; metric thiếu data không hiển thị như 0; biết phiên bản tạo gợi ý |
| [ ] | INT-09 · A+B+C · M | Failure/recovery suite: AI down/slow/429/bad JSON/old revision, RAG down, retry và kill switch | INT-03, INT-05, INT-08 | Đạt toàn bộ ca lỗi phía dưới; tắt AI không mất file/hồ sơ/điểm; bảng điểm không đổi nếu chưa có review mới |

Khả năng mới chỉ bật sau smoke trên staging và fixture/contract test. Giai đoạn đầu chỉ xử lý hồ sơ mới hoặc reprocess do người có quyền yêu cầu; không tự chạy lại toàn bộ hồ sơ đã chốt.

## 4. GĐ7 — Nghiệm thu bản tích hợp

| Xong | ID / Owner / Cỡ | Công việc | Phụ thuộc | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| [ ] | REL-01 · A+B · M | Chạy lại toàn bộ Core E2E và security tests ở 3 chế độ AI tắt/bật/lỗi | INT-09 | Core không hồi quy; score/lock/appeal/term invariants giữ nguyên |
| [ ] | REL-02 · C, A hỗ trợ · M | Đánh giá end-to-end trên tập khóa; độ trễ/chi phí/quality, comparison baseline và ablation | INT-09, AI-15 | Có báo cáo tái lập; tỷ lệ vượt trần sau Rule Engine bằng 0 trên bộ kiểm thử; mục tiêu 15 giây/70% giảm thời gian chỉ báo đạt nếu thực sự đo đạt |
| [ ] | REL-03 · B+C, A review · M | Kịch bản demo 3 role, certificate-only, AI abstain/down, trace, RAG và số liệu nghiên cứu; hướng dẫn sử dụng | REL-01, REL-02 | Demo thật có dữ liệu cố định; phân biệt kết quả nghiên cứu/demo với khả năng tổng quát; người khác replay được |
| [ ] | REL-04 · A+B+C · S | Đóng gói release, migration/deploy/rollback runbook, artifacts Web/Mobile/AI và báo cáo | REL-03 | Smoke môi trường đích; secret cấu hình riêng; rollback application/model không phá DB; feature chưa đạt giữ tắt và ghi release notes |

## 5. Ca lỗi bắt buộc khi ghép AI

| Ca | Kết quả mong đợi |
|---|---|
| AI service chết lúc submit | Submit hợp lệ vẫn được lưu/nhận; timeout/retry có giới hạn; chuyển manual, không mất hồ sơ |
| OCR đọc sai tên/vai trò | Giữ text gốc, confidence và bản sửa có source; không tin sửa của SV như chứng cứ đã xác minh |
| Provider trả JSON sai hoặc criterion_id lạ | Validation chặn, có lỗi step/log; không ghi suggested/final score giả |
| AI đề xuất vượt trần | Rule Engine cắt gợi ý; review recheck trần hiện tại; không commit điểm vượt giới hạn |
| Result về sau khi bổ sung/rút/duyệt | input_revision/state guard chặn overwrite; lịch sử không thay quyết định hiện hành |
| Rule/config đổi khi job đang chạy | Run giữ snapshot/version; khi duyệt áp dụng policy version đã chốt và trần thực tế, ghi rõ version quyết định |
| Certificate-only hoặc ngoài trường chưa có registry | Không auto reject; người quyết định; gap giải thích thiếu gì |
| Trang công khai tồn tại nhưng không có tên SV | Không chuyển participation=CONFIRMED |
| RAG thiếu chứng cứ/nguồn hết hiệu lực | NO_EVIDENCE; không bịa citation; không dùng nhầm document version |
| URL độc hại/redirect vào mạng nội bộ | Adapter chặn trước khi truy cập nguồn bị cấm, log không lộ credentials |
| Bật lại/tắt lại AI | Hồ sơ Core cũ vẫn xem/duyệt được; không cộng lại điểm hay xóa gợi ý lịch sử |

## 6. Điều kiện quay về Core

Nếu contract lỗi, tỷ lệ timeout cao hoặc kiểm thử điểm/verification không đạt: tắt capability liên quan, ngừng enqueue job mới của capability đó, xử lý job đang chạy theo revision guard, giữ hồ sơ ở hàng đợi thủ công. Giữ nguyên file, audit, review và điểm đã chốt. Chỉ bật lại khi sửa lỗi và chạy lại bộ test tương ứng đạt.
