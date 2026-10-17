const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockTimelineGet = jest.fn();
const mockTimelineWhere = jest.fn().mockReturnValue({
  get: mockTimelineGet,
});
const mockTimelineDoc = jest.fn().mockImplementation((id?: string) => ({
  id: id || 'generated-doc-id',
}));

const mockDb: any = {
  collection: jest.fn().mockImplementation((name: string) => {
    if (name === 'timeline_history') {
      return {
        get: mockTimelineGet,
        where: mockTimelineWhere,
        doc: mockTimelineDoc,
      };
    }
    return {
      get: jest.fn(),
      doc: jest.fn().mockReturnValue({ id: 'mock-doc' }),
    };
  }),
  batch: jest.fn().mockReturnValue({
    set: mockBatchSet,
    commit: mockBatchCommit,
  }),
};

import { SyncTimelineUseCase } from '../../../src/usecases/syncTimelineUseCase';
import { IXApiService, TimelineTweetDto } from '../../../src/services/xApi';

describe('SyncTimelineUseCase', () => {
  let mockXApiService: jest.Mocked<IXApiService>;
  let useCase: SyncTimelineUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockXApiService = {
      fetchRecentTimelineTweets: jest.fn(),
      getMyUserId: jest.fn(),
      cachedMyUserId: null,
    };
    useCase = new SyncTimelineUseCase(mockXApiService, mockDb);
  });

  it('should delegate to xApiService when userId is empty and return zero if no tweets found', async () => {
    mockXApiService.fetchRecentTimelineTweets.mockResolvedValueOnce([]);
    const result = await useCase.execute('');
    expect(result).toEqual({ processed: 0, updated: 0, created: 0, errors: 0 });
    expect(mockXApiService.fetchRecentTimelineTweets).toHaveBeenCalledWith('', undefined);
  });

  it('should return zero metrics if no tweets are returned from X API', async () => {
    mockXApiService.fetchRecentTimelineTweets.mockResolvedValueOnce([]);

    const result = await useCase.execute('12345');
    expect(result).toEqual({ processed: 0, updated: 0, created: 0, errors: 0 });
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('should update existing tweets and insert new manual tweets with all branch coverage', async () => {
    const mockTweets: TimelineTweetDto[] = [
      {
        id: 'tweet_existing_1',
        text: 'Tokyo hole warning',
        createdAt: '2026-08-24T00:00:00.000Z',
        impressions: 59,
        likes: 3,
        reposts: 0,
        replies: 0,
        mediaUrls: ['https://pbs.twimg.com/media/img1.jpg'],
      },
      {
        id: 'tweet_manual_2',
        text: 'Manual iPhone post',
        createdAt: '2026-08-25T12:00:00.000Z',
        impressions: 120,
        likes: 15,
        reposts: 2,
        replies: 1,
        mediaUrls: ['https://pbs.twimg.com/media/img2.jpg'],
      },
      {
        id: 'tweet_text_matched_3',
        text: 'Matched by content text',
        createdAt: undefined,
        impressions: 40,
        likes: 5,
        reposts: 0,
        replies: 0,
        mediaUrls: [],
      },
      {
        id: 'tweet_empty_matched_4',
        text: 'Tweet with tweet_id property match',
        createdAt: undefined,
        impressions: 10,
        likes: 1,
        reposts: 0,
        replies: 0,
        mediaUrls: ['https://pbs.twimg.com/media/img4.jpg'],
        poll: {
          id: 'poll_4',
          options: [
            { position: 1, label: 'Yes', votes: 10 },
            { position: 2, label: 'No', votes: 2 },
          ],
          votingStatus: 'open',
        },
      },
      {
        id: 'tweet_new_poll_5',
        text: 'Untracked poll tweet',
        createdAt: '2026-08-26T12:00:00.000Z',
        impressions: 80,
        likes: 8,
        reposts: 1,
        replies: 2,
        mediaUrls: [],
        poll: {
          id: 'poll_5',
          options: [
            { position: 1, label: 'A', votes: 5 },
            { position: 2, label: 'B', votes: 3 },
          ],
          votingStatus: 'closed',
        },
      },
    ];

    mockXApiService.fetchRecentTimelineTweets.mockResolvedValueOnce(mockTweets);

    mockTimelineGet.mockResolvedValueOnce({
      forEach: (cb: (doc: any) => void) => {
        cb({
          id: 'doc_existing_1',
          data: () => ({
            tweetId: 'tweet_existing_1',
            text: 'Tokyo hole warning',
            impressions: 0,
            likes: 0,
            media_urls: [],
          }),
        });
        cb({
          id: 'doc_existing_3',
          data: () => ({
            tweetId: 'tweet_text_matched_3',
            content: 'Matched by content text',
            mediaUrls: ['https://already.present/url.jpg'],
          }),
        });
        cb({
          id: 'doc_existing_4',
          data: () => ({
            tweet_id: 'tweet_empty_matched_4',
            mediaUrls: [],
          }),
        });
      },
    });

    const result = await useCase.execute('12345');

    expect(result).toEqual({ processed: 5, updated: 3, created: 2, errors: 0 });

    // Verify existing doc 1 update (media added)
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc_existing_1' }),
      expect.objectContaining({
        impressions: 59,
        likes: 3,
        tweetId: 'tweet_existing_1',
        mediaUrls: ['https://pbs.twimg.com/media/img1.jpg'],
      }),
      { merge: true }
    );

    // Verify existing doc 1 does not have its thought overwritten or cleared by sync
    const updateCallForDoc1 = mockBatchSet.mock.calls.find(
      (call: any[]) => call[0]?.id === 'doc_existing_1'
    );
    expect(updateCallForDoc1).toBeDefined();
    expect(updateCallForDoc1[1]).not.toHaveProperty('thought');

    // Verify manual doc 2 creation
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        text: 'Manual iPhone post',
        impressions: 120,
        likes: 15,
        reposts: 2,
        replies: 1,
        status: 'SUCCESS',
        tweetId: 'tweet_manual_2',
      })
    );

    // Verify doc 4 update with poll
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc_existing_4' }),
      expect.objectContaining({
        tweetId: 'tweet_empty_matched_4',
        mediaUrls: ['https://pbs.twimg.com/media/img4.jpg'],
        poll: expect.objectContaining({ id: 'poll_4', votingStatus: 'open' }),
      }),
      { merge: true }
    );

    // Verify new poll doc 5 creation with postType: 'poll'
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        text: 'Untracked poll tweet',
        tweetId: 'tweet_new_poll_5',
        postType: 'poll',
        poll: expect.objectContaining({ id: 'poll_5', votingStatus: 'closed' }),
      })
    );

    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should pass custom limit to XApiService if provided', async () => {
    mockXApiService.fetchRecentTimelineTweets.mockResolvedValueOnce([]);

    await useCase.execute('12345', 30);
    expect(mockXApiService.fetchRecentTimelineTweets).toHaveBeenCalledWith('12345', 30);
  });

  it('should catch error and return error metric if exception occurs', async () => {
    mockXApiService.fetchRecentTimelineTweets.mockRejectedValueOnce(new Error('Firestore connection failure'));

    const result = await useCase.execute('12345');
    expect(result).toEqual({ processed: 0, updated: 0, created: 0, errors: 1 });
  });
});
