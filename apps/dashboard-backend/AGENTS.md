# AGENTS.md — `apps/dashboard-backend`

Scoped architectural and contract rules for the Admin Dashboard Backend-for-Frontend (BFF) API (`Express 5`). Inherits all global invariants from root `../../AGENTS.md`.

## 1. Architecture & Security Boundaries

- **Feature Structure**: Organize endpoints under `src/features/<domain>/{controller.ts,usecase.ts,repository.ts,index.ts}`.
  - `controller.ts`: Validate HTTP parameters, query strings, multipart uploads (`multer`), and JSON bodies at the trust boundary before calling `usecase.ts`. Never pass raw Express `Request`/`Response` objects into use cases or repositories.
  - `usecase.ts`: Coordinate business rules, pagination, date/timezone normalization (`luxon`), and cross-service orchestration.
  - `repository.ts`: Read/write Firestore strictly via `@rebecca/db` typed collection helpers and converters.
- **RESTful Endpoints & Mandatory Pagination**:
  - Expose resources under `/api/v1/<plural-resource>` (`/api/v1/posts`, `/api/v1/users`). Use standard status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Error`).
  - **Zero Unbounded Scanning**: All collection endpoints **MUST** implement bounded pagination with query parameters `limit` (default with safe upper cap, e.g. `Math.min(limit, 100)`) and offset (`page`) or cursor (`startAfterId`, `beforeTimestamp`).
- **Authentication, Authorization & Logging Hygiene (`src/middleware/auth.ts`)**:
  - Every non-public administrative route **MUST** verify Firebase ID tokens and enforce active administrator authorization (`admin_users` collection / custom claims, reinforced by `authBlocking.ts` in `apps/functions`).
  - `NO_AUTH` mode is restricted strictly to local emulator development/E2E (`NODE_ENV !== 'production'`); never permit auth bypass flags in production.
  - **Severity Discipline**: Log authentication failures, client rejections, and invalid parameters at `logger.warn`; reserve `logger.error` exclusively for unhandled exceptions and infrastructure outages (Cloud Error Reporting targets `ERROR` severity for incident alerts).
  - Never expose stack traces, internal service URLs, or raw upstream exception payloads in HTTP error responses; strip CR/LF characters from untrusted inputs before logging and emit structured diagnostics via `src/utils/logger.ts` (`@rebecca/logger`).
- **HTTP, Upload & Storage Hardening (`src/app.ts`, `src/utils/image.ts`, `src/utils/gcs.ts`)**:
  - Preserve `app.set('trust proxy', 1)`, `helmet()`, `express-rate-limit`, and explicit `CORS_ALLOWED_ORIGINS` validation (never allow wildcard `*` origins alongside `credentials: true` in production).
  - Enforce strict file-size limits, MIME/magic-byte verification (`@silvia-odwyer/photon-node`), and sanitized GCS object keys (no `..` path traversal) on all `multer` multipart uploads.
- **Internal Service Delegation & Persona Agnosticism (`src/core/botServiceClient.ts`, `src/features/config/`, `src/features/copilot/`)**:
  - Trigger synchronous administrative actions on `bot-backend` (e.g., force dreaming, manual batch triggers) through `botServiceClient.ts` using Google OIDC identity tokens in cloud environments (`BOT_BACKEND_URL` env var). Never hardcode Cloud Run URLs.
  - Resolve persona display names, `brandName`, `adminTitle`, `avatarUrl`, and copilot prompts dynamically via `getActivePersona()` (`@rebecca/persona`) rather than hardcoding Rebecca-specific lore in BFF controllers or use cases.

## 2. Mandatory OpenAPI Contract Synchronization

- **`apps/dashboard-backend/openapi.yaml` (OpenAPI 3.0.3)** is the single source of truth for the Dashboard REST contract.
- Any change to route paths, HTTP methods, request headers/query/body schemas, response DTOs, pagination envelopes, or error status codes **MUST** update `apps/dashboard-backend/openapi.yaml` and shared DTO interfaces in `@rebecca/types` within the **same commit or Pull Request**.

## 3. Maintained Workspace Scripts

| Script / Command | Classification | Purpose & Usage Notes |
| :--- | :--- | :--- |
| `npm run dev --workspace=dashboard-backend` | Safe Local | Starts `tsx watch src/index.ts` (defaults to `PORT=8081` in local dev) |
| `npm run build --workspace=dashboard-backend` | Safe Local | Compiles TypeScript to `dist/` |
| `npm test --workspace=dashboard-backend` | Safe Local | Runs Jest unit/integration tests with coverage (`>= 80.0%` C0/C1 gate) |
| `npm run lint --workspace=dashboard-backend` | Safe Local | Runs ESLint across workspace files |
| `npm run secret-check --workspace=dashboard-backend` | Safe Local | Scans workspace for accidentally hardcoded secrets |
| `npm run license-check --workspace=dashboard-backend` | Safe Local | Verifies transitive dependency license compliance |
| `npx ts-node -T apps/dashboard-backend/scripts/seed-db.ts` | **Emulator Only** | Seeds mock timeline logs, users, KPI stats, and test admin (`admin@example.com`). **Always verify `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and `FIREBASE_STORAGE_EMULATOR_HOST` point to `127.0.0.1` before running** |
| `npm run register-admin -- --help` | Safe Read | Prints CLI options for `apps/dashboard-backend/scripts/register-admin.ts` |
| `npm run register-admin -- --email=<EMAIL> --role=ADMIN [--status=ACTIVE\|REVOKED] [--action=add\|update\|delete\|list]` | **Cloud-Mutating** | Provisions, revokes, lists, or deletes administrators in Firestore `admin_users` and Firebase Auth custom claims — **requires explicit human approval against non-emulator projects** |
