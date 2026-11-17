# Test case — Luồng 1 & Luồng 2

Tài liệu đặc tả test case cho hai luồng xử lý của UniProof-AI, kèm truy vết tới
test tự động đang chạy.

- **Luồng 1** — Pipeline kiểm tra minh chứng tài liệu: `UnifiedPipelineOrchestrator`
  (chất lượng ảnh → trùng lặp → OCR → đọc dữ liệu → đối chiếu 3 chiều → phôi/ELA → tính điểm & phân loại).
- **Luồng 2** — Tra cứu đối chiếu sự kiện trên nguồn công khai: `WebSearchVerifierService`
  (DuckDuckGo HTML, phân tầng nguồn, cộng điểm tin cậy).

## 1. Phạm vi & cách chạy

| Mục | Nội dung |
| --- | --- |
| Thư mục | `apps/ai-service` |
| Chạy toàn bộ | `python -m unittest discover -s . -p "test_*.py"` |
| Chạy 2 luồng | `python -m unittest test_unified test_flow1_flow2` |
| File test | `test_unified.py` (nền tảng), `test_flow1_flow2.py` (bổ sung độ phủ 2 luồng) |
| Kết quả gần nhất | **94 test OK** (59 test case thuộc 2 luồng + các test khác trong service) |

## 2. Ngưỡng & hằng số tham chiếu

| Tham số | Giá trị | Ý nghĩa |
| --- | --- | --- |
| `qualityThreshold` | 70 | Điểm chất lượng ảnh tối thiểu để đi tiếp |
| `ACCEPT_THRESHOLD` (L2) | 0.55 | Độ tương đồng tối thiểu để **nhận** một kết quả tìm kiếm |
| `BOOST_THRESHOLD` (L2) | 0.70 | Độ tương đồng tối thiểu để **cộng điểm tin cậy** |
| `OFFICIAL_BOOST` | +20 | Nguồn chính thống (DUT/đại học/đoàn–hội) |
| `OTHER_BOOST` | +10 | `news` / `social` / `public` |
| Phân loại | `GREEN ≥ 90`, `YELLOW_STRONG 75–89`, `YELLOW_WEAK 60–74`, `RED < 60` | Theo `_tier` |
| Trần điểm | 89 | Hạ điểm về tối đa 89 nếu còn bước xác thực ở `REVIEW`/`NOT_CHECKED` |
| pHash Hamming | ≤ 10 | Ngưỡng coi là trùng gần đúng |

---

## 3. LUỒNG 1 — Pipeline kiểm tra minh chứng

### 3.1. Tiếp nhận & cổng chất lượng

#### TC-L1-01 — Từ chối khi thiếu tệp minh chứng
- **Mục tiêu:** Không dùng ảnh mẫu thay thế khi thiếu tệp.
- **Tiền điều kiện:** Không có `fileBytesBase64` và `fileUrl`.
- **Dữ liệu vào:** `None`, `None`.
- **Bước:** Gọi `UnifiedPipelineOrchestrator._extract_bytes(None, None)`.
- **Kết quả mong đợi:** Ném `ValueError` chứa "phải có".
- **Test tự động:** `test_missing_file_is_rejected_instead_of_using_sample_image` (đạt)

#### TC-L1-02 — Không bịa kết quả OCR/web khi OCR không khả dụng
- **Mục tiêu:** Khi OCR lỗi/máy chủ chưa cài Tesseract, hệ thống không suy diễn tên/bài báo.
- **Tiền điều kiện:** `enableWebSearch=False`, OCR trả `available=False, rawText=""`.
- **Bước:** Chạy `UnifiedPipelineOrchestrator.process`.
- **Kết quả mong đợi:** `rawText=""`, `studentNameExtracted=None`, `webVerification.articleTitle=None`, `confidenceBoost=0`, `ocrAvailable=False`, `aiConfidenceScore < 90`.
- **Test tự động:** `test_document_pipeline_does_not_invent_ocr_or_web_results` (đạt)

#### TC-L1-03 — Cổng chất lượng chặn OCR, forensics và tra cứu
- **Mục tiêu:** Ảnh không đạt chất lượng dừng sớm toàn bộ pipeline.
- **Tiền điều kiện:** `inspect_quality` trả `passed=False`.
- **Bước:** Chạy pipeline; các bước sau được gắn cờ AssertionError.
- **Kết quả mong đợi:** `qualityCheck.passed=False`, `forensicCheck=None`, `ocrExtraction.available=False`, `webVerification.searched=False`, `breakdown.stoppedAt="QUALITY_GATE"`, `aiConfidenceScore=0`.
- **Test tự động:** `test_quality_gate_stops_ocr_forensics_and_web_search` (đạt)

#### TC-L1-04 — Ngưỡng chất lượng 70
- **Mục tiêu:** Ảnh tổng hợp kém (không có nét chữ) bị coi là không đạt.
- **Bước:** `QualityAndForensicsService.inspect_quality(image_bytes)`.
- **Kết quả mong đợi:** `passed=False`, `qualityScore < 70`, `qualityThreshold=70`.
- **Test tự động:** `test_quality_score_below_seventy_stops_the_document_pipeline` (đạt)

#### TC-L1-05 — Nhiều tệp đính kèm đều được xử lý
- **Mục tiêu:** Gom mọi tệp (base64 + `fileUrls`) để OCR không bỏ sót.
- **Tiền điều kiện:** 1 base64 + 1 URL; `_extract_bytes` mock trả ảnh hợp lệ.
- **Bước:** Chạy pipeline.
- **Kết quả mong đợi:** `filesProcessed=2`; `extract_and_parse_many` được gọi đúng 1 lần với danh sách 2 tệp.
- **Test tự động:** `test_multiple_attachments_are_all_processed` (đạt)

#### TC-L1-06 — Không có tệp đính kèm → lỗi rõ ràng
- **Mục tiêu:** Request không có bất kỳ tệp nào bị từ chối.
- **Bước:** `_collect_files(request)` trên request rỗng tệp.
- **Kết quả mong đợi:** Ném `ValueError` chứa "phải có".
- **Test tự động:** `test_collect_files_without_attachment_is_rejected` (đạt)

#### TC-L1-07 — Payload rỗng / Base64 sai / ảnh hỏng / PDF 0 trang
- **Mục tiêu:** Kiểm tra biên đầu vào tệp.
- **Các ca & mong đợi:**
  - `data:image/png;base64,` → `ValueError` chứa "rỗng".
  - `@@not-base64@@` → `ValueError` chứa "Base64 hợp lệ".
  - `<html>not an image</html>` → `ValueError` chứa "không phải ảnh/PDF hợp lệ".
  - PDF 0 trang → `ValueError` chứa "trang".
- **Test tự động:** `test_empty_upload_payload_is_rejected`, `test_invalid_base64_payload_is_rejected`, `test_corrupt_image_bytes_are_rejected_with_actionable_message`, `test_pdf_without_pages_is_rejected` (đạt)

### 3.2. Trùng lặp & dấu hiệu kỹ thuật

#### TC-L1-08 — Trùng tuyệt đối SHA-256 → ĐỎ
- **Tiền điều kiện:** `previousHashes` chứa SHA-256 trùng với forensics hiện tại.
- **Kết quả mong đợi:** `isDuplicate=True`, `duplicateMatchType="EXACT"`, `tier=RED`, check `duplicate` = `FAIL`.
- **Test tự động:** `test_exact_stored_hash_marks_evidence_duplicate_and_forces_red` (đạt)

#### TC-L1-09 — Trùng gần đúng pHash trong Hamming ≤ 10
- **Bước:** `_check_duplicate(forensics(phash="…003"), [{"sha256":"bbb","pHash":"…033f"}])`.
- **Kết quả mong đợi:** `True`, `match_type="SIMILAR"`, `matched_hash="bbb"`.
- **Test tự động:** `test_similar_phash_within_hamming_distance_is_flagged` (đạt)

#### TC-L1-10 — pHash sentinel `0…0` không báo trùng giả
- **Kết quả mong đợi:** `(False, None, None)` khi pHash bằng `0`×16.
- **Test tự động:** `test_unavailable_phash_is_never_reported_as_duplicate` (đạt)

#### TC-L1-11 — Không có kho đối chiếu → không kết luận trùng
- **Bước:** `_check_duplicate(forensics, None)`.
- **Kết quả mong đợi:** `(False, None, None)`.
- **Test tự động:** `test_duplicate_check_without_store_is_not_flagged` (đạt)

#### TC-L1-12 — Băm ổn định và thay đổi khi đổi bytes
- **Kết quả mong đợi:** Cùng ảnh → cùng SHA-256 & pHash; ảnh khác → SHA-256 khác.
- **Test tự động:** `test_forensic_hash_is_consistent_and_changes_when_bytes_change` (đạt)

#### TC-L1-13 — ELA bất thường không tự động từ chối
- **Tiền điều kiện:** `isTampered=True`, các mặt khác đạt.
- **Kết quả mong đợi:** `tier != RED`, check `alteration` = `REVIEW`, gợi ý chứa "không tự động kết luận giả mạo".
- **Test tự động:** `test_ela_anomaly_alone_never_auto_rejects` (đạt)

#### TC-L1-14 — Nhận diện dấu đỏ & nét chữ ký
- **Bước:** `inspect_document_marks(image_with_document_marks())`.
- **Kết quả mong đợi:** `sealStatus="PRESENT"`, `signatureStatus="PRESENT"`, evidence chứa "không xác thực".
- **Test tự động:** `test_document_mark_detector_reports_visible_red_seal_and_signature_like_strokes` (đạt)

### 3.3. OCR & trích xuất thực thể

#### TC-L1-15 — PDF tìm kiếm được: đọc đúng văn bản & MSSV
- **Kết quả mong đợi:** `rawText` chứa `102210001`, `studentCodeExtracted="102210001"`, `studentNameExtracted="Nguyen Van A"`, `codeMatched=True`, `codeMismatch=False`.
- **Test tự động:** `test_searchable_pdf_extracts_real_text_and_student_code` (đạt)

#### TC-L1-16 — Trích ngày cấp: có dấu & không dấu
- **Bước:** `_extract_date("Ngày 20 tháng 7 năm 2026")` và `_extract_date("Ngay 20 thang 7 nam 2026")`.
- **Kết quả mong đợi:** Cả hai trả `"2026-07-20"`.
- **Test tự động:** `test_date_extraction_accepts_accents_and_ocr_without_accents` (đạt)

#### TC-L1-17 — MSSV đọc được nhưng KHÁC hồ sơ
- **Kết quả mong đợi:** `studentCodeExtracted="102210001"`, `codeMatched=False`, `codeMismatch=True`.
- **Test tự động:** `test_readable_but_mismatched_student_code_is_explicit` (đạt)

#### TC-L1-18 — Không đọc được MSSV ≠ MSSV sai
- **Kết quả mong đợi:** `codeMatched=False`, `codeMismatch=False` (không quy kết sai).
- **Test tự động:** `test_unreadable_student_code_is_not_classified_as_mismatch` (đạt)

#### TC-L1-19 — Trích tên không có nhãn
- **Bước:** `_extract_name("…\nDinh Nguyen Thai Binh\n…", "Đinh Nguyễn Thái Bình")`.
- **Kết quả mong đợi:** `"Dinh Nguyen Thai Binh"`.
- **Test tự động:** `test_name_without_label_is_matched_against_declared_name` (đạt)

#### TC-L1-20 — Trích tên hoạt động từ câu văn & trường nhãn
- **Kết quả mong đợi:** câu văn xuôi → `"Chương trình Chào đón Tân sinh viên Khóa 49"`; trường `Hoạt động:` → `"Ngày hội tình nguyện mùa hè xanh"`.
- **Test tự động:** `test_activity_extraction_handles_certificate_prose_and_plain_vietnamese` (đạt)

#### TC-L1-21 — OCR gộp văn bản từ mọi tệp
- **Kết quả mong đợi:** `rawText` chứa cả `102210001` và `DUT 2026`; `studentCodeExtracted="102210001"`.
- **Test tự động:** `test_ocr_merges_text_from_all_attached_files` (đạt)

### 3.4. Đối chiếu 3 chiều & học kỳ

#### TC-L1-22 — Sai MSSV → ĐỎ + bỏ qua tra cứu công khai
- **Kết quả mong đợi:** `tier=RED`, `aiConfidenceScore=0`, `breakdown.studentCodeMismatch=True`, `breakdown.stoppedAt="IDENTITY_CHECK"`, `webVerification.searched=False`, gợi ý chứa "MSSV".
- **Test tự động:** `test_mismatched_student_code_forces_red_and_skips_web_search` (đạt)

#### TC-L1-23 — Sai tên (khớp < 70%) → ĐỎ + checklist FAIL
- **Kết quả mong đợi:** `tier=RED`, `studentNameMismatch=True`, check `identity` = `FAIL`, không chạy tra cứu.
- **Test tự động:** `test_clear_name_mismatch_forces_red_and_is_reported_in_checklist` (đạt)

#### TC-L1-24 — Ngày cấp ngoài học kỳ → ĐỎ + bỏ qua tra cứu
- **Kết quả mong đợi:** `termDateMismatch=True`, check `term` = `FAIL`, không tra cứu công khai.
- **Test tự động:** `test_issued_date_outside_term_forces_red_and_skips_public_search` (đạt)

#### TC-L1-25 — Ngày cấp trong học kỳ → PASS
- **Tiền điều kiện:** `termStartDate=2026-01-01`, `termEndDate=2026-06-30`, ngày cấp `2026-03-15`.
- **Kết quả mong đợi:** `breakdown.termDateMatched=True`, check `term` = `PASS`.
- **Test tự động:** `test_issued_date_within_term_passes_term_check` (đạt)

#### TC-L1-26 — Biên của `_issued_date_matches_term`
- **Kết quả mong đợi:** trong kỳ → `True`; ngoài kỳ → `False`; ngày không hợp lệ → `None`; thiếu ngày cấp → `None`; thiếu khoảng học kỳ → `None`.
- **Test tự động:** `test_issued_date_matches_term_unit_boundaries` (đạt)

#### TC-L1-27 — CCCD (giấy hiến máu) khớp → PASS
- **Kết quả mong đợi:** `citizenIdMismatch=False`, check `citizen_id` = `PASS`.
- **Test tự động:** `test_matched_citizen_id_passes_check` (đạt)

#### TC-L1-28 — CCCD sai → ĐỎ
- **Kết quả mong đợi:** `tier=RED`, `citizenIdMismatch=True`, check `citizen_id` = `FAIL`, gợi ý chứa "CCCD".
- **Test tự động:** `test_blood_donation_cccd_mismatch_forces_red` (đạt)

#### TC-L1-29 — Sai tên hoạt động form ↔ OCR → REVIEW, không XANH
- **Kết quả mong đợi:** check `activity` = `REVIEW`, `unresolvedAuthenticityChecks` chứa "activity", `tier != GREEN`.
- **Test tự động:** `test_activity_name_mismatch_requires_review` (đạt)

#### TC-L1-30 — Thiếu MSSV vẫn được chấm điểm (không tự quy về 0)
- **Kết quả mong đợi:** `aiConfidenceScore=65`, `tier=YELLOW_WEAK`, `studentCodeMismatch=False`.
- **Test tự động:** `test_missing_student_code_remains_a_scored_human_review_case` (đạt)

### 3.5. Phôi, xác thực & phân loại

#### TC-L1-31 — Bước xác thực chưa xong → chặn XANH (trần 89)
- **Kết quả mong đợi:** `aiConfidenceScore=89`, `tier=YELLOW_STRONG`, `authenticityReviewRequired=True`, `unresolvedAuthenticityChecks` chứa "duplicate" và "template", gợi ý chứa "không xếp XANH".
- **Test tự động:** `test_unresolved_authenticity_checks_prevent_green_classification` (đạt)

#### TC-L1-32 — Phôi rỗng → UNKNOWN → REVIEW, không XANH
- **Kết quả mong đợi:** `templateMatch.status="UNKNOWN"`, check `template` = `REVIEW`, `tier != GREEN`.
- **Test tự động:** `test_template_check_reflects_matcher_and_blocks_green` (đạt)

#### TC-L1-33 — Ánh xạ ngưỡng `_tier`
- **Kết quả mong đợi:** `100/90 → GREEN`; `89/75 → YELLOW_STRONG`; `74.9/60 → YELLOW_WEAK`; `59.9 → RED`.
- **Test tự động:** `test_tier_thresholds_mapping` (đạt)

#### TC-L1-34 — Ảnh sự kiện: tính điểm đủ thành phần
- **Tiền điều kiện:** `ANH_SU_KIEN`, `enableWebSearch=True`, quality đạt, phát hiện 2 khuôn mặt, scene khớp, EXIF khớp ngày, web boost 10.
- **Kết quả mong đợi:** `pipelineMode="EVENT_PHOTO_PIPELINE"`, `aiConfidenceScore=100`, `tier=GREEN`, `breakdown.webBoost=10`, `sceneMatched=True`.
- **Test tự động:** `test_event_photo_pipeline_scores_with_scene_and_web_boost` (đạt)

#### TC-L1-35 — Không đối chiếu danh tính khuôn mặt khi thiếu model
- **Kết quả mong đợi:** `matched=False`, `identityComparisonAvailable=False`, `confidenceBoost=0`.
- **Test tự động:** `test_event_photo_detection_never_claims_identity_match_without_model` (đạt)

#### TC-L1-36 — Cộng điểm web vào điểm tài liệu + check `source` PASS
- **Tiền điều kiện:** tra cứu trả `articleUrl` và `confidenceBoost=20`.
- **Kết quả mong đợi:** `verify_event` được gọi 1 lần, `breakdown.webBoost=20`, check `source` = `PASS`.
- **Test tự động:** `test_public_source_boost_is_recorded_and_marked_pass` (đạt)

#### TC-L1-37 — Tương tác 1↔2: sai định danh → thông báo bỏ qua tra cứu
- **Kết quả mong đợi:** `webVerification.searched=False`, `errorDetails` chứa "bỏ qua tra cứu công khai", `breakdown.stoppedAt="IDENTITY_CHECK"`.
- **Test tự động:** `test_identity_mismatch_reports_public_search_skip` (đạt)

### 3.6. Chấm tiêu chí rèn luyện (Lớp 7/8)

| Mã TC | Mục tiêu | Kết quả mong đợi | Test tự động |
| --- | --- | --- | --- |
| TC-L1-38 | Sai MSSV chặn gợi ý dương | `status=NOT_MATCHED`, `suggestedScore=0`, lý do chứa "MSSV" | `test_student_code_mismatch_prevents_positive_rubric_suggestion` |
| TC-L1-39 | Chất lượng kém → không chấm 0 | `status=UNVERIFIABLE`, `matchScore/suggestedScore=None` | `test_quality_failure_is_unverifiable_and_never_suggests_zero` |
| TC-L1-40 | Giấy tham gia không đủ cho tiêu chí cán bộ lớp | `status=NOT_MATCHED`, `matchScore=33.3`, thiếu 2 điều kiện | `test_participation_certificate_does_not_qualify_for_leadership_duty` |
| TC-L1-41 | Đủ điều kiện cán bộ lớp → gợi ý điểm | `status=MATCHED`, `matchScore=100`, `suggestedScore=4` | `test_leadership_certificate_meeting_all_conditions_suggests_rubric_score` |
| TC-L1-42 | Giấy không đọc được → không chấm 0 | `status=UNVERIFIABLE`, `suggestedScore=None` | `test_unreadable_document_is_not_automatically_scored_zero` |
| TC-L1-43 | Chứng nhận cuộc thi HR không khớp tiêu chí nghiên cứu/olympic | `status=NOT_MATCHED`, `suggestedScore=0` | `test_hr_competition_certificate_does_not_match_research_or_olympiad_criterion` |
| TC-L1-44 | Giải cấp trường + vai trò chính thống → điểm tối đa | `status=MATCHED`, `suggestedScore=3` | `test_school_level_award_and_official_role_suggest_full_score` |

---

## 4. LUỒNG 2 — Tra cứu đối chiếu nguồn công khai

#### TC-L2-01 — Ưu tiên nguồn chính thống, cộng +20
- **Tiền điều kiện:** HTML có 1 kết quả Facebook + 1 kết quả `dut.udn.vn` cùng đạt ngưỡng.
- **Kết quả mong đợi:** `articleUrl` = URL DUT, `confidenceBoost=20`.
- **Test tự động:** `test_public_source_prefers_official_domain_and_boosts_20` (đạt)

#### TC-L2-02 — Nguồn mạng xã hội cộng +10
- **Tiền điều kiện:** HTML chỉ có `facebook.com/...`.
- **Kết quả mong đợi:** `articleUrl` = URL Facebook, `confidenceBoost=10`.
- **Test tự động:** `test_social_source_result_gets_smaller_boost` (đạt)

#### TC-L2-03 — Tên hoạt động rỗng → không tra cứu
- **Kết quả mong đợi:** `searched=False`, `confidenceBoost=0`, `errorDetails` chứa "Không có tên hoạt động".
- **Test tự động:** `test_empty_activity_name_returns_error_without_search` (đạt)

#### TC-L2-04 — Truy vấn mở nguồn (không `site:`) và có tổ chức + năm
- **Dữ liệu vào:** activity `"Ngày hội tình nguyện DUT"`, year `2026`, organizer `"Đoàn Thanh niên DUT"`.
- **Kết quả mong đợi:** `queryUsed` không chứa `site:`, chứa cả tên hoạt động, tổ chức và năm.
- **Test tự động:** `test_query_has_no_site_filter_and_includes_organizer_and_year` (đạt)

#### TC-L2-05 — Không có kết quả
- **Kết quả mong đợi:** `searched=True`, `articleUrl=None`, `confidenceBoost=0`, `errorDetails=None`.
- **Test tự động:** `test_no_results_returns_searched_without_boost` (đạt)

#### TC-L2-06 — Kết quả dưới ngưỡng nhận (0.55) bị loại
- **Tiền điều kiện:** Kết quả không liên quan (vé máy bay) trên `vnexpress.net`.
- **Kết quả mong đợi:** `searched=True`, `articleUrl=None`, `confidenceBoost=0`.
- **Test tự động:** `test_result_below_accept_threshold_is_ignored` (đạt)

#### TC-L2-07 — Điểm trong khoảng [0.55, 0.70): nhận nhưng không cộng
- **Tiền điều kiện:** `_similarity` kẹp = 0.6.
- **Kết quả mong đợi:** `articleUrl` được set, `confidenceBoost=0`, `matchScore=0.6`.
- **Test tự động:** `test_match_between_accept_and_boost_gets_no_boost` (đạt)

#### TC-L2-08 — Nguồn báo chí cộng +10
- **Kết quả mong đợi:** `articleUrl` = URL `vnexpress.net`, `confidenceBoost=10`.
- **Test tự động:** `test_news_source_gets_smaller_boost` (đạt)

#### TC-L2-09 — Nguồn công khai khác cộng +10
- **Tiền điều kiện:** `ALLOW_ALL_PUBLIC_SOURCES=True`, kết quả trên `example.com`.
- **Kết quả mong đợi:** `confidenceBoost=10`.
- **Test tự động:** `test_public_source_gets_smaller_boost` (đạt)

#### TC-L2-10 — Ưu tiên official hơn news
- **Kết quả mong đợi:** chọn URL DUT, `confidenceBoost=20`.
- **Test tự động:** `test_official_source_beats_news_by_priority` (đạt)

#### TC-L2-11 — Hết thời gian chờ
- **Kết quả mong đợi:** `searched=True`, `confidenceBoost=0`, `errorDetails` chứa "hết thời gian chờ".
- **Test tự động:** `test_timeout_is_reported_as_searched_with_error` (đạt)

#### TC-L2-12 — Lỗi HTTP/kết nối
- **Kết quả mong đợi:** `searched=True`, `confidenceBoost=0`, `errorDetails` chứa "thất bại".
- **Test tự động:** `test_http_error_is_reported_as_searched_with_error` (đạt)

#### TC-L2-13 — Phân tầng nguồn `_source_tier`
- **Kết quả mong đợi:**
  - `dut.udn.vn`, `sv.udn.vn` → `official`
  - `vnexpress.net` → `news`
  - `facebook.com` → `social`
  - `example.com` → `public` khi bật `ALLOW_ALL_PUBLIC_SOURCES`, `None` khi tắt
  - `notaurl`, `http://localhost` → `None`
- **Test tự động:** `test_source_tier_classification` (đạt)

#### TC-L2-14 — Mở gói URL chuyển hướng DuckDuckGo
- **Dữ liệu vào:** `//duckduckgo.com/l/?uddg=https%3A%2F%2Fdut.udn.vn%2FNews%2F1`.
- **Kết quả mong đợi:** trả `https://dut.udn.vn/News/1`, phân tầng `official`.
- **Test tự động:** `test_redirect_url_is_unwrapped_to_official_domain` (đạt)

#### TC-L2-15 — Cắt snippet ≤ 500 ký tự
- **Kết quả mong đợi:** `snippet` không rỗng và độ dài ≤ 500.
- **Test tự động:** `test_snippet_is_truncated_to_500_chars` (đạt)

---

## 5. Ma trận truy vết (tóm tắt)

| Nhóm | Số test case | File |
| --- | --- | --- |
| Luồng 1 — pipeline tài liệu | 37 (TC-L1-01 … TC-L1-37) | `test_unified.py` + `test_flow1_flow2.py` |
| Luồng 1 — chấm tiêu chí | 7 (TC-L1-38 … TC-L1-44) | `test_unified.py` |
| Luồng 2 — tra cứu công khai | 15 (TC-L2-01 … TC-L2-15) | `test_unified.py` + `test_flow1_flow2.py` |
| **Tổng** | **59 test case** | |

> Ghi chú: Luồng 2 là luồng con được Luồng 1 kích hoạt ở Lớp 6; các ca tích hợp
> giữa hai luồng nằm ở TC-L1-36 và TC-L1-37.
