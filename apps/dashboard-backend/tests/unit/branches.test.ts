import { UsersRepository } from '../../src/features/users/repository';
import { TimelineRepository } from '../../src/features/timeline/repository';
import { TimelineUseCase } from '../../src/features/timeline/usecase';
import { TimelineController } from '../../src/features/timeline/controller';
import { AssetsRepository } from '../../src/features/assets/repository';
import { SystemMemoryRepository } from '../../src/features/system-memory/repository';
import { CopilotUseCase } from '../../src/features/copilot/usecase';
import { UserStatus, AssetStatus } from '@rebecca/types';
import { createMockFirestore } from './testUtils';
import { config } from '../../src/config';
import { Request, Response } from 'express';

// Mock storage
const mockGetSignedUrl = jest.fn();
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        getSignedUrl: mockGetSignedUrl
      })
    })
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

describe('Dashboard Backend Exhaustive Branch Coverage Tests', () => {
  let mock: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockFirestore();
    (config.gemini as any).apiKey = 'test-gemini-key';
  });

  describe('UsersRepository Branches', () => {
    let repo: UsersRepository;

    beforeEach(() => {
      repo = new UsersRepository(mock.firestore);
    });

    it('resolveUserName should test all name resolution branches', async () => {
      const mockDocs = [
        {
          id: 'user_one',
          data: () => ({
            name: 'Unknown',
            coreProfile: { name: 'Profile Name' }
          })
        },
        {
          id: 'user_two',
          data: () => ({
            coreProfile: JSON.stringify({ name: 'JSON Profile Name' })
          })
        },
        {
          id: 'user_three_cool',
          data: () => ({
            coreProfile: 'INVALID_JSON'
          })
        },
        {
          id: 'user_four_vip',
          data: () => ({
            name: 'Unknown'
          })
        }
      ];

      (repo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const res = await repo.getAll({ sortBy: 'handle', sortOrder: 'asc' });
      expect(res.data[0].name).toBe('User Four Vip');
      expect(res.data[1].name).toBe('Profile Name');
      expect(res.data[2].name).toBe('User Three Cool');
      expect(res.data[3].name).toBe('JSON Profile Name');
    });

    it('getAll should test sorting by handle (desc/asc), interactions, lastSeen, and yearly period filter', async () => {
      const mockDocs = [
        {
          id: 'alice_z',
          data: () => ({
            lastSeen: '2026-08-10T00:00:00Z',
            status: 'MUTED',
            coreProfile: { important_memories: ['m1', 'm2'] },
            episodicBuffer: ['e1'],
            interactions: 10,
            _dynamicInteractions: 10
          })
        },
        {
          id: 'bob_a',
          data: () => ({
            lastSeen: '2026-08-15T00:00:00Z',
            status: 'BLOCKED',
            coreProfile: '{}',
            interactions: 50,
            _dynamicInteractions: 50
          })
        }
      ];

      (repo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      (repo as any).collections.conversationLogs.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            docs: [
              { data: () => ({ userId: 'alice_z' }) },
              { data: () => ({ userId: 'bob_a' }) }
            ]
          })
        })
      });

      // Test yearly period and handle desc sort
      const res = await repo.getAll({ period: 'yearly', date: '2026', sortBy: 'handle', sortOrder: 'desc' });
      expect(res.data[0].id).toBe('bob_a');
      expect(res.data[1].id).toBe('alice_z');
      expect(res.data[0].status).toBe(UserStatus.BLOCKED);
      expect(res.data[1].status).toBe(UserStatus.MUTED);
      expect(res.data[1].ragMemoriesStatus).toBe('Generated');

      // Test sort by interactions desc and asc
      (repo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });
      const resInteractions = await repo.getAll({ sortBy: 'interactions', sortOrder: 'desc' });
      expect(resInteractions.data[0].id).toBe('bob_a');

      // Test sort by lastSeen asc
      (repo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });
      const resLastSeen = await repo.getAll({ sortBy: 'lastSeen', sortOrder: 'asc' });
      expect(resLastSeen.data[0].id).toBe('alice_z');
    });

    it('getById should test pagination beforeTimestamp, limit, and status branches', async () => {
      (repo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'u_muted',
          data: () => ({
            name: 'Muted User',
            status: 'MUTED',
            coreProfile: {}
          })
        })
      });

      const mockLogs = [
        { data: () => ({ timestamp: '2026-08-01T00:00:00Z', userText: 'Old msg' }) },
        { data: () => ({ timestamp: '2026-08-10T00:00:00Z', userText: 'Newer msg', aiText: 'Reply' }) }
      ];

      (repo as any).collections.conversationLogs.where = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({ docs: mockLogs })
      });

      const res = await repo.getById('u_muted', '2026-08-05T00:00:00Z', 1);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(UserStatus.MUTED);
      expect(res?.chatHistory).toHaveLength(1);
      expect(res?.chatHistory[0].text).toBe('Old msg');

      // Non-existent user
      (repo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({ exists: false })
      });
      expect(await repo.getById('non_existent')).toBeNull();
    });

    it('updateMemory should support object parameter directly', async () => {
      const mockSet = jest.fn().mockResolvedValueOnce(undefined);
      (repo as any).collections.users.doc = jest.fn().mockReturnValue({ set: mockSet });

      await repo.updateMemory('u1', { bio: 'Direct Object' });
      expect(mockSet).toHaveBeenCalledWith({ coreProfile: { bio: 'Direct Object' } }, { merge: true });
    });
  });

  describe('Timeline Controller & Repository Branches', () => {
    let repo: TimelineRepository;
    let useCase: TimelineUseCase;
    let controller: TimelineController;

    beforeEach(() => {
      repo = new TimelineRepository(mock.firestore);
      useCase = new TimelineUseCase(repo);
      controller = new TimelineController(useCase);
    });

    it('TimelineController.getPosts should parse all query parameters', async () => {
      const mockResult = {
        data: [],
        meta: { totalItems: 0, totalPages: 1, currentPage: 2, limit: 25 }
      };
      jest.spyOn(useCase, 'getPosts').mockResolvedValueOnce(mockResult);

      const req = {
        query: {
          page: '2',
          limit: '25',
          sortBy: 'impressions',
          sortOrder: 'asc',
          period: 'monthly',
          date: '2026-08'
        }
      } as unknown as Request;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      await controller.getPosts(req, res);
      expect(useCase.getPosts).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
        sortBy: 'impressions',
        sortOrder: 'asc',
        period: 'monthly',
        date: '2026-08'
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('TimelineUseCase.getMetrics should default to monthly', async () => {
      jest.spyOn(repo, 'getMetrics').mockResolvedValueOnce({
        followers: 100,
        followersTrend: 0,
        engagementRate: 0,
        engagementTrend: 0,
        dailyActiveUsers: 0,
        dauTrend: 0,
        apiCalls: 0,
        apiTrendStatus: 'stable'
      });

      const metrics = await useCase.getMetrics();
      expect(repo.getMetrics).toHaveBeenCalledWith('monthly');
      expect(metrics.followers).toBe(100);
    });

    it('getSignedUrl branches: non-gs, empty, and error throw', async () => {
      // Non-existent post
      (repo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({ exists: false })
      });
      expect(await repo.getPostById('missing')).toBeNull();

      // Post with http URL and gs URL error
      (repo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'p_mix',
          data: () => ({
            content: 'Mix',
            media_urls: ['https://already.http/img.jpg', 'gs://bucket/fail.jpg']
          })
        })
      });

      mockGetSignedUrl.mockRejectedValueOnce(new Error('GCS error'));
      const post = await repo.getPostById('p_mix');
      expect(post?.mediaUrls).toHaveLength(1);
      expect(post?.mediaUrls[0]).toBe('https://already.http/img.jpg');
    });

    it('getPosts should test monthly and yearly date ranges and in-memory sort fallback with likes/retweets', async () => {
      // 1. Monthly period
      (repo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [
                {
                  id: 'p_monthly_1',
                  data: () => ({ timestamp: '2026-08-01T00:00:00Z', likes: 10, retweets: 5 })
                },
                {
                  id: 'p_monthly_2',
                  data: () => ({ timestamp: '2026-08-15T00:00:00Z', likes: 50, retweets: 20 })
                },
                {
                  id: 'p_monthly_3',
                  data: () => ({ timestamp: '2026-08-15T00:00:00Z', likes: 50, retweets: 20 })
                }
              ]
            })
          })
        })
      };

      const resMonthly = await repo.getPosts({ period: 'monthly', date: '2026-08', sortBy: 'likes', sortOrder: 'desc' });
      expect(resMonthly.data[0].id).toBe('p_monthly_2');

      // Test sort by retweets asc
      (repo as any).collections.timelineHistory = {
        get: jest.fn().mockResolvedValueOnce({
          empty: false,
          docs: [
            { id: 'p_r1', data: () => ({ retweets: 100 }) },
            { id: 'p_r2', data: () => ({ retweets: 10 }) }
          ]
        })
      };
      const resRetweets = await repo.getPosts({ sortBy: 'retweets', sortOrder: 'asc' });
      expect(resRetweets.data[0].id).toBe('p_r2');

      // Test yearly period with created_at sort
      (repo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [
                { id: 'p_y1', data: () => ({ created_at: '2026-01-01T00:00:00Z', likes: 10 }) },
                { id: 'p_y2', data: () => ({ created_at: '2026-06-01T00:00:00Z', likes: 10 }) }
              ]
            })
          })
        })
      };
      const resYearly = await repo.getPosts({ period: 'yearly', date: '2026', sortBy: 'created_at', sortOrder: 'asc' });
      expect(resYearly.data[0].id).toBe('p_y1');

      // 2. Production query count and orderBy branch
      const mockCountGet = jest.fn().mockResolvedValueOnce({
        data: () => ({ count: 1 })
      });
      const mockOrderGet = jest.fn().mockResolvedValueOnce({
        docs: [{ id: 'p_prod', data: () => ({ impressions: 500 }) }]
      });

      const chainableQuery: any = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnValue({ get: mockCountGet }),
        orderBy: jest.fn().mockReturnValue({
          offset: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: mockOrderGet
            })
          })
        })
      };
      (repo as any).collections.timelineHistory = chainableQuery;

      const resProd = await repo.getPosts({ sortBy: 'impressions', sortOrder: 'desc' });
      expect(resProd.data).toHaveLength(1);
      expect(resProd.data[0].id).toBe('p_prod');
    });

    it('getMetrics should test weekly, monthly, yearly, and empty doc data fallback with scaling', async () => {
      // 1. Yearly metrics
      (repo as any).collections.systemStats.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          data: () => ({
            total_followers: 100,
            followers_trend: 2,
            followers_history: [50, 100],
            avg_engagement_rate: 5.0,
            engagement_trend: 0.1,
            engagement_history: [4.0, 5.0],
            dau: 20,
            dau_trend: 1,
            dau_history: [10, 20],
            api_calls_today: 100,
            api_trend_status: 'Rising',
            api_calls_history: [50, 100]
          })
        })
      });

      const metricsYearly = await repo.getMetrics('yearly');
      expect(metricsYearly.followers).toBe(1200); // 100 * 12
      expect(metricsYearly.followersHistory).toHaveLength(12);
      expect(metricsYearly.dailyActiveUsers).toBe(40); // 20 * 2

      // 2. Empty doc fallback (testing scaleArray with empty arr)
      (repo as any).collections.systemStats.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          data: () => undefined
        })
      });

      const metricsEmpty = await repo.getMetrics('weekly');
      expect(metricsEmpty.followers).toBe(0);
      expect(metricsEmpty.followersHistory).toHaveLength(7);
      expect(metricsEmpty.followersHistory?.[0]).toBe(0);
    });

    it('getPostById should test missing fields and text fallback', async () => {
      (repo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'p_text_only',
          data: () => ({
            text: 'Text only post',
            mediaUrls: ['https://example.com/pic.jpg']
          })
        })
      });

      const post = await repo.getPostById('p_text_only');
      expect(post?.content).toBe('Text only post');
      expect(post?.likes).toBe(0);
      expect(post?.retweets).toBe(0);
      expect(post?.replies).toBe(0);
    });

    it('TimelineController error handling and 404/400 branches', async () => {
      // 1. getMetrics error
      const resMetrics = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'getMetrics').mockRejectedValueOnce(new Error('Metrics error'));
      await controller.getMetrics({ query: {} } as Request, resMetrics);
      expect(resMetrics.status).toHaveBeenCalledWith(500);

      // 2. getPosts error
      const resPosts = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'getPosts').mockRejectedValueOnce(new Error('Posts error'));
      await controller.getPosts({ query: {} } as Request, resPosts);
      expect(resPosts.status).toHaveBeenCalledWith(500);

      // 3. getPostById 404 and error
      const resPost404 = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'getPostById').mockResolvedValueOnce(null);
      await controller.getPostById({ params: { id: 'missing' } } as any, resPost404);
      expect(resPost404.status).toHaveBeenCalledWith(404);

      const resPostErr = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'getPostById').mockRejectedValueOnce(new Error('Post error'));
      await controller.getPostById({ params: { id: 'p1' } } as any, resPostErr);
      expect(resPostErr.status).toHaveBeenCalledWith(500);

      // 4. deletePosts 400 and error
      const resDelete400 = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      await controller.deletePosts({ body: { ids: 'invalid' } } as Request, resDelete400);
      expect(resDelete400.status).toHaveBeenCalledWith(400);

      const resDeleteErr = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'deletePosts').mockRejectedValueOnce(new Error('Delete error'));
      await controller.deletePosts({ body: { ids: ['p1'] } } as Request, resDeleteErr);
      expect(resDeleteErr.status).toHaveBeenCalledWith(500);

      // 5. getAlerts error
      const resAlerts = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
      jest.spyOn(useCase, 'getAlerts').mockRejectedValueOnce(new Error('Alerts error'));
      await controller.getAlerts({} as Request, resAlerts);
      expect(resAlerts.status).toHaveBeenCalledWith(500);
    });
  });

  describe('AssetsRepository Branches', () => {
    let repo: AssetsRepository;

    beforeEach(() => {
      repo = new AssetsRepository(mock.firestore);
    });

    it('mapDocToAsset should handle READY, CAPTION FAILED, PROCESSING, and numeric URL fallback', async () => {
      const mockDocs = [
        {
          id: 'a1',
          data: () => ({ status: 'READY', url: 'https://picsum.photos/400/300' })
        },
        {
          id: 'a2',
          data: () => ({ status: 'CAPTION FAILED', url: 'https://cdn.example.com/anime/rebecca.png' })
        },
        {
          id: 'a3',
          data: () => ({ status: 'PROCESSING' })
        }
      ];

      (repo as any).collections.images.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const res = await repo.getPaginated();
      expect(res.data[0].status).toBe(AssetStatus.SUCCESS);
      expect(res.data[0].filename).toBe('a1.png');
      expect(res.data[1].status).toBe(AssetStatus.FAILED);
      expect(res.data[1].filename).toBe('rebecca.png');
      expect(res.data[2].status).toBe(AssetStatus.PROCESSING);
      expect(res.data[2].filename).toBe('a3.png');
    });
  });

  describe('SystemMemoryRepository Branches', () => {
    let repo: SystemMemoryRepository;

    beforeEach(() => {
      repo = new SystemMemoryRepository(mock.firestore);
    });

    it('getLayers, getExtendedMemory, getGlobalMemory should handle empty or missing system doc data gracefully', async () => {
      (repo as any).collections.system.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => undefined
        })
      });

      const layers = await repo.getLayers();
      expect(layers).toHaveLength(3);
      expect(layers[1].lastUpdated).toBe('System Deploy');

      const ext = await repo.getExtendedMemory();
      expect(ext.content).toContain('Rebecca');

      const global = await repo.getGlobalMemory();
      expect(global.content).toContain('Rebecca AI');
    });
  });

  describe('CopilotUseCase Branches', () => {
    let copilot: CopilotUseCase;
    let timelineRepo: any;
    let usersRepo: any;
    let assetsRepo: any;
    let memoryRepo: any;

    beforeEach(() => {
      timelineRepo = {
        getMetrics: jest.fn().mockResolvedValue({ followers: 100, followersTrend: 5, engagementRate: 4.5, dailyActiveUsers: 50, apiCalls: 1000 }),
        getPosts: jest.fn().mockResolvedValue({ data: [{ id: 'p1', impressions: 300, snippet: 'Top post' }] })
      };
      usersRepo = {
        getAll: jest.fn().mockResolvedValue({ data: [{ handle: '@alice', interactions: 10, status: 'ACTIVE' }] })
      };
      assetsRepo = {
        getAll: jest.fn().mockResolvedValue([{ id: 'a1', status: 'FAILED', filename: 'failed_asset.png' }])
      };
      memoryRepo = {
        getLayers: jest.fn().mockResolvedValue([
          { level: 0, name: 'Core Persona' },
          { level: 1, name: 'Extended Persona' }
        ])
      };
      copilot = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo);
    });

    it('processChat should handle alternating history with multiple consecutive user/model roles', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'Here is the analysis!',
          actionRequired: null,
          suggestionChips: ['Good']
        })
      });

      const res = await copilot.processChat({
        message: 'What are our top posts and users?',
        currentContext: 'Posts & Users',
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'user', text: 'Second question' },
          { role: 'model', text: 'Answer 1' },
          { role: 'model', text: 'Answer 2' }
        ],
        language: 'en'
      });

      expect(res.reply).toBe('Here is the analysis!');
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('processChat normalizeCopilotResponse should normalize missing actionRequired when keywords match', async () => {
      // 1. Gemini returned no actionRequired, but message requested BLOCK
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'ユーザーをブロックするわね！',
          actionRequired: null,
          suggestionChips: []
        })
      });

      const resBlock = await copilot.processChat({
        message: '@spammer_user をブロックして',
        language: 'ja'
      });
      expect(resBlock.actionRequired?.type).toBe('BLOCK_USER');
      expect(resBlock.actionRequired?.payload).toEqual({ userId: 'spammer_user', handle: '@spammer_user' });

      // 2. Gemini returned action with warning impactLevel
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: '投稿を削除します',
          actionRequired: {
            type: 'DELETE_POST',
            impactLevel: 'WARNING'
          },
          suggestionChips: []
        })
      });

      const resDelete = await copilot.processChat({
        message: 'この投稿を削除して',
        language: 'ja'
      });
      expect(resDelete.actionRequired?.impactLevel).toBe('warning');
    });

    it('processChat should gather telemetry when asking about system memory and dreaming', async () => {
      const resMemory = await copilot.processChat({
        message: 'Show me system memory status and layers',
        currentContext: 'System Memory',
        language: 'en'
      });
      expect(resMemory.reply).toBeDefined();
    });

    it('processChat should test autonomous fallback intents in Japanese and English', async () => {
      // 1. Block user without @ in English
      const resBlockEn = await copilot.processChat({
        message: 'Please block spammer_999 from replying',
        currentContext: 'User List',
        language: 'en'
      });
      expect(resBlockEn.actionRequired?.type).toBe('BLOCK_USER');
      expect(resBlockEn.actionRequired?.payload).toEqual({ userId: 'spammer_999', handle: '@spammer_999' });

      // 2. Delete post in Japanese and English
      const resDelJa = await copilot.processChat({
        message: '投稿 12345 を削除してちょうだい',
        currentContext: 'Timeline',
        language: 'ja'
      });
      expect(resDelJa.actionRequired?.type).toBe('DELETE_POST');

      // 3. Caption regeneration in Japanese and English
      const resCapJa = await copilot.processChat({
        message: '失敗したキャプションの再生成をして',
        currentContext: 'Assets Library',
        language: 'ja'
      });
      expect(resCapJa.actionRequired?.type).toBe('REGENERATE_CAPTIONS');

      const resCapEn = await copilot.processChat({
        message: 'Please regenerate failed captions for image assets',
        currentContext: 'Assets Library',
        language: 'en'
      });
      expect(resCapEn.actionRequired?.type).toBe('REGENERATE_CAPTIONS');

      // 4. Force dreaming in Japanese and English
      const resDreamJa = await copilot.processChat({
        message: 'ドリーミングプロセスを開始して',
        currentContext: 'System Memory',
        language: 'ja'
      });
      expect(resDreamJa.actionRequired?.type).toBe('FORCE_DREAMING');

      const resDreamEn = await copilot.processChat({
        message: 'Trigger autonomous dreaming evolution now',
        currentContext: 'System Memory',
        language: 'en'
      });
      expect(resDreamEn.actionRequired?.type).toBe('FORCE_DREAMING');

      // 5. KPI trend in English
      const resKpiEn = await copilot.processChat({
        message: 'What is our follower growth trend and KPI metric?',
        currentContext: 'Dashboard Overview',
        language: 'en'
      });
      expect(resKpiEn.reply).toContain('Analyzed the latest performance metrics for you, Master!♡');
    });

    it('processChat should handle general conversation fallback in Japanese and English', async () => {
      // General Japanese conversation fallback
      const resJa = await copilot.processChat({
        message: 'こんにちは！調子はどう？',
        currentContext: 'Overview',
        language: 'ja'
      });
      expect(resJa.reply).toContain('呼んだかしら、マスター♡');

      // General English conversation fallback
      const resEn = await copilot.processChat({
        message: 'Hi there! How are things going?',
        currentContext: 'Overview',
        language: 'en'
      });
      expect(resEn.reply).toContain('You called, Master?♡');
    });

    it('processChat should recover gracefully from top-level exception in telemetry gathering', async () => {
      timelineRepo.getMetrics.mockRejectedValueOnce(new Error('Fatal telemetry error'));

      const res = await copilot.processChat({
        message: 'Hello Rebecca!',
        currentContext: 'Overview',
        language: 'ja'
      });

      expect(res.reply).toContain('呼んだかしら、マスター♡');
    });
  });

  describe('AssetsUseCase & ConfigController Branches', () => {
    it('AssetsUseCase uploadAssets and regenerateCaptions with Gemini Vision and Embedding branches', async () => {
      const { AssetsUseCase } = require('../../src/features/assets/usecase');
      const assetsRepo = {
        create: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
        getAll: jest.fn().mockResolvedValue([{ id: 'img_test', filename: 'test.jpg', usedCount: 1, caption: '' }]),
        getById: jest.fn().mockResolvedValue({ id: 'img_test', filename: 'test.jpg', usedCount: 1, caption: '' }),
        update: jest.fn().mockResolvedValue(undefined)
      } as any;

      const assetsUseCase = new AssetsUseCase(assetsRepo);

      // 1. Successful Vision analysis & Embedding
      mockGenerateContent.mockResolvedValueOnce({ text: '綺麗なアニメイラスト' });
      mockEmbedContent.mockResolvedValueOnce({ embeddings: [{ values: [0.1, 0.2, 0.3] }] });

      const uploadRes = await assetsUseCase.uploadImages([
        {
          originalname: 'test.png',
          mimetype: 'image/png',
          buffer: Buffer.from('mock-png-data')
        }
      ]);

      expect(uploadRes[0].caption).toBe('綺麗なアニメイラスト');
      expect(uploadRes[0].status).toBe(AssetStatus.SUCCESS);

      // 2. Vision returns empty caption (FAILED)
      mockGenerateContent.mockResolvedValueOnce({ text: '' });
      const emptyCapRes = await assetsUseCase.uploadImages([
        {
          originalname: 'empty.png',
          mimetype: 'image/png',
          buffer: Buffer.from('mock-png-data')
        }
      ]);
      expect(emptyCapRes[0].status).toBe(AssetStatus.FAILED);

      // 3. Vision throws error (FAILED)
      mockGenerateContent.mockRejectedValueOnce(new Error('Vision error'));
      const errRes = await assetsUseCase.uploadImages([
        {
          originalname: 'error.png',
          mimetype: 'image/png',
          buffer: Buffer.from('mock-png-data')
        }
      ]);
      expect(errRes[0].status).toBe(AssetStatus.FAILED);

      // 4. Regenerate caption with Gemini AI and embedding failure handling
      mockGenerateContent.mockResolvedValueOnce({ text: '再生成キャプション' });
      mockEmbedContent.mockRejectedValueOnce(new Error('Embedding fail'));

      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        caption: '再生成キャプション',
        status: AssetStatus.SUCCESS
      }));

      // 5. Regenerate caption with empty response
      mockGenerateContent.mockResolvedValueOnce({ text: '' });
      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        status: AssetStatus.FAILED
      }));

      // 6. Regenerate caption with error throw
      mockGenerateContent.mockRejectedValueOnce(new Error('Regen error'));
      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        status: AssetStatus.FAILED
      }));
    });

    it('ConfigController branches with all custom environment variables', () => {
      const { ConfigController } = require('../../src/features/config/controller');
      const configController = new ConfigController();

      delete process.env.GCP_PROJECT_ID;
      delete process.env.PUBLIC_SITE_URL;
      process.env.NODE_ENV = 'development';
      process.env.FIREBASE_AUTH_DOMAIN = 'custom-auth.domain.com';
      process.env.FIREBASE_STORAGE_BUCKET = 'custom-storage.bucket.com';
      process.env.FIREBASE_MESSAGING_SENDER_ID = '12345678';
      process.env.FIREBASE_WEB_APP_ID = 'app:1:123';
      process.env.FIREBASE_WEB_API_KEY = 'CUSTOM_API_KEY';

      const req = {} as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

      configController.getConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        firebase: {
          apiKey: 'CUSTOM_API_KEY',
          authDomain: 'custom-auth.domain.com',
          projectId: 'rebecca-ai-gal',
          storageBucket: 'custom-storage.bucket.com',
          messagingSenderId: '12345678',
          appId: 'app:1:123'
        },
        apiUrl: '/api/v1',
        publicSiteUrl: 'https://rebecca-ai.net',
        production: false,
        useEmulators: true
      });
    });
  });
});

