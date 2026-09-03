import { Firestore } from '@google-cloud/firestore';
import { UserDetail, UserStatus, PaginatedResponse, ChatMessage } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

/**
 * Repository responsible for data access operations related to user profiles, interactions, and statuses in Firestore.
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

  private resolveUserStatus(data: Record<string, unknown>): UserStatus {
    const s = String(data.status || '').toUpperCase();
    if (s === 'BLOCKED') return UserStatus.BLOCKED;
    if (s === 'MUTED') return UserStatus.MUTED;
    return UserStatus.ACTIVE;
  }

  private calculateRagStats(data: Record<string, unknown>): { ragMemoriesCount: number; ragMemoriesStatus: 'Generated' | 'None' } {
    const hasCoreProfile = !!data.coreProfile && (typeof data.coreProfile === 'object' ? Object.keys(data.coreProfile).length > 0 : String(data.coreProfile).length > 2);
    const hasEpisodic = Array.isArray(data.episodicBuffer) && data.episodicBuffer.length > 0;
    const cp = typeof data.coreProfile === 'object' && data.coreProfile !== null ? (data.coreProfile as Record<string, unknown>) : null;
    const importantMemoriesCount = Array.isArray(cp?.important_memories) ? cp.important_memories.length : 0;
    const episodicCount = Array.isArray(data.episodicBuffer) ? data.episodicBuffer.length : 0;
    const ragMemoriesCount = importantMemoriesCount + episodicCount || (hasCoreProfile ? 1 : 0);
    const ragMemoriesStatus = (hasCoreProfile || hasEpisodic) ? 'Generated' : 'None';

    return { ragMemoriesCount, ragMemoriesStatus };
  }

  /**
   * Retrieves users, supporting pagination, custom ordering, search, and returning detailed user objects.
   * 
   * @returns A promise that resolves to an array of user details.
   */
  async getAll(params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<PaginatedResponse<UserDetail>> {
    let startDate = '';
    let endDate = '';
    if (params?.period && params?.date && params.period !== 'all-time') {
      if (params.period === 'monthly') {
        startDate = `${params.date}-01T00:00:00.000Z`;
        const dateObj = new Date(startDate);
        dateObj.setMonth(dateObj.getMonth() + 1);
        endDate = dateObj.toISOString();
      } else if (params.period === 'yearly') {
        startDate = `${params.date}-01-01T00:00:00.000Z`;
        const dateObj = new Date(startDate);
        dateObj.setFullYear(dateObj.getFullYear() + 1);
        endDate = dateObj.toISOString();
      }
    }

    const allUsersSnap = await this.collections.users.get();
    let usersData = allUsersSnap.docs.map(doc => ({ id: doc.id, data: (doc.data() || {}) as unknown as Record<string, unknown> }));

    if (startDate && endDate) {
      // 1. Query conversation_logs within the date range
      const logsSnap = await this.collections.conversationLogs
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<', endDate)
        .get();

      // 2. Aggregate interaction counts by userId
      const interactionsMap: Record<string, number> = {};
      logsSnap.docs.forEach(doc => {
        const userId = doc.data().userId;
        if (userId) {
          interactionsMap[userId] = (interactionsMap[userId] || 0) + 1;
        }
      });

      // 3. Filter out users with 0 interactions in this period and assign the calculated count
      usersData = usersData.filter(u => (interactionsMap[u.id] || 0) > 0);
      usersData.forEach(u => {
        u.data._dynamicInteractions = interactionsMap[u.id];
      });
    } else {
      // All-time: Aggregate from all conversation_logs to get true all-time interaction counts
      const logsSnap = await this.collections.conversationLogs.get();
      const interactionsMap: Record<string, number> = {};
      logsSnap.docs.forEach(doc => {
        const userId = doc.data().userId;
        if (userId) {
          interactionsMap[userId] = (interactionsMap[userId] || 0) + 1;
        }
      });

      usersData.forEach(u => {
        const loggedCount = interactionsMap[u.id] || 0;
        const rawInteractions = Number(u.data.interactions) || 0;
        const dailyReplyCount = Number(u.data.daily_reply_count) || 0;
        // Total interactions is max of logged conversations, explicit interactions field, or daily reply count
        u.data._dynamicInteractions = Math.max(loggedCount, rawInteractions, dailyReplyCount);
      });
    }

    // Fuzzy / Substring Search filter (by username, name, or id)
    if (params?.search && params.search.trim().length > 0) {
      const q = params.search.trim().toLowerCase().replace(/^@/, '');
      usersData = usersData.filter(u => {
        const id = u.id.toLowerCase();
        const username = String(u.data.username || '').toLowerCase();
        const name = String(u.data.name || '').toLowerCase();
        return id.includes(q) || username.includes(q) || name.includes(q);
      });
    }

    const sortBy = params?.sortBy || 'interactions';
    const sortOrder = params?.sortOrder || 'desc';

    usersData.sort((a, b) => {
      let diff: number;
      if (sortBy === 'interactions' || sortBy === 'daily_reply_count') {
        const countA = Number(a.data._dynamicInteractions) || 0;
        const countB = Number(b.data._dynamicInteractions) || 0;
        diff = sortOrder === 'desc' ? countB - countA : countA - countB;

        // Tie-breaker when interaction counts are identical: sort by most recently active
        if (diff === 0) {
          const timeA = new Date(String(a.data.lastSeen || a.data.last_reply_date || 0)).getTime() || 0;
          const timeB = new Date(String(b.data.lastSeen || b.data.last_reply_date || 0)).getTime() || 0;
          diff = timeB - timeA;
        }
      } else if (sortBy === 'username') {
        const nameA = String(a.data.username || '');
        const nameB = String(b.data.username || '');
        diff = sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
      } else if (sortBy === 'id') {
        diff = sortOrder === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
      } else if (sortBy === 'lastSeen' || sortBy === 'last_reply_date' || sortBy === 'lastInteraction') {
        const timeA = new Date(String(a.data.lastSeen || a.data.last_reply_date || 0)).getTime() || 0;
        const timeB = new Date(String(b.data.lastSeen || b.data.last_reply_date || 0)).getTime() || 0;
        diff = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      } else {
        const valA = Number(a.data[sortBy]) || 0;
        const valB = Number(b.data[sortBy]) || 0;
        diff = sortOrder === 'desc' ? valB - valA : valA - valB;
      }
      return diff;
    });

    const totalItems = usersData.length;
    const limit = params?.limit || 30;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const page = params?.page || 1;
    
    usersData = usersData.slice((page - 1) * limit, page * limit);

    const data: UserDetail[] = usersData.map(u => {
      const data = u.data;
      const status = this.resolveUserStatus(data);
      const { ragMemoriesCount, ragMemoriesStatus } = this.calculateRagStats(data);
      const username = typeof data.username === 'string' ? data.username.trim() : '';
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const firstSeen = typeof data.firstSeen === 'string' ? data.firstSeen : '';
      const lastSeen = typeof data.lastSeen === 'string' ? data.lastSeen : '';

      return {
        id: u.id,
        username,
        name,
        interactions: typeof data._dynamicInteractions === 'number' ? data._dynamicInteractions : 0,
        firstSeen,
        lastSeen,
        coreProfile: typeof data.coreProfile === 'string' ? data.coreProfile : JSON.stringify(data.coreProfile || {}),
        chatHistory: [],
        status,
        ragMemoriesStatus,
        ragMemoriesCount
      };
    });

    return {
      data,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        itemCount: data.length,
        itemsPerPage: limit
      }
    };
  }

  /**
   * Retrieves detailed user profile and status by their user ID or username handle.
   * 
   * @param id - The user ID/handle to look up.
   * @returns A promise that resolves to the detailed user information, or null if the user does not exist.
   */
  async getById(id: string, beforeTimestamp?: string, limit?: number): Promise<UserDetail | null> {
    const rawId = id.replace('@', '').trim();
    let doc = await this.collections.users.doc(rawId).get();
    
    if (!doc.exists) {
      const snap = await this.collections.users.where('username', '==', rawId).limit(1).get();
      if (!snap.empty) {
        doc = snap.docs[0];
      } else {
        return null;
      }
    }

    const data = (doc.data() || {}) as unknown as Record<string, unknown>;
    const resolvedUserId = doc.id;
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const firstSeen = typeof data.firstSeen === 'string' ? data.firstSeen : '';
    const lastSeen = typeof data.lastSeen === 'string' ? data.lastSeen : '';
    
    // Fetch conversation logs from Firestore and sort in-memory to prevent composite index requirements
    const chatLogsSnap = await this.collections.conversationLogs
      .where('userId', '==', resolvedUserId)
      .get();
      
    let sortedDocs = chatLogsSnap.docs.sort((a, b) => {
      const tA = a.data().timestamp || '';
      const tB = b.data().timestamp || '';
      return tA.localeCompare(tB);
    });

    if (beforeTimestamp) {
      sortedDocs = sortedDocs.filter(d => (d.data().timestamp || '') < beforeTimestamp);
    }

    if (limit) {
      sortedDocs = sortedDocs.slice(-limit);
    }

    const chatHistory: ChatMessage[] = [];
    for (const d of sortedDocs) {
      const log = d.data();
      if (log.userText) {
        chatHistory.push({
          from: 'user',
          text: String(log.userText),
          time: String(log.timestamp || '')
        });
      }
      if (log.aiText) {
        chatHistory.push({
          from: 'rebecca',
          text: String(log.aiText),
          time: String(log.timestamp || '')
        });
      }
    }

    // Fallback: If chatHistory is sparse, also check episodicBuffer or rag_memories
    if (chatHistory.length === 0 && Array.isArray(data.episodicBuffer)) {
      for (const entry of data.episodicBuffer as Array<{ role: string; content: string; timestamp?: string }>) {
        if (entry.content) {
          chatHistory.push({
            from: entry.role === 'user' ? 'user' : 'rebecca',
            text: entry.content,
            time: entry.timestamp || String(data.last_reply_date || '')
          });
        }
      }
    }

    const calculatedInteractions = Math.max(
      chatLogsSnap.size,
      chatHistory.length > 0 ? Math.ceil(chatHistory.length / 2) : 0,
      typeof data.interactions === 'number' ? data.interactions : 0,
      typeof data.daily_reply_count === 'number' ? data.daily_reply_count : 0
    );

    const status = this.resolveUserStatus(data);
    const { ragMemoriesCount, ragMemoriesStatus } = this.calculateRagStats(data);

    return {
      id: resolvedUserId,
      username,
      name,
      interactions: calculatedInteractions,
      firstSeen,
      lastSeen,
      coreProfile: typeof data.coreProfile === 'string' ? data.coreProfile : JSON.stringify(data.coreProfile || {}),
      chatHistory,
      status,
      ragMemoriesStatus,
      ragMemoriesCount
    };
  }

  /**
   * Updates a user's core memory profile in Firestore.
   * 
   * @param id - The user ID/handle to update.
   * @param coreProfileJson - The JSON string representing the user's core profile.
   * @returns A promise that resolves when the update is complete.
   */
  async updateMemory(id: string, coreProfileJson: string | Record<string, unknown>): Promise<void> {
    const rawId = id.replace('@', '');
    let parsed: Record<string, unknown>;
    try {
      parsed = typeof coreProfileJson === 'string' ? JSON.parse(coreProfileJson) : coreProfileJson;
    } catch (e) {
      console.error('Failed to parse memory JSON', e);
      return;
    }
    await this.collections.users.doc(rawId).set(
      { coreProfile: parsed },
      { merge: true }
    );
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
