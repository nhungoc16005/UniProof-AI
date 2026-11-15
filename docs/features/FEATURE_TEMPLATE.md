# Fxx — <Tên tính năng>

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản / ngày | <version> / <date> |
| Vai trò | <actor, phạm vi quyền> |
| Trạng thái | Draft / Implemented / Partial / Verified |
| Nguồn | <link file, controller, service, schema và test> |
| Quy tắc / gap | <R-xx, BL-xxx, Q-xx> |

## 1. Objective — Mục tiêu

Vấn đề, kết quả cần đạt, phạm vi và lý do.

## 2. User Story — Người dùng và kết quả

Là <vai trò>, tôi muốn <thao tác> để <kết quả>.
Trace: UI → API/DTO → guard → controller → service → transaction/Prisma → DB/Storage → response → UI.

## 3. Acceptance Criteria — Tiêu chí nghiệm thu

- Fxx-AC-01: Given <tiền điều kiện>, When <hành động>, Then <kết quả đo được>.
- Ghi hậu điều kiện, trạng thái, quyền và bất biến; tách hiện trạng khỏi yêu cầu chưa xác nhận.

## 4. UI/UX — Giao diện và tương tác

Điểm vào, màn hình, trường, validation, thông báo, thao tác bàn phím/mobile và URL.

## 5. API Contract — Hợp đồng API

Method/route, quyền service, query/body/DTO, response và mã lỗi. Liên kết API_CONTRACT thay vì chép bản khác dễ lệch.

## 6. Error Handling — Xử lý lỗi

Lỗi validation, quyền, deadline, xung đột version, DB/Storage, timeout và cách phục hồi.

## 7. Edge Cases — Trường hợp biên

Cạnh deadline, rỗng, trùng, hai request đồng thời, đổi kỳ, dữ liệu lịch sử và lỗi một phần.

## 8. UI States — Trạng thái giao diện

Loading / empty / ready / saving / success / error / read only, điều kiện chuyển và dữ liệu được giữ.

## 9. Test Cases — Kịch bản kiểm thử

| ID | Given / When / Then | AC / bug | Bằng chứng |
|---|---|---|---|
| Fxx-TC-01 | <kịch bản> | Fxx-AC-01 | Planned |

## 10. Definition of Done — Điều kiện hoàn thành

- [ ] AC và regression liên quan có bằng chứng phù hợp.
- [ ] Quyền, trạng thái, ca biên và môi trường đã được kiểm tra.
- [ ] Docs, backlog, test plan, changelog đã cập nhật.
- [ ] Câu hỏi chưa rõ và giới hạn kiểm chứng được ghi rõ.

## 11. Out of Scope — Ngoài phạm vi

Nêu việc không nằm trong yêu cầu đã được người dùng xác nhận.

