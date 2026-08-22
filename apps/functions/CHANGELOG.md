# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/functions-v1.4.0...functions-v1.5.0) (2026-08-22)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([43c657f](https://github.com/akina-se/rebecca-ai/commit/43c657f9331a2bb6a71d01381cc5d5605c99ad9d))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([bb1c121](https://github.com/akina-se/rebecca-ai/commit/bb1c121db867b072012da2f4e001577f7da426bd))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([ac01732](https://github.com/akina-se/rebecca-ai/commit/ac0173255ace109538fd105e7372909737adc024))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))
* **security:** implement firebase auth blocking function and admin management CLI ([286f630](https://github.com/akina-se/rebecca-ai/commit/286f630a20a67317df50e276885a6c7b889d095b))


### Bug Fixes

* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **functions:** make functions standalone and fix cloudbuild firebase deploy ([#56](https://github.com/akina-se/rebecca-ai/issues/56)) ([1d7c3f5](https://github.com/akina-se/rebecca-ai/commit/1d7c3f5055921f90d22a655bfcef247e6f8c3c9f))
* **functions:** remove GCIP blocking trigger export for free tier compatibility ([#58](https://github.com/akina-se/rebecca-ai/issues/58)) ([9175a26](https://github.com/akina-se/rebecca-ai/commit/9175a26b3a32d8e4f4225074652656b7880e9dca))
* **functions:** resolve undefined FieldValue error in firestore triggers ([7b9ae03](https://github.com/akina-se/rebecca-ai/commit/7b9ae0337d1f3b622dae4c294ed2d1ecbf5f3843))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))
