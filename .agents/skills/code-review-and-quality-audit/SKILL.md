---
name: code-review-and-quality-audit
description: Performs a rigorous Google Senior Engineer code, test, security, and documentation audit before opening or reviewing a Pull Request. Use when self-reviewing changes, auditing test quality, checking TypeScript strictness and fail-fast boundaries, or reviewing PR diffs.
---

# Senior Engineering Self-Review & Quality Audit Checklist

Execute this objective audit across the entire diff (`git diff develop...HEAD`) before opening any Pull Request or signing off on an implementation. Reject shortcuts; fix every violation before requesting human review.

## 1. Architecture, Separation of Concerns & Cohesion

- [ ] **Layer Purity**: Controllers, Cloud Function triggers, and Angular components contain zero persistence queries or raw external SDK orchestration. Use cases contain zero HTTP (`req`/`res`) or UI framework coupling.
- [ ] **Unidirectional Workspace Graph**: Zero imports from `apps/*` inside `packages/*`; zero direct cross-app imports between sibling `apps/*` workspaces; `dashboard-frontend` accesses data strictly via `core/ports/*.repository.ts` tokens rather than raw `HttpClient`.
- [ ] **Pragmatic DRY vs. High Cohesion**: Shared domain schemas, constants, and converters live in `@rebecca/*` or shared `core/` modules rather than copy-pasted across files; conversely, distinct domain behaviors are not prematurely coupled behind boolean-flag helper functions.
- [ ] **Pluggable Persona Encapsulation**: Zero Rebecca-specific character lore, speech endings, callsigns, birthdays, hashtags, or branding strings are hardcoded inside `apps/*`; all persona traits reside in `packages/persona/src/personas/rebecca.ts` and `personaPatterns.json` (`IPersonaDefinition`).

## 2. Type Safety, Boundary Validation & Fail-Fast Error Handling

- [ ] **Zero Type Escapes**: No `any`, `@ts-ignore`, `@ts-expect-error` without justification, or unvalidated `as TargetType` casts. Upstream data shapes were inspected and modeled with exact interfaces / discriminated unions.
- [ ] **Parse at Trust Boundaries**: All external inputs (HTTP params/bodies, env config, Firestore/GCS payloads, external API responses, LLM outputs) are validated at entry boundaries before entering internal domain code.
- [ ] **Zero Speculative `||` Fallbacks**:
  - No property-name guessing (`obj.userId || obj.user_id || obj.id`).
  - No bug-masking `value || fallback` coercions that silently swallow missing required state or corrupt falsy values (`0`, `false`, `""`).
  - Optional defaults use `??` **only** when backed by an explicit product/API specification; missing required state throws a descriptive `Error` immediately.
  - Internal typed functions do not contain unreachable defensive `typeof` checks that bloat cyclomatic complexity.
- [ ] **Error Context & Observability Hygiene**: Rethrown errors preserve causal chains (`new Error('...', { cause: err })`); zero empty/silent `catch` blocks; backend logs use `@rebecca/logger` with accurate Google Cloud Logging severity (`DEBUG`/`INFO`/`WARN`/`ERROR`); **4xx client errors, quota rate limits, and expected business blocks are never logged as `ERROR`** (preventing Cloud Error Reporting alert fatigue); zero PII, raw tokens, or unmasked secrets in logs.
- [ ] **RESTful API Standards & Mandatory Pagination**: Routes use lowercase plural nouns (`/api/v1/posts`, `/api/v1/users`); list endpoints enforce bounded `limit` caps and pagination (`page` or `startAfterId`/`beforeTimestamp`), banning unbounded table scans; endpoints adhere to layered authorization (`verifyAuth` / OIDC) and tiered rate limits.

## 3. Testing Strategy & Behavioral Verification Audit

- [ ] **Meaningful Assertions Only (Zero Coverage Gaming)**: Every `it(...)` / `test(...)` block asserts specific observable outputs, state mutations, HTTP responses, or thrown error contracts. Reject assertion-free execution tests and tautological mock checks written merely to hit the `>= 80.0%` C0/C1 threshold.
- [ ] **Complete Test Taxonomy (Nominal, Quasi-Normal, Abnormal & Boundary Values)**: Suites cover not just happy paths, but also quasi-normal domain rejections (empty sets, rate limits, `401`/`403`/`404`, idempotent skips, sanitized inputs), abnormal upstream/signature failures (fail-fast `{ cause }` propagation without state corruption), and exact boundary values (`0`, `1`, `max - 1`, `max`, `max + 1`, empty/whitespace strings, timezone midnight boundaries).
- [ ] **Public API Encapsulation**: Zero tests invoke `private` or internal methods directly (`(instance as any).privateHelper()` or `instance['privateHelper']()`). Any unreachable private helper or dead branch has been deleted; complex algorithms requiring standalone combinatorial testing were extracted into dedicated modules with public contracts.
- [ ] **State Over Brittle Interaction Choreography**: Unit tests assert returned values and Fake/Stub state at architectural ports rather than fragile internal call-count assertions.
- [ ] **Playwright UI & CUJ Rigor (When UI/BFF Touched)**:
  - Critical User Journeys (rendering, user interactions, custom dropdowns/drawers/modals, route transitions, async loading/disabled states) are locked down in `apps/dashboard-e2e`.
  - Specs use user-centric locators (`getByRole`, `getByLabel`, `getByText`) and Playwright web-first assertions (`await expect(...).toBeVisible()`, `toHaveURL`, `toHaveClass`).
  - Zero `page.waitForTimeout(...)` sleeps and zero flaky mid-frame CSS animation assertions; motion/transitions are verified via deterministic semantic end-states.

## 4. TSDoc/JSDoc & Comment Hygiene (Google TypeScript Style)

- [ ] **Complete Behavioral TSDoc**: Every exported symbol, interface, port, and non-trivial algorithm has an accurate **English** `/** ... */` docblock explaining intent ("why"), invariants, units/timezones, side effects, and `@throws` conditions.
- [ ] **Zero Redundant JSDoc Type Tags**: No `{string}`, `{Promise<Foo>}`, or `@private` tags duplicating TypeScript static types.
- [ ] **Clean Diff**: Zero commented-out dead code, exploratory scratch comments, or unlinked `TODO` markers; Japanese strings appear strictly inside intentional AI persona/prompt definitions.

## 5. Security, Privacy & Supply-Chain Integrity

- [ ] **Auth, Webhook & Endpoint Hardening**: OIDC (`batchAuth`/`workerAuth`) and Firebase Auth (`verifyAuth`/`authBlocking`) checks are intact; local dev flags (`BATCH_SECRET_KEY`, `NO_AUTH`) cannot activate in `production`; Stripe webhooks verify `stripe-signature` against `rawBody` with idempotent processing and masked session logs; `helmet`, explicit `CORS_ALLOWED_ORIGINS`, `trust proxy`, and `express-rate-limit` remain enforced.
- [ ] **Injection, Upload & XSS Defense**: Untrusted X/supporter/web strings are sanitized against unsolicited `@` mentions, `#` hashtags, phishing URLs, prompt injection, and log newline injection; `multer`/GCS/remote-image handlers validate MIME, size, URL host/scheme (SSRF), and object paths; Angular templates never call `bypassSecurityTrust*` on untrusted data; `firestore.rules` preserves client default-deny (`if false`).
- [ ] **Zero-Leakage Verification**: Diff contains **zero** real human names/emails/handles, **zero** local workstation paths (`C:\`, `D:\`, `/Users/`), **zero** real GCP project IDs/numbers, domains, `*.run.app` / `*.web.app` URLs, or service account emails, and **zero** secrets.
- [ ] **Dependency & Lockfile Hygiene**: `npm run secret-check` and `npm run license-check` pass; if dependencies or `overrides` changed, `apps/functions/package-lock.json` was synchronized via `npm run sync:functions-lock` (note: never override `glob` globally to v14, as `license-checker` requires `glob` v7 compatibility).

## 6. Living Documentation Synchronization

- [ ] `apps/dashboard-backend/openapi.yaml` updated if any BFF endpoint, parameter, status code, or DTO changed.
- [ ] `docs/database-schema.md`, `packages/db/firestore.rules`, and `packages/db/firestore.indexes.json` updated if any collection schema, converter, memory tier, or query index changed.
- [ ] `docs/ui-design-guide.md` updated if new shared Atomic UI components or interaction patterns were introduced.
- [ ] `docs/specification_en.md`, `docs/specification_ja.md`, `.env.example`, `apps/*/.env.example`, and `README.md` updated if system behavior, environment variables, or scripts changed.
