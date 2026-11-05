# AGENTS.md — apps/portal-web Workspace Invariants

## Workspace Scope & Topology

`apps/portal-web` is the dedicated web portal application for Rebecca AI. It builds the public-facing static MPA website using Vite.

## Architectural Invariants

1. **Unidirectional Dependency Law**:
   - `apps/portal-web` may import from `@rebecca/types` and `@rebecca/persona`.
   - `apps/portal-web` MUST NEVER import from sibling apps (`apps/bot-backend`, `apps/dashboard-*`, `apps/functions`).
   - Sibling apps MUST NOT import from `apps/portal-web` source.

2. **Pluggable Brand & Persona Encapsulation**:
   - Zero character hardcoding in component templates.
   - All branding, color schemes, asset paths, and character metadata MUST flow from `activePortalConfig` sourced from `@rebecca/persona` via contracts in `@rebecca/types`.

3. **Strict Typing & Boundaries**:
   - Author all TypeScript under `strict: true`.
   - Never use `any`, speculative `||` fallbacks, or unverified type assertions.
   - Parse untrusted external inputs (e.g., query params, API responses) before usage.

4. **Testing & Quality Gates**:
   - Maintain `>= 80.0%` coverage across Statements (C0), Branches (C1), Functions, and Lines.
   - Run tests with `npm run test` or `npm run test:unit`.
   - Zero ESLint errors (`npm run lint`), zero Secretlint violations (`npm run secret-check`), and 100% OSI license compliance (`npm run license-check`).
