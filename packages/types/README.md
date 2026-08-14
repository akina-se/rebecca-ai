# Shared Domain Types (`packages/types`)

Houses common TypeScript interfaces, type definitions, and Enums used across all services in the Rebecca AI monorepo.

---

## 🛠️ Key Domain Enums
To prevent inconsistencies in status processing, we enforce unified Enums:

### `UserStatus`
Represents the monitoring status of X users.
- `ACTIVE`: Standard tracking.
- `BLOCKED`: Excluded from all reply processes.
- `MUTED`: Interacting but excluded from notification counts.

### `AssetStatus`
Tracks GCS and database image processing stages.
- `PROCESSING`: Image is queued for Gemini alt-text processing.
- `SUCCESS`: Successfully captioned and indexed.
- `FAILED`: Vision extraction failed.

---

## 📂 Key Data Interfaces
- `MemoryLayer`: Metadata fields for system prompts.
- `MemoryContent`: Raw content wrapper for Layer 0/1/2 summaries.
- `RawConversationLog`: Represents Firestore document schema for interactions.
- `SystemAlert`: Aggregated warnings displayed in the admin dashboard.
- `PaginationMeta` & `PaginatedResponse<T>`: Standardized offset-based pagination envelopes for list APIs (e.g. users, posts).
