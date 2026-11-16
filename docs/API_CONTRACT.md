# Hợp đồng API EduPoint

Đối chiếu mã nguồn ngày 2026-11-15, baseline `93fb66c`. Có **121 route khai báo**, **45 lớp tên kết thúc Dto** (gồm body/query, cả DTO kế thừa). Danh mục được trích từ AST controller; không đồng nghĩa mọi route đều cho phép thao tác. Không khởi động Swagger/backend trong đợt tài liệu.

## Giao tiếp và xác thực

- Prefix `/api`; Web dùng Axios tại [apiClient.ts](../apps/web/src/lib/apiClient.ts).
- Swagger `/api/docs` mở khi ngoài production hoặc `ENABLE_SWAGGER=true`; không mặc định public trong production.
- `Authorization: Bearer <JWT>`; JWT thời hạn 12 giờ. Guard xác thực đọc lại User, isActive, authVersion và phân công từ DB. Role enum: STUDENT, STAFF, ADMIN.
- Quyền trong bảng là decorator controller. **Service vẫn quyết định ownership, Khoa snapshot, kỳ, deadline, trạng thái và khóa bàn giao.** ADMIN được khai báo trên route không bảo đảm có quyền chấm/giải quyết phúc khảo trong workflow mới.
- ValidationPipe: whitelist, transform, forbidNonWhitelisted, implicit conversion. Validation theo decorator chỉ đầy đủ khi tham số là lớp DTO cụ thể; inline object, `any`, `unknown` không tự có validation trường. Optional TypeScript không thay thế `IsOptional`.
- JSON body limit 12 MB; upload chuyển DataURL vào Storage, tệp tối đa 8 MB theo service. Không mặc định multipart.
- POST theo mặc định Nest thường 201; GET/PUT/PATCH/DELETE thường 200 nếu controller không override. Kiểm tra từng handler trước khi client phụ thuộc status chính xác.

Nguồn cấu hình: [main.ts](../apps/backend/src/main.ts), [AuthModule](../apps/backend/src/auth/auth.module.ts), [JwtStrategy](../apps/backend/src/auth/jwt.strategy.ts).

<a id="envelopes"></a>

## Response envelope

[ResponseInterceptor](../apps/backend/src/common/interceptors/response.interceptor.ts) giữ nguyên response đã có success/data; các dạng list khác không đồng nhất:

| Nhóm | Dạng response |
|---|---|
| Đối tượng thông thường | `{success:true,data:object,meta:{timestamp}}` |
| List service trả items/total | `{success:true,data:[],meta:{total,page,pageSize,...}}` |
| Workflow, results, AI jobs đã bọc sẵn | `{success:true,data:{items,total,page,pageSize,...}}` |
| Notifications | `{success:true,data:{items,unreadCount},meta:{timestamp}}` |
| Lỗi | `{success:false,error:{code,message,details},meta:{timestamp,path}}` |

Ví dụ danh sách thông thường (giá trị minh họa, không phải dữ liệu thật):

```json
{"success":true,"data":[],"meta":{"total":0,"page":1,"pageSize":20}}
```

Workflow:

```json
{"success":true,"data":{"items":[],"total":0,"page":1,"pageSize":25,"summary":{},"facultyProgress":[],"filters":{},"term":{},"updatedAt":"2026-11-15T00:00:00Z"}}
```

Dùng parser đúng dạng endpoint; BL-018 là ví dụ mất meta. Interceptor không tự loại password/hash trong nested relation, xem BL-002.

## Query, pagination và nguồn kết quả

| API | Query/hành vi quan trọng |
|---|---|
| Workflow `/:termId` và `/export` | q, classId, facultyId, state, page=1, pageSize=25 tối đa 100; export trả toàn tập có quyền |
| Reports results/export | ReportQueryDto thêm termId; publication mới nhất, legacy rubric khi kỳ cũ; distribution/average/classProgress trên toàn tập lọc |
| Users | role, facultyId, classId, termId, search; mặc định50, tối đa 100; termId không bảo đảm ADMIN list đã giới hạn roster (BL-020) |
| Evidence/reviews | Mặc định20; không suy tất cả tham số đã được cap/validate như WorkflowQueryDto |
| Appeals | Mặc định20, take có cap100; kiểm tra skip theo pageSize caller khi mở rộng |
| Profile issues | page, status; pageSize25 cố định |
| Audit logs | userId, action, entityType, search, page, pageSize; tìm kiếm backend |
| AI jobs | termId, status, page=1, pageSize=25 tối đa 100 |
| Notifications | 50 bản ghi gần nhất, unreadCount; không có API đọc mọi trang trong hợp đồng hiện tại |

Workflow state: NOT_SUBMITTED, STUDENT_RETURNED, REVIEWING, READY, SENT, PUBLISHED, FACULTY_RETURNED, NOT_SUBMITTED_RECORDED. APPEALS/RETURNED là bộ lọc tổng hợp; SENT filter bao gồm PUBLISHED. Summary không lấy từ số dòng đang hiển thị. Các state này được suy từ nhiều bảng, khác enum AssessmentHandoffStatus.

Kết quả gồm nguồn HANDOFF_SNAPSHOT cho CTSV xem phiếu đã gửi; báo cáo có LATEST_PUBLICATION/PUBLICATION hoặc LEGACY_RUBRIC/UNPUBLISHED theo endpoint. Không dùng selfScore hay AI suggestion làm officialScore công bố.

## Contract các thao tác chính

| Thao tác | Request và hậu điều kiện |
|---|---|
| Login | LoginDto email/password → access token và user an toàn; first-login hiện UI enforce, xem BL-016 |
| Tự đánh giá | Lưu điểm theo criterionId và query termId; preflight trả canSubmit/blockers/warnings/effectiveDeadline; POST /assessments/me/submit?termId=... không có body, chuyển phiếu và nháp đủ tệp sang xử lý |
| Tạo minh chứng | CreateEvidenceDto cần declaredActivityName/evidenceType; term/criterion liên hệ rubric do service kiểm tra; draft=true giữ nháp |
| Upload nháp | UploadEvidenceFileDto fileName/fileType/fileData (DataURL), tối đa 8 MB; chỉ nháp; bọc transaction khóa Term qua studentEdit. Phản hồi trả về `EvidenceFile`: `{ id, evidenceId, fileUrl, fileType, fileName, fileSize, signedUrlAvailable: boolean, message?: string }`. Nếu ký URL tạm thời lỗi: không xóa Storage, trả `signedUrlAvailable: false` và `message` hướng dẫn tải lại |
| Xóa tệp nháp | `DELETE /api/evidence/:id/files/:fileId`: chỉ sinh viên sở hữu; bọc transaction khóa Term qua studentEdit. Dọn Storage sau khi DB commit; phản hồi: `{ deleted: true, storageCleaned: boolean }` |
| Xóa hồ sơ nháp | `DELETE /api/evidence/:id`: chỉ sinh viên sở hữu và hồ sơ DRAFT chưa có lịch sử AI; bọc transaction khóa Term qua studentEdit. Danh sách tệp được đọc bên trong lock và dọn Storage sau commit; phản hồi: `{ id: string, deleted: true, filesCleaned: number, filesPendingCleanup: number }` |
| Tra cứu minh chứng | `GET /api/evidence` và `GET /api/evidence/:id`: trả danh sách/chi tiết có mảng `files`, mỗi file kèm `signedUrlAvailable: boolean`. Nếu `signedUrlAvailable: false` (signing lỗi), `fileUrl` giữ nguyên đường dẫn lưu trữ nội bộ `evidence/...` để client hiển thị trạng thái chưa có liên kết xem |
| Duyệt minh chứng | ReviewDecisionDto action/comment; expectedVersion optional để tương thích client cũ; REJECTED cần rejectBasis; SUPPLEMENT_REQUESTED có missingItem/supplementDeadline |
| Thêm nguồn | sourceName, sourceUrl?, note, level, confirmedActivity, confirmedStudent; lưu VerificationResult/audit; không ghi điểm |
| Bổ sung | explanation?, verificationUrl?, fileData?, fileName?, fileType?; ít nhất một nội dung; PDF/JPEG/PNG/WebP theo nhánh supplement |
| Xác minh tiêu chí | VerificationDto data object, note; evaluateRubricCriterion tạo suggestion, có invalidate điểm cũ; kiểm kiểu bên trong còn gap BL-017 |
| Chốt tiêu chí | FinalAssessmentDto score?, reason?; cần đủ dữ liệu chính thức và quyền STAFF trong workflow mới |
| Gửi Khoa | SendDto studentIds 1–100; server kiểm blockers/lock và tạo handoff snapshot/revision; lặp SENT không nhân revision |
| Trả/ghi nhận không nộp/hiệu chỉnh/loại trừ | ReasonDto reason; service kiểm không trắng, quyền và trạng thái riêng; restore không dùng body |
| Công bố/chốt | Không dùng trạng thái nút UI làm bằng chứng đủ điều kiện; kiểm lại conditions trong transaction khóa Term |
| Gia hạn | CreateExtensionDto termId,targetType(STUDENT/CLASS),targetId,type(SUBMISSION/REVIEW/APPEAL),deadline,reason; thu hồi qua DELETE giữ lịch sử |
| Profile issue | create category/content; resolve status RESOLVED/REJECTED + resolution, không tự sửa thông tin User chỉ bằng việc resolve issue |
| Regulation | PATCH status ACTIVE/EXPIRED giữ liên kết lịch sử; xóa bị chặn khi còn được dùng |

Ví dụ yêu cầu bàn giao:

```http
POST /api/evaluation-workflow/<termId>/send
Authorization: Bearer <JWT>
Content-Type: application/json

{"studentIds":["<studentId>"]}
```

Pipeline ngoài backend gọi `POST <AI_PIPELINE_URL>/evidence/process`, có thể thêm Bearer AI_PIPELINE_TOKEN. Input có evidenceId/termId/activityName/description/declaredRole/evidenceType/participationDate/criterion/files URL ký. Output worker đang nhận `{suggestions:[{criterionId,suggestedScore,reasoning,confidenceScore}]}`; validate rubric, điểm và confidence rồi lưu AiSuggestion. Không suy ra OCR/verification/anomaly đã được ghi từ output này.

## Lỗi và route giới hạn

[HttpExceptionFilter](../apps/backend/src/common/filters/http-exception.filter.ts) ánh xạ 400 validation/nghiệp vụ, 401 xác thực, 403 phạm vi/quyền, 404 không tìm thấy, 409 trùng/xung đột, 429 giới hạn theo endpoint, 503 dịch vụ chưa sẵn sàng, 500 nội bộ. Prisma P2002→409, P2025→404, P2003→400; không trả raw query.

- `POST /auth/forgot-password` hiện trả503; không có controller reset-password hoàn chỉnh. Web /reset-password redirect về forgot.
- Route assessment `.../:criterionId/class` và term reopen hiện luôn từ chối theo service; tồn tại route không phải tính năng đã mở.
- Kỳ mới được tạo UPCOMING; DTO có status không cho phép bỏ qua publish/activation.
- CreateActivityDto.startDate bắt buộc theo validator/service dù một mô tả Swagger có thể gợi ý optional.
- API khai báo ADMIN ở assessments/appeals không thay thế hạn chế STAFF trong service.
- Normal draft upload chưa có MIME allowlist chặt như supplement; không mô tả cả hai giống nhau.
- Nhược điểm hiện tại: [audit](BUSINESS_LOGIC_AUDIT.md). Không coi tài liệu hợp đồng là bản sửa code.

## Danh mục 121 route

Body/Query/Param là tên tham số decorator và kiểu TS trực tiếp, không phải toàn bộ validation nghiệp vụ. `*` là toàn object. Những lớp có tên trong phụ lục DTO có decorator riêng.

| Method | Route đầy đủ | Quyền khai báo | Body | Query | Path params | Nguồn |
|---|---|---|---|---|---|---|
| GET | `/api/activities` | JWT | — | type: ActivityType; search: string; termId: string | — | [apps/backend/src/activities/activities.controller.ts:18](../apps/backend/src/activities/activities.controller.ts#L18) |
| GET | `/api/activities/:id` | JWT | — | — | id: string | [apps/backend/src/activities/activities.controller.ts:24](../apps/backend/src/activities/activities.controller.ts#L24) |
| POST | `/api/activities` | ADMIN, STAFF | *: CreateActivityDto | — | — | [apps/backend/src/activities/activities.controller.ts:30](../apps/backend/src/activities/activities.controller.ts#L30) |
| POST | `/api/activities/:id/attendance` | ADMIN, STAFF | *: AddParticipantDto | — | id: string | [apps/backend/src/activities/activities.controller.ts:37](../apps/backend/src/activities/activities.controller.ts#L37) |
| POST | `/api/activities/:id/attendance/batch` | ADMIN, STAFF | *: BatchAttendanceDto | — | id: string | [apps/backend/src/activities/activities.controller.ts:44](../apps/backend/src/activities/activities.controller.ts#L44) |
| GET | `/api/activities/:id/attendance` | ADMIN, STAFF | — | — | id: string | [apps/backend/src/activities/activities.controller.ts:55](../apps/backend/src/activities/activities.controller.ts#L55) |
| POST | `/api/activities/:id/attendance/confirm` | ADMIN, STAFF | *: ConfirmAttendanceDto | — | id: string | [apps/backend/src/activities/activities.controller.ts:62](../apps/backend/src/activities/activities.controller.ts#L62) |
| POST | `/api/activities/:id/attendance/:participantId/revoke` | ADMIN, STAFF | *: RevokeAttendanceDto | — | id: string; participantId: string | [apps/backend/src/activities/activities.controller.ts:69](../apps/backend/src/activities/activities.controller.ts#L69) |
| DELETE | `/api/activities/:id/attendance/:participantId` | ADMIN, STAFF | — | — | id: string; participantId: string | [apps/backend/src/activities/activities.controller.ts:76](../apps/backend/src/activities/activities.controller.ts#L76) |
| PATCH | `/api/activities/:id` | ADMIN, STAFF | *: UpdateActivityDto | — | id: string | [apps/backend/src/activities/activities.controller.ts:87](../apps/backend/src/activities/activities.controller.ts#L87) |
| DELETE | `/api/activities/:id` | ADMIN, STAFF | — | — | id: string | [apps/backend/src/activities/activities.controller.ts:94](../apps/backend/src/activities/activities.controller.ts#L94) |
| GET | `/api/appeals` | JWT | — | status: AppealStatus; termId: string; page: number; pageSize: number | — | [apps/backend/src/appeals/appeals.controller.ts:18](../apps/backend/src/appeals/appeals.controller.ts#L18) |
| POST | `/api/appeals` | STUDENT | *: CreateAppealDto | — | — | [apps/backend/src/appeals/appeals.controller.ts:30](../apps/backend/src/appeals/appeals.controller.ts#L30) |
| POST | `/api/appeals/:id/resolve` | ADMIN, STAFF | *: ResolveAppealDto | — | id: string | [apps/backend/src/appeals/appeals.controller.ts:37](../apps/backend/src/appeals/appeals.controller.ts#L37) |
| GET | `/api/assessments/me` | STUDENT | — | termId: string | — | [apps/backend/src/assessments/assessments.controller.ts:53](../apps/backend/src/assessments/assessments.controller.ts#L53) |
| GET | `/api/assessments/me/preflight` | STUDENT | — | termId: string | — | [apps/backend/src/assessments/assessments.controller.ts:59](../apps/backend/src/assessments/assessments.controller.ts#L59) |
| PUT | `/api/assessments/me/:criterionId` | STUDENT | *: SelfAssessmentDto | termId: string | criterionId: string | [apps/backend/src/assessments/assessments.controller.ts:65](../apps/backend/src/assessments/assessments.controller.ts#L65) |
| POST | `/api/assessments/me/save` | STUDENT | *: SelfAssessmentBatchDto | termId: string | — | [apps/backend/src/assessments/assessments.controller.ts:76](../apps/backend/src/assessments/assessments.controller.ts#L76) |
| POST | `/api/assessments/me/submit` | STUDENT | — | termId: string | — | [apps/backend/src/assessments/assessments.controller.ts:82](../apps/backend/src/assessments/assessments.controller.ts#L82) |
| GET | `/api/assessments/students/:studentId` | STAFF, ADMIN | — | termId: string | studentId: string | [apps/backend/src/assessments/assessments.controller.ts:88](../apps/backend/src/assessments/assessments.controller.ts#L88) |
| PUT | `/api/assessments/students/:studentId/:termId/:criterionId/class` | STAFF, ADMIN | *: ClassAssessmentDto | — | studentId: string; termId: string; criterionId: string | [apps/backend/src/assessments/assessments.controller.ts:98](../apps/backend/src/assessments/assessments.controller.ts#L98) |
| PUT | `/api/assessments/students/:studentId/:termId/:criterionId/verification` | STAFF, ADMIN | *: VerificationDto | — | studentId: string; termId: string; criterionId: string | [apps/backend/src/assessments/assessments.controller.ts:110](../apps/backend/src/assessments/assessments.controller.ts#L110) |
| PUT | `/api/assessments/students/:studentId/:termId/:criterionId/final` | STAFF, ADMIN | *: FinalAssessmentDto | — | studentId: string; termId: string; criterionId: string | [apps/backend/src/assessments/assessments.controller.ts:122](../apps/backend/src/assessments/assessments.controller.ts#L122) |
| PUT | `/api/assessments/students/:studentId/:termId/return` | STAFF, ADMIN | *: ReturnSelfAssessmentDto | — | studentId: string; termId: string | [apps/backend/src/assessments/assessments.controller.ts:134](../apps/backend/src/assessments/assessments.controller.ts#L134) |
| GET | `/api/health/live` | Public | — | — | — | [apps/backend/src/audit-log/audit-log.controller.ts:14](../apps/backend/src/audit-log/audit-log.controller.ts#L14) |
| GET | `/api/audit-logs` | ADMIN | — | userId: string; action: string; entityType: string; search: string; page: number; pageSize: number | — | [apps/backend/src/audit-log/audit-log.controller.ts:20](../apps/backend/src/audit-log/audit-log.controller.ts#L20) |
| GET | `/api/health` | ADMIN | — | — | — | [apps/backend/src/audit-log/audit-log.controller.ts:36](../apps/backend/src/audit-log/audit-log.controller.ts#L36) |
| POST | `/api/auth/login` | Public | *: LoginDto | — | — | [apps/backend/src/auth/auth.controller.ts:15](../apps/backend/src/auth/auth.controller.ts#L15) |
| GET | `/api/auth/me` | JWT | — | — | — | [apps/backend/src/auth/auth.controller.ts:21](../apps/backend/src/auth/auth.controller.ts#L21) |
| POST | `/api/auth/change-password` | JWT | *: ChangePasswordDto | — | — | [apps/backend/src/auth/auth.controller.ts:29](../apps/backend/src/auth/auth.controller.ts#L29) |
| POST | `/api/auth/forgot-password` | Public | email: string | — | — | [apps/backend/src/auth/auth.controller.ts:40](../apps/backend/src/auth/auth.controller.ts#L40) |
| POST | `/api/auth/logout` | JWT | — | — | — | [apps/backend/src/auth/auth.controller.ts:46](../apps/backend/src/auth/auth.controller.ts#L46) |
| GET | `/api/scores/dashboard` | JWT | — | termId: string | — | [apps/backend/src/conduct-scores/conduct-scores.controller.ts:20](../apps/backend/src/conduct-scores/conduct-scores.controller.ts#L20) |
| GET | `/api/scores/trace/:evidenceId` | JWT | — | — | evidenceId: string | [apps/backend/src/conduct-scores/conduct-scores.controller.ts:26](../apps/backend/src/conduct-scores/conduct-scores.controller.ts#L26) |
| GET | `/api/scores/class/:classId` | ADMIN, STAFF | — | termId: string | classId: string | [apps/backend/src/conduct-scores/conduct-scores.controller.ts:34](../apps/backend/src/conduct-scores/conduct-scores.controller.ts#L34) |
| GET | `/api/scores/:studentId` | ADMIN, STAFF | — | termId: string | studentId: string | [apps/backend/src/conduct-scores/conduct-scores.controller.ts:43](../apps/backend/src/conduct-scores/conduct-scores.controller.ts#L43) |
| GET | `/api/criteria` | Public | — | termId: string | — | [apps/backend/src/criteria/criteria.controller.ts:17](../apps/backend/src/criteria/criteria.controller.ts#L17) |
| GET | `/api/rubric-templates` | ADMIN | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:23](../apps/backend/src/criteria/criteria.controller.ts#L23) |
| GET | `/api/rubric-templates/:versionId` | ADMIN | — | — | versionId: string | [apps/backend/src/criteria/criteria.controller.ts:31](../apps/backend/src/criteria/criteria.controller.ts#L31) |
| POST | `/api/rubric-templates/draft` | ADMIN | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:39](../apps/backend/src/criteria/criteria.controller.ts#L39) |
| PUT | `/api/rubric-templates/:versionId` | ADMIN | *: { definition: unknown; changeNote?: string } | — | versionId: string | [apps/backend/src/criteria/criteria.controller.ts:47](../apps/backend/src/criteria/criteria.controller.ts#L47) |
| POST | `/api/rubric-templates/:versionId/publish` | ADMIN | — | — | versionId: string | [apps/backend/src/criteria/criteria.controller.ts:55](../apps/backend/src/criteria/criteria.controller.ts#L55) |
| GET | `/api/terms/:id/rubric` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:63](../apps/backend/src/criteria/criteria.controller.ts#L63) |
| POST | `/api/terms/:id/rubric/draft` | ADMIN | *: { type: 'DEFAULT' \| 'TERM'; sourceTermId?: string } | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:71](../apps/backend/src/criteria/criteria.controller.ts#L71) |
| PUT | `/api/terms/:id/rubric` | ADMIN | *: { definition: unknown; changeNote?: string } | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:79](../apps/backend/src/criteria/criteria.controller.ts#L79) |
| POST | `/api/terms/:id/rubric/publish` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:87](../apps/backend/src/criteria/criteria.controller.ts#L87) |
| POST | `/api/criteria` | ADMIN | *: CreateCriterionDto | — | — | [apps/backend/src/criteria/criteria.controller.ts:95](../apps/backend/src/criteria/criteria.controller.ts#L95) |
| PATCH | `/api/criteria/:id` | ADMIN | *: UpdateCriterionDto | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:104](../apps/backend/src/criteria/criteria.controller.ts#L104) |
| DELETE | `/api/criteria/:id` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:113](../apps/backend/src/criteria/criteria.controller.ts#L113) |
| GET | `/api/terms` | Public | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:123](../apps/backend/src/criteria/criteria.controller.ts#L123) |
| GET | `/api/terms/active` | Public | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:129](../apps/backend/src/criteria/criteria.controller.ts#L129) |
| POST | `/api/terms` | ADMIN | *: CreateTermDto | — | — | [apps/backend/src/criteria/criteria.controller.ts:135](../apps/backend/src/criteria/criteria.controller.ts#L135) |
| PATCH | `/api/terms/:id` | ADMIN | *: UpdateTermDto | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:144](../apps/backend/src/criteria/criteria.controller.ts#L144) |
| POST | `/api/terms/:id/close` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:153](../apps/backend/src/criteria/criteria.controller.ts#L153) |
| POST | `/api/terms/:id/activate` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:162](../apps/backend/src/criteria/criteria.controller.ts#L162) |
| POST | `/api/terms/:id/reopen` | ADMIN | reason: string | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:171](../apps/backend/src/criteria/criteria.controller.ts#L171) |
| GET | `/api/faculties` | Public | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:181](../apps/backend/src/criteria/criteria.controller.ts#L181) |
| POST | `/api/faculties` | ADMIN | *: FacultyDto | — | — | [apps/backend/src/criteria/criteria.controller.ts:187](../apps/backend/src/criteria/criteria.controller.ts#L187) |
| PATCH | `/api/faculties/:id` | ADMIN | *: UpdateFacultyDto | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:196](../apps/backend/src/criteria/criteria.controller.ts#L196) |
| DELETE | `/api/faculties/:id` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:205](../apps/backend/src/criteria/criteria.controller.ts#L205) |
| GET | `/api/classes` | Public | — | facultyId: string | — | [apps/backend/src/criteria/criteria.controller.ts:214](../apps/backend/src/criteria/criteria.controller.ts#L214) |
| POST | `/api/classes` | ADMIN | *: ClassDto | — | — | [apps/backend/src/criteria/criteria.controller.ts:220](../apps/backend/src/criteria/criteria.controller.ts#L220) |
| PATCH | `/api/classes/:id` | ADMIN | *: UpdateClassDto | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:229](../apps/backend/src/criteria/criteria.controller.ts#L229) |
| DELETE | `/api/classes/:id` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:238](../apps/backend/src/criteria/criteria.controller.ts#L238) |
| GET | `/api/regulations` | Public | — | — | — | [apps/backend/src/criteria/criteria.controller.ts:248](../apps/backend/src/criteria/criteria.controller.ts#L248) |
| POST | `/api/regulations` | ADMIN | *: RegulationDto | — | — | [apps/backend/src/criteria/criteria.controller.ts:254](../apps/backend/src/criteria/criteria.controller.ts#L254) |
| PATCH | `/api/regulations/:id/status` | ADMIN | *: RegulationStatusDto | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:266](../apps/backend/src/criteria/criteria.controller.ts#L266) |
| DELETE | `/api/regulations/:id` | ADMIN | — | — | id: string | [apps/backend/src/criteria/criteria.controller.ts:273](../apps/backend/src/criteria/criteria.controller.ts#L273) |
| GET | `/api/deadline-extensions` | ADMIN | — | termId: string | — | [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:48](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L48) |
| GET | `/api/deadline-extensions/targets` | ADMIN | — | *: DeadlineExtensionTargetsQueryDto | — | [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:54](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L54) |
| POST | `/api/deadline-extensions` | ADMIN | *: CreateExtensionDto | — | — | [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:65](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L65) |
| DELETE | `/api/deadline-extensions/:id` | ADMIN | — | — | id: string | [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:70](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L70) |
| GET | `/api/ai-jobs` | ADMIN | — | *: JobsQueryDto | — | [apps/backend/src/evaluation-workflow/ai-jobs.controller.ts:21](../apps/backend/src/evaluation-workflow/ai-jobs.controller.ts#L21) |
| POST | `/api/ai-jobs/:id/retry` | ADMIN | — | — | id: string | [apps/backend/src/evaluation-workflow/ai-jobs.controller.ts:25](../apps/backend/src/evaluation-workflow/ai-jobs.controller.ts#L25) |
| GET | `/api/evaluation-workflow/:termId` | STAFF, ADMIN | — | *: WorkflowQueryDto | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:16](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L16) |
| GET | `/api/evaluation-workflow/:termId/export` | STAFF, ADMIN | — | *: WorkflowQueryDto | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:18](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L18) |
| GET | `/api/evaluation-workflow/:termId/conditions` | ADMIN | — | — | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:20](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L20) |
| GET | `/api/evaluation-workflow/:termId/students/:studentId/history` | STAFF, ADMIN | — | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:22](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L22) |
| POST | `/api/evaluation-workflow/:termId/send` | STAFF | *: SendDto | — | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:24](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L24) |
| POST | `/api/evaluation-workflow/:termId/students/:studentId/return` | ADMIN | *: ReasonDto | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:26](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L26) |
| POST | `/api/evaluation-workflow/:termId/students/:studentId/not-submitted` | STAFF | *: ReasonDto | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:28](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L28) |
| POST | `/api/evaluation-workflow/:termId/students/:studentId/correction` | ADMIN | *: ReasonDto | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:30](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L30) |
| POST | `/api/evaluation-workflow/:termId/students/:studentId/exclude` | ADMIN | *: ReasonDto | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:32](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L32) |
| POST | `/api/evaluation-workflow/:termId/students/:studentId/restore` | ADMIN | — | — | termId: string; studentId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:34](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L34) |
| GET | `/api/evaluation-workflow/:termId/corrections` | ADMIN, STAFF | — | — | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:36](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L36) |
| POST | `/api/evaluation-workflow/:termId/publish` | ADMIN | — | — | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:38](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L38) |
| POST | `/api/evaluation-workflow/:termId/close` | ADMIN | — | — | termId: string | [apps/backend/src/evaluation-workflow/workflow.controller.ts:40](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L40) |
| GET | `/api/evidence` | STUDENT, STAFF, ADMIN | — | studentId: string; termId: string; classId: string; status: EvidenceStatus; search: string; sortOrder: 'asc' \| 'desc'; page: number; pageSize: number | — | [apps/backend/src/evidence/evidence.controller.ts:18](../apps/backend/src/evidence/evidence.controller.ts#L18) |
| GET | `/api/evidence/:id` | STUDENT, STAFF, ADMIN | — | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:44](../apps/backend/src/evidence/evidence.controller.ts#L44) |
| POST | `/api/evidence` | STUDENT | *: CreateEvidenceDto | — | — | [apps/backend/src/evidence/evidence.controller.ts:51](../apps/backend/src/evidence/evidence.controller.ts#L51) |
| POST | `/api/evidence/:id/submit` | STUDENT | — | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:58](../apps/backend/src/evidence/evidence.controller.ts#L58) |
| POST | `/api/evidence/:id/supplement` | STUDENT | *: SubmitSupplementDto | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:65](../apps/backend/src/evidence/evidence.controller.ts#L65) |
| POST | `/api/evidence/:id/withdraw` | STUDENT | — | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:71](../apps/backend/src/evidence/evidence.controller.ts#L71) |
| POST | `/api/evidence/:id/files` | STUDENT | *: UploadFileDto | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:78](../apps/backend/src/evidence/evidence.controller.ts#L78) |
| POST | `/api/evidence/:id/files/upload` | STUDENT | *: UploadEvidenceFileDto | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:89](../apps/backend/src/evidence/evidence.controller.ts#L89) |
| DELETE | `/api/evidence/:id/files/:fileId` | STUDENT | — | — | id: string; fileId: string | [apps/backend/src/evidence/evidence.controller.ts:96](../apps/backend/src/evidence/evidence.controller.ts#L96) |
| PATCH | `/api/evidence/:id` | STUDENT | *: any | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:103](../apps/backend/src/evidence/evidence.controller.ts#L103) |
| DELETE | `/api/evidence/:id` | STUDENT | — | — | id: string | [apps/backend/src/evidence/evidence.controller.ts:114](../apps/backend/src/evidence/evidence.controller.ts#L114) |
| GET | `/api/notifications` | JWT | — | — | — | [apps/backend/src/notifications/notifications.controller.ts:14](../apps/backend/src/notifications/notifications.controller.ts#L14) |
| PATCH | `/api/notifications/:id/read` | JWT | — | — | id: string | [apps/backend/src/notifications/notifications.controller.ts:20](../apps/backend/src/notifications/notifications.controller.ts#L20) |
| PATCH | `/api/notifications/read-all` | JWT | — | — | — | [apps/backend/src/notifications/notifications.controller.ts:26](../apps/backend/src/notifications/notifications.controller.ts#L26) |
| POST | `/api/profile-data-issues` | JWT | *: CreateIssueDto | — | — | [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:25](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L25) |
| GET | `/api/profile-data-issues/mine` | JWT | — | — | — | [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:28](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L28) |
| GET | `/api/profile-data-issues` | ADMIN | — | status: ProfileDataIssueStatus; page: string | — | [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:31](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L31) |
| PATCH | `/api/profile-data-issues/:id/resolve` | ADMIN | *: ResolveIssueDto | — | id: string | [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:37](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L37) |
| GET | `/api/reports/summary` | ADMIN, STAFF | — | termId: string | — | [apps/backend/src/reports/reports.controller.ts:22](../apps/backend/src/reports/reports.controller.ts#L22) |
| GET | `/api/reports/distribution` | ADMIN, STAFF | — | termId: string; facultyId: string | — | [apps/backend/src/reports/reports.controller.ts:29](../apps/backend/src/reports/reports.controller.ts#L29) |
| GET | `/api/reports/faculties` | ADMIN, STAFF | — | termId: string | — | [apps/backend/src/reports/reports.controller.ts:36](../apps/backend/src/reports/reports.controller.ts#L36) |
| GET | `/api/reports/results/export` | ADMIN, STAFF | — | termId: string; *: ReportQueryDto | — | [apps/backend/src/reports/reports.controller.ts:42](../apps/backend/src/reports/reports.controller.ts#L42) |
| GET | `/api/reports/results` | ADMIN, STAFF | — | termId: string; *: ReportQueryDto | — | [apps/backend/src/reports/reports.controller.ts:47](../apps/backend/src/reports/reports.controller.ts#L47) |
| GET | `/api/reviews/queue` | STAFF | — | status: string; termId: string; classId: string; search: string; sortOrder: 'asc' \| 'desc'; page: number; pageSize: number | — | [apps/backend/src/reviews/reviews.controller.ts:18](../apps/backend/src/reviews/reviews.controller.ts#L18) |
| POST | `/api/evidence/:id/claim` | STAFF | — | — | id: string | [apps/backend/src/reviews/reviews.controller.ts:42](../apps/backend/src/reviews/reviews.controller.ts#L42) |
| POST | `/api/evidence/:id/release` | STAFF | — | — | id: string | [apps/backend/src/reviews/reviews.controller.ts:49](../apps/backend/src/reviews/reviews.controller.ts#L49) |
| POST | `/api/evidence/:id/review` | STAFF | *: ReviewDecisionDto | — | id: string | [apps/backend/src/reviews/reviews.controller.ts:56](../apps/backend/src/reviews/reviews.controller.ts#L56) |
| POST | `/api/evidence/:id/verification-sources` | STAFF | *: VerificationSourceDto | — | id: string | [apps/backend/src/reviews/reviews.controller.ts:66](../apps/backend/src/reviews/reviews.controller.ts#L66) |
| GET | `/api/users` | ADMIN, STAFF | — | role: Role; facultyId: string; classId: string; termId: string; search: string; page: number; pageSize: number | — | [apps/backend/src/users/users.controller.ts:18](../apps/backend/src/users/users.controller.ts#L18) |
| GET | `/api/users/:id` | ADMIN, STAFF | — | termId: string | id: string | [apps/backend/src/users/users.controller.ts:34](../apps/backend/src/users/users.controller.ts#L34) |
| POST | `/api/users/import` | ADMIN | *: BulkImportUsersDto | — | — | [apps/backend/src/users/users.controller.ts:41](../apps/backend/src/users/users.controller.ts#L41) |
| POST | `/api/users/:id/reset-password` | ADMIN | — | — | id: string | [apps/backend/src/users/users.controller.ts:48](../apps/backend/src/users/users.controller.ts#L48) |
| POST | `/api/users` | ADMIN | *: CreateUserDto | — | — | [apps/backend/src/users/users.controller.ts:55](../apps/backend/src/users/users.controller.ts#L55) |
| PATCH | `/api/users/:id` | ADMIN | *: UpdateUserDto | — | id: string | [apps/backend/src/users/users.controller.ts:62](../apps/backend/src/users/users.controller.ts#L62) |
| DELETE | `/api/users/:id` | ADMIN | — | — | id: string | [apps/backend/src/users/users.controller.ts:69](../apps/backend/src/users/users.controller.ts#L69) |

## Phụ lục 45 lớp DTO

Kiểu TS có dấu ? chỉ là khai báo; decorator ở cột cuối mới mô tả validation runtime. `extends PartialType/OmitType` kế thừa trường từ DTO gốc dù bảng không liệt kê lại. Đặc biệt UpdateActivityDto dùng mapped type; không hiểu bảng trống là body không có trường. Object data/definition/users phải tiếp tục đối chiếu service và nested DTO, không assume IsObject kiểm toàn bộ nội dung.

<a id="dto-createactivitydto"></a>

### CreateActivityDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:5](../apps/backend/src/activities/dto/activity.dto.ts#L5).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Không | @IsString() @IsNotEmpty() |
| criterionId | `string` | Không | @IsString() @IsNotEmpty() |
| name | `string` | Không | @IsString() @IsNotEmpty() |
| type | `ActivityType` | Không | @IsEnum(ActivityType) |
| organizer | `string` | Không | @IsString() @IsNotEmpty() |
| startDate | `string` | Không | @IsString() @IsDateString() |
| endDate | `string` | Có | @IsOptional() @IsString() @IsDateString() |
| location | `string` | Có | @IsOptional() @IsString() |
| description | `string` | Có | @IsOptional() @IsString() |

<a id="dto-addparticipantdto"></a>

### AddParticipantDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:44](../apps/backend/src/activities/dto/activity.dto.ts#L44).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| studentCode | `string` | Không | @IsString() @IsNotEmpty() |
| formRole | `string` | Có | @IsOptional() @IsString() @IsIn(['THAM_GIA_CHINH','BAN_TO_CHUC','CO_VU','PARTICIPANT','ORGANIZER','CHEERLEADER']) |

<a id="dto-updateactivitydto"></a>

### UpdateActivityDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:57](../apps/backend/src/activities/dto/activity.dto.ts#L57). Kế thừa: `extends PartialType(OmitType(CreateActivityDto, ['termId', 'criterionId', 'type'] as const))`.

Không khai báo trường trực tiếp; đọc biểu thức kế thừa và DTO nguồn.

<a id="dto-batchattendancedto"></a>

### BatchAttendanceDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:58](../apps/backend/src/activities/dto/activity.dto.ts#L58).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| studentCodes | `string[]` | Không | @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({ each: true }) |
| formRole | `string` | Có | @IsOptional() @IsIn(['THAM_GIA_CHINH','BAN_TO_CHUC','CO_VU','PARTICIPANT','ORGANIZER','CHEERLEADER']) |

<a id="dto-confirmattendancedto"></a>

### ConfirmAttendanceDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:63](../apps/backend/src/activities/dto/activity.dto.ts#L63).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| participantIds | `string[]` | Có | @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) |

<a id="dto-revokeattendancedto"></a>

### RevokeAttendanceDto

Nguồn: [apps/backend/src/activities/dto/activity.dto.ts:67](../apps/backend/src/activities/dto/activity.dto.ts#L67).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| reason | `string` | Không | @IsString() @MinLength(5) |

<a id="dto-createappealdto"></a>

### CreateAppealDto

Nguồn: [apps/backend/src/appeals/dto/appeal.dto.ts:5](../apps/backend/src/appeals/dto/appeal.dto.ts#L5).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| evidenceId | `string` | Có | @IsString() @IsOptional() @IsNotEmpty() |
| criterionAssessmentId | `string` | Có | @IsOptional() @IsString() |
| content | `string` | Không | @IsString() @IsNotEmpty() |
| requestedScore | `number` | Có | @IsOptional() @IsNumber() |

<a id="dto-resolveappealdto"></a>

### ResolveAppealDto

Nguồn: [apps/backend/src/appeals/dto/appeal.dto.ts:25](../apps/backend/src/appeals/dto/appeal.dto.ts#L25).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| status | `AppealStatus` | Không | @IsEnum(AppealStatus) |
| resolutionNote | `string` | Không | @IsString() @IsNotEmpty() |
| adjustedScore | `number` | Có | @IsOptional() @IsNumber() |

<a id="dto-selfassessmentdto"></a>

### SelfAssessmentDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:12](../apps/backend/src/assessments/assessments.controller.ts#L12).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| score | `number \| null` | Có | @IsOptional() @IsNumber() @Min(0) |
| note | `string` | Có | @IsOptional() @IsString() |

<a id="dto-classassessmentdto"></a>

### ClassAssessmentDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:17](../apps/backend/src/assessments/assessments.controller.ts#L17).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| score | `number` | Không | @IsNumber() @Min(0) |
| note | `string` | Không | @IsString() |

<a id="dto-verificationdto"></a>

### VerificationDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:22](../apps/backend/src/assessments/assessments.controller.ts#L22).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| data | `Record&lt;string, unknown&gt;` | Không | @IsObject() |
| note | `string` | Không | @IsString() |

<a id="dto-finalassessmentdto"></a>

### FinalAssessmentDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:27](../apps/backend/src/assessments/assessments.controller.ts#L27).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| score | `number` | Có | @IsOptional() @IsNumber() @Min(0) |
| reason | `string` | Có | @IsOptional() @IsString() |

<a id="dto-selfassessmentscoredto"></a>

### SelfAssessmentScoreDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:32](../apps/backend/src/assessments/assessments.controller.ts#L32).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| criterionId | `string` | Không | @IsString() |
| score | `number \| null` | Không | @IsOptional() @IsNumber() @Min(0) |

<a id="dto-selfassessmentbatchdto"></a>

### SelfAssessmentBatchDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:37](../apps/backend/src/assessments/assessments.controller.ts#L37).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| scores | `SelfAssessmentScoreDto[]` | Không | @IsArray() @ValidateNested({ each: true }) @Type(() =&gt; SelfAssessmentScoreDto) |

<a id="dto-returnselfassessmentdto"></a>

### ReturnSelfAssessmentDto

Nguồn: [apps/backend/src/assessments/assessments.controller.ts:42](../apps/backend/src/assessments/assessments.controller.ts#L42).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| reason | `string` | Không | @IsString() |

<a id="dto-changepassworddto"></a>

### ChangePasswordDto

Nguồn: [apps/backend/src/auth/dto/change-password.dto.ts:4](../apps/backend/src/auth/dto/change-password.dto.ts#L4).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| currentPassword | `string` | Không | @IsString() @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' }) |
| newPassword | `string` | Không | @IsString() @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' }) @MinLength(6, { message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' }) |

<a id="dto-logindto"></a>

### LoginDto

Nguồn: [apps/backend/src/auth/dto/login.dto.ts:4](../apps/backend/src/auth/dto/login.dto.ts#L4).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| email | `string` | Không | @IsEmail({}, { message: 'Email không đúng định dạng' }) @IsNotEmpty({ message: 'Email không được để trống' }) |
| password | `string` | Không | @IsString() @IsNotEmpty({ message: 'Mật khẩu không được để trống' }) |

<a id="dto-createtermdto"></a>

### CreateTermDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:5](../apps/backend/src/criteria/dto/criteria.dto.ts#L5).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| name | `string` | Không | @IsString() @IsNotEmpty() |
| code | `string` | Không | @IsString() @IsNotEmpty() |
| startDate | `string` | Không | @IsString() @IsNotEmpty() |
| endDate | `string` | Không | @IsString() @IsNotEmpty() |
| submissionDeadline | `string` | Không | @IsString() @IsNotEmpty() |
| reviewDeadline | `string` | Không | @IsString() @IsNotEmpty() |
| appealDeadline | `string` | Không | @IsString() @IsNotEmpty() |
| status | `TermStatus` | Có | @IsOptional() @IsEnum(TermStatus) |
| rubricSourceType | `'DEFAULT' \| 'TERM'` | Có | @IsOptional() @IsIn(['DEFAULT', 'TERM']) |
| sourceTermId | `string` | Có | @IsOptional() @IsString() |

<a id="dto-updatetermdto"></a>

### UpdateTermDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:57](../apps/backend/src/criteria/dto/criteria.dto.ts#L57).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| name | `string` | Có | @IsOptional() @IsString() |
| submissionDeadline | `string` | Có | @IsOptional() @IsString() |
| reviewDeadline | `string` | Có | @IsOptional() @IsString() |
| appealDeadline | `string` | Có | @IsOptional() @IsString() |
| status | `TermStatus` | Có | @IsOptional() @IsEnum(TermStatus) |

<a id="dto-createcriteriondto"></a>

### CreateCriterionDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:84](../apps/backend/src/criteria/dto/criteria.dto.ts#L84).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| code | `string` | Không | @IsString() @IsNotEmpty() |
| name | `string` | Không | @IsString() @IsNotEmpty() |
| description | `string` | Không | @IsString() @IsNotEmpty() |
| maxScore | `number` | Không | @IsNumber() |
| category | `string` | Có | @IsOptional() @IsString() |

<a id="dto-updatecriteriondto"></a>

### UpdateCriterionDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:110](../apps/backend/src/criteria/dto/criteria.dto.ts#L110).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| name | `string` | Có | @IsOptional() @IsString() |
| description | `string` | Có | @IsOptional() @IsString() |
| maxScore | `number` | Có | @IsOptional() @IsNumber() |

<a id="dto-facultydto"></a>

### FacultyDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:127](../apps/backend/src/criteria/dto/criteria.dto.ts#L127).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| code | `string` | Không | @IsString() @IsNotEmpty() |
| name | `string` | Không | @IsString() @IsNotEmpty() |

<a id="dto-updatefacultydto"></a>

### UpdateFacultyDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:131](../apps/backend/src/criteria/dto/criteria.dto.ts#L131).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| code | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |
| name | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |

<a id="dto-classdto"></a>

### ClassDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:135](../apps/backend/src/criteria/dto/criteria.dto.ts#L135).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| code | `string` | Không | @IsString() @IsNotEmpty() |
| name | `string` | Có | @IsOptional() @IsString() |
| cohort | `string` | Không | @IsString() @IsNotEmpty() |
| facultyId | `string` | Không | @IsString() @IsNotEmpty() |

<a id="dto-updateclassdto"></a>

### UpdateClassDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:141](../apps/backend/src/criteria/dto/criteria.dto.ts#L141).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| code | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |
| name | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |
| cohort | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |
| facultyId | `string` | Có | @IsOptional() @IsString() @IsNotEmpty() |

<a id="dto-regulationdto"></a>

### RegulationDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:147](../apps/backend/src/criteria/dto/criteria.dto.ts#L147).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| title | `string` | Không | @IsString() @IsNotEmpty() |
| version | `string` | Không | @IsString() @IsNotEmpty() |
| fileUrl | `string` | Không | @IsString() @IsNotEmpty() @IsUrl({ protocols: ['http','https'], require_protocol: true }) |
| effectiveDate | `string` | Có | @IsOptional() @IsDateString() |

<a id="dto-regulationstatusdto"></a>

### RegulationStatusDto

Nguồn: [apps/backend/src/criteria/dto/criteria.dto.ts:153](../apps/backend/src/criteria/dto/criteria.dto.ts#L153).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| status | `'ACTIVE' \| 'EXPIRED'` | Không | @IsIn(['ACTIVE','EXPIRED']) |

<a id="dto-createextensiondto"></a>

### CreateExtensionDto

Nguồn: [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:11](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L11).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Không | @IsString() @IsNotEmpty() |
| targetType | `DeadlineExtensionTarget` | Không | @IsEnum(DeadlineExtensionTarget) |
| targetId | `string` | Không | @IsString() @IsNotEmpty() |
| type | `DeadlineExtensionType` | Không | @IsEnum(DeadlineExtensionType) |
| deadline | `string` | Không | @IsDateString() |
| reason | `string` | Không | @IsString() @MinLength(3) |

<a id="dto-deadlineextensiontargetsquerydto"></a>

### DeadlineExtensionTargetsQueryDto

Nguồn: [apps/backend/src/deadline-extensions/deadline-extensions.controller.ts:31](../apps/backend/src/deadline-extensions/deadline-extensions.controller.ts#L31).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Không | @IsString() @IsNotEmpty() |
| targetType | `DeadlineExtensionTarget` | Không | @IsEnum(DeadlineExtensionTarget) |
| q | `string` | Có | @IsOptional() @IsString() |
| page | `number` | Có (mặc định 1) | @IsOptional() @Type(() => Number) @IsInt() @Min(1) |
| pageSize | `number` | Có (mặc định 25) | @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) |

<a id="dto-jobsquerydto"></a>

### JobsQueryDto

Nguồn: [apps/backend/src/evaluation-workflow/ai-jobs.controller.ts:10](../apps/backend/src/evaluation-workflow/ai-jobs.controller.ts#L10).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Có | @IsOptional() @IsString() |
| status | `string` | Có | @IsOptional() @IsIn(['QUEUED','PROCESSING','COMPLETED','FAILED','UNAVAILABLE','CANCELLED']) |
| page | `number` | Không | @IsOptional() @IsInt() @Min(1) |
| pageSize | `number` | Không | @IsOptional() @IsInt() @Min(1) @Max(100) |

<a id="dto-workflowquerydto"></a>

### WorkflowQueryDto

Nguồn: [apps/backend/src/evaluation-workflow/dto/workflow-query.dto.ts:3](../apps/backend/src/evaluation-workflow/dto/workflow-query.dto.ts#L3).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| classId | `string` | Có | @IsOptional() @IsString() |
| facultyId | `string` | Có | @IsOptional() @IsString() |
| q | `string` | Có | @IsOptional() @IsString() @MaxLength(200) |
| state | `string` | Có | @IsOptional() @IsIn(['NOT_SUBMITTED', 'STUDENT_RETURNED', 'REVIEWING', 'READY', 'SENT', 'PUBLISHED', 'FACULTY_RETURNED', 'NOT_SUBMITTED_RECORDED', 'APPEALS', 'RETURNED']) |
| page | `number` | Không | @IsOptional() @IsInt() @Min(1) |
| pageSize | `number` | Không | @IsOptional() @IsInt() @Min(1) @Max(100) |

<a id="dto-senddto"></a>

### SendDto

Nguồn: [apps/backend/src/evaluation-workflow/workflow.controller.ts:10](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L10).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| studentIds | `string[]` | Không | @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) |

<a id="dto-reasondto"></a>

### ReasonDto

Nguồn: [apps/backend/src/evaluation-workflow/workflow.controller.ts:11](../apps/backend/src/evaluation-workflow/workflow.controller.ts#L11).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| reason | `string` | Không | @IsString() |

<a id="dto-createevidencedto"></a>

### CreateEvidenceDto

Nguồn: [apps/backend/src/evidence/dto/evidence.dto.ts:4](../apps/backend/src/evidence/dto/evidence.dto.ts#L4).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Có | @IsOptional() @IsString() |
| activityId | `string` | Có | @IsOptional() @IsString() |
| declaredActivityName | `string` | Không | @IsString() @IsNotEmpty() |
| description | `string` | Có | @IsOptional() @IsString() |
| declaredRole | `string` | Có | @IsOptional() @IsString() |
| evidenceType | `string` | Không | @IsString() @IsNotEmpty() |
| participationDate | `string` | Có | @IsOptional() @IsString() |
| criterionCode | `string` | Có | @IsOptional() @IsString() |
| criterionId | `string` | Có | @IsOptional() @IsString() |
| draft | `boolean` | Có | @IsOptional() @IsBoolean() |
| fileUrls | `string[]` | Có | @IsOptional() |

<a id="dto-uploadfiledto"></a>

### UploadFileDto

Nguồn: [apps/backend/src/evidence/dto/evidence.dto.ts:60](../apps/backend/src/evidence/dto/evidence.dto.ts#L60).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| fileUrl | `string` | Không | @IsString() @IsNotEmpty() |
| fileType | `string` | Không | @IsString() @IsNotEmpty() |

<a id="dto-uploadevidencefiledto"></a>

### UploadEvidenceFileDto

Nguồn: [apps/backend/src/evidence/dto/evidence.dto.ts:72](../apps/backend/src/evidence/dto/evidence.dto.ts#L72).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| fileName | `string` | Không | @IsString() @IsNotEmpty() |
| fileType | `string` | Không | @IsString() @IsNotEmpty() |
| fileData | `string` | Không | @IsString() @IsNotEmpty() |

<a id="dto-submitsupplementdto"></a>

### SubmitSupplementDto

Nguồn: [apps/backend/src/evidence/dto/evidence.dto.ts:89](../apps/backend/src/evidence/dto/evidence.dto.ts#L89).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| explanation | `string` | Có | @IsOptional() @IsString() |
| verificationUrl | `string` | Có | @IsOptional() @IsString() |
| fileName | `string` | Có | @IsOptional() @IsString() |
| fileType | `string` | Có | @IsOptional() @IsString() |
| fileData | `string` | Có | @IsOptional() @IsString() |

<a id="dto-createissuedto"></a>

### CreateIssueDto

Nguồn: [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:10](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L10).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| category | `string` | Không | @IsString() @MinLength(2) |
| content | `string` | Không | @IsString() @MinLength(10) |

<a id="dto-resolveissuedto"></a>

### ResolveIssueDto

Nguồn: [apps/backend/src/profile-data-issues/profile-data-issues.controller.ts:15](../apps/backend/src/profile-data-issues/profile-data-issues.controller.ts#L15).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| status | `'RESOLVED' \| 'REJECTED'` | Không | @IsIn(['RESOLVED', 'REJECTED']) |
| resolution | `string` | Không | @IsString() @MinLength(3) |

<a id="dto-reportquerydto"></a>

### ReportQueryDto

Nguồn: [apps/backend/src/reports/reports.controller.ts:13](../apps/backend/src/reports/reports.controller.ts#L13). Kế thừa: `extends WorkflowQueryDto`.

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| termId | `string` | Có | @IsOptional() @IsString() |

<a id="dto-reviewdecisiondto"></a>

### ReviewDecisionDto

Nguồn: [apps/backend/src/reviews/dto/review.dto.ts:5](../apps/backend/src/reviews/dto/review.dto.ts#L5).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| expectedVersion | `number` | Có | @IsOptional() @IsInt() @Min(1) |
| action | `ReviewDecision` | Không | @IsEnum(ReviewDecision) |
| approvedPoints | `number` | Có | @IsOptional() @IsNumber() |
| criterionId | `string` | Có | @IsOptional() @IsString() |
| comment | `string` | Không | @IsString() @IsNotEmpty() |
| rejectBasis | `string` | Có | @IsOptional() @IsString() |
| missingItem | `string` | Có | @IsOptional() @IsString() |
| supplementDeadline | `string` | Có | @IsOptional() @IsString() @IsDateString() |

<a id="dto-verificationsourcedto"></a>

### VerificationSourceDto

Nguồn: [apps/backend/src/reviews/dto/review.dto.ts:43](../apps/backend/src/reviews/dto/review.dto.ts#L43).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| sourceName | `string` | Không | @IsString() @MinLength(3) |
| sourceUrl | `string` | Có | @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) |
| note | `string` | Không | @IsString() @MinLength(3) |
| level | `number` | Không | @IsInt() @Min(1) @Max(4) |
| confirmedActivity | `boolean` | Không | @IsBoolean() |
| confirmedStudent | `boolean` | Không | @IsBoolean() |

<a id="dto-createuserdto"></a>

### CreateUserDto

Nguồn: [apps/backend/src/users/dto/user.dto.ts:6](../apps/backend/src/users/dto/user.dto.ts#L6).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| email | `string` | Không | @IsEmail({}, { message: 'Email không đúng định dạng' }) @IsNotEmpty() |
| fullName | `string` | Không | @IsString() @IsNotEmpty() |
| role | `Role` | Không | @IsEnum(Role) |
| studentCode | `string` | Có | @IsOptional() @IsString() |
| password | `string` | Có | @IsOptional() @IsString() @MinLength(6) |
| classId | `string` | Có | @IsOptional() @IsString() |
| facultyId | `string` | Có | @IsOptional() @IsString() |

<a id="dto-updateuserdto"></a>

### UpdateUserDto

Nguồn: [apps/backend/src/users/dto/user.dto.ts:43](../apps/backend/src/users/dto/user.dto.ts#L43).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| fullName | `string` | Có | @IsOptional() @IsString() |
| isActive | `boolean` | Có | @IsOptional() @IsBoolean() |
| classId | `string` | Có | @IsOptional() @IsString() |
| facultyId | `string` | Có | @IsOptional() @IsString() |
| studentCode | `string` | Có | @IsOptional() @IsString() |
| email | `string` | Có | @IsOptional() @IsEmail({}, { message: 'Email không đúng định dạng' }) |

<a id="dto-importuserrowdto"></a>

### ImportUserRowDto

Nguồn: [apps/backend/src/users/dto/user.dto.ts:75](../apps/backend/src/users/dto/user.dto.ts#L75).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| fullName | `string` | Không | @IsString() @IsNotEmpty() |
| email | `string` | Không | @IsEmail({}, { message: 'Email không đúng định dạng' }) |
| studentCode | `string` | Có | @IsOptional() @IsString() |
| role | `Role` | Có | @IsOptional() @IsEnum(Role) |
| classCode | `string` | Có | @IsOptional() @IsString() |
| classId | `string` | Có | @IsOptional() @IsString() |
| facultyCode | `string` | Có | @IsOptional() @IsString() |
| facultyId | `string` | Có | @IsOptional() @IsString() |

<a id="dto-bulkimportusersdto"></a>

### BulkImportUsersDto

Nguồn: [apps/backend/src/users/dto/user.dto.ts:116](../apps/backend/src/users/dto/user.dto.ts#L116).

| Trường | Kiểu TS | Optional TS | Validation khai báo |
|---|---|---|---|
| users | `ImportUserRowDto[]` | Không | @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() =&gt; ImportUserRowDto) |


