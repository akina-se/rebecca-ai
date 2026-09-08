# Firestore Database Schema & 3-Tier Memory Architecture

## 1. Overview & Architectural Principles

This document defines the schema, indexing strategy, data lifecycle, and multi-tier memory architecture for **Rebecca AI**.

### Core Tenets
1. **Single Source of Truth (SSOT)**:
   - TypeScript interface definitions reside in `@rebecca/types` (`packages/types/src/index.ts`).
   - Collection names and `FirestoreDataConverter<T>` instances reside in `@rebecca/db` (`packages/db/src/index.ts`).
2. **Framework & Driver Agnostic Models**:
   - Application domain models never directly import `@google-cloud/firestore` or `firebase-admin/firestore`.
   - Date and time representations in domain models are strictly serialized as **ISO 8601 strings** (`YYYY-MM-DDTHH:mm:ss.sssZ`).
   - The `@rebecca/db` converter layer bridges disk representations (such as Firestore `Timestamp` or `VectorValue`) with memory models.
3. **Security by Default**:
   - `firestore.rules` enforces `allow read, write: if false;` for all direct client requests.
   - All database reads and writes are gated through authenticated microservices (Cloud Run, Cloud Functions) executing under least-privilege IAM service accounts.

---

## 2. 3-Tier Conversational Memory Architecture

Rebecca AI implements a hierarchical 3-tier memory model inspired by human cognitive memory systems, ensuring temporal consistency, continuity, and scalable storage:

```
+-----------------------------------------------------------------------------------------+
|                                    1. Working Memory                                    |
|  - Source: users.working_memory / recent turns in Gemini contents                      |
|  - Scope: Immediate active turn dialogue (0 to 10 minutes)                               |
|  - Format: [YYYY-MM-DD HH:mm JST] Role: Text                                            |
|  - Role: Strict turn-by-turn conversational grounding & relative temporal queries       |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                                  2. Episodic Buffer                                     |
|  - Source: users.episodicBuffer                                                         |
|  - Scope: Recent session history (retains 10 turn-pairs / 20 entries)                   |
|  - Lifecycle: Pruned via Dreaming; retains sliding window of 20 entries                 |
|  - Role: Bridge between short-term dialogue and long-term character consolidation       |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v (Synthesized by Dreaming)
+-----------------------------------------------------------------------------------------+
|                                    3. Long-term Memory                                  |
|  A. Core Profile (users.coreProfile)                                                    |
|     - Semantic consolidation of preferences, attributes, concerns, and facts            |
|     - Injected into System Prompt as JSON schema                                        |
|                                                                                         |
|  B. RAG Memory (rag_memories)                                                           |
|     - Vector-indexed episodic memories (768-dim embeddings, text-embedding-004)         |
|     - Filtered by userId with findNearest cosine similarity                             |
|     - Stored with explicit ISO timestamp; formatted as [YYYY-MM-DD HH:mm JST] in prompt|
|     - Maximum capacity: 20 memories per user (FIFO pruning on new inserts)              |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Collections Reference

### 3.1 `users`
Primary user document containing identity, affinity metrics, rate limits, and conversational buffers.

- **Document ID**: User's X User ID or Handle (normalized without `@`).
- **Converter**: `userConverter` in `@rebecca/db`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (matches document ID). |
| `name` | `string` | User's display name on X. |
| `username` | `string` | User's handle (without `@`). |
| `avatarUrl` | `string` | Profile image URL (or avatar fallback). |
| `status` | `'ACTIVE' \| 'BLOCKED' \| 'MUTED'` | Account lifecycle status. |
| `coreProfile` | `UserCoreProfile` (object) | Evolving character knowledge base synthesized via Dreaming. |
| `working_memory` | `ConversationLogEntry[]` | Ephemeral active memory buffer. |
| `episodicBuffer` | `ConversationLogEntry[]` | Sliding turn buffer for dreaming synthesis. Retains 20 items. |
| `firstSeen` | `string` (ISO 8601) | Timestamp of first observed interaction. |
| `lastSeen` | `string` (ISO 8601) | Timestamp of latest interaction. |
| `lastReplyDate` | `string` (`YYYY-MM-DD`) | Date of most recent automated reply (for daily quotas). |
| `dailyReplyCount` | `number` | Counter of automated replies issued on `lastReplyDate`. |
| `affinityScore` | `number` (float 0.0 - 1.0) | Calculated affinity/intimacy metric with Rebecca. |
| `interactions` | `number` | Cumulative lifetime interaction count. |

#### Sub-structure: `ConversationLogEntry`
```typescript
interface ConversationLogEntry {
  role: 'user' | 'model';
  content: string;
  thought?: string;     // Inner thought of the persona during reply generation
  timestamp?: string;   // ISO 8601 UTC timestamp
}
```

---

### 3.2 `rag_memories`
Vector-indexed episodic long-term memory entries for retrieval-augmented generation.

- **Document ID**: Auto-generated UID.
- **Converter**: `ragMemoryConverter` in `@rebecca/db`.
- **Vector Index**: 768 dimensions, Cosine distance, queryScope `COLLECTION`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | Target user ID (indexed for user-scoped filtering). |
| `text` | `string` | Memory text representation / episode summary. |
| `embedding` | `VectorValue` (`number[]`) | 768-dimensional embedding vector (`text-embedding-004`). |
| `timestamp` | `string` (ISO 8601) | Original interaction datetime (indexed ascending). |

---

### 3.3 `conversation_logs`
Full-fidelity audit log of all raw 1-on-1 conversations between users and Rebecca.

- **Document ID**: Auto-generated UID.
- **Converter**: `conversationLogConverter` in `@rebecca/db`.
- **TTL**: Managed by Cloud Firestore TTL policy on `expireAt`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | User's unique identifier. |
| `userText` | `string` | User input message. |
| `aiText` | `string` | Generated persona reply text. |
| `thought` | `string \| null` | Model internal chain-of-thought rationale. |
| `timestamp` | `string` (ISO 8601) | Datetime of conversation turn. |
| `expireAt` | `Timestamp` (stored) / `string` (code) | Expiration datetime (default: 5 years or 30 days depending on tier). |

---

### 3.4 `timeline_history`
Public posts authored and published by Rebecca to the X timeline.

- **Document ID**: Auto-generated UID or post identifier.
- **Converter**: `timelinePostConverter` in `@rebecca/db`.
- **TTL**: Managed by Cloud Firestore TTL policy on `expireAt`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `tweetId` | `string` | X Status Tweet ID. |
| `text` | `string` | Published status text (<= 140 chars). |
| `thought` | `string \| null` | Internal persona monologue behind the post. |
| `postType` | `'soliloquy' \| 'news' \| 'anniversary'` | Post classification origin. |
| `status` | `'SUCCESS' \| 'FAILED' \| 'PENDING'` | Delivery status. |
| `impressions` | `number` | Total impression metric. |
| `likes` | `number` | Like count. |
| `reposts` | `number` | Repost / retweet count. |
| `replies` | `number` | Reply count. |
| `mediaUrls` | `string[]` | Attached image URLs. |
| `newsTitle` | `string \| undefined` | Associated news headline (if postType == 'news'). |
| `timestamp` | `string` (ISO 8601) | Post creation timestamp. |
| `expireAt` | `Timestamp` (stored) / `string` (code) | Expiration datetime. |

---

### 3.5 `images`
Media asset repository metadata for AI-generated or curated illustration assets.

- **Document ID**: Image asset hash (SHA-256) or unique asset ID (`a1`, `a2`...).
- **Converter**: `imageDocConverter` in `@rebecca/db`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `url` | `string` | Google Cloud Storage URI (`gs://...`). |
| `filename` | `string` | File name and extension. |
| `caption` | `string` | Japanese semantic description of visual content. |
| `embedding` | `number[]` | 768-dimensional multimodal/text embedding vector. |
| `lastUsedAt` | `Timestamp \| null` | Datetime of last timeline attachment (for cooldowns). |
| `useCount` | `number` | Number of times attached to a post. |
| `status` | `'PENDING' \| 'PROCESSING' \| 'SUCCESS' \| 'FAILED'` | Asset readiness state. |

---

### 3.6 `processed_followers`
Follower onboarding tracking and idempotency registry.

- **Document ID**: Follower's X user ID (`follower_1`, `follower_uid_...`).
- **Converter**: `processedFollowerConverter` in `@rebecca/db`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | Follower's X user ID. |
| `username` | `string` | Follower's handle. |
| `timestamp` | `string` (ISO 8601) | Timestamp follower was detected. |
| `processedAt` | `string` (ISO 8601) | Timestamp follower was onboarded. |
| `source` | `string` | Ingestion source (e.g., `auto_sync`). |
| `listStatus` | `'ADDED' \| 'REJECTED' \| 'FAILED'` | List curation outcome. |

---

### 3.7 `system` & `system_stats`
Singletons and metric aggregations.

- **`system/persona`**: Current system prompt parameters, dynamic instructions, and `timeline_summary`.
- **`system/preferences`**: Active timezone, language, and global controls.
- **`system/x_api_state`**: Rate limit state, `last_mention_id` watermark.
- **`system_stats/global`**: Aggregated system KPIs (total followers, avg engagement, daily API call budget).
- **`system_stats/dau_YYYY-MM-DD`**: Daily Active User counts.

---

## 4. Indexing Policies (`firestore.indexes.json`)

1. **Vector Indexes**:
   - `rag_memories`: Vector index on `embedding` (768 dimensions, Cosine) composite with `userId` (ASC).
   - `images`: Vector index on `embedding` (768 dimensions, Cosine).
2. **Composite Indexes**:
   - `rag_memories`: `userId` ASC + `timestamp` ASC (enables FIFO memory pruning).
   - `processed_followers`: `listStatus` ASC + `timestamp` ASC.
3. **TTL Policies**:
   - `conversation_logs.expireAt`: Enabled.
   - `timeline_history.expireAt`: Enabled.
