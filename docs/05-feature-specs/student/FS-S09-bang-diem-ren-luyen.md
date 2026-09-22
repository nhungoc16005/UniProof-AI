# FS-S09 — Bảng điểm Rèn luyện & Lịch sử các Kỳ

| Trace ID Trang FE | Mã Endpoint API BE | Phiên bản | Tác giả |
|:---:|:---:|:---:|:---:|
| **`S09`** | **`[SCO-02]` `[SCO-04]`** | 2.0 (Chuẩn hóa) | Team EduPoint |

> **Vai trò**: STUDENT (Mobile App). Ưu tiên: **[MVP]**

---

## 1. 🎯 Objective
Cung cấp bảng điểm rèn luyện chính thức của học kỳ hiện tại và lịch sử toàn bộ các học kỳ trước đó từ khi nhập học. Cho phép sinh viên xem chi tiết phân rã điểm (*Score Breakdown*), đối chiếu căn cứ từng hoạt động và xuất bảng điểm điện tử có mã QR xác thực dạng PDF.

---

## 2. 👤 User Story
> **As a** sinh viên,
> **I want to** xem lại lịch sử điểm rèn luyện của các kỳ trước và tải file PDF bảng điểm,
> **so that** tôi sử dụng làm hồ sơ xin học bổng, xét khen thưởng hoặc nộp cho nhà tuyển dụng.

---

## 3. ✅ Acceptance Criteria
- **AC-1**: Dropdown chọn học kỳ đánh giá (mặc định chọn kỳ gần nhất đã chốt sổ).
- **AC-2**: Hiển thị bảng phân rã điểm theo dạng bảng / danh sách gập mở: Từng khung tiêu chí $\rightarrow$ Danh sách minh chứng đã được duyệt trong kỳ $\rightarrow$ Điểm cộng $\rightarrow$ Cán bộ phê duyệt.
- **AC-3**: Nút **"Vì sao được X điểm?"**: Bấm vào mở drawer truy vết chi tiết (kèm mã minh chứng và căn cứ trích dẫn quy chế).
- **AC-4**: Xuất bảng điểm PDF (`[SCO-04]`): Tạo file PDF chính thức có dấu mộc số và mã QR code để bên ngoài quét kiểm tra tính xác thực qua cổng `C07`.

---

## 4. 📡 API Contract (Dẫn chiếu `EduPoint_API_BE.md`)

### 4.1 `[SCO-02]` Lấy lịch sử điểm các học kỳ
- **GET** `/api/v1/scores/my/history`
- **Auth**: Bearer `<access_token>`

**Response (200 OK):**
```json
{
  "data": [
    {
      "term_id": "term_2025_2",
      "term_name": "Học kỳ 2 (2025-2026)",
      "final_score": 88.0,
      "grade": "TỐT",
      "is_closed": true,
      "details": [
        { "category": "I", "score": 18.0, "max_cap": 20.0 },
        { "category": "II", "score": 25.0, "max_cap": 25.0 },
        { "category": "III", "score": 16.0, "max_cap": 20.0 },
        { "category": "IV", "score": 21.0, "max_cap": 25.0 },
        { "category": "V", "score": 8.0, "max_cap": 10.0 }
      ]
    }
  ]
}
```

### 4.2 `[SCO-04]` Xuất file PDF bảng điểm rèn luyện
- **GET** `/api/v1/scores/my/export?term_id={termId}&format=pdf`
- **Response**: Trả về link tải file PDF có chữ ký số xác thực.
