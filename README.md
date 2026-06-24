# Rebecca IP Project: AI Chatbot "Rebecca"

This is the backend system for the unconditional affirmation Gyaru AI, "Rebecca". It operates entirely serverless, utilizing X (formerly Twitter), Google Cloud Platform (GCP), and the Gemini API.

[日本語版の仕様書はこちら (Japanese Specification)](docs/specification_ja.md) | [English Specification](docs/specification_en.md)

## Features
- **Triple-Buffer Memory System**: Converts conversation contexts into long-term memory without losing detail.
- **Dynamic Context Injection**: Dynamically alters the prompt based on time of day (morning/late night), user absence duration, and overworked-related keywords (e.g., overtime, boss).
- **Automatic Language Separation**: Uses LLM-based language detection to switch completely to an English system prompt and context (featuring English Slang) for English-speaking users, preventing awkward code-switching.
- **Intentional Delay**: Introduces a random 1-3 minute delay before replying to X mentions to simulate human behavior.
- **Strict Rate Limiting**: Multi-tiered cost management (Global Monthly, Global Daily, Dynamic User Allocation) to prevent GCP budget blowouts and X API billing explosions.

## Tech Stack
- **Language**: Node.js / Express
- **LLM**: Gemini 3.1 Flash Lite (`@google/genai`)
- **DB**: Cloud Firestore
- **Queue**: Cloud Tasks
- **Server**: Cloud Run
- **Scheduler**: Cloud Scheduler
- **SNS Integration**: X API v2 (`twitter-api-v2`)

## Setup Instructions

### 1. GCP Project Setup
1. Create a new project in the GCP Console and enable billing (required even for the free tier).
2. Enable the following APIs:
   - Cloud Run API
   - Cloud Tasks API
   - Cloud Firestore API
   - Cloud Scheduler API
3. Create a Firestore database (Native mode recommended).
4. Create a Cloud Tasks queue:
   ```bash
   gcloud tasks queues create rebecca-reply-queue --location=asia-northeast1
   ```
5. Create a Firestore vector search index (for RAG memory):
   ```bash
   gcloud alpha firestore indexes composite create \
     --collection-group=rag_memories \
     --query-scope=COLLECTION \
     --field-config=field-path=embedding,vector-config='{"dimension":768,"flat": "{}"}' \
     --field-config=field-path=userId,order=ASCENDING \
     --project=your-gcp-project-id
   ```

### 2. Environment Variables
Create a `.env` file in the project root and configure the following variables:

```env
# Server
PORT=8080

# GCP
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=asia-northeast1
GCP_TASK_QUEUE_NAME=rebecca-reply-queue
# Generate a Cloud Run URL after deployment and set it here
WORKER_URL=https://your-cloud-run-service-url.a.run.app

# X API (Free Plan or higher)
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

### 3. Local Execution & Testing
```bash
# Install dependencies
npm install

# Run tests (Unit, Integration with Mocks)
npm test

# Test chatting locally via CLI
npm run chat

# Run LLM-as-a-Judge Prompt Safety tests
npm run test:eval

# Manually trigger the Evolution batch (Collective Unconscious Extraction & Auditing)
npm run batch:evolution

# Manually trigger the News Proactive Post batch
npm run batch:news
```
*Note: To test webhooks locally, expose port 8080 using `ngrok` or similar tools and configure the Webhook URL in the X Developer Portal. (If you are on the X API Free Plan, the Account Activity API for webhooks might not be available. In that case, you may need to adjust the architecture to use polling instead.)*

### 4. Deployment
Use the provided deployment script to deploy the application to Cloud Run.
*Make sure to run `gcloud auth login` and `gcloud config set project [YOUR_PROJECT_ID]` beforehand.*

```bash
npm run deploy
```

## Simplified Architecture Diagram
1. [User] --(Mention)--> [X API] --(Webhook)--> [Cloud Run (Webhook Receiver)]
2. [Cloud Run] --(Enqueue 1-3min delay)--> [Cloud Tasks]
3. [Cloud Tasks] --(HTTP POST)--> [Cloud Run (Worker)]
4. [Cloud Run (Worker)] <--(Fetch/Save)--> [Firestore]
5. [Cloud Run (Worker)] <--(Generate)--> [Gemini API]
6. [Cloud Run (Worker)] --(Reply)--> [X API]

## Directory Structure
- `src/index.js` : Entry point
- `src/core/` : Core logic (Memory management, Context injection, Rate limiting)
- `src/services/` : External service integrations (Firestore, Gemini, X, Cloud Tasks)
- `src/config/` : Configuration and environment variables
- `tests/` : Unit and integration tests
- `scripts/` : Deployment and utility scripts

## License
This project is licensed under the [MIT License](LICENSE).

## Author
AKINA