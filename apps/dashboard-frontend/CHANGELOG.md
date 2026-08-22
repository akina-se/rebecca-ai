# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/dashboard-frontend-v1.4.0...dashboard-frontend-v1.5.0) (2026-08-22)


### Features

* add AI regenerate button to asset details drawer ([df60043](https://github.com/akina-se/rebecca-ai/commit/df60043716d9a31f244de3335438fe6122a5544f))
* add subtle cyber animations and moving gradient background to Rebecca AI drawer ([4dfe4b9](https://github.com/akina-se/rebecca-ai/commit/4dfe4b96ec569458253ae56f0ad8155f016677eb))
* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **bff, dashboard-frontend:** implement Layer 1 extended memory API and connect real Firestore persistence ([1273543](https://github.com/akina-se/rebecca-ai/commit/1273543316621eb2a8c6f817a7d99578e7675313))
* **config:** implement 12-factor runtime config endpoint and dynamic app initializer ([65ff00b](https://github.com/akina-se/rebecca-ai/commit/65ff00b70fd3d85f4443449900364b8c7be42251))
* **dashboard-frontend:** add firebase auth login ui and interceptors ([e00e710](https://github.com/akina-se/rebecca-ai/commit/e00e71099527bf68bf928a5055f42594feb84ad8))
* **dashboard-frontend:** implement View on X navigation in PostDrawer and UserDrawer with E2E tests ([c71d572](https://github.com/akina-se/rebecca-ai/commit/c71d57234243a06b6556f8a4e037e771c919750d))
* **dashboard-frontend:** support multi-file upload, pagination, and add E2E test suite for assets ([20def27](https://github.com/akina-se/rebecca-ai/commit/20def27fae31eb82791b939f0f83b7372b430da5))
* **dashboard-frontend:** unify all UI timestamps to YYYY/MM/DD HH:mm:ss with reactive timezone support ([9572bf7](https://github.com/akina-se/rebecca-ai/commit/9572bf7dc91473153546104139bc169ce1dafe47))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([2fa5dcc](https://github.com/akina-se/rebecca-ai/commit/2fa5dcc68a57a38af9d5da28ef9ab383ba78d1b4))
* **dashboard:** add AI Analyze button to detail drawers and implement shifted layout ([4691bac](https://github.com/akina-se/rebecca-ai/commit/4691bac6aa3d1c0b23f9d2380e93fa3aab2a9992))
* **dashboard:** configure frontend to connect to Firebase Auth Emulator automatically in dev mode ([72528d4](https://github.com/akina-se/rebecca-ai/commit/72528d4bcd51d00666f1205f9f4ef793eb0314d6))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([bb1c121](https://github.com/akina-se/rebecca-ai/commit/bb1c121db867b072012da2f4e001577f7da426bd))
* **dashboard:** implement live HttpDashboardRepository and register it conditionally in app config ([ff94c07](https://github.com/akina-se/rebecca-ai/commit/ff94c0788ee86f590a4329b4d664ef3216f60fde))
* **dashboard:** implement page-based pagination for timeline history ([9cb854a](https://github.com/akina-se/rebecca-ai/commit/9cb854ad5c644e38c8acd847b1c5ac8c5069592f))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([ac01732](https://github.com/akina-se/rebecca-ai/commit/ac0173255ace109538fd105e7372909737adc024))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([f159856](https://github.com/akina-se/rebecca-ai/commit/f159856dd894b294f996b64408fb6b7a8eae940a))
* implement advanced UI/UX improvements based on HEART audit ([e4d5f71](https://github.com/akina-se/rebecca-ai/commit/e4d5f71c4bc42c421dc4d9707896fcd31c65bbc4))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([0d4a8b7](https://github.com/akina-se/rebecca-ai/commit/0d4a8b781bf537b9a6316b1d114844bffbd11a04))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))


### Bug Fixes

* align AI drawer text colors with global variables ([928686b](https://github.com/akina-se/rebecca-ai/commit/928686b6e8bec4fd09c84250db658d636740a014))
* change button active effect to a softer ripple instead of flash ([50e46d4](https://github.com/akina-se/rebecca-ai/commit/50e46d46ed382231c8cce6e5908ddddb1603990d))
* **dashboard-frontend:** align authGuard signature with route/state parameters ([01d8746](https://github.com/akina-se/rebecca-ai/commit/01d8746b51a8b2109d61f5aadba2aaca0baf23e5))
* **dashboard-frontend:** bind top posts dynamically, display user handles, and update pagination UI ([bc6a526](https://github.com/akina-se/rebecca-ai/commit/bc6a526a9393526176368351e07e03d81ff5c322))
* **dashboard-frontend:** ensure top users ranking modal data sync and wait in e2e ([9cf005f](https://github.com/akina-se/rebecca-ai/commit/9cf005fba2622903540c08d5ff436a26ba4d4d7c))
* **dashboard-frontend:** fix level 2 drawer rendering and format lastUpdated timestamps safely ([530d1c8](https://github.com/akina-se/rebecca-ai/commit/530d1c8726becda5c268142e74043ec5e92f523e))
* **dashboard-frontend:** modernize copilot action cards, fix i18n localization and update e2e matchers ([5fc623b](https://github.com/akina-se/rebecca-ai/commit/5fc623bb104c12126a27909be726a7a6e3e4a3be))
* **dashboard-frontend:** provide resilient currentUser resolution for offline and e2e sessions ([569d194](https://github.com/akina-se/rebecca-ai/commit/569d194643a3436e4f69509f8dae8706940b1bc2))
* **dashboard-frontend:** standardize UTF-8 Japanese language labels across settings ([0b7e0d6](https://github.com/akina-se/rebecca-ai/commit/0b7e0d6668e98e2c623176e045efc2e729022be4))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([0fc1461](https://github.com/akina-se/rebecca-ai/commit/0fc1461818eaf148f4c872e97b662319912c8f7a))
* **dashboard:** calculate all-time user interactions from conversation_logs and sort by interactions descending ([44ec245](https://github.com/akina-se/rebecca-ai/commit/44ec24505f0f08efd0bb197b9da9b77d59716cb6))
* **dashboard:** fix action button overflow, sidebar text wrap, and complete Japanese localization across all views ([6267fd2](https://github.com/akina-se/rebecca-ai/commit/6267fd28dddc65c75b02072fa961cbe79fce0df9))
* **dashboard:** resolve build errors and import path ([b70ada5](https://github.com/akina-se/rebecca-ai/commit/b70ada512b207f18023970ae4bb06971a30226ff))
* **dashboard:** resolve runtime config, favicon, and release-please workspace automation ([#60](https://github.com/akina-se/rebecca-ai/issues/60)) ([6db2a90](https://github.com/akina-se/rebecca-ai/commit/6db2a90928c21ee56bb520dcf9b0925bd8595e15))
* **dashboard:** resolve UI issues across dashboard, assets, and user relation pages ([099748b](https://github.com/akina-se/rebecca-ai/commit/099748b1c40f33af505a7ac0b9c3bd3d3b0a88cd))
* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **dashboard:** resolve UI layout and interaction issues ([f58e3e7](https://github.com/akina-se/rebecca-ai/commit/f58e3e778285d268dd8ebc581679e7439089a909))
* **dashboard:** update project name to dashboard-frontend in angular.json ([d4f4894](https://github.com/akina-se/rebecca-ai/commit/d4f489488f5b5e91724a1be4d6e83169c2c2a37b))
* **frontend:** enforce strict typing and fix component errors ([aaab039](https://github.com/akina-se/rebecca-ai/commit/aaab03946bc4c7ae0b10be26b0af59c9d4e50cee))
* **frontend:** resolve CodeQL superfluous arguments and configure ESLint argsIgnorePattern ([#52](https://github.com/akina-se/rebecca-ai/issues/52)) ([9fa76f4](https://github.com/akina-se/rebecca-ai/commit/9fa76f4c362b6242ac052349e3f5f76705b594cb))
* **memory:** remove duplicate layer label prefix and fix cell text wrapping in memory layers table ([4d63063](https://github.com/akina-se/rebecca-ai/commit/4d63063b9392c3929b6a795eb8622f3deeafbbc4))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([89e04c3](https://github.com/akina-se/rebecca-ai/commit/89e04c3dfd606f42ba281d7e91243452a6036b0d))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))
* **security:** resolve CodeQL path traversal, prompt injection, and log formatting findings ([9bc8177](https://github.com/akina-se/rebecca-ai/commit/9bc81774273027063803bdb56f3eb63d8c35d512))
* **sidebar:** increase sidebar width to 280px to prevent nav item text overflow ([5da9296](https://github.com/akina-se/rebecca-ai/commit/5da9296c5b3761941a861fd88dd9ccc24607ffa0))
* standardize colors for asset clock and dashboard flame icons ([ccb5f6b](https://github.com/akina-se/rebecca-ai/commit/ccb5f6b12f5286a90a8b212f256d0624c0576998))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/types bumped from * to 1.5.0
