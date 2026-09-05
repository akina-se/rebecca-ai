/**
 * @fileoverview Firestore database service implementation.
 * 
 * Acts as the primary data access layer for the bot-backend application.
 * Delegates collection access to `@rebecca/db`'s `getCollections()` helper,
 * ensuring all reads and writes are routed through strongly-typed converters.
 * 
 * Design rules enforced in this module:
 *  - No raw string collection names: all references must use `COLLECTIONS.*`.
 *  - No unchecked type assertions (e.g., `doc.data() as SomeType`): converters guarantee shape.
 *  - Direct imports of `FieldValue` helpers (increment, arrayUnion, vector, etc.) from
 *    `@google-cloud/firestore` are permitted because they produce write-only sentinels
 *    that must bypass the typed converter during updates.
 */

import { Firestore, FieldValue, Timestamp } from '@google-cloud/firestore';
import { getCollections, COLLECTIONS } from '@rebecca/db';
import config from '../config';
import type {
  FirestoreUser,
  ConversationLogEntry,
  UserCoreProfile,
  RawConversationLog,
  ImageDoc,
  ImageDocWithId,
  ProcessedFollower,
  ListInteraction,
  XApiUser,
  FollowerListStatus,
} from '../types';
import { PostStatus } from '../types';

// ---------------------------------------------------------------------------
// Singleton Firestore client
// The application layer owns this instance and it is shared across all helpers.
// ---------------------------------------------------------------------------

/**
 * Firestore client instance, scoped to the configured GCP project.
 * Exported so other modules (e.g., admin API routes) can run transactions
 * against the same connection pool without creating a second client.
 */
const firestore = new Firestore({
  projectId: config.gcp.projectId,
});

/**
 * Pre-bound, type-safe collection references for the entire application.
 * Re-using a single `getCollections()` call avoids redundant `.withConverter()`
 * chains on every function call.
 */
const db = getCollections(firestore);

// ---------------------------------------------------------------------------
// User Operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a user document by ID.
 *
 * @param userId - Firestore document ID for the user.
 * @returns The typed `FirestoreUser` or `null` if the document does not exist.
 */
const getUserDoc = async (userId: string): Promise<FirestoreUser | null> => {
  const snap = await db.users.doc(userId).get();
  return snap.exists ? snap.data() ?? null : null;
};

/**
 * Merges partial data into an existing user document (upsert).
 *
 * @param userId - Target user's document ID.
 * @param data   - Partial `FirestoreUser` fields to merge.
 */
const updateUserDoc = async (userId: string, data: Partial<FirestoreUser>): Promise<void> => {
  await db.users.doc(userId).set(data as FirestoreUser, { merge: true });
};

/**
 * Atomically appends a conversation entry to the user's episodic buffer
 * and refreshes the last-reply-date timestamp.
 *
 * @param userId   - Target user's document ID.
 * @param logEntry - The conversation turn to append.
 */
const appendEpisodicBuffer = async (userId: string, logEntry: ConversationLogEntry): Promise<void> => {
  // FieldValue sentinels bypass the converter – we write directly to the raw ref.
  const rawRef = firestore.collection(COLLECTIONS.USERS).doc(userId);
  const now = new Date().toISOString();
  const docSnap = await rawRef.get();
  const data = docSnap && typeof docSnap.data === 'function' ? docSnap.data() : undefined;
  const firstSeen = typeof data?.firstSeen === 'string' ? data.firstSeen : now;

  await rawRef.set(
    {
      episodicBuffer: FieldValue.arrayUnion(logEntry),
      lastReplyDate: now,
      lastSeen: now,
      firstSeen,
    },
    { merge: true },
  );
};

/**
 * Replaces a user's core profile and clears the episodic buffer.
 *
 * @param userId      - Target user's document ID.
 * @param profileData - New core profile object.
 */
const updateCoreProfile = async (userId: string, profileData: UserCoreProfile): Promise<void> => {
  await db.users.doc(userId).set(
    { coreProfile: profileData, episodicBuffer: [] } as unknown as FirestoreUser,
    { merge: true },
  );
};

/**
 * Returns all registered users in the database, including their document IDs.
 *
 * @returns Array of `FirestoreUser` objects (each has `id` set to the doc ID).
 */
const getAllUsers = async (): Promise<(FirestoreUser & { id: string })[]> => {
  const snapshot = await db.users.get();
  const users: (FirestoreUser & { id: string })[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data) users.push({ ...data, id: doc.id });
  });
  return users;
};

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

/**
 * Increments a global (system-wide) rate-limit counter.
 *
 * @param type    - Logical category (e.g., `'daily'`).
 * @param timeKey - Time window key (e.g., `'2026-07-14'`).
 */
const incrementGlobalRateLimit = async (type: string, timeKey: string): Promise<void> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`global_${type}_${timeKey}`);
  await docRef.set({ count: FieldValue.increment(1) }, { merge: true });
};

/**
 * Returns the current global rate-limit count for a type/time-window pair.
 *
 * @param type    - Logical category.
 * @param timeKey - Time window key.
 */
const getGlobalRateLimit = async (type: string, timeKey: string): Promise<number> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`global_${type}_${timeKey}`);
  const doc = await docRef.get();
  return doc.exists ? (doc.data()?.['count'] || 0) : 0;
};

/**
 * Increments a per-user daily rate-limit counter.
 *
 * @param userId  - The user's ID.
 * @param dateStr - ISO date string (e.g., `'2026-07-14'`).
 */
const incrementUserDailyLimit = async (userId: string, dateStr: string): Promise<void> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`user_daily_${userId}_${dateStr}`);
  await docRef.set({ count: FieldValue.increment(1) }, { merge: true });
};

/**
 * Returns the per-user daily reply count.
 *
 * @param userId  - The user's ID.
 * @param dateStr - ISO date string.
 */
const getUserDailyLimit = async (userId: string, dateStr: string): Promise<number> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`user_daily_${userId}_${dateStr}`);
  const doc = await docRef.get();
  return doc.exists ? (doc.data()?.['count'] || 0) : 0;
};

/**
 * Increments a per-user per-minute rate-limit counter.
 *
 * @param userId  - The user's ID.
 * @param timeKey - Minute-resolution key (e.g., `'2026-07-14T10:05'`).
 */
const incrementUserMinuteLimit = async (userId: string, timeKey: string): Promise<void> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`user_minute_${userId}_${timeKey}`);
  await docRef.set({ count: FieldValue.increment(1) }, { merge: true });
};

/**
 * Returns the per-user per-minute reply count.
 *
 * @param userId  - The user's ID.
 * @param timeKey - Minute-resolution key.
 */
const getUserMinuteLimit = async (userId: string, timeKey: string): Promise<number> => {
  const docRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`user_minute_${userId}_${timeKey}`);
  const doc = await docRef.get();
  return doc.exists ? (doc.data()?.['count'] || 0) : 0;
};

/**
 * Returns the Daily Active Users count for a given date.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD).
 * @returns The DAU count, defaulting to 1 if no record exists.
 */
const getDailyActiveUsersCount = async (dateStr: string): Promise<number> => {
  const docRef = firestore.collection(COLLECTIONS.SYSTEM_STATS).doc(`dau_${dateStr}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return 1;
  }
  const data = doc.data();
  if (Array.isArray(data?.['active_users'])) {
    return Math.max(data['active_users'].length, 1);
  }
  if (typeof data?.['count'] === 'number') {
    return Math.max(data['count'], 1);
  }
  return 1;
};

/**
 * Transactionally checks and consumes all applicable rate-limit quotas for a user.
 *
 * Enforced limits (in order):
 *  1. Spam guard: user per-minute (resets each minute).
 *  2. Global daily cap across all users.
 *  3. Dynamic per-user daily cap derived from `globalDaily / DAU` (min 3).
 *
 * @param userId    - The user's ID.
 * @param dateStr   - Current date (YYYY-MM-DD).
 * @param monthStr  - Current month (YYYY-MM) — reserved for future monthly quotas.
 * @param minuteStr - Current minute (YYYY-MM-DDTHH:mm).
 * @param limits    - `{ globalDaily, spamMinute }` configuration.
 * @returns `{ allowed: true }` on success, `{ allowed: false, reason }` on rejection.
 */
const checkAndConsumeRateLimit = async (
  userId: string,
  dateStr: string,
  monthStr: string,
  minuteStr: string,
  limits: { globalDaily: number; spamMinute: number },
): Promise<{ allowed: boolean; reason?: string }> => {
  const globalDocRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`global_${dateStr}`);
  const userDocRef = firestore.collection(COLLECTIONS.RATE_LIMITS).doc(`user_${userId}_${dateStr}`);
  const dauDocRef = firestore.collection(COLLECTIONS.SYSTEM_STATS).doc(`dau_${dateStr}`);

  return firestore.runTransaction(async (t) => {
    const [globalDoc, userDoc, dauDoc] = await Promise.all([
      t.get(globalDocRef),
      t.get(userDocRef),
      t.get(dauDocRef),
    ]);

    const globalData = globalDoc.exists ? globalDoc.data() : { daily: 0 };
    const userData = userDoc.exists ? userDoc.data() : { daily: 0, minute: 0, lastMinute: minuteStr };
    let dauCount = dauDoc.exists ? (dauDoc.data()?.['count'] || 1) : 1;

    // Per-minute spam guard (resets when the minute string changes).
    const userMinuteCount = userData!['lastMinute'] === minuteStr ? (userData!['minute'] || 0) : 0;
    if (userMinuteCount >= limits.spamMinute) {
      return { allowed: false, reason: 'user_minute_spam' };
    }

    // Global daily cap.
    const globalDailyCount = globalData?.['daily'] || 0;
    if (globalDailyCount >= limits.globalDaily) {
      return { allowed: false, reason: 'global_daily' };
    }

    // Dynamic per-user cap = floor(globalDaily / DAU), min 3.
    const userDailyCount = userData?.['daily'] || 0;
    const isNewDau = userDailyCount === 0;
    if (isNewDau) dauCount += 1;

    let dynamicUserLimit = Math.floor(limits.globalDaily / dauCount);
    if (dynamicUserLimit < 3) dynamicUserLimit = 3;

    if (userDailyCount >= dynamicUserLimit) {
      return { allowed: false, reason: 'user_daily' };
    }

    // Consume quotas transactionally.
    t.set(globalDocRef, { daily: globalDailyCount + 1 }, { merge: true });
    t.set(userDocRef, { daily: userDailyCount + 1, minute: userMinuteCount + 1, lastMinute: minuteStr }, { merge: true });
    if (isNewDau) {
      t.set(dauDocRef, { count: dauCount }, { merge: true });
    }

    return { allowed: true };
  });
};

// ---------------------------------------------------------------------------
// Conversation Logs
// ---------------------------------------------------------------------------

/**
 * Persists a raw conversation turn. Documents expire automatically after
 * 5 years via Firestore's TTL policy on the `expireAt` field.
 *
 * @param userId   - The participant user's ID.
 * @param userText - The user's message text.
 * @param aiText   - The AI's response text.
 */
const saveRawConversationLog = async (userId: string, userText: string, aiText: string, thought?: string): Promise<void> => {
  const logRef = db.conversationLogs.doc();
  const now = new Date();
  const expireAt = new Date(now);
  expireAt.setFullYear(expireAt.getFullYear() + 5);

  const log: RawConversationLog = {
    userId,
    userText,
    aiText,
    thought: thought || undefined,
    timestamp: now.toISOString(),
    expireAt: expireAt.toISOString(), // Converter writes this as a Timestamp to Firestore.
  };
  await logRef.set(log);
};

/**
 * Fetches recent conversation logs up to `days` days old.
 *
 * @param days - Look-back window in days. Defaults to 7.
 * @returns Array of `RawConversationLog` entries, newest first.
 */
const getRecentConversationLogs = async (days = 7): Promise<RawConversationLog[]> => {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceIso = sinceDate.toISOString();

  const snapshot = await db.conversationLogs
    .where('timestamp', '>=', sinceIso)
    .orderBy('timestamp', 'desc')
    .limit(1000)
    .get();

  const logs: RawConversationLog[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data) logs.push(data);
  });
  return logs;
};

// ---------------------------------------------------------------------------
// System / Persona
// ---------------------------------------------------------------------------

/**
 * Retrieves the AI's extended system persona prompt.
 *
 * @returns The extended prompt text, or an empty string if not yet set.
 */
const getExtendedPrompt = async (): Promise<string> => {
  const doc = await firestore.collection(COLLECTIONS.SYSTEM).doc('persona').get();
  return doc.exists ? (doc.data()?.['extended_prompt'] || '') : '';
};

/**
 * Persists the AI's extended system persona prompt.
 *
 * @param promptText - The new extended prompt.
 */
const saveExtendedPrompt = async (promptText: string): Promise<void> => {
  await firestore.collection(COLLECTIONS.SYSTEM).doc('persona').set(
    { extended_prompt: promptText, updatedAt: new Date().toISOString() },
    { merge: true },
  );
};

/**
 * Retrieves the summarised timeline history stored in the persona document.
 *
 * @returns The timeline summary text, or an empty string if not yet set.
 */
const getTimelineSummary = async (): Promise<string> => {
  const doc = await firestore.collection(COLLECTIONS.SYSTEM).doc('persona').get();
  return doc.exists ? (doc.data()?.['timeline_summary'] || '') : '';
};

/**
 * Persists an updated timeline summary.
 *
 * @param summaryText - The new summary text.
 */
const saveTimelineSummary = async (summaryText: string): Promise<void> => {
  await firestore.collection(COLLECTIONS.SYSTEM).doc('persona').set(
    { timeline_summary: summaryText, timelineSummaryUpdatedAt: new Date().toISOString() },
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// Timeline Posts
// ---------------------------------------------------------------------------

/**
 * Saves a timeline post to history, including media URLs, asset identifiers, and tweet ID.
 * Expires automatically after 30 days.
 *
 * @param text    - The post text content.
 * @param options - Optional mediaUrls, assetId, and tweetId.
 */
const saveTimelinePost = async (
  text: string,
  options?: {
    thought?: string;
    mediaUrls?: string[];
    assetId?: string;
    tweetId?: string;
    postType?: 'news' | 'soliloquy' | 'random_engagement';
    newsTitle?: string;
    newsEmbedding?: number[];
  },
): Promise<void> => {
  const ref = db.timelineHistory.doc();
  const now = new Date();
  const expireAt = new Date(now);
  expireAt.setFullYear(expireAt.getFullYear() + 5);

  const mediaList = options?.mediaUrls || [];
  await ref.set({
    text,
    timestamp: now.toISOString(),
    expireAt: expireAt.toISOString(), // Converter writes this as a Timestamp.
    mediaUrls: mediaList,
    ...(options?.thought ? { thought: options.thought } : {}),
    ...(options?.assetId ? { assetId: options.assetId } : {}),
    ...(options?.tweetId ? { tweetId: options.tweetId } : {}),
    ...(options?.postType ? { postType: options.postType } : {}),
    ...(options?.newsTitle ? { newsTitle: options.newsTitle } : {}),
    ...(options?.newsEmbedding ? { newsEmbedding: options.newsEmbedding } : {}),
    impressions: 0,
    likes: 0,
    reposts: 0,
    replies: 0,
    status: PostStatus.SUCCESS,
  });
};

/**
 * Retrieves the titles and embeddings of recent news posts within the specified lookback days.
 * Used for deterministic duplicate detection before generating proactive news posts.
 *
 * @param days - The lookback window in days. Defaults to 30 days.
 * @returns Array of recent news items with title and embedding.
 */
const getRecentNewsEmbeddings = async (
  days = 30,
): Promise<Array<{ title: string; embedding: number[] }>> => {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const snapshot = await db.timelineHistory
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .get();

  const newsItems: Array<{ title: string; embedding: number[] }> = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data?.newsTitle && Array.isArray(data?.newsEmbedding) && data.newsEmbedding.length > 0) {
      newsItems.push({
        title: data.newsTitle,
        embedding: data.newsEmbedding,
      });
    }
  });
  return newsItems;
};

/**
 * Retrieves the most recent timeline posts, in chronological order.
 *
 * @param limit - Maximum number of posts to return. Defaults to 3.
 * @returns Array of post text strings, oldest first.
 */
const getRecentTimelinePosts = async (limit = 3): Promise<string[]> => {
  const snapshot = await db.timelineHistory
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  const posts: string[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data?.text) {
      const dateStr = data.timestamp
        ? new Date(data.timestamp).toLocaleDateString('ja-JP', {
            month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
          })
        : '';
      const textWithThought = data.thought
        ? `${data.text} (内心: ${data.thought})`
        : data.text;
      posts.push(dateStr ? `[${dateStr}] ${textWithThought}` : textWithThought);
    }
  });
  return posts.reverse();
};

// ---------------------------------------------------------------------------
// RAG Memories
// ---------------------------------------------------------------------------

/**
 * Persists a new RAG memory entry and prunes the oldest entries if the user
 * exceeds the configured `config.rag.maxMemories` ceiling.
 *
 * @param userId    - The user the memory is associated with.
 * @param text      - The memory content.
 * @param embedding - Vector embedding produced by Gemini.
 */
const saveRagMemory = async (userId: string, text: string, embedding: number[]): Promise<void> => {
  const memRef = firestore.collection(COLLECTIONS.RAG_MEMORIES).doc();
  await memRef.set({
    userId,
    text,
    embedding: FieldValue.vector(embedding), // VectorValue – must bypass converter.
    timestamp: new Date().toISOString(),
  });

  // Prune oldest memories if the user exceeds their allocation.
  const maxMemories = config.rag.maxMemories;
  const snapshot = await firestore
    .collection(COLLECTIONS.RAG_MEMORIES)
    .where('userId', '==', userId)
    .orderBy('timestamp', 'asc')
    .get();

  if (snapshot.size > maxMemories) {
    const docsToDelete = snapshot.size - maxMemories;
    const batch = firestore.batch();
    for (let i = 0; i < docsToDelete; i++) {
      batch.delete(snapshot.docs[i].ref);
    }
    await batch.commit();
  }
};

/**
 * Performs a Firestore vector search to find the most semantically relevant
 * memories for a given user.
 *
 * @param userId      - The user whose memories to search.
 * @param queryVector - The query embedding.
 * @param limit       - Maximum results. Defaults to 3.
 * @returns Array of memory text strings (empty on error).
 */
const findRagMemories = async (userId: string, queryVector: number[], limit = 3): Promise<string[]> => {
  try {
    const snapshot = await firestore
      .collection(COLLECTIONS.RAG_MEMORIES)
      .where('userId', '==', userId)
      .findNearest('embedding', FieldValue.vector(queryVector), {
        limit,
        distanceMeasure: 'COSINE',
      })
      .get();

    const memories: string[] = [];
    snapshot.forEach((doc) => {
      const text = doc.data()?.['text'];
      if (text) memories.push(text);
    });
    return memories;
  } catch (e) {
    console.error('[FirestoreService] Vector search (findNearest) failed:', e);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Mention Idempotency
// ---------------------------------------------------------------------------

/**
 * Checks whether a tweet has already been processed.
 *
 * @param tweetId - The X tweet ID.
 * @returns `true` if already processed, `false` otherwise.
 */
const hasProcessedMention = async (tweetId: string): Promise<boolean> => {
  const doc = await firestore.collection(COLLECTIONS.PROCESSED_MENTIONS).doc(tweetId).get();
  return doc.exists;
};

/**
 * Marks a tweet as processed to prevent duplicate handling.
 *
 * @param tweetId - The X tweet ID.
 */
const markMentionProcessed = async (tweetId: string): Promise<void> => {
  await firestore
    .collection(COLLECTIONS.PROCESSED_MENTIONS)
    .doc(tweetId)
    .set({ processedAt: FieldValue.serverTimestamp() });
};

/**
 * Retrieves the ID of the most recently processed mention.
 *
 * @returns The last mention ID, or `null` if no state has been persisted yet.
 */
const getLastMentionId = async (): Promise<string | null> => {
  const doc = await firestore.collection(COLLECTIONS.SYSTEM).doc('x_api_state').get();
  return doc.exists ? (doc.data()?.['last_mention_id'] || null) : null;
};

/**
 * Updates the last processed mention ID in the system state.
 *
 * @param mentionId - The new mention ID to store.
 */
const setLastMentionId = async (mentionId: string): Promise<void> => {
  await firestore.collection(COLLECTIONS.SYSTEM).doc('x_api_state').set(
    { last_mention_id: mentionId, updatedAt: new Date().toISOString() },
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// Image Asset Management
// ---------------------------------------------------------------------------

/**
 * Persists image metadata and its vector embedding.
 *
 * @param hash      - Unique image hash (SHA-256 or similar).
 * @param url       - Public image URL.
 * @param caption   - AI-generated image caption.
 * @param embedding - Caption embedding vector.
 */
const saveImageMetadata = async (
  hash: string,
  url: string,
  caption: string,
  embedding: number[],
): Promise<void> => {
  await firestore.collection(COLLECTIONS.IMAGES).doc(hash).set({
    url,
    caption,
    embedding: FieldValue.vector(embedding), // VectorValue – must bypass converter.
    lastUsedAt: null,
    useCount: 0,
    createdAt: new Date().toISOString(),
  });
};

/**
 * Retrieves image metadata by its unique hash.
 *
 * @param hash - The image hash identifier.
 * @returns `ImageDocWithId` if found, `null` otherwise.
 */
const getImageByHash = async (hash: string): Promise<ImageDocWithId | null> => {
  const snap = await db.images.doc(hash).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return data ? { id: snap.id, ...data } : null;
};

/**
 * Performs a vector search across the images collection and returns the best
 * available image that meets the similarity threshold and is past its cooldown period.
 *
 * @param queryVector - Query embedding for semantic image matching.
 * @param similarityThreshold - Minimum cosine similarity required (default: from config).
 * @returns A randomly-selected `ImageDocWithId` from available matches, or `null`.
 */
const findImageByVector = async (
  queryVector: number[],
  similarityThreshold = config.images.similarityThreshold
): Promise<ImageDocWithId | null> => {
  try {
    const snapshot = await firestore
      .collection(COLLECTIONS.IMAGES)
      .findNearest('embedding', FieldValue.vector(queryVector), {
        limit: 10,
        distanceMeasure: 'COSINE',
        distanceResultField: 'vectorDistance',
      } as unknown as { limit: number; distanceMeasure: 'COSINE'; distanceResultField?: string })
      .get();

    if (snapshot.empty) return null;

    const now = new Date();
    const cooldownMs = config.images.cooldownDays * 24 * 60 * 60 * 1000;
    const availableImages: ImageDocWithId[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as ImageDoc & { vectorDistance?: number };
      const vectorDistance = typeof data.vectorDistance === 'number' ? data.vectorDistance : 0;
      const similarity = 1 - vectorDistance;

      if (similarity < similarityThreshold) {
        continue;
      }

      // `lastUsedAt` is stored as a Firestore Timestamp on disk but arrives
      // as a raw DocumentData snapshot here (bypassing converter). We handle both.
      const rawLastUsed = data.lastUsedAt as unknown;
      const lastUsed =
        rawLastUsed != null && typeof (rawLastUsed as { toDate?: unknown }).toDate === 'function'
          ? (rawLastUsed as Timestamp).toDate()
          : rawLastUsed
          ? new Date(rawLastUsed as string)
          : null;

      if (!lastUsed || now.getTime() - lastUsed.getTime() > cooldownMs) {
        availableImages.push({ id: doc.id, ...data });
      }
    }

    if (availableImages.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableImages.length);
    return availableImages[randomIndex];
  } catch (e) {
    console.error('[FirestoreService] Image vector search failed:', e);
    return null;
  }
};

/**
 * Records that an image was used: updates `lastUsedAt` to now and increments `useCount`.
 *
 * @param hash - The image hash identifier.
 */
const updateImageLastUsed = async (hash: string): Promise<void> => {
  await firestore.collection(COLLECTIONS.IMAGES).doc(hash).set(
    { lastUsedAt: FieldValue.serverTimestamp(), useCount: FieldValue.increment(1) },
    { merge: true },
  );
};

/**
 * Retrieves image assets that have a non-empty caption but are missing an embedding vector.
 *
 * @returns Array of image document IDs and their captions.
 */
const getAssetsPendingEmbedding = async (): Promise<Array<{ id: string; caption: string }>> => {
  const snapshot = await firestore.collection(COLLECTIONS.IMAGES).get();
  if (snapshot.empty) return [];

  const pending: Array<{ id: string; caption: string }> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const caption = typeof data['caption'] === 'string' ? data['caption'].trim() : '';
    if (caption.length > 0) {
      const embedding = data['embedding'];
      const hasValidEmbedding =
        embedding !== undefined &&
        embedding !== null &&
        (Array.isArray(embedding) ? embedding.length > 0 : true);
      if (!hasValidEmbedding) {
        pending.push({ id: doc.id, caption });
      }
    }
  }
  return pending;
};

/**
 * Updates an asset's embedding with a Firestore VectorValue and sets status to SUCCESS.
 *
 * @param id - The document ID of the image asset.
 * @param embedding - Array of numbers representing the embedding vector.
 */
const updateAssetEmbedding = async (id: string, embedding: number[]): Promise<void> => {
  await firestore.collection(COLLECTIONS.IMAGES).doc(id).set(
    {
      embedding: FieldValue.vector(embedding),
      status: 'SUCCESS',
    },
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// Follower Processing
// ---------------------------------------------------------------------------

/**
 * Checks whether a follower has already been processed by the onboarding pipeline.
 *
 * @param userId - The follower's X user ID.
 * @returns `true` if processed, `false` otherwise.
 */
const hasProcessedFollower = async (userId: string): Promise<boolean> => {
  const doc = await db.processedFollowers.doc(userId).get();
  return doc.exists;
};

/**
 * Records a follower as processed with an explicit list status.
 *
 * @param userId - The follower's X user ID.
 * @param status - Status of the list addition ('ADDED' | 'FAILED' | 'REJECTED'). Defaults to 'ADDED'.
 */
const markFollowerProcessed = async (userId: string, status: FollowerListStatus = 'ADDED'): Promise<void> => {
  const follower: ProcessedFollower = {
    userId,
    timestamp: new Date().toISOString(),
    listStatus: status,
  };
  await db.processedFollowers.doc(userId).set(follower);
};

/**
 * Retrieves followers whose onboarding failed (e.g. rate-limited) for self-healing retries.
 *
 * @param limit - Maximum number of failed followers to retrieve (defaults to 10).
 * @returns Array of ProcessedFollower documents in ascending order of timestamp.
 */
const getFailedFollowers = async (limit: number = 10): Promise<ProcessedFollower[]> => {
  try {
    const snapshot = await db.processedFollowers
      .where('listStatus', '==', 'FAILED')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Failed to get failed followers for retry:', error);
    return [];
  }
};

/**
 * Updates the list status of an existing processed follower.
 *
 * @param userId - The follower's X user ID.
 * @param status - The new FollowerListStatus.
 */
const updateFollowerListStatus = async (userId: string, status: FollowerListStatus): Promise<void> => {
  await db.processedFollowers.doc(userId).set(
    { listStatus: status } as unknown as ProcessedFollower,
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// List Interaction History
// ---------------------------------------------------------------------------

/**
 * Retrieves the timestamp of the most recent interaction with a list member.
 *
 * @param userId - The list member's X user ID.
 * @returns A `Date` object, or `null` if no interaction has been recorded.
 */
const getLastListInteraction = async (userId: string): Promise<Date | null> => {
  const snap = await db.listInteractionHistory.doc(userId).get();
  if (!snap.exists) return null;

  const data = snap.data() as ListInteraction | undefined;
  if (!data?.lastInteractionAt) return null;
  return new Date(data.lastInteractionAt);
};

/**
 * Retrieves the total count of processed followers in Firestore.
 *
 * @returns The total number of processed followers.
 */
const getProcessedFollowersCount = async (): Promise<number> => {
  try {
    const snap = await db.processedFollowers.count().get();
    return snap.data().count || 0;
  } catch (error) {
    console.error('Failed to get processed followers count:', error);
    return 0;
  }
};

/**
 * Updates the global total followers statistic in the systemStats collection.
 *
 * @param count - The total follower count.
 */
const updateTotalFollowers = async (count: number): Promise<void> => {
  const rawRef = firestore.collection(COLLECTIONS.SYSTEM_STATS).doc('global');
  await rawRef.set(
    { total_followers: count, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
};

/**
 * Records the current timestamp as the latest interaction with a list member.
 *
 * @param userId - The list member's X user ID.
 */
const updateLastListInteraction = async (userId: string): Promise<void> => {
  // serverTimestamp() bypasses the converter; we use the raw collection ref.
  const rawRef = firestore.collection(COLLECTIONS.LIST_INTERACTION_HISTORY).doc(userId);
  await rawRef.set(
    { userId, lastInteractionAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// List Members Cache
// ---------------------------------------------------------------------------

/**
 * Returns all processed followers as minimal user stubs from Firestore.
 *
 * Replaces the X API `getListMembers` call for the random engagement batch.
 * The `username` field is intentionally omitted here; callers must resolve
 * the actual username via `getUserProfile()` to guarantee freshness.
 *
 * @returns An array of partial XApiUser objects containing only the user ID.
 */
const getListMembersFromCache = async (): Promise<Pick<XApiUser, 'id'>[]> => {
  const snapshot = await db.processedFollowers.get();
  return snapshot.docs.map(doc => ({ id: doc.data().userId }));
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  firestore,
  getUserDoc,
  updateUserDoc,
  appendEpisodicBuffer,
  updateCoreProfile,
  incrementGlobalRateLimit,
  getGlobalRateLimit,
  incrementUserDailyLimit,
  getUserDailyLimit,
  incrementUserMinuteLimit,
  getUserMinuteLimit,
  checkAndConsumeRateLimit,
  getAllUsers,
  getDailyActiveUsersCount,
  saveRawConversationLog,
  getRecentConversationLogs,
  getExtendedPrompt,
  saveExtendedPrompt,
  getTimelineSummary,
  saveTimelineSummary,
  saveTimelinePost,
  getRecentTimelinePosts,
  getRecentNewsEmbeddings,
  saveRagMemory,
  findRagMemories,
  getLastMentionId,
  setLastMentionId,
  hasProcessedMention,
  markMentionProcessed,
  saveImageMetadata,
  getImageByHash,
  findImageByVector,
  updateImageLastUsed,
  getAssetsPendingEmbedding,
  updateAssetEmbedding,
  hasProcessedFollower,
  markFollowerProcessed,
  getFailedFollowers,
  updateFollowerListStatus,
  getProcessedFollowersCount,
  updateTotalFollowers,
  getLastListInteraction,
  updateLastListInteraction,
  getListMembersFromCache,
};
