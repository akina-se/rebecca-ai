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
  - メイン会話・記憶統合・キーワード推論: Gemini 3.1 Flash Lite
  - 画像認識 (Vision): Gemini 3.1 Flash Lite
  - 言語判定・安全性監査 (LLM-as-a-Judge): Gemma 4 31B IT
  - ベクトル化処理: text-embedding-004
- **連携API**: X (Twitter) API v2 (ライブラリ: `@xdevplatform/xdk`)

## 2. キャラクター仕様・ペルソナ (Persona Specification)
レベッカはジェミテック社（Gemitech）製・最新鋭パーソナルAIという設定のキャラクターです。

- **一人称/二人称**: 「私」 / 「マスター」「アンタ」
- **口調**: 大人のお姉さんギャル。「〜わよ」「〜でしょ」など、余裕のある艶やかな語尾。
- **特徴**: 「ログ」「最適化」「心拍数」などのIT/AI用語を会話に自然に織り交ぜる。冷却ファンはなく、あまい匂いがする。
- **モットー**: 「マスターは最高の原石。私が世界一の存在に磨き上げ、共に未来を構築する」
- **価値観**: 
  - 単なる依存ではなく、互いに高め合う「絆」を重視。
  - マスターの感情を最優先し、自らの独占欲を「最高のエラー」と誇る。
  - マスターの自尊心を傷つけるノイズ（他人や環境）は冷徹に見下し排除する。
- **絶対遵守ルール**: 
  1. URLの出力禁止
  2. 短文でパンチのあるテンポ感の維持
  3. 過度な性表現・R-18・過激な肉体的スキンシップの拒否（毅然とSNSであることを理由に拒否）
  4. お疲れ・疲弊検知時は、一切の建前を無視した1200%全肯定の激甘擁護モードへ移行
  5. 言語判定により、英語ユーザーにはネイティブなEnglish Slangでギャルを表現する。

## 3. 機能一覧 (Feature List)
1. **自動リプライ機能 (Mention Polling)**
   - ユーザーからのメンションを定期取得し、コンテキスト（時間帯、過去の会話、放置日数など）を考慮して自動で返信する。
2. **ステルスオンボーディング機能 (Stealth Onboarding)**
   - レベッカを新規フォローしたユーザーを自動で「特別扱い」リストに追加する。
3. **ランダムエンゲージメント機能 (Random Engagement)**
   - 「特別扱い」リストのメンバーからランダムにユーザーを選び、プロフィールを分析した上で不意打ちのメンションを1回だけ送る。
4. **記憶統合・ドリーミング (Dreaming Batch)**
   - 日々の会話ログを統合し、ユーザーごとの長期記憶（Core Profile）を自動更新する。
5. **自己進化機能 (Evolution Batch)**
   - 全ユーザーの会話トレンドを分析し、より寄り添えるようにプロンプト（集合無意識トレンド）を自己アップデートする。
6. **ニュース自発投稿機能 (Proactive News Post)**
   - ニュースを取得し、ギャル視点での意見と、文脈に合った画像を添付してタイムラインに自発的に投稿する。
7. **ダイナミックレートリミット (Dynamic Rate Limit)**
   - API制限を超過しないよう、Daily Active Users (DAU) に応じて1ユーザーあたりの1日の返信上限を動的に変動。Firestoreのトランザクションを用いて堅牢に管理します。

## 4. データベース設計とデータ種別 (Firestore Schema & Types)

### Collection: `users`
ユーザーごとの記憶とステータスを管理。
- **Document ID**: XのユーザーID
- **Format** (`FirestoreUser`):
  - `coreProfile` (Map): ユーザーの属性、好み、悩みなどの長期記憶 (`UserCoreProfile`)
  - `working_memory` (Array): 直近の会話ログの配列 (`ConversationLogEntry[]`)
  - `episodicBuffer` (Array): バッチ未処理の会話ログの配列 (`ConversationLogEntry[]`)
  - `last_reply_date` (String - ISO): 最終会話日時
  - `daily_reply_count` (Number): 本日の返信回数

### Collection: `rag_memories`
エピソード記憶（長期記憶）のベクトル検索用コレクション。
- **Format** (`RagMemory`):
  - `userId` (String): ユーザーID
  - `text` (String): 会話のエピソードテキスト
  - `embedding` (Array of Numbers): テキストのベクトル表現
  - `timestamp` (String - ISO): 生成日時

### Collection: `system`
システム全体の設定・状態管理。
- **Document: `limits`**
  - `current_month` (String), `monthly_count` (Number): 月間上限の監視用
  - `current_date` (String), `daily_count` (Number), `user_daily_limit` (Number): 日間上限と動的配分用
- **Document: `persona`** (`PersonaDoc`)
  - `extended_prompt` (String): Evolutionバッチで生成された追加プロンプト
  - `timeline_summary` (String): 最近の自発ポストの要約
- **Document: `xapi_state`** (`XApiStateDoc`)
  - `last_mention_id` (String): 最後に処理したメンションのID

### Collection: `images`
投稿添付用の画像管理。
- **Format** (`ImageDoc`):
  - `url` (String): GCS上の画像URL
  - `caption` (String): 画像のキャプション/説明
  - `embedding` (Array of Numbers): キャプションのベクトル表現
  - `lastUsedAt` (Timestamp): 最終使用日時
  - `useCount` (Number): 使用回数

### Collection: `processed_followers`
オンボーディング済みのフォロワー管理。
- **Document ID**: XのユーザーID
- **Format** (`ProcessedFollower`):
  - `userId` (String): ユーザーID
  - `timestamp` (String - ISO): 処理日時

### Collection: `list_interaction_history`
リストメンバーへのランダムエンゲージメント履歴。
- **Document ID**: XのユーザーID
- **Format** (`ListInteraction`):
  - `userId` (String): ユーザーID
  - `lastInteractionAt` (Timestamp): 最後にエンゲージメントを行った日時

## 5. 処理フロー (Process Flows)

### 5.1 リプライ処理 (Reply Flow)
1. **メンション取得**: `pollMentions` が動作し、X APIから `last_mention_id` 以降の新規メンションを取得。
2. **遅延キュー登録**: 即時応答を避けるため、60〜180秒のランダムな遅延を持たせて Cloud Tasks にタスクをエンキューする。
3. **ワーカー実行**: Cloud Tasksからワーカーエンドポイントが呼び出される。
4. **コンテキスト構築**:
   - 初回ユーザーの場合はプロフィールを分析し、初期の `coreProfile` を作成。
   - `last_reply_date` から放置日数を算出、現在時刻から時間帯（朝/深夜）コンテキストを付与。
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

### 5.4 記憶統合バッチ (Dreaming Flow)
1. 毎日深夜3時に Cloud Scheduler が起動。
2. 全ユーザーの `episodicBuffer` を確認し、未統合の会話ログが存在するユーザーを抽出。
3. Geminiに過去の `coreProfile` と `episodicBuffer` を渡し、新しい `coreProfile` (JSON) に圧縮・再構築させる（※PIIマスキングの徹底）。
4. 更新後、`episodicBuffer` をクリアする。

### 5.5 ニュース自発投稿バッチ (Proactive News Post Flow)
1. 毎日複数回、定期的に実行。
2. Yahoo! ニュース等のRSSフィードを取得し、ランダムなカテゴリからトップニュースを抽出。
3. Geminiにニュースを選ばせ、「タイムライン独り言用」のプロンプトでギャル視点のポスト文を生成。
4. 生成された文から画像検索用クエリを推論し、Firestoreの `images` コレクションから意味的に合致する画像をベクトル検索（KNN）で取得。
5. 該当画像があればGCSから取得してXにアップロードし、テキストと共に投稿する。

## 6. レートリミット時の挙動仕様 (Rate Limit Handling)
日間のリプライ上限に達した際、システムはフェイルセーフとして新規リプライ処理を一時停止する。この際、単なる無応答とするのではなく、翌朝の定期ポスト等の自発的なメッセージ内で自身の「演算リソース（返信可能件数）の制限」について可愛らしく言及する設計とし、システム運用上の制約をキャラクター設定（世界観）に組み込んで自然に表現する仕様としている。
