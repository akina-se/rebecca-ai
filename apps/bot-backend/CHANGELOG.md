# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/bot-backend-v1.4.0...bot-backend-v1.5.0) (2026-08-22)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **bot-backend:** handle blocked users in reply, engagement, and onboarding with comprehensive unit tests ([4770880](https://github.com/akina-se/rebecca-ai/commit/4770880fbc1d8aec1ecdecaeca7877e2af6f7330))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([bb1c121](https://github.com/akina-se/rebecca-ai/commit/bb1c121db867b072012da2f4e001577f7da426bd))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))


### Bug Fixes

* **bot-backend:** clean up catch blocks in setup-scheduler.ts ([c8290bb](https://github.com/akina-se/rebecca-ai/commit/c8290bb66c1731c667ec54e2ba460cc2eb35a155))
* **bot-backend:** resolve Cloud Run container entrypoint path ([#55](https://github.com/akina-se/rebecca-ai/issues/55)) ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **bot-backend:** set rootDir to ./src in tsconfig to fix dist/index.js output path ([#53](https://github.com/akina-se/rebecca-ai/issues/53)) ([fce813b](https://github.com/akina-se/rebecca-ai/commit/fce813b9311c85b1f0452a6a3a648c65cb80ba99))
* **build:** resolve type definitions for gRPC server/client and cloud tasks httpMethod ([840df1b](https://github.com/akina-se/rebecca-ai/commit/840df1bba15eed1fb4e34672d533d7a45403a614))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([46a6558](https://github.com/akina-se/rebecca-ai/commit/46a65589dc84d3d167bec26f7275372d8c828441))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([#50](https://github.com/akina-se/rebecca-ai/issues/50)) ([371b8c6](https://github.com/akina-se/rebecca-ai/commit/371b8c6a060ae016a0732593a74a108b978c2092))
* **dashboard:** resolve UI issues across dashboard, assets, and user relation pages ([099748b](https://github.com/akina-se/rebecca-ai/commit/099748b1c40f33af505a7ac0b9c3bd3d3b0a88cd))
* **dashboard:** resolve UI layout and interaction issues ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **dashboard:** resolve UI layout and interaction issues ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **dashboard:** resolve UI layout and interaction issues ([fce813b](https://github.com/akina-se/rebecca-ai/commit/fce813b9311c85b1f0452a6a3a648c65cb80ba99))
* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **dashboard:** resolve UI layout and interaction issues ([f58e3e7](https://github.com/akina-se/rebecca-ai/commit/f58e3e778285d268dd8ebc581679e7439089a909))
* **frontend:** resolve CodeQL superfluous arguments and configure ESLint argsIgnorePattern ([#52](https://github.com/akina-se/rebecca-ai/issues/52)) ([9fa76f4](https://github.com/akina-se/rebecca-ai/commit/9fa76f4c362b6242ac052349e3f5f76705b594cb))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/db bumped from * to 1.5.0
    * @rebecca/persona bumped from * to 1.5.0
    * @rebecca/types bumped from * to 1.5.0
