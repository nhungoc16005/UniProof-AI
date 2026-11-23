# Chạy integration test trên PostgreSQL dùng một lần

Chỉ dùng database `edupoint_test` trong container local. Không đặt `TEST_DATABASE_URL`, `DATABASE_URL` hoặc `DIRECT_URL` trỏ tới staging/production. Test tự kiểm tra host local và tên DB có `_test`.

## Yêu cầu

- Docker Desktop đang chạy.
- PostgreSQL 17 có extension pgvector. Dùng image `pgvector/pgvector:pg17` vì baseline schema cần cả `transaction_timeout` của PostgreSQL 17 và kiểu `vector`.

## PowerShell

Chạy từ `apps/backend`:

```powershell
docker run --detach --rm --name uniproof-m1-test-db `
  --env POSTGRES_PASSWORD=test_only `
  --env POSTGRES_DB=edupoint_test `
  --publish 127.0.0.1:55432:5432 `
  pgvector/pgvector:pg17

docker exec uniproof-m1-test-db psql -U postgres -d edupoint_test `
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

$env:DATABASE_URL = 'postgresql://postgres:test_only@127.0.0.1:55432/edupoint_test'
$env:DIRECT_URL = $env:DATABASE_URL
npx.cmd prisma migrate deploy
```

Nếu deploy báo `P1014` ở baseline nhưng kiểm tra xác nhận baseline đã tạo đầy đủ bảng `Evidence` và `_prisma_migrations`, đánh dấu riêng baseline snapshot đã áp dụng rồi chạy deploy lại:

```powershell
npx.cmd prisma migrate resolve --applied 20261018000000_baseline_existing_supabase
npx.cmd prisma migrate deploy
```

**`migrate resolve` chỉ dùng cho DB test; với DB thật phải backup, chạy migrate status, và không resolve baseline nếu chưa kiểm tra.** Không dùng lệnh `migrate resolve` nếu baseline chưa tạo xong schema. Baseline là snapshot có sẵn, các migration sau đó chạy tuần tự và phải kết thúc với thông báo tất cả migrations đã áp dụng.

Chạy integration suite:

```powershell
$env:TEST_DATABASE_URL = $env:DATABASE_URL
node --test test/workflow.integration.test.cjs
```

Integration suite từ chối mọi URL không phải `localhost`/`127.0.0.1` hoặc không có hậu tố `_test`. Nó thay `DATABASE_URL` và `DIRECT_URL` bằng URL test trước khi khởi tạo Prisma.

## M2: chạy test và chọn chế độ AI

AI mode được đọc khi backend khởi động. `AI_MODE=OFF` là mặc định và không tạo job AI; `SHADOW` chạy nền, kết quả chỉ lưu ở `AiPipelineRun`; `ASSIST` đưa gợi ý lên trang cán bộ, quyết định vẫn do cán bộ. `EXTERNAL_LLM_EXTRACTION_ENABLED=false` là mặc định; pipeline OCR không gọi LLM ngoài.

PowerShell, từ thư mục `apps/ai-service`:

```powershell
$env:DEBUG = 'false'
python -m unittest discover -s . -p "test*.py"
```

PowerShell, từ thư mục `apps/backend` sau khi đã khởi động container test ở trên:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:test_only@127.0.0.1:55432/edupoint_test'
$env:AI_MODE = 'ASSIST'
node --test test/evidence-processing-worker.test.cjs
node --test test/workflow.integration.test.cjs
```

Test component frontend, từ `apps/web`:

```powershell
npm.cmd test
```

Browser smoke `apps/backend/test/browser-smoke.cjs` là tiện ích tùy chọn, không bắt buộc nghiệm thu M2 vì Chrome/CDP có thể treo. Để chạy worker mode unit, đặt `AI_MODE` tương ứng `OFF`, `SHADOW` hoặc `ASSIST`; test mode OFF xác nhận worker không gọi service và không ghi kết quả. Không dùng URL `DATABASE_URL` production/staging. Container test không chứa dữ liệu thật và phải xóa sau khi chạy.

Sau khi test kết thúc, xóa container và toàn bộ database tạm:

```powershell
docker rm --force uniproof-m1-test-db
Remove-Item Env:TEST_DATABASE_URL, Env:DATABASE_URL, Env:DIRECT_URL -ErrorAction SilentlyContinue
```

## Migration đổi tên cờ INVALID

`20261115000100_ai_pipeline_actor_audit/migration.sql` thêm actor AI vào lượt chạy và đổi key JSON cũ biểu thị “tự động từ chối” thành `systemInvalidated` trong `VerificationResult.evidenceGap`. Migration giữ nguyên giá trị boolean và các key khác. Integration test chèn fixture tổng hợp bằng key legacy, chạy đúng câu lệnh backfill trong migration rồi xác nhận dữ liệu đã đổi mà không có mã sinh viên.
