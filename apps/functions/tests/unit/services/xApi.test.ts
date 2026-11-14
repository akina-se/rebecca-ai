const mockGetPosts = jest.fn();
const mockGetMe = jest.fn();

jest.mock('@xdevplatform/xdk', () => ({
  OAuth1: jest.fn().mockImplementation(() => ({})),
  Client: jest.fn().mockImplementation((config) => ({
    config,
    users: {
      getPosts: mockGetPosts,
      getMe: mockGetMe,
    },
  })),
}));

import { XApiError, XApiService, toXApiError } from '../../../src/services/xApi';
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
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    expect(service).toBeDefined();
    expect(service.cachedMyUserId).toBe('12345');
  });

  it('should initialize Client with bearerToken when only bearerToken is available', () => {
    const cfg: XApiConfig = {
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessSecret: '',
      bearerToken: 'bearer',
      myUserId: '12345',
      syncMaxResults: 100,
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
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');
    expect(tweets).toEqual([]);
  });

  it('should resolve user ID via getMyUserId if not configured, and cache it', async () => {
    mockGetMe.mockResolvedValueOnce({ data: { id: 'resolved_user_999' } });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    expect(service.cachedMyUserId).toBeNull();

    const userId = await service.getMyUserId();
    expect(userId).toBe('resolved_user_999');
    expect(service.cachedMyUserId).toBe('resolved_user_999');

    // Second call should return cached ID without invoking getMe again
    const secondUserId = await service.getMyUserId();
    expect(secondUserId).toBe('resolved_user_999');
    expect(mockGetMe).toHaveBeenCalledTimes(1);
  });

  it('should return null when getMe resolves without a user id', async () => {
    mockGetMe.mockResolvedValueOnce({ data: {} });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    const userId = await service.getMyUserId();
    expect(userId).toBeNull();
  });

  it('should throw XApiError when getMe rejects with a network or unclassified error', async () => {
    mockGetMe.mockRejectedValueOnce(new Error('Auth failed'));

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    await expect(service.getMyUserId()).rejects.toMatchObject({
      name: 'XApiError',
      message: 'Auth failed',
      statusCode: undefined,
    });
  });

  it('should rethrow XApiError with statusCode 403 when getMe rejects with HTTP 403', async () => {
    const forbiddenErr = Object.assign(new Error('HTTP 403: Forbidden'), {
      status: 403,
      data: { detail: 'Your monthly spend cap has been reached.' },
    });
    mockGetMe.mockRejectedValueOnce(forbiddenErr);

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    await expect(service.getMyUserId()).rejects.toMatchObject({
      name: 'XApiError',
      statusCode: 403,
      detail: 'Your monthly spend cap has been reached.',
      message: 'HTTP 403: Forbidden: Your monthly spend cap has been reached.',
    });
  });

  it('should auto-resolve userId when fetching tweets if userId argument is omitted', async () => {
    mockGetMe.mockResolvedValueOnce({ data: { id: 'auto_id_123' } });
    mockGetPosts.mockResolvedValueOnce({ data: [{ id: 'tweet_auto', text: 'Auto resolved text' }] });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '',
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets();

    expect(mockGetPosts).toHaveBeenCalledWith('auto_id_123', expect.anything());
    expect(tweets).toHaveLength(1);
    expect(tweets[0].id).toBe('tweet_auto');
  });

  it('should return empty array if userId is omitted and getMe resolves without an id', async () => {
    mockGetMe.mockResolvedValueOnce({ data: {} });

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

  it('should rethrow XApiError with statusCode 403 when getPosts rejects with HTTP 403', async () => {
    const forbiddenErr = Object.assign(new Error('HTTP 403'), {
      status: 403,
      data: { detail: 'Client Forbidden' },
    });
    mockGetPosts.mockRejectedValueOnce(forbiddenErr);

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '12345',
    };
    const service = new XApiService(cfg);
    await expect(service.fetchRecentTimelineTweets('12345')).rejects.toMatchObject({
      name: 'XApiError',
      statusCode: 403,
      detail: 'Client Forbidden',
    });
  });

  it('should correctly pass postFields and parse SDK camelCase publicMetrics and attachments', async () => {
    mockGetPosts.mockResolvedValueOnce({
      data: [
        {
          id: 'tweet_camel',
          text: 'CamelCase tweet metrics',
          createdAt: '2026-08-28T12:00:00.000Z',
          publicMetrics: {
            impressionCount: 350,
            likeCount: 15,
            repostCount: 4,
            replyCount: 2,
          },
          attachments: {
            mediaKeys: ['mk_camel_1'],
          },
        },
      ],
      includes: {
        media: [
          {
            mediaKey: 'mk_camel_1',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/camel.jpg',
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
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');

    expect(mockGetPosts).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        maxResults: 100,
        exclude: ['retweets', 'replies'],
        postFields: ['created_at', 'public_metrics', 'attachments', 'text'],
        expansions: ['attachments.media_keys', 'attachments.poll_ids'],
        mediaFields: ['url', 'preview_image_url', 'type'],
        pollFields: ['duration_minutes', 'end_datetime', 'id', 'options', 'voting_status'],
      })
    );
    expect(tweets).toHaveLength(1);
    expect(tweets[0]).toEqual({
      id: 'tweet_camel',
      text: 'CamelCase tweet metrics',
      createdAt: '2026-08-28T12:00:00.000Z',
      impressions: 350,
      likes: 15,
      reposts: 4,
      replies: 2,
      mediaUrls: ['https://pbs.twimg.com/media/camel.jpg'],
    });
  });

  it('should map poll attachments from includes.polls onto TimelineTweetDto', async () => {
    mockGetPosts.mockResolvedValueOnce({
      data: [
        {
          id: 'tweet_poll_1',
          text: 'Weekly poll question',
          createdAt: '2026-10-17T11:00:00.000Z',
          publicMetrics: {
            impressionCount: 500,
            likeCount: 20,
            repostCount: 3,
            replyCount: 5,
          },
          attachments: {
            pollIds: ['poll_999'],
          },
        },
      ],
      includes: {
        polls: [
          {
            id: 'poll_999',
            options: [
              { position: 1, label: 'Option A', votes: 30 },
              { position: 2, label: 'Option B', votes: 15 },
              { position: 3, label: 'Option C', votes: 5 },
            ],
            durationMinutes: 1380,
            endDatetime: '2026-10-18T10:00:00.000Z',
            votingStatus: 'closed',
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
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');

    expect(tweets).toHaveLength(1);
    expect(tweets[0].poll).toEqual({
      id: 'poll_999',
      options: [
        { position: 1, label: 'Option A', votes: 30 },
        { position: 2, label: 'Option B', votes: 15 },
        { position: 3, label: 'Option C', votes: 5 },
      ],
      durationMinutes: 1380,
      endDatetime: '2026-10-18T10:00:00.000Z',
      votingStatus: 'closed',
    });
  });

  it('should handle tweets without publicMetrics or attachments gracefully', async () => {
    mockGetPosts.mockResolvedValueOnce({
      data: [
        {
          id: 'tweet_bare',
          text: 'Bare tweet without metrics or attachments',
        },
      ],
    });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '12345',
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');

    expect(tweets).toHaveLength(1);
    expect(tweets[0]).toEqual({
      id: 'tweet_bare',
      text: 'Bare tweet without metrics or attachments',
      createdAt: undefined,
      impressions: 0,
      likes: 0,
      reposts: 0,
      replies: 0,
      mediaUrls: [],
    });
  });

  it('should use configured syncMaxResults when limit is not provided', async () => {
    mockGetPosts.mockResolvedValueOnce({ data: [] });

    const cfg: XApiConfig = {
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'sec',
      bearerToken: '',
      myUserId: '12345',
      syncMaxResults: 50,
    };
    const service = new XApiService(cfg);
    await service.fetchRecentTimelineTweets('12345');

    expect(mockGetPosts).toHaveBeenCalledWith('12345', expect.objectContaining({ maxResults: 50 }));
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
      syncMaxResults: 100,
    };
    const service = new XApiService(cfg);
    const tweets = await service.fetchRecentTimelineTweets('12345');
    expect(tweets).toEqual([]);
  });

  describe('toXApiError boundary normalization', () => {
    it('returns the same instance if already an XApiError', () => {
      const original = new XApiError('Already normalized', { statusCode: 403 });
      expect(toXApiError(original)).toBe(original);
    });

    it('extracts statusCode, data.error, and data.title fallbacks accurately', () => {
      const errWithError = { statusCode: 429, data: { error: 'Rate limited' } };
      expect(toXApiError(errWithError)).toMatchObject({
        statusCode: 429,
        detail: 'Rate limited',
        message: 'HTTP 429: Rate limited',
      });

      const errWithTitle = { status: 403, message: '   ', data: { title: 'Forbidden' } };
      expect(toXApiError(errWithTitle)).toMatchObject({
        statusCode: 403,
        detail: 'Forbidden',
        message: 'HTTP 403: Forbidden',
      });
    });

    it('ignores out-of-range HTTP status codes and normalizes primitives', () => {
      expect(toXApiError({ status: 200, message: 'OK' })).toMatchObject({
        statusCode: undefined,
        message: 'OK',
      });
      expect(toXApiError('string failure')).toMatchObject({
        statusCode: undefined,
        message: 'string failure',
      });
    });
  });
});
