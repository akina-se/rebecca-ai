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

import { XApiService } from '../../../src/services/xApi';
import { XApiConfig } from '../../../src/config';

describe('XApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize Client with OAuth1 credentials when available', () => {
    const cfg: XApiConfig = {
      apiKey: 'key',
      apiSecret: 'secret',
      accessToken: 'token',
      accessSecret: 'tokenSecret',
      bearerToken: '',
      myUserId: '12345',
    };
    const service = new XApiService(cfg);
    expect(service).toBeDefined();
  });

  it('should initialize Client with bearerToken when only bearerToken is available', () => {
    const cfg: XApiConfig = {
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessSecret: '',
      bearerToken: 'bearer',
      myUserId: '12345',
    };
    const service = new XApiService(cfg);
    expect(service).toBeDefined();
  });

  it('should return empty array if client is not configured', async () => {
    const cfg: XApiConfig = {
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessSecret: '',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');
    expect(tweets).toEqual([]);
  });

  it('should return empty array if userId is empty', async () => {
    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('');
    expect(tweets).toEqual([]);
  });

  it('should fetch, normalize, and attach media URLs correctly', async () => {
    mockGetPosts.mockResolvedValueOnce({
      data: [
        {
          id: 'tweet_1',
          text: 'Hello world tweet',
          created_at: '2026-08-25T10:00:00.000Z',
          public_metrics: {
            impression_count: 100,
            like_count: 5,
            retweet_count: 2,
            reply_count: 1,
          },
          attachments: {
            media_keys: ['mk_1'],
          },
        },
        {
          id: 'tweet_2',
          text: 'Tweet without attachments or metrics',
        },
      ],
      includes: {
        media: [
          {
            media_key: 'mk_1',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/img1.jpg',
          },
        ],
      },
    });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '12345',
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');

    expect(tweets).toHaveLength(2);
    expect(tweets[0]).toEqual({
      id: 'tweet_1',
      text: 'Hello world tweet',
      createdAt: '2026-08-25T10:00:00.000Z',
      impressions: 100,
      likes: 5,
      reposts: 2,
      replies: 1,
      mediaUrls: ['https://pbs.twimg.com/media/img1.jpg'],
    });

    expect(tweets[1]).toEqual({
      id: 'tweet_2',
      text: 'Tweet without attachments or metrics',
      createdAt: undefined,
      impressions: 0,
      likes: 0,
      reposts: 0,
      replies: 0,
      mediaUrls: [],
    });
  });

  it('should handle empty response data gracefully', async () => {
    mockGetPosts.mockResolvedValueOnce({ data: [] });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '12345',
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');
    expect(tweets).toEqual([]);
  });
});
