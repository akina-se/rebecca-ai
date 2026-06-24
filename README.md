# レベッカIP化プロジェクト：AIチャットボット「Rebecca」

全肯定ギャルAI「レベッカ」のバックエンドシステムです。X（旧Twitter）、Google Cloud Platform（GCP）、Gemini APIを活用し、完全サーバーレスで動作します。

## 機能・特徴
- **トリプル・バッファ記憶システム**: 会話コンテキストを漏らさず長期記憶化。
- **動的コンテキスト注入**: 朝・深夜の時間帯や、ユーザーの放置日数、社畜キーワード（残業、上司等）に反応してプロンプトを動的に変更。
- **意図的遅延**: Xからのメンションに対し、1〜3分のランダムな遅延を挟んで人間らしさを演出。
- **厳格なレートリミット**: GCP破産・X API課金爆発を防ぐための多段コスト管理（全体月間、全体日間、ユーザーダイナミック配分）。

## 技術スタック
- **言語**: Node.js / Express
- **LLM**: Gemini 3.1 Flash Lite (`@google/genai`)
- **DB**: Cloud Firestore
- **Queue**: Cloud Tasks
- **Server**: Cloud Run
- **Scheduler**: Cloud Scheduler
- **SNS Integration**: X API v2 (`twitter-api-v2`)

## セットアップ手順

### 1. GCPプロジェクトの設定
1. GCPコンソールにて新しいプロジェクトを作成し、課金を有効にします（無料枠利用の場合も必須）。
2. 以下のAPIを有効化します：
   - Cloud Run API
   - Cloud Tasks API
   - Cloud Firestore API
   - Cloud Scheduler API
3. Firestoreデータベースを作成します（ネイティブモード推奨）。
4. Cloud Tasksのキューを作成します：
   ```bash
   gcloud tasks queues create rebecca-reply-queue --location=asia-northeast1
   ```
5. Firestoreのベクトル検索インデックスを作成します（RAG記憶用）：
   ```bash
   gcloud alpha firestore indexes composite create \
     --collection-group=rag_memories \
     --query-scope=COLLECTION \
     --field-config=field-path=embedding,vector-config='{"dimension":768,"flat": "{}"}' \
     --field-config=field-path=userId,order=ASCENDING \
     --project=your-gcp-project-id
   ```

### 2. 環境変数の設定
プロジェクトルートに `.env` ファイルを作成し、以下の内容を記述します：

```env
# Server
PORT=8080

# GCP
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=asia-northeast1
GCP_TASK_QUEUE_NAME=rebecca-reply-queue
# デプロイ後にCloud RunのURLを発行し、ここに設定します
WORKER_URL=https://your-cloud-run-service-url.a.run.app

# X API (Free Plan以上)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
X_BEARER_TOKEN=
X_MY_USER_ID=your-bot-twitter-user-id

# Gemini API
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
```

### 3. ローカルでの実行・テスト
```bash
# 依存関係のインストール
npm install

# テストの実行（単体・インテグレーション・モック使用）
npm test

# ローカルでチャットをテストする
npm run chat

# LLM as a Judge によるプロンプト安全性テスト
npm run test:eval

# Evolutionバッチ（集合無意識抽出＆監査）の手動テスト
npm run batch:evolution

# ニュース定時配信バッチ（Proactive Talk）の手動テスト
npm run batch:news
```
※ローカルから webhook を検証するには `ngrok` 等でポート8080を公開し、X Developer PortalでWebhook URLを設定してください。（X API Freeプランの場合、Webhook(Account Activity API)が利用できない可能性があります。その場合は、必要に応じて別途ポーリングする構成へ微調整してください）

### 4. デプロイ
提供しているデプロイスクリプトを利用してCloud Runにデプロイします。
※事前に `gcloud auth login` および `gcloud config set project [YOUR_PROJECT_ID]` を実行してください。

```bash
npm run deploy
```

## アーキテクチャ図（簡易）
1. [User] --(Mention)--> [X API] --(Webhook)--> [Cloud Run (Webhook Receiver)]
2. [Cloud Run] --(Enqueue 1-3min delay)--> [Cloud Tasks]
3. [Cloud Tasks] --(HTTP POST)--> [Cloud Run (Worker)]
4. [Cloud Run (Worker)] <--(Fetch/Save)--> [Firestore]
5. [Cloud Run (Worker)] <--(Generate)--> [Gemini API]
6. [Cloud Run (Worker)] --(Reply)--> [X API]

## ディレクトリ構成
- `src/index.js` : エントリポイント
- `src/core/` : コアロジック（記憶管理、コンテキスト注入、レートリミット）
- `src/services/` : 外部サービス通信（Firestore, Gemini, X, Cloud Tasks）
- `src/config/` : 設定・環境変数管理
- `tests/` : 単体・統合テスト
- `scripts/` : デプロイ等の便利スクリプト

## ライセンス
このプロジェクトは [MIT ライセンス](LICENSE) の下で公開されています。

## Author
AKINA