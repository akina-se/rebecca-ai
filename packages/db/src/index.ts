/**
 * @rebecca/db – Collection names, Firestore converters, and typed collection references.
 *
 * DESIGN PRINCIPLES:
 *  - Zero initialisation: this package never calls `new Firestore()`.
 *    The caller (app layer) owns the Firestore instance and passes it in.
 *  - Single source of truth for collection name strings.
 *    Eliminating magic string literals prevents typos and eases renames.
 *  - Full type-safety via FirestoreDataConverter<T>.
 *    Every read/write goes through a converter, so TypeScript catches
 *    mismatches at compile time rather than at runtime.
 *  - Timestamp ↔ ISO-string bridge:
 *    `@rebecca/types` exposes Firestore-agnostic ISO strings for fields
 *    that are stored as Firestore Timestamps on disk (expireAt, lastUsedAt,
 *    lastInteractionAt).  Converters handle the translation transparently.
 */

import {
  Firestore,
  Timestamp,
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
} from '@google-cloud/firestore';

import type {
  FirestoreUser,
  RawConversationLog,
  TimelinePost,
  RagMemory,
  ImageDoc,
  ProcessedFollower,
  ListInteraction,
  RateLimitDoc,
  PersonaDoc,
  XApiStateDoc,
} from '@rebecca/types';

// ---------------------------------------------------------------------------
// Collection name constants
// Single source of truth – never use raw strings outside this file.
// ---------------------------------------------------------------------------

/** All Firestore collection identifiers used across the Rebecca AI system. */
export const COLLECTIONS = {
  /** Primary user documents: profiles, episodic buffers, working memory. */
  USERS: 'users',

  /** TTL-based raw conversation logs (30-day expiry). */
  CONVERSATION_LOGS: 'conversation_logs',

  /** TTL-based timeline post history (30-day expiry). */
  TIMELINE_HISTORY: 'timeline_history',

  /** Vector-indexed RAG memory entries per user. */
  RAG_MEMORIES: 'rag_memories',

  /**
   * Rate-limit counters (global daily, user daily, user per-minute).
   * Doc IDs follow the pattern: `global_<date>`, `user_<id>_<date>`, etc.
   */
  RATE_LIMITS: 'rate_limits',

  /**
   * System singleton documents.
   * Known doc IDs: `persona`, `x_api_state`.
   */
  SYSTEM: 'system',

  /**
   * System-wide statistics (e.g., daily active users).
   * Known doc IDs: `dau_<YYYY-MM-DD>`.
   */
  SYSTEM_STATS: 'system_stats',

  /**
   * Idempotency log: records mention tweet IDs that have been processed.
   * Doc ID = tweet ID.
   */
  PROCESSED_MENTIONS: 'processed_mentions',

  /**
   * Vector-indexed image asset metadata.
   * Doc ID = image hash (SHA-256 or similar).
   */
  IMAGES: 'images',

  /**
   * Tracks followers that have been through the onboarding pipeline.
   * Doc ID = follower's X user ID.
   */
  PROCESSED_FOLLOWERS: 'processed_followers',

  /**
   * Tracks the last list-interaction timestamp per user.
   * Doc ID = X user ID.
   */
  LIST_INTERACTION_HISTORY: 'list_interaction_history',
} as const;

// Derive a union type for all collection name values (useful for generic helpers).
export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ---------------------------------------------------------------------------
// Helper: safe Timestamp → ISO string conversion
// ---------------------------------------------------------------------------

/**
 * Converts a Firestore Timestamp, JavaScript Date, ISO string, or null/undefined
 * to a standardized ISO 8601 string.
 *
 * This utility isolates the `@rebecca/types` package from `@google-cloud/firestore` dependencies
 * by ensuring that Firestore Timestamps are serialized into portable strings before leaving the
 * database layer.
 *
 * @param value - The temporal value to convert. Can be a Firestore Timestamp, Date object, string, or nullish.
 * @returns An ISO 8601 string representation of the date, or `null` if the input is nullish.
 */
function toIsoString(value: Timestamp | Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value; // already a string
}

// ---------------------------------------------------------------------------
// Firestore data converters
// ---------------------------------------------------------------------------

/**
 * Converter for the `users` collection.
 * FirestoreUser fields are all JSON-safe, so no Timestamp translation is needed.
 */
const userConverter: FirestoreDataConverter<FirestoreUser> = {
  toFirestore(user: FirestoreUser): DocumentData {
    return { ...user };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): FirestoreUser {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      name: data['name'] || '',
      username: data['username'] || '',
      avatarUrl: data['avatarUrl'] || '',
      status: data['status'],
      firstSeen: toIsoString(data['firstSeen'] ?? data['first_seen']) || '',
      lastSeen: toIsoString(data['lastSeen'] ?? data['last_seen'] ?? data['last_reply_date']) || '',
      coreProfile: data['coreProfile'] ?? {},
      working_memory: data['working_memory'],
      episodicBuffer: data['episodicBuffer'] ?? [],
      lastReplyDate: data['lastReplyDate'] ?? data['last_reply_date'],
      dailyReplyCount: data['dailyReplyCount'] ?? data['daily_reply_count'],
    };
  },
};

/**
 * Converter for the `conversation_logs` collection.
 * Translates the Firestore Timestamp `expireAt` ↔ ISO string on read/write.
 */
const conversationLogConverter: FirestoreDataConverter<RawConversationLog> = {
  toFirestore(log: RawConversationLog): DocumentData {
    return {
      ...log,
      // Store as a real Timestamp so Firestore TTL policy can fire correctly.
      expireAt: log.expireAt
        ? Timestamp.fromDate(new Date(log.expireAt))
        : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): RawConversationLog {
    const data = snapshot.data();
    return {
      userId: data['userId'],
      userText: data['userText'],
      aiText: data['aiText'],
      timestamp: data['timestamp'],
      expireAt: toIsoString(data['expireAt']) ?? '',
    };
  },
};

/**
 * Converter for the `timeline_history` collection.
 * Same Timestamp ↔ ISO string translation for `expireAt`.
 */
const timelinePostConverter: FirestoreDataConverter<TimelinePost> = {
  toFirestore(post: TimelinePost): DocumentData {
    return {
      ...post,
      expireAt: post.expireAt
        ? Timestamp.fromDate(new Date(post.expireAt))
        : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): TimelinePost {
    const data = snapshot.data();
    return {
      text: data['text'],
      timestamp: data['timestamp'],
      expireAt: toIsoString(data['expireAt']) ?? '',
      status: data['status'],
      impressions: data['impressions'],
      likes: data['likes'],
      retweets: data['retweets'],
      replies: data['replies'],
      mediaUrls: data['mediaUrls'] || data['media_urls'] || [],
      authorId: data['authorId'],
      authorName: data['authorName'],
      authorHandle: data['authorHandle'],
      authorAvatarUrl: data['authorAvatarUrl'],
    };
  },
};

/**
 * Converter for the `rag_memories` collection.
 * Note: the `embedding` field is stored as a Firestore VectorValue (via FieldValue.vector()),
 * not a plain number[]. Reads return the raw data; writes use the caller's FieldValue.vector().
 * The embedding field is typed as number[] in @rebecca/types for portability, but
 * the actual stored value may be a VectorValue on read. skipLibCheck handles this.
 */
const ragMemoryConverter: FirestoreDataConverter<RagMemory> = {
  toFirestore(memory: RagMemory): DocumentData {
    // embedding must be set by the caller using FieldValue.vector() AFTER converter.
    // We pass it through and let Firestore accept whatever value is provided.
    return { ...memory };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): RagMemory {
    const data = snapshot.data();
    return {
      userId: data['userId'],
      text: data['text'],
      embedding: data['embedding'] as number[],
      timestamp: data['timestamp'],
    };
  },
};

/**
 * Converter for the `images` collection.
 * Translates Firestore Timestamp `lastUsedAt` ↔ ISO string.
 */
const imageDocConverter: FirestoreDataConverter<ImageDoc> = {
  toFirestore(image: ImageDoc): DocumentData {
    return {
      ...image,
      lastUsedAt: image.lastUsedAt
        ? Timestamp.fromDate(new Date(image.lastUsedAt))
        : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): ImageDoc {
    const data = snapshot.data();
    return {
      url: data['url'],
      filename: data['filename'],
      caption: data['caption'],
      embedding: data['embedding'] as number[],
      lastUsedAt: toIsoString(data['lastUsedAt']),
      useCount: data['useCount'] ?? 0,
      status: data['status'],
    };
  },
};

/**
 * Converter for the `processed_followers` collection.
 */
const processedFollowerConverter: FirestoreDataConverter<ProcessedFollower> = {
  toFirestore(follower: ProcessedFollower): DocumentData {
    return { ...follower };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): ProcessedFollower {
    const data = snapshot.data();
    return {
      userId: data['userId'],
      timestamp: data['timestamp'],
    };
  },
};

/**
 * Converter for the `list_interaction_history` collection.
 * Translates Firestore Timestamp `lastInteractionAt` ↔ ISO string.
 */
const listInteractionConverter: FirestoreDataConverter<ListInteraction> = {
  toFirestore(interaction: ListInteraction): DocumentData {
    return {
      ...interaction,
      lastInteractionAt: interaction.lastInteractionAt
        ? Timestamp.fromDate(new Date(interaction.lastInteractionAt))
        : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): ListInteraction {
    const data = snapshot.data();
    return {
      userId: data['userId'],
      lastInteractionAt: toIsoString(data['lastInteractionAt']) ?? '',
    };
  },
};

/**
 * Creates a generic, pass-through FirestoreDataConverter for documents that do not require
 * specific serialization logic.
 *
 * This is useful for simple counter or flag documents (e.g., rate_limits, system_stats) where
 * the data is read and written as raw `DocumentData` and contains dynamic fields like
 * `FieldValue.increment` or `FieldValue.serverTimestamp`.
 *
 * @template T - The generic type representing the shape of the document data.
 * @returns A FirestoreDataConverter typed for `T` that performs no translation.
 */
function makePassThroughConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data: T) => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot) => snapshot.data() as T,
  };
}

export const rateLimitConverter = makePassThroughConverter<RateLimitDoc>();
export const personaConverter = makePassThroughConverter<PersonaDoc>();
export const xApiStateConverter = makePassThroughConverter<XApiStateDoc>();

// ---------------------------------------------------------------------------
// Public API: getCollections()
// ---------------------------------------------------------------------------

/**
 * Returns a map of fully-typed Firestore CollectionReferences, each bound
 * to the appropriate data converter.
 *
 * Usage:
 * ```ts
 * const db = new Firestore({ projectId });
 * const { users, conversationLogs, images } = getCollections(db);
 *
 * // Read – fully typed
 * const snap = await users.doc(userId).get();
 * const user: FirestoreUser = snap.data()!;
 *
 * // Write – type-checked against FirestoreUser
 * await users.doc(userId).set(newUser, { merge: true });
 * ```
 *
 * @param db - A live Firestore instance, provided by the application layer.
 * @returns An object containing typed collection references for the database.
 */
export function getCollections(db: Firestore) {
  return {
    /** Typed user documents. */
    users: db
      .collection(COLLECTIONS.USERS)
      .withConverter(userConverter),

    /** Typed raw conversation log documents (30-day TTL). */
    conversationLogs: db
      .collection(COLLECTIONS.CONVERSATION_LOGS)
      .withConverter(conversationLogConverter),

    /** Typed timeline post history documents (30-day TTL). */
    timelineHistory: db
      .collection(COLLECTIONS.TIMELINE_HISTORY)
      .withConverter(timelinePostConverter),

    /** Typed RAG memory documents with vector embeddings. */
    ragMemories: db
      .collection(COLLECTIONS.RAG_MEMORIES)
      .withConverter(ragMemoryConverter),

    /** Typed image asset metadata documents with vector embeddings. */
    images: db
      .collection(COLLECTIONS.IMAGES)
      .withConverter(imageDocConverter),

    /** Typed processed-follower idempotency documents. */
    processedFollowers: db
      .collection(COLLECTIONS.PROCESSED_FOLLOWERS)
      .withConverter(processedFollowerConverter),

    /** Typed list-interaction history documents. */
    listInteractionHistory: db
      .collection(COLLECTIONS.LIST_INTERACTION_HISTORY)
      .withConverter(listInteractionConverter),

    /**
     * Pass-through rate-limit counter documents.
     * Doc IDs use patterns such as `global_<date>`, `user_<id>_<date>`, etc.
     */
    rateLimits: db
      .collection(COLLECTIONS.RATE_LIMITS)
      .withConverter(rateLimitConverter),

    /**
     * Pass-through system singleton documents.
     * Known doc IDs: `persona`, `x_api_state`.
     */
    system: db
      .collection(COLLECTIONS.SYSTEM)
      .withConverter(personaConverter),

    /**
     * Pass-through system statistics documents.
     * Known doc IDs: `dau_<YYYY-MM-DD>`.
     */
    systemStats: db
      .collection(COLLECTIONS.SYSTEM_STATS)
      .withConverter(makePassThroughConverter()),

    /**
     * Pass-through processed-mention idempotency documents.
     * Doc ID = tweet ID.
     */
    processedMentions: db
      .collection(COLLECTIONS.PROCESSED_MENTIONS)
      .withConverter(makePassThroughConverter()),
  } as const;
}

/** Type alias for the return value of `getCollections`. */
export type DbCollections = ReturnType<typeof getCollections>;

// Re-export converters for consumers that need direct access (e.g., unit tests).
export {
  userConverter,
  conversationLogConverter,
  timelinePostConverter,
  ragMemoryConverter,
  imageDocConverter,
  processedFollowerConverter,
  listInteractionConverter,
};
