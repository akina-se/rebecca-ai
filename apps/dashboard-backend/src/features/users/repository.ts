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

  private resolveUserName(rawId: string, data: Record<string, unknown>): string {
    if (data.name && data.name !== 'Unknown') return String(data.name);
    if (data.coreProfile) {
      if (typeof data.coreProfile === 'object' && data.coreProfile !== null) {
        const cp = data.coreProfile as Record<string, unknown>;
        if (cp.name && cp.name !== 'Unknown') {
          return String(cp.name);
        }
      }
      if (typeof data.coreProfile === 'string') {
        try {
          const parsed = JSON.parse(data.coreProfile);
          if (parsed && parsed.name && parsed.name !== 'Unknown') return String(parsed.name);
        } catch {
          // Ignore JSON parse error
        }
      }
    }
    const formatted = rawId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return formatted || `@${rawId}`;
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
      // All-time: just use their overall interactions from seed or calculate all-time
      usersData.forEach(u => {
        u.data._dynamicInteractions = u.data.interactions || u.data.daily_reply_count || 0;
      });
    }

    // Fuzzy / Substring Search filter (by handle, name, or userId)
    if (params?.search && params.search.trim().length > 0) {
      const q = params.search.trim().toLowerCase().replace(/^@/, '');
      usersData = usersData.filter(u => {
        const handle = u.id.toLowerCase();
        const name = String(u.data.name || '').toLowerCase();
        return handle.includes(q) || name.includes(q);
      });
    }

    const sortBy = params?.sortBy || 'interactions';
    const sortOrder = params?.sortOrder || 'desc';

    usersData.sort((a, b) => {
      let valA: unknown = a.data[sortBy];
      let valB: unknown = b.data[sortBy];
      
      if (sortBy === 'interactions' || sortBy === 'daily_reply_count') {
        valA = Number(a.data._dynamicInteractions) || 0;
        valB = Number(b.data._dynamicInteractions) || 0;
      } else if (sortBy === 'handle' || sortBy === 'userId' || sortBy === 'id') {
        valA = a.id.toLowerCase();
        valB = b.id.toLowerCase();
        if (sortOrder === 'desc') return String(valB).localeCompare(String(valA));
        return String(valA).localeCompare(String(valB));
      } else if (sortBy === 'lastSeen' || sortBy === 'last_reply_date' || sortBy === 'lastInteraction') {
        valA = new Date(String(a.data.lastSeen || a.data.last_reply_date || 0)).getTime();
        valB = new Date(String(b.data.lastSeen || b.data.last_reply_date || 0)).getTime();
      }
      
      const numA = typeof valA === 'number' ? valA : 0;
      const numB = typeof valB === 'number' ? valB : 0;
      if (sortOrder === 'desc') return numB < numA ? -1 : numB > numA ? 1 : 0;
      return numA < numB ? -1 : numA > numB ? 1 : 0;
    });

    const totalItems = usersData.length;
    const limit = params?.limit || 30;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const page = params?.page || 1;
    
    usersData = usersData.slice((page - 1) * limit, page * limit);

    const data = usersData.map(u => {
      const data = u.data;
      let status: UserStatus = UserStatus.ACTIVE;
      if (data.status) {
        const s = String(data.status).toUpperCase();
        if (s === 'ACTIVE') status = UserStatus.ACTIVE;
        else if (s === 'BLOCKED') status = UserStatus.BLOCKED;
        else if (s === 'MUTED') status = UserStatus.MUTED;
      }

      // Calculate real RAG memories status and count
      const hasCoreProfile = !!data.coreProfile && (typeof data.coreProfile === 'object' ? Object.keys(data.coreProfile).length > 0 : String(data.coreProfile).length > 2);
      const hasEpisodic = Array.isArray(data.episodicBuffer) && data.episodicBuffer.length > 0;
      const cp = typeof data.coreProfile === 'object' && data.coreProfile !== null ? (data.coreProfile as Record<string, unknown>) : null;
      const importantMemoriesCount = Array.isArray(cp?.important_memories) ? cp.important_memories.length : 0;
      const episodicCount = Array.isArray(data.episodicBuffer) ? data.episodicBuffer.length : 0;
      const ragMemoriesCount = importantMemoriesCount + episodicCount || (hasCoreProfile ? 1 : 0);
      const ragMemoriesStatus = (hasCoreProfile || hasEpisodic) ? 'Generated' : 'None';

      return {
        id: u.id,
        handle: `@${u.id}`,
        userId: u.id,
        name: this.resolveUserName(u.id, data),
        interactions: typeof data._dynamicInteractions === 'number' ? data._dynamicInteractions : 0,
        affinityScore: data.affinityScore !== undefined ? `${data.affinityScore}` : (data.affinity_score !== undefined ? `${data.affinity_score}%` : 'N/A'),
        firstSeen: String(data.firstSeen || data.first_seen_date || 'N/A'),
        lastSeen: String(data.lastSeen || data.last_reply_date || 'N/A'),
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

    const data = (doc.data() || {}) as unknown as Record<string, unknown>;
    
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

    let status: UserStatus = UserStatus.ACTIVE;
    if (data.status) {
      const s = String(data.status).toUpperCase();
      if (s === 'ACTIVE') status = UserStatus.ACTIVE;
      else if (s === 'BLOCKED') status = UserStatus.BLOCKED;
      else if (s === 'MUTED') status = UserStatus.MUTED;
    }

    // Calculate real RAG memories status and count
    const hasCoreProfile = !!data.coreProfile && (typeof data.coreProfile === 'object' ? Object.keys(data.coreProfile).length > 0 : String(data.coreProfile).length > 2);
    const hasEpisodic = Array.isArray(data.episodicBuffer) && data.episodicBuffer.length > 0;
    const cp = typeof data.coreProfile === 'object' && data.coreProfile !== null ? (data.coreProfile as Record<string, unknown>) : null;
    const importantMemoriesCount = Array.isArray(cp?.important_memories) ? cp.important_memories.length : 0;
    const episodicCount = Array.isArray(data.episodicBuffer) ? data.episodicBuffer.length : 0;
    const ragMemoriesCount = importantMemoriesCount + episodicCount || (hasCoreProfile ? 1 : 0);
    const ragMemoriesStatus = (hasCoreProfile || hasEpisodic) ? 'Generated' : 'None';

    return {
      id: rawId,
      handle: `@${rawId}`,
      name: this.resolveUserName(rawId, data),
      interactions: typeof data.interactions === 'number' ? data.interactions : (typeof data.daily_reply_count === 'number' ? data.daily_reply_count : 0),
      affinityScore: data.affinity_score !== undefined ? `${data.affinity_score}%` : (data.affinityScore !== undefined ? `${data.affinityScore}` : 'N/A'),
      firstSeen: String(data.first_seen_date || data.firstSeen || 'N/A'),
      lastSeen: String(data.last_reply_date || data.lastSeen || 'N/A'),
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
