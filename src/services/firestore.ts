import { Firestore, FieldValue, Timestamp } from '@google-cloud/firestore';
import config from '../config';

const firestore = new Firestore({
  projectId: config.gcp.projectId,
  // Let it use application default credentials locally or in GCP
});

const getUserDoc = async (userId) => {
  const docRef = firestore.collection('users').doc(userId);
  const doc = await docRef.get();
  return doc.exists ? doc.data() : null;
};

const updateUserDoc = async (userId, data) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set(data, { merge: true });
};

const appendEpisodicBuffer = async (userId, logEntry) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    episodicBuffer: FieldValue.arrayUnion(logEntry),
    last_reply_date: new Date().toISOString()
  }, { merge: true });
};

const updateCoreProfile = async (userId, profileData) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    coreProfile: profileData,
    episodicBuffer: [] // Flush episodic buffer after dreaming
  }, { merge: true });
};

const incrementGlobalRateLimit = async (type, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

const getGlobalRateLimit = async (type, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 0;
};

const incrementUserDailyLimit = async (userId, dateStr) => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

const getUserDailyLimit = async (userId, dateStr) => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 0;
};

const incrementUserMinuteLimit = async (userId, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`user_minute_${userId}_${timeKey}`);
    await docRef.set({
        count: FieldValue.increment(1)
    }, { merge: true });
};

const getUserMinuteLimit = async (userId, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`user_minute_${userId}_${timeKey}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 0;
};

const getAllUsers = async () => {
    const snapshot = await firestore.collection('users').get();
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    return users;
};

const getDailyActiveUsersCount = async (dateStr) => {
    const docRef = firestore.collection('system_stats').doc(`dau_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 1; // Default to 1 to avoid div by zero
};

const saveRawConversationLog = async (userId, userText, aiText) => {
    // Save as uncompressed raw log for prompt improvement and analysis
    const logRef = firestore.collection('conversation_logs').doc();
    const now = new Date();
    
    // Calculate retention (TTL)
    const expireAt = new Date(now);
    expireAt.setDate(expireAt.getDate() + 30);

    await logRef.set({
        userId,
        userText,
        aiText,
        timestamp: now.toISOString(),
        expireAt: Timestamp.fromDate(expireAt)
    });
};

const getRecentConversationLogs = async (days = 7) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceIso = sinceDate.toISOString();

    // Fetch up to 1000 latest logs (considering token limits and API processing time)
    const snapshot = await firestore.collection('conversation_logs')
        .where('timestamp', '>=', sinceIso)
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();

    const logs = [];
    snapshot.forEach(doc => logs.push(doc.data()));
    return logs;
};

const getExtendedPrompt = async () => {
    const docRef = firestore.collection('system').doc('persona');
    const doc = await docRef.get();
    return doc.exists ? doc.data().extended_prompt || '' : '';
};

const saveExtendedPrompt = async (promptText) => {
    const docRef = firestore.collection('system').doc('persona');
    await docRef.set({
        extended_prompt: promptText,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

const getTimelineSummary = async () => {
    const docRef = firestore.collection('system').doc('persona');
    const doc = await docRef.get();
    return doc.exists ? doc.data().timeline_summary || '' : '';
};

const saveTimelineSummary = async (summaryText) => {
    const docRef = firestore.collection('system').doc('persona');
    await docRef.set({
        timeline_summary: summaryText,
        timelineSummaryUpdatedAt: new Date().toISOString()
    }, { merge: true });
};

const saveTimelinePost = async (text) => {
    const ref = firestore.collection('timeline_history').doc();
    const now = new Date();
    // TTL for 30 days
    const expireAt = new Date(now);
    expireAt.setDate(expireAt.getDate() + 30);
    
    await ref.set({
        text,
        timestamp: now.toISOString(),
        expireAt: Timestamp.fromDate(expireAt)
    });
};

const getRecentTimelinePosts = async (limit = 3) => {
    const snapshot = await firestore.collection('timeline_history')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    
    const posts = [];
    snapshot.forEach(doc => posts.push(doc.data().text));
    return posts.reverse(); // Revert to chronological order
};

const saveRagMemory = async (userId, text, embedding) => {
    const memRef = firestore.collection('rag_memories').doc();
    const now = new Date();
    await memRef.set({
        userId,
        text,
        embedding: FieldValue.vector(embedding),
        timestamp: now.toISOString()
    });

    // Upper limit (cap) management
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

const findRagMemories = async (userId, queryVector, limit = 3) => {
    try {
        const snapshot = await firestore.collection('rag_memories')
            .where('userId', '==', userId)
            .findNearest('embedding', FieldValue.vector(queryVector), {
                limit: limit,
                distanceMeasure: 'COSINE'
            })
            .get();
            
        const memories = [];
        snapshot.forEach(doc => memories.push(doc.data().text));
        return memories;
    } catch (e) {
        console.error('Error during vector search (findNearest):', e);
        // Return empty array to handle errors like missing indexes gracefully
        return [];
    }
};

const getLastMentionId = async () => {
    const docRef = firestore.collection('system').doc('x_api_state');
    const doc = await docRef.get();
    return doc.exists ? doc.data().last_mention_id || null : null;
};

const setLastMentionId = async (mentionId: string) => {
    const docRef = firestore.collection('system').doc('x_api_state');
    await docRef.set({
        last_mention_id: mentionId,
        updatedAt: new Date().toISOString()
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
  setLastMentionId
 };
