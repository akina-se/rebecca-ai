# AGENTS.md — `apps/bot-backend`

Scoped architectural and operational rules for the autonomous AI engine, worker, and batch processing service. Inherits all global invariants from root `../../AGENTS.md`.

## 1. Layered Architecture & Dependency Direction

Organize code strictly by responsibility:

- **`src/routes/` (`publicRoutes.ts`, `batchRoutes.ts`, `workerRoutes.ts`)**: Express route registration and authentication/rate-limit middleware attachment only.
- **`src/middleware/` (`batchAuth.ts`, `workerAuth.ts`, `apiRateLimiter.ts`)**:
  - `batchRoutes` and `workerRoutes` require verified Google OIDC tokens in production.
  - `BATCH_SECRET_KEY` is strictly forced to `undefined` when `NODE_ENV === 'production'` to prevent OIDC downgrade attacks—never weaken or bypass this check.
  - Public endpoints (`publicRoutes.ts`) must apply `apiRateLimiter` and input sanitization.
- **`src/features/<feature>/`**: Vertical feature slices (`routes.ts` -> `controller.ts` -> `usecase.ts` -> `repository.ts`, plus `types.ts` and `index.ts`).
  - `controller.ts`: Parse HTTP inputs, enforce boundary validation, invoke use cases, and map results/errors to HTTP responses.
  - `usecase.ts`: Pure domain orchestration injected with typed dependencies (`AppDependencies` / repository interfaces); no Express `Request`/`Response` coupling.
  - `repository.ts`: Feature-specific persistence queries via `@rebecca/db` converters.
- **`src/core/`**: Cross-feature domain engines (`contextInjector.ts`, `memory.ts`, `personaAnchoring.ts`, `personaEmbeddingCache.ts`, `postPipeline.ts`, `postPublisher.ts`, `rateLimiter.ts`).
- **`src/services/`**: External infrastructure adapters (`gemini.ts`, `xApi.ts`, `firestore.ts`, `storage.ts`, `tasks.ts`) plus `stripe` SDK injection inside `src/features/support/`.

## 2. External Integrations, Security & LLM Invariants

- **Stripe Payments & Webhooks (`src/features/support/`)**:
  - Preserve `express.json({ verify })` `rawBody` capture in `src/index.ts` and verify every Stripe webhook via `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. Never process unverified webhook JSON.
  - Validate Checkout Session IDs strictly (`^cs_[A-Za-z0-9_]{1,250}$`), enforce idempotency on `support_transactions`, redact session IDs in logs (`maskSessionId`), issue `HttpOnly`/`Secure` `reward_ticket` cookies within bounded time windows, and serve digital rewards exclusively via short-lived GCS Signed URLs.
- **X API (`@xdevplatform/xdk`) & Untrusted Input / Prompt-Injection Defense**:
  - Treat all incoming X mentions, user bios, web-search snippets, and supporter display names as untrusted adversarial input.
  - Run deterministic pre-filters (`sanitizeSupporterName` in `src/features/support/sanitizer.ts`) to block unsolicited `@` mentions, `#` hashtag hijacking, and `http(s)://` / `www.` phishing links before generating public appreciation posts or credits.
  - Keep untrusted user content clearly delimited from system persona instructions in prompts, enforce rate limiters (`src/core/rateLimiter.ts` + `apiRateLimiter.ts`), and validate remote image URLs (`src/utils/image.ts`) against SSRF/oversized payloads.
- **Gemini SDK (`@google/genai`)**: Route all model calls (generation, vision, search grounding, embeddings, LLM-as-a-Judge) through `src/services/gemini.ts`. Parse structured LLM outputs explicitly at the boundary and fail fast with contextual errors (`{ cause }`) on malformed responses—never mask broken schemas with `||` fallbacks.
- **Pluggable Persona Encapsulation & Japanese Prompt Integrity**:
  - **Zero Hardcoded Character Leakage**: Keep `src/features/**`, `src/core/**`, and `src/services/**` strictly character-agnostic. Never hardcode Rebecca-specific names, Gyaru speech endings, callsigns (`"マスター"`), birthday dates (`04-24`), or hashtags (`"#全肯定AIレベッカ"`) in `bot-backend`; always consume them dynamically via injected `deps.persona` (`IPersonaDefinition` from `@rebecca/persona`, sourced from `packages/persona/src/personas/rebecca.ts` and `personaPatterns.json`).
  - System prompts, character rules, and exemplar patterns in `@rebecca/persona` are intentionally written in **Japanese**—keep code comments and TSDoc in **English**, and never translate persona strings unless explicitly requested.
- **Persona Vector Synchronization**: Whenever trigger phrases or exemplars in `@rebecca/persona` (`personaPatterns.json`) are added, edited, or swapped for another persona, regenerate precomputed 768-dim embeddings via `npm run generate:persona-vectors --workspace=bot-backend`.
- **3-Tier Memory Consistency**: Preserve invariants across Working Memory, Episodic Buffer, and Consolidated Long-Term Memory (`coreProfile` + `rag_memories`). Synchronize any schema or lifecycle change with `@rebecca/types`, `@rebecca/db`, and `docs/database-schema.md`.
- **Tiered Rate Limiting & Quota Defense**:
  - Maintain two-tier rate limiting: (1) HTTP transport layer via `src/middleware/apiRateLimiter.ts` (`publicRateLimiter` per IP, `batchRateLimiter` for cron schedules, and `workerRateLimiter` as a circuit breaker), and (2) Domain conversation layer via `src/core/rateLimiter.ts` (`checkAndIncrementRateLimits` consuming `globalDailyLimit`, `userDailyLimit`, and `spamMinuteLimit` via atomic Firestore transactions).
- **Observability & Log Severity Hygiene**:
  - Log exclusively through `src/utils/logger.ts` (`@rebecca/logger`).
  - Emit `INFO` for normal pipeline lifecycle milestones (task enqueued, tweet posted, batch completed).
  - Emit `WARN` for quota caps, domain rate-limit blocks, supporter name sanitization fallbacks, and retryable transient upstream hiccups.
  - Reserve `ERROR` strictly for unhandled exceptions, failed task executions after retries are exhausted, or database corruption—preventing Cloud Error Reporting alert fatigue. Never log raw PII, private API keys, or unmasked Stripe Checkout Session IDs.

## 3. Maintained Workspace Scripts

Run from repository root using `--workspace=bot-backend` (or from `apps/bot-backend`):

| Script / Command | Classification | Purpose & Usage Notes |
| :--- | :--- | :--- |
| `npm run dev --workspace=bot-backend` | Safe Local | Starts `tsx watch src/index.ts` (set `PORT=8082` locally to avoid Firestore Emulator port `8080`) |
| `npm run build --workspace=bot-backend` | Safe Local | Compiles TypeScript to `dist/` (requires `@rebecca/*` packages built first) |
| `npm test --workspace=bot-backend` | Safe Local | Runs Jest `tests/unit` and `tests/integration` with coverage (`>= 80.0%` C0/C1 gate) |
| `npm run lint --workspace=bot-backend` | Safe Local | Runs ESLint across source and tests |
| `npm run secret-check --workspace=bot-backend` | Safe Local | Scans workspace files for leaked credentials via Secretlint |
| `npm run license-check --workspace=bot-backend` | Safe Local | Verifies dependency licenses against the repository OSI allowlist |
| `npm run chat --workspace=bot-backend` | Local + LLM Key | Interactive CLI dialogue harness (`scripts/chat.ts`). Writes `local_db.json` & `local_raw_logs.jsonl` locally—**never commit these files** |
| `npm run simulate --workspace=bot-backend` | Local + LLM Key | Multi-turn synthetic user-persona dialogue benchmark (`scripts/simulate.ts`) |
| `npm run test:eval --workspace=bot-backend` | Local + LLM Key | Executes Jest LLM evaluation suites (`tests/eval`); also runs in CI on PRs targeting `main` |
| `npm run batch:news --workspace=bot-backend` | Local + LLM Key | Runs proactive news generation harness with X posting mocked (`scripts/run-news.ts`) |
| `npm run batch:anniversary --workspace=bot-backend` | Local + LLM Key | Runs proactive anniversary post harness with X posting mocked (`scripts/run-anniversary.ts`) |
| `npm run generate:persona-vectors --workspace=bot-backend` | Local + LLM Key | Recomputes 768-dim Gemini embeddings for `@rebecca/persona` exemplar triggers (`scripts/generatePersonaVectors.ts`) |
| `npm run tool:get-lists --workspace=bot-backend` | Live External API | Queries owned X lists via OAuth 1.0a (`scripts/get-lists.ts`); requires human approval if hitting live X account |
| `npm run tool:upload-images --workspace=bot-backend` | **Cloud-Mutating** | Bulk-analyzes and uploads `./images` into GCS and Firestore (`scripts/upload-images.ts`) — **requires human approval** |
| `npx ts-node apps/bot-backend/scripts/create-list.ts` | **Cloud-Mutating** | Creates a public X list on the configured account — **requires human approval** |
| `npx ts-node apps/bot-backend/scripts/cleanup-images.ts` | **DESTRUCTIVE** | Deletes **all** Firestore `images` docs and GCS `images/` objects — **NEVER run without explicit human approval** |
| `npm run setup:scheduler --workspace=bot-backend` | **Cloud-Mutating** | Provisions/updates Cloud Scheduler HTTP jobs (`scripts/setup-scheduler.ts`) — **requires human approval** |
| `npm run setup:tasks --workspace=bot-backend` | **Cloud-Mutating** | Provisions the Cloud Tasks reply queue (`scripts/setup-tasks.ts`) — **requires human approval** |
| `npm run deploy --workspace=bot-backend` | **Cloud-Mutating** | Legacy manual Cloud Run deploy (`scripts/deploy.ts`); production deploys normally run via CI/CD on `main` — **requires human approval** |

> **Note on Legacy Batch Scripts**: Prefer testing `evolution`, `onboarding`, and `engagement` workflows via their Jest unit/integration tests under `tests/` or authenticated local HTTP `/batch/*` endpoints rather than legacy standalone wrappers (`scripts/run-evolution.ts`, `scripts/run-onboarding.ts`, `scripts/run-engagement.ts`, `scripts/test-qr.ts`).
