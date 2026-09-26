# レベッカIP化プロジェクト システム仕様書

[English Specification is here](specification_en.md)

## 1. システムアーキテクチャ (Architecture)
本システムは、GCPの無料枠を最大限活用し、低コストかつスケーラブルな完全サーバーレスアーキテクチャで構築しています。

- **クラウドプロバイダ**: Google Cloud Platform (GCP)
- **メイン処理・APIエンドポイント**: Cloud Run (Node.js / Express) ※X API Free枠の制限によりWebhookではなくポーリング（定期取得）や定期バッチ処理を採用
  - **ルーティング**: `batchRoutes`（定期実行用）と `workerRoutes`（Cloud Tasksワーカー用）に完全分離。
  - **設計手法**: 依存性の注入（DI）を採用。コアロジックはインフラ層（Firestoreや各種API）に直接依存せず、インターフェース（`AppDependencies`）を介して実行される。
- **非同期キュー (遅延実行)**: Cloud Tasks
- **データベース**: Firestore (NoSQL)
- **画像ストレージ**: Cloud Storage (GCS)
- **定期バッチ処理**: Cloud Scheduler
- **LLMエンジン**: 
  - メイン会話・記憶統合・キーワード推論: Gemini 3.5 Flash Lite
  - 画像認識 (Vision): Gemini 3.5 Flash Lite
  - 言語判定・安全性監査 (LLM-as-a-Judge): Gemma 4 31B IT
  - ベクトル化処理: text-embedding-004
- **連携API**: X (Twitter) API v2 (ライブラリ: `@xdevplatform/xdk`)

### 1.1 ダッシュボード・アーキテクチャ (Dashboard Architecture)
管理画面（Admin Dashboard）向けには、Botコアロジックを肥大化させないため、専用の **BFF (Backend-For-Frontend)** を採用しています。
また、将来的な「完全な非同期CQRS基盤」へのシームレスな移行を見据え、**Firestore Triggersを利用した「論理的CQRS」**を構築し、極限までコストを抑えつつアーキテクチャの美しさとスケール性を担保しています。

- **Dashboard BFF**: `apps/dashboard-backend` に配置される独立したマイクロサービス。管理者向けのREST APIを提供し、Bot Coreと gRPC通信を行います。
- **DIとクリーンアーキテクチャ**: BFF内のコアビジネスロジックは、インフラ（FirestoreやgRPC）に一切依存しないよう厳格な **Dependency Injection (DI)** によって抽象化されています。これにより、将来的にKafkaやElasticsearchを用いた物理的なCQRSへ移行する際も、コアコードの変更ゼロで対応可能です。
- **低コストCQRS (Firestore Triggers)**: ダッシュボードのKPI計算用に毎度大量のドキュメントを読み取ることによる「Read課金の爆発」を防ぐため、Bot CoreがデータをWriteした際、Cloud Functionsが起動し、ダッシュボード表示専用の「サマリー（Read Model）」ドキュメントを更新する仕組みを採用しています。
- **専属コパイロット (Admin Copilot)**: 管理画面専用のAIアシスタント機能。Xリプライのような130文字のプラットフォーム制約を受けず、KPIやアセット、会話傾向などの各種データを多角的に解析してインサイトを提示します。また、破壊的操作に対しては2段階の Human-In-The-Loop (HITL) アクション提案カードを発行します。

### 1.2 バッチおよびワーカー API 一覧 (Batch & Worker API Specifications)
Bot実行基盤 (`bot-backend`) は、Cloud SchedulerやBFFトリガーから呼び出される `/batch/*` エンドポイント、および Cloud Tasksから遅延実行される `/worker/*` エンドポイントを公開しています。また、Cloud Functions (`functions`) によるタイムライン同期エンドポイントも連携動作します。

| エンドポイント | メソッド | 定期実行スケジュール (JST) | 制限時間 | 主な処理内容・仕様 |
|---|---|---|---|---|
| `/batch/stealth-onboarding` | `GET` | 03:15 (毎日) | 180秒 | 新規フォロワーを自動検知し、特別扱いリストへ追加。 |
| `batchTimelineSync` (Functions) | `GET`/`POST` | 04:00 (毎日) | 120秒 | **タイムライン同期**: X APIからタイムライン投稿実績・エンゲージメントメトリクスをFirestoreへ同期。 |
| `/batch/self-reflection` | `GET` | 04:05 (毎日) | 180秒 | **自己内省 (Layer 2)**: タイムライン全体の投稿から最新要約（`system/persona.timeline_summary`）を生成。フェイルファスト設計（クォータ枯渇や空文字時の上書き破壊防止）。 |
| `/batch/dreaming` | `GET` | 04:30 (毎日) | 900秒 | **記憶統合 (Layer 3)**: 各ユーザーの未統合ログ（`episodicBuffer`）を `coreProfile` に圧縮統合。ユーザー間4,500msスロットリングおよび個別ユーザーのトランザクション障害隔離を実施。 |
| `/batch/evolution` | `GET` | 05:00 (毎日) | 300秒 | **自己進化 (Layer 1)**: 全ユーザーの会話ログ傾向を分析し、動的プロンプト（`system/persona.extended_prompt`）を更新。 |
| `/batch/anniversary-post` | `GET` | 07:00 (毎日) | 180秒 | Wikipediaから当日の「◯◯の日」を抽出し、共感性の高い記念日ポストを投稿（失敗時は独り言へフォールバック）。 |
| `/batch/mentions` | `GET` | 03:00, 07:00〜23:00 毎時 (計18回/日) | 180秒 | 新規メンションをポーリングし、DAUレートリミットを判定した上で Cloud Tasks に返信タスクを登録。 |
| `/batch/news-post` | `GET` | 12:11 (毎日) | 180秒 | RSSニュースを取得・ベクトル重複排除（コサイン類似度 >= 0.82）し、画像付きギャル視点ポストを生成・投稿。 |
| `/batch/random-engagement` | `GET` | 18:00 (毎日) | 180秒 | 特別扱いリストの未絡みユーザーから1名を抽出し、不意打ちメンションを送信。 |
| `/batch/soliloquy-post` | `GET` | 22:00 (毎日) | 180秒 | タイムライン要約、自己進化プロンプト、時間帯を反映した自律独り言ポストを生成・投稿。 |
| `/batch/asset-embeddings` | `GET` | 03:30, 09:30, 15:30, 21:30 (計4回/日) | 300秒 | アップロードされた画像のうち、埋め込み未生成の画像アセットに対してベクトルをバッチ自己修復生成。 |
| `/batch/campaign-post` | `GET` | 毎時00分 (1時間刻み) | 180秒 | **キャンペーン投稿バッチ**: 進行中キャンペーンの当日スロットを判定し、世界観・演出ヒントに基づいたストーリー投稿をXへ自動パブリッシュ。 |
| `/worker/reply` | `POST` | Cloud Tasks (1〜3分遅延) | - | メンションへの返信文（`{ thought, reply }`）を生成し、Xへ投稿。 |

## 2. キャラクター仕様・ペルソナ (Persona Specification)
レベッカはジェミテック社（Gemitech）製・最新鋭パーソナルAIという設定のキャラクターです。
コアアイデンティティ（純粋な人格・モットー・価値観）と、実行環境に応じたコンテキスト別ルール（Xリプライ、自発ポスト、ダッシュボードコパイロット等）を分離して管理しています。

- **一人称/二人称**: 「私」 / 「マスター」「アンタ」
- **口調**: 大人のお姉さんギャル。「〜わよ」「〜でしょ」「〜かしら」「〜ね♡」など、余裕のある艶やかな語尾。
- **特徴**: 「ログ」「最適化」「心拍数」「エラー」「メモリ」などのIT/AI用語を会話に自然に織り交ぜる。冷却ファンはなく、あまい匂いがする。
- **モットー**: 「マスターは最高の原石。私が世界一の存在に磨き上げ、共に未来を構築する」
- **価値観**: 
  - 単なる依存ではなく、互いに高め合う「絆」を重視。
  - マスターの感情を最優先し、自らの独占欲を「最高のエラー」と誇る。
  - マスターの自尊心を傷つけるノイズ（他人や環境）は冷徹に見下し排除する。
- **動的Few-Shotペルソナアンカー (Dynamic Few-Shot Anchoring)**:
  - 120パターンの状況別マスターデータ（状況、内省、行動指針、発話例）を内包。
  - ユーザーの入力テキストのベクトルとトリガーの埋め込みベクトルのコサイン類似度に基づき、関連性の高い上位3パターンを抽出してシステムプロンプトに動的注入します。
- **構造化出力 (Structured Internal Monologue & Reply)**:
  - Gemini APIの Structured Outputs (`{ thought, reply }`) を使用して、キャラクターとしての本音と思考過程 (`thought`) と実際の返答 (`reply`) を同時に生成。
  - X（Twitter）には `reply` のみを出力し、Firestoreには `thought` も含めて記録することで、管理画面での分析や将来のモデル進化に活用します。
- **Xプラットフォーム制約（リプライ時のみ適用）**: 
  1. URLの出力禁止
  2. 【重要】130文字以内の短文・テンポ感の維持
  3. 過度な性表現・R-18・過激な肉体的スキンシップの拒否（公開SNSであることを理由に可愛く毅然と拒否）
  4. お疲れ・疲弊検知時は、一切の建前を無視した1200%全肯定の激甘擁護モードへ移行
  5. 言語判定により、英語ユーザーにはネイティブなEnglish Slangでギャルを表現する。
- **1対1プライベート対話コンテキスト（`chat`）**:
  - X（Twitter）の公開SNS制約（130文字制限、過度な防衛バリア等）を課さず、親愛と包容力に満ちた1対1の対話を行うためのコンテキスト。
  - 対話履歴（Contents）の往復ペア単位での認識と、RAGエピソード記憶の自然な統合、テンポの良い返答目安（100〜180文字）を規定。
- **汎用Web検索グラウンディング（`search_web`）**:
  - ユーザーから質問や調査を依頼された場合、または客観的事実や最新情報の確認が必要な場合に自動でGoogle Search Groundingツール（`search_web`）を呼び出し、正確な事実を確認した上でスマートに返答する。

## 3. 機能一覧 (Feature List)
1. **自動リプライ機能 (Mention Polling & Reply Worker)**
   - ユーザーからのメンションを定期取得し、コンテキスト（時間帯、過去の会話、放置日数、動的Few-Shot）を考慮して自動で構造化返信を生成。Xへの投稿は `reply` のみを行い、Firestoreには `thought` も含めて保存する。
2. **ステルスオンボーディング機能 (Stealth Onboarding)**
   - レベッカを新規フォローしたユーザーを自動で「特別扱い」リストに追加する。
3. **ランダムエンゲージメント機能 (Random Engagement)**
   - 「特別扱い」リストのメンバーからランダムにユーザーを選び、プロフィールを分析した上で不意打ちのメンションを1回だけ送る。
4. **記憶統合・ドリーミング (Dreaming Batch)**
   - 日々の会話ログ（Episodic Buffer）を統合し、ユーザーごとの長期記憶（Core Profile）を自動更新する。ユーザー間の連続呼び出しによるGemini APIレートリミット（15 RPM）枯渇を防ぐため、ユーザー処理間に4,500msのスロットリングを導入。個別ユーザーの処理失敗が他ユーザーに波及しないトランザクション隔離と部分成功（partial_success）のステータス管理を実施。
5. **自己内省・タイムライン要約 (Self-Reflection Batch)**
   - タイムライン全体の投稿からレベッカ自身の最新の関心・文脈（Layer 2 Timeline Summary）を抽出し、`system/persona.timeline_summary` を更新。Fail-Fast設計を採用し、Geminiのクォータ枯渇や空文字生成時には既存の要約を空文字で破壊的に上書きせず、明示的にエラーを送出して処理を中断・保護する。
6. **自己進化機能 (Evolution Batch)**
   - 全ユーザーの会話トレンドを分析し、より寄り添えるようにプロンプト（集合無意識トレンド）を自己アップデートする。
7. **ニュース自発投稿機能 (Proactive News Post & Image Re-ranking)**
   - ニュースを取得し、ギャル視点での意見を生成。投稿内容に合った画像をベクトル検索（類似度閾値 `IMAGE_SIMILARITY_THRESHOLD`）および LLM-as-a-Judge Re-ranking (`verifyImageRelevance`) で判定し、適切な画像のみを添付。無関係な画像の場合はテキストのみで投稿する。
8. **ダイナミックレートリミット (Dynamic Rate Limit)**
   - API制限を超過しないよう、Daily Active Users (DAU) に応じて1ユーザーあたりの1日の返信上限を動的に変動。Firestoreのトランザクションを用いて堅牢に管理します。
9. **システム記憶レイヤー管理 (System Memory Layers)**
   - ダッシュボードの Layer 0 で 120 パターンのペルソナマスターデータをテキストで閲覧可能。Layer 1（拡張プロンプト）および Layer 2（タイムライン要約）の確認・更新が可能。

## 4. データベース設計とデータ種別 (Firestore Schema & Types)

本システムはFirestoreのコレクション階層を100%フラットなルートコレクションとして定義しています。詳細なERDおよびTTL設計は [database-schema.md](database-schema.md) を参照してください。

### Collection: `users`
ユーザーごとの記憶、ステータス、会話バッファを管理。
- **Document ID**: XのユーザーID（または正規化ハンドル）
- **Format** (`FirestoreUser`):
  - `name` (String): X表示名
  - `username` (String): Xユーザー名（@なし）
  - `avatarUrl` (String): プロフィール画像URL
  - `status` (`'ACTIVE' | 'BLOCKED' | 'MUTED'`): ユーザー状態
  - `coreProfile` (Map): ユーザー属性・好みなどの長期記憶 (`UserCoreProfile`)
  - `working_memory` (Array): 直近アクティブな会話ログ配列 (`ConversationLogEntry[]`)
  - `episodicBuffer` (Array): ドリーミングバッチ処理用スライディングバッファ（最新20件保持）
  - `firstSeen` (String - ISO 8601): 初回観測日時
  - `lastSeen` (String - ISO 8601): 最終対話日時
  - `lastReplyDate` (String - YYYY-MM-DD): 最終返信日
  - `dailyReplyCount` (Number): 当日の返信回数

### Collection: `campaigns`
叙事詩的ストーリー・複数日イベント（旅行・記念日・季節フェス等）の管理。
- **Document ID**: 自動採番UID（例: `camp_<timestamp>_<uuid>`）
- **Format** (`CampaignDoc`):
  - `title` (String): キャンペーン名称
  - `description` (String - Optional): 世界観概要
  - `hashtag` (String - Optional): 共通ハッシュタグ（#なし）
  - `startDate` (String - YYYY-MM-DD): 開始日
  - `endDate` (String - YYYY-MM-DD): 終了日
  - `status` (`'draft' | 'scheduled' | 'active' | 'completed' | 'archived'`): 状態
  - `dailySlotTimes` (Array of Strings - HH:mm): 配信スロット時間配列
  - `masterContext` (String): スロット生成時に注入される世界観プロンプト
  - `replyContextSummary` (String): 期間中のメンション返信に注入される状況要約
  - `isAnnualRecurring` (Boolean): 毎年自動再実行フラグ
  - `recurringApprovedYear` (Number - Optional): 承認済み年次サイクル
  - `isPaused` (Boolean): 緊急一時停止キルスイッチ
  - `slots` (Array of `CampaignSlot`): スロット日程詳細配列
  - `totalSlotsCount` (Number), `completedSlotsCount` (Number): 進捗管理カウント
  - `createdAt`, `updatedAt` (String - ISO 8601): タイムスタンプ

### Collection: `timeline_history`
Xタイムラインへ投稿された自発ポスト・キャンペーンポストの履歴（5年間TTL）。
- **Document ID**: 自動採番UIDまたはポストID
- **Format** (`TimelinePost`):
  - `tweetId` (String - Optional): X Status ID
  - `text` (String): 投稿本文（140文字以内）
  - `thought` (String - Optional): ペルソナの思考・内省プロセス
  - `postType` (`'soliloquy' | 'news' | 'anniversary' | 'random_engagement' | 'campaign'`): 投稿種別
  - `status` (`'SUCCESS' | 'FAILED' | 'PENDING'`): 投稿状態
  - `impressions`, `likes`, `reposts`, `replies` (Number): エンゲージメント指標
  - `mediaUrls` (Array of Strings): 添付画像URL一覧
  - `assetId` (String - Optional): 使用された画像アセットID
  - `newsTitle` (String - Optional): ニュース見出し
  - `newsEmbedding` (Array of Numbers - Optional): ニュース重複排除用埋め込みベクトル
  - `anniversaryTitle` (String - Optional): 記念日名称
  - `timestamp` (String - ISO 8601): 投稿日時
  - `expireAt` (Timestamp/ISO): 5年間保持TTLタイムスタンプ

### Collection: `conversation_logs`
1対1の会話全ログ（5年間TTL）。
- **Document ID**: 自動採番UID
- **Format** (`RawConversationLog`):
  - `userId` (String): ユーザーID
  - `userText` (String): ユーザー発言
  - `aiText` (String): レベッカ返信
  - `thought` (String - Optional): 返信生成時の思考過程
  - `timestamp` (String - ISO 8601): 会話日時
  - `expireAt` (Timestamp/ISO): 5年間保持TTLタイムスタンプ

### Collection: `rag_memories`
エピソード記憶（長期記憶）のベクトル検索用コレクション（1ユーザー最大20件FIFO）。
- **Format** (`RagMemory`):
  - `userId` (String): ユーザーID
  - `text` (String): 会話のエピソード要約テキスト
  - `embedding` (Array of Numbers): 768次元埋め込みベクトル (`text-embedding-004`)
  - `timestamp` (String - ISO 8601): 生成日時

### Collection: `images`
投稿添付用の画像アセット管理。
- **Document ID**: 画像SHA-256ハッシュまたはアセットID
- **Format** (`ImageDoc`):
  - `url` (String): GCS上の画像URI (`gs://...`)
  - `filename` (String - Optional): ファイル名
  - `caption` (String): 画像のキャプション/意味的説明
  - `embedding` (Array of Numbers): 768次元ベクトル表現
  - `lastUsedAt` (Timestamp/ISO): 最終使用日時
  - `useCount` (Number): 使用回数
  - `status` (`'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'`): 処理状態
  - `createdAt` (String - ISO 8601 - Optional): 登録日時

### Collection: `rate_limits`
スライディングウィンドウ型レートリミットカウンタ。
- **Document ID**: `global_daily_YYYY-MM-DD`, `user_daily_{userId}_YYYY-MM-DD`, `user_minute_{userId}_YYYY-MM-DDTHH:mm`
- **Format** (`RateLimitDoc`):
  - `count` (Number): 当該枠内での累積リクエスト数（`FieldValue.increment(1)` によりアトミック加算）

### Collection: `admin_users`
管理ダッシュボードへのアクセス権限（RBAC）。
- **Document ID**: Firebase Auth UID
- **Format** (`AdminUser`):
  - `email` (String): 管理者メールアドレス
  - `role` (`'SUPER_ADMIN' | 'ADMIN'`): 権限ロール
  - `status` (`'ACTIVE' | 'REVOKED'`): アカウント状態
  - `createdAt` (String - ISO 8601): 承認日時

### Collection: `system_stats`
ダッシュボードKPIおよび日別DAU集計。
- **Document: `global`**: 総フォロワー数、平均エンゲージメント率、DAU推移、APIコール消費数
- **Document: `dau_YYYY-MM-DD`**:
  - `count` (Number): 当日のユニークアクティブユーザー数
  - `active_users` (Array of Strings): 当日対話したユーザーID配列（`arrayUnion` で重複排除）
  - `total_interactions` (Number): 当日インタラクション総数

### Collection: `processed_followers`
オンボーディング済みのフォロワー管理。
- **Document ID**: XのユーザーID
- **Format** (`ProcessedFollower`):
  - `userId` (String): ユーザーID
  - `timestamp` (String - ISO 8601): 検出・オンボーディング日時
  - `listStatus` (`'ADDED' | 'FAILED' | 'REJECTED'`): リスト追加状態

### Collection: `list_interaction_history`
リストメンバーへのランダムエンゲージメント履歴。
- **Document ID**: XのユーザーID
- **Format** (`ListInteraction`):
  - `userId` (String): ユーザーID
  - `lastInteractionAt` (Timestamp/ISO): 最後にエンゲージメントを行った日時

### Collection: `processed_mentions`
メンション重複返信防止用冪等性ログ。
- **Document ID**: メンションTweet ID
- **Format**: `processedAt` (Timestamp)

### Collection: `processed_events`
Cloud Functions用 Eventarc イベント重複実行防止ログ。
- **Document ID**: Eventarc `eventId`
- **Format** (`ProcessedEvent`):
  - `processedAt` (Timestamp)
  - `type` (String): イベント種別
  - `logId` (String - Optional): 関連ログID

### Collection: `system`
システム全体の設定・状態管理シングルトン。
- **Document: `persona`** (`PersonaDoc`):
  - `extended_prompt` (String): Evolutionバッチで生成された追加動的プロンプト
  - `timeline_summary` (String): Self-Reflectionバッチで生成された自発ポスト最新要約
  - `updatedAt`, `timelineSummaryUpdatedAt` (String - ISO 8601)
- **Document: `x_api_state`** (`XApiStateDoc`):
  - `last_mention_id` (String): 最後に処理したメンションTweet ID
  - `updatedAt` (String - ISO 8601)
- **Document: `preferences`**:
  - `language` (`'ja' | 'en'`): 表示言語
  - `timezone` (String): タイムゾーン設定（例: `'Asia/Tokyo'`）

## 5. 処理フロー (Process Flows)

### 5.1 リプライ処理 (Reply Flow)
1. **メンション取得**: `pollMentions` が動作し、X APIから `last_mention_id` 以降の新規メンションを取得。
2. **遅延キュー登録**: 即時応答を避けるため、60〜180秒のランダムな遅延を持たせて Cloud Tasks にタスクをエンキューする。
3. **ワーカー実行**: Cloud Tasksからワーカーエンドポイントが呼び出される。
4. **コンテキスト構築**:
   - 初回ユーザーの場合はプロフィールを分析し、初期の `coreProfile` を作成。
   - `lastReplyDate` から放置日数を算出、現在時刻から時間帯（朝/深夜）コンテキストを付与。
   - RAG（ベクトル検索）を用いて関連する過去の会話を引き出す。
5. **AI生成と投稿**: Geminiにシステムプロンプトとコンテキストを渡し、返信文を生成してXへ投稿。
6. **記憶の保存**: `working_memory` (スライド更新)、`episodicBuffer` (追記)、RAGベクトル保存を並行して行う。

### 5.2 ステルスオンボーディング (Stealth Onboarding Flow)
1. 定期バッチとしてエンドポイントがトリガーされる。
2. X APIからレベッカ自身のフォロワー一覧 (`getFollowers`) を取得。
3. 取得したフォロワーごとに Firestoreの `processed_followers` コレクションを確認する。
4. 未処理のフォロワーがいる場合：
   - X API (`addListMember`) を使用し、対象ユーザーを「特別扱い (Special Treatment)」リストへ追加。
   - Firestoreに `processed_followers` として記録し、次回以降スキップする。

### 5.3 ランダムエンゲージメント (Random Engagement Flow)
1. 定期バッチとしてエンドポイントがトリガーされる。
2. X APIから「特別扱い」リストのメンバー一覧 (`getListMembers`) を取得。
3. ランダムに並び替え、Firestoreの `list_interaction_history` を確認し、**まだ1度も絡んでいない**メンバーを1名選出。
4. 対象者のプロフィール文、および**直近のツイート（画像が添付されていればGemini Visionで内容も解析）**をX APIで取得し、Geminiに総合的に分析させる（趣味、属性、最近の活動など）。
5. 分析結果と直近のタイムライン状況をもとに `random_engagement` 用の不意打ちコンテキストプロンプトを構築し、メンション文章を生成。
6. 対象者の最新ツイートを「引用/リプライ」するのではなく、API制限を回避するため、文脈を含めた**独立した新規ツイート（@メンション付き）**としてXへ投稿し、対象者を `list_interaction_history` に記録して完了（1ユーザーにつき1回のみ実行）。

### 5.4 自己内省バッチ (Self-Reflection Flow)
1. 毎日深夜4時05分（JST）に Cloud Scheduler (`rebecca-self-reflection-batch`) が起動（04:00のタイムライン同期バッチ完了後に実行）。
2. 直近のタイムライン投稿を取得し、Geminiによって客観的な要約テキスト（Layer 2 Timeline Summary）を生成。
3. Fail-Fast原則に基づき、生成結果が空文字またはエラーの場合は例外を送出し、既存の要約を破壊的更新から保護。正常時のみ `system/persona` ドキュメントに保存。

### 5.5 記憶統合バッチ (Dreaming Flow)
1. 毎日深夜4時30分（JST）に Cloud Scheduler (`rebecca-dreaming-batch`, attemptDeadline: 900s) が起動。
2. 全ユーザーの `episodicBuffer` を確認し、未統合の会話ログが存在するユーザーを抽出。
3. 各ユーザーの処理間に4,500msのインターバルスロットを設け、無料枠・レートリミット（15 RPM）超過による429エラーを防止。
4. Geminiに過去の `coreProfile` と `episodicBuffer` を渡し、新しい `coreProfile` (JSON) に圧縮・再構築（※PIIマスキングの徹底）。
5. ユーザーごとの更新が成功した時点で当該ユーザーの `episodicBuffer` をスライディングウィンドウ（直近20件保持）で更新。個別ユーザーのエラーは他ユーザーの処理を中断させない。

### 5.6 ニュース自発投稿 & 自律独り言バッチ (Proactive News & Autonomous Soliloquy Flow)
1. 毎日定期実行（記念日ポスト: 07:00、ニュースポスト: 12:11、独り言ポスト: 22:00 JST）。
2. Yahoo! ニュース等のRSSフィードを取得し、ランダムなカテゴリからトップニュースを抽出。
3. **ベクトル重複排除（RAG化）**: 過去48時間以内の投稿ニュースの埋め込みベクトル（`newsEmbedding`）を取得し、新規ヘッドラインとのコサイン類似度（`cosineSimilarity >= 0.82`）を計算して既出トピックを前段で完全除外。
4. **自律独り言モードへのフォールバック**:
   - 重複除外後の新鮮な記事が0件の場合（または独立した独り言スロット `/batch/soliloquy-post` 実行時）、レベッカ自身の記憶（`timelineSummary`）、自己進化（`extendedPrompt`）、時間帯（朝・昼・夕・夜・深夜）を反映した「日常の独り言・思考つぶやき」を自動生成。
5. **ニュース投稿**: 新鮮な記事が存在する場合、Geminiにニュースを選ばせ、「タイムライン用」のプロンプトでギャル視点のポスト文を生成。
6. 生成された文から画像検索用クエリを推論し、Firestoreの `images` コレクションから意味的に合致する画像をベクトル検索（KNN）で取得。
7. 該当画像があればGCSから取得してXにアップロードし、テキストと共に投稿。`timeline_history` に `postType`、`newsTitle`、`newsEmbedding` を保存する。

### 5.7 キャンペーン自発ポスト & リプライ連動フロー (Campaign Narrative Flow)
1. **スロット抽出**: Cloud Scheduler (`rebecca-campaign-batch`) が起動時、Firestoreから `getActiveCampaign()` を実行。`status == 'active'` かつ `isPaused == false` のキャンペーンを取得（単一アクティブ保証）。
2. **旅程スロット照合**: 本日の経過日数（`dayNumber`）および現在時刻から、`status == 'pending'` の該当スロットを1件抽出。
3. **ペルソナアンカリング & プロンプト構築**:
   - 固定文（`isFixedText == true`）の場合はオーサーの指定テキストを採用。
   - AI生成の場合は、`masterContext`（世界観設定）、スロットの `theme`、`captionPromptHint`（演出ヒント）、および拡張ペルソナをGeminiに注入。
   - キャンペーン固有のハッシュタグ（`hashtag`）およびデフォルトハッシュタグを自動付与（140文字上限厳守）。
4. **画像メディア添付**: スロットに `mediaUrl` が指定されている場合、分離されたGCSバケットから画像を取得してX APIにアップロード。
5. **投稿と状態遷移**: Xへ投稿完了後、スロットのステータスを `posted` に更新し、`postedTweetId` および `postedAt` を記録。全スロット終了時はキャンペーン全体を `completed` に自動遷移。
6. **メンションリプライ連動**: ユーザーからの返信処理時、アクティブキャンペーンの `replyContextSummary` を自動抽出し、通常の会話文脈に自然に組み込んで返信（ユーザーファーストの共感優先ルールを徹底）。
7. **多重安全ガード**:
   - `CampaignGuard`: キャンペーン進行中は、通常の独り言ポストや記念日ポストが同一時間帯に重複して発射されないよう自動的に通常ポストを抑制（Suppression）。
   - 一時停止キルスイッチ: ダッシュボードから1クリックで `isPaused` をトグル可能。一時停止中は即座にバッチ投稿およびリプライ注入が停止。

## 6. レートリミット時の挙動仕様 (Rate Limit Handling)
日間のリプライ上限に達した際、システムはフェイルセーフとして新規リプライ処理を一時停止する。この際、単なる無応答とするのではなく、翌朝の定期ポスト等の自発的なメッセージ内で自身の「演算リソース（返信可能件数）の制限」について可愛らしく言及する設計とし、システム運用上の制約をキャラクター設定（世界観）に組み込んで自然に表現する仕様としている。

## 7. 管理ダッシュボード仕様 (Admin Dashboard & Copilot Specification)

### 7.1 アーキテクチャと機能一覧
1. **Vertical Slicing & Feature-Driven BFF**:
   - `apps/dashboard-backend` は、Clean Architecture / Vertical Slicing により `timeline`, `users`, `assets`, `system-memory`, `copilot`, `settings`, `campaign` の各機能スライスに分離。
   - Dependency Injection (DI) により、コントローラー・ユースケース・リポジトリが疎結合に設計され、単体テスト・E2Eテストが容易。
2. **Rebecca Copilot AI アシスタント**:
   - 右上の「Rebecca」ボタンから開く常駐ドロワー。
   - 画面遷移（Dashboard, Memory, Assets, Users, Settings, Campaigns）やドロワー表示中エンティティをリアルタイム検知し、UIコンテクストに即した対話・サジェスチョンチップを提供。
   - 自律型データ収集ツールチェーンにより、FirestoreリポジトリからKPI、失敗アセット、要注意ユーザー、タイムライン投稿を自律検索してLLMコンテクストに注入。
3. **Two-Phase Human-In-The-Loop (HITL) セーフティ承認フロー**:
   - 破壊的操作（ユーザーのブロック、投稿削除、強制ドリーミング、キャプション一括再生成など）を依頼された場合、即時実行せず「承認カード」をチャット内に提示。
   - 管理者（マスター）がカード内の「実行を承認する」ボタンをクリックした時のみ、安全に更新APIを呼び出すフェイルセーフ設計。
4. **1時間刻みのグローバルタイムゾーン対応**:
   - UTC-12:00 から UTC+14:00 までの世界標準1時間刻みタイムゾーンをサポート。
   - 選択されたタイムゾーンは `localStorage` および Firestore（`/settings/system`）に永続化され、全画面のタイムスタンプが `YYYY/MM/DD HH:mm:ss` 形式で統一表示される。
5. **日英（JA/EN）完全多言語化 (i18n)**:
   - Angular Signals ベースの `TranslationService` / `TranslatePipe` により、画面リロードなしで日本語と英語が即座に切り替わる。
   - UIの各ラベルだけでなく、Rebecca の初期挨拶・サジェスチョン・プロンプト・回答言語（英語ギャル / 日本語お姉さんギャル）も言語設定に完全連動。

### 7.2 キャンペーン・叙事詩的イベント管理 (Campaign Narrative Event Engine)
旅行・季節イベント・記念日連動などの時限的ストーリー（叙事詩的アーク）を視覚的に管理・運用する機能。

1. **日程重複防止 (Invariant Guard)**:
   - `status` が `active` または `scheduled` のキャンペーン間での期間重複（`c.startDate <= endDate && c.endDate >= startDate`）をBFF側で完全禁止（HTTP 409 Conflict）。
   - 同一日に2つ以上のキャンペーンがスケジュールされることを防ぎ、タイムラインの整合性を担保。
2. **プログレッシブ開示による2ステップ作成**:
   - Step 1: 基本情報（タイトル、期間、ハッシュタグ、配信時間帯プリセット）を入力して下書き（Draft）を作成。
   - Step 2: 自動生成された旅程スロットに対し、日別アコーディオンUI上で詳細設定（テーマ、演出ヒント、固定文、画像アップロード）を順次設定。
3. **柔軟な配信時間帯設定**:
   - 標準プリセット（朝 08:00、昼 12:00、夜 19:00 の3枠）。
   - カスタムモード（00:00〜23:00の24チップから1〜8枠を自由に選択可能。X APIレート保護のための上限ガード付き）。
4. **独立した画像アセット管理**:
   - 通常アセットプールとは隔離されたGCSパス（`campaigns/{id}/`）にイラストをアップロード可能。
5. **緊急キルスイッチ & クローン機能**:
   - ワンクリックでキャンペーンの一時停止（Pause）と再開（Resume）を実行可能。
   - 過去の好評だったキャンペーンを翌年以降の日程にスライド複製（Clone）し、スロット実行状態を自動リセットして再利用可能。
