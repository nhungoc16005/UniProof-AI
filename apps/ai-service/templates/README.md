# Kho phôi chuẩn (Lớp 6)

`registry.json` lưu danh mục phôi được cấp quyền dùng để so khớp bố cục minh chứng.
Đây chỉ là **tín hiệu hình ảnh**: khớp (`MATCH`) không chứng minh giấy thật, lệch
(`MISMATCH`) không được tự động kết luận giả mạo — mọi trường hợp `MISMATCH`/`UNKNOWN`
đều chuyển cán bộ (`REVIEW`).

## Quy tắc thêm phôi

1. Chỉ thêm phôi khi có **quyền sử dụng** và ghi rõ **nguồn** phát hành.
2. Ghi `effectiveFrom`/`effectiveTo` đúng theo thời gian hiệu lực của mẫu; mẫu hết hiệu lực
   sẽ bị loại khỏi so khớp.
3. Mỗi lần đổi bố cục phải tạo **mục mới** với `version` tăng dần; không sửa đè mục cũ.
4. Tệp phôi đặt trong `templates/files/` và tham chiếu bằng `fileRef`.

## Định dạng mục

```json
{
  "templateId": "GIAY_KHEN-DTN-2024-v1",
  "documentType": "GIAY_KHEN",
  "source": "Đoàn Thanh niên - Hội Sinh viên Trường Đại học Kinh tế - ĐHĐN",
  "effectiveFrom": "2024-01-01",
  "effectiveTo": null,
  "version": "1",
  "pHash": "d4c3b2a1e5f60718",
  "aspectRatio": 0.707,
  "fileRef": "templates/files/giay-khen-dtn-2024-v1.png"
}
```

- `documentType` khớp giá trị `EvidenceType` (`GIAY_KHEN`, `GIAY_XAC_NHAN`, `GIAY_HIEN_MAU`, ...).
- `pHash` là perceptual hash 16 ký tự hex của ảnh phôi (chuẩn hóa, không nén mất dữ liệu).
- `aspectRatio = width / height` của ảnh phôi.
- Ngưỡng so khớp cấu hình qua `TEMPLATE_MATCH_HAMMING_MAX` và `TEMPLATE_MATCH_ASPECT_TOLERANCE`.

Khi `templates` rỗng, mọi minh chứng nhận `status = UNKNOWN` và không thể xếp XANH — đây là
trạng thái trung thực cho tới khi có phôi được duyệt.
