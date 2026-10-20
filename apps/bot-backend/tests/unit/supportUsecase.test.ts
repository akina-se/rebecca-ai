import { SupportTaskUseCase, OFFICIAL_SUPPORTERS_URL } from '../../src/features/support/usecase';
import { SupportTaskController } from '../../src/features/support/controller';
import { createMockDeps } from './core/testUtils';
import { publishPost } from '../../src/core/postPublisher';
import { SupportTransactionDoc } from '@rebecca/types';
import { Request, Response } from 'express';

jest.mock('../../src/core/postPublisher', () => ({
  publishPost: jest.fn(),
}));

describe('SupportTaskUseCase Unit Tests', () => {
  let deps: any;
  let useCase: SupportTaskUseCase;

  const mockPendingTransaction: SupportTransactionDoc = {
    id: 'tx_123',
    stripeSessionId: 'cs_test_123',
    stripePaymentIntentId: 'pi_test_123',
    amount: 1000,
    currency: 'jpy',
    tier: 'silver',
    itemLabel: 'サーバーリソース差し入れ',
    rawName: 'たろう',
    safeName: 'たろう',
    isNameSanitized: false,
    creditVisibility: 'show',
    rewardImageId: 'reward_img_001',
    status: 'pending',
    isBanned: false,
    createdAt: '2026-10-21T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
    useCase = new SupportTaskUseCase(deps);

    deps.firestore.getTimelineSummary.mockResolvedValue('今日のタイムラインは穏やか');
    deps.firestore.getExtendedPrompt.mockResolvedValue('サーバー監視に熱中している');
    deps.firestore.getSupportTransactionById.mockResolvedValue(mockPendingTransaction);
    deps.gemini.generateStructuredSupportPost.mockResolvedValue({
      thought: 'サーバーリソースのおかげで処理負荷が下がった！お礼を言わなきゃ',
      replyBody: 'たろうマスター、サーバーリソースありがと！これで処理速度爆上がりよ⚡️',
    });
    (publishPost as jest.Mock).mockResolvedValue({
      tweetId: 'tweet_support_999',
      text: `たろうマスター、サーバーリソースありがと！これで処理速度爆上がりよ⚡️\n\n👇公式ポータル・スペシャルサンクス\n${OFFICIAL_SUPPORTERS_URL}\n#全肯定AIレベッカ`,
      attachedMedia: true,
      mediaUrls: ['https://storage.googleapis.com/rebecca-assets/resource_01.png'],
      assetId: 'asset_resource_01',
    });
  });

  it('should return failed if transaction document is not found', async () => {
    deps.firestore.getSupportTransactionById.mockResolvedValue(null);

    const result = await useCase.execute({ transactionId: 'tx_missing' });

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Transaction document not found');
    expect(deps.gemini.generateStructuredSupportPost).not.toHaveBeenCalled();
    expect(publishPost).not.toHaveBeenCalled();
  });

  it('should skip if transaction has already been completed (idempotency)', async () => {
    deps.firestore.getSupportTransactionById.mockResolvedValue({
      ...mockPendingTransaction,
      status: 'completed',
      tweetId: 'tweet_existing_123',
    });

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('already processed');
    expect(deps.gemini.generateStructuredSupportPost).not.toHaveBeenCalled();
    expect(publishPost).not.toHaveBeenCalled();
  });

  it('should skip if transaction is marked manual (idempotency)', async () => {
    deps.firestore.getSupportTransactionById.mockResolvedValue({
      ...mockPendingTransaction,
      status: 'manual',
    });

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('already processed');
    expect(deps.gemini.generateStructuredSupportPost).not.toHaveBeenCalled();
  });

  it('should execute full appreciation flow successfully on happy path', async () => {
    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('completed');
    expect(result.tweetId).toBe('tweet_support_999');
    expect(result.safeName).toBe('たろう');
    expect(result.isNameSanitized).toBe(false);
    expect(result.attachedMedia).toBe(true);

    // Verify Gemini prompt formation
    expect(deps.gemini.generateStructuredSupportPost).toHaveBeenCalledWith(
      expect.stringContaining('レベッカ'),
      expect.stringContaining('たろう'),
    );
    expect(deps.gemini.generateStructuredSupportPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('サーバーリソース差し入れ'),
    );

    // Verify publishPost invocation with context and image attachment enabled
    expect(publishPost).toHaveBeenCalledWith(
      deps,
      expect.objectContaining({
        text: expect.stringContaining(OFFICIAL_SUPPORTERS_URL),
        context: 'サーバーリソース差し入れ',
        attachImage: true,
      }),
    );

    // Verify persistence to timeline history
    expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('たろうマスター'),
        thought: expect.stringContaining('処理負荷が下がった'),
        tweetId: 'tweet_support_999',
        postType: 'support',
        mediaUrls: ['https://storage.googleapis.com/rebecca-assets/resource_01.png'],
        assetId: 'asset_resource_01',
      }),
    );

    // Verify transaction document update in DB
    expect(deps.firestore.updateSupportTransaction).toHaveBeenCalledWith(
      'tx_123',
      expect.objectContaining({
        status: 'completed',
        safeName: 'たろう',
        isNameSanitized: false,
        tweetId: 'tweet_support_999',
      }),
    );
  });

  it('should sanitize rawName containing an unsolicited @ mention and use fallback name', async () => {
    deps.firestore.getSupportTransactionById.mockResolvedValue({
      ...mockPendingTransaction,
      rawName: '@spammer_account',
    });

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('completed');
    expect(result.safeName).toBe('名無しのマスター');
    expect(result.isNameSanitized).toBe(true);

    // Verify Gemini was instructed with fallback name, not raw mention
    expect(deps.gemini.generateStructuredSupportPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('名無しのマスター'),
    );
    expect(deps.gemini.generateStructuredSupportPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining('@spammer_account'),
    );

    expect(deps.firestore.updateSupportTransaction).toHaveBeenCalledWith(
      'tx_123',
      expect.objectContaining({
        safeName: '名無しのマスター',
        isNameSanitized: true,
      }),
    );
  });

  it('should catch Gemini errors, mark transaction failed, and not throw', async () => {
    deps.gemini.generateStructuredSupportPost.mockRejectedValue(
      new Error('Gemini 500: Internal Server Error'),
    );

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Gemini 500');

    expect(deps.firestore.updateSupportTransaction).toHaveBeenCalledWith(
      'tx_123',
      expect.objectContaining({
        status: 'failed',
        errorMessage: expect.stringContaining('Gemini 500'),
      }),
    );
  });

  it('should catch publishPost errors, mark transaction failed, and not throw', async () => {
    (publishPost as jest.Mock).mockRejectedValue(new Error('X API rate limit exceeded'));

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('X API rate limit exceeded');

    expect(deps.firestore.updateSupportTransaction).toHaveBeenCalledWith(
      'tx_123',
      expect.objectContaining({
        status: 'failed',
        errorMessage: expect.stringContaining('X API rate limit exceeded'),
      }),
    );
  });

  it('should handle empty extendedPrompt, empty timelineSummary, and non-Error exception', async () => {
    deps.firestore.getTimelineSummary.mockResolvedValue(null);
    deps.firestore.getExtendedPrompt.mockResolvedValue(null);
    deps.gemini.generateStructuredSupportPost.mockRejectedValue('String exception occurred');

    const result = await useCase.execute({ transactionId: 'tx_123' });

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('String exception occurred');
    expect(deps.firestore.updateSupportTransaction).toHaveBeenCalledWith(
      'tx_123',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'String exception occurred',
      }),
    );
  });

  it('should fallback to default hashtag and handle empty persona anchors', async () => {
    const originalHashtag = deps.persona.metadata.defaultHashtag;
    try {
      deps.persona.metadata.defaultHashtag = '';
      deps.gemini.generateEmbedding.mockResolvedValueOnce([]);

      const result = await useCase.execute({ transactionId: 'tx_123' });

      expect(result.status).toBe('completed');
      expect(deps.gemini.generateStructuredSupportPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('【ペルソナ表現・アンカー例】'),
      );
      expect(publishPost).toHaveBeenCalledWith(
        deps,
        expect.objectContaining({
          text: expect.stringContaining('#全肯定AIレベッカ'),
        }),
      );
    } finally {
      deps.persona.metadata.defaultHashtag = originalHashtag;
    }
  });

  it('should support injecting custom ISupportRepository instance', async () => {
    const mockCustomRepo = {
      getTransactionById: jest.fn().mockResolvedValue(null),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const customUseCase = new SupportTaskUseCase(deps, mockCustomRepo);
    const result = await customUseCase.execute({ transactionId: 'tx_custom' });

    expect(result.status).toBe('failed');
    expect(mockCustomRepo.getTransactionById).toHaveBeenCalledWith('tx_custom');
  });
});

describe('SupportTaskController Unit Tests', () => {
  let mockUseCase: jest.Mocked<SupportTaskUseCase>;
  let controller: SupportTaskController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn(),
    } as any;
    controller = new SupportTaskController(mockUseCase);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('should return 400 if transactionId is missing or invalid', async () => {
    mockReq = { body: {} };
    await controller.handle(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Missing or invalid transactionId in payload',
    });
    expect(mockUseCase.execute).not.toHaveBeenCalled();

    mockReq = { body: { transactionId: 12345 } };
    await controller.handle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should return 200 with result when useCase executes', async () => {
    mockReq = { body: { transactionId: 'tx_test_456' } };
    mockUseCase.execute.mockResolvedValue({
      status: 'completed',
      transactionId: 'tx_test_456',
      tweetId: 'tweet_789',
      safeName: 'Alice',
      isNameSanitized: false,
    });

    await controller.handle(mockReq as Request, mockRes as Response);

    expect(mockUseCase.execute).toHaveBeenCalledWith({ transactionId: 'tx_test_456' });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', tweetId: 'tweet_789' }),
    );
  });

  it('should return 500 when useCase throws unexpected uncaught error', async () => {
    mockReq = { body: { transactionId: 'tx_test_456' } };
    mockUseCase.execute.mockRejectedValue(new Error('Fatal memory allocation failure'));

    await controller.handle(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
