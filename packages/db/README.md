# Shared Firestore Database Module (`packages/db`)

Provides the typed collections layer and schema bindings for the Firestore database used across Rebecca's serverless applications.

---

## Architectural Role
By encapsulating database pathways in a shared package, we guarantee:
1. **Schema Consistency**: Changes to database documents (e.g., changing status Enums to uppercase) are immediately compiled and checked across all consuming applications (`bot-backend`, `dashboard-backend`, and `functions`).
2. **Collection Path Safety**: Centralizes raw string paths to database collections, preventing spelling errors or collection path drifts during migration.

---

## Collection Mapping & Usage

The module exposes the `getCollections(db: Firestore)` helper to construct typed Firestore references:

```typescript
import { getCollections } from '@rebecca/db';
import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();
const collections = getCollections(firestore);

// collections.users points to firestore.collection('users') with UserDoc types.
const userSnapshot = await collections.users.doc('rebecca_oshi').get();
const userData = userSnapshot.data(); // Strongly typed FirestoreUser
```

### Supported Collections
- `users`: Core profile settings, RAG memory buffers, and interaction frequency.
- `campaigns`: Narrative episodic event campaign itineraries and slots.
- `conversation_logs`: Raw historical logs of 1-on-1 bot chats (managed with a 5-year TTL).
- `timeline_history`: Proactive and campaign timeline posts (managed with a 5-year TTL).
- `rag_memories`: Embedded memory fragments for semantic search (max 20 per user FIFO).
- `images`: Image assets, Gemini alt-text captions, and vector embeddings.
- `admin_users`: Authorized dashboard administrators for RBAC.
- `system`: System-wide settings and persona singletons (`persona`, `x_api_state`, `preferences`).
- `system_stats`: Daily KPI aggregates (`global`, `dau_YYYY-MM-DD`).
- `rate_limits`: Scalable daily and minute rate limit counters.
- `processed_followers`: Follower onboarding tracking and curation list status.
- `list_interaction_history`: Cooldown tracking for list member interactions.
- `processed_mentions`: Mention tweet idempotency log.
- `processed_events`: Cloud Functions Eventarc idempotency log.
