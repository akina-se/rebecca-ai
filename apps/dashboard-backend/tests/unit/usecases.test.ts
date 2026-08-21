import { UsersUseCase } from '../../src/features/users/usecase';
import { UsersRepository } from '../../src/features/users/repository';
import { AssetsUseCase, UploadedFile } from '../../src/features/assets/usecase';
import { AssetsRepository } from '../../src/features/assets/repository';
import { TimelineUseCase } from '../../src/features/timeline/usecase';
import { TimelineRepository } from '../../src/features/timeline/repository';
import { SystemMemoryUseCase } from '../../src/features/system-memory/usecase';
import { SystemMemoryRepository } from '../../src/features/system-memory/repository';
import { CopilotUseCase } from '../../src/features/copilot/usecase';
import { UserStatus, AssetStatus, PostLeaderboard, PostDetail, SystemAlert, KpiMetrics, Asset, MemoryLayer, MemoryContent, UserDetail } from '@rebecca/types';
import { config } from '../../src/config';

// Mock gRPC Client
jest.mock('../../src/core/grpcClient', () => ({
  deleteTweetViaGrpc: jest.fn().mockImplementation(async (id: string) => {
    if (id === 'error_post') throw new Error('gRPC connection timeout');
    return { success: true, message: 'Deleted' };
  })
}));

// Mock Google Cloud Storage
const mockSave = jest.fn().mockResolvedValue(undefined);
const mockFile = jest.fn().mockReturnValue({ save: mockSave });
const mockBucket = jest.fn().mockReturnValue({ file: mockFile });
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: mockBucket
  }))
}));

// Mock Gemini AI
const mockGenerateContent = jest.fn();
const mockEmbedContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent
    }
  })),
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY'
  }
}));

describe('Dashboard Backend UseCases Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config.gemini as any).apiKey = 'test-gemini-key';
  });

  describe('UsersUseCase', () => {
    let repo: jest.Mocked<UsersRepository>;
    let useCase: UsersUseCase;

    beforeEach(() => {
      repo = {
        getAll: jest.fn(),
        getById: jest.fn(),
        updateMemory: jest.fn(),
        updateStatusBulk: jest.fn()
      } as unknown as jest.Mocked<UsersRepository>;
      useCase = new UsersUseCase(repo);
    });

    it('getAllUsers should delegate to repository', async () => {
      const mockUser: UserDetail = {
        id: 'u1',
        handle: 'alice',
        name: 'Alice',
        interactions: 5,
        affinityScore: '95',
        firstSeen: '2026-08-01',
        lastSeen: '2026-08-18',
        coreProfile: '{}',
        chatHistory: [],
        status: UserStatus.ACTIVE
      };
      const mockResult = {
        data: [mockUser],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      };
      repo.getAll.mockResolvedValueOnce(mockResult);

      const res = await useCase.getAllUsers({ page: 1, limit: 10 });
      expect(repo.getAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(res).toEqual(mockResult);
    });

    it('getUserById should delegate to repository', async () => {
      const mockUser: UserDetail = {
        id: 'u1',
        handle: 'alice',
        name: 'Alice',
        interactions: 5,
        affinityScore: '95',
        firstSeen: '2026-08-01',
        lastSeen: '2026-08-18',
        coreProfile: '{}',
        chatHistory: [],
        status: UserStatus.ACTIVE
      };
      repo.getById.mockResolvedValueOnce(mockUser);

      const res = await useCase.getUserById('u1');
      expect(repo.getById).toHaveBeenCalledWith('u1');
      expect(res).toEqual(mockUser);
    });

    it('updateUserMemory should delegate to repository', async () => {
      repo.updateMemory.mockResolvedValueOnce(undefined);

      await useCase.updateUserMemory('u1', '{"bio":"test"}');
      expect(repo.updateMemory).toHaveBeenCalledWith('u1', '{"bio":"test"}');
    });

    it('bulkUpdateStatus should delegate to repository', async () => {
      repo.updateStatusBulk.mockResolvedValueOnce(undefined);

      await useCase.bulkUpdateStatus(['u1', 'u2'], UserStatus.BLOCKED);
      expect(repo.updateStatusBulk).toHaveBeenCalledWith(['u1', 'u2'], UserStatus.BLOCKED);
    });
  });

  describe('AssetsUseCase', () => {
    let repo: jest.Mocked<AssetsRepository>;
    let useCase: AssetsUseCase;

    beforeEach(() => {
      repo = {
        getPaginated: jest.fn(),
        getAll: jest.fn(),
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn()
      } as unknown as jest.Mocked<AssetsRepository>;
      useCase = new AssetsUseCase(repo);
    });

    it('getPaginatedAssets should delegate to repository', async () => {
      const mockAsset: Asset = {
        id: 'a1',
        filename: 'test.jpg',
        caption: 'A sunny day',
        usedCount: 0,
        status: AssetStatus.SUCCESS,
        url: 'http://test.jpg'
      };
      const mockResult = {
        data: [mockAsset],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      };
      repo.getPaginated.mockResolvedValueOnce(mockResult);

      const res = await useCase.getPaginatedAssets({ page: 1, limit: 10 });
      expect(repo.getPaginated).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(res).toEqual(mockResult);
    });

    it('getAllAssets should delegate to repository', async () => {
      const mockAssets: Asset[] = [{
        id: 'a1',
        filename: 'test.jpg',
        caption: 'A sunny day',
        usedCount: 0,
        status: AssetStatus.SUCCESS,
        url: 'http://test.jpg'
      }];
      repo.getAll.mockResolvedValueOnce(mockAssets);

      const res = await useCase.getAllAssets();
      expect(repo.getAll).toHaveBeenCalled();
      expect(res).toEqual(mockAssets);
    });

    it('getAssetById should delegate to repository', async () => {
      const mockAsset: Asset = {
        id: 'a1',
        filename: 'test.jpg',
        caption: 'A sunny day',
        usedCount: 0,
        status: AssetStatus.SUCCESS,
        url: 'http://test.jpg'
      };
      repo.getById.mockResolvedValueOnce(mockAsset);

      const res = await useCase.getAssetById('a1');
      expect(repo.getById).toHaveBeenCalledWith('a1');
      expect(res).toEqual(mockAsset);
    });

    it('updateAsset should delegate to repository', async () => {
      repo.update.mockResolvedValueOnce(undefined);

      await useCase.updateAsset('a1', { status: AssetStatus.PENDING });
      expect(repo.update).toHaveBeenCalledWith('a1', { status: AssetStatus.PENDING });
    });

    it('deleteAssets should delegate to repository', async () => {
      repo.deleteMany.mockResolvedValueOnce(undefined);

      await useCase.deleteAssets(['a1', 'a2']);
      expect(repo.deleteMany).toHaveBeenCalledWith(['a1', 'a2']);
    });

    it('uploadImages should save to GCS and generate caption + embedding with Gemini', async () => {
      const file: UploadedFile = {
        originalname: 'summer_vibes.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake_image_content')
      };

      mockGenerateContent.mockResolvedValueOnce({
        text: '青空の下で微笑むレベッカのイラスト'
      });
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2, 0.3] }]
      });

      const res = await useCase.uploadImages([file]);
      expect(res).toHaveLength(1);
      expect(res[0].filename).toBe('summer_vibes.png');
      expect(res[0].status).toBe(AssetStatus.SUCCESS);
      expect(res[0].caption).toBe('青空の下で微笑むレベッカのイラスト');
      expect(repo.create).toHaveBeenCalledWith(
        expect.stringMatching(/^img_/),
        expect.objectContaining({
          filename: 'summer_vibes.png',
          caption: '青空の下で微笑むレベッカのイラスト',
          embedding: [0.1, 0.2, 0.3],
          status: AssetStatus.SUCCESS
        })
      );
    });

    it('uploadImages should handle GCS error with fallback data URL and Gemini error with FAILED status', async () => {
      const file: UploadedFile = {
        originalname: 'error.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake_data')
      };

      mockSave.mockRejectedValueOnce(new Error('GCS upload error'));
      mockGenerateContent.mockRejectedValueOnce(new Error('Vision API error'));

      const res = await useCase.uploadImages([file]);
      expect(res).toHaveLength(1);
      expect(res[0].status).toBe(AssetStatus.FAILED);
      expect(res[0].caption).toBe('');
      expect(res[0].url).toContain('data:image/png;base64,');
    });

    it('regenerateCaptions should update existing assets with new captions and embeddings', async () => {
      repo.getAll.mockResolvedValueOnce([
        {
          id: 'img_123',
          filename: 'rebecca_smile.png',
          caption: 'Old caption',
          usedCount: 3,
          status: AssetStatus.SUCCESS,
          url: 'http://img1.png'
        }
      ]);

      mockGenerateContent.mockResolvedValueOnce({
        text: '新しく生成された高画質なレベッカの笑顔イラスト'
      });
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.5, 0.6, 0.7] }]
      });

      await useCase.regenerateCaptions(['img_123']);

      expect(repo.update).toHaveBeenCalledWith('img_123', {
        caption: '新しく生成された高画質なレベッカの笑顔イラスト',
        status: AssetStatus.SUCCESS,
        usedCount: 3,
        embedding: [0.5, 0.6, 0.7]
      });
    });

    it('regenerateCaptions fallback without AI key', async () => {
      (config.gemini as any).apiKey = '';
      const noAiUseCase = new AssetsUseCase(repo);

      repo.getAll.mockResolvedValueOnce([
        {
          id: 'img_fallback',
          filename: 'fallback.png',
          caption: 'Old',
          usedCount: 0,
          status: AssetStatus.FAILED,
          url: 'http://fallback.png'
        }
      ]);

      await noAiUseCase.regenerateCaptions(['img_fallback']);
      expect(repo.update).toHaveBeenCalledWith('img_fallback', expect.objectContaining({
        status: AssetStatus.SUCCESS
      }));
    });
  });

  describe('TimelineUseCase', () => {
    let repo: jest.Mocked<TimelineRepository>;
    let useCase: TimelineUseCase;

    beforeEach(() => {
      repo = {
        getMetrics: jest.fn(),
        getPosts: jest.fn(),
        getPostById: jest.fn(),
        deletePosts: jest.fn(),
        getAlerts: jest.fn()
      } as unknown as jest.Mocked<TimelineRepository>;
      useCase = new TimelineUseCase(repo);
    });

    it('getMetrics should delegate to repository', async () => {
      const mockMetrics: KpiMetrics = {
        followers: 100,
        followersTrend: 5,
        engagementRate: 3.5,
        engagementTrend: 0.2,
        dailyActiveUsers: 50,
        dauTrend: 2,
        apiCalls: 1200,
        apiTrendStatus: 'stable'
      };
      repo.getMetrics.mockResolvedValueOnce(mockMetrics);

      const res = await useCase.getMetrics('monthly');
      expect(repo.getMetrics).toHaveBeenCalledWith('monthly');
      expect(res).toEqual(mockMetrics);
    });

    it('getPosts should delegate to repository', async () => {
      const mockPost: PostLeaderboard = {
        id: 'p1',
        time: '2026-08-18',
        snippet: 'Hello',
        impressions: 100,
        hasMedia: false
      };
      const mockResult = {
        data: [mockPost],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      };
      repo.getPosts.mockResolvedValueOnce(mockResult);

      const res = await useCase.getPosts({ page: 1, limit: 10 });
      expect(repo.getPosts).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(res).toEqual(mockResult);
    });

    it('getPostById should delegate to repository', async () => {
      const mockPost: PostDetail = {
        id: 'p1',
        time: '2026-08-18',
        content: 'Hello world',
        impressions: 100,
        mediaUrls: []
      };
      repo.getPostById.mockResolvedValueOnce(mockPost);

      const res = await useCase.getPostById('p1');
      expect(repo.getPostById).toHaveBeenCalledWith('p1');
      expect(res).toEqual(mockPost);
    });

    it('deletePosts should call repository and gRPC client, handling errors gracefully', async () => {
      repo.deletePosts.mockResolvedValueOnce(undefined);

      await useCase.deletePosts(['p1', 'error_post']);
      expect(repo.deletePosts).toHaveBeenCalledWith(['p1', 'error_post']);
    });

    it('getAlerts should delegate to repository', async () => {
      const mockAlerts: SystemAlert[] = [{
        id: 'al1',
        type: 'warning',
        message: 'Test alert',
        timestamp: '2026-08-18'
      }];
      repo.getAlerts.mockResolvedValueOnce(mockAlerts);

      const res = await useCase.getAlerts();
      expect(repo.getAlerts).toHaveBeenCalled();
      expect(res).toEqual(mockAlerts);
    });
  });

  describe('SystemMemoryUseCase', () => {
    let repo: jest.Mocked<SystemMemoryRepository>;
    let useCase: SystemMemoryUseCase;

    beforeEach(() => {
      repo = {
        getLayers: jest.fn(),
        getCoreMemory: jest.fn(),
        getExtendedMemory: jest.fn(),
        updateExtendedMemory: jest.fn(),
        getGlobalMemory: jest.fn(),
        updateGlobalMemory: jest.fn(),
        triggerDreaming: jest.fn()
      } as unknown as jest.Mocked<SystemMemoryRepository>;
      useCase = new SystemMemoryUseCase(repo);
    });

    it('getLayers should delegate to repository', async () => {
      const mockLayers: MemoryLayer[] = [{
        level: 0,
        name: 'Core Persona',
        description: 'Core',
        lastUpdated: '2026-08-18',
        isReadOnly: true
      }];
      repo.getLayers.mockResolvedValueOnce(mockLayers);

      const res = await useCase.getLayers();
      expect(repo.getLayers).toHaveBeenCalled();
      expect(res).toEqual(mockLayers);
    });

    it('getCoreMemory should delegate to repository', async () => {
      const mockContent: MemoryContent = {
        level: 0,
        name: 'Core Persona',
        content: 'Core prompt',
        isReadOnly: true
      };
      repo.getCoreMemory.mockResolvedValueOnce(mockContent);

      const res = await useCase.getCoreMemory();
      expect(repo.getCoreMemory).toHaveBeenCalled();
      expect(res).toEqual(mockContent);
    });

    it('getExtendedMemory should delegate to repository', async () => {
      const mockContent: MemoryContent = {
        level: 1,
        name: 'Extended Persona',
        content: 'Extended prompt',
        isReadOnly: false
      };
      repo.getExtendedMemory.mockResolvedValueOnce(mockContent);

      const res = await useCase.getExtendedMemory();
      expect(repo.getExtendedMemory).toHaveBeenCalled();
      expect(res).toEqual(mockContent);
    });

    it('updateExtendedMemory should delegate to repository', async () => {
      repo.updateExtendedMemory.mockResolvedValueOnce(undefined);

      await useCase.updateExtendedMemory('New extended prompt');
      expect(repo.updateExtendedMemory).toHaveBeenCalledWith('New extended prompt');
    });

    it('getGlobalMemory should delegate to repository', async () => {
      const mockContent: MemoryContent = {
        level: 2,
        name: 'Global Memory',
        content: 'Global timeline summary',
        isReadOnly: false
      };
      repo.getGlobalMemory.mockResolvedValueOnce(mockContent);

      const res = await useCase.getGlobalMemory();
      expect(repo.getGlobalMemory).toHaveBeenCalled();
      expect(res).toEqual(mockContent);
    });

    it('updateGlobalMemory should delegate to repository', async () => {
      repo.updateGlobalMemory.mockResolvedValueOnce(undefined);

      await useCase.updateGlobalMemory('New global summary');
      expect(repo.updateGlobalMemory).toHaveBeenCalledWith('New global summary');
    });

    it('triggerDreaming should delegate to repository', async () => {
      repo.triggerDreaming.mockResolvedValueOnce(undefined);
      await useCase.triggerDreaming();
      expect(repo.triggerDreaming).toHaveBeenCalled();
    });
  });

  describe('CopilotUseCase', () => {
    let timelineRepo: jest.Mocked<TimelineRepository>;
    let usersRepo: jest.Mocked<UsersRepository>;
    let assetsRepo: jest.Mocked<AssetsRepository>;
    let memoryRepo: jest.Mocked<SystemMemoryRepository>;
    let copilotUseCase: CopilotUseCase;

    beforeEach(() => {
      timelineRepo = {
        getMetrics: jest.fn().mockResolvedValue({
          followers: 120,
          followersTrend: 4,
          engagementRate: 4.8,
          engagementTrend: 0.5,
          dailyActiveUsers: 60,
          dauTrend: 3,
          apiCalls: 1500,
          apiTrendStatus: 'stable'
        }),
        getPosts: jest.fn().mockResolvedValue({
          data: [{ id: 'post_1', snippet: 'Trending tweet', impressions: 500, time: '2026-08-18', hasMedia: false }],
          meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
        })
      } as unknown as jest.Mocked<TimelineRepository>;

      usersRepo = {
        getAll: jest.fn().mockResolvedValue({
          data: [{ id: 'u1', handle: '@bob', interactions: 20, status: UserStatus.ACTIVE }],
          meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
        })
      } as unknown as jest.Mocked<UsersRepository>;

      assetsRepo = {
        getAll: jest.fn().mockResolvedValue([
          { id: 'a1', filename: 'failed.png', caption: '', status: AssetStatus.FAILED, usedCount: 0, url: 'http://test' }
        ])
      } as unknown as jest.Mocked<AssetsRepository>;

      memoryRepo = {} as unknown as jest.Mocked<SystemMemoryRepository>;

      copilotUseCase = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo);
    });

    it('processChat should handle Gemini response with structured action card', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'マスター！悪質ユーザー @toxic_user をブロックするわね♡',
          actionRequired: {
            type: 'BLOCK_USER',
            title: 'Block User @toxic_user',
            description: 'Block user from replying',
            impactLevel: 'danger',
            requiresConfirmation: true,
            payload: { userId: 'toxic_user', handle: '@toxic_user' }
          },
          suggestionChips: ['OK', 'Cancel']
        })
      });

      const res = await copilotUseCase.processChat({
        message: '@toxic_user をブロックして',
        currentContext: 'User List',
        history: [{ role: 'user', text: 'Hello' }, { role: 'model', text: 'Hi Master!' }],
        language: 'ja'
      });

      expect(res.reply).toContain('マスター！');
      expect(res.actionRequired).toBeDefined();
      expect(res.actionRequired?.type).toBe('BLOCK_USER');
    });

    it('processChat should handle English gyaru persona in fallback', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Quota limit'));

      const res = await copilotUseCase.processChat({
        message: 'Please delete this post right away',
        currentContext: 'Timeline',
        language: 'en'
      });

      expect(res.reply).toContain('Master');
      expect(res.actionRequired?.type).toBe('DELETE_POST');
      expect(res.actionRequired?.title).toBe('Confirm Post Deletion');
    });

    it('processChat fallback should generate autonomous actions for assets, dreaming, and KPI', async () => {
      // Failed Captions fallback
      const assetRes = await copilotUseCase.processChat({
        message: 'キャプションの再生成をお願い',
        currentContext: 'Assets Library',
        language: 'ja'
      });
      expect(assetRes.actionRequired?.type).toBe('REGENERATE_CAPTIONS');

      // Dreaming fallback
      const dreamRes = await copilotUseCase.processChat({
        message: 'ドリーミングを実行してペルソナを最適化して',
        currentContext: 'System Memory',
        language: 'ja'
      });
      expect(dreamRes.actionRequired?.type).toBe('FORCE_DREAMING');

      // KPI telemetry query fallback
      const kpiRes = await copilotUseCase.processChat({
        message: '今月のKPI分析を教えて',
        currentContext: 'Dashboard Overview',
        language: 'ja'
      });
      expect(kpiRes.reply).toContain('パフォーマンスログを分析したわよ');
      expect(kpiRes.actionRequired).toBeNull();
    });
  });
});
