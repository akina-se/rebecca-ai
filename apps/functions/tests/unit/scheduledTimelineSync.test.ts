let schedulerTriggerHandler: any;

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn().mockImplementation((_opts, handler) => {
    schedulerTriggerHandler = handler;
    return { run: handler };
  }),
}));

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockTimelineGet = jest.fn();
const mockTimelineDoc = jest.fn().mockImplementation((id?: string) => ({
  id: id || 'generated-doc-id',
}));

const mockCollection = jest.fn().mockImplementation((name: string) => {
  if (name === 'timeline_history') {
    return {
      get: mockTimelineGet,
      doc: mockTimelineDoc,
    };
  }
  return {
    get: jest.fn(),
    doc: jest.fn().mockReturnValue({ id: 'new-doc-id' }),
  };
});

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn().mockReturnValue([{}]),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: mockCollection,
    batch: jest.fn().mockReturnValue({
      set: mockBatchSet,
      commit: mockBatchCommit,
    }),
  }),
  FieldValue: {
    increment: jest.fn().mockImplementation((n) => ({ increment: n })),
    arrayUnion: jest.fn().mockImplementation((val) => ({ arrayUnion: val })),
  },
}));

const mockGetPosts = jest.fn();
jest.mock('@xdevplatform/xdk', () => ({
  OAuth1: jest.fn().mockImplementation(() => ({})),
  Client: jest.fn().mockImplementation((config) => ({
    config,
    users: {
      getPosts: mockGetPosts,
    },
  })),
}));

import {
  getXClient,
  syncTimelinePostsAndMetrics,
  scheduledTimelineSync,
} from '../../src/triggers/scheduledTimelineSync';

describe('scheduledTimelineSync Trigger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockGetPosts.mockResolvedValue({ data: [] });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getXClient', () => {
    it('should initialize Client with OAuth1 credentials when all 4 keys are present', () => {
      process.env.X_API_KEY = 'mock_api_key';
      process.env.X_API_SECRET = 'mock_api_secret';
      process.env.X_ACCESS_TOKEN = 'mock_access_token';
      process.env.X_ACCESS_SECRET = 'mock_access_secret';

      const client = getXClient();
      expect(client).not.toBeNull();
    });

    it('should initialize Client with bearerToken when only X_BEARER_TOKEN is present', () => {
      delete process.env.X_API_KEY;
      delete process.env.X_API_SECRET;
      delete process.env.X_ACCESS_TOKEN;
      delete process.env.X_ACCESS_SECRET;
      process.env.X_BEARER_TOKEN = 'mock_bearer_token';

      const client = getXClient();
      expect(client).not.toBeNull();
    });

    it('should return null when no credentials are present', () => {
      delete process.env.X_API_KEY;
      delete process.env.X_API_SECRET;
      delete process.env.X_ACCESS_TOKEN;
      delete process.env.X_ACCESS_SECRET;
      delete process.env.X_BEARER_TOKEN;

      const client = getXClient();
      expect(client).toBeNull();
    });
  });

  describe('syncTimelinePostsAndMetrics logic', () => {
    it('should skip gracefully if xClient is null', async () => {
      const res = await syncTimelinePostsAndMetrics(null, '12345');
      expect(res).toEqual({ processed: 0, updated: 0, created: 0, errors: 0 });
    });

    it('should skip gracefully if userId is not configured', async () => {
      const mockClient = { users: { getPosts: mockGetPosts } } as any;
      const res = await syncTimelinePostsAndMetrics(mockClient, undefined);
      expect(res).toEqual({ processed: 0, updated: 0, created: 0, errors: 0 });
    });

    it('should handle empty tweets returned from X API', async () => {
      mockGetPosts.mockResolvedValueOnce({ data: [] });
      const mockClient = { users: { getPosts: mockGetPosts } } as any;

      const res = await syncTimelinePostsAndMetrics(mockClient, '12345');
      expect(res).toEqual({ processed: 0, updated: 0, created: 0, errors: 0 });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('should update existing posts and insert manual/new posts with media and fallback matching', async () => {
      mockGetPosts.mockResolvedValueOnce({
        data: [
          {
            id: 'tweet_1',
            text: 'Tokyo street hole announcement #全肯定AIレベッカ',
            created_at: '2026-08-23T03:00:10.000Z',
            public_metrics: {
              impression_count: 59,
              like_count: 3,
              retweet_count: 1,
              reply_count: 0,
            },
            attachments: {
              media_keys: ['media_key_1'],
            },
          },
          {
            id: 'tweet_2',
            text: 'Matched by text content fallback',
            created_at: '2026-08-24T05:00:00.000Z',
            public_metrics: {
              impression_count: 88,
              like_count: 10,
              retweet_count: 0,
              reply_count: 1,
            },
            attachments: {
              media_keys: ['media_key_missing'],
            },
          },
          {
            id: 'tweet_3',
            text: 'Manual tweet posted from iPhone app!',
            created_at: '2026-08-24T12:00:00.000Z',
            public_metrics: {
              impression_count: 120,
              like_count: 15,
              retweet_count: 2,
              reply_count: 4,
            },
            attachments: {
              media_keys: ['media_key_2'],
            },
          },
          {
            id: 'tweet_4',
            text: 'Post with default metrics without created_at',
          },
        ],
        includes: {
          media: [
            {
              media_key: 'media_key_1',
              type: 'photo',
              url: 'https://pbs.twimg.com/media/test1.jpg',
            },
            {
              media_key: 'media_key_2',
              type: 'photo',
              preview_image_url: 'https://pbs.twimg.com/media/test2.jpg',
            },
          ],
        },
      });

      // Existing Firestore snapshot containing tweet_1 and text-matched tweet_2
      mockTimelineGet.mockResolvedValueOnce({
        forEach: (cb: (doc: any) => void) => {
          cb({
            id: 'doc_existing_1',
            data: () => ({
              tweet_id: 'tweet_1',
              text: 'Tokyo street hole announcement #全肯定AIレベッカ',
              impressions: 0,
              likes: 0,
              media_urls: [],
            }),
          });
          cb({
            id: 'doc_existing_2',
            data: () => ({
              content: 'Matched by text content fallback',
              mediaUrls: ['https://existing.url/img.jpg'],
            }),
          });
        },
      });

      const mockClient = { users: { getPosts: mockGetPosts } } as any;
      const res = await syncTimelinePostsAndMetrics(mockClient, '12345');

      expect(res).toEqual({ processed: 4, updated: 2, created: 2, errors: 0 });

      // Verify update on existing document 1
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doc_existing_1' }),
        expect.objectContaining({
          impressions: 59,
          likes: 3,
          reposts: 1,
          replies: 0,
          tweetId: 'tweet_1',
          mediaUrls: ['https://pbs.twimg.com/media/test1.jpg'],
        }),
        { merge: true }
      );

      // Verify update on existing document 2 (existing media kept)
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doc_existing_2' }),
        expect.objectContaining({
          impressions: 88,
          likes: 10,
          tweetId: 'tweet_2',
        }),
        { merge: true }
      );

      // Verify insertion of manual tweet_3
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          text: 'Manual tweet posted from iPhone app!',
          impressions: 120,
          likes: 15,
          reposts: 2,
          replies: 4,
          status: 'SUCCESS',
          tweetId: 'tweet_3',
          mediaUrls: ['https://pbs.twimg.com/media/test2.jpg'],
        })
      );

      // Verify insertion of tweet_4 (default 0s)
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          text: 'Post with default metrics without created_at',
          impressions: 0,
          likes: 0,
          reposts: 0,
          replies: 0,
          status: 'SUCCESS',
          tweetId: 'tweet_4',
        })
      );

      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should catch and log error if X API throws an exception', async () => {
      mockGetPosts.mockRejectedValueOnce(new Error('Rate limit exceeded'));
      const mockClient = { users: { getPosts: mockGetPosts } } as any;

      const res = await syncTimelinePostsAndMetrics(mockClient, '12345');
      expect(res).toEqual({ processed: 0, updated: 0, created: 0, errors: 1 });
    });
  });

  describe('scheduledTimelineSync exported trigger', () => {
    it('should trigger syncTimelinePostsAndMetrics when onSchedule executes', async () => {
      process.env.X_MY_USER_ID = '12345678';
      process.env.X_BEARER_TOKEN = 'mock_token';

      mockGetPosts.mockResolvedValueOnce({ data: [] });
      mockTimelineGet.mockResolvedValueOnce({
        forEach: jest.fn(),
      });

      expect(scheduledTimelineSync).toBeDefined();
      expect(schedulerTriggerHandler).toBeDefined();

      await schedulerTriggerHandler({});
      expect(mockGetPosts).toHaveBeenCalledWith('12345678', expect.any(Object));
    });
  });
});
