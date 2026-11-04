---
name: pr-and-release-workflow
description: Guides branch creation, atomic Conventional Commits, pre-commit zero-PII/secret/server-config sanitization, English-only GitHub Issue and Pull Request authoring, CI verification, and Release Please deployment promotion. Use when committing code, creating Issues or PRs, syncing lockfiles, or executing develop-to-main releases.
---

# Git, Issue, Pull Request & Release Pipeline Runbook

Follow this workflow strictly for every branch, commit, Issue, Pull Request, and release promotion.

## 1. Branch Topology & Deployment Promotion Lifecycle

```text
<type>/<kebab-slug>  --(PR + CI + Human Approval)-->  develop
                                                         |
                                     (Release PR + CI + LLM Eval + Human Approval)
                                                         v
                                                        main  --(Automated Cloud Build Deploy)
                                                         |
                                              (Release Please Automated PR)
                                                         v
                                         chore(main): release x.y.z  --(GitHub Release & Tag)
                                                         |
                                            (Fast-Forward Back-Sync)
                                                         v
                                                      develop
```

1. **Start Every Task from Latest `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b <type>/<concise-kebab-slug>
   ```
   Allowed branch prefixes: `feat/`, `fix/`, `perf/`, `refactor/`, `docs/`, `test/`, `build/`, `ci/`, `chore/`.
2. **Never Commit Directly to `develop` or `main`**.

## 2. Atomic Commits & Conventional Commits (Release Please SemVer)

- **Atomic Decomposition**: Split unrelated concerns into separate commits (e.g., pure refactoring separate from behavioral feature changes, dependency lockfile updates separate from documentation). Every individual commit must compile and pass linting/tests cleanly.
- **Header Format**: `<type>(<optional-scope>): <imperative lowercase summary>` (100% English, max ~72 chars, no trailing period).
- **Release Please SemVer Mapping** (governed by `release-please-config.json`):

| Commit Type | SemVer Bump on `main` | Changelog Section | When to Use |
| :--- | :--- | :--- | :--- |
| `feat` | **Minor** (`0.X.0`) | Features | New user-facing or API capability |
| `fix` | **Patch** (`0.0.X`) | Bug Fixes | Production defect or regression fix |
| `perf` | **Patch** (`0.0.X`) | Performance Improvements | Measurable latency, memory, or query optimization |
| `<type>!` / `BREAKING CHANGE:` | **Major** (`X.0.0`) | Breaking Changes | Incompatible API, schema, or contract break |
| `docs`, `refactor`, `test`, `build`, `ci`, `chore` | None (until next release) | Hidden / Maintenance | Docs, internal restructuring, tests, tooling, deps |

## 3. Mandatory Pre-Commit Sanitization & Verification Gate

Run all checks **before** `git commit` or `git push`:

1. **Workspace & Untracked Artifact Check**:
   - Run `git status` and delete any scratch scripts, `.logs/`, `local_db.json`, `local_raw_logs.jsonl`, temporary screenshots, or debug dumps.
   - Verify no WIP notes, commented-out code blocks, or unlinked `TODO`s exist in changed files.
2. **Zero-Leakage Diff Audit (`git diff` / `git diff --staged`)**:
   Confirm **zero** occurrences of:
   - **Real PII**: Personal names, real email addresses (only RFC 2606 domains like `@example.com` are allowed in tests/docs), phone numbers, or real social handles/UIDs.
   - **Workstation Paths**: `C:\`, `D:\`, `/Users/`, `/home/`, local usernames, or hostnames.
   - **Cloud & Server Config**: Real GCP project IDs/numbers, custom domains, `*.run.app` or `*.web.app` URLs, real GCS bucket names, or service account emails (use `<GCP_PROJECT_ID>`, `<DEPLOY_REGION>`, `<SERVICE_URL>`, `<SERVICE_ACCOUNT_EMAIL>` in docs).
   - **Secrets**: API keys, OAuth tokens, private keys, or `.env` files.
3. **Automated Quality Gates**:
   ```bash
   # If dependencies/overrides changed, sync Cloud Functions lockfile first:
   npm run sync:functions-lock

   npm run secret-check
   npm run lint
   npm run license-check
   npm run build
   npm run test:unit
   npm run test:coverage-summary
   ```
   *(Run `npm run test:e2e` as well whenever UI, BFF, Auth, or DB schemas change.)*

## 4. Authoring GitHub Issues & Pull Requests (100% English)

- **Strict English Mandate**: All Issue titles/bodies/comments and Pull Request titles/descriptions/review replies **MUST** be written in clear, professional **English**, even when the user prompt is in Japanese.
- **Templates**:
  - Issues: Follow all required sections of `.github/ISSUE_TEMPLATE/bug_report.yml` or `.github/ISSUE_TEMPLATE/feature_request.yml`.
  - Pull Requests: Follow `.github/PULL_REQUEST_TEMPLATE.md` (`Overview`, `Changes`, `Verification`, `Screenshots / Logs`, `Additional Comments`). Ensure the PR title itself conforms to Conventional Commits (because squash-merge titles drive `release-please`).
- **Shell-Safe Creation via `--body-file`**:
  - Never pass multi-line markdown containing backticks inline via `-b "..."` in PowerShell or Bash (shell interpolation strips code identifiers and corrupts newlines).
  - Write the Markdown body to a temporary scratch file **outside** the Git working tree, then pass `--body-file`:
    ```bash
    gh pr create --base develop --head <branch-name> --title "<type>(<scope>): <summary>" --body-file "<scratch-dir>/pr-body.md"
    ```
  - Immediately inspect the rendered body (`gh pr view <PR_NUMBER> --json body -q .body`) to confirm formatting integrity, then monitor CI checks to completion:
    ```bash
    gh pr checks <PR_NUMBER> --watch
    ```

## 5. Mandatory Human Review Gate & Release Promotion

- **HARD STOP RULE**: After opening a PR to `develop` and confirming all CI checks (`Lint, Build & Test`, `Playwright E2E Tests`, `Gitleaks`, `CodeQL`) are green, **STOP and report the PR URL to the human reviewer**.
- **NEVER** merge any PR (`develop`, `main`, or Release Please) without explicit human approval in the active conversation.
- **When Explicitly Instructed to Promote a Release (`develop` -> `main` -> Release Please)**:
  1. Merge the approved feature/fix PR into `develop` (`gh pr merge <PR_NUMBER> --squash --delete-branch` or repository standard).
  2. Open the Release Promotion PR from `develop` into `main` (`gh pr create --base main --head develop ...`), wait for all CI checks **including `LLM Evaluation`** to pass, and confirm human approval before merging into `main`.
  3. Merging to `main` automatically triggers **Cloud Build production deployment** (`cloudbuild.yaml`) and the **Release Please** workflow (`.github/workflows/release-please.yml`), which opens/updates the `chore(main): release x.y.z` PR.
  4. Wait for CI checks on the Release Please PR to pass, merge it upon human instruction to cut the GitHub Release/tag, and **fast-forward sync `main` back into `develop`** (`git checkout develop && git pull origin main && git push origin develop`) so release commits (`CHANGELOG.md`, `package.json` versions) never diverge from `develop`.
