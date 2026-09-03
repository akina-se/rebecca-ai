# Rebecca Bot Backend (`bot-backend`)

The `bot-backend` is the core execution engine of Rebecca AI, operating as a serverless worker. It interacts with the X (Twitter) API, manages user engagement cycles, schedules periodic news and onboarding tasks, and processes background memory consolidation (Dreaming).

---

## Core Features & Algorithms

### 1. Triple-Buffer Memory System
Rebecca implements a multi-tiered memory architecture to keep prompts highly relevant while maintaining computational cost efficiency:
- **Layer 0 (Core Persona Prompt)**: Immutable, hardcoded prompt defining Rebecca's core identity, gyaru slang, and social rules. Loaded directly from `@rebecca/persona`.
- **Layer 1 (Extended Persona Tuning)**: Dynamic behavioral tunings. Updated automatically by the background "Dreaming" process based on recent timeline trends and sentiment logs.
- **Layer 2 (Global Timeline Summary)**: Dynamic global summary of what Rebecca has posted, providing a shared context of her timeline.
- **Episodic Buffer**: Short-term conversation history (last few turns) injected directly into the user reply context.
- **Vector Memory (RAG)**: Long-term memory fragments retrieved via semantic vector searches on user-specific fragments.

### 2. Context Injection Rules
Prompt contexts are dynamically modified before sending requests to the Gemini API:
- **Time-of-day**: Special tone adjustments for morning (energetic) or late-night (sleepy/intimate).
- **User Absence**: Detects if a user has been inactive for several days and changes the greeting tone (e.g., teasing or expressing worry).
- **Keyword Triggers**: Injects specific comfort responses when keywords like "overtime", "boss", or "tired" are detected.

### 3. Proactive News Deduplication & Autonomous Soliloquy Mode
- **Vector-based Deduplication**: Before posting news headlines from RSS feeds, candidate headlines are vectorized and compared via cosine similarity against news posted within the lookback window (`NEWS_DEDUP_LOOKBACK_DAYS`, default 30 days). Headlines exceeding `NEWS_DEDUP_SIMILARITY_THRESHOLD` (default 0.82) are deterministically excluded.
- **Autonomous Soliloquy Fallback & Scheduled Posts**: If zero fresh news headlines remain after deduplication, or when invoked directly via `/batch/soliloquy-post` (or scheduled via Cloud Scheduler), Rebecca generates spontaneous daily thoughts and Master-affirming messages based on her episodic timeline memory (`timelineSummary`), self-evolution traits (`extendedPrompt`), and `APP_TIMEZONE` time-of-day greeting context.
- **Unified Timeline Publishing**: Both news and soliloquy posts share a common pipeline (`timelinePublisher.ts`) that infers emotional context, matches asset images via vector search, uploads media, tweets, and records metadata in `timeline_history`.

### 4. Proactive Image Attachment & Vision
- Automatically analyzes uploaded graphics using `gemini-3.1-flash-lite` (Vision mode) and generates alt-text metadata.
- Alt-text captions are vectorized using `text-embedding-004` and stored in Firestore.
- Proactive timeline updates query these embeddings using Firestore Vector Search (KNN) to attach contextually relevant images to auto-generated posts.

---

## Internal gRPC API Specification

`bot-backend` exposes a gRPC server on port `50051` to allow internal administration tools (like `dashboard-backend` BFF) to trigger administrative commands.

The Protocol Buffers contract is defined in [`packages/grpc-schemas/tweets.proto`](../../packages/grpc-schemas/tweets.proto).

### `TweetService`

#### `DeleteTweet`
Request: `DeleteTweetRequest`
- `tweet_id` (string): The physical tweet ID on X to delete.

Response: `DeleteTweetResponse`
- `success` (bool): Deletion success status.
- `message` (string): Feedback message.

---

## CLI Development Scripts

The following helper scripts are available to developers for manual maintenance and local CLI simulation:

| Script Command | Description |
|---|---|
| `npm run dev` | Starts the worker server locally with hot-reloading |
| `npm run chat` | Opens an interactive local terminal chat session simulating Rebecca |
| `npm run simulate` | Simulates X timeline mentions and prints Rebecca's mock replies |
| `npm run batch:evolution` | Triggers the daily "Dreaming" memory compression batch |
| `npm run batch:news` | Triggers timeline news lookup & posting batch |
| `npm run batch:onboard` | Triggers greeting messages to newly configured users |
| `npm run batch:engage` | Runs proactive engagement targeting list members |
| `npm run tool:upload-images` | Bulk uploads local images to GCS and triggers captioning |

---

## Environment Variables

Configure these variables in your local `.env` or deployment configuration:

```env
# Server settings
PORT=8080
APP_TIMEZONE=Asia/Tokyo

# News Deduplication
NEWS_DEDUP_LOOKBACK_DAYS=30
NEWS_DEDUP_SIMILARITY_THRESHOLD=0.82

# Secrets & Keys
BATCH_SECRET_KEY=your-secret-key-for-batch-verification
GEMINI_API_KEY=your-google-gemini-api-key

# GCP Configuration
GCP_PROJECT_ID=rebecca-ai-gal-local
GCP_LOCATION=asia-northeast1
IMAGE_BUCKET_NAME=rebecca-ai-gal-images

# X (Twitter) API Keys
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
X_MY_USER_ID=
```
