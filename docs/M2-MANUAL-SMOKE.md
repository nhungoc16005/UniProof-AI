# M2 manual smoke (local/test only)

This checklist is the project owner's manual acceptance gate for M2. Run it only against a disposable local test database and local/dev storage. Never point these commands at production or a real student record. M2 P0 rows remain TODO until the component suite passes and the owner records PASS for all six cases below.

## Test accounts and synthetic certificate data

The repository's `prisma/seed.ts` seeds only the DUT rubric template. After migrating the disposable DB, create the test accounts and fixture term with this guarded local-only script. It refuses URLs that are not localhost or do not end in `_test`:

```powershell
$env:TEST_DATABASE_URL = $env:DATABASE_URL
node scripts/seed-m2-manual-smoke.cjs
```

The script creates the following synthetic accounts, all with the local-only password `M2-local-only-2026!`. Do not reuse this password outside the disposable DB.

| Role | Email | Synthetic identity |
|---|---|---|
| Admin | `m2.admin@localhost.test` | Local setup account |
| Faculty officer | `m2.officer@localhost.test` | Faculty scope for the test student's class |
| Student | `m2.student@localhost.test` | `Sinh viên Tổng hợp`, MSSV `SV00000001` |

The script also creates the active test term, a published rubric, one criterion, and the student's handoff. For the certificate, make a **synthetic, printed** PNG/PDF in Paint, PowerPoint, or a similar tool using only these invented values:

```text
GIẤY CHỨNG NHẬN THAM GIA
Sinh viên: Sinh viên Tổng hợp
MSSV: SV00000001
Hoạt động: Ngày hội Công nghệ Mở 2026
Đơn vị tổ chức: Đoàn Thanh niên DUT
Ngày cấp: 18/10/2026
```

For the mismatch case, change only the printed MSSV to `SV00000002`. For the missing-field case, omit the MSSV line completely. Do not use a scan, photo, or data copied from a real certificate. Upload through the local/dev Supabase Storage configured for this application.

## Start the disposable database

PowerShell from the repository root:

```powershell
docker run --detach --rm --name uniproof-m2-manual-test-db `
  --env POSTGRES_PASSWORD=test_only `
  --env POSTGRES_DB=edupoint_test `
  --publish 127.0.0.1:55432:5432 `
  pgvector/pgvector:pg17

docker exec uniproof-m2-manual-test-db psql -U postgres -d edupoint_test `
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

In the same PowerShell session, from `apps/backend`:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:test_only@127.0.0.1:55432/edupoint_test'
$env:DIRECT_URL = $env:DATABASE_URL
npx.cmd prisma migrate deploy
```

If the existing snapshot baseline reports `P1014`, follow the disposable-DB-only baseline check and `migrate resolve` instructions in [README.test.md](../apps/backend/README.test.md). Never resolve a baseline on a real database without backup and status review.

## Start the services

Use three PowerShell terminals. Set the Tesseract executable and language data paths to match the local installation.

**AI service**, from `apps/ai-service`:

```powershell
$env:DEBUG = 'false'
$env:Path = "C:\Program Files\Tesseract-OCR;$env:Path"
$env:TESSDATA_PREFIX = "$env:LOCALAPPDATA\UniProofAI\tessdata"
$env:TESSERACT_LANGUAGES = 'vie+eng'
$env:TESSERACT_TIMEOUT_SECONDS = '20'
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
```

Confirm `http://127.0.0.1:8000/health` reports healthy and OCR available.

**Backend**, from `apps/backend`:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:test_only@127.0.0.1:55432/edupoint_test'
$env:DIRECT_URL = $env:DATABASE_URL
$env:PORT = '3001'
$env:AI_MODE = 'ASSIST'
$env:AI_PIPELINE_URL = 'http://127.0.0.1:8000'
$env:EXTERNAL_LLM_EXTRACTION_ENABLED = 'false'
# Also load local/dev-only SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and bucket
# settings from your development environment so evidence uploads use dev storage.
npm.cmd run start:dev
```

**Frontend**, from `apps/web`:

```powershell
$env:VITE_API_URL = 'http://127.0.0.1:3001/api'
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:3000`. Log in as the local test student to submit and as the local faculty officer to inspect the queue. If the deployment uses different local ports, adjust the URLs consistently.

## Six acceptance scenarios

For every case, submit a separate evidence record and record the observed evidence ID and result. Restart the backend when changing `AI_MODE`; it reads that setting at startup.

| # | Scenario and steps | Expected result | Owner result |
|---|---|---|---|
| 1 | **Valid certificate.** Submit the synthetic certificate with the correct student name, `SV00000001`, activity, organizer, and date while AI service is healthy and mode is ASSIST. | Submission succeeds. The officer sees the AI advisory, individual checker statuses, and score breakdown. Human approval controls remain the existing controls; AI does not approve. | PASS [ ] FAIL [ ] Notes: ______ |
| 2 | **Wrong MSSV.** Submit the certificate printed with `SV00000002` for account `SV00000001`. | Officer sees a red/mismatch result with a Vietnamese reason that the extracted student code does not match. Evidence stays available for human review; AI does not reject it. | PASS [ ] FAIL [ ] Notes: ______ |
| 3 | **MSSV omitted.** Submit the certificate with the MSSV line removed. | Identity checker shows REVIEW/NOT_CHECKED and says the MSSV is missing/unreadable in Vietnamese. It must not claim the provided MSSV is incorrect. Record the resulting score; it must be at most 89 while unresolved. | PASS [ ] FAIL [ ] Notes: ______ |
| 4 | **AI service stopped.** Keep backend in ASSIST, stop the AI service, and submit another synthetic certificate. Wait for the bounded retry/fallback to finish. | Student submission succeeds without an AI service error. Evidence remains in the officer's human-review queue with a Vietnamese service-unavailable/review reason. No AI rejection occurs. | PASS [ ] FAIL [ ] Notes: ______ |
| 5 | **AI_MODE=OFF.** Restart backend with `AI_MODE=OFF`, then submit another synthetic certificate. | Student submission and existing review workflow behave as before AI: no AI job/advisory is exposed and no AI error is shown to the student. Officer still sees the submitted evidence in the normal queue. | PASS [ ] FAIL [ ] Notes: ______ |
| 6 | **Score cap.** Restart backend in ASSIST with AI healthy. Use a submitted synthetic record for which at least one checker visibly returns REVIEW or NOT_CHECKED (the missing-MSSV record is suitable). | The displayed score is no greater than 89 and is labeled as a human-review suggestion, not a probability or official result. No green/≥90 outcome appears while that check remains unresolved. | PASS [ ] FAIL [ ] Notes: ______ |

Owner acceptance: `M2 P0-01..05` manual result: ______  Date: ______  Initials: ______

After the smoke run, stop the local services and remove the disposable database:

```powershell
docker rm --force uniproof-m2-manual-test-db
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL, Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
```
