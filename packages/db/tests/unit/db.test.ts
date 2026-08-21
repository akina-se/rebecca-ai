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
        handle: 'user1',
        avatarUrl: 'https://avatar.png',
        status: UserStatus.ACTIVE,
        affinityScore: 10,
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
          handle: 'user1',
          avatarUrl: 'https://avatar.png',
          status: UserStatus.ACTIVE,
          affinityScore: 10,
          firstSeen: '2026-01-01T00:00:00Z',
          lastSeen: '2026-01-02T00:00:00Z',
        }),
      } as any;

      const result = userConverter.fromFirestore(mockSnapshot);
      expect(result.id).toBe('u1');
      expect(result.name).toBe('User 1');
      expect(result.coreProfile).toEqual({});
      expect(result.episodicBuffer).toEqual([]);
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
        }),
      } as any;

      const post = timelinePostConverter.fromFirestore(mockSnapshot);
      expect(post.mediaUrls).toEqual(['https://image.png']);
      expect(post.expireAt).toBe('');
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
