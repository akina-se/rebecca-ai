# AGENTS.md — `packages/*` (`@rebecca/*`)

Scoped architectural and contract rules for shared internal monorepo packages. Inherits all global invariants from root `../AGENTS.md`.

## 1. Leaf-Node Dependency Law & Build Topology

- **Strict Downward Dependency**: Packages under `packages/*` sit at the base of the workspace dependency graph. They **MUST NEVER** import from `apps/*`.
- **Internal Package Graph**:
  - `@rebecca/types` (`packages/types`): Zero-dependency domain interfaces, DTOs, and type guards. **Never** import `@google-cloud/firestore`, `firebase-admin`, `express`, or `@angular/*` into `@rebecca/types`. Represent all domain dates/timestamps as **ISO 8601 strings**.
  - `@rebecca/logger` (`packages/logger`): Structured JSON logging library compatible with Google Cloud Logging severity levels.
  - `@rebecca/persona` (`packages/persona`): Persona abstractions (`basePersona.ts`), active Japanese persona prompt rules (`personas/`), situational exemplars (`data/personaPatterns.json`), and precomputed embedding vectors (`personaPatternVectors.ts`).
  - `@rebecca/db` (`packages/db`): Depends on `@rebecca/types` and `@google-cloud/firestore`. Owns collection names, `FirestoreDataConverter<T>` boundary adapters (bridging Firestore `Timestamp`/`VectorValue` <-> domain models), `firestore.rules`, and `firestore.indexes.json`.
- **Topological Compilation**: Downstream workspaces consume compiled `dist/` outputs and `.d.ts` declarations. After editing any file under `packages/*`, run `npm run build` from the repository root before running downstream builds or tests.

## 2. Schema, Security Rules & Persona Governance

- **Schema & Index Parity**: Whenever modifying persisted models in `@rebecca/types` or converters/collections in `@rebecca/db`, simultaneously update `docs/database-schema.md` and (when query shapes/vectors change) `packages/db/firestore.indexes.json`.
- **Firestore Security Rules (`packages/db/firestore.rules`)**:
  - Direct client access is denied by default (`allow read, write: if false;`); all database access flows through authenticated backend services.
  - When authoring or modifying `packages/db/firestore.rules`, delegate to the dedicated `firestore-rules-author` subagent (or follow strict Firestore security rules auditing practices if subagents are unavailable) and highlight the rule diff for mandatory human review.
- **Pluggable Persona Encapsulation (`@rebecca/persona`)**:
  - `src/basePersona.ts` (`BasePersona`) and `src/types.ts` (`IPersonaDefinition`) define the character-agnostic engine (Layer 0 prompt synthesis from structured `metadata`, cosine-similarity anchor selection, and few-shot formatting).
  - `src/personas/rebecca.ts` (`RebeccaPersona` & `REBECCA_METADATA`) is the **Single Source of Truth (SSOT)** for all Rebecca-specific identity, profile specs, tone, `userCallsign`, `firstPerson`, `defaultHashtag`, UI branding (`brandName`, `adminTitle`, `avatarUrl`), `getBasePrompt`, `getDreamingPrompt`, and `formatAbsenceInstruction`, paired with the 120 situational patterns in `src/data/personaPatterns.json` (`personaPatternVectors.ts`).
  - **Swappability Invariant**: Never scatter character-specific traits into `BasePersona` or `apps/*`. Switching or adding an AI persona must only require swapping/adding a `BasePersona` subclass + 120-pattern dataset, regenerating `personaPatternVectors.ts` via `npm run generate:persona-vectors --workspace=bot-backend`, and registering the ID in `getActivePersona()` (`src/index.ts`).
  - Keep code/TSDoc in **English** while preserving **Japanese** persona text in `@rebecca/persona`.

## 3. Maintained Workspace Scripts

| Script / Command | Classification | Purpose & Usage Notes |
| :--- | :--- | :--- |
| `npm run build` | Safe Local (Root) | Builds `@rebecca/types`, `@rebecca/logger`, `@rebecca/persona`, `@rebecca/db`, and all downstream workspaces in topological order |
| `npm test --workspace=@rebecca/db` | Safe Local | Runs `@rebecca/db` Jest unit tests (`>= 80.0%` C0/C1 coverage gate) |
| `npm test --workspace=@rebecca/persona` | Safe Local | Runs `@rebecca/persona` Jest unit tests (`>= 80.0%` C0/C1 coverage gate) |
| `npm test --workspace=@rebecca/logger` | Safe Local | Runs `@rebecca/logger` Jest unit tests |
| `npm run lint --workspace=@rebecca/<pkg>` | Safe Local | Runs ESLint for the specified shared package (`types`, `db`, `logger`, `persona`) |
| `npm run secret-check --workspace=@rebecca/<pkg>` | Safe Local | Runs Secretlint on the target package |
| `npm run license-check --workspace=@rebecca/<pkg>` | Safe Local | Checks package dependency licenses against the OSI allowlist |
| `npm run deploy:db` | **Cloud-Mutating** | Deploys Firestore rules and indexes via Firebase CLI — **requires explicit human approval** |
| `npm run deploy:indexes` | **Cloud-Mutating** | Deploys `packages/db/firestore.indexes.json` via Firebase CLI — **requires explicit human approval** |
