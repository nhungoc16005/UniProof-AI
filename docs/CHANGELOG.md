# Nhật ký công việc

Mỗi công việc trong dự án thêm mục mới ở đầu với ngày, phạm vi, feature/bug/quyết định liên quan, thay đổi thực tế, kiểm tra đã chạy và giới hạn. Không ghi test dự kiến như đã Passed, không ghi credential hoặc dữ liệu sinh viên.

## 2026-11-15 — Sửa nhóm lỗi Bảo mật & Đăng nhập P0: BL-002, BL-001, BL-009

- **Phạm vi & mục tiêu:** Xử lý 3 lỗi bảo mật P0 (Confirmed) phát hiện trong audit theo đúng kế hoạch đã thống nhất với người dùng. Giữ nguyên rubric hiện hành, DB schema và dữ liệu.
- **Thay đổi thực tế mã nguồn:**
  - `BL-002`: Sửa `apps/backend/src/reviews/reviews.service.ts` (dòng 226), thay `reviewer: true` bằng projection `reviewer: { select: { id: true, fullName: true, role: true } }`, loại bỏ hoàn toàn `password` hash và `authVersion` khỏi response duyệt minh chứng.
  - `BL-001`: Sửa `apps/backend/src/conduct-scores/conduct-scores.controller.ts` và `conduct-scores.service.ts`: bổ sung `resolveTermId(termId)` để xác định kỳ duy nhất một lần trước khi kiểm quyền; nếu kỳ không tồn tại ném `NotFoundException`; nếu hệ thống không có kỳ nào trả `getEmptyScore()` (không truy vấn lại DB tìm kỳ lần 2); request có hoặc không có `termId` đều áp dụng cùng ranh giới snapshot `assessmentHandoff.facultyId` của kỳ đó, chặn cán bộ Khoa mới xem kỳ thuộc Khoa lịch sử cũ của sinh viên chuyển Khoa.
  - `BL-009`: Tạo helper `apps/backend/src/auth/jwt-config.helper.ts`, chuyển `JwtModule.register` sang `JwtModule.registerAsync` inject `ConfigService` trong `auth.module.ts`, và inject `ConfigService` vào constructor của `jwt.strategy.ts`. Đảm bảo bên ký và bên xác thực cùng đọc secret từ `ConfigService` thống nhất một nguồn với thời hạn token 12h.
- **Kiểm thử thực chạy và kết quả:**
  - Tạo bộ test cô lập [apps/backend/test/security-fixes.test.cjs](../apps/backend/test/security-fixes.test.cjs) chạy bằng Node.js test runner (`node --test`), bao gồm 3 suite và 16 ca kiểm thử:
    + BL-002 (2 tests): Kiểm tra projection `select` an toàn; assert response không chứa `password` hay `authVersion`; kèm test chứng minh mã cũ dùng `reviewer: true` chắc chắn làm rò rỉ password hash từ bảng User.
    + BL-001 (10 tests):
      * Tra cứu cán bộ: kỳ không tồn tại ném `NotFoundException`; DB rỗng trả `getEmptyScore()`; thiếu snapshot ném `ForbiddenException`; cán bộ Khoa mới bị chặn khi tra cứu kỳ lịch sử cũ (cả có và không kèm `termId`); cán bộ Khoa lịch sử truy cập thành công; bằng chứng đỏ logic cũ bỏ qua snapshot kỳ khi thiếu `termId` khiến cán bộ Khoa mới vượt ranh giới.
      * Dashboard sinh viên (GET /scores/dashboard): tự động chọn kỳ ACTIVE khi không kèm `termId` (gọi DB `findFirst` đúng 1 lần); tự động chọn kỳ latest (startDate desc) khi không có ACTIVE; chọn đúng kỳ cụ thể khi truyền `termId` (gọi `findFirst` 0 lần, `findUnique` 2 lần: resolve và load); trả `getEmptyScore()` khi DB rỗng.
    + BL-009 (4 tests): Sử dụng trực tiếp `jwtModuleAsyncOptions.useFactory` từ `auth.module.ts` và `@nestjs/jwt` `JwtService` thật để ký token 12h; xác thực thành công qua cơ chế `strategy.authenticate(req)` thật của Passport; tái hiện token ký bằng fallback secret bị từ chối (`invalid signature`); production thiếu secret ném lỗi.
    + Kết quả: 16/16 tests pass (thời gian chạy: 2.6s).
  - Chạy lại test suite worker có sẵn: `node --test apps/backend/test/evidence-processing-worker.test.cjs` $\rightarrow$ 15/15 tests pass.
  - Chạy typecheck TypeScript toàn backend: `./apps/backend/node_modules/.bin/tsc --noEmit --incremental false -p apps/backend/tsconfig.json` $\rightarrow$ Đạt 0 lỗi, không sinh cache file.
- **Tài liệu cập nhật & đồng bộ:**
  - `docs/BUSINESS_LOGIC_AUDIT.md`: Đổi trạng thái BL-001, BL-002, BL-009 sang `Resolved`, bổ sung bằng chứng và giới hạn kiểm chứng; cập nhật dòng tổng kết đầu báo cáo thành: 24 mục Open (22 Confirmed, 2 Potential) và 3 mục Resolved, loại bỏ mâu thuẫn "tất cả 27 mục Open / chưa sửa code".
  - `docs/README.md` & `docs/PROJECT_OVERVIEW.md`: Đồng bộ số lượng 3 mục Resolved, 24 mục Open.
  - `docs/BACKLOG.md`: Đổi trạng thái BL-001, BL-002, BL-009 sang `Done` và cập nhật ghi chú lộ trình đợt 1.
  - `docs/TEST_PLAN.md`: Bổ sung suite `security-fixes.test.cjs` (16 tests pass) và kết quả kiểm thử.
  - `docs/features/01-accounts-and-access.md`, `docs/features/07-evidence-review-and-verification.md`, `docs/features/09-faculty-handoff.md`, `docs/features/12-scores-reports-and-exports.md`: Cập nhật trạng thái gap audit đã giải quyết và test case nghiệm thu.
- **Giới hạn còn lại:** Các kiểm chứng trên là pure unit test in-memory (Node test runner + Passport strategy thật); chưa kiểm chứng trên DB staging/production hay môi trường deployment thực tế.

## 2026-11-15 — DEC-006: Rubric giữ nguyên qua kỳ mới nếu không thay đổi

- Ghi nhận xác nhận trực tiếp của người dùng: giữ nguyên rubric hiện hành qua các kỳ; chỉ thay nội dung khi có thay đổi thực sự. Sửa diễn đạt trước đó có thể khiến hiểu rằng mỗi kỳ phải chỉnh rubric.
- Đối chiếu CriteriaService.createTerm/persistTermRubricDraft và màn TermsMasterData: code sao chép nội dung nhưng tạo DRAFT/yêu cầu ban hành cho từng kỳ; ghi hiện trạng riêng với yêu cầu, theo dõi REQ-002 Open.
- Cập nhật DECISIONS, R-08, feature F03/F04, overview, backlog/lộ trình, test plan và AGENTS. Q-02 vẫn chỉ hỏi phần thiếu/mâu thuẫn; không yêu cầu đặt lại mức điểm mỗi kỳ. Giữ nguyên 27 finding và trạng thái audit.
- Phân biệt rubric nghiệp vụ với bản ghi/snapshot kỹ thuật; chưa chọn thay đổi schema, không sửa code hoặc dữ liệu. API contract hiện tại giữ nguyên vì chưa đổi endpoint/hành vi.
- Bổ sung 3 ca feature Planned; không chạy application/DB/Storage/AI tests. Kiểm tra đạt: 812 liên kết/vị trí nguồn hợp lệ, đủ 11 mục/spec và 76 cặp AC/TC, DEC-006 được tham chiếu ở các tài liệu liên quan, giữ nguyên 27 finding; `git diff --check` đạt và chỉ có thay đổi Markdown.

## 2026-11-15 — Lộ trình công việc sau audit

- Đối chiếu overview, quy tắc, feature tài khoản/tệp, audit, backlog, decisions và test plan để đề xuất thứ tự xử lý tiếp theo.
- Bổ sung lộ trình sáu bước vào BACKLOG: baseline/môi trường kiểm thử, chốt Q-01…Q-03, P0, P1 và P2 cùng luồng, nghiệm thu toàn kỳ, hoàn thiện bàn giao.
- Đề xuất đợt đầu gồm baseline kiểm thử và BL-002/001/009; chưa coi đây là yêu cầu sửa code được duyệt. Mọi BL vẫn Open, Q chưa được tự giải quyết.
- Chỉ cập nhật BACKLOG và CHANGELOG; spec/API/rules giữ nguyên vì không đổi yêu cầu hoặc hành vi. Không chạy application tests, backend, DB/Storage/AI; kiểm tra Markdown/link/diff cho hai tài liệu được cập nhật.

## 2026-11-15 — DOC-001: Hợp nhất tài liệu quản lý dự án

- Tạo 9 tài liệu dùng chung trong docs, 14 feature spec và 1 template theo 10 mục + Out of Scope.
- Ghi overview/module/workflow/model/migration/navigation, 28 quy tắc, inventory 121 route/45 lớp DTO, 27 finding audit và backlog. Finding giữ Open; 25 Confirmed/2 Potential.
- Tách 9 câu hỏi chính sách khỏi yêu cầu đã có căn cứ; giữ proposal hữu ích và ghi rõ tài liệu handoff cũ không có trong repo.
- Cập nhật README root và AGENTS cho quy trình đọc docs trước làm/cập nhật docs sau làm.
- Hợp nhất 6 file Markdown cũ vào docs trước khi xóa; nội dung navigation/dashboard còn giá trị được giữ, claim test cũ được đánh dấu historical.
- Phạm vi: Markdown; giữ nguyên application code, schema, migration, dependency/lockfile và dữ liệu.
- Kiểm tra đạt: inventory AST khớp 121 route/45 lớp DTO; đủ 24 file trong docs (14 spec + template + 9 tài liệu chung), 11 mục/spec, 27 finding đủ 11 trường, ID/metadata và 806 liên kết/anchor/vị trí nguồn hợp lệ; không có link hỏng hoặc whitespace thừa. `git diff --check` đạt; diff chỉ Markdown đúng phạm vi, 6 file cũ đã được xóa sau hợp nhất.
- Không chạy ứng dụng, DB/Storage/AI hoặc integration/browser tests. Kết quả pure/ad hoc từ audit trước chỉ được lưu với nhãn historical, không chạy lại để làm tài liệu.

