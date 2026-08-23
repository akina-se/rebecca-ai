# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/functions-v1.4.0...functions-v1.5.0) (2026-08-23)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([cdcd39d](https://github.com/akina-se/rebecca-ai/commit/cdcd39d357ad84ca066c0d595048d4850aa033a7))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([67ca5d9](https://github.com/akina-se/rebecca-ai/commit/67ca5d99a0c6ec0351d6dff7810982be47bf2dc7))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([a81f803](https://github.com/akina-se/rebecca-ai/commit/a81f8037fff178415510351759138237f61f5345))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([00e074c](https://github.com/akina-se/rebecca-ai/commit/00e074cf503af13193abc4f150b36b8cb817a4ea))
* **security:** implement firebase auth blocking function and admin management CLI ([f6a4cde](https://github.com/akina-se/rebecca-ai/commit/f6a4cde5cc7b5b36d085adafbeabba61e8c4fef6))


### Bug Fixes

* **dashboard:** resolve UI layout and interaction issues ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **functions:** make functions standalone and add force flag to cloudbuild firebase deploy ([4e376d2](https://github.com/akina-se/rebecca-ai/commit/4e376d237c49e38eda04347736bb8432e1aa01a0))
* **functions:** make functions standalone and fix cloudbuild firebase deploy ([#56](https://github.com/akina-se/rebecca-ai/issues/56)) ([a1cf6a8](https://github.com/akina-se/rebecca-ai/commit/a1cf6a8911f44890b4e73193940d7c437af5e4d4))
* **functions:** remove GCIP blocking trigger export for free tier compatibility ([#58](https://github.com/akina-se/rebecca-ai/issues/58)) ([4778995](https://github.com/akina-se/rebecca-ai/commit/477899553c6a54bb6998d39b25a6545e49b355f5))
* **functions:** remove GCIP blocking trigger export to support standard Firebase Auth free tier ([6d32829](https://github.com/akina-se/rebecca-ai/commit/6d328292339ed3e0efbcafd4cce74b9edd5c7fa4))
* **functions:** resolve undefined FieldValue error in firestore triggers ([b77f2f5](https://github.com/akina-se/rebecca-ai/commit/b77f2f51435f0d2a90daa5a120a9d7469efece55))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([c5fa2df](https://github.com/akina-se/rebecca-ai/commit/c5fa2df573294dbf6c7c1ea1b78c9d1c5584dbd3))
* **security:** remove personal email example from admin CLI script ([37792c2](https://github.com/akina-se/rebecca-ai/commit/37792c2368094adb1727a4d5935f50fe237f99ec))
