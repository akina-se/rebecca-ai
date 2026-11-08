# External Integrations Setup Guide

This runbook provides minimal, security-first instructions for configuring the external cloud services required to run, test, and deploy the Rebecca AI platform. It serves as an authoritative guide for human contributors and autonomous AI agents.

---

## 1. Google Cloud Platform (GCP) & Firebase

Rebecca relies on Google Cloud serverless architecture (Cloud Run, Cloud Tasks, Firestore, Cloud Storage, and Secret Manager).

### 1.1 Enable Required APIs
Run the following command using the Google Cloud CLI (`gcloud`) targeting your dedicated GCP project:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  generativelanguage.googleapis.com \
  --project=<GCP_PROJECT_ID>
```

### 1.2 Authentication & Credential Architecture
Security rule: **Never check in credentials or service account keys to version control.**

- **Local Development (Recommended)**:
  Use Application Default Credentials (ADC) backed by temporary user OAuth tokens. No key files are stored in the repository.
  ```bash
  gcloud auth application-default login
  gcloud config set project <GCP_PROJECT_ID>
  ```
- **Automated Agents / Headless Environments (Service Account Key)**:
  If running inside headless containers or CI/CD where interactive browser login is impossible:
  1. Create a dedicated service account:
     ```bash
     gcloud iam service-accounts create rebecca-backend-sa \
       --description="Rebecca AI Bot Backend Service Account" \
       --display-name="rebecca-backend-sa" \
       --project=<GCP_PROJECT_ID>
     ```
  2. Grant the **least-privilege roles** only (never assign `Owner` or `Editor`):
     - `roles/datastore.user` (Cloud Datastore / Firestore data access)
     - `roles/cloudtasks.enqueuer` (Enqueue reply and appreciation tasks)
     - `roles/storage.objectAdmin` (Manage image assets and artwork rewards)
  3. Generate a key file and store it **outside** the workspace root (or ensure it is ignored by `.gitignore`):
     ```bash
     gcloud iam service-accounts keys create ~/keys/rebecca-sa-key.json \
       --iam-account=rebecca-backend-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com
     export GOOGLE_APPLICATION_CREDENTIALS="$HOME/keys/rebecca-sa-key.json"
     ```
- **Production (Cloud Run)**:
  Cloud Run automatically receives ambient credentials from its attached runtime service account. Zero key management is required in production.

### 1.3 Cloud Tasks Queue Setup
Create the required task queue in your deployment region (`asia-northeast1` recommended):

```bash
gcloud tasks queues create rebecca-reply-queue \
  --location=<DEPLOY_REGION> \
  --project=<GCP_PROJECT_ID>
```

### 1.4 Firestore Composite Index for RAG Vector Search
Deploy indexes using `firebase deploy --only firestore:indexes` or execute:

```bash
gcloud alpha firestore indexes composite create \
  --collection-group=rag_memories \
  --query-scope=COLLECTION \
  --field-config=field-path=embedding,vector-config='{"dimension":768,"flat":"{}"}' \
  --field-config=field-path=userId,order=ASCENDING \
  --project=<GCP_PROJECT_ID>
```

---

## 2. Google Gemini API

Rebecca utilizes multimodal LLMs and embeddings via `@google/genai`.

1. Generate an API Key in [Google AI Studio](https://aistudio.google.com/).
2. Add the key to `apps/bot-backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Recommended model configuration (in `apps/bot-backend/.env`):
   ```env
   GEMINI_MODEL=gemini-3.5-flash-lite
   GEMINI_JUDGE_MODEL=gemini-3.1-flash-lite
   GEMINI_EMBEDDING_MODEL=gemini-embedding-2
   GEMINI_VISION_MODEL=gemini-3.5-flash-lite
   GEMINI_SEARCH_MODEL=gemini-2.5-flash
   ```

---

## 3. X (Twitter) API

Reference: [X API Documentation](https://docs.x.com/overview) | [X API Pay-per-use Pricing](https://docs.x.com/x-api/getting-started/pricing)

Rebecca posts autonomous timeline updates, replies, polls, and supporter appreciation tweets.

### 3.1 Pricing Model: Pay-Per-Use (Credit-Based)
The X API uses a **Pay-per-use (Pay-As-You-Go)** credit model rather than legacy fixed-fee subscriptions ($100/mo Basic or $5,000/mo Pro).

- **How it Works**:
  - Purchase credits upfront in the [X Developer Console](https://console.x.com/).
  - Credits deduct per operation with zero minimum monthly commitments.
  - Set hard monthly spending limits and optional auto-recharge thresholds to prevent unexpected costs.
  - *Free Credit Incentives*: New pay-per-use accounts can earn up to $70 in promotional credits ($20 for saving an eligible payment card on first credit purchase, plus matching the first auto-recharge up to $50).
- **Unit Costs (Standard Endpoints)**:
  - `Post: Create` (plain text): ~$0.015 per request
  - `Post: Create (summoned / reply)`: ~$0.010 per request
  - `Post: Create (with URL)`: ~$0.200 per request
  - `Posts: Read`: ~$0.005 per resource (*Owned Reads* for your account's own posts are heavily discounted)

### 3.2 Developer Portal & App Setup
1. Log into the [X Developer Portal](https://developer.x.com/) with the bot's account.
2. Create a **Project** and an **App** attached to your pay-per-use account.

### 3.3 User Authentication Settings (Critical)
Navigate to **App Settings > User authentication settings**:
1. Enable **OAuth 1.0a**.
2. Set **App permissions** to **Read and Write** (Default is Read-only; write permission is required for posting tweets).
3. Set **Type of App** to **Web App, Automated App or Bot**.
4. Set Callback URL / Website URL to your valid domain (`https://<YOUR_DOMAIN>`).

### 3.4 Keys and Tokens
Under the **Keys and Tokens** tab:
1. Generate **Consumer Keys** -> `API Key` and `API Key Secret`.
2. Generate **Authentication Tokens** -> `Access Token` and `Access Token Secret` (must be generated *after* setting Read & Write permissions).
3. Retrieve your numeric X User ID (`X_MY_USER_ID`) by querying `https://api.x.com/2/users/by/username/<YOUR_BOT_USERNAME>` with your bearer token, or using the dashboard profile tool.
4. Configure in `apps/bot-backend/.env`:
   ```env
   X_API_KEY=your_consumer_api_key
   X_API_SECRET=your_consumer_api_secret
   X_ACCESS_TOKEN=your_access_token
   X_ACCESS_SECRET=your_access_token_secret
   X_MY_USER_ID=your_numeric_user_id
   ```

---

## 4. Stripe Supporter & Tipping System

Rebecca provides a supporter appreciation portal with 3 tiers (Bronze, Silver, Gold), automated digital artwork reward delivery, public credit roster listing, and autonomous appreciation tweets.

### 4.1 Environments: Test Mode vs. Live Mode
Always verify end-to-end checkout with Stripe Test Mode (`buy.stripe.com/test_...` and `sk_test_...`) before promoting to Live Mode.

### 4.2 Product Catalog Setup
Create 3 one-time products in the Stripe Dashboard (JPY, tax included):

| Tier | Price | Product Name | Description (Single-line recommended) |
| :--- | :--- | :--- | :--- |
| **Bronze** | `¥500` | `エナドリ1本差し入れ \| Energy Drink (BRONZE)` | `【特典】高画質イラストDL・公式Xお礼ポスト・名簿掲載 / Digital artwork, appreciation post, and website roster credit.` |
| **Silver** | `¥1,000` | `サーバーリソース差し入れ \| Compute Server Resource (SILVER)` | `【特典】高画質イラストDL・公式Xお礼ポスト・名簿掲載(SILVERバッジ) / Digital artwork, appreciation post, and website roster credit (SILVER badge).` |
| **Gold** | `¥3,000` | `開発サポート \| Development Support (GOLD)` | `【特典】高画質イラストDL・公式Xお礼ポスト・名簿掲載(GOLD最上位バッジ) / Digital artwork, appreciation post, and website roster credit (VIP GOLD badge).` |

- **Tax Setting**: Set to **Included in price (内税)**. Do NOT use multi-currency pricing (e.g. USD/EUR); Stripe automatically converts international payments to JPY while preserving exact tier amounts.

### 4.3 Payment Links Configuration
Create a **Payment Link** for each of the 3 products.

1. **Disable Managed Payments (Important)**:
   - Uncheck **Managed Payments** and **Automatic Tax**. Leaving this on incurs an extra 3.5% fee and triggers strict product tax code requirements.
2. **Add Custom Fields**:
   - **Field 1 (Text)**:
     - Type: `Text`
     - Label: `掲載名 / Supporter Name (Nickname)`
     - Key: `supporter_name`
     - Required: `false` (Optional)
   - **Field 2 (Dropdown)**:
     - Type: `Dropdown`
     - Label: `名簿への掲載 / Show on Supporters Roster`
     - Key: `credit_visibility`
     - Option 1: Label `掲載する / Show publicly` / Value: `show`
     - Option 2: Label `匿名にする / Keep anonymous` / Value: `hide`
3. **Confirmation Page (After Payment)**:
   - Select **Don't show confirmation page (Redirect to your site)**.
   - Redirect URL:
     ```text
     https://<YOUR_DOMAIN>/thankyou?session_id={CHECKOUT_SESSION_ID}
     ```
     *(The `{CHECKOUT_SESSION_ID}` template variable is required for the thank-you page to verify payment and issue the 30-minute download cookie).*

### 4.4 Webhook Endpoint Setup
In Stripe Dashboard (**Developers > Webhooks**):
1. Click **Add endpoint**.
2. **Endpoint URL**: `https://<YOUR_DOMAIN>/api/webhooks/stripe`
3. **Events to send**: Select `checkout.session.completed` only.
4. Copy the **Signing secret** (`whsec_...`).

### 4.5 Environment Configuration
Populate in `apps/bot-backend/.env` (and Cloud Run environment variables for production):

```env
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENT_LINK_BRONZE=https://buy.stripe.com/...
STRIPE_PAYMENT_LINK_SILVER=https://buy.stripe.com/...
STRIPE_PAYMENT_LINK_GOLD=https://buy.stripe.com/...
```

---

## 5. Security & Zero-Leakage Policy

Before committing or deploying, verify conformance with the repository's security invariants:

1. **No Real Secrets in Git**: Run `npm run secret-check` locally to confirm zero keys, tokens, or credentials match Secretlint rules.
2. **Path Sanitization**: Ensure local file paths (e.g. `C:\Users\...` or `/home/...`) never appear in comments or commit messages.
3. **Least Privilege**: Always scope Cloud Run, Cloud Functions, and external API keys to the minimal required permissions.
