# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/@rebecca/types-v1.4.0...@rebecca/types-v1.5.0) (2026-08-23)


### Features

* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **assets:** add sharp thumbnail generation and dual-resolution streaming optimization ([34f2cf7](https://github.com/akina-se/rebecca-ai/commit/34f2cf70cb9c4e0ebf7b7f0b05ba22e86b250416))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([cdcd39d](https://github.com/akina-se/rebecca-ai/commit/cdcd39d357ad84ca066c0d595048d4850aa033a7))
* **dashboard,users,settings:** optimize DB queries, add user relations search/sort/pagination, and global timezones ([dbf13d3](https://github.com/akina-se/rebecca-ai/commit/dbf13d35a94d8d2c872eee9304f4610a0cf00a4e))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([67ca5d9](https://github.com/akina-se/rebecca-ai/commit/67ca5d99a0c6ec0351d6dff7810982be47bf2dc7))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([87591d8](https://github.com/akina-se/rebecca-ai/commit/87591d800bece5931daccdb9ebde8593486911ba))
* **dashboard:** streamline user schema, optimize timeline thumbnails, and remove artificial fallbacks ([7942f6f](https://github.com/akina-se/rebecca-ai/commit/7942f6fe0b3deddd1d822a917cdc35ba0e92de7c))
* **db,types:** add filename and status fields to ImageDoc converter ([2738f2e](https://github.com/akina-se/rebecca-ai/commit/2738f2e414be3cbd1255cafa1edcaac82874ab2f))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([e8fbcb6](https://github.com/akina-se/rebecca-ai/commit/e8fbcb652c5ceae0004ee00bb2f0cf3a3ae61bbe))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([ec2df28](https://github.com/akina-se/rebecca-ai/commit/ec2df2890ece43747939a1b028683e0cba543d52))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([00e074c](https://github.com/akina-se/rebecca-ai/commit/00e074cf503af13193abc4f150b36b8cb817a4ea))
* **types:** add @rebecca/types shared data model package ([38bdf05](https://github.com/akina-se/rebecca-ai/commit/38bdf05da70da90dcef74a0d733093ce08aa039c))


### Bug Fixes

* **bff:** optimize rate limiter and decouple firestore data from api dtos ([30dceae](https://github.com/akina-se/rebecca-ai/commit/30dceaee2be6c05f7ffd3b91b92e580f234f7f1a))
* **dashboard,assets:** add timeline sorting, lightbox preview, date picking, and isolate asset extension ([70c5709](https://github.com/akina-se/rebecca-ai/commit/70c57099352097a72ff222dd61e59fa13c227a82))
* **dashboard:** resolve data sync, date picker ranges, assets streaming, and strictly typed user models ([478f39c](https://github.com/akina-se/rebecca-ai/commit/478f39cd58e0ac234081ccec53034a49cf34bd6a))
* **dashboard:** resolve UI layout and interaction issues ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **db, bff:** resolve user display names and decouple profile models ([2652eb0](https://github.com/akina-se/rebecca-ai/commit/2652eb0b6d94dcdedc30cc9d3792a3d90b50298b))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([72ba458](https://github.com/akina-se/rebecca-ai/commit/72ba4582fc90a63ebbad36aba0835614fc99adba))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([c5fa2df](https://github.com/akina-se/rebecca-ai/commit/c5fa2df573294dbf6c7c1ea1b78c9d1c5584dbd3))
* **security:** remove personal email example from admin CLI script ([37792c2](https://github.com/akina-se/rebecca-ai/commit/37792c2368094adb1727a4d5935f50fe237f99ec))
