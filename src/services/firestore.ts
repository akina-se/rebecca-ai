import { Firestore, FieldValue, Timestamp } from '@google-cloud/firestore';
import config from '../config';
import { 
    FirestoreUser, 
    ConversationLogEntry, 
    UserCoreProfile, 
    RawConversationLog, 
    ImageDoc, 
    ImageDocWithId,
    ProcessedFollower,
    ListInteraction
} from '../types';

/**
 * Firestore client instance using the configured GCP project ID.
 */
const firestore = new Firestore({
  projectId: config.gcp.projectId,
});

/**
 * Retrieves a user document from Firestore by user ID.
 * 
 * @param userId - The ID of the user.
 * @returns A promise that resolves to the user data or null if not found.
 */
const getUserDoc = async (userId: string): Promise<FirestoreUser | null> => {
  const docRef = firestore.collection('users').doc(userId);
  const doc = await docRef.get();
  return doc.exists ? (doc.data() as FirestoreUser) : null;
};

/**
 * Updates an existing user document with the provided data.
 * 
 * @param userId - The ID of the user.
 * @param data - Partial user data to merge into the document.
 * @returns A promise that resolves when the update completes.
 */
const updateUserDoc = async (userId: string, data: Partial<FirestoreUser>): Promise<void> => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set(data, { merge: true });
};

/**
 * Appends a conversation log entry to the user's episodic buffer.
 * 
 * @param userId - The ID of the user.
 * @param logEntry - The conversation log entry to append.
 * @returns A promise that resolves when the append completes.
 */
const appendEpisodicBuffer = async (userId: string, logEntry: ConversationLogEntry): Promise<void> => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    episodicBuffer: FieldValue.arrayUnion(logEntry),
    last_reply_date: new Date().toISOString()
  }, { merge: true });
};

/**
 * Updates a user's core profile and clears their episodic buffer.
 * 
 * @param userId - The ID of the user.
 * @param profileData - The new core profile data.
 * @returns A promise that resolves when the update completes.
 */
const updateCoreProfile = async (userId: string, profileData: UserCoreProfile): Promise<void> => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    coreProfile: profileData,
    episodicBuffer: []
  }, { merge: true });
};

/**
 * Increments the global rate limit counter for a specific type and time key.
 * 
 * @param type - The type of rate limit.
 * @param timeKey - The specific time key for the limit.
 * @returns A promise that resolves when the increment completes.
 */
const incrementGlobalRateLimit = async (type: string, timeKey: string): Promise<void> => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

/**
 * Retrieves the current global rate limit count for a specific type and time key.
 * 
 * @param type - The type of rate limit.
 * @param timeKey - The specific time key for the limit.
 * @returns A promise that resolves to the current count.
 */
const getGlobalRateLimit = async (type: string, timeKey: string): Promise<number> => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.count || 0) : 0;
};

/**
 * Increments the daily rate limit counter for a specific user and date.
 * 
 * @param userId - The ID of the user.
 * @param dateStr - The date string for the limit.
 * @returns A promise that resolves when the increment completes.
 */
const incrementUserDailyLimit = async (userId: string, dateStr: string): Promise<void> => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

/**
 * Retrieves the daily rate limit count for a specific user and date.
 * 
 * @param userId - The ID of the user.
 * @param dateStr - The date string for the limit.
 * @returns A promise that resolves to the current count.
 */
const getUserDailyLimit = async (userId: string, dateStr: string): Promise<number> => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.count || 0) : 0;
};

/**
 * Increments the minute-based rate limit counter for a specific user and time key.
 * 
 * @param userId - The ID of the user.
 * @param timeKey - The specific time key for the limit.
 * @returns A promise that resolves when the increment completes.
 */
const incrementUserMinuteLimit = async (userId: string, timeKey: string): Promise<void> => {
    const docRef = firestore.collection('rate_limits').doc(`user_minute_${userId}_${timeKey}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

/**
 * Retrieves the minute-based rate limit count for a specific user and time key.
 * 
 * @param userId - The ID of the user.
 * @param timeKey - The specific time key for the limit.
 * @returns A promise that resolves to the current count.
 */
const getUserMinuteLimit = async (userId: string, timeKey: string): Promise<number> => {
    const docRef = firestore.collection('rate_limits').doc(`user_minute_${userId}_${timeKey}`);
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.count || 0) : 0;
};

/**
 * Retrieves all registered users from the database.
 * 
 * @returns A promise that resolves to an array of user data including their IDs.
 */
const getAllUsers = async (): Promise<(FirestoreUser & { id: string })[]> => {
    const snapshot = await firestore.collection('users').get();
    const users: (FirestoreUser & { id: string })[] = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...(doc.data() as FirestoreUser) }));
    return users;
};

/**
 * Retrieves the daily active users (DAU) count for a specific date.
 * 
 * @param dateStr - The date string to check.
 * @returns A promise that resolves to the DAU count. Defaults to 1 if not found.
 */
const getDailyActiveUsersCount = async (dateStr: string): Promise<number> => {
    const docRef = firestore.collection('system_stats').doc(`dau_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.count || 1) : 1;
};

/**
 * Saves a raw conversation log entry for future analysis.
 * Logs expire automatically after 30 days.
 * 
 * @param userId - The ID of the user involved in the conversation.
 * @param userText - The user's input text.
 * @param aiText - The AI's response text.
 * @returns A promise that resolves when the log is saved.
 */
const saveRawConversationLog = async (userId: string, userText: string, aiText: string): Promise<void> => {
    const logRef = firestore.collection('conversation_logs').doc();
    const now = new Date();
    
    const expireAt = new Date(now);
    expireAt.setDate(expireAt.getDate() + 30);

    const log: RawConversationLog = {
        userId,
        userText,
        aiText,
        timestamp: now.toISOString(),
        expireAt: Timestamp.fromDate(expireAt)
    };
    await logRef.set(log);
};

/**
 * Retrieves recent conversation logs up to a specified number of days.
 * 
 * @param days - The number of days to look back. Defaults to 7.
 * @returns A promise that resolves to an array of raw conversation logs.
 */
const getRecentConversationLogs = async (days = 7): Promise<RawConversationLog[]> => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceIso = sinceDate.toISOString();

    const snapshot = await firestore.collection('conversation_logs')
        .where('timestamp', '>=', sinceIso)
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();

    const logs: RawConversationLog[] = [];
    snapshot.forEach(doc => logs.push(doc.data() as RawConversationLog));
    return logs;
};

/**
 * Retrieves the extended system persona prompt.
 * 
 * @returns A promise that resolves to the extended prompt text.
 */
const getExtendedPrompt = async (): Promise<string> => {
    const docRef = firestore.collection('system').doc('persona');
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.extended_prompt || '') : '';
};

/**
 * Saves the extended system persona prompt.
 * 
 * @param promptText - The new extended prompt text.
 * @returns A promise that resolves when the update completes.
 */
const saveExtendedPrompt = async (promptText: string): Promise<void> => {
    const docRef = firestore.collection('system').doc('persona');
    await docRef.set({
        extended_prompt: promptText,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

/**
 * Retrieves the summarized history of timeline events.
 * 
 * @returns A promise that resolves to the timeline summary text.
 */
const getTimelineSummary = async (): Promise<string> => {
    const docRef = firestore.collection('system').doc('persona');
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.timeline_summary || '') : '';
};

/**
 * Saves the summarized history of timeline events.
 * 
 * @param summaryText - The new timeline summary text.
 * @returns A promise that resolves when the update completes.
 */
const saveTimelineSummary = async (summaryText: string): Promise<void> => {
    const docRef = firestore.collection('system').doc('persona');
    await docRef.set({
        timeline_summary: summaryText,
        timelineSummaryUpdatedAt: new Date().toISOString()
    }, { merge: true });
};

/**
 * Saves a timeline post to the history collection with a 30-day expiration.
 * 
 * @param text - The content of the timeline post.
 * @returns A promise that resolves when the post is saved.
 */
const saveTimelinePost = async (text: string): Promise<void> => {
    const ref = firestore.collection('timeline_history').doc();
    const now = new Date();
    const expireAt = new Date(now);
    expireAt.setDate(expireAt.getDate() + 30);
    
    await ref.set({
        text,
        timestamp: now.toISOString(),
        expireAt: Timestamp.fromDate(expireAt)
    });
};

/**
 * Retrieves the most recent timeline posts.
 * 
 * @param limit - The maximum number of posts to retrieve. Defaults to 3.
 * @returns A promise that resolves to an array of recent timeline post texts.
 */
const getRecentTimelinePosts = async (limit = 3): Promise<string[]> => {
    const snapshot = await firestore.collection('timeline_history')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    
    const posts: string[] = [];
    snapshot.forEach(doc => posts.push(doc.data().text));
    return posts.reverse();
};

/**
 * Saves a RAG (Retrieval-Augmented Generation) memory entry, keeping total entries within configured limits.
 * 
 * @param userId - The ID of the user associated with the memory.
 * @param text - The content of the memory.
 * @param embedding - The vector embedding of the memory content.
 * @returns A promise that resolves when the memory is saved.
 */
const saveRagMemory = async (userId: string, text: string, embedding: number[]): Promise<void> => {
    const memRef = firestore.collection('rag_memories').doc();
    const now = new Date();
    await memRef.set({
        userId,
        text,
        embedding: FieldValue.vector(embedding),
        timestamp: now.toISOString()
    });

    const maxMemories = config.rag.maxMemories;
    const snapshot = await firestore.collection('rag_memories')
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
 * Finds RAG memories related to a specific user using vector search.
 * 
 * @param userId - The ID of the user.
 * @param queryVector - The embedding vector to search against.
 * @param limit - The maximum number of memories to return. Defaults to 3.
 * @returns A promise that resolves to an array of memory texts.
 */
const findRagMemories = async (userId: string, queryVector: number[], limit = 3): Promise<string[]> => {
    try {
        const snapshot = await firestore.collection('rag_memories')
            .where('userId', '==', userId)
            .findNearest('embedding', FieldValue.vector(queryVector), {
                limit: limit,
                distanceMeasure: 'COSINE'
            })
            .get();
            
        const memories: string[] = [];
        snapshot.forEach(doc => memories.push(doc.data().text));
        return memories;
    } catch (e) {
        console.error('Error during vector search (findNearest):', e);
        return [];
    }
};

/**
 * Retrieves the last processed mention ID from the system state.
 * 
 * @returns A promise that resolves to the mention ID or null if not found.
 */
const getLastMentionId = async (): Promise<string | null> => {
    const docRef = firestore.collection('system').doc('x_api_state');
    const doc = await docRef.get();
    return doc.exists ? (doc.data()?.last_mention_id || null) : null;
};

/**
 * Updates the last processed mention ID in the system state.
 * 
 * @param mentionId - The new mention ID to set.
 * @returns A promise that resolves when the update completes.
 */
const setLastMentionId = async (mentionId: string): Promise<void> => {
    const docRef = firestore.collection('system').doc('x_api_state');
    await docRef.set({
        last_mention_id: mentionId,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

/**
 * Saves image metadata including its vector embedding.
 * 
 * @param hash - The unique hash identifying the image.
 * @param url - The URL of the image.
 * @param caption - The caption describing the image.
 * @param embedding - The vector embedding of the image caption.
 * @returns A promise that resolves when the metadata is saved.
 */
const saveImageMetadata = async (hash: string, url: string, caption: string, embedding: number[]): Promise<void> => {
    const docRef = firestore.collection('images').doc(hash);
    await docRef.set({
        url,
        caption,
        embedding: FieldValue.vector(embedding),
        lastUsedAt: null,
        useCount: 0
    });
};

/**
 * Retrieves image metadata by its unique hash.
 * 
 * @param hash - The hash identifier of the image.
 * @returns A promise that resolves to the image document or null if not found.
 */
const getImageByHash = async (hash: string): Promise<ImageDoc | null> => {
    const docRef = firestore.collection('images').doc(hash);
    const doc = await docRef.get();
    return doc.exists ? (doc.data() as ImageDoc) : null;
};

/**
 * Finds a suitable image by comparing its vector embedding and respecting cooldown periods.
 * 
 * @param queryVector - The embedding vector to search against.
 * @returns A promise that resolves to the chosen image document with its ID or null if none found.
 */
const findImageByVector = async (queryVector: number[]): Promise<ImageDocWithId | null> => {
    try {
        const snapshot = await firestore.collection('images')
            .findNearest('embedding', FieldValue.vector(queryVector), {
                limit: 10,
                distanceMeasure: 'COSINE'
            })
            .get();
        
        if (snapshot.empty) return null;

        const now = new Date();
        let bestImage: ImageDocWithId | null = null;

        const cooldownMs = config.images.cooldownDays * 24 * 60 * 60 * 1000;
        const availableImages: ImageDocWithId[] = [];
        
        for (const doc of snapshot.docs) {
            const data = doc.data() as ImageDoc;
            const lastUsed = data.lastUsedAt ? data.lastUsedAt.toDate() : null;
            if (!lastUsed || (now.getTime() - lastUsed.getTime()) > cooldownMs) {
                availableImages.push({ id: doc.id, ...data });
            }
        }

        if (availableImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableImages.length);
            bestImage = availableImages[randomIndex];
        }

        return bestImage;
    } catch (e) {
        console.error('Error during image vector search:', e);
        return null;
    }
};

/**
 * Updates the last used timestamp and increments the usage count of an image.
 * 
 * @param hash - The unique hash identifying the image.
 * @returns A promise that resolves when the update completes.
 */
const updateImageLastUsed = async (hash: string): Promise<void> => {
    const docRef = firestore.collection('images').doc(hash);
    await docRef.set({
        lastUsedAt: FieldValue.serverTimestamp(),
        useCount: FieldValue.increment(1)
    }, { merge: true });
};

/**
 * Checks if a follower has already been processed by the system.
 * 
 * @param userId - The ID of the follower.
 * @returns A promise that resolves to a boolean indicating if they are processed.
 */
const hasProcessedFollower = async (userId: string): Promise<boolean> => {
    const docRef = firestore.collection('processed_followers').doc(userId);
    const doc = await docRef.get();
    return doc.exists;
};

/**
 * Marks a follower as processed in the system.
 * 
 * @param userId - The ID of the follower.
 * @returns A promise that resolves when the update completes.
 */
const markFollowerProcessed = async (userId: string): Promise<void> => {
    const docRef = firestore.collection('processed_followers').doc(userId);
    await docRef.set({
        userId,
        timestamp: new Date().toISOString()
    } as ProcessedFollower);
};

/**
 * Retrieves the timestamp of the last list interaction for a user.
 * 
 * @param userId - The ID of the user.
 * @returns A promise that resolves to the timestamp or null if not found.
 */
const getLastListInteraction = async (userId: string): Promise<Date | null> => {
    const docRef = firestore.collection('list_interaction_history').doc(userId);
    const doc = await docRef.get();
    if (doc.exists) {
        const data = doc.data() as ListInteraction;
        return data.lastInteractionAt ? data.lastInteractionAt.toDate() : null;
    }
    return null;
};

/**
 * Updates the timestamp of the last list interaction for a user.
 * 
 * @param userId - The ID of the user.
 * @returns A promise that resolves when the update completes.
 */
const updateLastListInteraction = async (userId: string): Promise<void> => {
    const docRef = firestore.collection('list_interaction_history').doc(userId);
    await docRef.set({
        userId,
        lastInteractionAt: FieldValue.serverTimestamp()
    }, { merge: true });
};

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
  saveRagMemory,
  findRagMemories,
  getLastMentionId,
  setLastMentionId,
  saveImageMetadata,
  getImageByHash,
  findImageByVector,
  updateImageLastUsed,
  hasProcessedFollower,
  markFollowerProcessed,
  getLastListInteraction,
  updateLastListInteraction
 };
