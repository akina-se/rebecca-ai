# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/dashboard-backend-v1.4.0...dashboard-backend-v1.5.0) (2026-08-23)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **assets:** add sharp thumbnail generation and dual-resolution streaming optimization ([34f2cf7](https://github.com/akina-se/rebecca-ai/commit/34f2cf70cb9c4e0ebf7b7f0b05ba22e86b250416))
* **bff, dashboard-frontend:** implement Layer 1 extended memory API and connect real Firestore persistence ([ab134dd](https://github.com/akina-se/rebecca-ai/commit/ab134dd5a7ba5e431935616d7b400ed1ffa0484d))
* **config:** implement 12-factor runtime config endpoint and dynamic app initializer ([1392203](https://github.com/akina-se/rebecca-ai/commit/13922038701b28f434b966139a8e0002d846bee4))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([cdcd39d](https://github.com/akina-se/rebecca-ai/commit/cdcd39d357ad84ca066c0d595048d4850aa033a7))
* **dashboard-backend:** implement paginated assets API, multer upload, caption regeneration, and clean config ([2736588](https://github.com/akina-se/rebecca-ai/commit/27365889d2b330c928d82a3a3e5ac97a7c1ca258))
* **dashboard-backend:** query actual conversationLogs and sort in-memory for user chat history ([d7f38a4](https://github.com/akina-se/rebecca-ai/commit/d7f38a46068bb4ccc2a60dfce408383bfc38756a))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([dbf13d3](https://github.com/akina-se/rebecca-ai/commit/dbf13d35a94d8d2c872eee9304f4610a0cf00a4e))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([67ca5d9](https://github.com/akina-se/rebecca-ai/commit/67ca5d99a0c6ec0351d6dff7810982be47bf2dc7))
* **dashboard:** restrict sidebar visibility prior to login, refine branding text, and perform full backend/functions JSDoc documentation review ([a81f803](https://github.com/akina-se/rebecca-ai/commit/a81f8037fff178415510351759138237f61f5345))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([87591d8](https://github.com/akina-se/rebecca-ai/commit/87591d800bece5931daccdb9ebde8593486911ba))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([7942f6f](https://github.com/akina-se/rebecca-ai/commit/7942f6fe0b3deddd1d822a917cdc35ba0e92de7c))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([e8fbcb6](https://github.com/akina-se/rebecca-ai/commit/e8fbcb652c5ceae0004ee00bb2f0cf3a3ae61bbe))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([ec2df28](https://github.com/akina-se/rebecca-ai/commit/ec2df2890ece43747939a1b028683e0cba543d52))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([00e074c](https://github.com/akina-se/rebecca-ai/commit/00e074cf503af13193abc4f150b36b8cb817a4ea))
* scaffold dashboard-backend with clean architecture and strict DI ([0aeb8b4](https://github.com/akina-se/rebecca-ai/commit/0aeb8b4b5627d38ab6afc6ba10d7ddd717f7a160))
* **security:** implement firebase auth blocking function and admin management CLI ([f6a4cde](https://github.com/akina-se/rebecca-ai/commit/f6a4cde5cc7b5b36d085adafbeabba61e8c4fef6))


### Bug Fixes

* **assets:** ensure re-vectorization occurs during regenerateCaptions ([8e138d2](https://github.com/akina-se/rebecca-ai/commit/8e138d22f3d6a0f140721a4381c41b46376f327d))
* **assets:** migrate legacy DB URLs and preserve external CDN URLs without backend lock-in ([03ac832](https://github.com/akina-se/rebecca-ai/commit/03ac8328f87f505ebc275de04d97841a40e65c69))
* **assets:** resolve direct GCS URLs to backend streaming endpoint and expand E2E test coverage ([87cad17](https://github.com/akina-se/rebecca-ai/commit/87cad1790499536ffeeca2341db92697eaa2fbb2))
* **backend:** fix implicit any types and build order issues ([64ac66a](https://github.com/akina-se/rebecca-ai/commit/64ac66a5e3494351b86549cba1cae8f82b4b9504))
* **bff:** optimize rate limiter and decouple firestore data from api dtos ([30dceae](https://github.com/akina-se/rebecca-ai/commit/30dceaee2be6c05f7ffd3b91b92e580f234f7f1a))
* **build:** resolve type definitions for gRPC server/client and cloud tasks httpMethod ([28784e2](https://github.com/akina-se/rebecca-ai/commit/28784e20ca7000771690f3988223c4bb295d902d))
* **ci:** fix inferrable types, resolve E2E seed schema, and enforce strict 80% coverage gates ([ca6e31b](https://github.com/akina-se/rebecca-ai/commit/ca6e31baf77d89e35ec686174f419c06b6c54e00))
* **config:** ensure dev apiKey compatibility and add branch tests for assets and config ([12d8155](https://github.com/akina-se/rebecca-ai/commit/12d8155cb3007859853cbcd3e6e1857762f434ae))
* **dashboard-backend:** prevent unhandled grpc client crash in emulator dreaming and meet branch coverage threshold ([f4ff000](https://github.com/akina-se/rebecca-ai/commit/f4ff0006caa6993404a9c0768d5bcec04618d3ed))
* **dashboard-backend:** resolve compile errors by updating mock data usage and dependencies ([3099d03](https://github.com/akina-se/rebecca-ai/commit/3099d03117d5d83f494367becdd6be2678284bbc))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([70c5709](https://github.com/akina-se/rebecca-ai/commit/70c57099352097a72ff222dd61e59fa13c227a82))
* **dashboard:** calculate all-time user interactions from conversation_logs and sort by interactions descending ([820df51](https://github.com/akina-se/rebecca-ai/commit/820df51a607972eead494372fe398ab9e9618783))
* **dashboard:** implement server-side pagination for modals, strict [@username](https://github.com/username) resolution, and public assets image streaming ([a88625c](https://github.com/akina-se/rebecca-ai/commit/a88625c2b41dbce20ed92a75293c53345646f914))
* **dashboard:** resolve data sync, date picker ranges, assets streaming, and strictly typed user models ([478f39c](https://github.com/akina-se/rebecca-ai/commit/478f39cd58e0ac234081ccec53034a49cf34bd6a))
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([cfd6825](https://github.com/akina-se/rebecca-ai/commit/cfd68250db3faff69e13e39b26a7819b8515d1c6))
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([51d8eab](https://github.com/akina-se/rebecca-ai/commit/51d8eab5a4d522a39ab792c176b32e6d061d2707))
* **dashboard:** resolve UI layout and interaction issues ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **dashboard:** trim whitespace from runtime config secrets ([da10a12](https://github.com/akina-se/rebecca-ai/commit/da10a12aa8af789b718017aafce5dddc0653ea69))
* **db, bff:** resolve user display names and decouple profile models ([2652eb0](https://github.com/akina-se/rebecca-ai/commit/2652eb0b6d94dcdedc30cc9d3792a3d90b50298b))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([72ba458](https://github.com/akina-se/rebecca-ai/commit/72ba4582fc90a63ebbad36aba0835614fc99adba))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([c5fa2df](https://github.com/akina-se/rebecca-ai/commit/c5fa2df573294dbf6c7c1ea1b78c9d1c5584dbd3))
* **security:** remove personal email example from admin CLI script ([37792c2](https://github.com/akina-se/rebecca-ai/commit/37792c2368094adb1727a4d5935f50fe237f99ec))
* **security:** resolve CodeQL path traversal, prompt injection, and log formatting findings ([a63d12e](https://github.com/akina-se/rebecca-ai/commit/a63d12e694c3679418e212065664d7624b021cdf))
* **timeline:** resolve post detail mediaUrls via backend streaming API and remove mock image fallback ([492a91e](https://github.com/akina-se/rebecca-ai/commit/492a91eec05ed5cd503123a2817a8f2ab0aef9d6))


### Performance Improvements

* **assets:** add in-memory LRU cache and optimize GCS thumbnail streaming ([26728ef](https://github.com/akina-se/rebecca-ai/commit/26728efc2e591afb9fed81967d0708e0d3d82585))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/db bumped from * to 1.5.0
    * @rebecca/persona bumped from * to 1.5.0
    * @rebecca/types bumped from * to 1.5.0
