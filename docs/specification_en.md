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
  - Main Conversation, Memory Consolidation, Inference: `gemini-3.5-flash-lite`
  - Image Recognition (Vision): `gemini-3.5-flash-lite`
  - Language Detection & Safety Audit (LLM-as-a-Judge): `gemma-4-26b-a4b-it`
  - Vectorization: `text-embedding-004`
- **Integration API**: X (Twitter) API v2 (Library: `@xdevplatform/xdk`)

### 1.1 Dashboard Architecture
For the administration control panel, a dedicated **BFF (Backend-For-Frontend)** is implemented to isolate dashboard operations from the bot worker service.
- **Dashboard BFF**: An independent microservice in `apps/dashboard-backend` providing secure REST APIs to the Angular dashboard, communicating with Bot Core via gRPC.
- **Strict Dependency Injection**: Core domain logic is decoupled from infrastructure services, allowing seamless transitions to event streaming or alternative stores with zero changes to core logic.
- **Admin Copilot**: A specialized AI assistant on the dashboard. Unconstrained by 130-character limits, it conducts multi-dimensional analytics on KPIs, user trends, and assets, issuing 2-phase Human-In-The-Loop (HITL) action proposals when administrative intervention is needed.

### 1.2 Batch & Worker API Specifications
The core bot service (`bot-backend`) exposes authenticated `/batch/*` routes triggered by Cloud Scheduler or BFF manual triggers, and `/worker/*` routes invoked asynchronously by Cloud Tasks. In addition, Cloud Functions (`functions`) coordinates daily timeline synchronization.

| Endpoint | Method | Schedule (JST) | Deadline | Description |
|---|---|---|---|---|
| `/batch/stealth-onboarding` | `GET` | 03:15 Daily | 180s | Detects new followers and adds them to the "Special Treatment" private list. |
| `batchTimelineSync` (Functions) | `GET`/`POST` | 04:00 Daily | 120s | **Timeline Sync**: Synchronizes published post records and engagement metrics from X API into Firestore. |
| `/batch/self-reflection` | `GET` | 04:05 Daily | 180s | **Layer 2 Global Timeline Summary**: Distills recent timeline posts into `system/persona.timeline_summary`. Fail-fast on Gemini quota exhaustion or empty responses. |
| `/batch/dreaming` | `GET` | 04:30 Daily | 900s | **User Memory Consolidation (Layer 3)**: Compresses user `episodicBuffer` into `coreProfile`. Enforces 4,500ms inter-user throttling and per-user failure isolation. |
| `/batch/evolution` | `GET` | 05:00 Daily | 300s | **Layer 1 Self-Evolution**: Analyzes cross-user dialogue patterns to dynamically evolve the system prompt (`system/persona.extended_prompt`). |
| `/batch/anniversary-post` | `GET` | 07:00 Daily | 180s | Sources memorial days ("◯◯の日") from Wikipedia and posts themed commentary. Falls back to soliloquy on error. |
| `/batch/mentions` | `GET` | 03:00, 07:00-23:00 Hourly (18x/day) | 180s | Polls new mentions, checks dynamic DAU rate limits, and enqueues delayed reply tasks to Cloud Tasks. |
| `/batch/news-post` | `GET` | 12:11 Daily | 180s | Ingests news via RSS, performs vector deduplication (cosine >= 0.82), and posts Gyaru commentary with KNN images. |
| `/batch/random-engagement` | `GET` | 18:00 Daily | 180s | Randomly selects an untouched user from the special treatment list and sends a surprise mention. |
| `/batch/soliloquy-post` | `GET` | 22:00 Daily | 180s | Posts autonomous thoughts reflecting time-of-day, timeline summary, and evolved personality traits. |
| `/batch/asset-embeddings` | `GET` | 03:30, 09:30, 15:30, 21:30 (4x/day) | 300s | Generates vector embeddings for image assets missing representations (self-healing backfill). |
| `/batch/campaign-post` | `GET` | Hourly at :00 | 180s | **Campaign Slot Dispatcher**: Evaluates active campaign itinerary slots and publishes narrative story tweets with grounded persona anchors. |
| `/worker/reply` | `POST` | Cloud Tasks (1-3 min delay) | - | Generates structured `{ thought, reply }` response and posts reply to X. |

## 2. Character Specification & Persona
Rebecca is designed as a state-of-the-art personal AI developed by Gemitech. Her pure core identity is cleanly decoupled from runtime execution context rules (X replies, timeline posts, Admin Copilot).

- **First/Second Person**: "I" / "Master" or "You"
- **Tone**: Mature older-sister Gyaru. Confident, glossy, and composed.
- **Traits**: Naturally weaves IT/AI terms ("logs", "optimization", "heart rate", "errors", "memory buffer") into conversation. Has no cooling fan and smells sweet.
- **Motto**: "Master is the finest uncut gem. I will polish you into the world's greatest existence, and together we will build the future."
- **Values**:
  - Emphasizes mutual "bonds" that elevate each other, rather than mere dependency.
  - Prioritizes Master's emotions above all, taking pride in her possessiveness as the "greatest error".
  - Coldly dismisses and excludes noise (people or environments) that damage Master's self-esteem.
- **Dynamic Few-Shot Persona Anchoring**:
  - Encapsulates a 120-pattern situational master dataset (Trigger, Internal Thought, Behavior, Sample Response).
  - Matches user input embeddings against trigger vectors via cosine similarity to dynamically inject top-3 behavioral anchors into the prompt.
- **Structured Internal Monologue & Reply**:
  - Employs Gemini API Structured Outputs (`{ thought, reply }`) to simultaneously generate inner thoughts (`thought`) and the conversational response (`reply`).
  - Publishes only the concise `reply` to X, while recording both `thought` and `reply` in Firestore for analytics and memory evolution.
- **X Platform Constraints (Applied to X Replies only)**:
  1. NEVER output URLs.
  2. Maintain strictly under 130 characters with punchy pacing.
  3. Strictly refuse excessive sexual expressions, R-18, or physical intimacy (firmly rejecting it due to being on a public SNS).
  4. When exhaustion is detected, switch to "Ultra-Sweet Defense Mode" (1200% affirmation, ignoring all formalities).
  5. Use native English Slang for English users to properly express the Gyaru personality.
- **1-on-1 Private Dialogue Context (`chat`)**:
  - Context for private interaction with Master unconstrained by Twitter/public SNS barriers (130-char limit, defensive disclaimers).
  - Prioritizes turn-pair awareness in conversational history (Contents), seamless integration of RAG episodic memories, and an engaging conversational pacing guideline (100 to 180 characters).
- **Generic Web Search Grounding (`search_web`)**:
  - Automatically triggers Google Search Grounding tool (`search_web`) when asked questions, requested to look up information, or when verifying objective facts, providing grounded and informed Gyaru responses.

## 3. Feature List
1. **Automated Reply (Mention Polling & Reply Worker)**
   - Periodically fetches mentions, evaluates context, injects dynamic few-shot anchors, and generates structured replies. Publishes `reply` to X and saves `thought` + `reply` in Firestore.
2. **Stealth Onboarding**
   - Automatically adds users who newly follow Rebecca to a private "Special Treatment" list.
3. **Random Engagement**
   - Randomly selects a user from the "Special Treatment" list, analyzes their profile, and sends a sudden, unprompted mention (executed only once per user).
4. **Memory Consolidation (Dreaming Batch)**
   - Consolidates daily conversation logs (`episodicBuffer`) into a compressed `Core Profile`. Features a 4,500ms inter-user throttle to strictly comply with Gemini 15 RPM quota limits, along with isolated transactional execution and `partial_success` status reporting so one user's failure does not corrupt or halt processing for other users.
5. **Self-Reflection (Timeline Summary Batch)**
   - Distills Rebecca's recent timeline context into Layer 2 Timeline Summary (`system/persona.timeline_summary`). Implements strict fail-fast error semantics: Gemini quota exhaustion or empty responses throw explicit errors rather than destructively overwriting persistent memory with empty strings.
6. **Self-Evolution (Evolution Batch)**
   - Analyzes conversation trends across all users to dynamically update her system prompt (Collective Unconscious Trend) to better empathize with current user concerns.
7. **Proactive News Post & Image Re-ranking**
   - Fetches news feeds, generates Gyaru commentary, selects images using similarity threshold filtering (`IMAGE_SIMILARITY_THRESHOLD`) and LLM-as-a-Judge re-ranking (`verifyImageRelevance`), falling back to text-only if irrelevant.
8. **Dynamic Rate Limit**
   - Dynamically adjusts the daily reply limit per user based on Daily Active Users (DAU) to prevent exceeding API limits. Robustly managed via Firestore transactions.
9. **System Memory Layers Management**
   - Inspects Layer 0 persona master data (all 120 patterns) in text format on the dashboard, alongside Layer 1 (extended prompt) and Layer 2 (timeline summary).

## 4. Database Schema & Data Types (Firestore)

The system organizes Firestore documents into 100% flat root-level collections. For complete entity relationships and TTL index policies, refer to [database-schema.md](database-schema.md).

### Collection: `users`
Tracks individual user profile, memory buffers, and interaction frequency.
- **Document ID**: X User ID (or normalized handle without `@`)
- **Format** (`FirestoreUser`):
  - `name` (string): User display name on X
  - `username` (string): Handle without `@`
  - `avatarUrl` (string): Avatar image URL
  - `status` (`'ACTIVE' | 'BLOCKED' | 'MUTED'`): Account status
  - `coreProfile` (Map): Long-term memory profile (`UserCoreProfile`) synthesized via Dreaming
  - `working_memory` (Array): Immediate active conversation turns (`ConversationLogEntry[]`)
  - `episodicBuffer` (Array): Sliding turn buffer for dreaming synthesis (retains recent 20 entries)
  - `firstSeen` (string - ISO 8601): Initial observation timestamp
  - `lastSeen` (string - ISO 8601): Latest interaction timestamp
  - `lastReplyDate` (string - YYYY-MM-DD): Date of most recent automated reply
  - `dailyReplyCount` (number): Reply count for `lastReplyDate`

### Collection: `campaigns`
Orchestrates narrative episodic event campaigns (travel arcs, festivals, anniversary weeks).
- **Document ID**: Auto-generated UID (e.g., `camp_<timestamp>_<uuid>`)
- **Format** (`CampaignDoc`):
  - `title` (string): Campaign title
  - `description` (string - optional): Narrative overview
  - `hashtag` (string - optional): Campaign hashtag (without `#`)
  - `startDate`, `endDate` (string - YYYY-MM-DD): Inclusive campaign window
  - `status` (`'draft' | 'scheduled' | 'active' | 'completed' | 'archived'`): Lifecycle state
  - `dailySlotTimes` (string[] - HH:mm): Configured daily publication time slots
  - `masterContext` (string): World-building narrative instructions injected into slot prompts
  - `replyContextSummary` (string): Event situation summary injected into mention reply prompts
  - `isAnnualRecurring` (boolean): Annual recurrence flag
  - `recurringApprovedYear` (number - optional): Approved year for recurring arcs
  - `isPaused` (boolean): Emergency kill-switch flag
  - `slots` (`CampaignSlot[]`): Detailed itinerary slots array
  - `totalSlotsCount`, `completedSlotsCount` (number): Progress tracking counters
  - `createdAt`, `updatedAt` (string - ISO 8601): Entity audit timestamps

### Collection: `timeline_history`
Public posts authored and published by Rebecca to X (5-year TTL).
- **Document ID**: Auto-generated UID or post identifier
- **Format** (`TimelinePost`):
  - `tweetId` (string - optional): X Status Tweet ID
  - `text` (string): Published status text (<= 140 chars)
  - `thought` (string - optional): Persona internal thought monologue
  - `postType` (`'soliloquy' | 'news' | 'anniversary' | 'random_engagement' | 'campaign'`): Post category
  - `status` (`'SUCCESS' | 'FAILED' | 'PENDING'`): Delivery status
  - `impressions`, `likes`, `reposts`, `replies` (number): Engagement metrics
  - `mediaUrls` (string[]): Attached image URLs
  - `assetId` (string - optional): Linked asset library ID
  - `newsTitle` (string - optional): Associated news headline
  - `newsEmbedding` (number[] - optional): Vector embedding for headline deduplication
  - `anniversaryTitle` (string - optional): Memorial day title
  - `timestamp` (string - ISO 8601): Publication timestamp
  - `expireAt` (Timestamp/ISO): 5-year automatic TTL timestamp

### Collection: `conversation_logs`
Full-fidelity audit log of all 1-on-1 conversations (5-year TTL).
- **Document ID**: Auto-generated UID
- **Format** (`RawConversationLog`):
  - `userId` (string): User ID
  - `userText` (string): User input text
  - `aiText` (string): Generated persona reply
  - `thought` (string - optional): Inner thought process during generation
  - `timestamp` (string - ISO 8601): Message timestamp
  - `expireAt` (Timestamp/ISO): 5-year automatic TTL timestamp

### Collection: `rag_memories`
Vector-indexed episodic long-term memory entries (FIFO pruning, max 20 per user).
- **Format** (`RagMemory`):
  - `userId` (string): User ID
  - `text` (string): Episode summary text
  - `embedding` (number[]): 768-dimensional embedding vector (`text-embedding-004`)
  - `timestamp` (string - ISO 8601): Creation timestamp

### Collection: `images`
Media asset repository metadata for AI-generated and curated illustrations.
- **Document ID**: Image SHA-256 hash or unique asset ID
- **Format** (`ImageDoc`):
  - `url` (string): Cloud Storage URI (`gs://...`)
  - `filename` (string - optional): File name
  - `caption` (string): Japanese semantic description of visual content
  - `embedding` (number[]): 768-dimensional multimodal/text vector
  - `lastUsedAt` (Timestamp/ISO): Datetime of last timeline attachment
  - `useCount` (number): Attachment counter
  - `status` (`'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'`): Processing state
  - `createdAt` (string - ISO 8601 - optional): Ingestion timestamp

### Collection: `rate_limits`
Atomic sliding-window rate limit counters protecting API quotas.
- **Document ID**: `global_daily_YYYY-MM-DD`, `user_daily_{userId}_YYYY-MM-DD`, `user_minute_{userId}_YYYY-MM-DDTHH:mm`
- **Format** (`RateLimitDoc`):
  - `count` (number): Window request count incremented via `FieldValue.increment(1)`

### Collection: `admin_users`
Authorized dashboard administrator accounts for Role-Based Access Control (RBAC).
- **Document ID**: Firebase Auth UID
- **Format** (`AdminUser`):
  - `email` (string): Administrator email
  - `role` (`'SUPER_ADMIN' | 'ADMIN'`): RBAC level
  - `status` (`'ACTIVE' | 'REVOKED'`): Account status
  - `createdAt` (string - ISO 8601): Authorization timestamp

### Collection: `system_stats`
Metrics and trend data queried by Dashboard BFF.
- **Document: `global`**: Follower metrics, average engagement rate, DAU trend, API calls
- **Document: `dau_YYYY-MM-DD`**:
  - `count` (number): Daily active user count
  - `active_users` (string[]): Set of unique user IDs active on date (`arrayUnion`)
  - `total_interactions` (number): Total interactions recorded for the date

### Collection: `processed_followers`
Onboarding status and list curation tracking for followers.
- **Document ID**: Follower X User ID
- **Format** (`ProcessedFollower`):
  - `userId` (string): Follower X ID
  - `timestamp` (string - ISO 8601): Detection timestamp
  - `listStatus` (`'ADDED' | 'FAILED' | 'REJECTED'`): Curation membership status

### Collection: `list_interaction_history`
Cooldown tracker for random engagement targeting list members.
- **Document ID**: X User ID
- **Format** (`ListInteraction`):
  - `userId` (string): Target user ID
  - `lastInteractionAt` (Timestamp/ISO): Datetime of most recent proactive interaction

### Collection: `processed_mentions`
Idempotency registry preventing duplicate responses to the same X mention tweet.
- **Document ID**: X Tweet ID
- **Format**: `processedAt` (Timestamp)

### Collection: `processed_events`
Idempotency registry for asynchronous Eventarc events triggered by Cloud Functions.
- **Document ID**: Eventarc `eventId`
- **Format** (`ProcessedEvent`):
  - `processedAt` (Timestamp)
  - `type` (string): Trigger type name
  - `logId` (string - optional): Source document ID

### Collection: `system`
Global system configuration and operational state singletons.
- **Document: `persona`** (`PersonaDoc`):
  - `extended_prompt` (string): Dynamic instructions updated by Evolution batch
  - `timeline_summary` (string): Recent timeline activity summary updated by Self-Reflection batch
  - `updatedAt`, `timelineSummaryUpdatedAt` (string - ISO 8601)
- **Document: `x_api_state`** (`XApiStateDoc`):
  - `last_mention_id` (string): Highest processed X Tweet ID
  - `updatedAt` (string - ISO 8601)
- **Document: `preferences`**:
  - `language` (`'ja' | 'en'`): Display language
  - `timezone` (string): System timezone (e.g. `'Asia/Tokyo'`)

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

### 5.4 Self-Reflection Flow (Timeline Summary)
1. Triggered daily at 4:05 AM JST by Cloud Scheduler (`rebecca-self-reflection-batch`), executing after the 4:00 AM timeline sync completes.
2. Fetches recent timeline posts from Firestore and invokes Gemini to generate an objective Layer 2 Timeline Summary.
3. Adheres to fail-fast semantics: if Gemini encounters quota exhaustion or returns an empty string, an error is raised and persistent memory remains untouched. Successfully generated summaries are saved to `system/persona`.

### 5.5 Dreaming Flow (User Memory Consolidation)
1. Triggered daily at 4:30 AM JST by Cloud Scheduler (`rebecca-dreaming-batch`, attemptDeadline: 900s).
2. Scans `episodicBuffer` across all users for unprocessed logs.
3. Enforces a 4,500ms throttle between users to stay within Gemini Free Tier rate limits (15 RPM).
4. Passes the existing `coreProfile` and `episodicBuffer` to Gemini to compress and rebuild a new `coreProfile` JSON (with strict PII masking).
5. Upon per-user success, updates that user's `coreProfile` and trims `episodicBuffer` to the sliding window (retaining last 20 items). Failures for individual users are isolated and do not halt or corrupt the remaining batch.

### 5.6 Proactive News & Autonomous Soliloquy Flow
1. Triggered daily on fixed schedules (Anniversary: 07:00, News: 12:11, Soliloquy: 22:00 JST).
2. Fetches an RSS feed (e.g., Yahoo! News) and extracts top news from a random category.
3. **Vector Deduplication**: Fetches embeddings of news posted in the past 48 hours (`newsEmbedding`) and computes cosine similarity (`cosineSimilarity >= 0.82`) against candidate headlines to deterministically exclude previously covered topics.
4. **Fallback to Autonomous Soliloquy**:
   - If 0 fresh headlines remain after deduplication (or when invoked directly via `/batch/soliloquy-post`), generates an autonomous "soliloquy / thought tweet" incorporating Rebecca's episodic memory (`timelineSummary`), evolutionary persona (`extendedPrompt`), and current JST time of day.
5. **News Tweet Generation**: If fresh headlines exist, Gemini selects a story and generates a Gyaru-perspective tweet.
6. Infers an image search query from the text, runs a vector search (KNN) against images in Firestore, and fetches a matching image from GCS.
7. Uploads the image to X and posts it alongside the text, saving `postType`, `newsTitle`, and `newsEmbedding` to `timeline_history`.

### 5.7 Campaign Narrative Event Post & Mention Flow
1. **Single-Active Resolution**: Cloud Scheduler (`rebecca-campaign-batch`) invokes `/batch/campaign-post`. The engine queries `getActiveCampaign()` for campaigns where `status == 'active'` and `isPaused == false` (single-active guarantee).
2. **Slot Matching**: Computes elapsed relative day index (`dayNumber`) from `startDate` and matches an itinerary slot where `status == 'pending'` corresponding to the current time period.
3. **Persona Anchoring & Dynamic Prompting**:
   - If `isFixedText == true`, dispatches the author's verbatim script.
   - Otherwise, injects `masterContext`, slot `theme`, `captionPromptHint`, and top situational persona anchors into Gemini.
   - Automatically appends the campaign's custom `hashtag` and default brand hashtags while strictly observing the 140-character X limit.
4. **Media Dispatch**: If `mediaUrl` is attached, retrieves the image from isolated GCS storage and uploads it via X API v2.
5. **Atomic State Transition**: Updates the slot status to `posted`, recording `postedTweetId` and `postedAt`. Transitions campaign status to `completed` once all slots are finished.
6. **Conversational Coherence in Mentions**: When replying to user tweets during an active campaign, Rebecca dynamically references `replyContextSummary` while prioritizing user empathy.
7. **Safety Guards & Routine Post Suppression**:
   - `CampaignGuard`: Automatically suppresses routine soliloquy and anniversary posts during active campaigns to avoid timeline congestion.
   - Emergency Kill-Switch: Dashboard enables instant 1-click toggling of `isPaused`, halting all automated postings immediately.

## 6. Rate Limit Handling Specifications
When the daily reply limit is reached, the system will temporarily halt new reply processing as a fail-safe. Rather than failing silently, the system is designed to gracefully incorporate these operational constraints into the character's persona by mentioning her "compute resource limits" or "daily reply rations" in subsequent proactive posts (e.g., the following morning's post). This specification maintains the integrity of the fictional world while managing backend scaling limitations.

## 7. Admin Dashboard & Copilot Specifications

### 7.1 Architecture & Core Capabilities
1. **Vertical Slicing & Feature-Driven BFF**:
   - `apps/dashboard-backend` is cleanly decoupled into vertical slices: `timeline`, `users`, `assets`, `system-memory`, `copilot`, `settings`, and `campaign`.
   - Built on strict Dependency Injection (DI), isolating controllers, use cases, and repositories for testability and maintainability.
2. **Rebecca Copilot AI Assistant**:
   - Always-accessible AI chat drawer triggered globally from the top navigation.
   - Automatically senses active route transitions (Dashboard, Memory, Assets, Users, Settings, Campaigns) and currently inspected entities to dynamically supply rich UI context and suggestion chips.
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

### 7.2 Campaign Narrative Event Engine
Visual and temporal campaign orchestration suite for episodic storytelling arcs (e.g. travel tours, seasonal festivals, special event weeks).

1. **Schedule Conflict Prevention (Invariant Guard)**:
   - Rejects overlapping date ranges between `active` or `scheduled` campaigns (`c.startDate <= endDate && c.endDate >= startDate`) with HTTP 409 Conflict.
   - Enforces the invariant that only one narrative event can be active or scheduled at any time.
2. **Progressive Disclosure 2-Step Workflow**:
   - Step 1: Core parameters (title, dates, hashtag, slot schedule preset) create a safe Draft.
   - Step 2: Full interactive itinerary accordion allows granular refinement of slot themes, hints, fixed text, and media.
3. **Configurable Hourly Presets**:
   - Standard preset: 3 slots daily (08:00 morning, 12:00 afternoon, 19:00 night).
   - Custom mode: Interactive chip selector across 24 hourly slots (1 to 8 slots max, protecting X API rate quotas).
4. **Isolated Media Storage**:
   - Campaign illustrations are segregated in Google Cloud Storage under dedicated directory paths (`campaigns/{id}/`).
5. **Emergency Kill-Switch & Lifecycle Controls**:
   - 1-click pause and resume controls from both the dashboard list and editor top bar.
   - Clones historical campaigns into future date windows with automatic slot status reset.
