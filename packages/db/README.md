# Shared Firestore Database Module (`packages/db`)

Provides the typed collections layer and schema bindings for the Firestore database used across Rebecca's serverless applications.

---

## Architectural Role
By encapsulating database pathways in a shared package, we guarantee:
1. **Schema Consistency**: Changes to database documents (e.g., changing status Enums to uppercase) are immediately compiled and checked across all consuming applications (`bot-backend`, `dashboard-backend`, and `functions`).
2. **Collection Path Safety**: Centralizes raw string paths to database collections, preventing spelling errors or collection path drifts during migration.

---

## 🛠️ Collection Mapping & Usage

The module exposes the `getCollections(db: Firestore)` helper to construct typed Firestore references:

```typescript
import { getCollections } from '@rebecca/db';
import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();
const collections = getCollections(firestore);

// collections.users points to firestore.collection('users') with UserDoc types.
const userSnapshot = await collections.users.doc('rebecca_oshi').get();
const userData = userSnapshot.data(); // Strongly typed UserDoc
```

### Supported Collections
- `users`: Core profile settings, RAG memory buffers, and interaction frequency.
- `conversation_logs`: Raw historical logs of bot chats (managed with a 30-day TTL).
- `timeline_history`: Proactive timeline tweets.
- `rag_memories`: Embedded memory fragments for semantic search.
- `images`: Image assets, Gemini alt-text captions, and vector embeddings.
- `system`: System-wide settings and persona variables (Layer 2 global memory).
- `system_stats`: Daily KPI aggregates (such as active user lists for DAU calculation).
- `rate_limits`: Scalable daily and minute rate limit counters.
