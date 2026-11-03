# AGENTS.md — `apps/dashboard-e2e`

Scoped engineering rules for the Playwright End-to-End (E2E) test suite. Inherits all global invariants from root `../../AGENTS.md`.

## 1. Role in the Testing Trophy

- `apps/dashboard-e2e` verifies **full-stack Critical User Journeys (CUJs)** across the compiled Angular SPA (`scripts/serve-frontend.js` on `127.0.0.1:4200`), the Express BFF (`127.0.0.1:8081`), and local Firebase Emulators (`Firestore:8080`, `Auth:9099`, `Storage:9199`).
- Lock down user-visible integration contracts: authentication/session persistence, sidebar/topbar navigation and route URL transitions, table rendering/filtering/pagination, custom dropdowns and date-picker popovers, right-sliding drawers, confirmation modals, bulk-action bars, async button loading/disabled states, and responsive breakpoints.
- Keep combinatoric pure-logic or isolated signal permutations in `apps/dashboard-frontend` Jest unit suites so E2E execution remains fast and deterministic.

## 2. Locator, Assertion & Motion Rules (Zero Flakiness)

1. **User-Centric Locators**: Prefer `page.getByRole()`, `page.getByLabel()`, and `page.getByText()` (or stable `data-testid` attributes when semantic roles do not disambiguate). Avoid brittle deep DOM/CSS positional chains.
2. **Web-First Auto-Retrying Assertions Only**: Always `await expect(locator).toBeVisible()`, `toHaveText()`, `toHaveClass()`, `toBeDisabled()`, `toHaveAttribute()`, or `await expect(page).toHaveURL(...)`. Every test **MUST** assert concrete user-observable outcomes—navigation-only smoke runs without assertions are forbidden.
3. **Handling Animations, Drawers & Transitions**:
   - Rely on Playwright's built-in actionability auto-waiting; **strictly forbid `page.waitForTimeout(...)`**.
   - Never assert intermediate CSS animation frames or millisecond transition timings. Assert the **deterministic semantic end-state** (target URL, `.active`/`.open` state class, `aria-expanded`, modal/drawer visibility, or persisted table updates).
   - When testing motion accessibility, use `page.emulateMedia({ reducedMotion: 'reduce' })`.
4. **Test Isolation & Clean Artifacts**:
   - Seed deterministic synthetic data via `auth-helper.ts` / `seed-db.ts` using RFC 2606 dummy accounts (e.g., `admin@example.com`). Never depend on execution order across spec files unless explicitly structured inside a single serial CUJ block.
   - Never commit generated `playwright-report/`, `test-results/`, `screenshots/`, or `temp_upload*` artifacts to Git.
