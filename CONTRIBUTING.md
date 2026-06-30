# Contributing to Rebecca AI

First off, thank you for considering contributing to Rebecca AI! It's people like you that make open-source software such a great community to learn, inspire, and create.

This document outlines the guidelines and best practices for contributing to this project. Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open-source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## 1. Project Architecture & Separation of Concerns

Rebecca AI is built with a serverless microservices architecture (GCP Cloud Run & Cloud Tasks). To maintain a clean and scalable codebase, please adhere to our directory structure:

- **`src/core/`**: Business logic, memory processing, timeline generation, and prompt engineering. This layer should not be tightly coupled to HTTP requests.
- **`src/services/`**: External integrations (X API, Gemini/Gemma, Firestore, Cloud Tasks). These modules act as adapters to external systems.
- **`src/config/`**: Global configuration and environment variable validation.
- **`tests/`**: Unit, integration, and evaluation tests.

## 2. Coding Guidelines

### TypeScript & Linting
- All code must be written in **TypeScript**.
- We strictly enforce linting rules. Run `npm run lint` before committing.
- Avoid using `any` whenever possible. Define proper interfaces and types for data structures.

### Comments & Language
- **Developer Comments**: All source code comments (e.g., function documentation, inline explanations) **MUST be written in English**.
- **AI Prompts**: Strings that define AI personas or instructions (e.g., in `src/core/prompt.ts`) are intentionally written in **Japanese** to maintain the character's nuance. Do not translate prompt strings to English unless adding explicit multilingual support.

### Logging Rules
- Use `console.log`, `console.warn`, and `console.error` appropriately.
- **Do NOT log Personal Identifiable Information (PII)** or sensitive user data (like raw DM contents or real names) in plain text.
- Ensure error logs include sufficient context for debugging in GCP Cloud Logging (e.g., `console.error('Failed to enqueue task for userId:', userId, error)`).

## 3. Pull Request Process

We use a standard Git Flow-inspired branching strategy.

1. **Target Branch**: All pull requests must be made against the **`develop`** branch. Direct PRs to `main` will be rejected (unless it is a release PR created by maintainers).
2. **Branch Naming**: Use descriptive branch names like `feature/add-new-model`, `fix/rate-limit-bug`, or `docs/update-readme`.
3. **PR Template**: Fill out the provided Pull Request template completely. Describe *why* the change is being made, not just *what* was changed.
4. **Testing**: 
   - Write unit tests for new features.
   - Run `npm test -- --coverage` locally and ensure coverage does not drop significantly.
   - CI workflows will automatically run ESLint and Jest. Your PR cannot be merged if CI fails.
5. **Commit Messages**: Write clear, concise commit messages. We recommend using [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).

## 4. Local Development Setup

To set up the project locally:

1. Clone the repository and checkout the `develop` branch.
2. Run `npm ci` to install dependencies.
3. Copy `.env.example` to `.env` and fill in your development keys (dummy values are fine for running basic unit tests).
4. Run `npm run test` to verify your environment is working correctly.

## 5. Code of Conduct

By participating in this project, you are expected to uphold a welcoming, inclusive, and professional environment. Harassment or unacceptable behavior will not be tolerated.

---

Thank you for your contributions and for helping Rebecca AI evolve!
