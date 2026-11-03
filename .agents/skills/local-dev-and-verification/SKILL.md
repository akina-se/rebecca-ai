---
name: local-dev-and-verification
description: Bootstraps the local development stack, runs maintained repository scripts safely, executes Jest unit/integration coverage gates, and runs Playwright E2E tests against Firebase Emulators. Use when starting local services, seeding emulators, choosing or executing repository scripts, debugging local ports, or running test and coverage suites.
---

# Local Development, Script Catalog & Test Verification Runbook

Follow this runbook to start local emulators and microservices, invoke maintained repository scripts safely, and execute full unit/coverage/E2E verification without leaving orphaned processes or untracked artifacts.

## 1. Local Service & Port Topology

| Service | Host & Port | Notes |
| :--- | :--- | :--- |
| Firestore Emulator | `127.0.0.1:8080` | Set via `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` |
| Firebase Auth Emulator | `127.0.0.1:9099` | Set via `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` |
| Firebase Storage Emulator | `127.0.0.1:9199` | Set via `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199` |
| Firebase Emulator UI | `http://127.0.0.1:4000` | Interactive inspector for Auth, Firestore, and Storage |
| Bot Backend (`apps/bot-backend`) | `http://127.0.0.1:8082` | Uses port `8082` locally so it does not collide with Firestore (`8080`) |
| Dashboard BFF (`apps/dashboard-backend`) | `http://127.0.0.1:8081` | Health check: `GET http://127.0.0.1:8081/health` |
| Dashboard Frontend (`apps/dashboard-frontend`) | `http://127.0.0.1:4200` | Angular dev server (`ng serve`) or static proxy (`scripts/serve-frontend.js`) |

## 2. Full Local Environment Startup

1. **Install Dependencies & Build Shared Packages**:
   ```bash
   npm ci
   npm run build
   ```
2. **Launch Local Stack via Maintained Bootstrap Scripts**:
   - **Windows (PowerShell)**: `./start-local-env.ps1` *(Note: Windows PowerShell 5.1 does not support `&&` chaining; run commands on separate lines and check `$LASTEXITCODE`)*
   - **macOS / Linux (Bash)**: `./start-local-env.sh`
   - Both scripts automatically:
     1. Clear stale listeners on local dev ports.
     2. Download/configure a portable Eclipse Temurin **JDK 21** under `.jdk/` (gitignored) if Java 21 is not installed globally.
     3. Launch Firebase Emulators (`auth`, `firestore`, `storage`, `functions`).
     4. Seed synthetic mock data and a dummy local administrator (`admin@example.com` / `password123`) via `apps/dashboard-backend/scripts/seed-db.ts`.
     5. Launch `bot-backend` (`8082`), `dashboard-backend` (`8081`), and `dashboard-frontend` (`4200`) with logs under `.logs/`.

## 3. Master Catalog of Maintained Repository Scripts

Always check the **Safety Classification** before executing any script:
- **Safe Local**: Runs strictly offline or against local files/tests. Autonomous execution permitted.
- **Emulator Only**: Mutates Auth/Firestore; verify `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set to `127.0.0.1` first.
- **Local + LLM Key**: Calls Gemini API using `.env` `GEMINI_API_KEY` without mutating production databases.
- **Cloud-Mutating / DESTRUCTIVE**: Modifies live GCP/Firebase/X resources or deletes records. **NEVER execute without explicit human authorization.**

### A. Root Monorepo Scripts (`package.json` & `scripts/`)

| Command | Safety | Purpose |
| :--- | :--- | :--- |
| `npm run build` | Safe Local | Builds `@rebecca/*` packages then `apps/*` in topological order via Turborepo |
| `npm run dev` | Safe Local | Starts `turbo run dev` watchers across workspaces |
| `npm run lint` | Safe Local | Runs ESLint 10 and `ng lint` across all workspaces |
| `npm run secret-check` | Safe Local | Runs Secretlint across all workspaces |
| `npm run license-check` | Safe Local | Verifies all dependencies match the OSI license allowlist |
| `npm run test:unit` | Safe Local | Runs all Jest unit & integration suites (`--filter=!dashboard-e2e`) with coverage |
| `npm run test:coverage-summary` | Safe Local | Runs `scripts/ci-coverage-summary.js`; fails if any gated workspace drops below **80.0% C0/C1** |
| `npm run test:e2e` | Emulator Only | Executes Playwright E2E tests in `apps/dashboard-e2e` |
| `node scripts/serve-frontend.js` | Safe Local | Serves `apps/dashboard-frontend/dist/dashboard-frontend/browser` on `:4200` and proxies `/api/*` to `:8081` |
| `npm run sync:functions-lock` | Safe Local | Synchronizes `apps/functions/package-lock.json` (`npm --prefix apps/functions install --package-lock-only`) |
| `npm run register-admin -- [args]` | **Cloud-Mutating** | Invokes `apps/dashboard-backend/scripts/register-admin.ts` (`--help`, `--list`, `--email=...`, `--role=ADMIN`, `--status=ACTIVE\|REVOKED`, `--delete`) |
| `npm run deploy:hosting` | **Cloud-Mutating** | Builds frontend and deploys to Firebase Hosting (human approval required) |
| `npm run deploy:db` / `deploy:indexes` | **Cloud-Mutating** | Deploys Firestore security rules / composite & vector indexes (human approval required) |
| `npm run setup:scheduler` | **Cloud-Mutating** | Provisions Cloud Scheduler jobs for `bot-backend` (human approval required) |
| `./scripts/deploy-monorepo.ps1` / `.sh` | **Cloud-Mutating** | Full manual Artifact Registry + Cloud Run + Hosting + Functions deploy orchestrator (`main` CI/CD via `cloudbuild.yaml` is preferred; human approval required) |

### B. Workspace-Specific Utility Scripts

| Workspace | Command | Safety | Purpose |
| :--- | :--- | :--- | :--- |
| `dashboard-backend` | `npx ts-node -T apps/dashboard-backend/scripts/seed-db.ts` | Emulator Only | Seeds Auth & Firestore emulators with deterministic dashboard test fixtures |
| `bot-backend` | `npm run chat --workspace=bot-backend` | Local + LLM Key | Interactive terminal chat with Rebecca persona. Delete untracked `local_db.json` & `local_raw_logs.jsonl` afterward |
| `bot-backend` | `npm run simulate --workspace=bot-backend` | Local + LLM Key | Runs multi-persona synthetic conversation benchmark (`scripts/simulate.ts`) |
| `bot-backend` | `npm run test:eval --workspace=bot-backend` | Local + LLM Key | Runs Jest LLM evaluation tests (`tests/eval`) |
| `bot-backend` | `npm run generate:persona-vectors --workspace=bot-backend` | Local + LLM Key | Recomputes 768-dim Gemini embeddings for `@rebecca/persona` patterns (`scripts/generatePersonaVectors.ts`) |
| `bot-backend` | `npm run batch:news --workspace=bot-backend` | Local + LLM Key | Dry-run harness for news post generation (X posting mocked) |
| `bot-backend` | `npm run batch:anniversary --workspace=bot-backend` | Local + LLM Key | Dry-run harness for anniversary post generation (X posting mocked) |
| `bot-backend` | `npm run setup:tasks --workspace=bot-backend` | **Cloud-Mutating** | Creates Cloud Tasks queue via `gcloud` (human approval required) |
| `bot-backend` | `npm run tool:upload-images --workspace=bot-backend` | **Cloud-Mutating** | Uploads & indexes images into GCS and Firestore (human approval required) |
| `bot-backend` | `npx ts-node apps/bot-backend/scripts/cleanup-images.ts` | **DESTRUCTIVE** | Wipes **all** Firestore `images` docs and GCS `images/` files (explicit human approval mandatory) |
| `functions` | `npm run serve --workspace=functions` | Safe Local | Builds and launches Firebase Functions emulator |
| `functions` | `npm run setup:scheduler --workspace=functions` | **Cloud-Mutating** | Provisions `batchTimelineSync` Cloud Scheduler job (human approval required) |

## 4. Executing Unit, Coverage & Headless Playwright E2E Verification

### Step 1: Unit Tests & 80% C0/C1 Coverage Gate
```bash
npm run build
npm run test:unit
npm run test:coverage-summary
```
- Every gated workspace (`@rebecca/persona`, `@rebecca/db`, `apps/bot-backend`, `apps/dashboard-backend`, `apps/functions`, `apps/dashboard-frontend`) must achieve **>= 80.0%** across Statements, Branches, Functions, and Lines.
- Cover **nominal (happy path)**, **quasi-normal (domain rejections, rate limits, empty states, idempotency)**, **abnormal (upstream API/DB faults, malformed schemas)**, and **boundary values (`0`, `1`, `max - 1`, `max`, `max + 1`, timezone rollovers)** through public contracts with explicit outcome assertions—never test `private` methods or add assertion-free tests.

### Step 2: Isolated Playwright E2E Execution (CI Parity)
When changes affect `dashboard-frontend`, `dashboard-backend`, `@rebecca/types`, `@rebecca/db`, or `apps/dashboard-e2e`:
1. Ensure Java 21 is on `PATH` (use `.jdk/` if installed by `start-local-env.*`).
2. Start Firebase Emulators in the background (`npx firebase-tools emulators:start --only auth,firestore,storage --project <LOCAL_EMULATOR_PROJECT_ID>`).
3. Wait for ports `8080`, `9099`, and `9199` to accept TCP connections, then seed the emulators with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`, and `GCLOUD_PROJECT=<LOCAL_EMULATOR_PROJECT_ID>` via:
   ```bash
   npx ts-node -T apps/dashboard-backend/scripts/seed-db.ts
   ```
4. Build the monorepo so `apps/dashboard-frontend/dist/dashboard-frontend/browser` and `apps/dashboard-backend/dist` are current:
   ```bash
   npm run build
   ```
5. Run Playwright (`playwright.config.ts` automatically boots `dashboard-backend` on `:8081` and `scripts/serve-frontend.js` on `:4200`):
   ```bash
   npm run test:e2e
   ```
6. **Mandatory Teardown**: Terminate any background Firebase Emulator processes you started and verify `git status` contains zero leftover `.logs/`, `screenshots/`, `local_db.json`, or temporary upload files.
