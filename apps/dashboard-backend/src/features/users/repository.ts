import { Firestore, Query } from '@google-cloud/firestore';
import { UserDetail, UserStatus } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

interface UserDoc {
  status?: string;
  daily_reply_count?: number;
  affinity_score?: number;
  first_seen_date?: string;
  last_reply_date?: string;
  coreProfile?: {
    name?: string;
    [key: string]: unknown;
  };
}

/**
 * Repository class for managing user profile details, interactions, and statuses in Firestore.
 */
export class UsersRepository {
  private collections;
  private firestore: Firestore;

  /**
   * Creates an instance of UsersRepository.
   * 
   * @param firestore - The Firestore instance.
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves users, supporting pagination, custom ordering, and returning detailed user objects.
   * 
   * @returns A promise that resolves to an array of user details.
   */
  async getAll(params?: { limit?: number; startAfterId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; }): Promise<UserDetail[]> {
    let query: Query = this.collections.users;
    
    const sortBy = params?.sortBy || 'daily_reply_count';
    const sortOrder = params?.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    if (params?.startAfterId) {
      const doc = await this.collections.users.doc(params.startAfterId.replace('@', '')).get();
      if (doc.exists) {
        query = query.startAfter(doc);
      }
    }

    const limit = params?.limit || 50;
    query = query.limit(limit);

    const snapshot = await query.get();
    
    const users: UserDetail[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as UserDoc;
      const rawId = doc.id;
      
      let status: UserStatus = UserStatus.ACTIVE;
      if (data.status) {
        const s = data.status.toUpperCase();
        if (s === 'ACTIVE') status = UserStatus.ACTIVE;
        else if (s === 'BLOCKED') status = UserStatus.BLOCKED;
        else if (s === 'MUTED') status = UserStatus.MUTED;
      }

      users.push({
        handle: `@${rawId}`,
        name: (data.coreProfile && typeof data.coreProfile.name === 'string') ? data.coreProfile.name : 'Unknown',
        interactions: data.daily_reply_count || 0,
        affinityScore: data.affinity_score !== undefined ? `${data.affinity_score}%` : 'N/A',
        firstSeen: data.first_seen_date || 'N/A',
        lastSeen: data.last_reply_date || 'N/A',
        coreProfile: JSON.stringify(data.coreProfile || {}),
        chatHistory: [], // chat history is loaded on demand for individual drawer
        status
      });
    }

    return users;
  }

  /**
   * Retrieves detailed user profile and status by their user ID.
   * 
   * @param id - The user ID/handle to look up.
   * @returns A promise that resolves to the detailed user information, or null if the user does not exist.
   */
  async getById(id: string, beforeTimestamp?: string, limit?: number): Promise<UserDetail | null> {
    const rawId = id.replace('@', '');
    const doc = await this.collections.users.doc(rawId).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as UserDoc;
    
    // Fetch conversation logs from Firestore and sort in-memory to prevent composite index requirements
    const chatLogsSnap = await this.collections.conversationLogs
      .where('userId', '==', rawId)
      .get();
      
    let sortedDocs = chatLogsSnap.docs.sort((a, b) => {
      const tA = a.data().timestamp || '';
      const tB = b.data().timestamp || '';
      return tA.localeCompare(tB);
    });

    // Handle beforeTimestamp pagination filter
    if (beforeTimestamp) {
      sortedDocs = sortedDocs.filter(d => {
        const t = d.data().timestamp || '';
        return t < beforeTimestamp;
      });
    }

    // Handle limit filter
    if (limit) {
      sortedDocs = sortedDocs.slice(-limit);
    }

    const chatHistory = [];
    for (const logDoc of sortedDocs) {
      const logData = logDoc.data();
      chatHistory.push({
        from: 'user' as const,
        text: logData.userText || '',
        time: logData.timestamp || ''
      });
      chatHistory.push({
        from: 'rebecca' as const,
        text: logData.aiText || '',
        time: logData.timestamp || ''
      });
    }

    let status: UserStatus = UserStatus.ACTIVE;
    if (data.status) {
      const s = data.status.toUpperCase();
      if (s === 'ACTIVE') status = UserStatus.ACTIVE;
      else if (s === 'BLOCKED') status = UserStatus.BLOCKED;
      else if (s === 'MUTED') status = UserStatus.MUTED;
    }

    return {
      handle: `@${rawId}`,
      name: (data.coreProfile && typeof data.coreProfile.name === 'string') ? data.coreProfile.name : 'Unknown',
      interactions: data.daily_reply_count || 0,
      affinityScore: data.affinity_score !== undefined ? `${data.affinity_score}%` : 'N/A',
      firstSeen: data.first_seen_date || 'N/A',
      lastSeen: data.last_reply_date || 'N/A',
      coreProfile: JSON.stringify(data.coreProfile || {}),
      chatHistory,
      status
    };
  }

  /**
   * Updates a user's core memory profile in Firestore.
   * 
   * @param id - The user ID/handle to update.
   * @param coreProfileJson - The JSON string representing the user's core profile.
   * @returns A promise that resolves when the update is complete.
   */
  async updateMemory(id: string, coreProfileJson: string): Promise<void> {
    const rawId = id.replace('@', '');
    try {
      const parsed = JSON.parse(coreProfileJson);
      await this.collections.users.doc(rawId).set(
        { coreProfile: parsed },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to parse and update memory', e);
    }
  }

  /**
   * Updates status for multiple users in a bulk operation.
   * 
   * @param id - The array of user IDs/handles to update.
   * @param status - The new status (Active, Blocked, Muted) to apply.
   * @returns A promise that resolves when the batch write is complete.
   */
  async updateStatusBulk(ids: string[], status: UserStatus): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      const rawId = id.replace('@', '');
      batch.set(this.collections.users.doc(rawId), { status }, { merge: true });
    }
    await batch.commit();
  }
}
