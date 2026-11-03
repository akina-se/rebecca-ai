# AGENTS.md — Engineering Governance & Agent Instructions

This file defines repository-wide invariants for AI coding agents and contributors. Follow scoped `AGENTS.md` files in workspace subdirectories and load `.agents/skills/*/SKILL.md` runbooks on demand for multi-step workflows.

## 1. System Topology & Dependency Rules

- **Runtime & Package Manager**: Node.js `>=24.0.0`, npm `>=10.0.0` (`npm` workspaces + Turborepo). **Always use `npm`; never use `pnpm` or `yarn`.**
- **Workspaces**:
  - `apps/bot-backend`: Autonomous AI engine, webhook/worker pipelines, RAG memory consolidation, external integrations (**Google Gemini API**, **X API** via `@xdevplatform/xdk`, **Stripe** checkout/webhooks, Cloud Tasks/Storage).
  - `apps/dashboard-backend`: Express 5 Backend-for-Frontend (BFF) REST API secured by Firebase Auth, Helmet, CORS allowlisting, and rate limiting.
  - `apps/dashboard-frontend`: Angular 22 Zoneless administration SPA (**Hexagonal ports/adapters**, **Atomic Design** UI hierarchy, Signals).
  - `apps/dashboard-e2e`: Playwright end-to-end test suite against local emulators and services.
  - `apps/functions`: Firebase Cloud Functions (Gen 2) asynchronous event and auth-blocking triggers.
  - `packages/types` (`@rebecca/types`), `packages/db` (`@rebecca/db`), `packages/logger` (`@rebecca/logger`), `packages/persona` (`@rebecca/persona`).
- **Unidirectional Dependency Law**:
  - `apps/*` may depend on `packages/*`.
  - `packages/*` **MUST NEVER** import from `apps/*`.
  - Sibling applications under `apps/*` **MUST NEVER** import source files directly from one another; share contracts exclusively via `@rebecca/*` packages or versioned HTTP/OpenAPI boundaries.

## 2. Canonical Commands & Quality Gates

Run all verification commands from the repository root before opening or updating any Pull Request:

| Gate | Command | Requirement |
| :--- | :--- | :--- |
| Install | `npm ci` | Deterministic root lockfile install |
| Build | `npm run build` | Topological TypeScript/Angular build (`@rebecca/*` before `apps/*`) |
| Lint | `npm run lint` | Zero ESLint / `ng lint` errors across all workspaces |
| Secrets | `npm run secret-check` | Zero credential/token matches via Secretlint |
| Licenses | `npm run license-check` | All transitive dependencies conform to OSI allowlist |
| Unit Tests | `npm run test:unit` | All Jest unit/integration suites pass with coverage enabled |
| Coverage Gate | `npm run test:coverage-summary` | **>= 80.0% C0/C1** (Statements, Branches, Functions, Lines) per gated workspace |
| Functions Lock | `npm run sync:functions-lock` | Required whenever root/functions dependencies or versions change |
| E2E Suite | `npm run test:e2e` | Required when Dashboard UI, BFF routes, Auth, or DB schemas change |

- **Repository Scripts & Operational Safety**:
  - Always prefer maintained npm/workspace scripts (`./start-local-env.ps1`, `./start-local-env.sh`, `scripts/*`, and `apps/*/scripts/*`) over ad-hoc one-liner commands; consult scoped `AGENTS.md` files and `.agents/skills/local-dev-and-verification/SKILL.md` for the full script catalog and required flags.
  - **Destructive / Cloud-Mutating Guardrail**: Scripts that deploy services, mutate Cloud Scheduler/Tasks, alter Firestore rules/indexes, provision admins, or delete storage/database records (`deploy*`, `setup:*`, `register-admin`, `cleanup-images.ts`) **MUST NEVER** be executed against non-emulator environments without explicit human authorization.

## 3. Architecture, Type Safety & Error Handling

1. **Strict Separation of Concerns (Clean / Hexagonal Architecture)**:
   - Keep transport layers (Express routes/controllers, Cloud Function triggers, Angular components) thin and free of domain persistence or raw SDK orchestration.
   - Isolate domain orchestration inside `usecase` / `core` modules and external I/O (Firestore, Cloud Storage, Cloud Tasks, Gemini, social APIs, HTTP) behind typed `repository` / `port` / `service` interfaces.
2. **Pragmatic DRY & High Cohesion**:
   - Centralize shared domain models (`@rebecca/types`), Firestore converters (`@rebecca/db`), structured logging (`@rebecca/logger`), and persona definitions (`@rebecca/persona`).
   - Apply the **Rule of Three** before extracting behavioral abstractions: eliminate true knowledge duplication without coupling distinct domain workflows via boolean flags.
3. **Strict Typing — Parse at Boundaries, Never Guess**:
   - Author all code under TypeScript `strict` mode. Never introduce `any`, `@ts-ignore`, or unverified `as SomeType` assertions. Inspect upstream definitions and model exact types (including discriminated unions and readonly properties) before writing implementation code.
   - **Trust Boundary Validation**: Treat external inputs (HTTP bodies/queries/headers, startup environment variables, raw Firestore/GCS payloads, external API responses, and non-deterministic LLM outputs) as untrusted until explicitly parsed and validated.
   - **Ban Speculative `||` Fallbacks**: Never guess property shapes (`payload.userId || payload.user_id || ''`) or silence missing required data with `value || defaultValue` (which masks upstream defects and corrupts valid falsy values `0`, `false`, `""`). Use nullish coalescing (`??`) **only** where an optional value has an explicit, specification-backed default; otherwise **fail fast** by throwing a descriptive `Error`.
   - **Trust Internal Validated Types**: Once data crosses a validated boundary into typed domain code, rely on static types rather than adding unreachable runtime guards that obscure control flow and degrade C1 branch coverage.
4. **Explicit Error Propagation & Observability**:
   - Never swallow exceptions in empty or log-only `catch` blocks unless an explicit fault-isolation contract is documented.
   - Preserve stack traces when rethrowing across layers using `new Error('Failed to <operation>', { cause: err })`.
   - Emit structured logs via `@rebecca/logger` in backend workspaces (never raw `console.log`/`console.error` in production paths) and never log PII, raw tokens, or secret payloads.

## 4. Testing Strategy & Behavioral Verification (Google SWE Standards)

- **Coverage Is a Floor, Never the Objective**: The `>= 80.0%` C0/C1 gate detects untested paths; never game it with assertion-free "line-licking" execution tests or weak `toBeDefined()` checks. Every test case **MUST** verify concrete, observable **expected outputs, state transitions, or thrown error contracts**.
- **Required Test Case Taxonomy (Beyond Happy Path)**: Design behavioral suites systematically across all four categories:
  1. **Nominal (Happy Path)**: Standard valid inputs and primary workflows.
  2. **Quasi-Normal (Domain/Validation Rejections)**: Expected non-error business branches—empty results (`[]`), quota/rate-limit caps, auth/role denials (`401`/`403`), input sanitization fallbacks, `404` lookups, and idempotent duplicate event skips.
  3. **Abnormal (Fault & Dependency Failures)**: Malformed payloads, Stripe signature mismatches, and upstream Gemini / X API / Firestore / Storage failures—asserting fail-fast `{ cause }` errors and zero partial state corruption.
  4. **Boundary Value & Equivalence Partitions**: Exact thresholds (`0`, `1`, `N - 1`, `N`, `N + 1` for string lengths, pagination/leaderboard caps, memory buffer limits, expiration windows, empty vs. whitespace strings, and UTC/JST midnight rollovers).
- **Test Behaviors via Public Contracts Only**:
  - **Never** test `private` / internal methods directly (no `(sut as any).privateFn()` or visibility widening for tests). Exercise internal logic exclusively through public APIs so internal refactoring never breaks tests.
  - If a `private` branch/helper cannot be reached via public inputs, **delete it as dead code**. If an internal algorithm warrants dedicated combinatorial tests, extract it into a standalone cohesive module with a public contract.
  - Prefer **state/outcome verification** and lightweight **Fakes/Stubs** at external I/O boundaries over brittle mock call-order choreography (`toHaveBeenCalledTimes` on internal collaborators).
- **Testing Trophy & Playwright UI Verification**:
  - Cover combinatoric logic, edge cases, Signals, and Hexagonal port interactions in fast **Jest unit/component suites**; lock down full-stack **Critical User Journeys (CUJs)**—rendering, interactive controls, drawers/modals, route transitions, and emulator persistence—in **Playwright E2E** (`apps/dashboard-e2e`).
  - Use Playwright **web-first auto-retrying assertions** (`await expect(locator).toBeVisible()`, `toHaveURL`, `toHaveClass`, `toBeDisabled`) and user-centric locators (`getByRole`, `getByLabel`, `getByText`). **Never** use `page.waitForTimeout()` or assert mid-frame CSS animation timing; verify deterministic UI end-states and accessibility attributes instead.

## 5. Code Documentation & Language Policy (Google TypeScript Style)

- **TSDoc / JSDoc Behavioral Contracts**:
  - Every exported class, function, interface, port, constant group, and non-trivial internal algorithm **MUST** carry an accurate English TSDoc/JSDoc comment (`/** ... */`) explaining **purpose/intent ("why"), invariants, units/timezones, side effects, and `@throws` failure modes**.
  - Per Google TypeScript Style, **never duplicate TypeScript types in JSDoc braces** (omit `{string}`, `@returns {Promise<Foo>}`, `@private`); TypeScript annotations are the single source of truth for types.
- **Zero Scratch or Dead Comments**:
  - Remove all WIP notes, debugging breadcrumbs, conversational artifacts, and commented-out code blocks prior to committing. Do not leave unlinked `TODO` comments; resolve deferred work or reference a tracked issue ID (`// TODO(#123): ...`).
- **Natural Language Boundary**:
  - Write all source comments, TSDoc, identifiers, log messages, commit messages, **GitHub Issue titles/bodies/comments**, **Pull Request titles/descriptions/review comments**, and engineering documentation strictly in **English**.
  - AI persona prompts and exemplar datasets (e.g., `@rebecca/persona` and prompt templates) are intentionally authored in **Japanese** to preserve character nuance—never translate them unless explicitly instructed.

## 6. Security, External Integrations & Zero-Leakage Policy

- **Application & Integration Security Invariants**:
  - **Authentication & Zero Production Bypass**: Enforce Google OIDC tokens on `/batch/*` and `/worker/*`, and Firebase ID tokens + active `admin_users` authorization (`authBlocking` + BFF `verifyAuth`) on administrative routes. Local-only switches (`BATCH_SECRET_KEY`, `NO_AUTH`) **MUST** remain inert/disabled when `NODE_ENV === 'production'`.
  - **Payment & Webhook Verification (Stripe)**: Verify `stripe-signature` against the unparsed `rawBody` buffer via `stripe.webhooks.constructEvent`, enforce idempotent transaction handling, mask bearer session IDs in logs, scope reward access with `HttpOnly`/`Secure` cookies + short-lived GCS Signed URLs, and never trust unverified client redirects.
  - **Social API (X) & Prompt-Injection Defense**: Treat X mentions/profiles, supporter custom fields, and web results as untrusted input. Strip unsolicited `@` mentions, `#` hashtags, and URLs before public posting (`sanitizeSupporterName`), isolate untrusted text from system instructions in LLM prompts, and respect X API OAuth 1.0a & rate-limit budgets.
  - **Web, Upload & Data-Layer Hardening**: Maintain `trust proxy`, `helmet()`, explicit `CORS_ALLOWED_ORIGINS` allowlists (no wildcard `*` with credentials in production), tiered `express-rate-limit` (including static/public routes), strict MIME/size/path validation on `multer`/GCS media and remote image fetches (SSRF/path-traversal defense), Angular built-in XSS sanitization (never pass untrusted strings to `bypassSecurityTrust*`), and default-deny `firestore.rules` (`allow read, write: if false;`).
- **Pre-Commit Zero-Leakage Audit (`git status` & `git diff --staged`)**:
  Verify **zero** items from the following categories exist in source, tests, mocks, comments, or documentation:
  1. **Personal Identifiable Information (PII)**: Real person names, personal email addresses, phone numbers, or real social media handles/user IDs (use RFC 2606 synthetic fixtures such as `user@example.com`, `user_001`).
  2. **Workstation & Environment Metadata**: Local filesystem paths (`/Users/...`, `/home/...`, `C:\...`, `D:\...`), OS usernames, hostnames, IDE state, or temporary scratch scripts/logs.
  3. **Server & Cloud Configuration Identifiers**: Real GCP project IDs or project numbers, real custom domains, Cloud Run URLs (`*.run.app`), Firebase Hosting URLs (`*.web.app`, `*.firebaseapp.com`), GCS bucket names, or service account emails. Inject runtime values via environment variables and use placeholders (`<GCP_PROJECT_ID>`, `<DEPLOY_REGION>`, `<SERVICE_URL>`, `<DASHBOARD_ORIGIN>`, `<SERVICE_ACCOUNT_EMAIL>`) in documentation.
  4. **Secrets & Credentials**: API keys, OAuth secrets, Stripe/webhook keys, bearer tokens, private keys, or `.env` files.

## 7. Living Documentation Synchronization

Every change affecting external or cross-module contracts **MUST** update its authoritative documentation in the same Pull Request:

- **Dashboard BFF Endpoints / DTOs / Auth**: `apps/dashboard-backend/openapi.yaml`
- **Firestore Collections / Memory Tiers / Rules / Indexes**: `docs/database-schema.md`, `packages/db/firestore.rules`, `packages/db/firestore.indexes.json`
- **Dashboard UI Components / Theme / UX Rules**: `docs/ui-design-guide.md`
- **System Behavior & Functional Specifications**: `docs/specification_en.md` and `docs/specification_ja.md`
- **Environment Variables, CLI Scripts, or Setup**: `.env.example`, `apps/*/.env.example`, root `README.md`, and workspace `README.md` files

## 8. Git, Issues, Pull Requests & Release Pipeline

- **GitHub Issues & Pull Requests (English-Only)**:
  - Author all GitHub Issues (following `.github/ISSUE_TEMPLATE/bug_report.yml` or `feature_request.yml`) and Pull Requests (following `.github/PULL_REQUEST_TEMPLATE.md`) **100% in English**, free of PII, local paths, or real cloud/server identifiers.
- **Branch & Deployment Promotion Flow**:
  1. Branch from latest `develop` using `<type>/<kebab-slug>` (`feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`).
  2. Decompose changes into **atomic commits**—each commit must represent one cohesive logical change that compiles cleanly and passes lint/tests independently.
  3. Format commit headers and PR titles per **Conventional Commits** (`release-please` SemVer governance): `feat:` (minor), `fix:` / `perf:` (patch), `<type>!:` or `BREAKING CHANGE:` footer (major), and `docs:` / `refactor:` / `test:` / `build:` / `ci:` / `chore:` (non-releasing maintenance).
  4. Open a Pull Request targeting `develop` and verify all CI checks pass.
  5. **MANDATORY HUMAN REVIEW GATE**: **STOP** after opening the PR and verifying CI. **Never** self-approve or merge any PR (`develop`, `main`, or Release Please) without explicit human review and approval in the current session.
  6. Upon human approval: merge to `develop` -> promote `develop` to `main` via Release PR (triggers CI + LLM Evaluation; merging to `main` triggers Cloud Build production deployment and opens/updates the Release Please PR) -> merge the Release Please PR (`chore(main): release x.y.z`) upon approval -> fast-forward sync `main` back into `develop`.

## 9. Scoped Instructions & Procedural Skills

- **Workspace Contracts**:
  - `apps/bot-backend/AGENTS.md` — AI engine features, pipelines, auth middleware, and LLM/RAG rules.
  - `apps/dashboard-backend/AGENTS.md` — Express 5 BFF architecture and OpenAPI contract parity.
  - `apps/dashboard-frontend/AGENTS.md` — Angular 22 Zoneless, Signals, Hexagonal ports, and UI design rules.
  - `apps/dashboard-e2e/AGENTS.md` — Playwright CUJ scope, web-first assertions, and deterministic transition testing.
  - `apps/functions/AGENTS.md` — Cloud Functions Gen 2 triggers and isolated lockfile synchronization.
  - `packages/AGENTS.md` — Shared workspace library boundaries, schema converters, and security rules.
- **On-Demand Procedural Skills (`.agents/skills/`)**:
  - `local-dev-and-verification`: Bootstrapping Firebase emulators, seeding data, running microservices, coverage gates, and Playwright E2E suites.
  - `pr-and-release-workflow`: Pre-commit sanitization audit, atomic commits, safe PR creation, CI verification, and Release Please promotion.
  - `code-review-and-quality-audit`: Senior-engineer pre-PR self-review checklist for architecture, strict typing, TSDoc, security, and doc parity.
