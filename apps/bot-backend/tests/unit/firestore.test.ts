/**
 * @fileoverview Comprehensive unit tests for Firestore database service in bot-backend.
 * Tests all CRUD operations, rate limiting helpers, RAG memory search, image retrieval, and list interaction history.
 */

const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocDelete = jest.fn().mockResolvedValue(undefined);

const mockDocRef = {
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
  delete: mockDocDelete,
};

const mockQueryGet = jest.fn();
const mockQueryLimit = jest.fn().mockReturnThis();
const mockQueryOrderBy = jest.fn().mockReturnThis();
const mockQueryWhere = jest.fn().mockReturnThis();
const mockFindNearest = jest.fn().mockReturnThis();

const mockCollection = {
  doc: jest.fn().mockReturnValue(mockDocRef),
  get: mockQueryGet,
  limit: mockQueryLimit,
  orderBy: mockQueryOrderBy,
  where: mockQueryWhere,
  findNearest: mockFindNearest,
  withConverter: jest.fn().mockReturnThis(),
};

const mockRunTransaction = jest.fn();
const mockBatch = jest.fn().mockReturnValue({
  set: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
});

jest.mock('@google-cloud/firestore', () => {
  return {
    Firestore: jest.fn().mockImplementation(() => ({
      collection: jest.fn().mockReturnValue(mockCollection),
      runTransaction: mockRunTransaction,
      batch: mockBatch,
    })),
    FieldValue: {
      arrayUnion: jest.fn((val) => ({ _type: 'arrayUnion', val })),
      increment: jest.fn((val) => ({ _type: 'increment', val })),
      serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
      vector: jest.fn((v) => ({ _type: 'vector', v })),
    },
    Timestamp: {
      now: jest.fn(() => ({ toDate: () => new Date() })),
    },
  };
});

jest.mock('@rebecca/db', () => {
  return {
    COLLECTIONS: {
      USERS: 'users',
      CONVERSATION_LOGS: 'conversation_logs',
      TIMELINE_HISTORY: 'timeline_history',
      RAG_MEMORIES: 'rag_memories',
      RATE_LIMITS: 'rate_limits',
      SYSTEM: 'system',
      SYSTEM_STATS: 'system_stats',
      PROCESSED_MENTIONS: 'processed_mentions',
      IMAGES: 'images',
      PROCESSED_FOLLOWERS: 'processed_followers',
      LIST_INTERACTION_HISTORY: 'list_interaction_history',
    },
    getCollections: jest.fn(() => ({
      users: mockCollection,
      conversationLogs: mockCollection,
      timelineHistory: mockCollection,
      ragMemories: mockCollection,
      images: mockCollection,
      processedFollowers: mockCollection,
      listInteractionHistory: mockCollection,
      rateLimits: mockCollection,
      system: mockCollection,
      systemStats: mockCollection,
      processedMentions: mockCollection,
    })),
  };
});

import * as firestoreService from '../../src/services/firestore';

describe('Firestore Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.doc.mockReturnValue(mockDocRef);
    mockQueryLimit.mockReturnThis();
    mockQueryOrderBy.mockReturnThis();
    mockQueryWhere.mockReturnThis();
    mockFindNearest.mockReturnThis();
  });

  describe('User Operations', () => {
    it('getUserDoc should return user when doc exists', async () => {
      const mockUser = { user_id: 'u1', status: 'ACTIVE' };
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => mockUser,
      });

      const user = await firestoreService.getUserDoc('u1');
      expect(user).toEqual(mockUser);
    });

    it('getUserDoc should return null when doc does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: false,
        data: () => null,
      });

      const user = await firestoreService.getUserDoc('u_not_found');
      expect(user).toBeNull();
    });

    it('updateUserDoc should merge user data', async () => {
      await firestoreService.updateUserDoc('u1', { daily_reply_count: 5 });
      expect(mockDocSet).toHaveBeenCalledWith({ daily_reply_count: 5 }, { merge: true });
    });

    it('appendEpisodicBuffer should append turn with FieldValue.arrayUnion', async () => {
      const entry = { role: 'user' as const, content: 'hello', timestamp: '2026-01-01T00:00:00Z' };
      await firestoreService.appendEpisodicBuffer('u1', entry);
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('updateCoreProfile should replace coreProfile and reset episodicBuffer', async () => {
      const profile = { name: 'Test', affinityScore: 10, interests: ['coding'] } as any;
      await firestoreService.updateCoreProfile('u1', profile);
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('getAllUsers should return all users from collection snapshot', async () => {
      mockQueryGet.mockResolvedValueOnce({
        forEach: (cb: any) => [
          { id: 'u1', data: () => ({ user_id: 'u1' }) },
          { id: 'u2', data: () => ({ user_id: 'u2' }) },
        ].forEach(cb),
        docs: [
          { id: 'u1', data: () => ({ user_id: 'u1' }) },
          { id: 'u2', data: () => ({ user_id: 'u2' }) },
        ],
      });

      const users = await firestoreService.getAllUsers();
      expect(users).toHaveLength(2);
      expect(users[0].id).toBe('u1');
    });

    it('getDailyActiveUsersCount should return count of active users', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 3 }),
      });

      const count = await firestoreService.getDailyActiveUsersCount('2026-01-01');
      expect(count).toBe(3);
    });

    it('getDailyActiveUsersCount should return 1 if doc does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: false,
      });

      const count = await firestoreService.getDailyActiveUsersCount('2026-01-01');
      expect(count).toBe(1);
    });
  });

  describe('Rate Limiting Helpers', () => {
    it('incrementGlobalRateLimit should increment global rate limit doc', async () => {
      await firestoreService.incrementGlobalRateLimit('daily', '2026-01-01');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('getGlobalRateLimit should return count or 0', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 42 }),
      });
      const count = await firestoreService.getGlobalRateLimit('daily', '2026-01-01');
      expect(count).toBe(42);

      mockDocGet.mockResolvedValueOnce({ exists: false });
      const zero = await firestoreService.getGlobalRateLimit('daily', '2026-01-01');
      expect(zero).toBe(0);
    });

    it('incrementUserDailyLimit and getUserDailyLimit', async () => {
      await firestoreService.incrementUserDailyLimit('u1', '2026-01-01');
      expect(mockDocSet).toHaveBeenCalled();

      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: 5 }) });
      const count = await firestoreService.getUserDailyLimit('u1', '2026-01-01');
      expect(count).toBe(5);

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getUserDailyLimit('u1', '2026-01-01')).toBe(0);
    });

    it('incrementUserMinuteLimit and getUserMinuteLimit', async () => {
      await firestoreService.incrementUserMinuteLimit('u1', '2026-01-01-12-00');
      expect(mockDocSet).toHaveBeenCalled();

      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: 2 }) });
      const count = await firestoreService.getUserMinuteLimit('u1', '2026-01-01-12-00');
      expect(count).toBe(2);

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getUserMinuteLimit('u1', '2026-01-01-12-00')).toBe(0);
    });

    it('checkAndConsumeRateLimit should reject when minute spam limit is exceeded', async () => {
      mockRunTransaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 0 }) }) // globalDoc
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ daily: 0, minute: 5, lastMinute: '2026-01-01T12:00' }),
            }) // userDoc
            .mockResolvedValueOnce({ exists: true, data: () => ({ count: 1 }) }), // dauDoc
          set: jest.fn(),
        };
        return callback(mockTx);
      });

      const res = await firestoreService.checkAndConsumeRateLimit(
        'u1',
        '2026-01-01',
        '2026-01',
        '2026-01-01T12:00',
        { globalDaily: 100, spamMinute: 5 }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('user_minute_spam');
    });

    it('checkAndConsumeRateLimit should reject when global daily limit is exceeded', async () => {
      mockRunTransaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 100 }) }) // globalDoc
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ daily: 0, minute: 0, lastMinute: '2026-01-01T11:00' }),
            }) // userDoc
            .mockResolvedValueOnce({ exists: true, data: () => ({ count: 1 }) }), // dauDoc
          set: jest.fn(),
        };
        return callback(mockTx);
      });

      const res = await firestoreService.checkAndConsumeRateLimit(
        'u1',
        '2026-01-01',
        '2026-01',
        '2026-01-01T12:00',
        { globalDaily: 100, spamMinute: 5 }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('global_daily');
    });

    it('checkAndConsumeRateLimit should reject when dynamic user limit is exceeded', async () => {
      mockRunTransaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          get: jest
            .fn()
            .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 0 }) }) // globalDoc
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ daily: 50, minute: 0, lastMinute: '2026-01-01T11:00' }),
            }) // userDoc
            .mockResolvedValueOnce({ exists: true, data: () => ({ count: 10 }) }), // dauDoc
          set: jest.fn(),
        };
        return callback(mockTx);
      });

      const res = await firestoreService.checkAndConsumeRateLimit(
        'u1',
        '2026-01-01',
        '2026-01',
        '2026-01-01T12:00',
        { globalDaily: 100, spamMinute: 5 }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('user_daily');
    });

    it('checkAndConsumeRateLimit should allow and consume when quotas available', async () => {
      mockRunTransaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          get: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              exists: true,
              data: () => ({ daily: 0, minute: 0, lastMinute: '2026-01-01T12:00' }),
            });
          }),
          set: jest.fn(),
        };
        return callback(mockTx);
      });

      const res = await firestoreService.checkAndConsumeRateLimit(
        'u1',
        '2026-01-01',
        '2026-01',
        '2026-01-01T12:00',
        { globalDaily: 100, spamMinute: 5 }
      );
      expect(res.allowed).toBe(true);
    });
  });

  describe('Logs, Extended Prompts & Timeline Summaries', () => {
    it('saveRawConversationLog should save log to conversation_logs', async () => {
      await firestoreService.saveRawConversationLog('u1', 'hi', 'hello');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('getRecentConversationLogs should query logs ordered by timestamp desc', async () => {
      mockQueryGet.mockResolvedValueOnce({
        forEach: (cb: any) => [{ data: () => ({ userId: 'u1', aiText: 'hello' }) }].forEach(cb),
        docs: [
          { data: () => ({ userId: 'u1', aiText: 'hello' }) },
        ],
      });

      const logs = await firestoreService.getRecentConversationLogs(5);
      expect(logs).toHaveLength(1);
    });

    it('getExtendedPrompt and saveExtendedPrompt', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ extended_prompt: 'Extended persona context' }),
      });
      const prompt = await firestoreService.getExtendedPrompt();
      expect(prompt).toBe('Extended persona context');

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getExtendedPrompt()).toBe('');

      await firestoreService.saveExtendedPrompt('New extended prompt');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('getTimelineSummary and saveTimelineSummary', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ timeline_summary: 'Summary text' }),
      });
      const summary = await firestoreService.getTimelineSummary();
      expect(summary).toBe('Summary text');

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getTimelineSummary()).toBe('');

      await firestoreService.saveTimelineSummary('New summary');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('saveTimelinePost and getRecentTimelinePosts', async () => {
      await firestoreService.saveTimelinePost('Post content');
      expect(mockDocSet).toHaveBeenCalled();

      mockQueryGet.mockResolvedValueOnce({
        forEach: (cb: any) => [{ data: () => ({ text: 'Post content' }) }].forEach(cb),
        docs: [{ data: () => ({ text: 'Post content' }) }],
      });
      const posts = await firestoreService.getRecentTimelinePosts(3);
      expect(posts).toHaveLength(1);
    });
  });

  describe('RAG Memory, Mentions, Images & List Interactions', () => {
    it('saveRagMemory and findRagMemories', async () => {
      mockQueryGet.mockResolvedValueOnce({
        size: 0,
        docs: [],
      });
      await firestoreService.saveRagMemory('u1', 'Fact: Loves coffee', [0.1, 0.2]);
      expect(mockDocSet).toHaveBeenCalled();

      mockQueryGet.mockResolvedValueOnce({
        empty: false,
        size: 1,
        forEach: function (cb: (doc: any) => void) {
          this.docs.forEach(cb);
        },
        docs: [{ id: 'doc_rag_1', data: () => ({ text: 'Fact: Loves coffee' }) }],
      });
      const memories = await firestoreService.findRagMemories('u1', [0.1, 0.2], 3);
      expect(memories).toHaveLength(1);
      expect(memories[0]).toBe('Fact: Loves coffee');
    });

    it('getLastMentionId and setLastMentionId', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ last_mention_id: '123456' }),
      });
      expect(await firestoreService.getLastMentionId()).toBe('123456');

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getLastMentionId()).toBeNull();

      await firestoreService.setLastMentionId('654321');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('hasProcessedMention and markMentionProcessed', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true });
      expect(await firestoreService.hasProcessedMention('m1')).toBe(true);

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.hasProcessedMention('m2')).toBe(false);

      await firestoreService.markMentionProcessed('m1');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('saveImageMetadata and getImageByHash', async () => {
      await firestoreService.saveImageMetadata('img1', 'https://example.com/img.png', 'test image caption', [0.1, 0.2]);
      expect(mockDocSet).toHaveBeenCalled();

      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'img1',
        data: () => ({ filename: 'test.png' }),
      });
      const img = await firestoreService.getImageByHash('hash123');
      expect(img).toBeDefined();

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getImageByHash('none')).toBeNull();
    });

    it('findImageByVector and updateImageLastUsed', async () => {
      mockQueryGet.mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [
          {
            id: 'img1',
            data: () => ({
              filename: 'test.png',
              lastUsedAt: null,
            }),
          },
        ],
      });

      const img = await firestoreService.findImageByVector([0.1, 0.2]);
      expect(img).toBeDefined();
      expect(img?.id).toBe('img1');

      await firestoreService.updateImageLastUsed('img1');
      expect(mockDocSet).toHaveBeenCalled();
    });

    it('saveRagMemory should prune oldest memories when exceeding maxMemories', async () => {
      mockQueryGet.mockResolvedValueOnce({
        size: 105,
        docs: Array.from({ length: 105 }, (_, i) => ({
          ref: { id: `mem_${i}` },
        })),
      });
      await firestoreService.saveRagMemory('u1', 'New memory', [0.1, 0.2]);
      expect(mockBatch).toHaveBeenCalled();
    });

    it('findRagMemories should return empty array on vector search error', async () => {
      mockQueryGet.mockRejectedValueOnce(new Error('Vector index building'));
      const memories = await firestoreService.findRagMemories('u1', [0.1, 0.2], 3);
      expect(memories).toEqual([]);
    });

    it('findImageByVector should return null on vector search error', async () => {
      mockQueryGet.mockRejectedValueOnce(new Error('Vector search failed'));
      const img = await firestoreService.findImageByVector([0.1, 0.2]);
      expect(img).toBeNull();
    });

    it('findImageByVector should skip images within cooldown period', async () => {
      const recentDate = new Date(); // just used
      mockQueryGet.mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [
          {
            id: 'img_cooldown',
            data: () => ({
              filename: 'recent.png',
              lastUsedAt: recentDate.toISOString(),
            }),
          },
        ],
      });

      const img = await firestoreService.findImageByVector([0.1, 0.2]);
      expect(img).toBeNull();
    });

    it('hasProcessedFollower, markFollowerProcessed, getLastListInteraction, updateLastListInteraction', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true });
      expect(await firestoreService.hasProcessedFollower('f1')).toBe(true);

      await firestoreService.markFollowerProcessed('f1');
      expect(mockDocSet).toHaveBeenCalled();

      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ userId: 'l1', lastInteractionAt: { toDate: () => new Date() } }),
      });
      const interaction = await firestoreService.getLastListInteraction('l1');
      expect(interaction).toBeDefined();

      mockDocGet.mockResolvedValueOnce({ exists: false });
      expect(await firestoreService.getLastListInteraction('l2')).toBeNull();

      await firestoreService.updateLastListInteraction('l1');
      expect(mockDocSet).toHaveBeenCalled();
    });
  });
});
