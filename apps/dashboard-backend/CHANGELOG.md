# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/dashboard-backend-v1.4.0...dashboard-backend-v1.5.0) (2026-08-22)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **bff, dashboard-frontend:** implement Layer 1 extended memory API and connect real Firestore persistence ([1273543](https://github.com/akina-se/rebecca-ai/commit/1273543316621eb2a8c6f817a7d99578e7675313))
* **config:** implement 12-factor runtime config endpoint and dynamic app initializer ([65ff00b](https://github.com/akina-se/rebecca-ai/commit/65ff00b70fd3d85f4443449900364b8c7be42251))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([43c657f](https://github.com/akina-se/rebecca-ai/commit/43c657f9331a2bb6a71d01381cc5d5605c99ad9d))
* **dashboard-backend:** implement paginated assets API, multer upload, caption regeneration, and clean config ([3891d80](https://github.com/akina-se/rebecca-ai/commit/3891d805d6569b8f724c05c0a462cb110edafd43))
* **dashboard-backend:** query actual conversationLogs and sort in-memory for user chat history ([62c8d57](https://github.com/akina-se/rebecca-ai/commit/62c8d576940850a58ba7e74ec284627d94efe1f0))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([2fa5dcc](https://github.com/akina-se/rebecca-ai/commit/2fa5dcc68a57a38af9d5da28ef9ab383ba78d1b4))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([bb1c121](https://github.com/akina-se/rebecca-ai/commit/bb1c121db867b072012da2f4e001577f7da426bd))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([ac01732](https://github.com/akina-se/rebecca-ai/commit/ac0173255ace109538fd105e7372909737adc024))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([f159856](https://github.com/akina-se/rebecca-ai/commit/f159856dd894b294f996b64408fb6b7a8eae940a))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([0d4a8b7](https://github.com/akina-se/rebecca-ai/commit/0d4a8b781bf537b9a6316b1d114844bffbd11a04))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))
* scaffold dashboard-backend with clean architecture and strict DI ([6225c1b](https://github.com/akina-se/rebecca-ai/commit/6225c1b5aa9e08e124f4056b31e1c25f98c44dec))
* **security:** implement firebase auth blocking function and admin management CLI ([286f630](https://github.com/akina-se/rebecca-ai/commit/286f630a20a67317df50e276885a6c7b889d095b))


### Bug Fixes

* **assets:** ensure re-vectorization occurs during regenerateCaptions ([fd58332](https://github.com/akina-se/rebecca-ai/commit/fd583329265f83535f4cbf302e2671ff3fc6564d))
* **backend:** fix implicit any types and build order issues ([6da2fa4](https://github.com/akina-se/rebecca-ai/commit/6da2fa49fac91b386793030c08f5eb261c566d46))
* **bff:** optimize rate limiter and decouple firestore data from api dtos ([f83efdd](https://github.com/akina-se/rebecca-ai/commit/f83efdd4dd9dea70696b41af9f6ec7b5e3fdaf1e))
* **build:** resolve type definitions for gRPC server/client and cloud tasks httpMethod ([840df1b](https://github.com/akina-se/rebecca-ai/commit/840df1bba15eed1fb4e34672d533d7a45403a614))
* **config:** ensure dev apiKey compatibility and add branch tests for assets and config ([515864a](https://github.com/akina-se/rebecca-ai/commit/515864aca61e773f3a9b555b4deaaa001addc74d))
* **dashboard-backend:** prevent unhandled grpc client crash in emulator dreaming and meet branch coverage threshold ([772bc2f](https://github.com/akina-se/rebecca-ai/commit/772bc2fb5dfdad1806fea00b9c6d71310aee9174))
* **dashboard-backend:** resolve compile errors by updating mock data usage and dependencies ([249ad39](https://github.com/akina-se/rebecca-ai/commit/249ad39c5b0ca2a1e6aedeb079a7d02bf1e79146))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([0fc1461](https://github.com/akina-se/rebecca-ai/commit/0fc1461818eaf148f4c872e97b662319912c8f7a))
* **dashboard:** calculate all-time user interactions from conversation_logs and sort by interactions descending ([44ec245](https://github.com/akina-se/rebecca-ai/commit/44ec24505f0f08efd0bb197b9da9b77d59716cb6))
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([3a2b3be](https://github.com/akina-se/rebecca-ai/commit/3a2b3be434350b8e1a4c022ae48042a95dbccaae))
* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **db, bff:** resolve user display names and decouple profile models ([1acc7c0](https://github.com/akina-se/rebecca-ai/commit/1acc7c0408337aef311b3d5862978c09cb5835aa))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([89e04c3](https://github.com/akina-se/rebecca-ai/commit/89e04c3dfd606f42ba281d7e91243452a6036b0d))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))
* **security:** resolve CodeQL path traversal, prompt injection, and log formatting findings ([9bc8177](https://github.com/akina-se/rebecca-ai/commit/9bc81774273027063803bdb56f3eb63d8c35d512))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/db bumped from * to 1.5.0
    * @rebecca/persona bumped from * to 1.5.0
    * @rebecca/types bumped from * to 1.5.0
