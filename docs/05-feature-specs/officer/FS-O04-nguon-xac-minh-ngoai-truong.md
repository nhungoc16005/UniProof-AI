# FS-O04 — Quản lý Nguồn Xác minh Ngoài trường (External Verification)

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`O04`** | **`[EXT-01]` `[EXT-02]` `[EXT-03]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: OFFICER (Cán bộ Khoa / Phòng CTSV). Ưu tiên: **[MVP mức L1/L5 · ADV mức L2–L4]**

---

## 1. 🎯 Objective
Hỗ trợ Cán bộ thẩm định và xác minh các minh chứng hoạt động do các đơn vị ngoài trường tổ chức theo thang đo **5 cấp độ xác minh (Level 1 đến Level 5)**:
- **L1 (Chính thức)**: Mã QR chứng chỉ số có chữ ký số hoặc API tra cứu trực tuyến.
- **L2 (Xác nhận đơn vị tổ chức)**: Gửi email/cổng `C07` cho người phụ trách ngoài trường xác nhận.
- **L3 (Danh sách tham gia)**: File PDF/Excel danh sách thí sinh/tình nguyện viên do BTC công bố.
- **L4 (Nguồn công khai)**: Bài viết báo chí, website truyền thông đưa tin về sự kiện.
- **L5 (Chỉ có chứng nhận - Certificate only)**: Chỉ có ảnh chụp giấy khen, không có nguồn đối chứng độc lập $\rightarrow$ Chuyển Cán bộ phỏng vấn/xem xét (`NEEDS_HUMAN_REVIEW`).

---

## 2. 👤 User Story
> **As a** cán bộ duyệt hồ sơ ngoài trường,
> **I want to** kiểm tra link xác minh hoặc nhập nguồn đối chứng độc lập,
> **so that** tôi nâng cấp độ xác minh của minh chứng từ L5 lên mức cao hơn và an tâm cộng điểm.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Tự động bóc tách và kiểm tra URL/QR code từ ảnh qua `[EXT-01]` (chống tấn công SSRF, chỉ cho phép domain an toàn).
- **AC-2**: Bóc tách nội dung bài viết báo chí hoặc thông báo công khai từ link web qua `[EXT-02]`.
- **AC-3**: Cán bộ có quyền ghi nhận nguồn xác minh thủ công vào hồ sơ qua `[EXT-03]` để lưu bằng chứng kiểm toán.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

- `[EXT-01]` `POST /api/v1/external/verify-source` (Kiểm tra URL xác chỉ hoặc mã QR)
- `[EXT-02]` `POST /api/v1/external/extract-source` (Trích xuất văn bản từ website công khai)
- `[EXT-03]` `POST /api/v1/evidence/{id}/sources` (Ghi nhận nguồn xác minh)

**Payload mẫu `[EXT-03]`:**
```json
{
  "source_type": "ORGANIZER_WEBSITE",
  "source_url": "https://doanthanhnien.vn/tin-tuc/tong-ket-chien-dich-mua-he-xanh-2026",
  "verification_level": "L4_PUBLIC_SOURCE",
  "notes": "Trang tin chính thức của Thành Đoàn đăng bài có ảnh và danh sách tập thể khen thưởng."
}
```
