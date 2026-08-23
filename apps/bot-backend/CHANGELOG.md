# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/bot-backend-v1.4.0...bot-backend-v1.5.0) (2026-08-23)


### Features

* add user inspection script and automated bulk image upload tool with AI captioning and embedding generation ([7811583](https://github.com/akina-se/rebecca-ai/commit/7811583c5198c3c9581a43d7becfa98c3e7c8616))
* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **bot-backend:** handle blocked users in reply, engagement, and onboarding with comprehensive unit tests ([660908c](https://github.com/akina-se/rebecca-ai/commit/660908c3470a1b703a621a62376075ea4d5bdfdc))
* **dashboard:** implement full admin dashboard, zero-trust auth, and monorepo CI/CD ([67ca5d9](https://github.com/akina-se/rebecca-ai/commit/67ca5d99a0c6ec0351d6dff7810982be47bf2dc7))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([00e074c](https://github.com/akina-se/rebecca-ai/commit/00e074cf503af13193abc4f150b36b8cb817a4ea))


### Bug Fixes

* **bot-backend:** clean up catch blocks in setup-scheduler.ts ([41734ba](https://github.com/akina-se/rebecca-ai/commit/41734babb440d8ef9572411b7e33f4e87bed5c1b))
* **bot-backend:** resolve Cloud Run container entrypoint path ([#55](https://github.com/akina-se/rebecca-ai/issues/55)) ([69cd3a1](https://github.com/akina-se/rebecca-ai/commit/69cd3a1b22f395b286c42d96e675e0c691411cac))
* **bot-backend:** set rootDir to ./src in tsconfig to ensure dist/index.js output path ([850c436](https://github.com/akina-se/rebecca-ai/commit/850c436631c60536e93035cb9b4f2352061b3ec2))
* **bot-backend:** set rootDir to ./src in tsconfig to fix dist/index.js output path ([#53](https://github.com/akina-se/rebecca-ai/issues/53)) ([1cc371d](https://github.com/akina-se/rebecca-ai/commit/1cc371daa57210ccae046f55c7a9057439fcc4f1))
* **build:** resolve type definitions for gRPC server/client and cloud tasks httpMethod ([28784e2](https://github.com/akina-se/rebecca-ai/commit/28784e20ca7000771690f3988223c4bb295d902d))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([6fc3aa2](https://github.com/akina-se/rebecca-ai/commit/6fc3aa20b4f7413d978e273712897ca1b6ebb52b))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([#50](https://github.com/akina-se/rebecca-ai/issues/50)) ([c1c8a44](https://github.com/akina-se/rebecca-ai/commit/c1c8a448018b069c8b99582939c422d3510351e9))
* **dashboard:** resolve data sync, date picker ranges, assets streaming, and strictly typed user models ([478f39c](https://github.com/akina-se/rebecca-ai/commit/478f39cd58e0ac234081ccec53034a49cf34bd6a))
* **dashboard:** resolve UI issues across dashboard, assets, and user relation pages ([96f7843](https://github.com/akina-se/rebecca-ai/commit/96f7843a4b4a00b2f15565056328cdea938eaabf))
* **dashboard:** resolve UI layout and interaction issues ([69cd3a1](https://github.com/akina-se/rebecca-ai/commit/69cd3a1b22f395b286c42d96e675e0c691411cac))
* **dashboard:** resolve UI layout and interaction issues ([69cd3a1](https://github.com/akina-se/rebecca-ai/commit/69cd3a1b22f395b286c42d96e675e0c691411cac))
* **dashboard:** resolve UI layout and interaction issues ([1cc371d](https://github.com/akina-se/rebecca-ai/commit/1cc371daa57210ccae046f55c7a9057439fcc4f1))
* **dashboard:** resolve UI layout and interaction issues ([a622c01](https://github.com/akina-se/rebecca-ai/commit/a622c01f5b69a63363b62c5955fd20567afb7f60))
* **dashboard:** resolve UI layout and interaction issues ([1045cf2](https://github.com/akina-se/rebecca-ai/commit/1045cf21e95866be3035b828457fd8e6daa16870))
* **frontend:** resolve CodeQL superfluous arguments and configure ESLint argsIgnorePattern ([#52](https://github.com/akina-se/rebecca-ai/issues/52)) ([53667a6](https://github.com/akina-se/rebecca-ai/commit/53667a6bb8bc53a1779cca5b9fb4dd05f055da6d))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([c5fa2df](https://github.com/akina-se/rebecca-ai/commit/c5fa2df573294dbf6c7c1ea1b78c9d1c5584dbd3))
* **security:** remove personal email example from admin CLI script ([37792c2](https://github.com/akina-se/rebecca-ai/commit/37792c2368094adb1727a4d5935f50fe237f99ec))
* **timeline:** resolve post detail mediaUrls via backend streaming API and remove mock image fallback ([492a91e](https://github.com/akina-se/rebecca-ai/commit/492a91eec05ed5cd503123a2817a8f2ab0aef9d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rebecca/db bumped from * to 1.5.0
    * @rebecca/persona bumped from * to 1.5.0
    * @rebecca/types bumped from * to 1.5.0
