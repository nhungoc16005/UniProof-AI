# Kế hoạch hoàn thiện pipeline kiểm tra minh chứng và huấn luyện AI

**Ngày lập:** 2026-11-09  
**Phạm vi:** Luồng 1 trong `pipeline_kiem_tra_minh_chung.md`. Luồng tra cứu/đối chiếu nguồn công khai được lập thành giai đoạn kế tiếp, chỉ bắt đầu sau khi Luồng 1 qua cổng nghiệm thu.

## 1. Kết luận điều hành

Hệ thống hiện có một **prototype đi được gần hết luồng**: nhận ảnh/PDF, kiểm tra chất lượng, tính hash/ELA, OCR, trích xuất một số trường, đối chiếu một phần thông tin, tính mức gợi ý và đưa hồ sơ vào quy trình cán bộ. Nếu “75%” được hiểu là **độ phủ các khối chức năng của prototype**, mức này có thể dùng để mô tả phần khung đã được dựng.

Nhưng 75% đó **không đồng nghĩa pipeline đã chính xác 75%, sẵn sàng tự động từ chối, hay đã có model được huấn luyện**. Chưa có tập ground truth được người kiểm tra xác nhận, chưa có số đo CER/F1/false accept trên tập test độc lập, so khớp trùng lặp chưa chạy xuyên nhiều hồ sơ, nhận diện phôi chưa được triển khai, và điểm tin cậy hiện chủ yếu là heuristic. Với thang đo nghiệm thu dưới đây, ước lượng **Mức trưởng thành có bằng chứng hiện tại khoảng 40/100**. Đây là ước lượng lập kế hoạch, không phải kết quả benchmark.

**Nguyên tắc:** “100% hoàn thành” nghĩa là đạt các cổng kỹ thuật, chất lượng, an toàn, vận hành và human-in-the-loop (HITL) đã định nghĩa; không có nghĩa AI chính xác tuyệt đối hoặc tự thay cán bộ kết luận tính hợp lệ.

## 2. Cách chấm và mức hiện tại

Mỗi lớp được chấm theo bằng chứng có thể kiểm tra:

- **25% — Chạy được:** có hợp đồng vào/ra, xử lý trường hợp cơ bản, lỗi được trả rõ ràng, có test đơn vị.
- **50% — Tích hợp được:** chạy trong pipeline thật, có ca bình thường và lỗi/biên, có dữ liệu gán nhãn thử.
- **75% — Đã đo được:** đánh giá trên tập giữ lại độc lập, đạt ngưỡng chất lượng đặt trước, có log/giải thích và luồng chuyển cán bộ.
- **100% — Đủ điều kiện vận hành:** đạt ngưỡng theo từng nhóm giấy tờ, kiểm soát phiên bản/quyền riêng tư, giám sát, khôi phục/rollback, và có quy trình xử lý ngoại lệ đã được nghiệm thu.

Điểm tổng dùng trọng số theo rủi ro nghiệp vụ; điểm mỗi lớp là **mức trưởng thành hiện có**, không phải “độ chính xác AI”:

| Lớp | Trọng số | Hiện tại | Căn cứ chính |
|---|---:|---:|---|
| 0–1. Tiếp nhận và chất lượng | 15% | 65% | Có kiểm tra dung lượng/định dạng, blur, sáng, nghiêng; chưa có benchmark ngưỡng, ma trận định dạng/đa trang và kiểm tra trên tập gán nhãn. |
| 2. Trùng lặp và dấu hiệu kỹ thuật | 10% | 30% | Có SHA-256, pHash và ELA cho một tệp; chưa có so khớp chéo kho hồ sơ, ngưỡng pHash/ELA được hiệu chỉnh hay đánh giá precision/recall. |
| 3. OCR | 15% | 50% | Tesseract tiếng Việt/Anh và PDF có thể chạy; bộ 117 tệp có OCR baseline, nhưng chưa có transcript chuẩn/CER và chưa huấn luyện model. |
| 4. Trích xuất thực thể | 15% | 35% | Có regex cho một số trường và schema; chưa đo chất lượng theo trường, chưa có trích xuất có bằng chứng/vị trí và xử lý đủ biến thể. |
| 5. Đối chiếu 3 chiều | 15% | 30% | Có fuzzy match tên/MSSV một phần; chưa nối chắc chắn hồ sơ sinh viên, học kỳ, dữ liệu hoạt động và chưa có ma trận UNKNOWN/CONFLICT. |
| 6. Phôi và chỉnh sửa | 10% | 20% | Có ELA như tín hiệu; chưa có kho phôi chuẩn/so khớp bố cục. ELA chưa đủ để kết luận giả mạo. |
| 7. Điểm tin cậy | 10% | 25% | Có công thức cộng/trừ và phân tầng, nhưng chưa hiệu chuẩn xác suất, chưa đo false accept/false reject và còn trộn tín hiệu nguồn công khai. |
| 8. Phân luồng HITL | 10% | 55% | Có hàng đợi xử lý, trạng thái cần cán bộ và gợi ý điểm; chưa có nghiệm thu end-to-end về lý do, SLA, kiểm toán quyết định và policy lấy mẫu. |
| **Tổng trưởng thành có bằng chứng** | **100%** | **40%** | Tổng có trọng số. |

Mức 40% thấp hơn “75% prototype” vì chưa tính việc có code là đã chứng minh đúng. Cần giữ riêng hai số này trên dashboard dự án.

## 3. Cổng hoàn thành áp dụng cho từng lớp

Các mốc 25/50/75/100 dưới đây là lũy tiến: đạt mốc cao phải giữ toàn bộ tiêu chí của các mốc trước. Ngưỡng chất lượng là tiêu chí nghiệm thu đề xuất; nếu dữ liệu pilot cho thấy cần điều chỉnh, chủ sản phẩm và cán bộ nghiệp vụ phải duyệt thay đổi trước khi dùng production.

### Lớp 0–1 — Tiếp nhận, chuẩn hóa và chất lượng ảnh

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Chấp nhận đúng JPG/PNG/PDF; giới hạn byte; phát hiện tệp rỗng, hỏng, sai magic bytes và PDF không có trang; lỗi trả thông báo có thể hành động; có test cho mỗi lỗi. |
| 50% | Chạy thống nhất trên cả ảnh, PDF scan và PDF có text; giới hạn số trang/kích thước render; đo blur, sáng, nghiêng; có bộ ảnh “đạt/cần chụp lại” do người gán nhãn, không chỉ dựa vào ngưỡng mặc định. |
| 75% | Trên tập test theo loại giấy/thiết bị: recall phát hiện ảnh không đọc được ≥95%, false reject ảnh đọc được ≤5%; báo cáo theo từng nhóm ảnh và kiểm tra trên ảnh chưa từng xuất hiện trong tập hiệu chỉnh. |
| 100% | Có policy nhiều tệp/trang, chống quá tải tài nguyên, timeout, log mã lỗi, theo dõi phân bố chất lượng sau phát hành và quy trình thay ngưỡng có version/rollback. Không dùng kiểm tra chất lượng để kết luận tính xác thực. |

### Lớp 2 — Trùng lặp và chỉ báo kỹ thuật

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | SHA-256 và pHash được tạo nhất quán; lỗi đọc ảnh không bị biến thành “không trùng”; có test hash giống/khác và ảnh đổi kích thước/nén. |
| 50% | Lưu chỉ số để tìm kiếm chéo các minh chứng trong phạm vi được phép; xác định duplicate group; tách “trùng chính xác”, “gần giống” và “chưa biết”; ELA chỉ là cảnh báo. |
| 75% | Có tập cặp trùng/không trùng được người duyệt xác nhận; hiệu chỉnh ngưỡng trên tập validation; đạt precision ≥95% cho cảnh báo trùng chính xác và báo cáo recall/false positives riêng cho pHash. |
| 100% | Chạy idempotent trên kho, có index/retention/access control, lưu nguồn và mức tương đồng, cảnh báo cho cán bộ thay vì tự kết luận gian lận; định kỳ đánh giá drift và lấy mẫu false positive/negative. |

### Lớp 3 — OCR tiếng Việt/Anh

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | OCR chạy offline/local, trả text và trạng thái `available/error`; có test ảnh, PDF scan, PDF có text, ảnh không đọc được và OCR không cài. Lưu phiên bản engine/ngôn ngữ/cấu hình. |
| 50% | Có transcript chuẩn cho pilot được con người sửa; benchmark Tesseract hiện tại và tối thiểu một OCR engine pretrained khác trên cùng tài liệu; tính CER/WER theo cách chuẩn hóa thống nhất và theo nhóm loại giấy. |
| 75% | Trên tập test giữ lại theo tài liệu/phôi, không chia ngẫu nhiên các bản gần trùng sang hai tập: CER toàn văn ≤10%, CER trường quan trọng (MSSV/mã quyết định/ngày) ≤5%, và báo cáo riêng chữ có dấu, số, con dấu, ảnh mờ. |
| 100% | Chỉ fine-tune khi benchmark cho thấy có lợi và đủ ground truth; model phát hành phải cải thiện CER ≥20% tương đối so với baseline trên tập test, không làm xấu nhóm trường quan trọng, có artifact/version, tái lập được và rollback về OCR baseline. Nếu không đạt, giữ OCR pretrained và không huấn luyện. |

### Lớp 4 — Trích xuất thực thể có cấu trúc

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Schema versioned cho từng loại minh chứng; field thiếu là `null/unknown`, không tự bịa; có test format ngày, MSSV, đơn vị, hoạt động và giấy hiến máu. |
| 50% | Trả giá trị, confidence, trang/dòng/bounding box hoặc đoạn OCR làm bằng chứng; validate kiểu dữ liệu và quan hệ; lỗi schema chuyển review. |
| 75% | Trên tập gán nhãn độc lập: exact-match ≥95% cho trường định danh/số, micro-F1 ≥0.90 cho các trường còn lại; báo precision/recall từng field và từng loại giấy; không đưa trường không đọc được vào “đã xác minh”. |
| 100% | Version hóa schema và evaluator; theo dõi confidence/unknown, kiểm thử regression khi đổi OCR/model; mọi sửa tay của cán bộ được lưu audit và chỉ nhập lại dataset sau quy trình duyệt nhãn. |

### Lớp 5 — Đối chiếu Form ↔ OCR ↔ hồ sơ sinh viên/kỳ học

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Có chuẩn hóa tên/MSSV/ngày và test trường hợp chính xác, sai, thiếu, lỗi OCR; kết quả tách rõ `MATCH`, `MISMATCH`, `UNKNOWN`. |
| 50% | Nối đúng hồ sơ sinh viên, loại giấy/tiêu chí và term đang xét; quy định ưu tiên MSSV so với tên, ngày tham gia so với ngày cấp; dữ liệu thiếu hoặc mâu thuẫn luôn chuyển cán bộ. |
| 75% | Đánh giá trên tập đối chiếu đã gán nhãn; false accept định danh ≤0.5%, precision của mismatch ≥99%, báo cáo false reject theo lỗi dấu/tên viết tắt/ngày; test term ranh giới và dữ liệu nhiều kỳ. |
| 100% | Giao dịch đọc dữ liệu đúng snapshot/version, có audit; không tự từ chối khi OCR confidence thấp hoặc dữ liệu hồ sơ không đồng bộ; cán bộ có thể xem bằng chứng và ghi đè kèm lý do. |

### Lớp 6 — Nhận diện phôi và dấu hiệu chỉnh sửa

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Tài liệu ghi rõ ELA/pHash chỉ là tín hiệu; không coi điểm ELA cao là bằng chứng kết luận giả; có test để bảo đảm không phát sinh tự động từ chối chỉ vì ELA. |
| 50% | Có bộ phôi hợp lệ được cấp quyền sử dụng, metadata nguồn/ngày hiệu lực; xử lý scan, photocopy, ảnh chụp, thay đổi hợp lệ; nhận diện loại phôi trả kèm confidence và trường hợp `UNKNOWN`. |
| 75% | Có dữ liệu thật đã duyệt gồm phôi/phiên bản khác nhau và ảnh bình thường; đánh giá precision/recall cho cảnh báo lệch phôi/chỉnh sửa theo từng loại giấy; mọi cảnh báo cao được kiểm tra bởi người. |
| 100% | Chỉ báo có provenance, version, giải thích vùng/tín hiệu; rule chống giả mạo được duyệt nghiệp vụ; không phát sinh kết luận pháp lý tự động; có quy trình cập nhật phôi và theo dõi false alerts. |

### Lớp 7 — Điểm tin cậy và gợi ý rubric

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Tách `criterionFit` (độ khớp điều kiện rubric), `ocrConfidence`, `authenticitySignals` và `identityMatch`; không gọi một tỷ lệ khớp từ khóa là xác suất thật. |
| 50% | Mỗi tiêu chí có điều kiện, mức điểm, lý do đạt/thiếu/không thể kiểm tra; rule cấu hình theo phiên bản rubric; `UNVERIFIABLE` không bị ép thành 0. |
| 75% | Hiệu chuẩn trên quyết định cán bộ; theo dõi precision/recall và calibration/ECE/Brier nếu hiển thị xác suất; đặt ngưỡng theo chi phí false accept/false reject; không bật tự duyệt nếu chưa đạt ngưỡng nghiệp vụ. |
| 100% | Model/rule version, feature/config version và rubric version được lưu trong mỗi lần chạy; có giải thích, audit và rollback; chỉ “gợi ý điểm”. Điểm chính thức do người có thẩm quyền quyết định theo policy đã thống nhất. |

### Lớp 8 — Phân luồng HITL và vận hành

| Mốc | Điều kiện nghiệm thu |
|---|---|
| 25% | Job có trạng thái thành công/thất bại/cần người xem; thất bại không bị báo thành thành công; có retry giới hạn và trạng thái cuối rõ ràng. |
| 50% | Cán bộ xem được file gốc, OCR, yêu cầu rubric, lý do từng tín hiệu; quyết định accept/reject/escalate và điểm chính thức là thao tác riêng với AI. |
| 75% | E2E test submit → job → AI → hàng đợi → cán bộ quyết định → audit; đo thời gian xử lý, tỉ lệ timeout/retry, tồn đọng; có ngẫu nhiên lấy mẫu hồ sơ “xanh” để kiểm toán. |
| 100% | Có phân quyền, audit không thể sửa âm thầm, SLA/escalation, dashboard, cảnh báo, phục hồi job, retention và quy trình incident; cán bộ có thể dừng phiên bản AI và quay về quy trình thủ công. |

## 4. Dataset và chính sách gán nhãn

Dataset local hiện có **117 tệp**, OCR khả dụng trên 117, 110 đạt và 7 cần xem lại theo heuristic chất lượng; có 108 SHA-256 duy nhất (9 tệp trùng theo SHA-256 so với tổng số file). `annotations.csv` hiện là mẫu trống, không phải ground truth; `manifest.jsonl` chỉ chứa dự đoán OCR đã che theo heuristic. Một pilot **20 tệp** đã được chọn có chủ đích (ảnh/PDF, trạng thái chất lượng và một cặp trùng) để người xác nhận kiểm tra quy trình gán nhãn. Vì vậy **chưa có dữ liệu đủ điều kiện để huấn luyện supervised**.

### Quy trình gán nhãn

1. Cán bộ được phân quyền mở file gốc tại máy/kho nội bộ; không đưa ảnh hoặc thông tin sinh viên lên dịch vụ/model bên ngoài khi chưa được phê duyệt.
2. Gán transcript đúng nguyên văn theo dòng; giữ tiếng Việt có dấu, số, ngày, ký hiệu, đoạn không đọc được và vị trí/trang. Không sửa transcript cho “đẹp”.
3. Gán nhãn chất lượng, loại minh chứng/phôi, loại trùng, trường thực thể, người/kỳ/hoạt động, điều kiện rubric met/missing/unverifiable, và quyết định cán bộ.
4. Hai người gán độc lập các trường định danh và nhãn xác thực; bất đồng được adjudicate. Lưu nguồn nhãn và người duyệt, không chỉ lưu nhãn cuối.
5. Gom exact duplicate và near-duplicate vào cùng một `group_id` trước khi chia tập. Chia theo nhóm/phôi/nguồn, không chia theo file ngẫu nhiên.
6. Tập test khóa quyền chỉnh sửa, không dùng để chọn threshold hay fine-tune. Chỉ mở lại khi lập phiên bản đánh giá mới.

### Mốc dữ liệu

- **Pilot quy trình:** gán nhãn 20 tài liệu trong `pilot_annotations.csv`; dùng để kiểm tra hướng dẫn/schema, đo thời gian gán nhãn và tìm trường hợp khó. Không xem 20 mẫu này là đại diện thống kê hoặc tập test chính thức.
- **Pilot OCR mở rộng:** sau khi chỉnh xong quy trình, gán nhãn toàn bộ 117 tài liệu; đánh giá baseline ban đầu theo loại giấy/chất lượng nhưng không tuyên bố đại diện toàn bộ minh chứng.
- **Fine-tune OCR gate:** tối thiểu 500 tài liệu khác nhau sau gom nhóm và 5.000 dòng/crop transcript đã xác nhận; ít nhất 100 tài liệu/1.000 dòng để test độc lập. Nếu không đạt số lượng hoặc loại phôi quá lệch, chỉ benchmark pretrained OCR và tiếp tục thu thập.
- **Extraction/matching gate:** tối thiểu 300 ví dụ đã adjudicate cho mỗi loại trường/nhóm tiêu chí quan trọng, có đủ positive, negative và unknown; nếu một lớp hiếm chưa đủ mẫu thì lớp đó chỉ chạy shadow/HITL.
- Số lượng trên là mốc khởi đầu; báo cáo thêm khoảng tin cậy và phân bố. Không bù thiếu dữ liệu hiếm bằng cách nhân bản hoặc đưa bản sao vào train/validation.

## 5. Quyết định và quy trình huấn luyện model

### Thứ tự

1. **Đóng băng baseline:** Tesseract hiện tại, cấu hình ngôn ngữ, preprocessing và commit/config version. Chạy trên tập test khóa; lưu OCR output và CER/WER.
2. **Benchmark trước khi huấn luyện:** chạy tối thiểu một engine OCR pretrained khác trên đúng tập/metric. So sánh CER toàn văn, CER số/định danh, tốc độ, RAM và khả năng chạy local. Chỉ chọn fine-tune khi có lỗi lặp lại mà dữ liệu gán nhãn đủ sửa.
3. **Xác định target học:** OCR nhận dạng ký tự cần image/crop + transcription (và annotation vùng nếu detector cần); trích xuất thực thể cần nhãn field/value/evidence; đối chiếu rubric cần nhãn quyết định/điều kiện. Không dùng một loại nhãn thay cho loại còn lại.
4. **Huấn luyện có kiểm soát:** fine-tune từ pretrained model phù hợp tiếng Việt, không train từ đầu; cấu hình, seed, data manifest, dependency và model artifact đều versioned. Không dùng `ocr_redacted` baseline làm nhãn chuẩn.
5. **Đánh giá mù:** chỉ dùng validation để chọn checkpoint/threshold; chạy một lần trên test khóa; so sánh với baseline cùng tập. Báo kết quả tổng và theo loại giấy, scan/ảnh chụp, chất lượng, trường định danh.
6. **Go/no-go:** chỉ phát hành khi đạt cổng của lớp tương ứng, không suy giảm nhóm quan trọng, privacy/security được rà soát và cán bộ nghiệp vụ ký duyệt. Nếu không đạt, giữ baseline; không triển khai chỉ vì model “đã train xong”.
7. **Shadow rollout:** chạy song song với OCR hiện tại, không đổi quyết định chính thức; cán bộ duyệt mẫu; sau đó mới bật đề xuất cho nhóm pilot. Luôn giữ model/rule cũ để rollback.

### Những việc không làm

- Không huấn luyện OCR từ 117 dự đoán OCR của chính nó.
- Không fine-tune LLM trên 117 tài liệu như một cách “làm thông minh hơn” khi chưa có nhãn chuẩn.
- Không coi ELA, kết quả tìm kiếm web, OCR confidence hoặc criterion-fit đơn lẻ là bằng chứng xác thực.
- Không tự động từ chối hồ sơ `UNKNOWN`, OCR kém, thiếu dữ liệu, model không khả dụng hoặc nguồn tra cứu lỗi.

## 6. Lộ trình thực hiện và cổng nghiệm thu

Ước lượng lịch dưới đây giả định một người phụ trách kỹ thuật, một cán bộ nghiệp vụ gán nhãn bán thời gian, và quyền truy cập dữ liệu hợp lệ. Thời gian gán nhãn có thể kéo dài nếu cần adjudicate/ẩn danh.

| Giai đoạn | Thời lượng dự kiến | Công việc và đầu ra | Cổng qua |
|---|---:|---|---|
| A. Đóng phạm vi và an toàn dữ liệu | 2–3 ngày | Chốt loại giấy/tiêu chí ưu tiên, chủ sở hữu dữ liệu, quyền truy cập, retention, schema nhãn, định nghĩa lỗi nghiêm trọng. | Không xử lý dữ liệu cá nhân ngoài môi trường đã duyệt; nhãn/version được cán bộ nghiệp vụ duyệt. |
| B. Hoàn thiện bộ đánh giá pilot | 1–2 tuần | Gán nhãn độc lập 117 tài liệu; adjudicate; group duplicate/near-duplicate; tạo train/validation/test khóa; chạy baseline CER/F1 và chất lượng. | Báo cáo baseline tái lập; test không rò rỉ bản trùng; thiếu mẫu được ghi rõ. |
| C. Hoàn thiện lớp 0–2 | 1–2 tuần | Cứng hóa PDF/ảnh, nhiều tệp/trang, kiểm tra chất lượng; chỉ số trùng chéo; hiệu chỉnh pHash; bỏ quyết định gian lận dựa riêng ELA. | Qua mốc 75% từng lớp theo bảng và integration tests. |
| D. OCR và trích xuất | 2–4 tuần | So sánh OCR pretrained; mở rộng annotation dòng/crop nếu huấn luyện có lợi; cải thiện schema/evidence; fine-tune thử nghiệm nếu đủ dữ liệu. | OCR đạt CER gate; extraction đạt field gate; không suy giảm test khóa. Nếu thiếu nhãn: dừng fine-tune, tiếp tục baseline. |
| E. Đối chiếu và rubric | 1–3 tuần | Nối identity/student/term, ba trạng thái match; bổ sung điều kiện rubric, điểm gợi ý, lý do và trạng thái không thể kiểm tra. | False-accept gate được kiểm tra; mọi unknown/conflict chuyển cán bộ; điểm chính thức vẫn do cán bộ. |
| F. Phôi, điểm và HITL | 2–3 tuần | Thu thập phôi được cấp quyền; chỉ báo chỉnh sửa; hiệu chuẩn confidence/routing; audit và UI cán bộ; chạy E2E. | Tất cả lớp 0–8 đạt 100% checklist vận hành đã duyệt; shadow run không phát sinh lỗi nghiêm trọng. |
| G. Pilot Luồng 1 | 2 tuần trở lên | Chạy shadow/pilot theo loại giấy; lấy mẫu kiểm toán xanh; đo thời gian, overrides, false accept/reject, drift. | Cán bộ nghiệp vụ ký duyệt báo cáo; có rollback, xử lý sự cố và quyết định mở rộng. |
| H. Luồng 2 — tra cứu/đối chiếu | 2–4 tuần sau G | Tách provider tra cứu; ưu tiên nguồn chính thức; đối chiếu tên sự kiện/đơn vị/ngày; lưu URL, thời điểm, trích dẫn và trạng thái không có kết quả. | Nguồn thật được allowlist; test timeout/no-result/nguồn giả; kết quả tra cứu không tự biến thành xác thực. |

Các giai đoạn có thể chồng lấn ở phần chuẩn bị, nhưng không bỏ qua cổng dữ liệu, test độc lập hoặc human review để rút ngắn lịch. “Hoàn thiện 100%” của Luồng 1 phải đạt trước khi cho kết quả Luồng 2 ảnh hưởng đến điểm hoặc routing.

## 7. Cổng nghiệm thu toàn hệ thống 100%

Chỉ công bố Luồng 1 hoàn thành 100% khi tất cả mục sau được chứng minh bằng báo cáo/test:

- [ ] Tám lớp có chủ sở hữu, hợp đồng vào/ra, trạng thái `UNKNOWN/ERROR` và test phù hợp.
- [ ] Bộ test đóng băng, gán nhãn có người duyệt, không rò rỉ exact/near duplicate giữa các tập.
- [ ] Đạt metric từng lớp; báo cáo false accept/false reject và khoảng tin cậy, không chỉ accuracy trung bình.
- [ ] Không có đường đi tự động phê duyệt/từ chối khi thiếu dữ liệu, lỗi OCR, lỗi model, xung đột thông tin hoặc nguồn ngoài không khả dụng.
- [ ] Mỗi kết quả có model/rule/config/rubric version, input hash, evidence và thời gian xử lý; dữ liệu nhạy cảm không bị ghi vào log không cần thiết.
- [ ] Cán bộ xem được tài liệu gốc và bằng chứng; quyết định cuối, override, lý do và audit được lưu.
- [ ] Có kiểm thử bảo mật/quyền riêng tư, tải/timeout, retry/recovery, backup và rollback phiên bản AI.
- [ ] Pilot shadow được cán bộ nghiệp vụ chấp thuận và có ngưỡng dừng/khôi phục.
- [ ] Tra cứu công khai chạy độc lập, nguồn được kiểm soát và không dùng việc “không tìm thấy” làm bằng chứng hồ sơ giả.

## 8. Ưu tiên bắt đầu

1. Hoàn tất pilot 20 mẫu và chỉnh schema/hướng dẫn; giữ ảnh gốc và `pilot_source_map.csv` trong phạm vi local được phép.
2. Sau khi xác nhận quy trình, mở rộng annotation lên 117 tài liệu; bổ sung transcript theo dòng/crop và nhóm duplicate/near-duplicate.
3. Thu thập thêm dữ liệu độc lập đến khi đủ cổng benchmark/huấn luyện; khóa tập test trước khi fine-tune.
4. Đo baseline Tesseract bằng CER và trích xuất bằng exact-match/F1; đây là bước xác định có nên train hay không.
5. Trong khi gán nhãn, ưu tiên sửa lớp 5 (đối chiếu người/kỳ) và lớp 8 (giải thích/HITL), vì đây là điểm có rủi ro quyết định nghiệp vụ cao.
6. Chỉ chuyển sang tra cứu/đối chiếu nguồn sau khi Luồng 1 qua shadow pilot và có phê duyệt.

## 9. Bằng chứng hiện trạng

- [Tài liệu pipeline hiện hành](./pipeline_kiem_tra_minh_chung.md)
- [Orchestrator hiện tại](../apps/ai-service/src/pipeline_orchestrator.py)
- [OCR và trích xuất hiện tại](../apps/ai-service/src/ocr_extractor.py)
- [Quality/forensics hiện tại](../apps/ai-service/src/quality_forensics.py)
- [Đánh giá điều kiện rubric hiện tại](../apps/ai-service/src/criterion_evaluator.py)
- [Xử lý HITL phía backend](../apps/backend/src/evidence/evidence-processing.worker.ts)
- [Manifest OCR baseline](./Minh%20ch%E1%BB%A9ng%20L%E1%BB%8Dc/dataset-local/manifest.jsonl)
- [Mẫu annotation hiện tại](./Minh%20ch%E1%BB%A9ng%20L%E1%BB%8Dc/dataset-local/annotations.csv)
- [Tóm tắt dataset hiện tại](./Minh%20ch%E1%BB%A9ng%20L%E1%BB%8Dc/dataset-local/summary.json)
