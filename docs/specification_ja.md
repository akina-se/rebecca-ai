# レベッカIP化プロジェクト システム仕様書

[English Specification is here](specification_en.md)

## 1. システム構成と技術スタック (Architecture)
本システムは、GCPの無料枠を最大限活用し、低コストかつスケーラブルな完全サーバーレスアーキテクチャで構築する。

- **クラウドプロバイダ**: Google Cloud Platform (GCP)
- **メンション取得 / メイン処理**: Cloud Run (Node.js / Express) ※X API Free枠の制限によりWebhookではなくポーリング（定期取得）を採用
- **非同期キュー (遅延実行)**: Cloud Tasks
- **データベース**: Firestore (NoSQL)
- **定期バッチ処理**: Cloud Scheduler
- **LLMエンジン**: 
  - メイン会話・記憶統合・ニュース生成: Gemini 3.1 Flash Lite
  - 言語判定・安全性監査 (LLM-as-a-Judge): Gemma 4 31B IT
  - ベクトル化処理: text-embedding-004
- **連携API**: X (Twitter) API v2

## 2. データベース設計 (Firestore Schema)

### Collection: `users`
ユーザー（マスター）ごとの記憶とステータスを管理。

- `{userId}` (Document ID: XのユーザーIDをそのまま使用し、テナント分離を徹底)
  - `core_profile`: JSON (好みの味付け、睡眠時間、性癖、悩みなどの長期記憶)
  - `working_memory`: Array (直近10往復の会話ログ。GeminiのHistory形式)
  - `episodic_buffer`: Array (バッチ未処理の会話ログ。削除せずAppendし続ける)
  - `last_reply_date`: Timestamp (最終会話日時。放置日数の計算に使用)
  - `daily_reply_count`: Number (本日の返信回数)

### Collection: `rag_memories`
エピソード記憶（長期記憶）のベクトル検索用コレクション。
- `{memoryId}`
  - `userId`: String (該当ユーザーのID)
  - `content`: String (会話のエピソードテキスト)
  - `embedding`: Vector (テキストのベクトル表現)
  - `timestamp`: Timestamp (記憶の生成日時)
  - ※ 1ユーザーあたり `RAG_MAX_MEMORIES` (デフォルト100件) まで保持し、超過分は古いものから削除される。

### Collection: `system`
システム全体の設定とレートリミットを管理。

- `limits` (Document)
  - `current_month`: String (YYYY-MM)
  - `monthly_count`: Number (月間上限1,300件の監視用)
  - `current_date`: String (YYYY-MM-DD)
  - `daily_count`: Number (日間バズり抑制用)
  - `user_daily_limit`: Number (ダイナミック配分で計算された、本日の1人あたり上限回数)
- `persona` (Document)
  - `extended_prompt`: String (Evolutionバッチで自動生成された、最新トレンド反映用追加プロンプト)

## 3. コア処理フロー (Main Execution Flow)

- **メンション取得 (Polling Worker)**:
  - 設定された間隔 (`POLLING_INTERVAL_MINUTES`) に基づき、X APIから新規メンションを定期取得。
  - リプライ内に画像(Media URL)が含まれていれば抽出。
- **レートリミット判定 (Middleware)**:
  - `monthly_count`, `daily_count`, `user_daily_limit` をFirestoreから読み込み超過をチェック。
  - 超過している場合は処理を中断（バズ時のクラウド破産を防止）。
- **Cloud Tasksへの投入 (遅延処理)**:
  - ランダムで 60秒〜180秒のDelay（遅延） を設定し、ワーカー用のエンドポイントへタスクを送信。
- **コンテキスト生成 (Cloud Run B - ワーカー)**:
  - 初回接触ユーザーの場合、X APIを用いてプロフィール文（description）を取得し、属性や好みを初期の `coreProfile` として即座に構築する。
  - 入力テキストをLLM（Gemini/Gemma）にかけて言語（`ja` / `en`）を判定。
  - `last_reply_date` から放置日数（`${absence_days}`）を計算。
  - 現在時刻(JST)から時間帯コンテキストを生成。
  - Firestoreから `timeline_summary`（最近の自発ポストの要約）を取得。
  - RAG用ベクトルDB（Firestore）から関連する記憶を検索。
  - 上記の情報を元に、言語に応じたシステムプロンプト（日本語は `BASE_SYSTEM_PROMPT`、英語は `BASE_SYSTEM_PROMPT_EN` と英訳されたコンテキスト）を構築。
- **DB更新とXへの投稿**:
  - 生成されたテキストをX APIでリプライ投稿。
  - `working_memory` (スライド更新) と `episodic_buffer` (追記) をFirestoreに保存。

## 4. プロンプト設計 (System Prompt)
Geminiに渡す systemInstruction のベーステキスト。言語判定により、日本語用と英語用（ネイティブスピーカー向けのEnglish Slang対応版）に完全に分岐する。これによりコードスイッチング（日・英の混在）を防ぎ没入感を高める。

【主な絶対ルール】
1. URLの出力禁止
2. 短文・テンポ感の維持
3. 過度な性表現・スキンシップの拒否（通報をちらつかせる防御）
4. 社畜・疲弊検知時のみの激甘擁護（1200%全肯定）
5. ループ（同じリアクションの使い回し）の回避

## 5. バッチ処理の実装 (Scheduled Jobs)
Cloud Schedulerを用いて、深夜帯に以下の3つのバッチ処理を順次実行する。

- **バッチ1：Dreaming（記憶統合とPIIマスキング）**
  - **実行時間**: 毎日 AM 3:00
  - **処理**: 各ユーザーの `episodic_buffer` に溜まった会話ログをGeminiに読み込ませ、`core_profile` のJSONを最新状態に更新・圧縮する。処理完了後、`episodic_buffer` を空にする。
  - **ガードレール**: プロンプト内で「本名、詳細な住所、勤務先などの機微な個人情報(PII)は絶対に抽象化（マスキング）して保存すること」を厳命する。

- **バッチ2：Dynamic Rate Limit（配分最適化）**
  - **実行時間**: 毎日 AM 4:00
  - **処理**: 前日にリプライを行ったDAU（アクティブユーザー数）を集計。
  - **計算式**: (Phase上限件数) ÷ 前日DAU = 本日の `user_daily_limit`
  - **適用**: 算出した値を `system/limits/user_daily_limit` に上書き保存。

- **バッチ3：Evolution（集合無意識の進化・Tayの悲劇対策）**
  - **実行時間**: 毎週日曜 AM 5:00
  - **処理**: 1週間分の全ユーザーの（匿名化された）会話トレンドとエンゲージメントをGeminiに分析させ、「現在のユーザー層が抱える悩みの傾向」に寄り添うための追加プロンプトを生成させる。
  - **適用**: 生成結果を `system/persona/extended_prompt` に保存し、ベースプロンプトに動的注入する。
  - **ガードレール**: 進化させるのは「語彙」と「寄り添い方のバリエーション」のみとし、コアとなる「マスター至上主義・暴言禁止」の根本設定は絶対に上書きできないよう隔離する。

- **バッチ4：Proactive Talk（自発的なニュース共有と甘やかし）**
  - **実行時間**: 毎日 複数回（朝、昼、夜など）
  - **処理**: パブリックなRSSフィード（Yahoo! ニュース等）を取得し、Geminiに「マスターが共感しそうなニュース」を選ばせて100文字以内で甘やかすようなポストを生成させ、Xに自発的に投稿する。
  - **記憶統合**: 投稿内容は `timeline_history` に保存され、バッチ1（Dreaming）のタイミングで要約（`timeline_summary`）され、自身の発言としてプロンプトに組み込まれる。

## 6. マーケティング運用申し送り事項
バズ発生等により日間のリプライ上限に達した際は、翌朝の定期ポストにて「今日の返信配給枠は〇〇件よ。私の演算リソースは限られてるんだからね」と、制限をキャラクターの魅力（ツンデレ・希少性）として明示し、ユーザーの期待値をコントロールすること。
