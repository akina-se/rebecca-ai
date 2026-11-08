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
- **CI/CD Pipelines (Recommended — Keyless OIDC)**:
  Use **Workload Identity Federation (WIF)** with short-lived federated OIDC tokens instead of long-lived Service Account JSON keys:
  ```bash
  gcloud iam workload-identity-pools create "<WIF_POOL_ID>" \
    --location="global" \
    --display-name="CI OIDC Pool" \
    --project=<GCP_PROJECT_ID>

  gcloud iam workload-identity-pools providers create-oidc "<WIF_PROVIDER_ID>" \
    --location="global" \
    --workload-identity-pool="<WIF_POOL_ID>" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='<GITHUB_OWNER>/<GITHUB_REPO>'" \
    --project=<GCP_PROJECT_ID>
  ```
  Bind only the target repository to impersonate the deploy service account (`roles/iam.workloadIdentityUser`).
- **Runtime Service Account & Least-Privilege IAM**:
  Create a dedicated runtime service account and grant strictly the minimum required permissions (never assign `Owner` or `Editor`):
  ```bash
  gcloud iam service-accounts create rebecca-backend-sa \
    --description="Rebecca AI Bot Backend Service Account" \
    --display-name="rebecca-backend-sa" \
    --project=<GCP_PROJECT_ID>
  ```
  - **Firestore**: `roles/datastore.user`
  - **Cloud Tasks**: `roles/cloudtasks.enqueuer`
  - **Cloud Storage (Bucket-Scoped — avoid project-wide Storage Admin)**:
    ```bash
    gcloud storage buckets add-iam-policy-binding gs://<IMAGE_BUCKET_NAME> \
      --member="serviceAccount:rebecca-backend-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com" \
      --role="roles/storage.objectAdmin"
    ```
  - **Secret Manager (Per-Secret Scoped)**: Grant `roles/secretmanager.secretAccessor` only on the individual secrets required by each service (`gcloud secrets add-iam-policy-binding <SECRET_NAME> ...`).
  - **Cloud Scheduler / Cloud Tasks OIDC Invocation**: Grant `roles/run.invoker` on the `bot-backend` Cloud Run service and configure `SERVICE_ACCOUNT_EMAIL` so OIDC verification succeeds on `/batch/*` and `/worker/*`.
- **Headless Agents Fallback (JSON Key — Avoid Whenever Possible)**:
  Only generate a Service Account JSON key when WIF or interactive ADC is impossible. Store it **outside** the workspace root (never inside the repository) and rotate it regularly:
  ```bash
  gcloud iam service-accounts keys create ~/keys/rebecca-sa-key.json \
    --iam-account=rebecca-backend-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com
  export GOOGLE_APPLICATION_CREDENTIALS="$HOME/keys/rebecca-sa-key.json"
  ```
- **Production (Cloud Run & Secret Manager)**:
  Cloud Run automatically receives ambient credentials from its attached runtime service account. Inject third-party credentials (`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, X API tokens) via **Secret Manager** (`--set-secrets` or `--update-secrets` pinned to secret versions) rather than plain `--set-env-vars` (note: `--set-env-vars` overwrites existing environment variables; prefer `--update-env-vars` when updating partial config).
- **Admin Dashboard Authentication (Firebase Auth)**:
  1. Enable **Email/Password** (or Google) sign-in in Firebase Authentication and add your production dashboard hostname (`<YOUR_DASHBOARD_DOMAIN>`) under **Authorized domains**.
  2. Set `FIREBASE_WEB_API_KEY` (public Firebase Web App configuration) on `dashboard-backend` so `/api/v1/config` serves runtime client config.
  3. Register initial administrators in `admin_users` using `npm run register-admin` against the target Firestore environment (`beforeAdminSignIn` Cloud Function enforces `email_verified`, UID binding, `status === 'ACTIVE'`, and `role === 'ADMIN'`).

### 1.3 Cloud Tasks Queue Setup
Create the required task queue in your deployment region (`asia-northeast1` recommended):

```bash
gcloud tasks queues create rebecca-reply-queue \
  --location=<DEPLOY_REGION> \
  --project=<GCP_PROJECT_ID>
```

### 1.4 Firestore Composite Index for RAG Vector Search
Deploy declarative indexes via `firebase deploy --only firestore:indexes` (recommended SSOT using `packages/db/firestore.indexes.json`), or create via the GA `gcloud` CLI command:

```bash
gcloud firestore indexes composite create \
  --database="(default)" \
  --collection-group=rag_memories \
  --query-scope=COLLECTION \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}' \
  --field-config=field-path=userId,order=ASCENDING \
  --project=<GCP_PROJECT_ID>
```

> [!TIP]
> On Windows PowerShell or shells with strict JSON quoting rules, pass `--flags-file=index-config.yaml` (or use `firebase deploy --only firestore:indexes`) instead of inline JSON quotes.

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

### 4.1 Environments & Restricted API Keys (Best Practice)
- **Test Mode vs. Live Mode**: Always verify end-to-end checkout in Stripe Test Mode (`buy.stripe.com/test_...` and `rk_test_...`) before promoting to Live Mode. Keep local `.env` files pointed at **Test Mode** credentials only and store Live/Production keys (`rk_live_...`, live `whsec_...`) strictly in **Google Secret Manager** for Cloud Run.
- **Use Restricted API Keys (`rk_...`) Instead of Full-Access `sk_...` Keys**:
  `bot-backend` only retrieves Checkout Sessions (with expanded PaymentIntents) and verifies webhooks locally using the webhook signing secret. Create a **Restricted Key** in Stripe Dashboard (**Developers > API keys > Create restricted key > Custom permissions**):
  - **Checkout Sessions**: `Read`
  - **PaymentIntents**: `Read`
  - **All other permissions**: `None`

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

1. **Disable Managed Payments & Automatic Tax (Important)**:
   - Keep **Managed Payments** disabled (`Settings > Managed Payments`, avoiding the +3.5% MoR fee and strict product tax code constraints) and uncheck **Collect tax automatically** on each Payment Link (avoids +0.5% Stripe Tax fee on already tax-inclusive JPY items).
2. **Payment Methods**:
   - Enable immediate-settlement methods (Card, Apple Pay, Google Pay, Link). Avoid delayed/asynchronous methods (e.g. convenience store / bank transfer) unless your webhook handler explicitly handles `payment_status === 'unpaid'` and `checkout.session.async_payment_succeeded`.
3. **Add Custom Fields**:
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
4. **Confirmation Page (After Payment)**:
   - Select **Don't show confirmation page (Redirect to your site)**.
   - Redirect URL:
     ```text
     https://<YOUR_DOMAIN>/support/thank-you?session_id={CHECKOUT_SESSION_ID}
     ```
     *(The `{CHECKOUT_SESSION_ID}` template variable is required for the thank-you page at `/support/thank-you` to verify payment and issue the 30-minute download cookie).*

### 4.4 Webhook Endpoint Setup
In Stripe Dashboard (**Developers > Webhooks**):
1. Click **Add endpoint**.
2. **Endpoint URL**: `https://<YOUR_DOMAIN>/api/v1/webhooks/stripe`
3. **Events to send**: Select `checkout.session.completed`.
4. Copy the **Signing secret** (`whsec_...`).

### 4.5 Environment Configuration
Populate Test credentials in `apps/bot-backend/.env` (gitignored) for local verification, and inject Live credentials via Cloud Run **Secret Manager** in production:

```env
# Use Restricted API Keys scoped strictly to Checkout Sessions (Read) & PaymentIntents (Read)
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENT_LINK_BRONZE=https://buy.stripe.com/test_...
STRIPE_PAYMENT_LINK_SILVER=https://buy.stripe.com/test_...
STRIPE_PAYMENT_LINK_GOLD=https://buy.stripe.com/test_...
```

---

## 5. Security & Zero-Leakage Policy

Before committing or deploying, verify conformance with the repository's security invariants:

1. **No Real Secrets in Git**: Run `npm run secret-check` locally to confirm zero keys, tokens, or credentials match Secretlint rules.
2. **Path Sanitization**: Ensure local file paths (e.g. `C:\Users\...` or `/home/...`) never appear in comments or commit messages.
3. **Least Privilege**: Always scope Cloud Run, Cloud Functions, and external API keys to the minimal required permissions.
