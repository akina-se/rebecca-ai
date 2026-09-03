import { Timestamp } from '@google-cloud/firestore';
import {
  COLLECTIONS,
  getCollections,
  userConverter,
  conversationLogConverter,
  timelinePostConverter,
  ragMemoryConverter,
  imageDocConverter,
  processedFollowerConverter,
  listInteractionConverter,
  rateLimitConverter,
  personaConverter,
  xApiStateConverter,
} from '../../src/index';
import { UserStatus, PostStatus, AssetStatus, FirestoreUser, TimelinePost, ImageDoc } from '@rebecca/types';

describe('@rebecca/db Unit Tests', () => {
  describe('COLLECTIONS constants', () => {
    it('should define all required collection names correctly', () => {
      expect(COLLECTIONS.USERS).toBe('users');
      expect(COLLECTIONS.CONVERSATION_LOGS).toBe('conversation_logs');
      expect(COLLECTIONS.TIMELINE_HISTORY).toBe('timeline_history');
      expect(COLLECTIONS.RAG_MEMORIES).toBe('rag_memories');
      expect(COLLECTIONS.RATE_LIMITS).toBe('rate_limits');
      expect(COLLECTIONS.SYSTEM).toBe('system');
      expect(COLLECTIONS.SYSTEM_STATS).toBe('system_stats');
      expect(COLLECTIONS.PROCESSED_MENTIONS).toBe('processed_mentions');
      expect(COLLECTIONS.IMAGES).toBe('images');
      expect(COLLECTIONS.PROCESSED_FOLLOWERS).toBe('processed_followers');
      expect(COLLECTIONS.LIST_INTERACTION_HISTORY).toBe('list_interaction_history');
    });
  });

  describe('userConverter', () => {
    it('toFirestore should return plain document data', () => {
      const user: FirestoreUser = {
        id: 'u1',
        name: 'User 1',
        username: 'user1',
        avatarUrl: 'https://avatar.png',
        status: UserStatus.ACTIVE,
        firstSeen: '2026-01-01T00:00:00Z',
        lastSeen: '2026-01-02T00:00:00Z',
        coreProfile: { persona: 'Friendly' },
        episodicBuffer: [{ role: 'user', content: 'hello' }],
      };
      expect(userConverter.toFirestore(user)).toEqual(user);
    });

    it('fromFirestore should map snapshot data correctly with defaults', () => {
      const mockSnapshot = {
        id: 'u1',
        data: () => ({
          name: 'User 1',
          username: 'user1',
          avatarUrl: 'https://avatar.png',
          status: UserStatus.ACTIVE,
          firstSeen: '2026-01-01T00:00:00Z',
          lastSeen: '2026-01-02T00:00:00Z',
        }),
      } as any;

      const result = userConverter.fromFirestore(mockSnapshot);
      expect(result.id).toBe('u1');
      expect(result.name).toBe('User 1');
      expect(result.username).toBe('user1');
      expect(result.coreProfile).toEqual({});
      expect(result.episodicBuffer).toEqual([]);
    });

    it('fromFirestore should handle snake_case and missing fields', () => {
      const mockSnapshot = {
        id: 'u2',
        data: () => ({
          first_seen: '2026-02-01T00:00:00Z',
          last_seen: '2026-02-02T00:00:00Z',
          last_reply_date: '2026-02-03T00:00:00Z',
          daily_reply_count: 5,
        }),
      } as any;

      const result = userConverter.fromFirestore(mockSnapshot);
      expect(result.id).toBe('u2');
      expect(result.name).toBe('');
      expect(result.username).toBe('');
      expect(result.avatarUrl).toBe('');
      expect(result.firstSeen).toBe('2026-02-01T00:00:00Z');
      expect(result.lastSeen).toBe('2026-02-02T00:00:00Z');
      expect(result.lastReplyDate).toBe('2026-02-03T00:00:00Z');
      expect(result.dailyReplyCount).toBe(5);
    });

    it('fromFirestore should fallback lastSeen to last_reply_date when both lastSeen and last_seen are missing', () => {
      const mockSnapshot = {
        id: 'u3',
        data: () => ({
          last_reply_date: '2026-03-01T00:00:00Z',
        }),
      } as any;

      const result = userConverter.fromFirestore(mockSnapshot);
      expect(result.lastSeen).toBe('2026-03-01T00:00:00Z');
    });
  });

  describe('conversationLogConverter', () => {
    it('toFirestore should convert expireAt string to Timestamp', () => {
      const iso = '2026-05-01T12:00:00.000Z';
      const log = {
        userId: 'u1',
        userText: 'hello',
        aiText: 'hi',
        timestamp: '2026-04-01T12:00:00.000Z',
        expireAt: iso,
      };
      const result = conversationLogConverter.toFirestore(log);
      expect(result.expireAt).toBeInstanceOf(Timestamp);
    });

    it('toFirestore should handle null/empty expireAt', () => {
      const log = {
        userId: 'u1',
        userText: 'hello',
        aiText: 'hi',
        timestamp: '2026-04-01T12:00:00.000Z',
      };
      const result = conversationLogConverter.toFirestore(log as any);
      expect(result.expireAt).toBeNull();
    });

    it('fromFirestore should convert Timestamp to ISO string', () => {
      const d = new Date('2026-05-01T12:00:00.000Z');
      const mockSnapshot = {
        data: () => ({
          userId: 'u1',
          userText: 'hello',
          aiText: 'hi',
          timestamp: '2026-04-01T12:00:00.000Z',
          expireAt: Timestamp.fromDate(d),
        }),
      } as any;

      const result = conversationLogConverter.fromFirestore(mockSnapshot);
      expect(result.expireAt).toBe(d.toISOString());
    });

    it('fromFirestore should handle null/Date/string expireAt', () => {
      const d = new Date('2026-05-01T12:00:00.000Z');
      const mockSnapshot1 = {
        data: () => ({
          userId: 'u1',
          expireAt: d,
        }),
      } as any;
      expect(conversationLogConverter.fromFirestore(mockSnapshot1).expireAt).toBe(d.toISOString());

      const mockSnapshot2 = {
        data: () => ({
          userId: 'u1',
          expireAt: 'already-iso',
        }),
      } as any;
      expect(conversationLogConverter.fromFirestore(mockSnapshot2).expireAt).toBe('already-iso');

      const mockSnapshot3 = {
        data: () => ({
          userId: 'u1',
          expireAt: null,
        }),
      } as any;
      expect(conversationLogConverter.fromFirestore(mockSnapshot3).expireAt).toBe('');
    });
  });

  describe('timelinePostConverter', () => {
    it('toFirestore should convert expireAt correctly', () => {
      const post: TimelinePost = {
        text: 'test tweet',
        timestamp: '2026-04-01T00:00:00Z',
        expireAt: '2026-05-01T00:00:00Z',
        status: PostStatus.SUCCESS,
        impressions: 10,
        likes: 2,
        retweets: 1,
        replies: 0,
        mediaUrls: [],
        authorId: 'a1',
        authorName: 'Rebecca',
        authorHandle: 'rebecca_ai',
        authorAvatarUrl: '',
      };
      const data = timelinePostConverter.toFirestore(post);
      expect(data.expireAt).toBeInstanceOf(Timestamp);
    });

    it('fromFirestore should map mediaUrls and handle missing mediaUrls', () => {
      const mockSnapshot = {
        data: () => ({
          text: 'tweet',
          timestamp: '2026-04-01T00:00:00Z',
          expireAt: null,
          status: PostStatus.SUCCESS,
          impressions: 10,
          likes: 2,
          retweets: 1,
          replies: 0,
          media_urls: ['https://image.png'],
          authorId: 'a1',
          authorName: 'Rebecca',
          authorHandle: 'rebecca_ai',
          authorAvatarUrl: '',
          postType: 'news',
          newsTitle: 'IT Passport',
          newsEmbedding: [0.1, 0.2],
        }),
      } as any;

      const post = timelinePostConverter.fromFirestore(mockSnapshot);
      expect(post.mediaUrls).toEqual(['https://image.png']);
      expect(post.expireAt).toBe('');
      expect(post.postType).toBe('news');
      expect(post.newsTitle).toBe('IT Passport');
      expect(post.newsEmbedding).toEqual([0.1, 0.2]);
    });

    it('toFirestore should handle alternate fields and null expireAt', () => {
      const postWithLegacy = {
        text: 'test legacy',
        timestamp: '2026-04-01T00:00:00Z',
        expireAt: '',
        status: PostStatus.SUCCESS,
        impressions: 10,
        likes: 2,
        retweets: 5,
        replies: 0,
        media_urls: ['https://legacy.png'],
        tweet_id: 't_legacy_1',
      } as unknown as TimelinePost;
      const data = timelinePostConverter.toFirestore(postWithLegacy);
      expect(data.reposts).toBe(5);
      expect(data.retweets).toBe(5);
      expect(data.mediaUrls).toEqual(['https://legacy.png']);
      expect(data.media_urls).toEqual(['https://legacy.png']);
      expect(data.tweetId).toBe('t_legacy_1');
      expect(data.tweet_id).toBe('t_legacy_1');
      expect(data.expireAt).toBeNull();

      const emptyPost = {
        text: 'test empty',
        timestamp: '2026-04-01T00:00:00Z',
        expireAt: '',
      } as unknown as TimelinePost;
      const emptyData = timelinePostConverter.toFirestore(emptyPost);
      expect(emptyData.reposts).toBe(0);
      expect(emptyData.retweets).toBe(0);
      expect(emptyData.mediaUrls).toEqual([]);
      expect(emptyData.tweetId).toBe('');
    });

    it('fromFirestore should handle mediaUrls array, reposts, tweetId, and created_at', () => {
      const snap1 = {
        data: () => ({
          text: 'tweet1',
          tweetId: 't1',
          timestamp: '2026-04-01T00:00:00Z',
          mediaUrls: ['https://canonical.png'],
          reposts: 7,
          impressions: 100,
          likes: 20,
          replies: 3,
        }),
      } as any;
      const res1 = timelinePostConverter.fromFirestore(snap1);
      expect(res1.mediaUrls).toEqual(['https://canonical.png']);
      expect(res1.media_urls).toEqual(['https://canonical.png']);
      expect(res1.reposts).toBe(7);
      expect(res1.retweets).toBe(7);
      expect(res1.tweetId).toBe('t1');
      expect(res1.timestamp).toBe('2026-04-01T00:00:00Z');

      const snap2 = {
        data: () => ({
          tweet_id: 't2',
          created_at: '2026-04-02T00:00:00Z',
          retweets: 4,
          mediaUrls: null,
          media_urls: null,
        }),
      } as any;
      const res2 = timelinePostConverter.fromFirestore(snap2);
      expect(res2.mediaUrls).toEqual([]);
      expect(res2.reposts).toBe(4);
      expect(res2.tweetId).toBe('t2');
      expect(res2.timestamp).toBe('2026-04-02T00:00:00Z');
    });
  });

  describe('ragMemoryConverter', () => {
    it('toFirestore and fromFirestore should passthrough data correctly', () => {
      const memory = {
        userId: 'u1',
        text: 'User likes coffee',
        embedding: [0.1, 0.2, 0.3],
        timestamp: '2026-04-01T00:00:00Z',
      };
      expect(ragMemoryConverter.toFirestore(memory)).toEqual(memory);

      const mockSnapshot = {
        data: () => memory,
      } as any;
      expect(ragMemoryConverter.fromFirestore(mockSnapshot)).toEqual(memory);
    });
  });

  describe('imageDocConverter', () => {
    it('toFirestore should convert lastUsedAt to Timestamp or null', () => {
      const image: ImageDoc = {
        url: 'https://img.jpg',
        filename: 'img.jpg',
        caption: 'caption',
        embedding: [0.1],
        lastUsedAt: '2026-04-01T00:00:00Z',
        useCount: 1,
        status: AssetStatus.SUCCESS,
      };
      const result = imageDocConverter.toFirestore(image);
      expect(result.lastUsedAt).toBeInstanceOf(Timestamp);

      const imageNoDate: ImageDoc = { ...image, lastUsedAt: null };
      expect(imageDocConverter.toFirestore(imageNoDate).lastUsedAt).toBeNull();
    });

    it('fromFirestore should map lastUsedAt to ISO string or null', () => {
      const d = new Date('2026-04-01T00:00:00Z');
      const mockSnapshot = {
        data: () => ({
          url: 'https://img.jpg',
          filename: 'img.jpg',
          caption: 'caption',
          embedding: [0.1],
          lastUsedAt: Timestamp.fromDate(d),
          status: AssetStatus.SUCCESS,
        }),
      } as any;

      const img = imageDocConverter.fromFirestore(mockSnapshot);
      expect(img.lastUsedAt).toBe(d.toISOString());
      expect(img.useCount).toBe(0);
    });
  });

  describe('processedFollowerConverter & listInteractionConverter', () => {
    it('processedFollowerConverter should convert data correctly', () => {
      const follower = { userId: 'f1', timestamp: '2026-04-01T00:00:00Z' };
      expect(processedFollowerConverter.toFirestore(follower)).toEqual(follower);
      expect(processedFollowerConverter.fromFirestore({ data: () => follower } as any)).toEqual(follower);
    });

    it('listInteractionConverter should convert lastInteractionAt correctly', () => {
      const interaction = { userId: 'u1', lastInteractionAt: '2026-04-01T00:00:00Z' };
      const data = listInteractionConverter.toFirestore(interaction);
      expect(data.lastInteractionAt).toBeInstanceOf(Timestamp);

      const mockSnapshot = {
        data: () => ({ userId: 'u1', lastInteractionAt: Timestamp.fromDate(new Date('2026-04-01T00:00:00Z')) }),
      } as any;
      expect(listInteractionConverter.fromFirestore(mockSnapshot).lastInteractionAt).toBe('2026-04-01T00:00:00.000Z');
    });
  });

  describe('pass-through converters', () => {
    it('rateLimitConverter, personaConverter, xApiStateConverter should passthrough data', () => {
      const raw = { foo: 'bar', count: 1 };
      expect(rateLimitConverter.toFirestore(raw as any)).toEqual(raw);
      expect(rateLimitConverter.fromFirestore({ data: () => raw } as any)).toEqual(raw);
      expect(personaConverter.toFirestore(raw as any)).toEqual(raw);
      expect(xApiStateConverter.toFirestore(raw as any)).toEqual(raw);
    });
  });

  describe('getCollections', () => {
    it('should return typed collection references bound to converters', () => {
      const mockWithConverter = jest.fn().mockImplementation((c) => ({ converter: c }));
      const mockCollection = jest.fn().mockReturnValue({ withConverter: mockWithConverter });
      const mockDb = { collection: mockCollection } as any;

      const collections = getCollections(mockDb);

      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.USERS);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.CONVERSATION_LOGS);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.TIMELINE_HISTORY);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.RAG_MEMORIES);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.IMAGES);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.PROCESSED_FOLLOWERS);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.LIST_INTERACTION_HISTORY);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.RATE_LIMITS);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.SYSTEM);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.SYSTEM_STATS);
      expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.PROCESSED_MENTIONS);

      expect(collections.users).toBeDefined();
      expect(collections.conversationLogs).toBeDefined();
      expect(collections.timelineHistory).toBeDefined();
      expect(collections.ragMemories).toBeDefined();
      expect(collections.images).toBeDefined();
      expect(collections.processedFollowers).toBeDefined();
      expect(collections.listInteractionHistory).toBeDefined();
      expect(collections.rateLimits).toBeDefined();
      expect(collections.system).toBeDefined();
      expect(collections.systemStats).toBeDefined();
      expect(collections.processedMentions).toBeDefined();
    });
  });
});
