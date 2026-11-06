# @rebecca/portal-web

Dedicated web portal workspace for Rebecca AI and pluggable persona landing pages, supporter hall of fame, and legal pages.

## Architectural Overview

- **Static Site Generator / MPA**: Vite 8 multi-page build compiling HTML templates, CSS, and client TypeScript into deterministic static assets.
- **Pluggable Brand & Persona Injection**: Active brand configuration (`activePortalConfig`) injected via `@rebecca/persona` and contract types from `@rebecca/types`. Swapping persona configurations updates all navigation, hero copy, themes, and metadata without modifying markup.
- **REST / BFF Integration**: Dynamic client scripts consume `/api/v1/support/*` endpoints with zero direct domain coupling.

## Pages

- `index.html`: Main landing page, character intro, gallery, news, and call to action.
- `supporters.html`: Community sponsorship program and live Hall of Fame roster.
- `support/thank-you.html`: Post-checkout supporter redemption and digital reward download.
- `tos.html`: Terms of Service.
- `privacy.html`: Privacy Policy.
- `legal.html`: Operational legal notices.
- `tokushoho.html`: Act on Specified Commercial Transactions disclosures.

## Available Scripts

- `npm run dev`: Launch local Vite development server with hot module reloading.
- `npm run build`: Compile static MPA output into `dist/`.
- `npm run preview`: Preview the production static output locally.
- `npm run lint`: Run ESLint across TypeScript and configuration files.
- `npm run test`: Run Jest unit tests and generate Istanbul code coverage.
- `npm run secret-check`: Verify absence of sensitive secrets using Secretlint.
- `npm run license-check`: Audit third-party licenses against the OSI allowlist.
