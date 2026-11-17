# Plan to Move UniProof-AI to a New Machine

Prepared on 17/11/2026.  
Based on the project documents (CHECKLIST, DECISIONS, README.test, M2-MANUAL-SMOKE, the two-machine plan).  
Tool versions verified against `package.json`, `requirements.txt`, and the repo (no `.nvmrc` present).

---

## 1. Goals and scope

- Be able to run the entire project on the new machine: AI service (Python), backend (NestJS + Prisma), frontend (React + Vite), test database (PostgreSQL 17 + pgvector).
- The new machine produces the same test results as the old machine before the old machine is retired.
- Do not expose secrets (Supabase keys, passwords) or real student data.
- Do not run migrations against the real Supabase database during the move.

---

## 2. Project state to carry over

| Item | Status |
|------|--------|
| M1 (status, audit, queue) | DONE, tests in place |
| M2 (Flow 1, AI_MODE, suggestion panel) | Not yet accepted: waiting for the project owner to run the 6 cases in `docs/M2-MANUAL-SMOKE.md` |
| D1, D3 (allow-list lookup, face processing disabled) | Done, tested |
| M3–M7, P0-OPS-01 | Not started |
| Awaiting decision | D4 (biometrics), D8 (Vision LLM), D9 (external LLM), the risk of `rejectBasis` containing PII |

**Latest baseline test results** (use these to compare on the new machine):

| Suite | Result |
|-------|--------|
| AI service | 122 tests OK |
| M2 contract | 11 OK |
| Backend unit | 25 (1 skipped if there is no test DB) |
| Worker | 20 pass |
| Workflow integration | 16/16 pass with 0 skips |
| AiResultPanel component | 5/5 |
| Backend and web builds | Pass |

---

## 3. Tasks on the old machine (before the move)

> **Current branch and commit (verified 17/11/2026):**
> - Branch: `1711`
> - Commit: `7929f49baabee659bdc167259093f1408f0851ef`
> - Working tree: clean (only untracked `.venv-ai/`, `.venv-evidence/`, `.hf-cache/`)

1. Run `git status` in the root folder. Commit or stash all changes, then push to the remote. Source code is transferred only through git, never copied by hand.
2. List everything that is not in git and decide how to carry it (see section 4).
3. Run the full test suite one more time and update the table in section 2 if the counts differ.
4. Stop and remove the old test container: `docker rm --force uniproof-m1-test-db`. The test database is disposable, so no backup is needed.
5. Record the branch name and commit in use so the new machine checks out the same one.

---

## 4. What to carry over

| Item | Where it lives | How to transfer |
|------|----------------|-----------------|
| Source code | Git remote | `git clone` on the new machine |
| Environment files (`.env`, Supabase dev variables, `AI_PIPELINE_URL`...) | Old machine, not in git | Recreate from `.env.example`. Get the Supabase keys again from the admin page; do not send them via chat or email. If you suspect a key has leaked, generate a new one |
| Vietnamese tessdata (`vie`) | tessdata folder (e.g. `%LOCALAPPDATA%\UniProofAI\tessdata`) | Download again, or copy the `vie.traineddata` file via USB drive or internal network share |
| Local dataset and labels (117 documents, `annotations.csv`, `pilot_source_map.csv`, `dataset-local` folder) | Old machine, outside git | **Contains real student data.** Transfer only by external drive or an approved internal network, never to cloud storage. If not needed yet, leave it on the old machine |
| `docs/` (CHECKLIST, DECISIONS, plans) | Git | Comes with the repo. Check whether any files are uncommitted |
| `.docker-test-config` folder | Old machine | No need to carry; recreate when needed |
| Notes and prompts used with the agent | This conversation | Save into `docs/` if you want to keep them |

---

## 5. Setting up the new machine

> [!IMPORTANT]
> No `.nvmrc` exists in the repo. No `engines` field is set in any `package.json`. The versions below are what the old machine runs today; pin them on the new machine to avoid drift.

| Tool | Version / source |
|------|-----------------|
| Git | Latest stable |
| Node.js | v24.19.0 (current on old machine; no `.nvmrc` or `engines` constraint) |
| npm | Bundled with Node |
| Python | 3.11 (specified in `requirements.txt` header and the 07/11 plan) |
| Docker Desktop | Latest stable (for the test database) |
| Tesseract OCR | With `vie` and `eng` language data, added to `PATH` |
| Google Chrome | Only needed if you want to rerun the browser smoke test (not required for acceptance) |

**Windows note:** the documents currently use PowerShell and paths like `D:\UniProof-AI`. If the new machine keeps the repo elsewhere, fix any commands with hard-coded paths (especially `DOCKER_CONFIG`).

---

## 6. Rebuilding the project

1. Clone and check out the exact branch and commit recorded in section 3:
   ```powershell
   git clone <remote-url>
   cd UniProof-AI
   git checkout 1711
   # verify: git rev-parse HEAD should be 7929f49baabee659bdc167259093f1408f0851ef
   ```

2. **AI service:** go to `apps/ai-service`, create a Python virtual environment, install `requirements.txt`.  
   Set `TESSDATA_PREFIX`, `TESSERACT_LANGUAGES=vie+eng`, `TESSERACT_TIMEOUT_SECONDS=20`.  
   Check that `http://127.0.0.1:8000/health` reports OCR as available.

3. **Backend:** go to `apps/backend`, run `npm install`, create the environment file from `.env.example`.

4. **Frontend:** go to `apps/web`, run `npm install`, set `VITE_API_URL` to point to the backend.

5. **Test database:** run the container `pgvector/pgvector:pg17`, create the database `edupoint_test` and the vector extension. Use `localhost` only and database names ending in `_test`. Port `55432` is the convention in `README.test.md`.
   ```powershell
   docker run --detach --rm --name uniproof-m1-test-db `
     --env POSTGRES_PASSWORD=test_only `
     --env POSTGRES_DB=edupoint_test `
     --publish 127.0.0.1:55432:5432 `
     pgvector/pgvector:pg17

   docker exec uniproof-m1-test-db psql -U postgres -d edupoint_test `
     -c 'CREATE EXTENSION IF NOT EXISTS vector;'
   ```

6. **Migration (test database only):** set `DATABASE_URL` and `DIRECT_URL` to the test database, run `npx prisma migrate deploy`.  
   If you hit error `P1014` at the baseline, follow the instructions in `README.test.md`:
   ```powershell
   npx prisma migrate resolve --applied 20261018000000_baseline_existing_supabase
   npx prisma migrate deploy
   ```
   > [!CAUTION]
   > The `migrate resolve` command is for the **test database only**. Never run it against the real Supabase database.

7. Run the tests as described in section 7.

8. Run the services with `AI_MODE=ASSIST` to try the UI, following `docs/M2-MANUAL-SMOKE.md`.

---

## 7. Verification after the move

> [!WARNING]
> Run these **sequentially** (not at the same time), since running them concurrently previously caused data isolation errors.

**AI service** (from `apps/ai-service`):
```powershell
$env:DEBUG = 'false'
python -m unittest test_flow1_flow2.py test_unified.py -q
```
Then the M2 contract test.

**Backend** (from `apps/backend`):
```powershell
npm run build
node --test test/evidence-processing-worker.test.cjs
```

**Integration** (needs `TEST_DATABASE_URL`, from `apps/backend`):
```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:test_only@127.0.0.1:55432/edupoint_test'
node --test test/workflow.integration.test.cjs
```
Requires **0 skips**.

**Frontend** (from `apps/web`):
```powershell
npm run build
npm test
```

**Final checks:**
```powershell
npx prisma validate
git diff --check
```

### Criteria for the move being complete

- Test counts on the new machine match the table in section 2 (or are higher if new tests were added).
- No unexpected skipped tests.
- A trial case goes through the whole flow: submission → AI → panel → officer decision → audit.

---

## 8. Risks and notes

| Risk | Mitigation |
|------|-----------|
| Running migrations against the real Supabase database | P0-OPS-01 (backup, trial restore, rollback) is still a TODO. Never point `DATABASE_URL` to production during the move |
| Secrets exposure | Do not commit `.env`, do not paste keys into chat. Use a separate dev key for the new machine |
| Real student data | Keep it only on authorized machines. Tests use synthetic data only |
| Environment differences | Different Tesseract versions, language data, and Node/Python versions can skew OCR results or tests. Record the versions in use in the documentation |
| Ports and container names | Earlier runs used different ports and container names. Set a single convention in `README.test.md` (port `55432`, container `uniproof-m1-test-db`) |
| Running two machines in parallel | The 07/11 plan is outdated relative to D1–D10. If you want to split work across two machines, each machine should edit only one area (`apps/ai-service/` or `apps/backend/` + `apps/web/`) and follow the current CHECKLIST |

---

## 9. Move checklist

- [ ] Old machine: pushed, branch and commit recorded, final test run done
- [ ] Files outside git listed and transfer method decided
- [ ] New machine: Git, Node (v24.19.0), Python 3.11, Docker, Tesseract (with `vie`) installed
- [ ] `.env` recreated from `.env.example`, new keys or keys retrieved from the admin page
- [ ] Test database set up, migration succeeded on the test database
- [ ] All tests in section 7 pass and match the figures in section 2
- [ ] AI service `/health` reports OCR as available
- [ ] Sample case run in `AI_MODE=ASSIST`
- [ ] Confirm the new machine is fully working before cleaning up the old one (delete real dataset, old keys if needed)

---

## 10. Next steps after the move

1. Run the 6 cases in `docs/M2-MANUAL-SMOKE.md` and record PASS/FAIL to accept M2.
2. Update `docs/` to match D1–D10 (two-machine plan, test cases for Flows 1 and 2, Flow 3, the status table in CHECKLIST).
3. Move on to M3 in the order given in the CHECKLIST.
