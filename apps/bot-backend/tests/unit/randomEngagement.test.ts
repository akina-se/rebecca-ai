/**
 * @fileoverview Unit tests for RandomEngagementUseCase.
 * Verifies that the use case reads list members from Firestore cache
 * instead of the X API, and resolves usernames via getUserProfile().
 */

import { RandomEngagementUseCase } from '../../../src/features/engagement/usecase';
import type { AppDependencies } from '../../../src/types';

const makeFirestoreMock = (overrides: Partial<AppDependencies['firestore']> = {}) => ({
  getListMembersFromCache: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
  getUserDoc: jest.fn().mockResolvedValue(null),
  getLastListInteraction: jest.fn().mockResolvedValue(null),
  updateLastListInteraction: jest.fn().mockResolvedValue(undefined),
  appendEpisodicBuffer: jest.fn(),
  updateUserDoc: jest.fn(),
  updateCoreProfile: jest.fn(),
  checkAndConsumeRateLimit: jest.fn(),
  getAllUsers: jest.fn(),
  saveRawConversationLog: jest.fn(),
  getRecentConversationLogs: jest.fn(),
  getExtendedPrompt: jest.fn(),
  saveExtendedPrompt: jest.fn(),
  getTimelineSummary: jest.fn(),
  saveTimelineSummary: jest.fn(),
  saveTimelinePost: jest.fn(),
  getRecentTimelinePosts: jest.fn(),
  saveRagMemory: jest.fn(),
  findRagMemories: jest.fn(),
  getLastMentionId: jest.fn(),
  setLastMentionId: jest.fn(),
  hasProcessedMention: jest.fn(),
  markMentionProcessed: jest.fn(),
  saveImageMetadata: jest.fn(),
  getImageByHash: jest.fn(),
  findImageByVector: jest.fn(),
  updateImageLastUsed: jest.fn(),
  hasProcessedFollower: jest.fn(),
  markFollowerProcessed: jest.fn(),
  getProcessedFollowersCount: jest.fn(),
  updateTotalFollowers: jest.fn(),
  ...overrides,
});

const makeXApiMock = (overrides: Partial<AppDependencies['xApi']> = {}) => ({
  getUserProfile: jest.fn().mockResolvedValue({
    data: { id: 'u1', username: 'testuser', name: 'Test User', description: 'A test profile' },
  }),
  getUserTweets: jest.fn().mockResolvedValue({
    data: [{ id: 'tweet1', text: 'Hello world', attachments: {} }],
  }),
  tweet: jest.fn().mockResolvedValue({ data: { id: 'new_tweet' } }),
  replyToMention: jest.fn(),
  getTweetDetails: jest.fn(),
  uploadMedia: jest.fn(),
  getMentions: jest.fn(),
  getFollowers: jest.fn(),
  addListMember: jest.fn(),
  deleteTweet: jest.fn(),
  cachedNumericMyUserId: null,
  ...overrides,
});

const makeGeminiMock = () => ({
  analyzeUserProfile: jest.fn().mockResolvedValue({ attributes: [], preferences: [] }),
  detectLanguage: jest.fn().mockResolvedValue('ja'),
  generateReply: jest.fn().mockResolvedValue('@testuser こんにちは！'),
  generateStructuredReply: jest.fn(),
  verifyImageRelevance: jest.fn(),
  generateDreaming: jest.fn(),
  generateEvolutionPrompt: jest.fn(),
  auditEvolutionPrompt: jest.fn(),
  generateNewsPost: jest.fn(),
  generateTimelineSummary: jest.fn(),
  generateEmbedding: jest.fn(),
  generateSearchQuery: jest.fn(),
  analyzeImageCaption: jest.fn(),
  inferImageSearchQuery: jest.fn(),
});

jest.mock('../../../src/core/rateLimiter', () => ({
  checkAndIncrementRateLimits: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock('../../../src/utils/image', () => ({
  downloadImage: jest.fn(),
}));

describe('RandomEngagementUseCase', () => {
  let firestore: ReturnType<typeof makeFirestoreMock>;
  let xApi: ReturnType<typeof makeXApiMock>;
  let gemini: ReturnType<typeof makeGeminiMock>;
  let deps: AppDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    firestore = makeFirestoreMock();
    xApi = makeXApiMock();
    gemini = makeGeminiMock();
    deps = { firestore, xApi, gemini } as unknown as AppDependencies;
  });

  it('should read list members from Firestore cache, not from X API', async () => {
    const usecase = new RandomEngagementUseCase(deps);
    await usecase.execute();

    expect(firestore.getListMembersFromCache).toHaveBeenCalledTimes(1);
    expect((xApi as any).getListMembers).toBeUndefined();
  });

  it('should return success immediately when the cache is empty', async () => {
    firestore.getListMembersFromCache.mockResolvedValue([]);
    const usecase = new RandomEngagementUseCase(deps);

    const result = await usecase.execute();

    expect(result).toEqual({ status: 'success' });
    expect(xApi.getUserProfile).not.toHaveBeenCalled();
  });

  it('should skip BLOCKED users and select the next eligible one', async () => {
    firestore.getUserDoc
      .mockResolvedValueOnce({ status: 'BLOCKED' })
      .mockResolvedValueOnce(null);
    xApi.getUserProfile.mockResolvedValue({
      data: { id: 'u2', username: 'user2', name: 'User 2', description: '' },
    });

    const usecase = new RandomEngagementUseCase(deps);
    const result = await usecase.execute();

    expect(result.status).toBe('success');
    expect(result.processedUser).toBe('user2');
    expect(xApi.getUserProfile).toHaveBeenCalledWith('u2');
  });

  it('should return success when all users have recent list interactions', async () => {
    firestore.getLastListInteraction.mockResolvedValue(new Date());

    const usecase = new RandomEngagementUseCase(deps);
    const result = await usecase.execute();

    expect(result).toEqual({ status: 'success' });
    expect(xApi.tweet).not.toHaveBeenCalled();
  });

  it('should resolve username from getUserProfile, not from the cache stub', async () => {
    xApi.getUserProfile.mockResolvedValue({
      data: { id: 'u1', username: 'freshhandle', name: 'Fresh Handle', description: 'Updated profile' },
    });

    const usecase = new RandomEngagementUseCase(deps);
    const result = await usecase.execute();

    expect(result.processedUser).toBe('freshhandle');
    expect(xApi.getUserProfile).toHaveBeenCalledWith('u1');
  });

  it('should skip when no recent organic tweets are available', async () => {
    xApi.getUserTweets.mockResolvedValue({ data: [] });

    const usecase = new RandomEngagementUseCase(deps);
    const result = await usecase.execute();

    expect(result).toEqual({ status: 'skipped', reason: 'No valid tweets to engage with' });
    expect(xApi.tweet).not.toHaveBeenCalled();
  });
});
