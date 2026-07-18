# Rebecca AI - Monorepo Specification

[![CI Status](https://github.com/akina-se/rebecca-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/akina-se/rebecca-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/akina-se/rebecca-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/akina-se/rebecca-ai/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Rebecca is a serverless personal "Gyaru AI" system leveraging the Gemini API and Firebase/Google Cloud Platform. The codebase is organized as a unified monorepo using npm Workspaces and Turborepo.

---

## 🏗️ Monorepo Topology

```mermaid
graph TD
    User([User on X/Twitter]) <-->|Mentions & Replies| BotBackend[apps/bot-backend]
    Admin([Dashboard Operator]) <-->|Angular UI| DashFrontend[apps/dashboard-frontend]
    DashFrontend <-->|JSON REST API| DashBackend[apps/dashboard-backend BFF]
    
    subgraph Shared Libraries
        Types[packages/types]
        DB[packages/db]
        Persona[packages/persona]
    end
    
    DashBackend <-->|gRPC Deletions| BotBackend
    BotBackend -.->|Write logs| Firestore[(Cloud Firestore)]
    Firestore -.->|Event Trigger| Functions[apps/functions]
    Functions -.->|Aggregate Read Models| Firestore
    DashBackend -->|Query Read Models| Firestore
    
    DashBackend -.-> Shared Libraries
    BotBackend -.-> Shared Libraries
    Functions -.-> Shared Libraries
```

---

## 📂 Workspace Directory Structure

The project code is divided into standard applications (`apps/`) and shared modules (`packages/`):

### Applications (`apps/`)
- **[`apps/bot-backend`](./apps/bot-backend)**: Core bot processing worker (RAG memory injection, intent analysis, X API integration, and background Dreaming evolution).
- **[`apps/dashboard-backend`](./apps/dashboard-backend)**: BFF (Backend-for-Frontend) server providing administrative REST endpoints to the control panel, secured via Firebase Auth.
- **[`apps/dashboard-frontend`](./apps/dashboard-frontend)**: Chibi-themed glassmorphic Angular administration control panel.
- **[`apps/functions`](./apps/functions)**: Firebase Cloud Functions (aggregates raw timeline interactions into read-ready statistics to optimize DB performance).

### Packages (`packages/`)
- **[`packages/types`](./packages/types)**: Shared Type Definitions (e.g., interaction structures, common configurations, statuses).
- **[`packages/db`](./packages/db)**: Shared database repository classes and connection managers.
- **[`packages/persona`](./packages/persona)**: Rebecca's core persona definition prompts and JST-focused system rules.
- **[`packages/grpc-schemas`](./packages/grpc-schemas)**: Protocol Buffer schemas defining internal inter-service gRPC APIs.

---

## 🛠️ Global CLI Monorepo Commands

We use **Turborepo** to orchestrate building, linting, and testing across all workspaces. Execute these from the root directory:

```bash
# Install dependencies for all workspaces and hoist modules
npm install

# Run build across all apps and packages in topological order
npm run build

# Run linters (ESLint / Angular Lint) globally
npm run lint

# Run all unit and integration tests
npm run test

# Perform security audit checks
npm run secret-check
```

For detailed guides on deploying or testing individual services, refer to the respective README files in the `apps/` directories.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

## 👤 Author
AKINA