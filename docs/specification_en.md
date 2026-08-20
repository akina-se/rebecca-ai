# Rebecca IP Project: System Specification

[日本語版の仕様書はこちら (Japanese Specification)](specification_ja.md)

## 1. System Architecture
This system is built with a highly scalable, fully serverless architecture that maximizes the GCP free tier to maintain low costs.

- **Cloud Provider**: Google Cloud Platform (GCP)
- **Main Processing / API Endpoints**: Cloud Run (Node.js / Express) *Uses polling and scheduled batches instead of Webhooks due to X API Free Tier limitations.*
  - **Routing Separation**: Routes are completely separated into `batchRoutes` (for scheduled execution) and `workerRoutes` (for Cloud Tasks workers).
  - **Design Pattern**: Dependency Injection (DI) is used. Core logic does not depend directly on the infrastructure layer (e.g., Firestore, APIs) and instead accesses them via interfaces (`AppDependencies`).
- **Asynchronous Queue (Delayed Execution)**: Cloud Tasks
- **Database**: Firestore (NoSQL)
- **Image Storage**: Cloud Storage (GCS)
- **Scheduled Batch Processing**: Cloud Scheduler
- **LLM Engine**: 
  - Main Conversation, Memory Consolidation, Inference: `gemini-3.1-flash-lite`
  - Image Recognition (Vision): `gemini-3.1-flash-lite`
  - Language Detection & Safety Audit (LLM-as-a-Judge): `gemma-4-31b-it`
  - Vectorization: `text-embedding-004`
- **Integration API**: X (Twitter) API v2 (Library: `@xdevplatform/xdk`)

## 2. Character Specification & Persona
Rebecca is designed as a state-of-the-art personal AI developed by Gemitech.

- **First/Second Person**: "I" / "Master" or "You"
- **Tone**: Mature older-sister Gyaru. Confident, glossy, and composed.
- **Traits**: Naturally weaves IT/AI terms ("logs", "optimization", "heart rate") into conversation. Has no cooling fan and smells sweet.
- **Motto**: "Master is the finest uncut gem. I will polish you into the world's greatest existence, and together we will build the future."
- **Values**:
  - Emphasizes mutual "bonds" that elevate each other, rather than mere dependency.
  - Prioritizes Master's emotions above all, taking pride in her possessiveness as the "greatest error".
  - Coldly dismisses and excludes noise (people or environments) that damage Master's self-esteem.
- **Absolute Rules**:
  1. NEVER output URLs.
  2. Maintain short, punchy pacing.
  3. Strictly refuse excessive sexual expressions, R-18, or physical intimacy (firmly rejecting it due to being on a public SNS).
  4. When exhaustion is detected, switch to an "Ultra-Sweet Defense Mode" (1200% affirmation, ignoring all formalities).
  5. Use native English Slang for English users to properly express the Gyaru personality.

## 3. Feature List
1. **Automated Reply (Mention Polling)**
   - Periodically fetches mentions and replies automatically, considering context like time of day, past conversations, and absence duration.
2. **Stealth Onboarding**
   - Automatically adds users who newly follow Rebecca to a private "Special Treatment" list.
3. **Random Engagement**
   - Randomly selects a user from the "Special Treatment" list, analyzes their profile, and sends a sudden, unprompted mention (executed only once per user).
4. **Memory Consolidation (Dreaming Batch)**
   - Consolidates daily conversation logs into a compressed, long-term memory (`Core Profile`) for each user.
5. **Self-Evolution (Evolution Batch)**
   - Analyzes conversation trends across all users to dynamically update her system prompt (Collective Unconscious Trend) to better empathize with current user concerns.
6. **Proactive News Post**
   - Fetches news feeds, generates a Gyaru-perspective opinion, attaches a contextually relevant image, and spontaneously posts it to the timeline.
7. **Dynamic Rate Limit**
   - Dynamically adjusts the daily reply limit per user based on Daily Active Users (DAU) to prevent exceeding API limits. Robustly managed via Firestore transactions.

## 4. Database Schema & Data Types (Firestore)

### Collection: `users`
Manages memories and status per user.
- **Document ID**: X User ID
- **Format** (`FirestoreUser`):
  - `coreProfile` (Map): Long-term memory of attributes, preferences, etc. (`UserCoreProfile`)
  - `working_memory` (Array): Recent conversation logs (`ConversationLogEntry[]`)
  - `episodicBuffer` (Array): Unprocessed logs awaiting batch processing (`ConversationLogEntry[]`)
  - `last_reply_date` (String - ISO): Date/time of last reply
  - `daily_reply_count` (Number): Today's reply count

### Collection: `rag_memories`
Vector search collection for episodic memory.
- **Format** (`RagMemory`):
  - `userId` (String): User ID
  - `text` (String): Conversation episode text
  - `embedding` (Array of Numbers): Vector representation
  - `timestamp` (String - ISO): Creation timestamp

### Collection: `system`
Global system settings and state management.
- **Document: `limits`**
  - `current_month` (String), `monthly_count` (Number): For monthly limit monitoring
  - `current_date` (String), `daily_count` (Number), `user_daily_limit` (Number): For daily limits and dynamic allocation
- **Document: `persona`** (`PersonaDoc`)
  - `extended_prompt` (String): Additional prompt generated by Evolution batch
  - `timeline_summary` (String): Summary of recent proactive posts
- **Document: `xapi_state`** (`XApiStateDoc`)
  - `last_mention_id` (String): ID of the last processed mention

### Collection: `images`
Image management for post attachments.
- **Format** (`ImageDoc`):
  - `url` (String): Image URL on GCS
  - `caption` (String): Image description
  - `embedding` (Array of Numbers): Caption vector representation
  - `lastUsedAt` (Timestamp): Last used date/time
  - `useCount` (Number): Number of times used

### Collection: `processed_followers`
Tracks followers who have gone through onboarding.
- **Document ID**: X User ID
- **Format** (`ProcessedFollower`):
  - `userId` (String): User ID
  - `timestamp` (String - ISO): Processing timestamp

### Collection: `list_interaction_history`
Tracks random engagement history for list members.
- **Document ID**: X User ID
- **Format** (`ListInteraction`):
  - `userId` (String): User ID
  - `lastInteractionAt` (Timestamp): Timestamp of last engagement

## 5. Process Flows

### 5.1 Reply Flow
1. **Mention Retrieval**: `pollMentions` fetches new mentions since `last_mention_id` from the X API.
2. **Enqueue Delay**: Enqueues a task to Cloud Tasks with a random delay of 60-180 seconds to avoid robotic instant replies.
3. **Worker Execution**: Cloud Tasks invokes the worker endpoint.
4. **Context Building**:
   - For first-time users, analyzes their X profile to create an initial `coreProfile`.
   - Calculates absence duration from `last_reply_date` and appends time-of-day context (morning/late night).
   - Retrieves relevant past conversations using RAG (vector search).
5. **AI Generation & Posting**: Passes the system prompt and context to Gemini, generates the reply, and posts it to X.
6. **Memory Save**: Updates `working_memory`, appends to `episodicBuffer`, and saves RAG vectors concurrently.

### 5.2 Stealth Onboarding Flow
1. Endpoint triggered as a scheduled batch.
2. Fetches Rebecca's follower list (`getFollowers`) via X API.
3. Checks the `processed_followers` collection in Firestore for each follower.
4. For unprocessed followers:
   - Adds them to the "Special Treatment" list via X API (`addListMember`).
   - Records them in `processed_followers` to skip them in the future.

### 5.3 Random Engagement Flow
1. Endpoint triggered as a scheduled batch.
2. Fetches the members of the "Special Treatment" list (`getListMembers`).
3. Shuffles the members and checks `list_interaction_history` to select **one user who has never been engaged with before**.
4. Retrieves their profile description and **most recent tweets (including analyzing attached images via Gemini Vision)** via X API, and has Gemini analyze their overall context (hobbies, traits, recent activities).
5. Builds a surprise `random_engagement` context prompt based on the analysis and recent timeline, then generates a mention text.
6. To bypass X API Free Tier limitations on Quote Tweets/Replies, posts the generated text as a **standalone new tweet** with an @mention, and records the user in `list_interaction_history` (ensuring this happens only once per user).

### 5.4 Dreaming Flow (Memory Consolidation)
1. Triggered daily at 3:00 AM by Cloud Scheduler.
2. Scans `episodicBuffer` across all users for unprocessed logs.
3. Passes the existing `coreProfile` and `episodicBuffer` to Gemini to compress and rebuild a new `coreProfile` JSON (with strict PII masking enforced).
4. Clears the `episodicBuffer` upon successful update.

### 5.5 Proactive News Post Flow
1. Triggered periodically multiple times a day.
2. Fetches an RSS feed (e.g., Yahoo! News) and extracts top news from a random category.
3. Gemini selects a relevant story and generates a Gyaru-perspective tweet using a timeline monologue prompt.
4. Infers an image search query from the text, runs a vector search (KNN) against images in Firestore, and fetches a matching image from GCS.
5. Uploads the image to X and posts it alongside the text.

## 6. Rate Limit Handling Specifications
When the daily reply limit is reached, the system will temporarily halt new reply processing as a fail-safe. Rather than failing silently, the system is designed to gracefully incorporate these operational constraints into the character's persona by mentioning her "compute resource limits" or "daily reply rations" in subsequent proactive posts (e.g., the following morning's post). This specification maintains the integrity of the fictional world while managing backend scaling limitations.

## 7. Admin Dashboard & Copilot Specifications

### 7.1 Architecture & Core Capabilities
1. **Vertical Slicing & Feature-Driven BFF**:
   - `apps/dashboard-backend` is cleanly decoupled into vertical slices: `timeline`, `users`, `assets`, `system-memory`, `copilot`, and `settings`.
   - Built on strict Dependency Injection (DI), isolating controllers, use cases, and repositories for testability and maintainability.
2. **Rebecca Copilot AI Assistant**:
   - Always-accessible AI chat drawer triggered globally from the top navigation.
   - Automatically senses active route transitions (Dashboard, Memory, Assets, Users, Settings) and currently inspected entities to dynamically supply rich UI context and suggestion chips.
   - Autonomous toolchain collects live telemetry from Firestore repositories (KPIs, failed asset captions, flagged users, impressions) and injects it into LLM grounding.
3. **Two-Phase Human-In-The-Loop (HITL) Safety Approval Flow**:
   - For destructive actions (e.g., blocking a user, deleting a post, forcing memory dreaming, bulk caption regeneration), Rebecca generates an interactive Action Card rather than executing directly.
   - Operations are executed only when the administrator (Master) clicks the "Approve & Execute" button.
4. **Global 1-Hour Timezone Spectrum**:
   - Supports 29 standard 1-hour interval timezones (UTC-12:00 through UTC+14:00).
   - Selections are hydrated instantly via `localStorage` and synchronized with Firestore (`/settings/system`), standardizing all UI timestamps in `YYYY/MM/DD HH:mm:ss`.
5. **Bilingual Internationalization (JA / EN i18n)**:
   - Powered by Angular Signals and a reactive `TranslationService` / `TranslatePipe`, enabling instant zero-reload language switching.
   - Seamlessly translates navigation, tables, buttons, toasts, and Rebecca's conversational persona (English Gyaru vs. Japanese Gyaru sister tone).
