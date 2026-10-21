import { SupportersRepository } from '../../src/features/supporters/repository';
import { SupportersUseCase } from '../../src/features/supporters/usecase';
import { SupportersController } from '../../src/features/supporters/controller';
import { Request, Response } from 'express';

describe('Supporters Feature Unit Tests', () => {
  let mockFirestore: any;
  let mockSupportTransactionsColl: any;
  let mockRewardImagesColl: any;
  let mockStorage: any;
  let mockBucket: any;
  let mockFile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupportTransactionsColl = {
      doc: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
      withConverter: jest.fn().mockReturnThis(),
    };

    mockRewardImagesColl = {
      doc: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
      withConverter: jest.fn().mockReturnThis(),
    };

    mockFirestore = {
      collection: jest.fn().mockImplementation((name: string) => {
        if (name === 'support_transactions') return mockSupportTransactionsColl;
        if (name === 'reward_images') return mockRewardImagesColl;
        return {
          doc: jest.fn(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] }),
          withConverter: jest.fn().mockReturnThis(),
        };
      }),
    };

    mockFile = {
      save: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockResolvedValue([Buffer.from('fake_image_binary')]),
      getMetadata: jest.fn().mockResolvedValue([{ contentType: 'image/png' }]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    };
  });

  describe('SupportersRepository', () => {
    let repo: SupportersRepository;

    beforeEach(() => {
      repo = new SupportersRepository(mockFirestore);
    });

    it('retrieves transactions with summary calculations and filters', async () => {
      const mockDocs = [
        {
          id: 'tx_1',
          data: () => ({
            stripeSessionId: 'cs_1',
            rawName: 'Master Alice',
            safeName: 'Master Alice',
            amount: 3000,
            tier: 'gold',
            status: 'completed',
            createdAt: { toDate: () => new Date('2026-10-20T10:00:00Z') },
          }),
        },
        {
          id: 'tx_2',
          data: () => ({
            stripeSessionId: 'cs_2',
            rawName: 'Master Bob',
            safeName: 'Master Bob',
            amount: 1000,
            tier: 'silver',
            status: 'failed',
            errorMessage: 'Gemini Rate Limit',
            createdAt: '2026-10-19T10:00:00Z',
          }),
        },
        {
          id: 'tx_3',
          data: () => ({
            stripeSessionId: 'cs_3',
            rawName: 'Master Charlie',
            safeName: 'Master Charlie',
            amount: 300,
            tier: 'bronze',
            status: 'pending',
            createdAt: '2026-10-18T10:00:00Z',
          }),
        },
      ];

      mockSupportTransactionsColl.get.mockResolvedValue({ docs: mockDocs });

      const result = await repo.getTransactions({
        limit: 10,
        status: 'all',
        tier: 'all',
      });

      expect(result.transactions).toHaveLength(3);
      expect(result.summary.totalCount).toBe(3);
      expect(result.summary.completedCount).toBe(1);
      expect(result.summary.failedCount).toBe(1);
      expect(result.summary.pendingCount).toBe(1);
      expect(result.summary.totalAmount).toBe(4300);
    });

    it('filters transactions by search keyword matching rawName or safeName', async () => {
      const mockDocs = [
        {
          id: 'tx_1',
          data: () => ({
            stripeSessionId: 'cs_1',
            rawName: 'Alice Master',
            safeName: 'Alice Master',
            amount: 3000,
            tier: 'gold',
            status: 'completed',
            createdAt: '2026-10-20T10:00:00Z',
          }),
        },
        {
          id: 'tx_2',
          data: () => ({
            stripeSessionId: 'cs_2',
            rawName: 'Bob Builder',
            safeName: 'Bob Builder',
            amount: 1000,
            tier: 'silver',
            status: 'failed',
            createdAt: '2026-10-19T10:00:00Z',
          }),
        },
      ];

      mockSupportTransactionsColl.get.mockResolvedValue({ docs: mockDocs });

      const result = await repo.getTransactions({
        search: 'alice',
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].safeName).toBe('Alice Master');
    });

    it('getTransactionById returns transaction or null', async () => {
      const mockDocRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          id: 'tx_found',
          data: () => ({
            rawName: 'Found Master',
            safeName: 'Found Master',
            amount: 3000,
            tier: 'gold',
            status: 'completed',
          }),
        }),
      };
      mockSupportTransactionsColl.doc.mockReturnValue(mockDocRef);

      const found = await repo.getTransactionById('tx_found');
      expect(found).not.toBeNull();
      expect(found?.safeName).toBe('Found Master');

      mockDocRef.get.mockResolvedValue({ exists: false });
      const notFound = await repo.getTransactionById('tx_missing');
      expect(notFound).toBeNull();
    });

    it('creates, updates, and fetches reward images', async () => {
      const mockDocRef = {
        id: 'reward_123',
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: true,
          id: 'reward_123',
          data: () => ({
            title: 'Reward 1',
            imageUrl: '/image.png',
            storagePath: 'rewards/1.png',
            isActive: true,
          }),
        }),
      };
      mockRewardImagesColl.doc.mockReturnValue(mockDocRef);

      const id = await repo.createRewardImage({
        title: 'Reward 1',
        imageUrl: '/image.png',
        storagePath: 'rewards/1.png',
        isActive: true,
        distributedCount: 0,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
      });

      expect(id).toBe('reward_123');
      expect(mockDocRef.set).toHaveBeenCalled();

      await repo.updateRewardImage('reward_123', { isActive: false });
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
        { merge: true },
      );
    });
  });

  describe('SupportersUseCase', () => {
    let repo: jest.Mocked<SupportersRepository>;
    let useCase: SupportersUseCase;

    beforeEach(() => {
      repo = {
        getTransactions: jest.fn(),
        getTransactionById: jest.fn(),
        updateTransaction: jest.fn(),
        createTransaction: jest.fn(),
        getRewardImages: jest.fn(),
        getRewardImageById: jest.fn(),
        createRewardImage: jest.fn(),
        updateRewardImage: jest.fn(),
        deleteRewardImage: jest.fn(),
      } as any;

      useCase = new SupportersUseCase(repo, mockStorage);
    });

    it('updateTransaction applies producer overrides', async () => {
      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_1',
        stripeSessionId: 'cs_1',
        rawName: 'Bad Name',
        safeName: 'Bad Name',
        isNameSanitized: false,
        creditVisibility: 'show',
        amount: 3000,
        currency: 'jpy',
        tier: 'gold',
        itemLabel: '開発サポート',
        rewardImageId: 'r_1',
        status: 'pending',
        isBanned: false,
        createdAt: '2026-10-20T00:00:00Z',
      });

      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_1',
        stripeSessionId: 'cs_1',
        rawName: 'Bad Name',
        safeName: 'Nice Safe Name',
        isNameSanitized: true,
        creditVisibility: 'hide',
        amount: 3000,
        currency: 'jpy',
        tier: 'vip',
        itemLabel: '開発サポート',
        rewardImageId: 'r_1',
        status: 'pending',
        isBanned: true,
        createdAt: '2026-10-20T00:00:00Z',
      });

      const updated = await useCase.updateTransaction('tx_1', {
        safeName: 'Nice Safe Name',
        tier: 'vip',
        isBanned: true,
        creditVisibility: 'hide',
      });

      expect(repo.updateTransaction).toHaveBeenCalledWith('tx_1', {
        safeName: 'Nice Safe Name',
        tier: 'vip',
        isBanned: true,
        creditVisibility: 'hide',
        updatedAt: expect.any(String),
      });
      expect(updated.safeName).toBe('Nice Safe Name');
      expect(updated.tier).toBe('vip');
      expect(updated.isBanned).toBe(true);
    });

    it('updateTransaction throws 404 if transaction is missing', async () => {
      repo.getTransactionById.mockResolvedValue(null);
      await expect(useCase.updateTransaction('missing_id', { safeName: 'New' })).rejects.toThrow(
        'Transaction with ID "missing_id" not found',
      );
    });

    it('retryTransaction resets status to pending and clears errorMessage', async () => {
      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_failed',
        stripeSessionId: 'cs_failed',
        rawName: 'Alice',
        safeName: 'Alice',
        isNameSanitized: false,
        creditVisibility: 'show',
        amount: 1000,
        currency: 'jpy',
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        rewardImageId: 'r_1',
        status: 'failed',
        errorMessage: 'X API 429 Rate Limit',
        isBanned: false,
        createdAt: '2026-10-20T00:00:00Z',
      });

      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_failed',
        stripeSessionId: 'cs_failed',
        rawName: 'Alice',
        safeName: 'Alice',
        isNameSanitized: false,
        creditVisibility: 'show',
        amount: 1000,
        currency: 'jpy',
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        rewardImageId: 'r_1',
        status: 'pending',
        errorMessage: undefined,
        isBanned: false,
        createdAt: '2026-10-20T00:00:00Z',
      });

      const res = await useCase.retryTransaction('tx_failed');
      expect(res.success).toBe(true);
      expect(repo.updateTransaction).toHaveBeenCalledWith('tx_failed', {
        status: 'pending',
        errorMessage: undefined,
        updatedAt: expect.any(String),
      });
      expect(res.transaction.status).toBe('pending');
    });

    it('retryTransaction throws 404 if missing', async () => {
      repo.getTransactionById.mockResolvedValue(null);
      await expect(useCase.retryTransaction('missing')).rejects.toThrow('not found');
    });

    it('manualResolve validates transaction presence', async () => {
      repo.getTransactionById.mockResolvedValueOnce(null);
      await expect(useCase.manualResolve('missing', { tweetText: 'hi' })).rejects.toThrow('not found');
    });

    it('uploadReward validates file buffer', async () => {
      await expect(useCase.uploadReward({} as any, 'title')).rejects.toThrow('Image file is required');
    });

    it('deleteReward throws 404 when missing', async () => {
      repo.getRewardImageById.mockResolvedValue(null);
      await expect(useCase.deleteReward('missing')).rejects.toThrow('not found');
    });

    it('getRewardBinary handles missing image or missing file in bucket', async () => {
      repo.getRewardImageById.mockResolvedValueOnce(null);
      const res1 = await useCase.getRewardBinary('missing');
      expect(res1).toBeNull();

      repo.getRewardImageById.mockResolvedValueOnce({ id: 'r1', storagePath: 'rewards/art.png' } as any);
      mockFile.exists.mockResolvedValueOnce([false]);
      const res2 = await useCase.getRewardBinary('r1');
      expect(res2).toBeNull();
    });

    it('manualEntry validates required fields', async () => {
      await expect(useCase.manualEntry({ stripeSessionId: '', rawName: 'User', amount: 300 } as any)).rejects.toThrow('required');
      await expect(useCase.manualEntry({ stripeSessionId: 'cs_1', rawName: '', amount: 300 } as any)).rejects.toThrow('required');
      await expect(useCase.manualEntry({ stripeSessionId: 'cs_1', rawName: 'User', amount: 0 } as any)).rejects.toThrow('required');
    });

    it('retryTransaction dispatches to bot-backend worker when botBackendUrl is configured', async () => {
      const origUrl = require('../../src/config').config.services.botBackendUrl;
      const origSecret = require('../../src/config').config.services.batchSecret;
      require('../../src/config').config.services.botBackendUrl = 'http://localhost:8080';
      require('../../src/config').config.services.batchSecret = 'test_secret';

      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch as any;

      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_retry_fetch',
        status: 'failed',
      } as any);

      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_retry_fetch',
        status: 'pending',
      } as any);

      await useCase.retryTransaction('tx_retry_fetch');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/worker/support-post',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-worker-secret': 'test_secret' }),
        })
      );

      require('../../src/config').config.services.botBackendUrl = origUrl;
      require('../../src/config').config.services.batchSecret = origSecret;
    });

    it('retryTransaction throws error when trying to retry a completed transaction', async () => {
      repo.getTransactionById.mockResolvedValue({
        id: 'tx_comp',
        status: 'completed',
      } as any);

      await expect(useCase.retryTransaction('tx_comp')).rejects.toThrow(
        'Cannot retry a completed transaction',
      );
    });

    it('manualResolve updates transaction to manual status and records tweetText', async () => {
      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_failed',
        status: 'failed',
      } as any);

      repo.getTransactionById.mockResolvedValueOnce({
        id: 'tx_failed',
        status: 'manual',
        tweetText: 'Manual thank you tweet posted by producer',
      } as any);

      const result = await useCase.manualResolve('tx_failed', {
        tweetText: 'Manual thank you tweet posted by producer',
      });

      expect(repo.updateTransaction).toHaveBeenCalledWith('tx_failed', {
        status: 'manual',
        tweetText: 'Manual thank you tweet posted by producer',
        errorMessage: undefined,
        processedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(result.status).toBe('manual');
    });

    it('manualEntry creates a new pending transaction with resolved tier', async () => {
      repo.getRewardImages.mockResolvedValue([]);
      repo.createTransaction.mockResolvedValue('tx_new_manual');
      repo.getTransactionById.mockResolvedValue({
        id: 'tx_new_manual',
        stripeSessionId: 'cs_stripe_manual',
        rawName: 'Manual Backer',
        amount: 3000,
        tier: 'gold',
        status: 'pending',
      } as any);

      const res = await useCase.manualEntry({
        stripeSessionId: 'cs_stripe_manual',
        rawName: 'Manual Backer',
        amount: 3000,
      });

      expect(repo.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSessionId: 'cs_stripe_manual',
          rawName: 'Manual Backer',
          amount: 3000,
          tier: 'gold',
          itemLabel: '開発サポート',
          status: 'pending',
        }),
      );
      expect(res.id).toBe('tx_new_manual');
    });

    it('uploadReward saves file to storage and creates reward doc', async () => {
      repo.createRewardImage.mockResolvedValue('r_new');
      repo.getRewardImageById.mockResolvedValue({
        id: 'r_new',
        title: 'Halloween Art',
        imageUrl: '/api/v1/supporters/rewards/r_new/image',
        storagePath: 'rewards/halloween.png',
        isActive: true,
        distributedCount: 0,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
      });

      const mockMulterFile: any = {
        originalname: 'halloween.png',
        buffer: Buffer.from('image_bytes'),
        mimetype: 'image/png',
      };

      const reward = await useCase.uploadReward(mockMulterFile, 'Halloween Art');
      expect(mockFile.save).toHaveBeenCalled();
      expect(repo.createRewardImage).toHaveBeenCalled();
      expect(reward.title).toBe('Halloween Art');
    });

    it('updateReward and deleteReward operate on repository and cloud storage', async () => {
      repo.getRewardImageById.mockResolvedValue({
        id: 'r_1',
        title: 'Title',
        storagePath: 'rewards/art.png',
      } as any);

      await useCase.updateReward('r_1', { title: 'New Title' });
      expect(repo.updateRewardImage).toHaveBeenCalledWith('r_1', { title: 'New Title' });

      await useCase.deleteReward('r_1');
      expect(mockFile.delete).toHaveBeenCalled();
      expect(repo.deleteRewardImage).toHaveBeenCalledWith('r_1');
    });

    it('getRewardBinary downloads binary from storage', async () => {
      repo.getRewardImageById.mockResolvedValueOnce({
        id: 'r_1',
        storagePath: 'rewards/art.png',
      } as any);

      const binary = await useCase.getRewardBinary('r_1');
      expect(binary).not.toBeNull();
      expect(binary?.contentType).toBe('image/png');
    });
  });

  describe('SupportersController', () => {
    let useCase: jest.Mocked<SupportersUseCase>;
    let controller: SupportersController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
      useCase = {
        getLedger: jest.fn(),
        getTransactionById: jest.fn(),
        updateTransaction: jest.fn(),
        retryTransaction: jest.fn(),
        manualResolve: jest.fn(),
        manualEntry: jest.fn(),
        getRewards: jest.fn(),
        uploadReward: jest.fn(),
        getRewardBinary: jest.fn(),
        updateReward: jest.fn(),
        deleteReward: jest.fn(),
      } as any;

      controller = new SupportersController(useCase);

      statusMock = jest.fn().mockReturnThis();
      jsonMock = jest.fn().mockReturnThis();
      res = {
        status: statusMock,
        json: jsonMock,
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      req = {
        query: {},
        params: {},
        body: {},
      };
    });

    it('getLedger returns 200 with ledger response', async () => {
      useCase.getLedger.mockResolvedValue({
        transactions: [],
        summary: { totalCount: 0, failedCount: 0, pendingCount: 0, completedCount: 0, totalAmount: 0 },
      });

      await controller.getLedger(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ summary: expect.any(Object) }),
      );
    });

    it('retry returns 200 on success', async () => {
      req.params = { id: 'tx_failed' };
      useCase.retryTransaction.mockResolvedValue({
        success: true,
        message: 'Scheduled',
        transaction: { id: 'tx_failed', status: 'pending' } as any,
      });

      await controller.retry(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('manualResolve returns 200', async () => {
      req.params = { id: 'tx_1' };
      req.body = { tweetText: 'Manual post' };
      useCase.manualResolve.mockResolvedValue({ id: 'tx_1', status: 'manual' } as any);

      await controller.manualResolve(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'manual' }));
    });

    it('manualEntry returns 201', async () => {
      req.body = { stripeSessionId: 'cs_1', rawName: 'User', amount: 300 };
      useCase.manualEntry.mockResolvedValue({ id: 'tx_new', amount: 300 } as any);

      await controller.manualEntry(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx_new' }));
    });

    it('getById returns 200 when found or 404 when not found', async () => {
      req.params = { id: 'tx_1' };
      useCase.getTransactionById.mockResolvedValueOnce({ id: 'tx_1' } as any);

      await controller.getById(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);

      useCase.getTransactionById.mockResolvedValueOnce(null);
      await controller.getById(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('update returns 200 with updated transaction', async () => {
      req.params = { id: 'tx_1' };
      req.body = { safeName: 'New Safe' };
      useCase.updateTransaction.mockResolvedValue({ id: 'tx_1', safeName: 'New Safe' } as any);

      await controller.update(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ safeName: 'New Safe' }));
    });

    it('getRewards returns 200 with list of rewards', async () => {
      useCase.getRewards.mockResolvedValue([{ id: 'r_1', title: 'Reward 1' }] as any);

      await controller.getRewards(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ rewards: expect.any(Array) });
    });

    it('uploadReward validates file presence and returns 201', async () => {
      req.file = undefined;
      await controller.uploadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);

      req.file = { originalname: 'art.png', buffer: Buffer.from('test') } as any;
      req.body = { title: 'Art Title' };
      useCase.uploadReward.mockResolvedValue({ id: 'r_new', title: 'Art Title' } as any);

      await controller.uploadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('getRewardImage returns image binary stream or 404', async () => {
      req.params = { id: 'r_1' };
      useCase.getRewardBinary.mockResolvedValueOnce({ buffer: Buffer.from('image'), contentType: 'image/png' });

      await controller.getRewardImage(req as Request, res as Response);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.send).toHaveBeenCalled();

      useCase.getRewardBinary.mockResolvedValueOnce(null);
      await controller.getRewardImage(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('updateReward and deleteReward return 200', async () => {
      req.params = { id: 'r_1' };
      req.body = { isActive: false };
      useCase.updateReward.mockResolvedValue({ id: 'r_1', isActive: false } as any);

      await controller.updateReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);

      await controller.deleteReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    it('handles controller exceptions with 500 or error status response', async () => {
      const err = new Error('Database down');
      useCase.getLedger.mockRejectedValue(err);
      await controller.getLedger(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.retryTransaction.mockRejectedValue(err);
      await controller.retry(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.manualResolve.mockRejectedValue(err);
      await controller.manualResolve(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.manualEntry.mockRejectedValue(err);
      await controller.manualEntry(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.getTransactionById.mockRejectedValue(err);
      await controller.getById(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.updateTransaction.mockRejectedValue(err);
      await controller.update(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.getRewards.mockRejectedValue(err);
      await controller.getRewards(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      req.file = { originalname: 'test.png', buffer: Buffer.from('data') } as any;
      useCase.uploadReward.mockRejectedValue(err);
      await controller.uploadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.getRewardBinary.mockRejectedValue(err);
      await controller.getRewardImage(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.updateReward.mockRejectedValue(err);
      await controller.updateReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);

      useCase.deleteReward.mockRejectedValue(err);
      await controller.deleteReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('SupportersRepository Additional Coverage', () => {
    let repo: SupportersRepository;

    beforeEach(() => {
      repo = new SupportersRepository(mockFirestore);
    });

    it('queries transactions with status and tier filters and search', async () => {
      mockSupportTransactionsColl.get.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx_alpha',
            data: () => ({
              stripeSessionId: 'cs_alpha',
              rawName: 'Alice Alpha',
              safeName: 'Alice Alpha',
              amount: 3000,
              tier: 'silver',
              status: 'completed',
              createdAt: '2026-10-21T00:00:00.000Z',
            }),
          },
          {
            id: 'tx_beta',
            data: () => ({
              stripeSessionId: 'cs_beta',
              rawName: 'Bob Beta',
              safeName: 'Bob Beta',
              amount: 10000,
              tier: 'gold',
              status: 'completed',
              createdAt: '2026-10-21T01:00:00.000Z',
            }),
          },
        ],
      });

      const res = await repo.getTransactions({ status: 'completed', tier: 'silver', search: 'Alice' });
      expect(mockSupportTransactionsColl.where).toHaveBeenCalledWith('status', '==', 'completed');
      expect(mockSupportTransactionsColl.where).toHaveBeenCalledWith('tier', '==', 'silver');
      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].id).toBe('tx_alpha');
    });

    it('updates and creates transactions', async () => {
      const docSet = jest.fn().mockResolvedValue(undefined);
      mockSupportTransactionsColl.doc.mockReturnValue({ set: docSet, id: 'tx_gen_id' });

      await repo.updateTransaction('tx_existing', { safeName: 'Renamed' });
      expect(docSet).toHaveBeenCalledWith({ safeName: 'Renamed' }, { merge: true });

      const newId = await repo.createTransaction({
        stripeSessionId: 'cs_new',
        rawName: 'New Donor',
        safeName: 'New Donor',
        isNameSanitized: false,
        creditVisibility: 'show',
        amount: 300,
        currency: 'jpy',
        tier: 'bronze',
        itemLabel: 'Energy Drink',
        rewardImageId: 'reward_1',
        status: 'pending',
        isBanned: false,
        createdAt: '2026-10-21T02:00:00.000Z',
      });
      expect(newId).toBe('tx_gen_id');
    });

    it('manages reward images CRUD', async () => {
      mockRewardImagesColl.get.mockResolvedValueOnce({
        docs: [
          {
            id: 'rew_1',
            data: () => ({
              title: 'Halloween 2026',
              imageUrl: 'https://example.com/art.png',
              storagePath: 'rewards/art.png',
              isActive: true,
              distributedCount: 15,
              createdAt: { toDate: () => new Date('2026-10-01T00:00:00Z') },
              updatedAt: { toDate: () => new Date('2026-10-02T00:00:00Z') },
            }),
          },
        ],
      });

      const rewards = await repo.getRewardImages();
      expect(rewards).toHaveLength(1);
      expect(rewards[0].id).toBe('rew_1');

      // getRewardImageById found & not found
      const docGet = jest.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'rew_1',
          data: () => ({ title: 'Halloween 2026', isActive: true }),
        })
        .mockResolvedValueOnce({ exists: false });

      mockRewardImagesColl.doc.mockReturnValue({ get: docGet, set: jest.fn(), delete: jest.fn(), id: 'rew_new' });

      const found = await repo.getRewardImageById('rew_1');
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Halloween 2026');

      const notFound = await repo.getRewardImageById('rew_missing');
      expect(notFound).toBeNull();

      // create, update, delete
      const createdId = await repo.createRewardImage({
        title: 'New Art',
        imageUrl: 'https://img',
        storagePath: 'path',
        isActive: true,
        distributedCount: 0,
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
      });
      expect(createdId).toBe('rew_new');

      await repo.updateRewardImage('rew_1', { isActive: false });
      await repo.deleteRewardImage('rew_1');
    });

    it('covers pagination cursor and nextCursor in getTransactions', async () => {
      mockSupportTransactionsColl.get.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx_1',
            data: () => ({ stripeSessionId: 'cs_1', rawName: 'One', safeName: 'One', amount: 300, tier: 'bronze', status: 'completed' }),
          },
          {
            id: 'tx_2',
            data: () => ({ stripeSessionId: 'cs_2', rawName: 'Two', safeName: 'Two', amount: 300, tier: 'bronze', status: 'completed' }),
          },
          {
            id: 'tx_3',
            data: () => ({ stripeSessionId: 'cs_3', rawName: 'Three', safeName: 'Three', amount: 300, tier: 'bronze', status: 'completed' }),
          },
        ],
      });

      const resWithNext = await repo.getTransactions({ limit: 1 });
      expect(resWithNext.transactions).toHaveLength(1);
      expect(resWithNext.nextCursor).toBe('tx_1');

      mockSupportTransactionsColl.get.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx_1',
            data: () => ({ stripeSessionId: 'cs_1', rawName: 'One', safeName: 'One', amount: 300, tier: 'bronze', status: 'completed' }),
          },
          {
            id: 'tx_2',
            data: () => ({ stripeSessionId: 'cs_2', rawName: 'Two', safeName: 'Two', amount: 300, tier: 'bronze', status: 'completed' }),
          },
        ],
      });

      const resWithCursor = await repo.getTransactions({ cursor: 'tx_1', limit: 1 });
      expect(resWithCursor.transactions).toHaveLength(1);
      expect(resWithCursor.transactions[0].id).toBe('tx_2');

      mockSupportTransactionsColl.get.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx_1',
            data: () => ({ stripeSessionId: 'cs_1', rawName: 'One', safeName: 'One', amount: 300, tier: 'bronze', status: 'completed' }),
          },
        ],
      });

      const resUnknownCursor = await repo.getTransactions({ cursor: 'unknown_id', limit: 1 });
      expect(resUnknownCursor.transactions).toHaveLength(1);
    });

    it('handles repository errors with logger and rethrow', async () => {
      const err = new Error('Firestore Error');
      mockSupportTransactionsColl.get.mockRejectedValueOnce(err);
      await expect(repo.getTransactions({})).rejects.toThrow('Firestore Error');

      mockSupportTransactionsColl.doc.mockReturnValueOnce({
        get: jest.fn().mockRejectedValueOnce(err),
      });
      await expect(repo.getTransactionById('tx_err')).rejects.toThrow('Firestore Error');

      mockSupportTransactionsColl.doc.mockReturnValueOnce({
        set: jest.fn().mockRejectedValueOnce(err),
      });
      await expect(repo.updateTransaction('tx_err', {})).rejects.toThrow('Firestore Error');

      mockSupportTransactionsColl.doc.mockReturnValueOnce({
        set: jest.fn().mockRejectedValueOnce(err),
        id: 'new_id',
      });
      await expect(repo.createTransaction({} as any)).rejects.toThrow('Firestore Error');

      mockRewardImagesColl.get.mockRejectedValueOnce(err);
      await expect(repo.getRewardImages()).rejects.toThrow('Firestore Error');

      mockRewardImagesColl.doc.mockReturnValueOnce({
        get: jest.fn().mockRejectedValueOnce(err),
      });
      await expect(repo.getRewardImageById('rew_err')).rejects.toThrow('Firestore Error');

      mockRewardImagesColl.doc.mockReturnValueOnce({
        set: jest.fn().mockRejectedValueOnce(err),
        id: 'new_id',
      });
      await expect(repo.createRewardImage({} as any)).rejects.toThrow('Firestore Error');

      mockRewardImagesColl.doc.mockReturnValueOnce({
        set: jest.fn().mockRejectedValueOnce(err),
      });
      await expect(repo.updateRewardImage('rew_err', {})).rejects.toThrow('Firestore Error');

      mockRewardImagesColl.doc.mockReturnValueOnce({
        delete: jest.fn().mockRejectedValueOnce(err),
      });
      await expect(repo.deleteRewardImage('rew_err')).rejects.toThrow('Firestore Error');
    });
  });
});
