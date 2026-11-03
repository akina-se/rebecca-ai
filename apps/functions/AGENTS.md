# AGENTS.md — `apps/functions`

Scoped architectural, idempotency, and lockfile rules for Firebase Cloud Functions (Gen 2, Node.js 24). Inherits all global invariants from root `../../AGENTS.md`.

## 1. Trigger Architecture & Idempotency

- **Separation of Concerns**:
  - `src/index.ts` & `src/triggers/*` (`authBlocking.ts`, `batchTimelineSync.ts`, `onConversationLogCreated.ts`): Thin Cloud Functions trigger bindings, authentication/secret header verification, event payload validation, and structured error logging.
  - `src/usecases/*`: Core aggregation and business logic decoupled from Firebase trigger wrappers for deterministic unit testing.
  - `src/services/*`: External API clients (e.g., `xApi.ts`).
- **Event-Driven Reliability**:
  - Firestore and HTTP batch triggers execute under **at-least-once** delivery semantics. Ensure counter increments, timeline sync writes, and aggregation mutations are idempotent or guarded against duplicate event replay.
  - Never weaken `beforeUserCreated` / `beforeUserSignedIn` checks in `authBlocking.ts`; unauthorized sign-ins must be rejected deterministically.

## 2. Isolated Lockfile & Override Synchronization (Mandatory CI Gate)

- Unlike other workspaces that rely solely on the root `package-lock.json`, Firebase Functions deployment requires an isolated **`apps/functions/package-lock.json`**.
- Continuous Integration enforces lockfile freshness via:
  ```bash
  npm run sync:functions-lock && git diff --exit-code apps/functions/package-lock.json
  ```
- **Mandatory Workflow on Any Dependency or Security Override Change**:
  1. Keep applicable transitive security `overrides` in `apps/functions/package.json` aligned with root `package.json`.
  2. Run `npm run sync:functions-lock` from the repository root.
  3. Stage `apps/functions/package-lock.json` alongside `package.json` changes.

## 3. Maintained Workspace Scripts

| Script / Command | Classification | Purpose & Usage Notes |
| :--- | :--- | :--- |
| `npm run sync:functions-lock` | Safe Local (Root) | Regenerates `apps/functions/package-lock.json` (`npm --prefix apps/functions install --package-lock-only`) |
| `npm run build --workspace=functions` | Safe Local | Compiles TypeScript into `apps/functions/lib/` |
| `npm run dev --workspace=functions` | Safe Local | Runs `tsc --watch` |
| `npm test --workspace=functions` | Safe Local | Runs Jest unit tests with coverage (`>= 80.0%` C0/C1 gate) |
| `npm run lint --workspace=functions` | Safe Local | Runs ESLint across `apps/functions` |
| `npm run secret-check --workspace=functions` | Safe Local | Scans workspace files via Secretlint |
| `npm run license-check --workspace=functions` | Safe Local | Verifies dependency licenses against the OSI allowlist |
| `npm run serve --workspace=functions` | Safe Local | Builds and starts the local Firebase Functions emulator |
| `npm run shell --workspace=functions` | Safe Local | Builds and opens the interactive `firebase functions:shell` harness |
| `npm run logs --workspace=functions` | Live Cloud Read | Streams Cloud Functions logs via Firebase CLI (requires authenticated Firebase session) |
| `npm run setup:scheduler --workspace=functions` | **Cloud-Mutating** | Provisions Cloud Scheduler job for `batchTimelineSync` (`scripts/setup-scheduler.ts`) — **requires explicit human approval** |
| `npm run deploy --workspace=functions` | **Cloud-Mutating** | Deploys Cloud Functions directly; production deploys run via CI/CD on `main` — **requires explicit human approval** |
