import { Firestore } from '@google-cloud/firestore';
import { UserDetail, UserStatus, PaginatedResponse, ChatMessage } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { logger } from '../../utils/logger';

const MAX_USERS_LIMIT = 100;
const DEFAULT_USERS_LIMIT = 30;
const MAX_USERS_SCAN_LIMIT = 500;
const MAX_PERIOD_LOGS_SCAN_LIMIT = 2000;
const MAX_USER_CHAT_LOGS_LIMIT = 500;

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

  private async countUserConversationLogs(userId: string): Promise<number> {
    const query = this.collections.conversationLogs.where('userId', '==', userId);
    if (typeof (query as unknown as { count?: () => { get: () => Promise<{ data: () => { count?: number } }> } }).count === 'function') {
      const countSnap = await query.count().get();
      return Number(countSnap.data()?.count || 0);
    }
    const snap = await (typeof query.limit === 'function' ? query.limit(MAX_USER_CHAT_LOGS_LIMIT) : query).get();
    return snap.docs ? snap.docs.length : 0;
  }

  /**
   * Retrieves users, supporting bounded pagination, custom ordering, search, and returning detailed user objects
   * without unbounded full-collection scans on `users` or `conversation_logs`.
   * 
   * @returns A promise that resolves to a paginated response of user details.
   */
  async getAll(params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<PaginatedResponse<UserDetail>> {
    const requestedLimit = Number(params?.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_USERS_LIMIT)
        : DEFAULT_USERS_LIMIT;
    const requestedPage = Number(params?.page);
    const page =
      Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

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

    const boundedUsersQuery =
      typeof this.collections.users.limit === 'function'
        ? this.collections.users.limit(MAX_USERS_SCAN_LIMIT)
        : this.collections.users;
    const allUsersSnap = await boundedUsersQuery.get();
    let usersData = allUsersSnap.docs.map(doc => ({ id: doc.id, data: (doc.data() || {}) as unknown as Record<string, unknown> }));

    if (startDate && endDate) {
      // 1. Query conversation_logs within the date range with a safety upper bound
      let periodLogsQuery = this.collections.conversationLogs
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<', endDate);
      if (typeof periodLogsQuery.limit === 'function') {
        periodLogsQuery = periodLogsQuery.limit(MAX_PERIOD_LOGS_SCAN_LIMIT);
      }
      const logsSnap = await periodLogsQuery.get();

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
      // All-time: Use per-user interactions / dailyReplyCount fields without scanning the 5-year conversation_logs collection.
      // For the current page (or when sorting by interactions), resolve exact server-side `.count()` per user.
      usersData.forEach(u => {
        const rawInteractions = Number(u.data.interactions) || 0;
        const dailyReplyCount = Number(u.data.dailyReplyCount ?? u.data.daily_reply_count) || 0;
        const episodicCount = Array.isArray(u.data.episodicBuffer) ? Math.ceil(u.data.episodicBuffer.length / 2) : 0;
        u.data._dynamicInteractions = Math.max(rawInteractions, dailyReplyCount, episodicCount);
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

    // When sorting by interactions in all-time mode and users lack pre-aggregated `interactions` fields,
    // enrich via server-side per-user `.count()` aggregation (bounded to the candidate set).
    if (!startDate && (sortBy === 'interactions' || sortBy === 'daily_reply_count')) {
      await Promise.all(
        usersData.map(async (u) => {
          const loggedCount = await this.countUserConversationLogs(u.id);
          u.data._dynamicInteractions = Math.max(Number(u.data._dynamicInteractions) || 0, loggedCount);
        })
      );
    }

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
    const totalPages = Math.ceil(totalItems / limit) || 1;
    
    usersData = usersData.slice((page - 1) * limit, page * limit);

    // If not already enriched during sort, enrich only the current page's users with server-side `.count()`
    if (!startDate && sortBy !== 'interactions' && sortBy !== 'daily_reply_count') {
      await Promise.all(
        usersData.map(async (u) => {
          const loggedCount = await this.countUserConversationLogs(u.id);
          u.data._dynamicInteractions = Math.max(Number(u.data._dynamicInteractions) || 0, loggedCount);
        })
      );
    }

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
    
    // Fetch conversation logs from Firestore with a safety upper bound and sort in-memory
    let userLogsQuery = this.collections.conversationLogs.where('userId', '==', resolvedUserId);
    if (typeof userLogsQuery.limit === 'function') {
      userLogsQuery = userLogsQuery.limit(MAX_USER_CHAT_LOGS_LIMIT);
    }
    const chatLogsSnap = await userLogsQuery.get();
      
    let sortedDocs = chatLogsSnap.docs.sort((a, b) => {
      const tA = a.data().timestamp || '';
      const tB = b.data().timestamp || '';
      return tA.localeCompare(tB);
    });

    if (beforeTimestamp) {
      sortedDocs = sortedDocs.filter(d => (d.data().timestamp || '') < beforeTimestamp);
    }

    if (limit) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_USERS_LIMIT);
      sortedDocs = sortedDocs.slice(-safeLimit);
    }

    const chatHistory: ChatMessage[] = [];
    for (const d of sortedDocs) {
      const log = d.data();
      if (log.userText) {
        chatHistory.push({
          role: 'user',
          text: String(log.userText),
          time: String(log.timestamp || '')
        });
      }
      if (log.aiText) {
        chatHistory.push({
          role: 'model',
          text: String(log.aiText),
          thought: log.thought ? String(log.thought) : undefined,
          time: String(log.timestamp || '')
        });
      }
    }

    // Fallback: If chatHistory is sparse, also check episodicBuffer or rag_memories
    if (chatHistory.length === 0 && Array.isArray(data.episodicBuffer)) {
      for (const entry of data.episodicBuffer as Array<{ role: string; content: string; thought?: string; timestamp?: string }>) {
        if (entry.content) {
          chatHistory.push({
            role: entry.role === 'user' ? 'user' : 'model',
            text: entry.content,
            thought: entry.role !== 'user' && entry.thought ? String(entry.thought) : undefined,
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
      logger.error('Failed to parse memory JSON for user', e, { userId: id });
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
