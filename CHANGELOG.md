# Changelog

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
