# Changelog

## [1.5.0](https://github.com/akina-se/rebecca-ai/compare/v1.4.0...v1.5.0) (2026-08-22)


### Features

* add AI regenerate button to asset details drawer ([df60043](https://github.com/akina-se/rebecca-ai/commit/df60043716d9a31f244de3335438fe6122a5544f))
* add subtle cyber animations and moving gradient background to Rebecca AI drawer ([4dfe4b9](https://github.com/akina-se/rebecca-ai/commit/4dfe4b96ec569458253ae56f0ad8155f016677eb))
* admin management dashboard, full monorepo architecture, and enterprise CI/CD ([#49](https://github.com/akina-se/rebecca-ai/issues/49)) ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **bff, dashboard-frontend:** implement Layer 1 extended memory API and connect real Firestore persistence ([1273543](https://github.com/akina-se/rebecca-ai/commit/1273543316621eb2a8c6f817a7d99578e7675313))
* **bot-backend:** handle blocked users in reply, engagement, and onboarding with comprehensive unit tests ([4770880](https://github.com/akina-se/rebecca-ai/commit/4770880fbc1d8aec1ecdecaeca7877e2af6f7330))
* **config:** implement 12-factor runtime config endpoint and dynamic app initializer ([65ff00b](https://github.com/akina-se/rebecca-ai/commit/65ff00b70fd3d85f4443449900364b8c7be42251))
* **dashboard-backend:** align package scripts, create openapi spec and readme ([43c657f](https://github.com/akina-se/rebecca-ai/commit/43c657f9331a2bb6a71d01381cc5d5605c99ad9d))
* **dashboard-backend:** implement paginated assets API, multer upload, caption regeneration, and clean config ([3891d80](https://github.com/akina-se/rebecca-ai/commit/3891d805d6569b8f724c05c0a462cb110edafd43))
* **dashboard-backend:** query actual conversationLogs and sort in-memory for user chat history ([62c8d57](https://github.com/akina-se/rebecca-ai/commit/62c8d576940850a58ba7e74ec284627d94efe1f0))
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
* **db,types:** add filename and status fields to ImageDoc converter ([9abceac](https://github.com/akina-se/rebecca-ai/commit/9abceacc1da53732c02f01d727735af72afa52cb))
* **db:** add @rebecca/db type-safe Firestore collection layer ([f40796f](https://github.com/akina-se/rebecca-ai/commit/f40796f0e654fe75a860353ca2677185697a585f))
* **i18n:** implement dynamic JA/EN localization for UI, copilot persona, and sync specifications ([f159856](https://github.com/akina-se/rebecca-ai/commit/f159856dd894b294f996b64408fb6b7a8eae940a))
* implement advanced UI/UX improvements based on HEART audit ([e4d5f71](https://github.com/akina-se/rebecca-ai/commit/e4d5f71c4bc42c421dc4d9707896fcd31c65bbc4))
* implement Angular foundational components and layout from prototype ([0d5ce73](https://github.com/akina-se/rebecca-ai/commit/0d5ce73f43cc02e0bcd2f6949e48f96568677987))
* implement Rebecca Copilot AI Chat with autonomous toolchain, HITL safety, and sleek Cyberpunk UX ([0d4a8b7](https://github.com/akina-se/rebecca-ai/commit/0d4a8b781bf537b9a6316b1d114844bffbd11a04))
* **monorepo:** integrate live gRPC tweet deletion, uppercase status enums, JST timezone filters, dynamic alerts API, and Angular infinite scroll UX ([dc8ca28](https://github.com/akina-se/rebecca-ai/commit/dc8ca28b97d527f0e152bde4895cb84cbc7bc2b8))
* scaffold dashboard-backend with clean architecture and strict DI ([6225c1b](https://github.com/akina-se/rebecca-ai/commit/6225c1b5aa9e08e124f4056b31e1c25f98c44dec))
* **security:** implement firebase auth blocking function and admin management CLI ([286f630](https://github.com/akina-se/rebecca-ai/commit/286f630a20a67317df50e276885a6c7b889d095b))
* **types:** add @rebecca/types shared data model package ([06b1288](https://github.com/akina-se/rebecca-ai/commit/06b128853ec9de2adfd6b5713f6e98f452a768df))


### Bug Fixes

* align AI drawer text colors with global variables ([928686b](https://github.com/akina-se/rebecca-ai/commit/928686b6e8bec4fd09c84250db658d636740a014))
* **assets:** ensure re-vectorization occurs during regenerateCaptions ([fd58332](https://github.com/akina-se/rebecca-ai/commit/fd583329265f83535f4cbf302e2671ff3fc6564d))
* **backend:** fix implicit any types and build order issues ([6da2fa4](https://github.com/akina-se/rebecca-ai/commit/6da2fa49fac91b386793030c08f5eb261c566d46))
* **bff:** optimize rate limiter and decouple firestore data from api dtos ([f83efdd](https://github.com/akina-se/rebecca-ai/commit/f83efdd4dd9dea70696b41af9f6ec7b5e3fdaf1e))
* **bot-backend:** clean up catch blocks in setup-scheduler.ts ([c8290bb](https://github.com/akina-se/rebecca-ai/commit/c8290bb66c1731c667ec54e2ba460cc2eb35a155))
* **bot-backend:** resolve Cloud Run container entrypoint path ([#55](https://github.com/akina-se/rebecca-ai/issues/55)) ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **bot-backend:** set rootDir to ./src in tsconfig to fix dist/index.js output path ([#53](https://github.com/akina-se/rebecca-ai/issues/53)) ([fce813b](https://github.com/akina-se/rebecca-ai/commit/fce813b9311c85b1f0452a6a3a648c65cb80ba99))
* **build:** resolve type definitions for gRPC server/client and cloud tasks httpMethod ([840df1b](https://github.com/akina-se/rebecca-ai/commit/840df1bba15eed1fb4e34672d533d7a45403a614))
* change button active effect to a softer ripple instead of flash ([50e46d4](https://github.com/akina-se/rebecca-ai/commit/50e46d46ed382231c8cce6e5908ddddb1603990d))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([46a6558](https://github.com/akina-se/rebecca-ai/commit/46a65589dc84d3d167bec26f7275372d8c828441))
* **ci:** add build step to eval-test and resolve @rebecca/persona path in bot-backend ([#50](https://github.com/akina-se/rebecca-ai/issues/50)) ([371b8c6](https://github.com/akina-se/rebecca-ai/commit/371b8c6a060ae016a0732593a74a108b978c2092))
* **ci:** proxy /api routes from frontend SPA server to BFF backend on port 8081 ([50a9b95](https://github.com/akina-se/rebecca-ai/commit/50a9b958b8ab660e0c8bc2335b701d46f7fad072))
* **config:** ensure dev apiKey compatibility and add branch tests for assets and config ([515864a](https://github.com/akina-se/rebecca-ai/commit/515864aca61e773f3a9b555b4deaaa001addc74d))
* **dashboard-backend:** prevent unhandled grpc client crash in emulator dreaming and meet branch coverage threshold ([772bc2f](https://github.com/akina-se/rebecca-ai/commit/772bc2fb5dfdad1806fea00b9c6d71310aee9174))
* **dashboard-backend:** resolve compile errors by updating mock data usage and dependencies ([249ad39](https://github.com/akina-se/rebecca-ai/commit/249ad39c5b0ca2a1e6aedeb079a7d02bf1e79146))
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
* **dashboard:** resolve runtime config via Secret Manager, update favicon, and fix release-please config ([3a2b3be](https://github.com/akina-se/rebecca-ai/commit/3a2b3be434350b8e1a4c022ae48042a95dbccaae))
* **dashboard:** resolve UI issues across dashboard, assets, and user relation pages ([099748b](https://github.com/akina-se/rebecca-ai/commit/099748b1c40f33af505a7ac0b9c3bd3d3b0a88cd))
* **dashboard:** resolve UI layout and interaction issues ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **dashboard:** resolve UI layout and interaction issues ([9c3f97b](https://github.com/akina-se/rebecca-ai/commit/9c3f97bb76788998b66116268b3a2eba289da884))
* **dashboard:** resolve UI layout and interaction issues ([fce813b](https://github.com/akina-se/rebecca-ai/commit/fce813b9311c85b1f0452a6a3a648c65cb80ba99))
* **dashboard:** resolve UI layout and interaction issues ([32269e4](https://github.com/akina-se/rebecca-ai/commit/32269e4f078e613a736e8c081380372d5ebb9150))
* **dashboard:** resolve UI layout and interaction issues ([f58e3e7](https://github.com/akina-se/rebecca-ai/commit/f58e3e778285d268dd8ebc581679e7439089a909))
* **dashboard:** update project name to dashboard-frontend in angular.json ([d4f4894](https://github.com/akina-se/rebecca-ai/commit/d4f489488f5b5e91724a1be4d6e83169c2c2a37b))
* **db, bff:** resolve user display names and decouple profile models ([1acc7c0](https://github.com/akina-se/rebecca-ai/commit/1acc7c0408337aef311b3d5862978c09cb5835aa))
* **docs:** resolve Mermaid syntax error in Monorepo Topology diagram ([8d0ebae](https://github.com/akina-se/rebecca-ai/commit/8d0ebae8a58401daacf3d5a766329aeea432bb31))
* **e2e:** add graceful fallback for offline auth emulator during CI test execution ([c627286](https://github.com/akina-se/rebecca-ai/commit/c6272860886c98aa91404c0ea07c38d7cc7b258f))
* **e2e:** configure explicit ipv4 binding and working directory for playwright webServer ([916d575](https://github.com/akina-se/rebecca-ai/commit/916d57500c43b2c60e975e9aa72ca8105a53d116))
* **env:** add preflight port check and process cleanup to start-local-env.ps1 ([c012bd4](https://github.com/akina-se/rebecca-ai/commit/c012bd49e72e07458e9fe1fae6fbe4e4e68e0aff))
* **firebase:** add storage rules config for emulator ([9310714](https://github.com/akina-se/rebecca-ai/commit/9310714b562ed1a2b45cbab7f48c4b9481371a6d))
* **firebase:** restore auth and storage emulator configs ([d524452](https://github.com/akina-se/rebecca-ai/commit/d524452106fe66d57882d3ac57e0df31efadabb9))
* **frontend:** enforce strict typing and fix component errors ([aaab039](https://github.com/akina-se/rebecca-ai/commit/aaab03946bc4c7ae0b10be26b0af59c9d4e50cee))
* **frontend:** resolve CodeQL superfluous arguments and configure ESLint argsIgnorePattern ([#52](https://github.com/akina-se/rebecca-ai/issues/52)) ([9fa76f4](https://github.com/akina-se/rebecca-ai/commit/9fa76f4c362b6242ac052349e3f5f76705b594cb))
* **functions:** make functions standalone and fix cloudbuild firebase deploy ([#56](https://github.com/akina-se/rebecca-ai/issues/56)) ([1d7c3f5](https://github.com/akina-se/rebecca-ai/commit/1d7c3f5055921f90d22a655bfcef247e6f8c3c9f))
* **functions:** remove GCIP blocking trigger export for free tier compatibility ([#58](https://github.com/akina-se/rebecca-ai/issues/58)) ([9175a26](https://github.com/akina-se/rebecca-ai/commit/9175a26b3a32d8e4f4225074652656b7880e9dca))
* **functions:** resolve undefined FieldValue error in firestore triggers ([7b9ae03](https://github.com/akina-se/rebecca-ai/commit/7b9ae0337d1f3b622dae4c294ed2d1ecbf5f3843))
* **memory:** remove duplicate layer label prefix and fix cell text wrapping in memory layers table ([4d63063](https://github.com/akina-se/rebecca-ai/commit/4d63063b9392c3929b6a795eb8622f3deeafbbc4))
* **monorepo:** align all frontend and backend repositories with uppercase UserStatus and AssetStatus Enums ([89e04c3](https://github.com/akina-se/rebecca-ai/commit/89e04c3dfd606f42ba281d7e91243452a6036b0d))
* **quality:** resolve strict linter issues, add unit tests, and verify license/secret checks ([36e701c](https://github.com/akina-se/rebecca-ai/commit/36e701c677c8ba7fa1fcc73a81d6eca5c3a44e57))
* **script:** resolve powershell quote stripping error in start-process ([35c6437](https://github.com/akina-se/rebecca-ai/commit/35c6437d9259ad1127978244ea11620be45ec9d1))
* **security:** resolve CodeQL path traversal, prompt injection, and log formatting findings ([9bc8177](https://github.com/akina-se/rebecca-ai/commit/9bc81774273027063803bdb56f3eb63d8c35d512))
* **sidebar:** increase sidebar width to 280px to prevent nav item text overflow ([5da9296](https://github.com/akina-se/rebecca-ai/commit/5da9296c5b3761941a861fd88dd9ccc24607ffa0))
* standardize colors for asset clock and dashboard flame icons ([ccb5f6b](https://github.com/akina-se/rebecca-ai/commit/ccb5f6b12f5286a90a8b212f256d0624c0576998))

## [1.4.0](https://github.com/akina-se/rebecca-ai/compare/v1.3.1...v1.4.0) (2026-07-12)


### Features

* add get-lists tool script ([161ae2c](https://github.com/akina-se/rebecca-ai/commit/161ae2ce2fe71e1b3e4f12a2dda9ca96a4dd0ed9))
* **core:** implement stealth onboarding and random engagement ([ef484bc](https://github.com/akina-se/rebecca-ai/commit/ef484bc86213c87e2bcbc0d6578325ba6a1156df))
* Implement Quote Retweet and Image Analysis for Mentions ([73dfcb7](https://github.com/akina-se/rebecca-ai/commit/73dfcb766053720969d9f6ffc499d1532061760c))
* make public IP rate limit configurable ([d5b4360](https://github.com/akina-se/rebecca-ai/commit/d5b4360cb5f3772c5b6352e6eaa5a7c499573918))
* **scripts:** add missing jobs to setup-scheduler ([48618d7](https://github.com/akina-se/rebecca-ai/commit/48618d7f84302eeb0cea1ac1cef8fd05504f91c7))
* switch random engagement to standalone tweet due to API limits ([925f37f](https://github.com/akina-se/rebecca-ai/commit/925f37fcdecd15f2f4c4cb1569006ad8fa55735e))


### Bug Fixes

* address CodeQL log injection and ESLint unexpected any/prefer-const/unused-vars issues ([9b57116](https://github.com/akina-se/rebecca-ai/commit/9b571165b82cedd78a27150e310efaaa3946ba88))
* **api:** fix worker/reply response handling to prevent CPU throttling and enable retries ([f2439b5](https://github.com/akina-se/rebecca-ai/commit/f2439b55589daac11837cfb760b1adff90d58da3))
* **api:** mask detailed error messages in 500 responses for security ([fd0d02d](https://github.com/akina-se/rebecca-ai/commit/fd0d02d7cc0aa48edacea577002db2e6959e708e))
* **api:** unify success and error response formats for all batch endpoints ([1953701](https://github.com/akina-se/rebecca-ai/commit/1953701af5d6751e7813a181a84f673069aa2122))
* **arch:** extract newsFetcher to break circular dependency between services and core ([fec1308](https://github.com/akina-se/rebecca-ai/commit/fec1308974b076a298e06c08e4ddd9616dc3313f))
* **ci:** fix transaction tests, update configs, and sync docs ([3d15e05](https://github.com/akina-se/rebecca-ai/commit/3d15e05e5a41c74c8aa373372f1d267b2df70589))
* correct test function argument to number array ([909c1de](https://github.com/akina-se/rebecca-ai/commit/909c1de5865d4f88590a1a60c5e5c874c4ee54a6))
* enforce 130 character limit for replies and fix test coverage ([cf0d012](https://github.com/akina-se/rebecca-ai/commit/cf0d0123a5c17e20fa1655475eaa68ebea29c1b0))
* ESLint error in test-qr.ts ([becd7a2](https://github.com/akina-se/rebecca-ai/commit/becd7a2b6f588b4bd772d62fdd7f5195fef49a2a))
* **onboarding:** implement Fetch-until-seen and Cloud Scheduler OIDC integration for batch processes ([2683243](https://github.com/akina-se/rebecca-ai/commit/26832437cb40d5911d2155c775efd58546a2a8c2))
* resolve CodeQL alerts and test remnants ([799a529](https://github.com/akina-se/rebecca-ai/commit/799a529cac0e302ad433ceafc5f8a27b4fe59329))
* resolve CodeQL auth bypass warning and fix test coverage threshold ([e72bb6e](https://github.com/akina-se/rebecca-ai/commit/e72bb6e18babd94263d3ce5be76ba3ca76eb2c82))
* **scripts:** quote schedule string to prevent powershell wildcard expansion ([456c429](https://github.com/akina-se/rebecca-ai/commit/456c429d4824718c2e524d718ad8b415520ea448))
* **scripts:** resolve CodeQL security warnings in create-list.ts ([2b0c14d](https://github.com/akina-se/rebecca-ai/commit/2b0c14d5f47c53465ec8f23e15efeb89c15da8ed))
* **security:** resolve CodeQL alerts for missing rate limits and user-controlled bypass ([b7cf5e0](https://github.com/akina-se/rebecca-ai/commit/b7cf5e0e8e7c90a936f818af91749b5342c5fc79))
* **security:** resolve CodeQL bypass and update config tests ([521c254](https://github.com/akina-se/rebecca-ai/commit/521c2547859cbb3d7815dd1ebe90df0a4b3decd1))
* **security:** resolve CodeQL clear-text logging warning in get-lists.ts ([255c7d8](https://github.com/akina-se/rebecca-ai/commit/255c7d85c8cd805be8fb5aa2a38e29f160b1f024))
* **security:** resolve CodeQL polynomial regex and bypass alerts ([7ccd52f](https://github.com/akina-se/rebecca-ai/commit/7ccd52f9ed389b1b961237a3a94b34bae51d62b2))
* **security:** resolve CodeQL user-controlled bypass in authUtils ([73bb510](https://github.com/akina-se/rebecca-ai/commit/73bb51033dbc5d8116ba37629a23556cdd18e688))
* **security:** trust proxy for express rate limiting on Cloud Run ([cdba2ca](https://github.com/akina-se/rebecca-ai/commit/cdba2ca4f26d7796f066f33cec3e2f15718dfbf3))
* **tasks:** properly set service account for OIDC auth in Cloud Tasks ([2f99d1a](https://github.com/akina-se/rebecca-ai/commit/2f99d1aaa0b905766bd212432f244b437dd23a7e))
* **test:** correct function mock name for image analysis ([70f7d0c](https://github.com/akina-se/rebecca-ai/commit/70f7d0ca51339b0c622f8eeee8992146f634ad09))
* TS compilation error due to unknown type casting ([5398f09](https://github.com/akina-se/rebecca-ai/commit/5398f09385b8dc0c6324397694cb009a1bf6ad3b))
* **types:** add optional timestamp to ConversationLogEntry to fix build ([6650e72](https://github.com/akina-se/rebecca-ai/commit/6650e72c3c060007fef7e865b28479d6d634551b))
* **types:** enforce strict types for xApi responses and resolve state leak in tests ([592e8e4](https://github.com/akina-se/rebecca-ai/commit/592e8e409ff1b230174c89b7700b9ceddca1fc7b))
* **types:** update XApiTweet to correctly map SDK camelCase properties ([952dae9](https://github.com/akina-se/rebecca-ai/commit/952dae9cae65b893770fca87cb41d915e53c7d9a))

## [1.3.1](https://github.com/akina-se/rebecca-ai/compare/v1.3.0...v1.3.1) (2026-07-09)


### Bug Fixes

* correct favicon (hotfix) ([c8e99b0](https://github.com/akina-se/rebecca-ai/commit/c8e99b013f5a9cef49e177fb79199aba31c49b7f))
* use correct favicon.png and remove rejected favicon.ico ([926f527](https://github.com/akina-se/rebecca-ai/commit/926f527166e341b253d4e69b4d254b80306cd789))

## [1.3.0](https://github.com/akina-se/rebecca-ai/compare/v1.2.0...v1.3.0) (2026-07-09)


### Features

* complete vector search migration and fix X API upload ([1300d86](https://github.com/akina-se/rebecca-ai/commit/1300d86f492722787d67b75cfa8cc2173db4616d))
* constrain image tags and inference keywords to a predefined list for better matching ([525ab8d](https://github.com/akina-se/rebecca-ai/commit/525ab8d44a805caf9aa5252a35bd98100663e94d))
* implement proactive image attachment ([#26](https://github.com/akina-se/rebecca-ai/issues/26)) ([b316aa3](https://github.com/akina-se/rebecca-ai/commit/b316aa3a6a3f37888b103a64d1da9cfa8c22bd1b))
* implement proactive image attachment ([#26](https://github.com/akina-se/rebecca-ai/issues/26)) ([c1b9f96](https://github.com/akina-se/rebecca-ai/commit/c1b9f96ea35df8995f718313d71a13db485ddc4a))


### Bug Fixes

* add favicon.ico to resolve 404 ([22a5bf2](https://github.com/akina-se/rebecca-ai/commit/22a5bf24bb065ab47c5aabc4ccd0d8f3313a65e9))
* add retry logic and rate limit delay for bulk upload ([9339602](https://github.com/akina-se/rebecca-ai/commit/9339602205963cfc56dabaea73595fb3cf4b80c4))
* skip firestore save on empty tags to allow retry ([421d46d](https://github.com/akina-se/rebecca-ai/commit/421d46d1ab393a417cd5136539b0c24e8f2d9dbc))
* update default gemini models to available 3.x series ([ffe5e89](https://github.com/akina-se/rebecca-ai/commit/ffe5e893761d64cdb6f888b6f778c877259041b1))
* use config for storage bucket and update .env.example ([b576d09](https://github.com/akina-se/rebecca-ai/commit/b576d094489c9d79eed56ec06898e6a1ae614305))

## [1.2.0](https://github.com/akina-se/rebecca-ai/compare/v1.1.1...v1.2.0) (2026-07-08)


### Features

* add favicon with dark purple gradient background ([655cfc7](https://github.com/akina-se/rebecca-ai/commit/655cfc743e0d9002ebb0eac921a173beb45f0cab))
* add GitHub repository link to landing page ([8a035e4](https://github.com/akina-se/rebecca-ai/commit/8a035e422e97874bf701bd3339140ff33c07363d))
* UI enhancements (favicon and GitHub link) ([e455a6b](https://github.com/akina-se/rebecca-ai/commit/e455a6b745b0f6f2a08a59af54a1bae860e10044))

## [1.1.1](https://github.com/akina-se/rebecca-ai/compare/v1.1.0...v1.1.1) (2026-07-01)


### Bug Fixes

* resolve CodeQL and Dependabot security alerts ([0a72fe9](https://github.com/akina-se/rebecca-ai/commit/0a72fe9919e6359908f44e951f0fb35722b3916b))
* resolve CodeQL security alerts (ASI and CLI injection) ([2d36091](https://github.com/akina-se/rebecca-ai/commit/2d360911d86e9374a279aafdc4564b8e6c52e00c))
* resolve Log Injection alerts and update vulnerable dependencies ([3b2deed](https://github.com/akina-se/rebecca-ai/commit/3b2deede5d538a29e2ddff7b0185758fbc532fb0))
* use inline replace for log injection to satisfy CodeQL taint tracking ([9a9e272](https://github.com/akina-se/rebecca-ai/commit/9a9e2725b72c70d1b074ce6bd48877adfb9644fc))

## [1.1.0](https://github.com/akina-se/rebecca-ai/compare/v1.0.0...v1.1.0) (2026-07-01)


### Features

* add release-please workflow for automated versioning ([b033e12](https://github.com/akina-se/rebecca-ai/commit/b033e12da0f8da7bcb110c6f56f61fd9fc44fd9f))
* Enhance Rebecca's Persona and Core Values ([#14](https://github.com/akina-se/rebecca-ai/issues/14)) ([83e551a](https://github.com/akina-se/rebecca-ai/commit/83e551ae34d3f7da8f7c2d847ddffcf10bbf7b60))
* enhance Rebecca's persona based on original novel values ([78f3a81](https://github.com/akina-se/rebecca-ai/commit/78f3a819edeeeb49634724a9b7d0f7583ed40672))
* redesign prompt architecture separating core and context ([27c95f9](https://github.com/akina-se/rebecca-ai/commit/27c95f9458cdc9146b311321770f8c668ce4ce71))
* redesign prompt architecture separating core and context ([4cac444](https://github.com/akina-se/rebecca-ai/commit/4cac44441f3676256945a24ccb8255d46217322f))


### Bug Fixes

* cast string to Language type in eval test ([269a7b6](https://github.com/akina-se/rebecca-ai/commit/269a7b6a0ab0fab579a7ce84a8ee766926b85e2d))
* remove marketing jargon from prompt to preserve character immersion ([b489497](https://github.com/akina-se/rebecca-ai/commit/b4894975a7f042f8d9aebce977a6a35d90c7d71c))
* restore missing types and getDreamingPrompt function ([e54653a](https://github.com/akina-se/rebecca-ai/commit/e54653a286ebdd5596eb00db3ff7c8cbcabaf02f))
* update buildSystemPrompt signature in eval tests ([474dcfd](https://github.com/akina-se/rebecca-ai/commit/474dcfdabc18c68c74b99c1b683212ea6079453f))
* update gemini tests to match generateNewsPost signature ([a2a67d1](https://github.com/akina-se/rebecca-ai/commit/a2a67d116dfaafe58d31af11281558271d94e959))
* update test to match new buildSystemPrompt signature ([c789fab](https://github.com/akina-se/rebecca-ai/commit/c789faba7159d7a87b4cd65ef64d1859f697ca6e))
