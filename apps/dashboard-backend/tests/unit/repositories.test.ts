import { UsersRepository } from '../../src/features/users/repository';
import { AssetsRepository } from '../../src/features/assets/repository';
import { TimelineRepository } from '../../src/features/timeline/repository';
import { SystemMemoryRepository } from '../../src/features/system-memory/repository';
import { UserStatus, AssetStatus } from '@rebecca/types';
import { createMockFirestore } from './testUtils';

// Mock storage getSignedUrl for TimelineRepository
const mockGetSignedUrl = jest.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url']);
jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          getSignedUrl: mockGetSignedUrl
        })
      })
    }))
  };
});

// Mock Cloud Tasks for SystemMemoryRepository
const mockCreateTask = jest.fn().mockResolvedValue([{}]);
const mockQueuePath = jest.fn().mockReturnValue('projects/p/locations/l/queues/q');
jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => ({
      queuePath: mockQueuePath,
      createTask: mockCreateTask
    }))
  };
});

describe('Dashboard Backend Repositories Unit Tests', () => {
  let mock: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockFirestore();
  });

  describe('UsersRepository', () => {
    let usersRepo: UsersRepository;

    beforeEach(() => {
      usersRepo = new UsersRepository(mock.firestore);
    });

    it('getAll should return mapped users with pagination and search', async () => {
      const mockDocs = [
        {
          id: 'user_alice',
          data: () => ({
            name: 'Alice',
            handle: '@alice_gyaru',
            interactions: 50,
            status: 'ACTIVE',
            affinity_score: 90,
            first_seen: '2026-08-01',
            last_seen: '2026-08-18',
            coreProfile: JSON.stringify({ bio: 'Gal enthusiast' })
          })
        },
        {
          id: 'user_bob',
          data: () => ({
            name: 'Bob',
            handle: '@bob_dev',
            interactions: 10,
            status: 'BLOCKED',
            affinity_score: 20
          })
        }
      ];

      (usersRepo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      // Filter by search query "alice"
      const res = await usersRepo.getAll({ page: 1, limit: 10, search: 'alice', sortBy: 'interactions', sortOrder: 'desc' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Alice');
      expect(res.data[0].handle).toBe('@user_alice');
      expect(res.meta.totalItems).toBe(1);
    });

    it('getAll should support monthly/yearly date range queries on conversation logs', async () => {
      const mockDocs = [
        {
          id: 'user_1',
          data: () => ({ name: 'User 1', handle: '@user1' })
        }
      ];
      (usersRepo as any).collections.users.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const mockLogsDocs = [
        { data: () => ({ userId: 'user_1', timestamp: '2026-08-10T00:00:00.000Z' }) },
        { data: () => ({ userId: 'user_1', timestamp: '2026-08-11T00:00:00.000Z' }) }
      ];

      const mockWhere = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ docs: mockLogsDocs })
        })
      });
      (usersRepo as any).collections.conversationLogs.where = mockWhere;

      const res = await usersRepo.getAll({ period: 'monthly', date: '2026-08' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].interactions).toBe(2);
    });

    it('getById should return user details with chat history or null', async () => {
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'u1',
          data: () => ({
            name: 'Alice',
            handle: '@alice',
            interactions: 5,
            status: 'ACTIVE',
            coreProfile: { attributes: ['fun'] }
          })
        })
      });

      const mockLogDoc = {
        id: 'log1',
        data: () => ({
          userId: 'u1',
          timestamp: '2026-08-18T10:00:00Z',
          userText: 'Hello!',
          aiText: 'Hey babe!♡'
        })
      };

      (usersRepo as any).collections.conversationLogs.where = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({ docs: [mockLogDoc] })
      });

      const user = await usersRepo.getById('u1');
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Alice');
      expect(user?.chatHistory).toHaveLength(2); // user message + model message
      expect(user?.chatHistory[0].text).toBe('Hello!');
    });

    it('updateMemory and updateStatusBulk should execute write operations', async () => {
      const mockSet = jest.fn().mockResolvedValueOnce(undefined);
      (usersRepo as any).collections.users.doc = jest.fn().mockReturnValue({ set: mockSet });

      await usersRepo.updateMemory('u1', '{"bio":"new bio"}');
      expect(mockSet).toHaveBeenCalledWith({ coreProfile: { bio: 'new bio' } }, { merge: true });

      const mockBatchSet = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValueOnce(undefined);
      (usersRepo as any).firestore.batch = jest.fn().mockReturnValue({
        set: mockBatchSet,
        commit: mockBatchCommit
      });

      await usersRepo.updateStatusBulk(['u1', 'u2'], UserStatus.BLOCKED);
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('AssetsRepository', () => {
    let assetsRepo: AssetsRepository;

    beforeEach(() => {
      assetsRepo = new AssetsRepository(mock.firestore);
    });

    it('getPaginated should map raw docs, sort, filter by search and status', async () => {
      const mockDocs = [
        {
          id: 'img_01',
          data: () => ({
            filename: 'gal_beach.png',
            caption: 'Beach selfie',
            status: 'SUCCESS',
            useCount: 3,
            url: 'https://storage/gal_beach.png'
          })
        },
        {
          id: 'img_02',
          data: () => ({
            caption: '',
            status: 'FAILED',
            url: 'https://picsum.photos/200/300'
          })
        }
      ];

      (assetsRepo as any).collections.images.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const res = await assetsRepo.getPaginated({ search: 'beach', status: 'SUCCESS' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].filename).toBe('gal_beach.png');
      expect(res.data[0].status).toBe(AssetStatus.SUCCESS);
    });

    it('getAll and getById should retrieve assets', async () => {
      (assetsRepo as any).collections.images.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'img_01',
            data: () => ({ filename: 'img1.png', caption: 'test' })
          }
        ]
      });

      const all = await assetsRepo.getAll();
      expect(all).toHaveLength(1);

      (assetsRepo as any).collections.images.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: 'img_01',
          data: () => ({ filename: 'img1.png', caption: 'test' })
        })
      });

      const single = await assetsRepo.getById('img_01');
      expect(single?.filename).toBe('img1.png');
    });

    it('create, update, and deleteMany should execute firestore mutations', async () => {
      const mockSet = jest.fn().mockResolvedValueOnce(undefined);
      (assetsRepo as any).collections.images.doc = jest.fn().mockReturnValue({ set: mockSet });

      await assetsRepo.create('img_new', { filename: 'new.png' });
      expect(mockSet).toHaveBeenCalledWith({ filename: 'new.png' });

      await assetsRepo.update('img_new', { caption: 'updated' });
      expect(mockSet).toHaveBeenCalled();

      const mockBatchDelete = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValueOnce(undefined);
      (assetsRepo as any).firestore.batch = jest.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit
      });

      await assetsRepo.deleteMany(['img_1', 'img_2']);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('TimelineRepository', () => {
    let timelineRepo: TimelineRepository;

    beforeEach(() => {
      timelineRepo = new TimelineRepository(mock.firestore);
    });

    it('getMetrics should scale data based on weekly, monthly, and yearly periods', async () => {
      (timelineRepo as any).collections.systemStats.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          data: () => ({
            total_followers: 200,
            followers_trend: 10,
            avg_engagement_rate: 4.5,
            engagement_trend: 0.5,
            dau: 80,
            dau_trend: 5,
            api_calls_today: 1200,
            api_trend_status: 'stable',
            followers_history: [100, 150, 200],
            engagement_history: [3.0, 4.0, 4.5],
            dau_history: [50, 60, 80],
            api_calls_history: [1000, 1100, 1200]
          })
        })
      });

      const metrics = await timelineRepo.getMetrics('weekly');
      expect(metrics.followers).toBe(50); // 200 * 0.25
      expect(metrics.followersHistory).toHaveLength(7);
    });

    it('getPosts should query and map timeline posts with pagination and period filter', async () => {
      const mockDocs = [
        {
          id: 'post_1',
          data: () => ({
            content: 'Hello Twitter!',
            created_at: '2026-08-18T12:00:00Z',
            impressions: 300,
            media_urls: ['https://img.png']
          })
        }
      ];

      (timelineRepo as any).collections.timelineHistory = {
        get: jest.fn().mockResolvedValueOnce({
          empty: false,
          docs: mockDocs
        })
      };

      const res = await timelineRepo.getPosts({ page: 1, limit: 10, sortBy: 'impressions', sortOrder: 'desc' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('post_1');
      expect(res.data[0].impressions).toBe(300);
    });

    it('getPostById should resolve signed URLs for gs:// images', async () => {
      (timelineRepo as any).collections.timelineHistory = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            exists: true,
            id: 'post_1',
            data: () => ({
              content: 'Image tweet',
              created_at: '2026-08-18T12:00:00Z',
              impressions: 150,
              media_urls: ['gs://rebecca-ai-gal-images/media_assets/photo.jpg']
            })
          })
        })
      };

      const post = await timelineRepo.getPostById('post_1');
      expect(post).not.toBeNull();
      expect(post?.mediaUrls[0]).toContain('https://storage.googleapis.com/signed-url');
    });

    it('deletePosts should perform batch soft deletion', async () => {
      const mockBatchDelete = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValueOnce(undefined);
      (timelineRepo as any).firestore.batch = jest.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit
      });

      (timelineRepo as any).collections.timelineHistory.doc = jest.fn().mockReturnValue({ id: 'p1' });

      await timelineRepo.deletePosts(['p1', 'p2']);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('getAlerts should aggregate warnings from failed assets and rate limits', async () => {
      // Mock failed assets
      (timelineRepo as any).collections.images.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'img_f1', data: () => ({ status: 'FAILED' }) },
          { id: 'img_f2', data: () => ({ status: 'FAILED' }) }
        ]
      });

      // Mock failed posts
      (timelineRepo as any).collections.timelineHistory.get = jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'post_f1', data: () => ({ status: 'FAILED' }) }
        ]
      });

      const alerts = await timelineRepo.getAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some(a => a.id === 'failed_captions')).toBe(true);
      expect(alerts.some(a => a.id === 'failed_posts')).toBe(true);
    });
  });

  describe('SystemMemoryRepository', () => {
    let memoryRepo: SystemMemoryRepository;

    beforeEach(() => {
      memoryRepo = new SystemMemoryRepository(mock.firestore);
    });

    it('getLayers should return metadata for Layers 0, 1, and 2', async () => {
      (memoryRepo as any).collections.system.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          data: () => ({
            updatedAt: '2026-08-18',
            timelineSummaryUpdatedAt: '2026-08-18'
          })
        })
      });

      const layers = await memoryRepo.getLayers();
      expect(layers).toHaveLength(3);
      expect(layers[0].level).toBe(0);
      expect(layers[1].level).toBe(1);
      expect(layers[2].level).toBe(2);
    });

    it('getCoreMemory, getExtendedMemory, getGlobalMemory should read memory contents', async () => {
      const core = await memoryRepo.getCoreMemory();
      expect(core.level).toBe(0);
      expect(core.content).toContain('Rebecca');

      (memoryRepo as any).collections.system.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            extended_prompt: 'Custom extended persona instructions',
            timeline_summary: 'Timeline summarized context'
          })
        })
      });

      const ext = await memoryRepo.getExtendedMemory();
      expect(ext.content).toBe('Custom extended persona instructions');

      const global = await memoryRepo.getGlobalMemory();
      expect(global.content).toBe('Timeline summarized context');
    });

    it('updateExtendedMemory and updateGlobalMemory should save updates with timestamp', async () => {
      const mockSet = jest.fn().mockResolvedValueOnce(undefined);
      (memoryRepo as any).collections.system.doc = jest.fn().mockReturnValue({ set: mockSet });

      await memoryRepo.updateExtendedMemory('Updated prompt');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ extended_prompt: 'Updated prompt' }),
        { merge: true }
      );

      await memoryRepo.updateGlobalMemory('Updated summary');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ timeline_summary: 'Updated summary' }),
        { merge: true }
      );
    });

    it('triggerDreaming should invoke Cloud Tasks client and handle fallback', async () => {
      await memoryRepo.triggerDreaming();
      expect(mockCreateTask).toHaveBeenCalledTimes(1);

      mockCreateTask.mockRejectedValueOnce(new Error('Cloud Tasks error'));
      await memoryRepo.triggerDreaming();
    });
  });
});
