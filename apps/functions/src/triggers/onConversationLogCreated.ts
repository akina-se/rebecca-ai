import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const COLLECTIONS = {
  USERS: 'users',
  CONVERSATION_LOGS: 'conversation_logs',
  SYSTEM_STATS: 'system_stats',
} as const;

interface RawConversationLog {
  userId?: string;
  userText?: string;
  aiText?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Cloud Function trigger that executes when a new conversation log document is created in Firestore.
 * Updates user statistics (daily reply count, last reply date) and Daily Active Users (DAU) system stats.
 */
export const onConversationLogCreated = onDocumentCreated(
  `${COLLECTIONS.CONVERSATION_LOGS}/{logId}`,
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const log = snapshot.data() as RawConversationLog;
    if (!log.userId) {
      console.log('No userId in the conversation log');
      return;
    }

    const db = getFirestore();
    const batch = db.batch();

    // Update User Stats (dailyReplyCount and lastReplyDate)
    const userRef = db.collection(COLLECTIONS.USERS).doc(log.userId);
    const nowIso = log.timestamp || new Date().toISOString();
    batch.set(
      userRef,
      {
        dailyReplyCount: FieldValue.increment(1),
        lastReplyDate: nowIso,
        lastSeen: nowIso,
      },
      { merge: true }
    );

    // Update DAU (Daily Active Users) System Stats
    // Format timestamp to YYYY-MM-DD
    const dateStr = log.timestamp ? log.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
    const dauRef = db.collection(COLLECTIONS.SYSTEM_STATS).doc(`dau_${dateStr}`);
    
    // We can use an array union to keep track of unique active users today
    batch.set(
      dauRef,
      {
        date: dateStr,
        active_users: FieldValue.arrayUnion(log.userId),
        // For simple numeric count in dashboard, we could increment a raw counter,
        // but array size is more accurate for DAU to prevent double counting same user.
        // We will increment total_interactions for the day as well.
        total_interactions: FieldValue.increment(1),
      },
      { merge: true }
    );

    // Commit the batch
    await batch.commit();
    console.log(`Successfully updated stats for user ${log.userId} and DAU for ${dateStr}`);
  }
);
