# AGENTS.md — `apps/dashboard-frontend`

Scoped architectural, state, and UI engineering rules for the Angular 22 Admin Dashboard SPA. Inherits all global invariants from root `../../AGENTS.md`.

## 1. Zoneless Angular 22 & Hexagonal Architecture

- **Zoneless Reactivity**:
  - The application runs with `provideZonelessChangeDetection()` (`src/app/app.config.ts`). Do **not** rely on `NgZone` patching or implicit mutation detection.
  - Manage component and view state with Angular **Signals** (`signal`, `computed`, `effect`, `input`, `output`) or explicit RxJS streams converted cleanly via `toSignal` / `AsyncPipe`.
  - Author all new UI elements as **Standalone Components** with strict template type checking.
- **Hexagonal Ports & Adapters (Mandatory Dependency Inversion)**:
  - Define domain data-access contracts as abstract ports + `InjectionToken`s in `src/app/core/ports/*.repository.ts`.
  - Implement concrete HTTP adapters in `src/app/infrastructure/http/http-*.repository.ts` and bind them in `src/app/app.config.ts`.
  - Feature/page components (`src/app/features/**`) and UI components (`src/app/shared/**`) **MUST NEVER** inject `HttpClient` directly or construct raw `/api/...` URLs.
  - Align all request/response DTOs with `@rebecca/types` and `apps/dashboard-backend/openapi.yaml`.

## 2. UI Design System & Atomic Component Rules (`docs/ui-design-guide.md`)

Consult and keep `docs/ui-design-guide.md` synchronized whenever introducing or modifying UI patterns:

- **Atomic Hierarchy (`src/app/shared/components/`)**:
  - `atoms/`: Minimal stateful primitives (e.g., `<app-checkbox>`); prefer CSS utility classes when no internal state is required.
  - `molecules/`: Composed interactive controls (e.g., `<app-custom-dropdown>`, `<app-date-picker-popover>`).
  - `organisms/`: Context-aware composite containers (e.g., `<app-right-drawer>`, `<app-bulk-action-bar>`, lightbox).
  - `features/`: Smart page views that orchestrate repository ports and pass immutable inputs/outputs to presentational components.
- **Strict Visual & Interaction Invariants**:
  - **Dark Glassmorphism Only**: Use semantic CSS custom properties (`var(--bg-base)`, `var(--bg-surface)`, `var(--color-primary)`, `var(--text-main)`, `var(--text-muted)`, `var(--success)`, `var(--danger)`). Never hardcode light-mode surfaces or jarring raw hex palettes.
  - **Zero Native Browser Controls/Dialogs**: Native `<select>`, `window.alert()`, `window.confirm()`, and `window.prompt()` are **strictly prohibited**. Always use `<app-custom-dropdown>`, `<app-right-drawer>`, or custom confirmation modals.
  - **Async Action Feedback**: Every button triggering an asynchronous operation **MUST** enter a `[disabled]` state and render an inline loading spinner until completion to prevent duplicate submissions.
  - **XSS & Client Security**: Rely on Angular's built-in DOM sanitization for all user/social/supporter text (`@handles`, post snippets, names). Never invoke `DomSanitizer.bypassSecurityTrust*` on untrusted or external strings, and never store secrets or service-account credentials in frontend `environment*.ts` bundles.

## 3. Frontend & Playwright E2E Testing Division (`apps/dashboard-e2e`)

- **Component & Port Unit Tests (Jest)**:
  - Test component Signals, template states, and domain logic via public component inputs/DOM outputs and injected fake `REPOSITORY` port providers—never reach into `private` methods (`(component as any)`).
  - Verify concrete user-observable state or emitted events in every test across **nominal**, **quasi-normal** (empty states, validation errors, disabled controls), **abnormal** (port HTTP failures / error banners), and **boundary** cases (max rows, input length caps); assertion-free render-only tests are forbidden.
- **Playwright End-to-End CUJs (`apps/dashboard-e2e`)**:
  - Lock down end-to-end **Critical User Journeys**: auth guards, navigation/route transitions, data table rendering & filtering, custom dropdowns/popovers, right-sliding drawers, confirmation modals, responsive layouts, and async loading states against local Firebase Emulators + BFF.
  - **Deterministic Motion & Assertions**: Use user-facing locators (`getByRole`, `getByLabel`, `getByText`) and Playwright web-first assertions (`await expect(...).toBeVisible()`, `toHaveURL`, `toHaveClass`, `toBeDisabled`). **Ban `page.waitForTimeout()`** and never assert brittle mid-transition animation frames; assert semantic state transitions (active classes, ARIA state, drawer/modal visibility) after Playwright auto-stabilizes the DOM.

## 4. Maintained Workspace Scripts

| Script / Command | Classification | Purpose & Usage Notes |
| :--- | :--- | :--- |
| `npm run dev --workspace=dashboard-frontend` | Safe Local | Launches Angular dev server (`ng serve`) on `http://localhost:4200` |
| `npm run build --workspace=dashboard-frontend` | Safe Local | Builds production SPA bundle into `dist/dashboard-frontend/browser` |
| `npm run watch --workspace=dashboard-frontend` | Safe Local | Continuous development build (`ng build --watch --configuration development`) |
| `npm test --workspace=dashboard-frontend` | Safe Local | Runs Jest (`--runInBand --coverage`); must satisfy the **>= 80.0% C0/C1** coverage gate |
| `npm run lint --workspace=dashboard-frontend` | Safe Local | Runs `ng lint` (`angular-eslint` + `typescript-eslint`) |
| `npm run secret-check --workspace=dashboard-frontend` | Safe Local | Scans workspace files via Secretlint |
| `npm run license-check --workspace=dashboard-frontend` | Safe Local | Validates frontend dependency licenses against the OSI allowlist |
| `node scripts/serve-frontend.js` | Safe Local | (Run from repo root after `build`) Serves compiled SPA on `127.0.0.1:4200` and reverse-proxies `/api/*` to `127.0.0.1:8081`, matching Firebase Hosting behavior |
| `npm run test:e2e` | Safe Local (Emulators) | (Run from repo root) Executes Playwright E2E tests in `apps/dashboard-e2e` against local emulators + BFF + frontend |
| `npm run deploy:hosting` | **Cloud-Mutating** | Builds SPA and deploys to Firebase Hosting; production deploys run via CI/CD on `main` — **requires explicit human approval** |
