# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/dashboard-frontend-v1.4.0...dashboard-frontend-v1.5.0) (2026-08-23)


### Features

* add AI regenerate button to asset details drawer ([387b324](https://github.com/akina-se/rebecca-ai/commit/387b324c6b2bc84d5804ba83131043589b6ff5d6))
* add subtle cyber animations and moving gradient background to Rebecca AI drawer ([78e2c33](https://github.com/akina-se/rebecca-ai/commit/78e2c3322debb42459d401df237e5fa7460bcba3))
* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **assets:** add sharp thumbnail generation and dual-resolution streaming optimization ([34f2cf7](https://github.com/akina-se/rebecca-ai/commit/34f2cf70cb9c4e0ebf7b7f0b05ba22e86b250416))
* **bff, dashboard-frontend:** implement Layer 1 extended memory API and connect real Firestore persistence ([ab134dd](https://github.com/akina-se/rebecca-ai/commit/ab134dd5a7ba5e431935616d7b400ed1ffa0484d))
* **config:** implement 12-factor runtime config endpoint and dynamic app initializer ([1392203](https://github.com/akina-se/rebecca-ai/commit/13922038701b28f434b966139a8e0002d846bee4))
* **dashboard-frontend:** add firebase auth login ui and interceptors ([91fa72c](https://github.com/akina-se/rebecca-ai/commit/91fa72c84f3130009602fb538012b4e43e9ad972))
* **dashboard-frontend:** implement View on X navigation in PostDrawer and UserDrawer with E2E tests ([d84932a](https://github.com/akina-se/rebecca-ai/commit/d84932a6b0e05c6dc6ac6a00934667f76ad18b50))
* **dashboard-frontend:** support multi-file upload, pagination, and add E2E test suite for assets ([e2c0f2f](https://github.com/akina-se/rebecca-ai/commit/e2c0f2f6f8a0718e1af231c33c2430c587374d39))
* **dashboard-frontend:** unify all UI timestamps to YYYY/MM/DD HH:mm:ss with reactive timezone support ([19b7d8f](https://github.com/akina-se/rebecca-ai/commit/19b7d8f3063144afaa3cdca05c0d9d217524b4a3))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([dbf13d3](https://github.com/akina-se/rebecca-ai/commit/dbf13d35a94d8d2c872eee9304f4610a0cf00a4e))
* **dashboard:** add AI Analyze button to detail drawers and implement shifted layout ([3c05293](https://github.com/akina-se/rebecca-ai/commit/3c052935a0da25190e5b0b22da281f94e877cdb9))
* **dashboard:** configure frontend to connect to Firebase Auth Emulator automatically in dev mode ([33c9010](https://github.com/akina-se/rebecca-ai/commit/33c9010fa8dd3303852946e359d943a737a82aee))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([67ca5d9](https://github.com/akina-se/rebecca-ai/commit/67ca5d99a0c6ec0351d6dff7810982be47bf2dc7))
* **dashboard:** implement live HttpDashboardRepository and register it conditionally in app config ([29ba153](https://github.com/akina-se/rebecca-ai/commit/29ba15396c50a7b88664ca67fd50bd5682a3719b))
* **dashboard:** implement page-based pagination for timeline history ([9a606a1](https://github.com/akina-se/rebecca-ai/commit/9a606a15040b50809c0840a9fe5a1bfed2243c15))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([a81f803](https://github.com/akina-se/rebecca-ai/commit/a81f8037fff178415510351759138237f61f5345))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([87591d8](https://github.com/akina-se/rebecca-ai/commit/87591d800bece5931daccdb9ebde8593486911ba))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([7942f6f](https://github.com/akina-se/rebecca-ai/commit/7942f6fe0b3deddd1d822a917cdc35ba0e92de7c))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([e8fbcb6](https://github.com/akina-se/rebecca-ai/commit/e8fbcb652c5ceae0004ee00bb2f0cf3a3ae61bbe))
* implement advanced UI/UX improvements based on HEART audit ([30b0ec8](https://github.com/akina-se/rebecca-ai/commit/30b0ec8359f9605f7e85f753f0049feabf0c75de))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([ec2df28](https://github.com/akina-se/rebecca-ai/commit/ec2df2890ece43747939a1b028683e0cba543d52))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([00e074c](https://github.com/akina-se/rebecca-ai/commit/00e074cf503af13193abc4f150b36b8cb817a4ea))


### Bug Fixes

* align AI drawer text colors with global variables ([ca31fea](https://github.com/akina-se/rebecca-ai/commit/ca31feaa852027a4dfa0cea0a62ece38e62905bb))
* change button active effect to a softer ripple instead of flash ([ab34bfa](https://github.com/akina-se/rebecca-ai/commit/ab34bfafe3e50a8e2538ab0dad3cd6f6731aa37f))
* **ci:** fix inferrable types, resolve E2E seed schema, and enforce strict 80% coverage gates ([ca6e31b](https://github.com/akina-se/rebecca-ai/commit/ca6e31baf77d89e35ec686174f419c06b6c54e00))
* **dashboard-frontend:** align authGuard signature with route/state parameters ([32ecc7c](https://github.com/akina-se/rebecca-ai/commit/32ecc7c318d11c27c6c023ac55e6ea7fb5e1947a))
* **dashboard-frontend:** bind top posts dynamically, display user handles, and update pagination UI ([a064657](https://github.com/akina-se/rebecca-ai/commit/a064657cd5d2b6124fed98c15830329e53ae944c))
* **dashboard-frontend:** ensure top users ranking modal data sync and wait in e2e ([7bb03c0](https://github.com/akina-se/rebecca-ai/commit/7bb03c08e1d3e54c30fe6803d46b1a2cf74cb012))
* **dashboard-frontend:** fix level 2 drawer rendering and format lastUpdated timestamps safely ([fc94825](https://github.com/akina-se/rebecca-ai/commit/fc94825bec6f0787e0418be18d9f84f7dec34491))
* **dashboard-frontend:** modernize copilot action cards, fix i18n localization and update e2e matchers ([04ac1aa](https://github.com/akina-se/rebecca-ai/commit/04ac1aa499bbbe702ff1525cab1c9f51514cb408))
* **dashboard-frontend:** provide resilient currentUser resolution for offline and e2e sessions ([9c024e0](https://github.com/akina-se/rebecca-ai/commit/9c024e01f5e004dc694ca96aa7924b46d1125f42))
* **dashboard-frontend:** standardize UTF-8 Japanese language labels across settings ([c8d940e](https://github.com/akina-se/rebecca-ai/commit/c8d940e258ff8f35a63c263d4126a0dbd3d376b3))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([70c5709](https://github.com/akina-se/rebecca-ai/commit/70c57099352097a72ff222dd61e59fa13c227a82))
* **dashboard:** calculate all-time user interactions from conversation_logs and sort by interactions descending ([820df51](https://github.com/akina-se/rebecca-ai/commit/820df51a607972eead494372fe398ab9e9618783))
* **dashboard:** enhance asset drawer delete/regenerate reliability and E2E timeouts ([b17d7cb](https://github.com/akina-se/rebecca-ai/commit/b17d7cb4aa9d8fbb2f64ff39d5da7a66da4c8a51))
* **dashboard:** fix action button overflow, sidebar text wrap, and complete Japanese localization across all views ([e727cbb](https://github.com/akina-se/rebecca-ai/commit/e727cbb81d3113846cfa6bd3b1870fb91ef453b7))
* **dashboard:** implement server-side pagination for modals, strict [@username](https://github.com/username) resolution, and public assets image streaming ([a88625c](https://github.com/akina-se/rebecca-ai/commit/a88625c2b41dbce20ed92a75293c53345646f914))
* **dashboard:** resolve build errors and import path ([5a8a374](https://github.com/akina-se/rebecca-ai/commit/5a8a374cd1c70b16ba92e6c4c38c37e893db8ab9))
* **dashboard:** resolve data sync, date picker ranges, assets streaming, and strictly typed user models ([478f39c](https://github.com/akina-se/rebecca-ai/commit/478f39cd58e0ac234081ccec53034a49cf34bd6a))
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([cfd6825](https://github.com/akina-se/rebecca-ai/commit/cfd68250db3faff69e13e39b26a7819b8515d1c6))
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([51d8eab](https://github.com/akina-se/rebecca-ai/commit/51d8eab5a4d522a39ab792c176b32e6d061d2707))
* **dashboard:** resolve UI issues across dashboard, assets, and user relation pages ([96f7843](https://github.com/akina-se/rebecca-ai/commit/96f7843a4b4a00b2f15565056328cdea938eaabf))
* **dashboard:** resolve UI layout and interaction issues ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **dashboard:** resolve UI layout and interaction issues ([1045cf2](https://github.com/akina-se/rebecca-ai/commit/1045cf21e95866be3035b828457fd8e6daa16870))
* **dashboard:** update project name to dashboard-frontend in angular.json ([e976552](https://github.com/akina-se/rebecca-ai/commit/e9765527d95c3079808e6bbe7edba7a077e8115a))
* **frontend:** align authGuard signature and configure eslint argsIgnorePattern for underscore parameters ([afb34a6](https://github.com/akina-se/rebecca-ai/commit/afb34a61b4950606860826c498871a569f36dd85))
* **frontend:** enforce strict typing and fix component errors ([01572d6](https://github.com/akina-se/rebecca-ai/commit/01572d695d3d6347997e736d5b0af14f87a567c7))
* **frontend:** resolve CodeQL superfluous arguments and configure ESLint argsIgnorePattern ([#52](https://github.com/akina-se/rebecca-ai/issues/52)) ([53667a6](https://github.com/akina-se/rebecca-ai/commit/53667a6bb8bc53a1779cca5b9fb4dd05f055da6d))
* **memory:** remove duplicate layer label prefix and fix cell text wrapping in memory layers table ([e8dd8e8](https://github.com/akina-se/rebecca-ai/commit/e8dd8e8e824b13ca997bd63db85535f4a4e5ec82))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([72ba458](https://github.com/akina-se/rebecca-ai/commit/72ba4582fc90a63ebbad36aba0835614fc99adba))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([c5fa2df](https://github.com/akina-se/rebecca-ai/commit/c5fa2df573294dbf6c7c1ea1b78c9d1c5584dbd3))
* **security:** remove personal email example from admin CLI script ([37792c2](https://github.com/akina-se/rebecca-ai/commit/37792c2368094adb1727a4d5935f50fe237f99ec))
* **security:** resolve CodeQL path traversal, prompt injection, and log formatting findings ([a63d12e](https://github.com/akina-se/rebecca-ai/commit/a63d12e694c3679418e212065664d7624b021cdf))
* **sidebar:** increase sidebar width to 280px to prevent nav item text overflow ([538ac53](https://github.com/akina-se/rebecca-ai/commit/538ac530a393f6dc89bc857783a5cbacb929983b))
* standardize colors for asset clock and dashboard flame icons ([7fc66b8](https://github.com/akina-se/rebecca-ai/commit/7fc66b834c51e34fa002ae686b22c012c6dd74f3))
* **timeline:** resolve post detail mediaUrls via backend streaming API and remove mock image fallback ([492a91e](https://github.com/akina-se/rebecca-ai/commit/492a91eec05ed5cd503123a2817a8f2ab0aef9d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/types bumped from * to 1.5.0
