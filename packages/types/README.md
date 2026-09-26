# Shared Domain Types (`packages/types`)

Houses common TypeScript interfaces, type definitions, and Enums used across all services in the Rebecca AI monorepo.

---

## Key Domain Enums & Types
To prevent inconsistencies across services, we enforce unified Enums and literal unions:

### `UserStatus`
Represents the monitoring status of X users.
- `ACTIVE`: Standard tracking.
- `BLOCKED`: Excluded from all reply processes.
- `MUTED`: Interacting but excluded from notification counts.

### `AssetStatus`
Tracks GCS and database image processing stages.
- `PENDING`: Image uploaded, awaiting processing.
- `PROCESSING`: Image is queued for Gemini alt-text processing.
- `SUCCESS`: Successfully captioned and indexed.
- `FAILED`: Vision extraction failed.

### `PostStatus`
Tracks delivery status of timeline posts: `PENDING`, `SUCCESS`, `FAILED`.

### `PostType`
Canonical post classifications: `'soliloquy' | 'news' | 'anniversary' | 'random_engagement' | 'campaign'`.

### `CampaignStatus` & `CampaignSlotStatus`
- `CampaignStatus`: `'draft' | 'scheduled' | 'active' | 'completed' | 'archived'`.
- `CampaignSlotStatus`: `'pending' | 'posted' | 'skipped' | 'failed'`.

---

## Key Data Interfaces
- `CampaignDoc` & `CampaignSlot`: Multi-day narrative event campaign specifications and itinerary slots.
- `TimelinePost`: Model for authored public timeline updates.
- `FirestoreUser`: User profile, affinity scores, and 3-tier memory buffers (`working_memory`, `episodicBuffer`, `coreProfile`).
- `RawConversationLog`: Represents full audit logs for 1-on-1 chats (5-year TTL).
- `RagMemory`: 768-dimensional vector embeddings for episodic long-term memory retrieval.
- `AdminUser`: Dashboard administrator authentication and RBAC roles.
- `CopilotAction`, `CopilotChatMessage`, `CopilotRequest`, `CopilotResponse`: Admin Copilot dialogue and Two-Phase HITL action proposal contracts.
- `MemoryLayer` & `MemoryContent`: Metadata and content wrappers for Layer 0/1/2 system prompts.
- `SystemAlert`: Aggregated system warnings for dashboard operators.
- `PaginationMeta` & `PaginatedResponse<T>`: Standardized offset-based pagination envelopes for list APIs.
