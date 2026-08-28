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

// Mock Cloud Tasks for SystemMemoryRepository
const mockCreateTask = jest.fn().mockResolvedValue([{}]);
const mockQueuePath = jest.fn().mockReturnValue('projects/p/locations/l/queues/q');
jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    queuePath: mockQueuePath,
    createTask: mockCreateTask
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

    it('getAll should map clean username and name without fake fallbacks', async () => {
      const mockDocs = [
        {
          id: 'user_one',
          data: () => ({
            name: 'Direct Name',
            username: 'user_one_handle'
          })
        },
        {
          id: 'user_two',
          data: () => ({
            username: 'user_two_handle'
          })
        },
        {
          id: 'user_three',
          data: () => ({})
        }
      ];

      (repo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const res = await repo.getAll({ sortBy: 'username', sortOrder: 'asc' });
      expect(res.data[0].name).toBe('');
      expect(res.data[0].username).toBe('');
      expect(res.data[1].name).toBe('Direct Name');
      expect(res.data[1].username).toBe('user_one_handle');
      expect(res.data[2].name).toBe('');
      expect(res.data[2].username).toBe('user_two_handle');
    });

    it('getAll should test sorting by username (desc/asc), interactions, lastSeen, and yearly period filter', async () => {
      const mockDocs = [
        {
          id: 'alice_z',
          data: () => ({
            username: 'alice_z',
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
            username: 'bob_a',
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

      // Test yearly period and username desc sort
      const res = await repo.getAll({ period: 'yearly', date: '2026', sortBy: 'username', sortOrder: 'desc' });
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
        apiCallsTrend: 0
      });

      const metrics = await useCase.getMetrics();
      expect(repo.getMetrics).toHaveBeenCalledWith('monthly');
      expect(metrics.followers).toBe(100);
    });

    it('getPostById branches: missing post and mix of http and gs urls', async () => {
      // Non-existent post
      (repo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({ exists: false })
      });
      expect(await repo.getPostById('missing')).toBeNull();

      // Post with http URL and gs URL
      (repo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'p_mix',
          data: () => ({
            content: 'Mix',
            media_urls: ['https://already.http/img.jpg', 'gs://bucket/photo.jpg']
          })
        })
      });

      const post = await repo.getPostById('p_mix');
      expect(post?.mediaUrls).toHaveLength(2);
      expect(post?.mediaUrls[0]).toBe('https://already.http/img.jpg');
      expect(post?.mediaUrls[1]).toBe('/api/v1/assets/photo.jpg/image');
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
      const chainableQuery: any = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [{ id: 'p_prod', data: () => ({ impressions: 500 }) }]
        }),
      };
      (repo as any).collections.timelineHistory = chainableQuery;

      const resProd = await repo.getPosts({ sortBy: 'impressions', sortOrder: 'desc' });
      expect(resProd.data).toHaveLength(1);
      expect(resProd.data[0].id).toBe('p_prod');
    });

    it('getMetrics should test weekly, monthly, yearly, and empty collection aggregation with null separation', async () => {
      // 1. Non-empty
      (repo as any).collections.processedFollowers = {
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: () => ({ count: 100 }) })
        }),
        where: jest.fn().mockReturnValue({
          count: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: () => ({ count: 80 }) })
          }),
          get: jest.fn().mockResolvedValue({
            docs: [{ data: () => ({ timestamp: new Date().toISOString() }) }]
          })
        })
      };

      const nowIso = new Date().toISOString();
      (repo as any).collections.conversationLogs = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            docs: [{ data: () => ({ userId: 'u1', timestamp: nowIso }) }],
            size: 1
          }),
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
            count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
          }),
          count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
        })
      };

      (repo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            docs: [{ data: () => ({ impressions: 200, likes: 10, retweets: 2, replies: 0, timestamp: nowIso }) }],
            size: 1
          }),
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
            count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
          }),
          count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
        })
      };

      const metricsYearly = await repo.getMetrics('yearly');
      expect(metricsYearly.followers).toBe(100);
      expect(metricsYearly.dailyActiveUsers).toBe(1);
      expect(metricsYearly.engagementRate).toBe(6);

      // 2. Empty collections
      (repo as any).collections.processedFollowers = {
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) })
        }),
        where: jest.fn().mockReturnValue({
          count: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) })
          }),
          get: jest.fn().mockResolvedValue({ docs: [] })
        })
      };
      (repo as any).collections.conversationLogs = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
            count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
          }),
          count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
        })
      };
      (repo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
            count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
          }),
          count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })
        })
      };

      const metricsEmpty = await repo.getMetrics('weekly');
      expect(metricsEmpty.followers).toBe(0);
      expect(metricsEmpty.followersTrend).toBeNull();
      expect(metricsEmpty.engagementRate).toBeNull();
      expect(metricsEmpty.apiCallsHistory).toEqual([]);
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
      expect(global.content).toBe('');
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

      // 4. Regenerate caption with Gemini AI and embedding failure handling (with image binary)
      jest.spyOn(assetsUseCase, 'getAssetBinary').mockResolvedValueOnce({
        buffer: Buffer.from('mock-png-binary'),
        contentType: 'image/png'
      });
      mockGenerateContent.mockResolvedValueOnce({ text: '再生成キャプション' });
      mockEmbedContent.mockRejectedValueOnce(new Error('Embedding fail'));

      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        caption: '再生成キャプション',
        status: AssetStatus.SUCCESS
      }));

      // 4b. Regenerate caption when image binary is null (fallback text prompt)
      jest.spyOn(assetsUseCase, 'getAssetBinary').mockResolvedValueOnce(null);
      mockGenerateContent.mockResolvedValueOnce({ text: 'フォールバックキャプション' });
      mockEmbedContent.mockResolvedValueOnce({ embeddings: [{ values: [0.1] }] });
      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        caption: 'フォールバックキャプション',
        status: AssetStatus.SUCCESS
      }));

      // 5. Regenerate caption with empty response (fallback applied)
      mockGenerateContent.mockResolvedValueOnce({ text: '' });
      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        status: AssetStatus.SUCCESS
      }));

      // 6. Regenerate caption with error throw (fallback applied)
      mockGenerateContent.mockRejectedValueOnce(new Error('Regen error'));
      await assetsUseCase.regenerateCaptions(['img_test']);
      expect(assetsRepo.update).toHaveBeenCalledWith('img_test', expect.objectContaining({
        status: AssetStatus.SUCCESS
      }));

      // 7. getAssetBinary branches
      // A. Invalid ID
      expect(await assetsUseCase.getAssetBinary('../secret.png')).toBeNull();
      expect(await assetsUseCase.getAssetBinary('')).toBeNull();

      // B. Cached thumbnail hit
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([true]),
            download: jest.fn().mockResolvedValue([Buffer.from('cached-thumb')]),
            save: jest.fn().mockResolvedValue([])
          })
        })
      };
      const cachedThumbRes = await assetsUseCase.getAssetBinary('cached_1', 'thumbnail');
      expect(cachedThumbRes?.contentType).toBe('image/webp');
      expect(cachedThumbRes?.buffer.toString()).toBe('cached-thumb');

      // In-memory cache hit on second call
      const memoryThumbRes = await assetsUseCase.getAssetBinary('cached_1', 'thumbnail');
      expect(memoryThumbRes?.contentType).toBe('image/webp');

      // C. Doc with gs:// url (PNG)
      assetsRepo.getRawDoc = jest.fn().mockResolvedValueOnce({
        url: 'gs://rebecca-ai-gal-images/images/valid.png'
      });
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([true]),
            download: jest.fn().mockResolvedValue([Buffer.from('png-bytes')]),
            getMetadata: jest.fn().mockResolvedValue([{ contentType: 'image/png' }])
          }),
          getFiles: jest.fn().mockResolvedValue([[]])
        })
      };
      const gsRes = await assetsUseCase.getAssetBinary('valid.png');
      expect(gsRes?.contentType).toBe('image/png');

      // D. Conventional path exists (JPEG)
      assetsRepo.getRawDoc = jest.fn().mockResolvedValueOnce(null);
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([true]),
            download: jest.fn().mockResolvedValue([Buffer.from('jpeg-bytes')]),
            getMetadata: jest.fn().mockResolvedValue([{ contentType: 'image/jpeg' }])
          }),
          getFiles: jest.fn().mockResolvedValue([[]])
        })
      };
      const convRes = await assetsUseCase.getAssetBinary('conv_test');
      expect(convRes?.contentType).toBe('image/jpeg');

      // E. Prefix search in media_assets
      assetsRepo.getRawDoc = jest.fn().mockResolvedValueOnce(null);
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([false])
          }),
          getFiles: jest.fn()
            .mockResolvedValueOnce([[{ name: 'media_assets/prefix_123.png', download: jest.fn().mockResolvedValue([Buffer.from('prefix-bytes')]) }]])
            .mockResolvedValueOnce([[]])
        })
      };
      const prefixRes = await assetsUseCase.getAssetBinary('prefix_123');
      expect(prefixRes?.contentType).toBe('image/png');

      // F. Base64 data URI
      assetsRepo.getRawDoc = jest.fn().mockResolvedValueOnce({
        url: 'data:image/webp;base64,dGVzdA=='
      });
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([false])
          }),
          getFiles: jest.fn().mockResolvedValue([[]])
        })
      };
      const b64Res = await assetsUseCase.getAssetBinary('b64_test');
      expect(b64Res?.contentType).toBe('image/webp');
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
        version: expect.any(String),
        publicSiteUrl: 'https://rebecca-ai.net',
        production: false,
        useEmulators: true
      });
    });

    it('SystemMemoryRepository.triggerDreaming branches', async () => {
      const memoryRepo = new SystemMemoryRepository(mock.firestore as any);

      // Branch 1: Emulator / non-production
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      await expect(memoryRepo.triggerDreaming()).resolves.toBeUndefined();

      delete process.env.FIRESTORE_EMULATOR_HOST;
    });

    it('AssetsUseCase on-demand sharp thumbnail generation and LRU cache eviction', async () => {
      const { AssetsUseCase } = require('../../src/features/assets/usecase');
      const assetsRepo = {
        getRawDoc: jest.fn().mockResolvedValue({ url: 'gs://rebecca-ai-gal-images/images/test_thumb.png' })
      } as any;

      const assetsUseCase = new AssetsUseCase(assetsRepo);

      // 1x1 valid PNG base64 for sharp resize
      const validPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const mockFile = {
        exists: jest.fn().mockResolvedValue([true]),
        download: jest.fn().mockResolvedValue([validPngBuffer]),
        getMetadata: jest.fn().mockResolvedValue([{ contentType: 'image/png' }]),
        save: jest.fn().mockResolvedValue([])
      };

      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue(mockFile)
        })
      };

      // 1. On-demand thumbnail generation with sharp
      const generatedThumb = await assetsUseCase.getAssetBinary('test_thumb.png', 'thumbnail');
      expect(generatedThumb).not.toBeNull();
      expect(generatedThumb?.contentType).toBe('image/webp');

      // 2. Sharp failure fallback to original
      const invalidBuffer = Buffer.from('invalid-non-image-data');
      (assetsUseCase as any).storage.bucket().file().download = jest.fn().mockResolvedValue([invalidBuffer]);
      (assetsUseCase as any).thumbnailMemoryCache = new (assetsUseCase as any).thumbnailMemoryCache.constructor(2);

      const fallbackThumb = await assetsUseCase.getAssetBinary('corrupt.png', 'thumbnail');
      expect(fallbackThumb?.buffer).toEqual(invalidBuffer);

      // 3. LRU Cache eviction testing (capacity = 2)
      const cache = (assetsUseCase as any).thumbnailMemoryCache;
      cache.set('key1', { buffer: Buffer.from('1'), contentType: 'image/png' });
      cache.set('key2', { buffer: Buffer.from('2'), contentType: 'image/png' });
      cache.set('key3', { buffer: Buffer.from('3'), contentType: 'image/png' }); // evicts key1
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
      expect(cache.get('key3')).toBeDefined();

      // Refresh key2 and insert key4 -> should evict key3
      cache.get('key2');
      cache.set('key4', { buffer: Buffer.from('4'), contentType: 'image/png' });
      expect(cache.get('key3')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
    });

    it('TimelineRepository edge cases for periods, metrics count, and post deletion', async () => {
      const timelineRepo = new TimelineRepository(mock.firestore as any);

      // 1. getMetrics for monthly and yearly
      (timelineRepo as any).collections.processedFollowers.count = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({ count: 500 })
        })
      });

      const monthlyMetrics = await timelineRepo.getMetrics('monthly');
      expect(monthlyMetrics.followers).toBe(500);
      expect(monthlyMetrics.followersHistory).toEqual([]);

      const yearlyMetrics = await timelineRepo.getMetrics('yearly');
      expect(yearlyMetrics.followers).toBe(500);
      expect(yearlyMetrics.followersHistory).toEqual([]);

      // 2. getPosts with sorting by time, created_at, impressions, and status
      const mockTimelineDocs = [
        {
          id: 'p_1',
          data: () => ({
            created_at: '2026-08-01T00:00:00Z',
            content: 'First post',
            impressions: 100,
            status: 'SUCCESS',
            media_urls: ['gs://rebecca-ai-gal-images/images/p1.jpg']
          })
        },
        {
          id: 'p_2',
          data: () => ({
            timestamp: '2026-08-02T00:00:00Z',
            text: 'Second post',
            impressions: 500,
            status: 'FAILED',
            media_urls: ['https://cdn.example.com/external.png']
          })
        }
      ];

      (timelineRepo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: mockTimelineDocs
            })
          }),
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: mockTimelineDocs
          })
        }),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: mockTimelineDocs
        })
      };

      const postsByTime = await timelineRepo.getPosts({ sortBy: 'created_at', sortOrder: 'asc', period: 'monthly', date: '2026-08' });
      expect(postsByTime.data[0]?.id).toBe('p_1');
      expect(postsByTime.data[0]?.mediaUrls?.[0]).toContain('?size=thumbnail');
      expect(postsByTime.data[1]?.mediaUrls?.[0]).toBe('https://cdn.example.com/external.png');

      const postsByImpDesc = await timelineRepo.getPosts({ sortBy: 'impressions', sortOrder: 'desc', period: 'yearly', date: '2026' });
      expect(postsByImpDesc.data[0]?.id).toBe('p_2');

      // 3. deletePosts with X API deletion branch
      const mockBatchDelete = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
      (timelineRepo as any).firestore.batch = jest.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit
      });
      (timelineRepo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({ id: 'p_1' });

      await timelineRepo.deletePosts(['p_1']);
      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('UsersRepository search query, pagination, and status branches', async () => {
      const usersRepo = new UsersRepository(mock.firestore as any);

      const mockUsers = [
        { id: '101', data: () => ({ name: 'Alice Walker', username: 'alice_w', status: 'ACTIVE', _dynamicInteractions: 20 }) },
        { id: '102', data: () => ({ name: 'Bob Smith', username: 'bob_s', status: 'MUTED', _dynamicInteractions: 10 }) },
        { id: '103', data: () => ({ name: 'Charlie', username: 'charlie_x', status: 'BLOCKED', _dynamicInteractions: 5 }) }
      ];

      (usersRepo as any).collections.users.get = jest.fn().mockResolvedValue({
        empty: false,
        docs: mockUsers
      });

      // Search by query matching username
      const searchRes = await usersRepo.getAll({ search: 'alice' });
      expect(searchRes.data).toHaveLength(1);
      expect(searchRes.data[0]?.id).toBe('101');

      // Search by query matching ID
      (usersRepo as any).collections.users.get = jest.fn().mockResolvedValue({
        empty: false,
        docs: mockUsers
      });
      const searchIdRes = await usersRepo.getAll({ search: '102' });
      expect(searchIdRes.data).toHaveLength(1);
      expect(searchIdRes.data[0]?.id).toBe('102');

      // Sort by id asc/desc
      (usersRepo as any).collections.users.get = jest.fn().mockResolvedValue({
        empty: false,
        docs: mockUsers
      });
      const sortIdRes = await usersRepo.getAll({ sortBy: 'id', sortOrder: 'desc' });
      expect(sortIdRes.data[0]?.id).toBe('103');

      // Update status with updateStatusBulk
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({ id: '101' });
      const mockBatchSet = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
      (usersRepo as any).firestore.batch = jest.fn().mockReturnValue({
        set: mockBatchSet,
        commit: mockBatchCommit
      });

      await usersRepo.updateStatusBulk(['101', '102'], 'ACTIVE' as any);
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('CopilotUseCase autonomous fallback, safety execution, and bilingual action localization', async () => {
      const usersRepo = {
        getAll: jest.fn().mockResolvedValue({ data: [{ id: '123', name: 'User 123', username: 'u123', interactions: 5, status: 'ACTIVE' }] }),
        getById: jest.fn().mockResolvedValue(null),
        updateStatus: jest.fn().mockResolvedValue(undefined)
      } as any;
      const timelineRepo = {
        getPosts: jest.fn().mockResolvedValue({ data: [{ id: 'post_abc', impressions: 42, snippet: 'Hello' }] }),
        getMetrics: jest.fn().mockResolvedValue({ followers: 100 }),
        deletePosts: jest.fn().mockResolvedValue(undefined)
      } as any;
      const assetsRepo = {
        getAll: jest.fn().mockResolvedValue([{ id: 'a1', status: 'FAILED' }])
      } as any;
      const memoryRepo = {
        getMemoryLayers: jest.fn().mockResolvedValue([]),
        triggerDreaming: jest.fn().mockResolvedValue(undefined)
      } as any;

      const copilot = new CopilotUseCase(usersRepo, timelineRepo, assetsRepo, memoryRepo);

      // 1. ProcessChat with block intent in EN and JA
      const resEnBlock = await copilot.processChat({
        message: 'Block user @spammer_123',
        history: [],
        currentContext: 'User Profile',
        language: 'en'
      });
      expect(resEnBlock.actionRequired?.type).toBe('BLOCK_USER');
      expect(resEnBlock.actionRequired?.title).toContain('Block User @spammer_123');

      const resJaBlock = await copilot.processChat({
        message: 'ユーザー @bad_actor をブロックして',
        history: [],
        currentContext: 'User Relations',
        language: 'ja'
      });
      expect(resJaBlock.actionRequired?.type).toBe('BLOCK_USER');
      expect(resJaBlock.actionRequired?.title).toContain('ブロック');

      // 2. ProcessChat with delete post intent in EN
      const resEnDelete = await copilot.processChat({
        message: 'Please delete post #post_abc',
        history: [],
        currentContext: 'Timeline Post History',
        language: 'en'
      });
      expect(resEnDelete.actionRequired?.type).toBe('DELETE_POST');
      expect(resEnDelete.actionRequired?.title).toContain('Post Deletion');

      // 3. ProcessChat with dreaming intent in JA
      const resJaDream = await copilot.processChat({
        message: '長期記憶のドリーミングを実行して',
        history: [],
        currentContext: 'Memory Management',
        language: 'ja'
      });
      expect(resJaDream.actionRequired?.type).toBe('FORCE_DREAMING');
      expect(resJaDream.actionRequired?.title).toContain('ドリーミング');

      // 4. ProcessChat with Assets context telemetry gathering
      const resAssets = await copilot.processChat({
        message: 'Check failed asset captions',
        history: [],
        currentContext: 'Assets Library',
        language: 'en'
      });
      expect(resAssets.reply).toBeDefined();
    });

    it('AssetsController.getImage branches with sizes, 404, and error handling', async () => {
      const { AssetsController } = require('../../src/features/assets/controller');
      const mockUseCase = {
        getAssetBinary: jest.fn()
          .mockResolvedValueOnce({ buffer: Buffer.from('thumb-webp'), contentType: 'image/webp' })
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(new Error('Storage access failed'))
      };

      const controller = new AssetsController(mockUseCase as any);

      // Branch 1: size=thumbnail / thumb success
      const req1 = { params: { id: 'img_1.png' }, query: { size: 'thumb' } } as any;
      const res1 = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;
      await controller.getImage(req1, res1);
      expect(res1.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(res1.send).toHaveBeenCalledWith(Buffer.from('thumb-webp'));

      // Branch 2: Binary null -> 404
      const req2 = { params: { id: 'missing.png' }, query: {} } as any;
      const res2 = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;
      await controller.getImage(req2, res2);
      expect(res2.status).toHaveBeenCalledWith(404);

      // Branch 3: Error thrown -> 500
      const req3 = { params: { id: 'corrupt.png' }, query: {} } as any;
      const res3 = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any;
      await controller.getImage(req3, res3);
      expect(res3.status).toHaveBeenCalledWith(500);
    });

    it('TimelineRepository.getMetrics with calculated API call counts from collections', async () => {
      const timelineRepo = new TimelineRepository(mock.firestore as any);

      (timelineRepo as any).collections.processedFollowers = {
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            data: () => ({ count: 120 })
          })
        }),
        where: jest.fn().mockReturnValue({
          count: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: () => ({ count: 100 }) })
          }),
          get: jest.fn().mockResolvedValue({
            docs: [{ data: () => ({ timestamp: new Date().toISOString() }) }]
          })
        })
      };

      // Mock conversationLogs and timelineHistory queries
      (timelineRepo as any).collections.conversationLogs = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            docs: new Array(150).fill({ data: () => ({ userId: 'u', timestamp: new Date().toISOString() }) }),
            size: 150
          }),
          where: jest.fn().mockReturnValue({
            count: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ data: () => ({ count: 100 }) })
            }),
            get: jest.fn().mockResolvedValue({
              docs: new Array(100).fill({ data: () => ({ userId: 'u_prev' }) }),
              size: 100
            })
          }),
          count: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: () => ({ count: 100 }) })
          })
        })
      };
      (timelineRepo as any).collections.timelineHistory = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            docs: new Array(50).fill({ data: () => ({ impressions: 500, likes: 10, retweets: 5, replies: 2, timestamp: new Date().toISOString() }) }),
            size: 50
          }),
          where: jest.fn().mockReturnValue({
            count: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ data: () => ({ count: 30 }) })
            }),
            get: jest.fn().mockResolvedValue({
              docs: new Array(30).fill({ data: () => ({ impressions: 300, likes: 5, retweets: 2, replies: 1 }) }),
              size: 30
            })
          }),
          count: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: () => ({ count: 30 }) })
          })
        })
      };

      const metricsWeekly = await timelineRepo.getMetrics('weekly');
      expect(metricsWeekly.apiCalls).toBe(200); // 150 + 50
      expect(metricsWeekly.followers).toBe(120);
      expect(metricsWeekly.engagementRate).toBeDefined();
    });

    it('UsersRepository.getById with beforeTimestamp and limit options', async () => {
      const usersRepo = new UsersRepository(mock.firestore as any);

      const mockUserDoc = {
        exists: true,
        id: 'u_detail',
        data: () => ({
          name: 'Detailed User',
          username: 'detail_u',
          status: 'ACTIVE',
          first_seen: '2026-08-01T00:00:00Z',
          last_seen: '2026-08-20T00:00:00Z',
          coreProfile: {
            personality: 'Analytical'
          }
        })
      };

      const mockLogs = [
        {
          id: 'log_1',
          data: () => ({
            timestamp: '2026-08-10T12:00:00Z',
            userText: 'Hello Rebecca',
            aiText: 'Hi there!'
          })
        }
      ];

      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserDoc)
      });
      (usersRepo as any).collections.conversationLogs = {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: mockLogs
          })
        })
      };

      // 1. Existing user with beforeTimestamp and limit
      const userDetail = await usersRepo.getById('u_detail', '2026-08-15T00:00:00Z', 5);
      expect(userDetail).not.toBeNull();
      expect(userDetail?.username).toBe('detail_u');
      expect(userDetail?.chatHistory).toHaveLength(2);

      // 2. User lookup fallback by username
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: false })
      });
      (usersRepo as any).collections.users.where = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [mockUserDoc]
          })
        })
      });
      const userByHandle = await usersRepo.getById('@detail_u');
      expect(userByHandle?.id).toBe('u_detail');

      // 3. User does not exist anywhere -> returns null
      (usersRepo as any).collections.users.where = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: []
          })
        })
      });
      const userNull = await usersRepo.getById('non_existent');
      expect(userNull).toBeNull();

      // 4. User with episodicBuffer fallback
      const mockUserWithEpisodic = {
        exists: true,
        id: 'u_episodic',
        data: () => ({
          name: 'Episodic User',
          username: 'episodic_u',
          episodicBuffer: [
            { role: 'user', content: 'Remember this' },
            { role: 'assistant', content: 'I remember!' }
          ]
        })
      };
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserWithEpisodic)
      });
      (usersRepo as any).collections.conversationLogs.where = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
      });

      const userEpisodic = await usersRepo.getById('u_episodic');
      expect(userEpisodic?.chatHistory).toHaveLength(2);

      // 5. updateMemory with valid object and invalid JSON string
      const mockSet = jest.fn().mockResolvedValue(undefined);
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({ set: mockSet });

      await usersRepo.updateMemory('u_test', { key: 'val' });
      expect(mockSet).toHaveBeenCalledWith({ coreProfile: { key: 'val' } }, { merge: true });

      await usersRepo.updateMemory('u_test', 'invalid json string');
      // Should gracefully catch and return without throwing
    });

    it('AssetsUseCase thumbnail cache hits (memory & GCS) and null binary branches', async () => {
      const { AssetsUseCase } = require('../../src/features/assets/usecase');
      const assetsRepo = {
        getRawDoc: jest.fn().mockResolvedValue({ url: 'gs://rebecca-ai-gal-images/images/cached_thumb.png' })
      } as any;

      const assetsUseCase = new AssetsUseCase(assetsRepo);

      // 1. Memory cache hit
      (assetsUseCase as any).thumbnailMemoryCache.set('cached_thumb.png', {
        buffer: Buffer.from('mem-cached'),
        contentType: 'image/webp'
      });
      const memHit = await assetsUseCase.getAssetBinary('cached_thumb.png', 'thumbnail');
      expect(memHit?.buffer).toEqual(Buffer.from('mem-cached'));

      // 2. GCS thumbnail cache hit
      const mockGcsFile = {
        exists: jest.fn().mockResolvedValue([true]),
        download: jest.fn().mockResolvedValue([Buffer.from('gcs-cached-thumb')])
      };
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue(mockGcsFile)
        })
      };
      const gcsHit = await assetsUseCase.getAssetBinary('gcs_thumb.png', 'thumbnail');
      expect(gcsHit?.buffer).toEqual(Buffer.from('gcs-cached-thumb'));

      // 3. Null binary when asset is not found
      assetsRepo.getRawDoc = jest.fn().mockResolvedValue(null);
      (assetsUseCase as any).storage.bucket().file().exists = jest.fn().mockResolvedValue([false]);
      (assetsUseCase as any).storage.bucket().getFiles = jest.fn().mockResolvedValue([[]]);
      const notFound = await assetsUseCase.getAssetBinary('missing_all.png', 'full');
      expect(notFound).toBeNull();
    });

    it('TimelineRepository deletePosts with tweetId deletion', async () => {
      const timelineRepo = new TimelineRepository(mock.firestore as any);

      (timelineRepo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ tweetId: 'tweet_999' })
        })
      });

      const mockBatchDelete = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
      (timelineRepo as any).firestore.batch = jest.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit
      });

      await timelineRepo.deletePosts(['p_tweet']);
      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('SystemMemoryRepository triggerDreaming full branch coverage', async () => {
      const memoryRepo = new SystemMemoryRepository(mock.firestore as any);

      // 1. Missing botBackendUrl
      (config.services as any).botBackendUrl = '';
      await memoryRepo.triggerDreaming();

      // 2. Emulator environment
      (config.services as any).botBackendUrl = 'https://bot-service-url';
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      await memoryRepo.triggerDreaming();
      delete process.env.FIRESTORE_EMULATOR_HOST;

      // 3. Successful OIDC request
      const mockRequest = jest.fn().mockResolvedValue({ status: 200 });
      jest.mock('google-auth-library', () => ({
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getIdTokenClient: jest.fn().mockResolvedValue({ request: mockRequest })
        }))
      }), { virtual: true });
      await memoryRepo.triggerDreaming();

      // 4. Error during trigger
      (config.services as any).botBackendUrl = 'https://bot-error-url';
      await memoryRepo.triggerDreaming();
    });

    it('TimelineUseCase deletePosts edge cases', async () => {
      const timelineRepo = new TimelineRepository(mock.firestore as any);
      timelineRepo.deletePosts = jest.fn().mockResolvedValue(undefined);
      const timelineUseCase = new TimelineUseCase(timelineRepo);

      // Test with empty id and id containing newlines
      await timelineUseCase.deletePosts(['id1\n\r', '']);
      expect(timelineRepo.deletePosts).toHaveBeenCalledWith(['id1\n\r', '']);
    });

    it('initializeCopilotModule without firestore', async () => {
      const { initializeCopilotModule } = await import('../../src/features/copilot');
      const router = initializeCopilotModule(undefined);
      expect(router).toBeDefined();
      expect(router.stack).toBeDefined();
    });

    it('AssetsUseCase getAssetBinary prefix search metadata branches', async () => {
      const assetsRepo = new AssetsRepository(mock.firestore as any);
      const assetsUseCase = new (await import('../../src/features/assets/usecase')).AssetsUseCase(assetsRepo);

      assetsRepo.getRawDoc = jest.fn().mockResolvedValue({
        id: 'prefix_test_asset',
        url: 'https://storage.googleapis.com/bucket/prefix_test_asset.png',
        status: AssetStatus.SUCCESS,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const mockFileWithMetadata = {
        name: 'media_assets/prefix_test_asset.png',
        download: jest.fn().mockResolvedValue([Buffer.from('binary-content')]),
        getMetadata: jest.fn().mockResolvedValue([{ contentType: 'image/png' }])
      };

      const mockFileWithFailingMetadata = {
        name: 'images/prefix_test_asset.jpg',
        download: jest.fn().mockResolvedValue([Buffer.from('binary-content-jpg')]),
        getMetadata: jest.fn().mockRejectedValue(new Error('metadata error'))
      };

      // 1. Success with metadata
      (assetsUseCase as any).storage = {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({ exists: jest.fn().mockResolvedValue([false]) }),
          getFiles: jest.fn().mockResolvedValue([[mockFileWithMetadata]])
        })
      };
      const result1 = await assetsUseCase.getAssetBinary('prefix_test_asset', 'full');
      expect(result1?.contentType).toBe('image/png');

      // 2. Metadata error fallback
      (assetsUseCase as any).storage.bucket = jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({ exists: jest.fn().mockResolvedValue([false]) }),
        getFiles: jest.fn().mockResolvedValue([[mockFileWithFailingMetadata]])
      });
      const result2 = await assetsUseCase.getAssetBinary('prefix_test_asset', 'full');
      expect(result2?.contentType).toBe('image/jpeg');
    });

    it('CopilotUseCase detectExplicitUserAction and localizeActionCard branches in JA and EN', async () => {
      const copilotUseCase = new (await import('../../src/features/copilot/usecase')).CopilotUseCase();

      // detectExplicitUserAction: block in EN (no @handle → default)
      const blockNoHandle = (copilotUseCase as any).detectExplicitUserAction('please block this user', true);
      expect(blockNoHandle?.type).toBe('BLOCK_USER');
      expect(blockNoHandle?.title).toContain('Block User');

      // detectExplicitUserAction: block with @handle in JA
      const blockWithHandle = (copilotUseCase as any).detectExplicitUserAction('ユーザー @spammer をブロックして', false);
      expect(blockWithHandle?.type).toBe('BLOCK_USER');
      expect(blockWithHandle?.title).toContain('spammer');

      // detectExplicitUserAction: delete in JA (消して)
      const deleteJa = (copilotUseCase as any).detectExplicitUserAction('この投稿を消して', false);
      expect(deleteJa?.type).toBe('DELETE_POST');
      expect(deleteJa?.title).toBe('投稿の削除確認');

      // detectExplicitUserAction: dreaming in JA (記憶)
      const dreamJa = (copilotUseCase as any).detectExplicitUserAction('記憶を整理して', false);
      expect(dreamJa?.type).toBe('FORCE_DREAMING');
      expect(dreamJa?.title).toBe('長期記憶の統合（ドリーミング）実行');

      // detectExplicitUserAction: no match returns null
      const noMatch = (copilotUseCase as any).detectExplicitUserAction('こんにちは', false);
      expect(noMatch).toBeNull();

      // localizeActionCard: FORCE_DREAMING in EN
      const dreamCard = (copilotUseCase as any).localizeActionCard({
        type: 'FORCE_DREAMING', title: 'Dream', description: 'run', impactLevel: 'warning',
        requiresConfirmation: true, payload: {}
      }, true);
      expect(dreamCard.title).toBe('Trigger Memory Consolidation (Dreaming)');

      // localizeActionCard: BLOCK_USER EN but title has Japanese (containsJa=true, isEn=true → localize)
      const blockCardLocalized = (copilotUseCase as any).localizeActionCard({
        type: 'BLOCK_USER', title: 'ユーザーのブロック', description: '...', impactLevel: 'danger',
        requiresConfirmation: true, payload: { handle: '@spammer' }
      }, true);
      expect(blockCardLocalized.title).toBe('Block User @spammer');

      // localizeActionCard: BLOCK_USER JA but title is English (containsJa=false, isEn=false → localize to JA)
      const blockCardJa = (copilotUseCase as any).localizeActionCard({
        type: 'BLOCK_USER', title: 'Block User', description: '...', impactLevel: 'danger',
        requiresConfirmation: true, payload: { userId: 'spammer' }
      }, false);
      expect(blockCardJa.title).toBe('ユーザー @spammer のブロック');

      // localizeActionCard: DELETE_POST EN title has JA → localize to EN
      const deleteCardEn = (copilotUseCase as any).localizeActionCard({
        type: 'DELETE_POST', title: '投稿の削除確認', description: '...', impactLevel: 'danger',
        requiresConfirmation: true, payload: { postId: 'abc123' }
      }, true);
      expect(deleteCardEn.title).toBe('Confirm Deletion of Post #abc123');

      // localizeActionCard: DELETE_POST JA title is English → localize to JA
      const deleteCardJa = (copilotUseCase as any).localizeActionCard({
        type: 'DELETE_POST', title: 'Confirm Post Deletion', description: '...', impactLevel: 'danger',
        requiresConfirmation: true, payload: { id: 'post99' }
      }, false);
      expect(deleteCardJa.title).toBe('投稿 #post99 の削除確認');

      // localizeActionCard: impactLevel branch - no impactLevel provided (type includes BLOCK → danger)
      const cardNullImpact = (copilotUseCase as any).localizeActionCard({
        type: 'BLOCK_USER', title: 'Block someone', description: 'desc', impactLevel: null,
        requiresConfirmation: true, payload: {}
      }, true);
      expect(cardNullImpact.impactLevel).toBe('danger');

      // localizeActionCard: impactLevel = 'info'
      const cardInfoImpact = (copilotUseCase as any).localizeActionCard({
        type: 'NAVIGATE_PAGE', title: 'Go to page', description: 'navigate', impactLevel: 'info',
        requiresConfirmation: false, payload: {}
      }, true);
      expect(cardInfoImpact.impactLevel).toBe('info');
    });

    it('CopilotUseCase generateAutonomousFallbackResponse covers all branches', async () => {
      const copilotUseCase = new (await import('../../src/features/copilot/usecase')).CopilotUseCase();

      // caption/asset fallback in EN
      const captionEn = (copilotUseCase as any).generateAutonomousFallbackResponse('check caption status', 'Assets', '', true);
      expect(captionEn.actionRequired?.type).toBe('REGENERATE_CAPTIONS');
      expect(captionEn.reply).toContain('Master');

      // caption/asset fallback in JA
      const captionJa = (copilotUseCase as any).generateAutonomousFallbackResponse('アセットの状況を確認', 'Assets', '', false);
      expect(captionJa.actionRequired?.type).toBe('REGENERATE_CAPTIONS');

      // KPI/metric fallback in EN
      const kpiEn = (copilotUseCase as any).generateAutonomousFallbackResponse('show me kpi metrics', 'Dashboard', '', true);
      expect(kpiEn.actionRequired).toBeNull();
      expect(kpiEn.suggestionChips).toContain('Engagement breakdown');

      // KPI/metric fallback in JA
      const kpiJa = (copilotUseCase as any).generateAutonomousFallbackResponse('フォロワーの推移を見せて', 'Dashboard', '', false);
      expect(kpiJa.actionRequired).toBeNull();

      // Default greeting fallback in EN
      const defaultEn = (copilotUseCase as any).generateAutonomousFallbackResponse('hello', 'Dashboard', '', true);
      expect(defaultEn.reply).toContain('Master');
      expect(defaultEn.actionRequired).toBeNull();

      // Default greeting fallback in JA
      const defaultJa = (copilotUseCase as any).generateAutonomousFallbackResponse('こんにちは', 'Dashboard', '', false);
      expect(defaultJa.reply).toContain('マスター');
    });
  });
});

