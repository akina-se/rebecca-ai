# Changelog

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
