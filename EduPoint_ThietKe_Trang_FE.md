# EduPoint — Thiết kế chi tiết các trang giao diện (FE) theo vai trò

> **Phiên bản:** 1.0 · **Ngày:** 21/09/2026 · **Stack FE:** React / Next.js
> **Đi kèm:** `EduPoint_API_BE.md`. Mỗi trang có dòng **"API sử dụng"** ghi mã endpoint (ví dụ `EVD-06`), tra chi tiết trong file API.

---

## Mục lục

1. Phạm vi và cách đọc tài liệu
2. **Tổng hợp chức năng theo 3 role**
3. Nguyên tắc thiết kế UI/UX xuyên suốt
4. Design system rút gọn (trạng thái, mức xác minh, confidence, điểm)
5. Khung ứng dụng và điều hướng
6. Trang dùng chung (C01–C07)
7. **Sinh viên** (S01–S09)
8. **Cán bộ / Officer** (O01–O10)
9. **Quản trị viên / Admin** (A01–A11)
10. Thư viện component dùng chung
11. Các luồng UX chính
12. Ưu tiên triển khai (MVP / Advanced)
13. Phụ lục: văn bản chuẩn (copy) cho các tình huống nhạy cảm

---

## 1. Phạm vi và cách đọc tài liệu

**Ba role duy nhất:**

| Role | Tương ứng trong tài liệu nghiệp vụ | Ghi chú |
|---|---|---|
| **Student** (Sinh viên) | Sinh viên | Mobile-first (chụp và tải minh chứng bằng điện thoại) |
| **Officer** (Cán bộ) | Cán bộ / Khoa | Desktop-first (màn hình đối chiếu ảnh và dữ liệu song song) |
| **Administrator** (Quản trị viên) | Quản trị viên **+ Người phụ trách quy định** | Tài liệu nghiệp vụ tách "người phụ trách quy định" thành nhóm riêng; do chỉ có 3 role nên các chức năng quản lý **tiêu chí, rule, tài liệu quy chế (Knowledge Base)** được gộp vào Admin. |

**Mã trang:** `C` = dùng chung (C07 là trang công khai cho đơn vị tổ chức bên ngoài, không thuộc 3 role) · `S` = Student · `O` = Officer · `A` = Admin. Mỗi trang gắn nhãn ưu tiên **[MVP]** hoặc **[ADV]** (theo mục 39–40 tài liệu đề tài).

**Mỗi trang gồm:** Route · Mục đích · Bố cục và thành phần · Hành động · Trạng thái đặc biệt (rỗng/lỗi/đang tải) · API sử dụng.

---

## 2. Tổng hợp chức năng theo 3 role

Ký hiệu: **✔** đầy đủ · **◐** một phần / chỉ xem / bản rút gọn · **—** không có.

| Nhóm | Chức năng | Student | Officer | Admin | Trang |
|---|---|:-:|:-:|:-:|---|
| **Tài khoản** | Đăng nhập / đăng xuất, phân quyền theo role | ✔ | ✔ | ✔ | C01 |
| | Quên / đặt lại mật khẩu, đổi mật khẩu, hồ sơ cá nhân | ✔ | ✔ | ✔ | C02, C03 |
| | Trung tâm thông báo | ✔ | ✔ | ✔ | C05 |
| **Nộp và theo dõi minh chứng** | Khai báo hoạt động (nội bộ / ngoài trường / chưa chắc) | ✔ | — | — | S03 |
| | Upload minh chứng ảnh/PDF, nhiều file, lưu nháp | ✔ | — | — | S03 |
| | Theo dõi tiến trình xử lý theo thời gian thực | ✔ | ✔ | ◐ | S05, O03 |
| | Xem và xác nhận/sửa các trường OCR | ◐ | ✔ | — | S05, O03 |
| | Xem kết quả xác minh (2 câu hỏi tách biệt) | ◐ | ✔ | ◐ | S05, O03 |
| | Evidence Gap ("còn thiếu gì?") | ✔ | ✔ | ◐ | S05, O03 |
| | Xem điểm AI đề xuất + giải thích | ◐ | ✔ | ◐ | S05, O03 |
| | Bổ sung minh chứng theo yêu cầu | ✔ | — | — | S06 |
| | Rút hồ sơ | ✔ | — | — | S04, S05 |
| | Gửi khiếu nại | ✔ | — | — | S07 |
| **Xét duyệt** | Hàng đợi xử lý theo ưu tiên | — | ✔ | ◐ | O02 |
| | Duyệt / Từ chối / Sửa điểm / Yêu cầu bổ sung (lý do bắt buộc) | — | ✔ | ◐ | O03 |
| | Duyệt hàng loạt hồ sơ fast-track | — | ✔ | — | O02 |
| | Xác minh hoạt động ngoài trường (URL/QR, đơn vị tổ chức, registry, nguồn công khai) | — | ✔ | ◐ | O03, O04 |
| | Đánh dấu verified/unverified thủ công | — | ✔ | — | O04 |
| | Chạy lại OCR / xác minh / AI / toàn pipeline | — | ✔ | ✔ | O03 |
| | Xử lý khiếu nại | — | ✔ | ✔ | O07 |
| **Điểm và tra cứu** | Dashboard điểm cá nhân | ✔ | — | — | S01 |
| | Bảng điểm theo kỳ + truy vết "Vì sao được X điểm?" | ✔ | ◐ | ◐ | S09, O09 |
| | "What can I claim?" | ✔ | ◐ | — | S08, O09 |
| | Tra cứu sinh viên | — | ✔ | ✔ | O09 |
| **Quy chế** | Xem tiêu chí và điều kiện | ✔ | ✔ | ✔ | S02, O08, A04 |
| | Hỏi đáp quy chế (RAG có trích dẫn) | ✔ | ✔ | ✔ | C04 |
| **Dữ liệu nghiệp vụ** | Quản lý hoạt động nội bộ + điểm danh | — | ✔ | ✔ | O06 |
| | Quản lý hoạt động ngoài trường + đơn vị tổ chức | — | ✔ | ◐ | O05 |
| | Quản lý người dùng, phân quyền, phạm vi Officer | — | — | ✔ | A02 |
| | Khoa / Lớp / Kỳ đánh giá (chốt / mở lại kỳ) | — | — | ✔ | A03 |
| | Quản lý tiêu chí | — | ◐ | ✔ | A04, O08 |
| | Quản lý Rule Engine (soạn, kiểm tra, chạy thử, publish, phiên bản) | — | ◐ | ✔ | A05, O08 |
| | Quản lý Knowledge Base cho RAG | — | — | ✔ | A06 |
| | Cấu hình ngưỡng AI | — | — | ✔ | A07 |
| **Báo cáo và giám sát** | Báo cáo, thống kê, xuất file | — | ✔ | ✔ | O10, A01 |
| | Ground Truth Dataset | — | — | ✔ | A08 |
| | AI Evaluation + Ablation + Selective Prediction | — | — | ✔ | A09 |
| | Audit Log toàn hệ thống | — | ◐ | ✔ | A10 (Officer chỉ thấy lịch sử của từng hồ sơ ở O03) |
| | Giám sát job và sức khỏe hệ thống | — | — | ✔ | A11 |

**Số trang theo role:** Student **9** · Officer **10** · Admin **11** · Dùng chung **7** (tổng **37 trang**, trong đó nhiều trang chỉ là tab/drawer của trang cha).

### 2.1 Tóm tắt "mỗi role làm gì"

**Student — "Nộp, theo dõi, bổ sung, hiểu vì sao được điểm."**
Nộp minh chứng qua wizard 3 bước, xem tiến trình xử lý trực tiếp, xem hệ thống đọc được gì (và sửa nếu đọc sai), biết chính xác còn thiếu gì để hồ sơ được xác minh (Evidence Gap), xem điểm đề xuất kèm lý do, bổ sung theo yêu cầu, khiếu nại, và xem còn có thể tích lũy thêm điểm ở đâu.

**Officer — "Xét đúng chỗ cần người, không mất thời gian ở chỗ máy đã đủ căn cứ."**
Làm việc trên hàng đợi đã sắp theo mức cần chú ý; mở từng hồ sơ trong màn hình đối chiếu ảnh gốc ↔ OCR ↔ xác minh ↔ đề xuất AI ↔ kết quả Rule Engine; ra quyết định có lý do bắt buộc; tự xác minh hoạt động ngoài trường và ghi nhận nguồn; quản lý hoạt động nội bộ và điểm danh; xử lý khiếu nại; xem báo cáo.

**Admin — "Giữ hệ thống đúng quy chế, đo được và kiểm toán được."**
Quản lý người dùng và phân quyền; cấu hình kỳ, tiêu chí, **Rule Engine** (version, chạy thử, publish); quản lý **Knowledge Base**; chỉnh ngưỡng AI; xây **Ground Truth**, chạy thí nghiệm/ablation và theo dõi chất lượng AI; kiểm tra **Audit Log** và sức khỏe hệ thống.

---

## 3. Nguyên tắc thiết kế UI/UX xuyên suốt

| # | Nguyên tắc | Cách thể hiện trên giao diện |
|---|---|---|
| 1 | **"Không đủ bằng chứng ≠ bằng chứng giả"** | Không có nhãn "Giả/Fake" tự động ở bất kỳ đâu. Certificate-only hiển thị *"Nhất quán nhưng chưa xác minh độc lập"*, màu trung tính (indigo), **không dùng đỏ**. Chỉ `REJECTED` (do người quyết định) và `INVALID` (mâu thuẫn rõ ràng) mới dùng đỏ. |
| 2 | **AI chỉ đề xuất** | Mọi số điểm do AI/Rule Engine tạo ra đều nằm trong khung **nét đứt + biểu tượng ✦** kèm nhãn *"Đề xuất — chưa phải điểm chính thức"*. Điểm chính thức chỉ xuất hiện trong khung **nét liền + ✔ + tên người duyệt**. |
| 3 | **Hai câu hỏi xác minh luôn tách biệt** | Luôn hiển thị hai chip riêng: *"Hoạt động có tồn tại?"* và *"Sinh viên có tham gia?"*. Không gộp thành một huy hiệu duy nhất. |
| 4 | **Mọi thứ đều giải thích được** | Mỗi đề xuất có nút "Vì sao?" mở lý do + trích dẫn Điều/Khoản (drawer trích dẫn). Điểm cuối có "Vì sao được X điểm?" (truy vết). |
| 5 | **Cho thấy độ chắc chắn** | Officer thấy confidence dạng số + thanh; trường `low_confidence` có viền vàng. Sinh viên chỉ thấy mức định tính (Cao/Trung bình/Thấp). |
| 6 | **Lý do là bắt buộc** | Reject/Sửa điểm/Yêu cầu bổ sung không cho gửi nếu thiếu lý do. Reject chỉ cho chọn "căn cứ" cụ thể, không có lựa chọn kiểu "không có trong dữ liệu". |
| 7 | **Chỉ cho biết thiếu gì, không chỉ nói "không hợp lệ"** | Evidence Gap là thành phần hạng nhất, có nút hành động "Bổ sung ngay" cạnh từng mục thiếu. |
| 8 | **Tiến trình bất đồng bộ phải nhìn thấy** | Stepper 7 bước cập nhật trực tiếp (SSE, dự phòng polling 3 giây); không bao giờ để sinh viên nhìn một spinner vô định. |
| 9 | **Không lộ tín hiệu rủi ro cho sinh viên** | `risk_signals` (font, logo, metadata…) chỉ Officer thấy, luôn kèm nhãn *"chỉ là cảnh báo rủi ro, không phải kết luận"*. |
| 10 | **Responsive theo vai trò** | Student: mobile-first, thao tác một tay, chụp ảnh trực tiếp. Officer/Admin: desktop-first, bố cục đa cột, phím tắt. |
| 11 | **Không chỉ dùng màu để truyền đạt** | Mọi trạng thái có icon + chữ; đạt tương phản WCAG AA. |
| 12 | **Định dạng Việt Nam** | Ngày `dd/MM/yyyy`, múi giờ `Asia/Ho_Chi_Minh`, số thập phân dùng dấu phẩy, nhãn tiếng Việt lấy từ `REF-05`. |

---

## 4. Design system rút gọn

### 4.1 Huy hiệu trạng thái hồ sơ (`display_status`)

| `display_status` | Màu | Icon | Nhãn tiếng Việt | Ghi chú |
|---|---|---|---|---|
| `DRAFT` | Xám | ✎ | Bản nháp | Có nút "Tiếp tục" |
| `PROCESSING` | Xanh dương | ⟳ (quay) | Đang xử lý | Kèm stepper |
| `VERIFIED` | Xanh lá | 🛡✔ | Đã xác minh | Có căn cứ độc lập đủ mạnh |
| `PLAUSIBLE` | Xanh ngọc | ✔○ | Có thể chấp nhận | Nhất quán, chưa xác minh đầy đủ |
| `NEEDS_SUPPLEMENT` | Vàng cam | 📎+ | Cần bổ sung | Có deadline, CTA "Bổ sung" |
| `NEEDS_HUMAN_REVIEW` | Indigo | 👤🔍 | Cần cán bộ xem xét | **Không phải cảnh báo xấu** |
| `INVALID` | Đỏ nhạt | ⊗ | Phát hiện mâu thuẫn — chờ cán bộ xác nhận | Dòng phụ giải thích mâu thuẫn |
| `APPROVED` | Xanh lá đặc | ✔ | Đã được duyệt | Hiện điểm chính thức |
| `REJECTED` | Đỏ đặc | ✖ | Bị từ chối | Hiện lý do và căn cứ |
| `APPEALING` | Tím | ⚖ | Đang khiếu nại | |
| `WITHDRAWN` | Xám gạch | ⌫ | Đã rút | |
| *(chỉ Officer)* `SUSPICIOUS` | Cam | ⚠ | Đáng ngờ | Sinh viên không thấy nhãn này |

### 4.2 Thang mức xác minh

- **Ngoài trường:** thang 5 nấc nằm ngang `L1 ▰▰▰▰▰ … L5 ▰▱▱▱▱` (L1 cao nhất). Nhãn: L1 Chính thức · L2 Xác nhận đơn vị tổ chức · L3 Danh sách tham gia · L4 Nguồn công khai · L5 Chỉ có chứng nhận. Nấc đạt được được tô đậm, các nấc cao hơn chưa đạt ở dạng mờ.
- **Nội bộ:** 3 chốt ngang `I1 Danh tính → I2 Hoạt động → I3 Điểm danh`, mỗi chốt ✔ / ⚠ / ✖.
- **Sinh viên** chỉ thấy tên mức bằng ngôn ngữ thường ("Mức xác minh: Thấp/Trung bình/Cao") và Evidence Gap, không thấy nhãn L1–L5 kỹ thuật (Officer thấy cả hai).

### 4.3 Confidence

| Giá trị | Màu | Hiển thị Officer | Hiển thị Student |
|---|---|---|---|
| ≥ 0,85 | Xanh | `0,91 ▮▮▮▮▮` | Cao |
| 0,60 – 0,85 | Vàng | `0,71 ▮▮▮▯▯` + nhãn `low_confidence` nếu dưới ngưỡng OCR | Trung bình |
| < 0,60 | Đỏ nhạt | `0,42 ▮▮▯▯▯` | Thấp |

### 4.4 Khối điểm

- **`ScoreCompare` (Officer):** `AI đề xuất 5 ──► Giới hạn quy chế 3 ──► Điểm chốt [ 3 ]`. Nếu bị cắt, hiện biểu tượng ✂ và tooltip *"Đã điều chỉnh theo Điều 5 khoản 2."*
- **Điểm chính thức:** nền trắng, viền liền, dấu ✔ và dòng *"Duyệt bởi <tên> · <ngày>"*.
- **Điểm đang chờ:** nền xám nhạt, viền nét đứt, nhãn *"Đề xuất — chờ duyệt"*; không cộng vào tổng điểm chính thức.

---

## 5. Khung ứng dụng và điều hướng

**App shell:** thanh trên (logo · chọn **Kỳ đánh giá** · ô hỏi nhanh quy chế · 🔔 thông báo · avatar/menu) + sidebar theo role (thu gọn thành bottom-tab trên mobile với Student).

**Route guard:** sau `AUTH-04`, FE điều hướng theo `role` và chặn route ngoài quyền (hiển thị C06 403). Token truy cập giữ trong bộ nhớ; `AUTH-02` tự làm mới khi hết hạn; refresh thất bại ⇒ về C01 và giữ lại đường dẫn để quay lại sau khi đăng nhập.

| Role | Sidebar (theo thứ tự) |
|---|---|
| **Student** | Tổng quan (S01) · Nộp minh chứng (S03) · Minh chứng của tôi (S04) · Bảng điểm (S09) · Có thể claim (S08) · Tiêu chí (S02) · Khiếu nại (S07) · Hỏi đáp quy chế (C04) |
| **Officer** | Tổng quan (O01) · Hàng đợi xử lý (O02) · Khiếu nại (O07) · Sinh viên (O09) · Hoạt động nội bộ (O06) · Hoạt động ngoài trường (O05) · Tiêu chí và rule (O08) · Báo cáo (O10) · Hỏi đáp quy chế (C04) |
| **Admin** | Tổng quan (A01) · Người dùng (A02) · Dữ liệu nền và Kỳ (A03) · Tiêu chí (A04) · Rule Engine (A05) · Knowledge Base (A06) · Cấu hình AI (A07) · Ground Truth (A08) · Đánh giá AI (A09) · Audit Log (A10) · Job và Sức khỏe (A11) · *(chế độ xem)* Hàng đợi hồ sơ (O02) |

**Chuông thông báo:** số chưa đọc từ `meta.unread_count` của `NOTI-01`; click mở dropdown 10 thông báo gần nhất, "Xem tất cả" ⇒ C05. Sự kiện SSE `review.decided` / `supplement.requested` tạo toast tức thì.

---

## 6. Trang dùng chung

### C01 · Đăng nhập **[MVP]**
- **Route:** `/login` · **Mục đích:** xác thực và chuyển về đúng khu vực theo role.
- **Bố cục:** thẻ đăng nhập giữa màn hình; bên trái (desktop) là dòng giới thiệu ngắn về nguyên tắc "AI hỗ trợ, cán bộ quyết định".
- **Thành phần:** ô *MSSV hoặc email*, ô *mật khẩu* (nút hiện/ẩn), nút **Đăng nhập**, liên kết *Quên mật khẩu* (⇒ C02).
- **Hành động và luồng:** gọi `AUTH-01` ⇒ lưu access token trong bộ nhớ ⇒ `AUTH-04` để lấy role/scope ⇒ điều hướng: Student → `/student`, Officer → `/officer`, Admin → `/admin` (hoặc quay về đường dẫn đang dở nếu có).
- **Trạng thái đặc biệt:** sai thông tin ⇒ thông báo chung, không lộ tài khoản có tồn tại; khóa tạm sau 5 lần sai (hiện đồng hồ đếm ngược); tài khoản bị khóa ⇒ hướng dẫn liên hệ Admin.
- **API sử dụng:** `AUTH-01`, `AUTH-04`, `AUTH-02`

### C02 · Quên và đặt lại mật khẩu **[ADV]**
- **Route:** `/forgot-password`, `/reset-password?token=…`
- **Bố cục:** form một ô email ⇒ màn hình xác nhận *"Nếu email tồn tại, chúng tôi đã gửi hướng dẫn"* (luôn hiện dù email có tồn tại hay không); form đặt mật khẩu mới (2 ô + thanh độ mạnh).
- **Trạng thái:** token hết hạn/đã dùng ⇒ thông báo và nút "Gửi lại".
- **API sử dụng:** `AUTH-06`, `AUTH-07`

### C03 · Hồ sơ cá nhân và bảo mật **[MVP]**
- **Route:** `/account`
- **Thành phần:** thông tin cá nhân (chỉ đọc: họ tên, MSSV/mã cán bộ, lớp/khoa, email, role, phạm vi quản lý nếu là Officer); khối **Đổi mật khẩu**; nút **Đăng xuất**.
- **Ghi chú:** thông tin gốc do Admin quản lý nên không sửa tại đây.
- **API sử dụng:** `AUTH-04`, `AUTH-05`, `AUTH-03`

### C04 · Hỏi đáp quy chế (RAG) **[MVP cơ bản / ADV đầy đủ]**
- **Route:** `/regulations/ask` (cũng mở dạng drawer từ ô hỏi nhanh trên thanh trên và từ trang chi tiết hồ sơ) · **Mục đích:** hỏi về tiêu chí, điểm tối đa, loại minh chứng cần nộp; luôn có dẫn nguồn.
- **Bố cục:** khung chat ở giữa; cột phải **"Căn cứ"** hiển thị trích dẫn của câu trả lời đang chọn; cột trái (ADV) là lịch sử hội thoại và danh sách tài liệu quy chế đang hiệu lực.

```
┌ Hỏi đáp quy chế ───────────────────────────────┬─ Căn cứ ──────────────────┐
│ Bạn: Hackathon thuộc tiêu chí nào?             │ 📄 Quy chế RL 2025 (v2025.1)│
│ ┌────────────────────────────────────────────┐ │ Điều 5 · Khoản 2 · tr.4     │
│ │ Thuộc tiêu chí C03, tối đa 3 điểm/hoạt     │ │ "…" (đoạn trích)            │
│ │ động.  [Điều 5, Khoản 2]  [Điều 7, Khoản 1]│ │ Hiệu lực: 01/09/2025 →      │
│ │ 👍 👎                                       │ │ [Mở toàn văn]               │
│ └────────────────────────────────────────────┘ │                             │
│ Bạn: Có được tính điểm 2 lần không?            │                             │
│ ┌ ⚠ Không tìm thấy thông tin đủ căn cứ trong ─┐ │                             │
│ │ tài liệu chính thức.   (không suy đoán)      │ │                             │
│ └────────────────────────────────────────────┘ │                             │
│ [ Nhập câu hỏi…                        ] [Gửi] │                             │
└────────────────────────────────────────────────┴─────────────────────────────┘
```
- **Quy tắc hiển thị:** câu trả lời `NO_EVIDENCE` dùng khung cảnh báo trung tính và **không có** nút "sao chép như câu trả lời chính thức"; mỗi câu `ANSWERED` bắt buộc có ít nhất một chip trích dẫn; click chip ⇒ tải nội dung đoạn quy chế ở cột phải.
- **Ngữ cảnh:** khi mở từ chi tiết hồ sơ, tự gửi kèm `context.evidence_id` và hiện chip *"Đang hỏi về hồ sơ: AI Hackathon 2026"* (có thể bỏ).
- **Trạng thái:** đang trả lời (typing), quá hạn mức (429) ⇒ thông báo chờ N giây.
- **API sử dụng:** `RAG-01`, `RAG-02`, `RAG-03`, `RAG-04`, `RAG-05`, `RAG-06`

### C05 · Trung tâm thông báo **[MVP]**
- **Route:** `/notifications` (và dropdown từ chuông) · **Thành phần:** danh sách nhóm theo ngày; bộ lọc *Tất cả/Chưa đọc*; mỗi thông báo có icon theo loại, tiêu đề, thời gian, click ⇒ đi thẳng tới hồ sơ/khiếu nại liên quan và đánh dấu đã đọc; nút *Đánh dấu tất cả đã đọc*.
- **Ví dụ theo role:** Student *"Hồ sơ AI Hackathon cần bổ sung — hạn 05/10"*; Officer *"Có 3 hồ sơ mới trong hàng đợi"*; Admin *"Lập chỉ mục tài liệu QC-2025 thất bại"*.
- **API sử dụng:** `NOTI-01`, `NOTI-02`, `NOTI-03`

### C06 · Trang lỗi và trạng thái hệ thống **[MVP]**
- **Route:** `/403`, `/404`, `/500`, `/maintenance`. Trang 403 nêu rõ *"Bạn không có quyền truy cập khu vực này"* và nút về trang chủ theo role; 404 dùng cho cả trường hợp sinh viên mở hồ sơ của người khác (không lộ sự tồn tại).
- **API sử dụng:** —

### C07 · Biểu mẫu xác nhận của đơn vị tổ chức (công khai, có token) **[ADV]**
- **Route:** `/organizer-confirm/:token` · **Đối tượng:** người của đơn vị tổ chức bên ngoài, **không cần tài khoản** và **không thuộc 3 role**; truy cập bằng link một lần do Officer gửi qua O04 (tab L2).
- **Bố cục:** trang đơn giản, không có menu. Hiển thị thông tin tối thiểu cần xác nhận (tên hoạt động, thời gian, họ tên sinh viên, vai trò khai báo — **ẩn MSSV và dữ liệu cá nhân khác**). Ba lựa chọn: **Xác nhận sinh viên đã tham gia** · **Xác nhận hoạt động có diễn ra nhưng không có tên sinh viên này** · **Không xác nhận / Từ chối**; ô ghi chú, tùy chọn đính kèm tệp; nút **Gửi xác nhận**.
- **Trạng thái đặc biệt:** token hết hạn/đã dùng ⇒ thông báo *"Liên kết không còn hiệu lực"*; sau khi gửi ⇒ màn hình cảm ơn, không cho gửi lại. Có chống spam (rate limit) và captcha nhẹ.
- **Kết quả:** BE ghi thành nguồn xác minh **Level 2** cho hồ sơ; câu trả lời chỉ tác động đúng câu hỏi được xác nhận (hoạt động tồn tại / sinh viên tham gia).
- **API sử dụng:** `EXT-06`, `EXT-07`

---

## 7. Sinh viên (Student)

### S01 · Tổng quan điểm rèn luyện **[MVP]**
- **Route:** `/student` · **Mục đích:** nhìn một lần biết điểm hiện có, việc cần làm, và trạng thái các hồ sơ.
- **Bố cục:**

```
┌ Kỳ: [HK1 2026-2027 ▾]        Hạn nộp: 30/10/2026 (còn 39 ngày)      [+ Nộp minh chứng] ┐
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│  ĐIỂM CHÍNH THỨC         │  Theo tiêu chí                                              │
│      ◔  78 / 100         │  C01 Học tập      ████████░░  16/20                          │
│  (+ 3 điểm đang chờ ✦)   │  C03 Nghiên cứu   ████░░░░░░   4/10   còn 6                  │
│                          │  C05 Cộng đồng    ██████░░░░  12/20   còn 8                  │
├──────────────────────────┴─────────────────────────────────────────────────────────────┤
│ Hồ sơ theo trạng thái:  Đã xác minh 5 · Có thể chấp nhận 2 · Đang xử lý 1 ·             │
│                         Cần bổ sung 1 · Cần cán bộ xem xét 2 · Bị từ chối 0             │
├──────────────────────────────────────┬─────────────────────────────────────────────────┤
│ 📌 VIỆC CẦN LÀM                       │ 💡 CÒN THIẾU GÌ (Evidence Gap)                  │
│ • AI Hackathon: bổ sung danh sách KQ  │ • AI Hackathon — chưa xác minh được bạn tham gia │
│   [Bổ sung ngay] hạn 05/10            │   Gợi ý: xác nhận của đơn vị tổ chức             │
│ • Khiếu nại #12 đã có kết quả [Xem]   │ [Xem tất cả] · [Có thể claim thêm điểm →]        │
├──────────────────────────────────────┴─────────────────────────────────────────────────┤
│ Hồ sơ gần đây (5)   Hoạt động · Trạng thái · Điểm       [Xem tất cả →]                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Quy tắc:** con số lớn chỉ là điểm chính thức đã duyệt; điểm chờ duyệt hiển thị riêng, nét đứt ✦ (nguyên tắc 2). Thanh tiêu chí hiển thị **trần** để sinh viên biết còn bao nhiêu.
- **Trạng thái đặc biệt:** chưa có hồ sơ ⇒ khối rỗng có minh họa và nút "Nộp minh chứng đầu tiên"; kỳ đã chốt ⇒ banner *"Kỳ đã chốt, chỉ xem"* và ẩn nút nộp.
- **API sử dụng:** `SCO-01`, `EVD-05`, `REF-01`, `NOTI-01`

### S02 · Tiêu chí và quy chế **[MVP]**
- **Route:** `/student/criteria` · **Mục đích:** biết hoạt động nào được tính điểm, tối đa bao nhiêu, cần minh chứng gì.
- **Bố cục:** cây accordion `Tiêu chí ▸ Tiêu chí con`. Mỗi mục: điểm tối đa, điều kiện áp dụng (ngôn ngữ dễ hiểu), *loại minh chứng yêu cầu*, ví dụ hoạt động, nút **"Xem căn cứ"** (mở drawer trích dẫn Điều/Khoản) và **"Hỏi về tiêu chí này"** (mở C04 kèm ngữ cảnh).
- **Thành phần phụ:** ô tìm kiếm, chọn kỳ (tiêu chí có thể khác nhau theo kỳ), nhãn *"Hiệu lực từ …"*.
- **API sử dụng:** `CRI-01`, `CRI-02`, `RAG-05`, `REF-01`

### S03 · Nộp minh chứng (wizard 3 bước) **[MVP]**
- **Route:** `/student/evidence/new` (và `/student/evidence/:id/edit` để tiếp tục bản nháp) · **Mục đích:** khai báo hoạt động và tải minh chứng; **tự lưu nháp** sau mỗi bước.
- **Thanh tiến độ:** `① Hoạt động  ② Minh chứng  ③ Xem lại và gửi`.

**Bước 1 — Hoạt động**
```
┌ Bạn tham gia hoạt động của…? ─────────────────────────────────────────┐
│  (•) Trường / Khoa / CLB    ( ) Bên ngoài trường    ( ) Tôi không chắc │
├────────────────────────────────────────────────────────────────────────┤
│ [Nội bộ]  🔍 Tìm hoạt động… "workshop ai"                               │
│   ▸ Workshop AI 2026 — Khoa CNTT — 12/10/2026          [Chọn]           │
│   ▸ Hội thảo AI ứng dụng — Đoàn trường — 20/09/2026    [Chọn]           │
│   Không thấy? → "Khai báo như hoạt động bên ngoài"                      │
│ [Ngoài trường]  Tên hoạt động [____]  Đơn vị tổ chức [____ ▾ gợi ý]    │
│   Thời gian [từ]–[đến]   Vai trò [Thí sinh ▾]                           │
│   Đường dẫn/mã xác minh (nếu có) [____]   ← giúp xác minh nhanh hơn    │
├────────────────────────────────────────────────────────────────────────┤
│ Loại minh chứng [Giấy chứng nhận ▾]      Ghi chú [__________]           │
└────────────────────────────────────────────────────────────────────────┘
```
- Chọn *"Tôi không chắc"* ⇒ hệ thống tự phân loại nội bộ/ngoài trường sau khi đọc minh chứng.
- Chọn **Ngoài trường** hiện ngay hộp gợi ý *"Nên đính kèm thêm để được xác minh nhanh: mã QR/đường dẫn xác minh, danh sách kết quả, email xác nhận của đơn vị tổ chức."* (chưa phải cảnh báo, chỉ là hướng dẫn).

**Bước 2 — Tải minh chứng**
- Vùng kéo-thả + nút **📷 Chụp ảnh** (mobile mở camera) + **Chọn tệp**. Tối đa **5 tệp**, **10 MB/tệp**, `JPG/PNG/PDF`.
- Mỗi tệp hiện: thumbnail, thanh tiến độ upload, trạng thái `Đang quét…` → `✔ An toàn` / `✖ Bị loại (nhiễm mã độc)`; nút xóa, sắp xếp lại thứ tự.
- **Kiểm tra chất lượng ảnh phía client** (ước lượng độ mờ/độ sáng): cảnh báo mềm *"Ảnh hơi mờ, hãy chụp lại để hệ thống đọc chính xác hơn"* (không chặn).
- **Mẹo chụp:** đủ bốn góc, không lóa, chữ rõ, chụp thẳng.

**Bước 3 — Xem lại và gửi**
- Tóm tắt thông tin + thumbnail; khối **Cảnh báo trước khi gửi** từ `EVD-15` (ví dụ *"Có vẻ bạn đã nộp minh chứng tương tự vào 12/09 — bạn vẫn có thể gửi, cán bộ sẽ kiểm tra để tránh tính điểm hai lần"*), tất cả là **cảnh báo mềm**.
- Checkbox bắt buộc: *"Tôi xác nhận thông tin khai báo là chính xác và minh chứng là của tôi."*
- Nút **Gửi hồ sơ** (chống bấm đúp) ⇒ màn hình thành công *"Đã tiếp nhận"* với stepper mini và nút *"Xem tiến trình"* ⇒ S05.
- **Trạng thái đặc biệt:** rớt mạng khi upload ⇒ tự thử lại từng tệp; đóng tab giữa chừng ⇒ hồ sơ vẫn ở `Bản nháp` trong S04; kỳ đã chốt hoặc quá hạn ⇒ chặn gửi, hiện lý do.
- **API sử dụng:** `ACT-01`, `ACT-02`, `REF-01`, `REF-04`, `REF-05`, `EVD-01`, `EVD-14`, `EVD-02`, `EVD-03`, `EVD-06`, `EVD-15`, `EVD-04`

### S04 · Danh sách minh chứng của tôi **[MVP]**
- **Route:** `/student/evidence`
- **Bố cục:** tab `Tất cả · Đang xử lý · Cần tôi bổ sung · Đã duyệt · Bị từ chối/Không hợp lệ · Bản nháp`; bộ lọc *Kỳ, Loại (nội bộ/ngoài), Tiêu chí*, ô tìm kiếm. Desktop: bảng; mobile: thẻ.
- **Cột:** hoạt động (kèm nhãn nội bộ/ngoài), ngày nộp, huy hiệu trạng thái, điểm (chính thức hoặc *"đề xuất ✦"*), việc tiếp theo (ví dụ **Bổ sung** / **Xem kết quả**).
- **Hành động dòng:** Mở (S05) · Tiếp tục nháp (S03) · Rút hồ sơ (xác nhận, chỉ khi chưa duyệt).
- **API sử dụng:** `EVD-05`, `EVD-11`, `REF-01`, `CRI-01`

### S05 · Chi tiết minh chứng **[MVP]** — trang quan trọng nhất của Student
- **Route:** `/student/evidence/:id` · **Mục đích:** một nơi để hiểu hồ sơ đang ở đâu, hệ thống đọc gì, xác minh ra sao, còn thiếu gì và điểm vì sao.
- **Bố cục:**

```
┌ AI Hackathon 2026  [Ngoài trường]   ⟦ Cần cán bộ xem xét ⟧   Kỳ HK1 2026-2027 ─────┐
│ ●─────●─────●─────●─────○─────○     Đã tiếp nhận → Đọc tài liệu → Đối chiếu →       │
│                                     Đề xuất → Cán bộ xem xét → Chốt                  │
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│  [Ảnh/PDF minh chứng]         │ [Tổng quan][Thông tin đọc được][Xác minh][Còn thiếu] │
│  ‹ 1/2 ›  🔍+ 🔍−  ⟳          │ [Đề xuất điểm ✦][Lịch sử]                            │
│                               │ ┌ Xác minh ─────────────────────────────────────────┐ │
│                               │ │ Hoạt động có tồn tại?   ◔ Có vẻ hợp lý            │ │
│                               │ │ Bạn có tham gia?        ○ Chưa xác minh độc lập   │ │
│                               │ │ "Thông tin trên tài liệu nhất quán với hồ sơ của  │ │
│                               │ │  bạn nhưng chưa có căn cứ độc lập để xác minh."   │ │
│                               │ └───────────────────────────────────────────────────┘ │
│                               │ ┌ ✦ Đề xuất — chưa phải điểm chính thức ┐ (nét đứt)   │
│                               │ │ Tiêu chí C03 · Đề xuất 3 điểm (đã giới hạn theo    │ │
│                               │ │ Điều 5 khoản 2)  Độ chắc chắn: Cao   [Vì sao?]     │ │
├───────────────────────────────┴──────────────────────────────────────────────────────┤
│ [Bổ sung minh chứng]  [Hỏi quy chế]  [Rút hồ sơ]                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
- **Stepper tiến trình (7 bước):** OCR → Trích xuất → Xác minh → Phân loại → Ánh xạ tiêu chí → Kiểm tra quy tắc → Đề xuất; cập nhật trực tiếp qua SSE, dự phòng polling. Bước lỗi hiển thị *"Hệ thống chuyển hồ sơ cho cán bộ xem xét"* (không hiện lỗi kỹ thuật).
- **Tab Tổng quan:** trình xem tệp (zoom, xoay, nhiều trang) + thông tin chính; nếu **đã có quyết định** ⇒ **thẻ kết quả chính thức** (điểm, tiêu chí, người duyệt, ngày, lý do); nút **"Vì sao được X điểm?"** mở drawer truy vết (`PIPE-09`): *Điểm cuối → quy tắc → hoạt động → minh chứng → nội dung đọc được → nguồn xác minh → quyết định*.
- **Tab Thông tin đọc được:** danh sách trường (họ tên, MSSV, tên hoạt động, đơn vị, ngày…) kèm mức chắc chắn định tính. Trường chắc chắn thấp có viền vàng và hai nút **Đúng** / **Sửa**. Click một trường ⇒ tô sáng vùng tương ứng trên ảnh (bbox). Khi sinh viên sửa, hiện cả *giá trị đọc được* và *giá trị bạn sửa*, kèm ghi chú *"Thay đổi sẽ được cán bộ xem lại"*.
- **Tab Xác minh:** hai thẻ **tách biệt** (Hoạt động có tồn tại? / Bạn có tham gia?) + *mức xác minh* bằng ngôn ngữ thường + lý do. Với hoạt động nội bộ hiện 3 dòng ✔/⚠: *Thông tin cá nhân khớp · Hoạt động khớp danh sách · Điểm danh*. Trường hợp `ABSENT`: *"Chưa thấy tên bạn trong danh sách điểm danh — cán bộ sẽ kiểm tra."* (không kết luận sai).
- **Tab Còn thiếu (Evidence Gap):** checklist *"Bổ sung một trong các mục sau để nâng mức xác minh"* — danh sách người tham gia chính thức, xác nhận của đơn vị tổ chức, đường dẫn/mã xác minh, kết quả công bố. Mỗi dòng có nút **Bổ sung ngay** (⇒ S06).
- **Tab Đề xuất điểm ✦:** Top-1 tiêu chí (tên + mô tả), điểm đề xuất **đã qua giới hạn** kèm giải thích *"Đề xuất ban đầu vượt trần nên đã điều chỉnh về 3 điểm theo Điều 5 khoản 2"* (khi bị cắt), mức chắc chắn định tính, lý do, chip trích dẫn. Nếu `ABSTAINED`/`NO_MATCH`: *"Hệ thống chưa đủ căn cứ để đề xuất; cán bộ sẽ xác định tiêu chí."*
- **Tab Lịch sử:** timeline sự kiện đã lọc thông tin nội bộ.
- **Thanh hành động theo ngữ cảnh:** `Bổ sung` (khi Cần bổ sung) · `Khiếu nại` (khi đã quyết định và còn hạn) · `Rút hồ sơ` (khi chưa duyệt) · `Hỏi quy chế`.
- **Không hiển thị cho Student:** `risk_signals`, confidence dạng số, phiên bản model/prompt, danh sách Top-K đầy đủ.
- **API sử dụng:** `EVD-06`, `EVD-07`, `EVD-08`, `EVD-12`, `EVD-13`, `EVD-09`, `EVD-11`, `PIPE-01`, `PIPE-03`, `PIPE-05`, `PIPE-08`, `PIPE-09`, `RAG-05`

### S06 · Bổ sung minh chứng **[MVP]**
- **Route:** `/student/evidence/:id/supplement` (mở dạng trang riêng hoặc modal lớn) · **Mục đích:** trả lời yêu cầu bổ sung của cán bộ hoặc chủ động bổ sung theo Evidence Gap.
- **Bố cục:** đầu trang là **hộp yêu cầu của cán bộ** (nội dung, hạn nộp). Dưới là **từng yêu cầu một thẻ** với đầu vào phù hợp loại yêu cầu: *tải tệp* (danh sách tham gia, email xác nhận, ảnh rõ hơn), *dán đường dẫn/mã* (URL, Certificate ID), *nhập giải thích* (lệch họ tên, thời gian). Cuối trang: khung ghi chú chung và **Gửi bổ sung**.
- **Kết quả:** quay về S05 với trạng thái `Đang xử lý`; hệ thống chạy lại từ bước xác minh; hạn còn lại hiển thị đếm ngược.
- **Trạng thái:** quá hạn ⇒ khóa nộp và gợi ý liên hệ cán bộ; chưa có yêu cầu nào (bổ sung chủ động) ⇒ chỉ hiển thị Evidence Gap và ô tải tùy ý.
- **API sử dụng:** `EVD-06`, `PIPE-08`, `EVD-10`, `EVD-12`

### S07 · Khiếu nại **[MVP]**
- **Route:** `/student/appeals` (danh sách), `/student/appeals/new?evidence_id=…` (tạo), `/student/appeals/:id` (chi tiết).
- **Tạo khiếu nại:** hiển thị tóm tắt **quyết định gốc** (điểm, lý do); chọn **nội dung phản đối** (tiêu chí / mức điểm / kết quả xác minh / lý do từ chối); ô giải thích (tối thiểu 20 ký tự); đính kèm minh chứng mới; **hạn khiếu nại còn lại**.
- **Chi tiết:** timeline (Đã gửi → Đang xem xét → Kết quả), phản hồi của cán bộ; nếu chấp nhận xem lại ⇒ liên kết về hồ sơ đang ở `Cần cán bộ xem xét`.
- **Trạng thái:** hết hạn khiếu nại ⇒ nút bị vô hiệu hóa kèm giải thích; đã có khiếu nại đang xử lý ⇒ không tạo thêm.
- **API sử dụng:** `APL-01`, `APL-02`, `APL-03`, `EVD-06`

### S08 · "What can I claim?" — Còn có thể tích lũy gì **[ADV]**
- **Route:** `/student/claim` · **Mục đích:** chuyển hệ thống từ "chấm điểm" sang "hướng dẫn hoàn thiện hồ sơ".
- **Bố cục 3 khối:**
  1. **Điểm còn có thể đạt theo tiêu chí:** thanh `đã đạt | đang chờ | còn lại`.
  2. **Hoạt động gợi ý:** thẻ hoạt động nội bộ sắp diễn ra (kèm điểm điển hình, minh chứng cần nộp) và các *loại hoạt động ngoài trường* có thể khai báo, mỗi thẻ có nút **Nộp minh chứng** (mở S03 điền sẵn loại) và chip trích dẫn.
  3. **Hồ sơ của bạn có thể nâng cấp:** hồ sơ đang `Cần bổ sung/Cần cán bộ xem xét` kèm *"nếu bổ sung X, hồ sơ có thể đạt mức xác minh cao hơn"* ⇒ **Bổ sung ngay**.
- **Lưu ý cố định cuối trang:** *"Gợi ý tham khảo. Điểm cuối do cán bộ quyết định theo quy chế."*
- **API sử dụng:** `SCO-03`, `REF-01`, `RAG-05`

### S09 · Bảng điểm rèn luyện **[MVP]**
- **Route:** `/student/scores` · **Mục đích:** minh bạch từng điểm đến từ đâu.
- **Bố cục:** chọn kỳ; bảng `Tiêu chí | Trần | Đã đạt | Đang chờ`; mở rộng từng tiêu chí để thấy các hồ sơ đã đóng góp (tên hoạt động, điểm, người duyệt, ngày). Mỗi dòng có **"Vì sao được X điểm?"** (drawer truy vết). Điểm chờ duyệt hiển thị mờ, nét đứt, không cộng vào tổng.
- **Trạng thái kỳ:** *Đang mở* / *Đã chốt* (kèm ngày chốt). **Xuất PDF** bảng điểm (ADV).
- **API sử dụng:** `SCO-02`, `PIPE-09`, `REF-01`

---

## 8. Cán bộ (Officer)

### O01 · Tổng quan xử lý **[MVP]**
- **Route:** `/officer` · **Mục đích:** biết hôm nay cần làm gì trước, và AI đang hỗ trợ tốt đến đâu.
- **Bố cục:**
  - **Hàng KPI (click để đi thẳng vào hàng đợi đã lọc):** *Chờ xem xét* · *Chờ sinh viên bổ sung* · *Khiếu nại mới* · *Tự duyệt cần spot-check* · *Thời gian xử lý TB*.
  - **"Ưu tiên hôm nay":** 5 hồ sơ đầu hàng đợi với lý do ưu tiên (ví dụ *Level xác minh thấp · OCR confidence thấp · chờ 30 giờ*) và nút **Bắt đầu xử lý** (⇒ O03).
  - **Biểu đồ:** cột chồng *hồ sơ theo trạng thái xác minh*; đường *tỷ lệ Officer đồng ý với đề xuất AI theo tuần* (đúng điểm / ±1 / đổi tiêu chí); đường *thời gian xử lý* (TB, p90); bảng *Top đơn vị tổ chức ngoài trường và mức xác minh đạt được*.
  - Bộ lọc: Kỳ, Khoa, Lớp (theo phạm vi Officer).
- **API sử dụng:** `OFF-02`, `RPT-02`, `RPT-04`, `RPT-05`, `REF-01`, `REF-02`, `REF-03`

### O02 · Hàng đợi xử lý **[MVP]**
- **Route:** `/officer/queue` · **Mục đích:** danh sách hồ sơ sắp theo mức cần chú ý, để Officer không phải tự tìm hồ sơ khó.
- **Bố cục:**

```
┌ Tabs: [Cần xem xét 48] [Chờ SV bổ sung 12] [Tự duyệt–spot-check 9] [Đã xử lý] [Tất cả]  ┐
│ Lọc: Kỳ▾ Khoa▾ Lớp▾ Loại▾ Xác minh▾ Cờ▾ Tiêu chí▾ Người xử lý▾  🔍MSSV/tên   Sắp: Ưu tiên ▾│
├──┬───┬─────────────┬───────────────────┬──────────┬──────────────┬───────────┬────────┬─────┤
│☐ │ ! │ SV          │ Hoạt động         │ Xác minh │ AI đề xuất   │ Confid.   │ Cờ     │ Chờ │
├──┼───┼─────────────┼───────────────────┼──────────┼──────────────┼───────────┼────────┼─────┤
│☐ │███│ 20IT123 A   │ AI Hackathon [Ngoài]│ L5 ⟦NHR⟧ │ C03 · 3đ ✂   │ 0,91 ▮▮▮▮ │ ⚠ ⓘ    │ 30h │
│☐ │██ │ 20IT045 B   │ Workshop AI [Nội]  │ I1✔I2✔I3⚠│ C03 · 2đ     │ 0,74 ▮▮▮  │ ABSENT │ 12h │
│☑ │█  │ 20IT301 C   │ Tình nguyện [Nội]  │ ✔ VERIFIED│ C05 · 2đ     │ 0,95 ▮▮▮▮ │ —      │ 5h  │
├──┴───┴─────────────┴───────────────────┴──────────┴──────────────┴───────────┴────────┴─────┤
│ Đã chọn 1 · [Duyệt hàng loạt fast-track]                        [Xử lý hồ sơ tiếp theo ▶]   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cột `!` (ưu tiên):** thanh 1–3 vạch; rê chuột hiện `priority_reasons` (giải thích vì sao hồ sơ này lên đầu).
- **Cờ:** icon cho `UNVERIFIED_EXTERNAL_ACTIVITY`, `NEW_ACTIVITY_NEVER_SEEN`, `DUPLICATE_SUSPECTED`, `NAME_MISMATCH`, `LOW_OCR_CONFIDENCE`, `ABSENT_IN_ATTENDANCE`, `PIPELINE_ERROR`, `STUDENT_EDITED_OCR` (rê chuột xem giải thích).
- **Hành động:**
  - Click dòng ⇒ O03 (tự `CLAIM`); dòng đang bị Officer khác giữ hiển thị 🔒 và tên người giữ.
  - **Xử lý hồ sơ tiếp theo ▶** ⇒ lấy hồ sơ ưu tiên cao nhất chưa có ai giữ.
  - **Duyệt hàng loạt fast-track:** chỉ bật khi mọi hồ sơ được chọn thuộc diện `fast_track` (nội bộ + đã xác minh + `PRESENT` + Rule Engine không lỗi + không cờ). Hộp thoại xác nhận liệt kê số hồ sơ và tổng điểm; hồ sơ bị BE loại sẽ hiển thị lý do sau khi gửi.
  - Tab **Tự duyệt–spot-check** chỉ có dữ liệu khi Admin bật `auto_approve`; mỗi dòng có nút **Giữ nguyên** / **Mở lại xem xét**.
- **Admin** mở trang này ở chế độ chỉ xem (ẩn nút duyệt).
- **API sử dụng:** `OFF-01`, `OFF-03`, `REV-03`, `REV-04`, `REF-01`, `REF-02`, `REF-03`, `REF-05`, `CRI-01`

### O03 · Màn hình xét duyệt hồ sơ **[MVP]** — trang cốt lõi của Officer
- **Route:** `/officer/evidence/:id` · **Mục đích:** một màn hình để đối chiếu **ảnh gốc ↔ thông tin đọc được ↔ xác minh ↔ đề xuất AI ↔ Rule Engine** và ra quyết định có căn cứ.
- **Bố cục hai vùng + thanh quyết định cố định:**

```
┌ 20IT123 Nguyễn Văn A · AI Hackathon 2026 [Ngoài] ⟦NHR⟧ ⚠2 ─── 🔒 bạn đang giữ · ◀ ▶ ─┐
├──────────────────────────────┬───────────────────────────────────────────────────────┤
│ TRÌNH XEM MINH CHỨNG         │ [Tóm tắt][OCR][Xác minh][AI & Tiêu chí][Rule Engine]  │
│ [cert.jpg][kq.pdf]           │ [Sinh viên][Lịch sử]                                  │
│ ┌──────────────────────────┐ │ ┌ OCR (đối chiếu hồ sơ) ───────────────────────────┐ │
│ │  (ảnh gốc, bbox tô sáng  │ │ │ Trường     Đọc được     Hồ sơ SV     Conf.  So sánh│ │
│ │   khi click trường)      │ │ │ MSSV       20IT123      20IT123      0,98 ▮  ✔     │ │
│ │                          │ │ │ Họ tên     Nguyen Van A Nguyễn Văn A 0,71 ▯ ⚠ khác dấu│ │
│ │                          │ │ │ Hoạt động  AI Hackathon 2026 (khai: cùng) 0,93 ✔   │ │
│ └──────────────────────────┘ │ │ Ngày       10/05/2026   10/05–11/05  0,88 ✔        │ │
│ 🔍+ 🔍− ⟳ ⛶  [So sánh 2 tệp]  │ │ Cert ID    (không có)   —            —     ○       │ │
│                              │ └───────────────────────────────────────────────────┘ │
│                              │ ┌ Xác minh ─────────────────────────────────────────┐ │
│                              │ │ Hoạt động tồn tại: ◔ PLAUSIBLE   Tham gia: ○ chưa  │ │
│                              │ │ Level đạt: L1 ▱ L2 ▱ L3 ▱ L4 ▱ [L5 ▰]   [+ Thêm nguồn]│ │
│                              │ │ ⚠ Risk signals (chỉ cảnh báo, không phải kết luận) │ │
│                              │ └───────────────────────────────────────────────────┘ │
├──────────────────────────────┴───────────────────────────────────────────────────────┤
│ QUYẾT ĐỊNH   Tiêu chí [C03 ▾ (AI: 0,91)]  AI 5 ─► Giới hạn 3 ✂ ─► Điểm chốt [ 3 ]     │
│ [✔ Duyệt] [✎ Sửa điểm & duyệt] [✖ Từ chối] [📎 Yêu cầu bổ sung]   phím tắt: A  M  R  S │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
- **Vùng trái — Trình xem minh chứng:** nhiều tệp (tab), zoom/xoay, chế độ toàn màn hình, **so sánh hai tệp cạnh nhau**, tô sáng vùng trường khi click ở tab OCR. Signed URL được làm mới khi hết hạn.
- **Các tab bên phải:**
  1. **Tóm tắt:** thông tin hồ sơ, cờ, huy hiệu, lý do ưu tiên, bối cảnh khiếu nại (nếu là hồ sơ mở lại: quyết định gốc và lý do khiếu nại), 3 "điểm cần chú ý" do hệ thống tổng hợp.
  2. **OCR:** bảng so sánh *Đọc được ↔ Hồ sơ sinh viên ↔ Confidence ↔ Khớp/Lệch*. Trường `low_confidence` viền vàng. **Sửa tại chỗ** (lưu giá trị gốc, ghi `source=OFFICER`); trường sinh viên đã sửa có nhãn `STUDENT_EDITED_OCR` và hiện cả hai giá trị. Xem/ẩn *raw text*. Nút **Chạy lại OCR**.
  3. **Xác minh:**
     - *Nội bộ:* 3 lớp I1 Danh tính · I2 Hoạt động · I3 Điểm danh với chi tiết từng trường.
     - *Ngoài trường:* thang L1–L5 (mức đạt được tô đậm) + **hai câu hỏi tách biệt** (hoạt động tồn tại / sinh viên tham gia) + danh sách **nguồn xác minh đã ghi nhận** + nút **＋ Thêm nguồn** (mở O04).
     - **Risk signals** (font, logo, bố cục, metadata, nghi trùng ảnh): luôn kèm dòng *"Chỉ là cảnh báo rủi ro, không phải căn cứ kết luận giả."*; hồ sơ nghi trùng có liên kết sang hồ sơ kia.
     - Khối **Evidence Gap** để Officer biết cần yêu cầu gì (dùng cho hộp thoại "Yêu cầu bổ sung").
  4. **AI & Tiêu chí:** loại hoạt động + scope + confidence; **bảng Top-K tiêu chí** (radio chọn, mỗi dòng có confidence, lý do, chip trích dẫn Điều/Khoản); lý do tổng thể của AI; banner **ABSTAINED/NO_MATCH** *"Hệ thống không tự đề xuất vì …"*; nút **Chạy lại AI**, **Lịch sử các lần chạy** (model/prompt/rule version); ô **Hỏi quy chế về hồ sơ này** (RAG có ngữ cảnh).
  5. **Rule Engine:** từng kiểm tra ✔/✖ với mã rule + phiên bản (Điều kiện áp dụng · Điểm tối đa · Trùng lặp · Minh chứng bắt buộc · Trần tích lũy *"đã 4/10, còn 6"* · Hạn nộp) và `ScoreCompare`. Kết quả `hard_fail` hiển thị rõ lý do nhưng **vẫn để Officer quyết định**.
  6. **Sinh viên:** thông tin, các hồ sơ khác trong kỳ, điểm theo tiêu chí, hoạt động ngoài trường đã từng khai báo (phát hiện lặp).
  7. **Lịch sử:** timeline sự kiện + các quyết định trước (ai, khi nào, trước/sau, lý do) + các lần bổ sung của sinh viên.
- **Thanh quyết định (cố định dưới cùng):** chọn tiêu chí (mặc định Top-1 của AI, đổi được), ô điểm chốt (bộ tăng giảm; **giá trị tối đa = min(trần Rule Engine, trần tích lũy còn lại)**, không nhập vượt được), và bốn nút:
  - **Duyệt:** nếu hồ sơ ngoài trường ở `L5` ⇒ mở hộp thoại bắt buộc *"Tôi đã tự xác minh"* + nêu căn cứ; kết quả ghi nhãn **"Verified by officer"**, không nâng mức xác minh.
  - **Sửa điểm & duyệt:** bắt buộc nhập điểm mới và lý do.
  - **Từ chối:** bắt buộc chọn **căn cứ cụ thể** (*Phát hiện mâu thuẫn · Trùng lặp đã xác nhận · Hoạt động không thuộc phạm vi tính điểm · Có bằng chứng sinh viên không tham gia · Quá hạn · Không đọc được sau khi đã bổ sung*), đính kèm nguồn/bằng chứng tham chiếu và viết lý do. **Không có lựa chọn "Không có trong dữ liệu trường"**; nếu Officer gõ lý do dạng này, FE cảnh báo *"Không tìm thấy trong dữ liệu trường không phải căn cứ từ chối. Hãy yêu cầu bổ sung hoặc nêu căn cứ cụ thể."*
  - **Yêu cầu bổ sung:** danh sách tick theo mẫu (danh sách tham gia · xác nhận đơn vị tổ chức · URL/mã xác minh · kết quả công bố · ảnh rõ hơn · làm rõ họ tên · minh chứng thời gian) **tự gợi ý từ Evidence Gap**, ghi chú cho từng mục, hạn nộp.
- **Cộng tác:** `CLAIM` tự động khi mở; hiển thị 🔒 nếu người khác đang giữ (chỉ xem); mất khóa sau 15 phút không hoạt động. **Xung đột phiên bản** (`409`) ⇒ hộp thoại *"Hồ sơ vừa được cập nhật. Tải lại để xem thay đổi?"*, không mất nội dung lý do đang gõ.
- **Sau khi gửi quyết định:** thông báo thành công, tự động chuyển sang hồ sơ kế tiếp (`◀ ▶`, nút *Tiếp theo*), có thể tắt tính năng này.
- **Phím tắt:** `A` duyệt · `M` sửa · `R` từ chối · `S` yêu cầu bổ sung · `N` hồ sơ kế tiếp · `1…3` chọn tiêu chí Top-K.
- **Trạng thái đặc biệt:** pipeline đang chạy ⇒ các tab hiển thị skeleton và tiến độ, quyết định bị khóa cho tới khi xong hoặc bấm *"Xử lý không chờ AI"*; `PIPELINE_ERROR` ⇒ banner nêu bước lỗi và nút **Chạy lại toàn bộ**.
- **API sử dụng:** `EVD-06`, `EVD-07`, `EVD-08`, `EVD-09`, `EVD-12`, `EVD-13`, `PIPE-01`, `PIPE-02`, `PIPE-03`, `PIPE-04`, `PIPE-05`, `PIPE-06`, `PIPE-07`, `PIPE-08`, `PIPE-09`, `PIPE-10`, `PIPE-11`, `REV-01`, `REV-02`, `REV-03`, `EXT-04`, `SCO-02`, `SCO-05`, `OFF-03`, `APL-03`, `RAG-01`, `RAG-05`, `CRI-02`, `REF-05`

### O04 · Thêm nguồn xác minh ngoài trường **[MVP mức L1/L5 · ADV mức L2–L4]**
- **Hình thức:** drawer mở từ O03 (`＋ Thêm nguồn`) · **Mục đích:** ghi nhận chứng cứ độc lập theo từng cấp, có phân biệt **nguồn này trả lời câu hỏi nào**.
- **Bố cục:** 4 tab tương ứng các cấp; phía trên luôn có hai checkbox **"Nguồn này xác nhận: ☐ Hoạt động có tồn tại  ☐ Đúng sinh viên này tham gia"** (mặc định theo cấp; Level 4 chỉ cho tick "Hoạt động có tồn tại").

| Tab | Nội dung |
|---|---|
| **L1 Chính thức** | Ô nhập URL / Certificate ID / dữ liệu QR (tự điền nếu OCR đã đọc được) ⇒ nút **Kiểm tra ngay** (gọi BE kiểm tra, hiển thị kết quả `Xác nhận / Không xác nhận / Không truy cập được`). |
| **L2 Đơn vị tổ chức** *(ADV)* | Chọn đơn vị (gợi ý từ danh mục), email liên hệ ⇒ **Gửi yêu cầu xác nhận** (link biểu mẫu có token); bảng theo dõi trạng thái *Đã gửi / Đã mở / Đã phản hồi*; hoặc **ghi nhận email đã nhận** (tải ảnh chụp/tệp). |
| **L3 Danh sách tham gia** *(ADV)* | Tự đối chiếu với registry đã import cho hoạt động này; hoặc tải danh sách nhận được. Hiển thị dòng khớp với sinh viên (nếu có). |
| **L4 Nguồn công khai** *(ADV)* | URL trang chính thức, ảnh chụp trang, ghi chú; nhắc *"Nguồn này chỉ xác nhận hoạt động tồn tại, chưa xác nhận sinh viên tham gia."* |

- **Kết quả nguồn:** `Xác nhận / Không xác nhận / Không truy cập được` + ghi chú; sau khi lưu, O03 tự cập nhật thang mức và hai câu hỏi.
- **Khối cuối "Tự xác minh thủ công":** *Đánh dấu Verified / Unverified* bắt buộc lý do; hiển thị là **"verified by officer"**, không thay đổi thang L1–L5.
- **API sử dụng:** `EXT-03`, `EXT-04`, `EXT-05`, `EXT-12`, `EXT-13`, `EVD-12`

### O05 · Hoạt động ngoài trường và đơn vị tổ chức **[ADV]**
- **Route:** `/officer/external-activities`, `/officer/external-activities/:id`
- **Tab *Hoạt động*:** bảng tên chuẩn hóa · đơn vị tổ chức · số hồ sơ đã khai · độ phủ xác minh (số hồ sơ theo mức) · nhãn **"Mới — chưa từng xuất hiện"**. Chi tiết: sửa tên chuẩn hóa/loại/đơn vị, **hợp nhất bản ghi trùng** (ví dụ "AI Hackathon 2026" và "Hackathon AI 2026"), danh sách hồ sơ liên quan, **nhập danh sách người tham gia (registry)** từ đơn vị (CSV) — xem trước, đối chiếu MSSV, xác nhận.
- **Tab *Đơn vị tổ chức*:** danh sách + thêm/sửa (tên, alias, website, email liên hệ, ghi chú độ tin cậy). Alias giúp gộp các cách viết khác nhau.
- **API sử dụng:** `EXT-01`, `EXT-02`, `EXT-08`, `EXT-09`, `EXT-10`, `EXT-11`, `REF-04`, `EVD-05`

### O06 · Quản lý hoạt động nội bộ và điểm danh **[MVP]**
- **Route:** `/officer/activities`, `/officer/activities/new`, `/officer/activities/:id`
- **Danh sách:** bảng hoạt động (tên, thời gian, đơn vị, loại, số người điểm danh, số hồ sơ liên quan), lọc theo kỳ/đơn vị/trạng thái, **＋ Tạo hoạt động**.
- **Chi tiết (3 tab):**
  1. **Thông tin:** tên, mã hoạt động, thời gian, địa điểm, đơn vị tổ chức, loại hoạt động, cấp (lớp/khoa/trường…), tiêu chí mặc định gợi ý, kỳ. **Lưu trữ** thay vì xóa khi đã có hồ sơ.
  2. **Điểm danh:** bảng (MSSV, họ tên, `PRESENT/ABSENT`, nguồn); **Import CSV/XLSX** theo 3 bước *Tải lên → Xem trước lỗi (MSSV không tồn tại, dòng trùng…) → Xác nhận*; sửa tay từng dòng (bắt buộc lý do, ghi audit); xuất danh sách.
  3. **Minh chứng liên quan** *(ADV)*: các hồ sơ đã nộp cho hoạt động này.
- **API sử dụng:** `ACT-01`, `ACT-02`, `ACT-03`, `ACT-04`, `ACT-05`, `ACT-06`, `ACT-07`, `ACT-08`, `ACT-09`, `REF-01`, `REF-05`, `CRI-01`

### O07 · Xử lý khiếu nại **[MVP]**
- **Route:** `/officer/appeals`, `/officer/appeals/:id`
- **Danh sách:** tab `Mới · Đang xem xét · Đã xử lý`, cột sinh viên, hoạt động, ngày gửi, hạn xử lý, nội dung phản đối.
- **Chi tiết (2 cột):** *trái* — quyết định gốc (điểm, lý do, người duyệt) và tóm tắt hồ sơ; *phải* — lý do và tệp đính kèm mới của sinh viên. Hai nút: **Mở lại hồ sơ để xem xét** (⇒ O03 kèm bối cảnh khiếu nại; hồ sơ về hàng đợi, Officer ra quyết định mới) hoặc **Từ chối khiếu nại** (bắt buộc lý do, gửi cho sinh viên).
- **API sử dụng:** `APL-02`, `APL-03`, `APL-04`, `EVD-06`

### O08 · Tiêu chí và quy tắc (chỉ xem) **[MVP]**
- **Route:** `/officer/criteria` · **Mục đích:** Officer tra cứu nhanh tiêu chí, trần điểm, điều kiện và **rule đang hiệu lực** khi xét hồ sơ.
- **Bố cục:** cây tiêu chí; mỗi mục hiện điểm tối đa, điều kiện áp dụng, loại minh chứng yêu cầu, **tóm tắt rule đang hiệu lực** (mã rule, phiên bản, ngày hiệu lực) dạng chỉ đọc, chip trích dẫn Điều/Khoản; nút **Hỏi về tiêu chí này** (C04).
- **Ghi chú thiết kế:** quyền sửa tiêu chí/rule thuộc **Admin** (A04, A05) để tách bạch với quyền duyệt điểm. Nếu nhà trường muốn Officer tự chỉnh, chỉ cần mở A04/A05 cho Officer kèm quy tắc hai người (người sửa ≠ người publish).
- **API sử dụng:** `CRI-01`, `CRI-02`, `REF-05`, `RAG-01`

### O09 · Tra cứu sinh viên **[MVP]**
- **Route:** `/officer/students`, `/officer/students/:id`
- **Danh sách:** tìm theo MSSV/họ tên/lớp/khoa (giới hạn theo phạm vi Officer).
- **Chi tiết:** thông tin sinh viên; điểm theo tiêu chí trong kỳ (kèm truy vết "Vì sao?" ở S09-style); toàn bộ hồ sơ (bảng lọc theo trạng thái); tab **Có thể claim** *(ADV)* để Officer tư vấn sinh viên.
- **API sử dụng:** `SCO-04`, `SCO-05`, `SCO-02`, `SCO-03`, `EVD-05`, `REF-01`, `REF-02`, `REF-03`

### O10 · Báo cáo và thống kê **[MVP cơ bản / ADV đầy đủ]**
- **Route:** `/officer/reports`
- **Bố cục:** bộ lọc Kỳ/Khoa/Lớp; 5 tab — *Tổng hợp hồ sơ theo trạng thái/loại/tiêu chí* · *Phân phối điểm theo tiêu chí* · *Thời gian xử lý (TB, p90, theo Officer/tuần)* · *Đồng thuận AI–Officer* · *Ngoài trường theo đơn vị tổ chức*; nút **Xuất Excel/PDF** (tạo job, hiện tiến độ, tải khi xong).
- **API sử dụng:** `RPT-01`, `RPT-02`, `RPT-03`, `RPT-04`, `RPT-05`, `RPT-06`, `RPT-07`, `REF-01`, `REF-02`, `REF-03`

---

## 9. Quản trị viên (Administrator)

### A01 · Tổng quan hệ thống **[MVP]**
- **Route:** `/admin`
- **Bố cục:** KPI (người dùng hoạt động, hồ sơ nộp theo ngày, hồ sơ chờ xử lý) · **Sức khỏe pipeline** (job đang chờ/lỗi, độ trễ trung bình từng bước OCR/AI/RAG, tỷ lệ lỗi LLM) · **Tóm tắt chất lượng AI** (coverage, abstention rate, MAE, hallucination rate của RAG) · **Trạng thái Knowledge Base** (tài liệu đã publish/đã index/chưa index) · Thay đổi cấu hình gần đây · Cảnh báo (ví dụ *tỷ lệ lỗi LLM tăng đột biến*). Mỗi khối click để đi tới trang chi tiết.
- **API sử dụng:** `ADM-DSH-01`, `ADM-JOB-04`, `ADM-EVAL-01`

### A02 · Quản lý người dùng và phân quyền **[MVP]**
- **Route:** `/admin/users`
- **Bảng:** họ tên, MSSV/mã cán bộ, role, khoa/lớp, trạng thái; lọc theo role/khoa/trạng thái; tìm kiếm.
- **Thao tác:** **＋ Tạo người dùng** (role chỉ chọn trong 3 giá trị; sinh viên nhập MSSV + lớp; Officer chọn **phạm vi khoa/lớp** phụ trách) · Sửa · Khóa/Mở khóa · Đặt lại mật khẩu (hiển thị mật khẩu tạm một lần) · **Import CSV** theo 3 bước *Tải lên → Xem trước lỗi → Xác nhận*.
- **Tab "Phân quyền (RBAC)":** ma trận quyền của 3 role, **chỉ đọc**, giúp Admin và hội đồng nhìn rõ ranh giới.
- **Ghi chú:** đổi role hoặc phạm vi hiển thị hộp xác nhận và ghi Audit Log.
- **API sử dụng:** `ADM-USR-01`, `ADM-USR-02`, `ADM-USR-03`, `ADM-USR-04`, `ADM-USR-05`, `ADM-USR-06`, `ADM-USR-07`, `ADM-USR-08`, `ADM-USR-09`, `REF-02`, `REF-03`

### A03 · Dữ liệu nền và Kỳ đánh giá **[MVP]**
- **Route:** `/admin/master-data`
- **Tab *Khoa*, *Lớp*:** bảng + form thêm/sửa.
- **Tab *Kỳ đánh giá*:** danh sách kỳ (tên, thời gian, **hạn nộp**, **hạn khiếu nại**, trạng thái *Đang mở/Đã chốt*). **Chốt kỳ** (hộp xác nhận nêu hậu quả: *đóng băng điểm, chặn nộp và duyệt mới*) và **Mở lại kỳ** (bắt buộc lý do, ghi audit). Kỳ đã chốt không sửa được các mốc đã qua.
- **API sử dụng:** `REF-01`, `REF-02`, `REF-03`, `ADM-ORG-01`, `ADM-ORG-02`, `ADM-ORG-03`, `ADM-ORG-04`, `ADM-TRM-01`, `ADM-TRM-02`, `ADM-TRM-03`, `ADM-TRM-04`

### A04 · Quản lý tiêu chí **[MVP]**
- **Route:** `/admin/criteria`
- **Bố cục:** trình soạn cây `Tiêu chí ▸ Tiêu chí con` (kéo thả sắp xếp). Form: mã, tên, mô tả, **điểm tối đa**, **loại minh chứng yêu cầu**, **loại hoạt động áp dụng** (lấy từ danh mục), kỳ hiệu lực, trích dẫn quy chế. Panel phải liệt kê **các rule gắn với tiêu chí** (link sang A05).
- **Ràng buộc:** tiêu chí đã có điểm sử dụng chỉ được **lưu trữ**, không xóa.
- **API sử dụng:** `CRI-01`, `CRI-02`, `ADM-CRI-01`, `ADM-CRI-02`, `ADM-CRI-03`, `ADM-CRI-04`, `ADM-CRI-05`, `ADM-CRI-06`, `REF-05`

### A05 · Rule Engine **[MVP soạn/publish · ADV mô phỏng/phiên bản]**
- **Route:** `/admin/rules`, `/admin/rules/:id`
- **Danh sách:** lọc theo tiêu chí và trạng thái `Nháp / Đang hiệu lực / Cũ`; cột mã rule, tiêu chí, tóm tắt (*"Cuộc thi chuyên môn ⇒ tối đa 3 điểm"*), hiệu lực, phiên bản.
- **Trình soạn rule (hai chế độ):**
  - **Form:** *Điều kiện* (loại hoạt động, scope, cấp, vai trò, mức xác minh tối thiểu, kỳ) → *Hành động* (điểm tối đa, trần tích lũy theo tiêu chí, chính sách trùng lặp *theo kỳ/toàn khóa/cấm*, minh chứng bắt buộc, hạn nộp). Bên cạnh là **bản diễn giải ngôn ngữ tự nhiên** cập nhật trực tiếp.
  - **JSON nâng cao:** sửa JSON Logic thô với kiểm tra schema.
- **Kiểm tra và chạy thử:**
  - **Validate:** báo lỗi schema, rule chồng lấn/xung đột.
  - **Simulate** *(ADV)*: chọn đầu vào mẫu **hoặc phát lại N hồ sơ cũ** ⇒ bảng *"kết quả với rule mới so với rule đang hiệu lực"* (số hồ sơ bị đổi điểm, hồ sơ nào).
- **Publish:** hộp thoại bắt buộc **ngày hiệu lực** và **ghi chú thay đổi**; tạo phiên bản bất biến mới. Rule đã publish **không sửa trực tiếp** (sửa = tạo bản mới).
- **Tab Phiên bản** *(ADV)*: lịch sử + diff; **Khôi phục** = publish lại bản cũ thành phiên bản mới.
- **Import quy chế đã số hóa** *(ADV)*: tải JSON/Excel ⇒ xem trước ⇒ validate ⇒ tạo hàng loạt bản nháp.
- **API sử dụng:** `ADM-RUL-01`, `ADM-RUL-02`, `ADM-RUL-03`, `ADM-RUL-04`, `ADM-RUL-05`, `ADM-RUL-06`, `ADM-RUL-07`, `ADM-RUL-08`, `ADM-RUL-09`, `CRI-01`, `REF-05`

### A06 · Knowledge Base (tài liệu quy chế cho RAG) **[MVP]**
- **Route:** `/admin/knowledge`, `/admin/knowledge/:id`
- **Danh sách:** tên, loại (Quy chế / Hướng dẫn / Quy định minh chứng), cơ quan ban hành, **phiên bản**, **hiệu lực từ–đến**, trạng thái, huy hiệu *Đang dùng / Bị thay thế / Lưu trữ*.
- **Upload:** kéo-thả PDF/DOCX + form metadata bắt buộc (tên, loại, cơ quan, phiên bản, hiệu lực).
- **Chi tiết:**
  - **Tiến trình xử lý:** `Đã tải → Đã đọc → Đã chia đoạn (Điều/Khoản) → Đã nhúng → Đã lập chỉ mục → Đã publish` (cập nhật qua thông báo/polling).
  - **Xem chunk:** danh sách đoạn kèm nhãn trích dẫn (*Điều 5 · Khoản 2 · tr.4*), sửa ranh giới/nhãn khi chia sai *(ADV)*.
  - **Publish:** cho phép truy hồi; tự đánh dấu phiên bản cũ là *Bị thay thế* (xác nhận để tránh dùng nhầm quy chế cũ). **Reindex**, **Lưu trữ**.
- **Sân thử truy hồi ("Test retrieval"):** nhập câu hỏi ⇒ top-k đoạn kèm similarity, **vạch ngưỡng**, và dòng *"Với ngưỡng hiện tại, hệ thống sẽ TRẢ LỜI / TỪ CHỐI (không đủ căn cứ)"* — giúp Admin tinh chỉnh chống hallucination.
- **API sử dụng:** `ADM-KB-01`, `ADM-KB-02`, `ADM-KB-03`, `ADM-KB-04`, `ADM-KB-05`, `ADM-KB-06`, `ADM-KB-07`, `ADM-KB-08`, `ADM-KB-09`, `ADM-KB-10`

### A07 · Cấu hình AI **[MVP]**
- **Route:** `/admin/ai-config`
- **Nhóm cấu hình:**
  - *OCR:* ngưỡng `low_confidence`.
  - *AI:* ngưỡng **abstain**, ngưỡng **NO_MATCH**, Top-K.
  - *RAG:* ngưỡng similarity, top-k, bật/tắt rerank.
  - *Xét duyệt:* **bật/tắt tự duyệt nội bộ** (mặc định **Tắt**, kèm giải thích), ngưỡng tự duyệt, tỷ lệ spot-check.
  - *Xác minh:* bật/tắt từng cấp L1–L4.
  - *Hàng đợi:* SLA (giờ) dùng cho công thức ưu tiên.
- **Điều khiển:** slider/số kèm giải thích *"tăng ngưỡng ⇒ hệ thống từ chối nhiều hơn, ít sai hơn"*; nút **Lưu** bắt buộc nhập **lý do thay đổi**; banner *"Thay đổi chỉ áp dụng cho hồ sơ mới, không tính lại hồ sơ cũ."*
- **Tab Lịch sử** *(ADV)*: diff cấu hình theo thời gian. **Tab Phiên bản đang dùng** *(ADV)*: model/prompt/pipeline (chỉ đọc).
- **API sử dụng:** `ADM-AI-01`, `ADM-AI-02`, `ADM-AI-03`, `ADM-AI-04`

### A08 · Ground Truth Dataset **[ADV — cần cho Exp.1, 2, 5, 8 ở mức MVP]**
- **Route:** `/admin/ground-truth`
- **Danh sách:** bộ lọc `nguồn (thật/synthetic) · scope · loại ca (certificate-only, trùng lặp, OCR lỗi, không khớp, hợp lệ…) · level xác minh · split (train/dev/test) · trạng thái nhãn`; cột Evidence ID, hoạt động, tiêu chí đúng, điểm đúng, hợp lệ, quyết định người, người gán nhãn.
- **Tạo bản ghi:** (1) **Từ hồ sơ thật** — chọn hồ sơ đã có quyết định, điền sẵn OCR text/ảnh/hoạt động/quyết định, Admin gán nhãn chuẩn; (2) **Synthetic** — tải giấy chứng nhận mẫu, chọn **biến thể sửa đổi có chủ đích** (sai ngày, sai tên đơn vị, lệch MSSV…), gắn `synthetic`.
- **Form nhãn:** hoạt động · loại · scope · tiêu chí đúng · điểm đúng · tính hợp lệ (hợp lệ/đáng ngờ/không hợp lệ) · phương thức xác minh áp dụng · quyết định người · lý do.
- **Bảng thống kê độ phủ:** phân bố theo loại ca, cảnh báo *"Thiếu ca certificate-only"* để bảo đảm bộ dữ liệu đủ ca âm/đáng ngờ. **Import/Export** (xuất luôn ẩn danh hóa MSSV/họ tên).
- **API sử dụng:** `ADM-GT-01`, `ADM-GT-02`, `ADM-GT-03`, `ADM-GT-04`, `ADM-GT-05`, `ADM-GT-06`, `ADM-GT-07`, `ADM-GT-08`, `EVD-05`, `EVD-06`

### A09 · Đánh giá AI **[ADV]**
- **Route:** `/admin/ai-evaluation`
- **5 tab:**
  1. **Dashboard theo thời gian:** đường Accuracy, Coverage, Abstention rate, **False Negative Rate**, MAE, RAG Hallucination rate; lọc theo module.
  2. **Thí nghiệm:** danh sách lần chạy (Exp.1–10) + **Chạy thí nghiệm** (chọn thí nghiệm, cấu hình **A–E**, tập dữ liệu/split); chi tiết mỗi lần chạy: bảng metric, **confusion matrix**, Precision/Recall theo level xác minh, và **danh sách mẫu sai** (click ⇒ xem chi tiết để phân tích lỗi).
  3. **Ablation A–E:** bảng và biểu đồ so sánh 5 cấu hình (OCR / +AI / +Verification / +Rule Engine / +RAG): Accuracy/F1 ánh xạ tiêu chí, MAE điểm, và cột nổi bật **Tỷ lệ điểm đề xuất vượt trần** (kỳ vọng giảm về 0% từ cấu hình D).
  4. **Selective prediction:** đường **Coverage ↔ Accuracy/Selective risk** theo ngưỡng abstention, đánh dấu ngưỡng đang dùng và cho phép xem điểm vận hành khác.
  5. **Xuất báo cáo:** CSV/PNG cho báo cáo đồ án.
- **Ghi chú:** luôn hiển thị **kích thước tập test** cạnh mỗi con số, kèm dòng *"Kết quả trên tập nhỏ, không khái quát quá mức"* (tránh overclaim, theo mục 36 tài liệu đề tài).
- **API sử dụng:** `ADM-EVAL-01`, `ADM-EVAL-02`, `ADM-EVAL-03`, `ADM-EVAL-04`, `ADM-EVAL-05`, `ADM-EVAL-06`, `ADM-EVAL-07`

### A10 · Nhật ký hệ thống (Audit Log) **[MVP cơ bản]**
- **Route:** `/admin/audit-logs`
- **Bộ lọc:** người thực hiện, role, hành động, loại đối tượng, ID đối tượng (ví dụ dán ID hồ sơ để xem toàn bộ lịch sử), khoảng thời gian.
- **Bảng:** thời gian, người thực hiện + role, hành động, đối tượng, tóm tắt. **Drawer chi tiết:** diff `trước/sau` (JSON diff), lý do, `request_id`, IP.
- **Tính toàn vẹn:** nút **Kiểm tra toàn vẹn** (kết quả *"Chuỗi hash hợp lệ"* hoặc chỉ ra bản ghi bị lệch) *(ADV)*; **Xuất** *(ADV)*.
- **Nguyên tắc UI:** **không có nút sửa hay xóa** bản ghi (append-only). Hành động của Admin khi ở chế độ break-glass hiển thị nhãn `acting_as_admin`.
- **API sử dụng:** `ADM-AUD-01`, `ADM-AUD-02`, `ADM-AUD-03`, `ADM-AUD-04`

### A11 · Giám sát job và sức khỏe hệ thống **[MVP sức khỏe · ADV quản lý job]**
- **Route:** `/admin/jobs`
- **Tab *Sức khỏe*:** thẻ trạng thái DB, hàng đợi, lưu trữ, dịch vụ OCR, LLM API, vector DB kèm độ trễ; tỷ lệ lỗi và chi phí/độ trễ LLM.
- **Tab *Job*:** bảng loại (OCR/AI/lập chỉ mục KB/đánh giá/xuất báo cáo), trạng thái, số lần thử, thời lượng, lỗi; chi tiết có log; **Thử lại** job lỗi.
- **API sử dụng:** `ADM-JOB-01`, `ADM-JOB-02`, `ADM-JOB-03`, `ADM-JOB-04`

---

## 10. Thư viện component dùng chung

| Component | Dùng ở | Mô tả |
|---|---|---|
| `StatusBadge` | S01, S04, S05, O02, O03… | Huy hiệu `display_status` (mục 4.1), có tooltip giải thích |
| `PipelineStepper` | S05, O03 | 7 bước, cập nhật SSE, dự phòng polling, bước lỗi hiển thị thân thiện |
| `VerificationPanel` | S05, O03 | Hai thẻ *hoạt động tồn tại / sinh viên tham gia* + thang mức + nguồn xác minh; biến thể Student (rút gọn) và Officer (đầy đủ) |
| `LevelLadder` | O02, O03, O04 | Thang L1–L5 hoặc I1–I3 |
| `EvidenceGapCard` | S01, S05, S06, S08, O03 | Checklist còn thiếu + nút hành động |
| `OCRFieldTable` | S05, O03 | Trường, confidence, so sánh với hồ sơ, sửa tại chỗ, tô sáng bbox |
| `DocumentViewer` | S03, S05, S06, O03 | Ảnh/PDF, zoom, xoay, nhiều tệp, so sánh 2 tệp, signed URL tự làm mới |
| `AISuggestionCard` | S05, O03 | Khung nét đứt ✦ *"Đề xuất — chưa phải điểm chính thức"*; biến thể Student/Officer |
| `CriterionTopK` | O03 | Bảng Top-K có radio, confidence, lý do, chip trích dẫn |
| `ScoreCompare` | O03 | `AI → Giới hạn → Chốt` kèm ✂ khi bị cắt |
| `RuleCheckList` | O03 | Từng kiểm tra Rule Engine ✔/✖ + mã rule/phiên bản |
| `OfficialScoreCard` | S05, S09 | Điểm chính thức + người duyệt + "Vì sao?" |
| `TraceDrawer` | S05, S09, O03 | Truy vết điểm từ điểm cuối đến nguồn xác minh |
| `CitationChip` / `CitationDrawer` | C04, S02, S05, S08, O03, A06 | Chip *Điều · Khoản*; click mở đoạn quy chế + phiên bản + hiệu lực |
| `DecisionBar` | O03 | Thanh quyết định cố định + hộp thoại Duyệt/Sửa/Từ chối/Bổ sung với kiểm tra lý do |
| `RejectBasisSelect` | O03 | Chỉ liệt kê căn cứ cụ thể; chặn lý do "không có trong dữ liệu" |
| `Timeline` | S05, S07, O03 | Lịch sử sự kiện (bản Student đã lọc) |
| `FileDropzone` | S03, S06, O04, O06, A02, A06 | Kéo-thả, kiểm tra kiểu/kích thước, tiến độ, trạng thái quét |
| `ImportWizard` | O06, O05, A02, A05 | 3 bước *Tải lên → Xem trước lỗi → Xác nhận* |
| `DataTable` | Hầu hết | Lọc, sắp xếp, phân trang, chọn nhiều dòng, lưu bộ lọc |
| `NotificationBell` | App shell | Số chưa đọc, dropdown, toast từ SSE |
| `ConfirmDialog` (có ô lý do) | A03, A05, A07, O03 | Cho hành động có hậu quả, bắt buộc lý do khi cần |
| `TermSelector` | App shell | Chọn kỳ; mặc định kỳ đang mở |

---

## 11. Các luồng UX chính

### 11.1 Sinh viên nộp chứng nhận ngoài trường chỉ có ảnh (Level 5)
```
S03 (Ngoài trường → nhập thông tin → tải ảnh → gửi)
  ─► S05 (stepper chạy: Đã tiếp nhận → Đọc → Đối chiếu → Đề xuất)
  ─► Hiển thị: Hoạt động "có vẻ hợp lý" · Tham gia "chưa xác minh độc lập" · ✦ Đề xuất 3đ
  ─► Tab "Còn thiếu": gợi ý danh sách KQ / xác nhận đơn vị / URL
       ├─ SV bổ sung ngay (S06) ─► xác minh chạy lại ─► O02 (ưu tiên cao hơn nếu đạt L1–L3)
       └─ SV chưa có ─► hồ sơ vẫn ở "Cần cán bộ xem xét" (KHÔNG bị từ chối)
  ─► Officer (O03): yêu cầu bổ sung / tự xác minh (verified by officer) / từ chối có căn cứ cụ thể
```

### 11.2 Officer xét một ngày làm việc
```
O01 (xem KPI) ─► O02 (hàng đợi theo ưu tiên) ─► O03 (claim tự động)
  ─► đối chiếu ảnh ↔ OCR ↔ xác minh ↔ AI/Top-K ↔ Rule Engine
  ─► [cần nguồn ngoài?] O04 thêm nguồn ─► kết quả cập nhật thang mức
  ─► Quyết định (Duyệt / Sửa / Từ chối / Yêu cầu bổ sung) + lý do
  ─► tự chuyển hồ sơ kế tiếp  ·  hồ sơ fast-track ─► duyệt hàng loạt ở O02
```

### 11.3 Admin cập nhật quy chế giữa kỳ
```
A06 tải tài liệu quy chế mới (metadata + hiệu lực) ─► xử lý/lập chỉ mục ─► Test retrieval
  ─► Publish (phiên bản cũ tự bị thay thế)
A05 soạn rule mới (nháp) ─► Validate ─► Simulate (phát lại hồ sơ cũ, xem tác động)
  ─► Publish (ngày hiệu lực + ghi chú) ─► Audit Log ghi lại
A07 (nếu cần) chỉnh ngưỡng ─► chỉ áp dụng hồ sơ mới
```

### 11.4 Khiếu nại
```
S05 (đã quyết định) ─► S07 tạo khiếu nại ─► O07 (Officer xem) ─┬─ Mở lại ─► O03 (quyết định mới) ─► S05 thông báo
                                                             └─ Từ chối (lý do) ─► S07 thông báo
```

---

## 12. Ưu tiên triển khai

| Mức | Trang |
|---|---|
| **MVP** (luồng nội bộ hoàn chỉnh + OCR cơ bản + Officer review + Audit cơ bản) | C01, C03, C04 (cơ bản), C05, C06 · S01, S02, S03, S04, S05, S06, S07, S09 · O01, O02, O03, O04 (L1/L5), O06, O07, O08, O09, O10 (cơ bản) · A01, A02, A03, A04, A05 (soạn/publish), A06, A07, A10 (cơ bản), A11 (sức khỏe) |
| **Advanced** | C02, C07 · S08 · O05, O04 (L2–L4), O10 đầy đủ · A05 (mô phỏng/phiên bản/import), A08, A09, A10 (toàn vẹn/xuất), A11 (quản lý job) · SSE thời gian thực (MVP có thể dùng polling) · hàng loạt fast-track · C04 đầy đủ |

Gợi ý thứ tự dựng (khớp lộ trình mục 38): **(1)** C01/C03/C06 + khung app + S03/S04 + A02/A03 + O06 → **(2)** S05 (tab OCR) + O03 (tab OCR) → **(3)** A04/A05 + O02/O03 đầy đủ + S09 + O07 → **(4)** C04 + A06 + AI tab → **(5)** O04/O05 + Evidence Gap + S06/S08 → **(6)** O10, A08, A09, A10, A11.

---

## 13. Phụ lục: văn bản chuẩn (copy) cho tình huống nhạy cảm

| Tình huống | Văn bản hiển thị (Student) | Ghi chú |
|---|---|---|
| Certificate-only | *"Thông tin trên tài liệu nhất quán với hồ sơ của bạn nhưng chưa có căn cứ độc lập để xác minh. Cán bộ sẽ xem xét, hoặc bạn có thể bổ sung tài liệu bên dưới để được xác minh nhanh hơn."* | Không dùng đỏ, không dùng từ "giả", "không hợp lệ" |
| Hoạt động không có trong dữ liệu trường | *"Hoạt động này chưa có trong danh sách của trường. Chúng tôi sẽ tìm nguồn xác minh độc lập hoặc chuyển cán bộ xem xét."* | Không suy diễn |
| Điểm danh `ABSENT` | *"Chưa thấy tên bạn trong danh sách điểm danh của hoạt động. Cán bộ sẽ kiểm tra lại — bạn có thể bổ sung minh chứng nếu có."* | Không kết luận |
| Điểm bị giới hạn | *"Đề xuất ban đầu cao hơn mức quy chế cho phép nên đã được điều chỉnh về {N} điểm theo {Điều, Khoản}."* | Kèm chip trích dẫn |
| AI không đủ chắc chắn | *"Hệ thống chưa đủ căn cứ để đề xuất tiêu chí/điểm cho hồ sơ này. Cán bộ sẽ xác định giúp bạn."* | Trạng thái `ABSTAINED`/`NO_MATCH` |
| Pipeline lỗi | *"Hệ thống chưa xử lý tự động được hồ sơ này và đã chuyển cho cán bộ."* | Ẩn chi tiết kỹ thuật |
| RAG không đủ căn cứ | *"Không tìm thấy thông tin đủ căn cứ trong tài liệu chính thức."* | Câu cố định, không thêm suy đoán |
| Điểm chờ duyệt | *"Đề xuất — chưa phải điểm chính thức."* | Luôn đi kèm khung nét đứt ✦ |
| Officer gõ lý do "không có trong dữ liệu" | *"Không tìm thấy trong dữ liệu trường không phải căn cứ từ chối. Hãy yêu cầu bổ sung hoặc nêu căn cứ cụ thể (mâu thuẫn, trùng lặp, bằng chứng sinh viên không tham gia…)."* | Chặn ở FE, BE kiểm tra lại |
| Risk signal (Officer) | *"Chỉ là cảnh báo rủi ro từ nhiều tín hiệu yếu, không phải căn cứ kết luận giả mạo."* | Luôn đi kèm mọi risk signal |
