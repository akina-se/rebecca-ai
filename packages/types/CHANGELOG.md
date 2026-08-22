# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/@rebecca/types-v1.4.0...@rebecca/types-v1.5.0) (2026-08-22)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([43c657f](https://github.com/akina-se/rebecca-ai/commit/43c657f9331a2bb6a71d01381cc5d5605c99ad9d))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([2fa5dcc](https://github.com/akina-se/rebecca-ai/commit/2fa5dcc68a57a38af9d5da28ef9ab383ba78d1b4))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([bb1c121](https://github.com/akina-se/rebecca-ai/commit/bb1c121db867b072012da2f4e001577f7da426bd))
* **db,types:** add filename and status fields to ImageDoc converter ([9abceac](https://github.com/akina-se/rebecca-ai/commit/9abceacc1da53732c02f01d727735af72afa52cb))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([f159856](https://github.com/akina-se/rebecca-ai/commit/f159856dd894b294f996b64408fb6b7a8eae940a))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([0d4a8b7](https://github.com/akina-se/rebecca-ai/commit/0d4a8b781bf537b9a6316b1d114844bffbd11a04))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))
* **types:** add @rebecca/types shared data model package ([06b1288](https://github.com/akina-se/rebecca-ai/commit/06b128853ec9de2adfd6b5713f6e98f452a768df))


### Bug Fixes

* **bff:** optimize rate limiter and decouple firestore data from api dtos ([f83efdd](https://github.com/akina-se/rebecca-ai/commit/f83efdd4dd9dea70696b41af9f6ec7b5e3fdaf1e))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([0fc1461](https://github.com/akina-se/rebecca-ai/commit/0fc1461818eaf148f4c872e97b662319912c8f7a))
* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **db, bff:** resolve user display names and decouple profile models ([1acc7c0](https://github.com/akina-se/rebecca-ai/commit/1acc7c0408337aef311b3d5862978c09cb5835aa))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([89e04c3](https://github.com/akina-se/rebecca-ai/commit/89e04c3dfd606f42ba281d7e91243452a6036b0d))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))
