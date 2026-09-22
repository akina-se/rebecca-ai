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

import {
  COLLECTIONS,
  type FirestoreUser,
  type RawConversationLog,
  type TimelinePost,
  type RagMemory,
  type ImageDoc,
  type ProcessedFollower,
  type ListInteraction,
  type RateLimitDoc,
  type PersonaDoc,
  type XApiStateDoc,
  type CampaignDoc,
  type CampaignSlot,
  type SlotTimePeriod,
  type CampaignSlotStatus,
  type CampaignStatus,
} from './schema';

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
      thought: log.thought ?? null,
      expireAt: log.expireAt ? Timestamp.fromDate(new Date(log.expireAt)) : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): RawConversationLog {
    const data = snapshot.data();
    return {
      userId: data['userId'],
      userText: data['userText'],
      aiText: data['aiText'],
      thought: data['thought'],
      timestamp: data['timestamp'],
      expireAt: toIsoString(data['expireAt']) ?? '',
    };
  },
};

/**
 * Converter for the `timeline_history` collection.
 * Translates Firestore Timestamp `expireAt` ↔ ISO string on read/write.
 */
const timelinePostConverter: FirestoreDataConverter<TimelinePost> = {
  toFirestore(post: TimelinePost): DocumentData {
    return {
      ...post,
      thought: post.thought ?? null,
      reposts: Number(post.reposts ?? 0),
      mediaUrls: post.mediaUrls ?? [],
      tweetId: post.tweetId ?? '',
      expireAt: post.expireAt ? Timestamp.fromDate(new Date(post.expireAt)) : null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): TimelinePost {
    const data = snapshot.data();
    return {
      text: String(data['text'] ?? ''),
      thought: data['thought'],
      tweetId: String(data['tweetId'] ?? ''),
      timestamp: String(data['timestamp'] ?? ''),
      expireAt: toIsoString(data['expireAt']) ?? '',
      status: data['status'],
      impressions: Number(data['impressions'] ?? 0),
      likes: Number(data['likes'] ?? 0),
      reposts: Number(data['reposts'] ?? 0),
      replies: Number(data['replies'] ?? 0),
      mediaUrls: (Array.isArray(data['mediaUrls']) ? data['mediaUrls'] : []) as string[],
      authorId: data['authorId'],
      authorName: data['authorName'],
      authorHandle: data['authorHandle'],
      authorAvatarUrl: data['authorAvatarUrl'],
      assetId: data['assetId'],
      postType: data['postType'],
      newsTitle: data['newsTitle'],
      newsEmbedding: data['newsEmbedding'],
      anniversaryTitle: data['anniversaryTitle'],
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
    const data: DocumentData = { ...image };
    if (image.lastUsedAt !== undefined) {
      if (image.lastUsedAt) {
        const parsedDate = new Date(image.lastUsedAt);
        data['lastUsedAt'] = !isNaN(parsedDate.getTime())
          ? Timestamp.fromDate(parsedDate)
          : null;
      } else {
        data['lastUsedAt'] = null;
      }
    }
    return data;
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
      createdAt: data['createdAt'] || null,
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
      listStatus: data['listStatus'] ?? 'ADDED',
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

/**
 * Converter for the `campaigns` collection.
 */
const campaignDocConverter: FirestoreDataConverter<CampaignDoc> = {
  toFirestore(campaign: CampaignDoc): DocumentData {
    const data: DocumentData = {};
    if (campaign.title !== undefined) {
      data['title'] = campaign.title;
    }
    if (campaign.status !== undefined) {
      data['status'] = campaign.status;
    }
    if (campaign.isPaused !== undefined) {
      data['isPaused'] = Boolean(campaign.isPaused);
    }
    if (campaign.startDate !== undefined) {
      data['startDate'] = campaign.startDate;
    }
    if (campaign.endDate !== undefined) {
      data['endDate'] = campaign.endDate;
    }
    if (campaign.dailySlotTimes !== undefined) {
      data['dailySlotTimes'] = Array.isArray(campaign.dailySlotTimes) ? campaign.dailySlotTimes : [];
    }
    if (campaign.masterContext !== undefined) {
      data['masterContext'] = campaign.masterContext ?? '';
    }
    if (campaign.replyContextSummary !== undefined) {
      data['replyContextSummary'] = campaign.replyContextSummary ?? '';
    }
    if (campaign.slots !== undefined) {
      data['slots'] = Array.isArray(campaign.slots)
        ? campaign.slots.map((slot: CampaignSlot) => ({
            slotId: slot.slotId,
            dayNumber: slot.dayNumber,
            timePeriod: slot.timePeriod,
            scheduledTime: slot.scheduledTime,
            theme: slot.theme,
            mediaUrl: slot.mediaUrl ?? null,
            captionPromptHint: slot.captionPromptHint ?? null,
            fixedTextOverride: slot.fixedTextOverride ?? null,
            status: slot.status,
            postedTweetId: slot.postedTweetId ?? null,
            postedAt: slot.postedAt ?? null,
            errorReason: slot.errorReason ?? null,
          }))
        : [];
    }
    if (campaign.totalSlotsCount !== undefined) {
      data['totalSlotsCount'] = Number(campaign.totalSlotsCount ?? 0);
    }
    if (campaign.completedSlotsCount !== undefined) {
      data['completedSlotsCount'] = Number(campaign.completedSlotsCount ?? 0);
    }
    if (campaign.isAnnualRecurring !== undefined) {
      data['isAnnualRecurring'] = Boolean(campaign.isAnnualRecurring);
    }
    if (campaign.updatedAt !== undefined) {
      data['updatedAt'] = campaign.updatedAt;
    }
    if (campaign.createdAt !== undefined) {
      data['createdAt'] = campaign.createdAt;
    }
    if (campaign.description !== undefined) {
      data['description'] = campaign.description;
    }
    if (campaign.hashtag !== undefined) {
      data['hashtag'] = campaign.hashtag;
    }
    if (campaign.recurringApprovedYear !== undefined) {
      data['recurringApprovedYear'] = campaign.recurringApprovedYear;
    }

    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): CampaignDoc {
    const data = snapshot.data();

    // Enforce mandatory document fields - fail fast on schema corruption rather than masking
    if (
      typeof data['title'] !== 'string' ||
      typeof data['startDate'] !== 'string' ||
      typeof data['endDate'] !== 'string' ||
      typeof data['status'] !== 'string'
    ) {
      throw new Error(
        `Corrupted Campaign document [${snapshot.id}]: missing required root fields (title, startDate, endDate, status).`,
      );
    }

    const rawSlots = data['slots'];
    if (!Array.isArray(rawSlots)) {
      throw new Error(`Corrupted Campaign document [${snapshot.id}]: slots must be an array.`);
    }

    const slots: CampaignSlot[] = rawSlots.map((s, index): CampaignSlot => {
      if (
        !s ||
        typeof s['slotId'] !== 'string' ||
        typeof s['dayNumber'] !== 'number' ||
        typeof s['timePeriod'] !== 'string' ||
        typeof s['scheduledTime'] !== 'string' ||
        typeof s['theme'] !== 'string' ||
        typeof s['status'] !== 'string'
      ) {
        throw new Error(
          `Corrupted CampaignSlot at index ${index} in document [${snapshot.id}]: missing required slot fields (slotId, dayNumber, timePeriod, scheduledTime, theme, status).`,
        );
      }

      return {
        slotId: s['slotId'],
        dayNumber: s['dayNumber'],
        timePeriod: s['timePeriod'] as SlotTimePeriod,
        scheduledTime: s['scheduledTime'],
        theme: s['theme'],
        mediaUrl: typeof s['mediaUrl'] === 'string' ? s['mediaUrl'] : undefined,
        captionPromptHint: typeof s['captionPromptHint'] === 'string' ? s['captionPromptHint'] : undefined,
        fixedTextOverride: typeof s['fixedTextOverride'] === 'string' ? s['fixedTextOverride'] : undefined,
        isFixedText: Boolean(s['isFixedText']),
        textOnly: Boolean(s['textOnly']),
        status: s['status'] as CampaignSlotStatus,
        postedTweetId: typeof s['postedTweetId'] === 'string' ? s['postedTweetId'] : undefined,
        postedAt:
          toIsoString(s['postedAt'] as Timestamp | Date | string | null | undefined) ??
          (typeof s['postedAt'] === 'string' ? s['postedAt'] : undefined),
        errorReason: typeof s['errorReason'] === 'string' ? s['errorReason'] : undefined,
      };
    });

    const createdAtIso = toIsoString(data['createdAt']);
    const updatedAtIso = toIsoString(data['updatedAt']);

    return {
      id: snapshot.id,
      title: data['title'],
      description: typeof data['description'] === 'string' ? data['description'] : undefined,
      status: data['status'] as CampaignStatus,
      isPaused: Boolean(data['isPaused']),
      startDate: data['startDate'],
      endDate: data['endDate'],
      dailySlotTimes: Array.isArray(data['dailySlotTimes']) ? (data['dailySlotTimes'] as string[]) : [],
      masterContext: typeof data['masterContext'] === 'string' ? data['masterContext'] : '',
      replyContextSummary: typeof data['replyContextSummary'] === 'string' ? data['replyContextSummary'] : '',
      hashtag: typeof data['hashtag'] === 'string' ? data['hashtag'] : undefined,
      slots,
      totalSlotsCount: typeof data['totalSlotsCount'] === 'number' ? data['totalSlotsCount'] : slots.length,
      completedSlotsCount:
        typeof data['completedSlotsCount'] === 'number'
          ? data['completedSlotsCount']
          : slots.filter((s) => s.status === 'posted').length,
      isAnnualRecurring: Boolean(data['isAnnualRecurring']),
      recurringApprovedYear:
        data['recurringApprovedYear'] != null ? Number(data['recurringApprovedYear']) : undefined,
      createdAt: createdAtIso ?? (typeof data['createdAt'] === 'string' ? data['createdAt'] : new Date().toISOString()),
      updatedAt: updatedAtIso ?? (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : new Date().toISOString()),
    };
  },
};

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

    /**
     * Pass-through admin users documents for RBAC.
     * Doc ID = Firebase Auth UID.
     */
    adminUsers: db
      .collection(COLLECTIONS.ADMIN_USERS)
      .withConverter(makePassThroughConverter()),

    /**
     * Pass-through processed Eventarc events idempotency documents.
     * Doc ID = Eventarc eventId.
     */
    processedEvents: db
      .collection(COLLECTIONS.PROCESSED_EVENTS)
      .withConverter(makePassThroughConverter()),

    /**
     * Typed campaign narrative event documents.
     * Doc ID = `camp_<timestamp>_<uuid>`.
     */
    campaigns: db
      .collection(COLLECTIONS.CAMPAIGNS)
      .withConverter(campaignDocConverter),
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
  campaignDocConverter,
};

// Re-export all schema models and collection constants.
export * from './schema';

