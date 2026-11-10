import { CopilotUseCase, extractStructuredCopilotResponse } from '../../src/features/copilot/usecase';
import { CopilotToolRegistry } from '../../src/features/copilot/toolRegistry';
import { SearchTimelinePostsTool } from '../../src/features/copilot/tools/postsTool';
import { SearchUsersTool } from '../../src/features/copilot/tools/usersTool';
import { SearchAssetsTool } from '../../src/features/copilot/tools/assetsTool';
import { GetKpiSummaryTool } from '../../src/features/copilot/tools/kpiTool';
import { SearchSupportersTool } from '../../src/features/copilot/tools/supportersTool';
import { GetFeatureGuideTool } from '../../src/features/copilot/tools/featureGuideTool';
import { ProposeDestructiveActionTool } from '../../src/features/copilot/tools/actionTool';
import { TimelineRepository } from '../../src/features/timeline/repository';
import { UsersRepository } from '../../src/features/users/repository';
import { AssetsRepository } from '../../src/features/assets/repository';
import { SystemMemoryRepository } from '../../src/features/system-memory/repository';
import { SupportersRepository } from '../../src/features/supporters/repository';
import { AssetStatus, UserStatus } from '@rebecca/types';

const mockGenerateContent = jest.fn();
const mockEmbedContent = jest.fn();

jest.mock('../../src/config', () => {
  const actual = jest.requireActual('../../src/config');
  return {
    ...actual,
    config: {
      ...actual.config,
      gemini: {
        ...actual.config.gemini,
        apiKey: 'test-gemini-api-key',
        embeddingModel: 'gemini-embedding-2'
      }
    }
  };
});

jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
        embedContent: mockEmbedContent
      }
    }))
  };
});

describe('Copilot Autonomous Agent Suite (Redesign v3)', () => {
  let timelineRepo: jest.Mocked<TimelineRepository>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let assetsRepo: jest.Mocked<AssetsRepository>;
  let memoryRepo: jest.Mocked<SystemMemoryRepository>;
  let supportersRepo: jest.Mocked<SupportersRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    timelineRepo = {
      getMetrics: jest.fn().mockResolvedValue({
        followers: 1250,
        followersTrend: 8.5,
        followersHistory: [1000, 1100, 1250],
        engagementRate: 5.2,
        engagementTrend: 0.8,
        engagementHistory: [4.8, 5.0, 5.2],
        dailyActiveUsers: 340,
        dauTrend: 4.2,
        dauHistory: [300, 320, 340],
        apiCalls: 8500,
        apiCallsTrend: 12.0,
        apiCallsHistory: [7000, 7800, 8500]
      }),
      getPosts: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'post_001',
            snippet: 'Rebecca is launching a new autonomous model! Check it out!♡',
            time: '2026-11-10T10:00:00.000Z',
            impressions: 45000,
            hasMedia: true,
            mediaUrls: ['https://example.com/art1.png']
          }
        ],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      })
    } as unknown as jest.Mocked<TimelineRepository>;

    usersRepo = {
      getAll: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'user_101',
            username: 'cyber_master',
            name: 'Cyber Master',
            interactions: 42,
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-11-10T09:00:00Z',
            coreProfile: '{}',
            chatHistory: [],
            status: UserStatus.ACTIVE
          }
        ],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      })
    } as unknown as jest.Mocked<UsersRepository>;

    assetsRepo = {
      findByVector: jest.fn().mockResolvedValue([
        {
          id: 'asset_vector_1',
          filename: 'neon_tokyo.png',
          caption: 'Futuristic cyberpunk neon street in Tokyo at midnight',
          useCount: 3,
          status: AssetStatus.SUCCESS,
          url: '/api/v1/assets/asset_vector_1/image',
          thumbnailUrl: '/api/v1/assets/asset_vector_1/image?size=thumbnail'
        }
      ]),
      getPaginated: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'asset_text_1',
            filename: 'cafe_rebecca.png',
            caption: 'Rebecca enjoying iced matcha latte at a stylish terrace',
            useCount: 1,
            status: AssetStatus.SUCCESS,
            url: '/api/v1/assets/asset_text_1/image',
            thumbnailUrl: '/api/v1/assets/asset_text_1/image?size=thumbnail'
          }
        ],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 }
      })
    } as unknown as jest.Mocked<AssetsRepository>;

    memoryRepo = {} as unknown as jest.Mocked<SystemMemoryRepository>;

    supportersRepo = {
      getTransactions: jest.fn().mockResolvedValue({
        summary: {
          totalCount: 15,
          failedCount: 0,
          pendingCount: 1,
          completedCount: 14,
          totalAmount: 45000
        },
        transactions: [
          {
            id: 'tx_01',
            stripeSessionId: 'sess_123',
            rawName: 'Master Akina',
            safeName: 'Master Akina',
            isNameSanitized: true,
            creditVisibility: 'PUBLIC',
            amount: 5000,
            currency: 'jpy',
            tier: 'GOLD',
            itemLabel: 'Special Support Tier',
            rewardImageId: 'rew_1',
            status: 'COMPLETED',
            isBanned: false,
            createdAt: '2026-11-09T12:00:00Z'
          }
        ]
      })
    } as unknown as jest.Mocked<SupportersRepository>;
  });

  describe('Individual Tool Verification', () => {
    it('SearchTimelinePostsTool should query posts and construct rich attachments', async () => {
      const tool = new SearchTimelinePostsTool();
      const res = await tool.execute({ limit: 3, sortBy: 'impressions' }, { timelineRepo, isEn: false });

      expect(timelineRepo.getPosts).toHaveBeenCalledWith(expect.objectContaining({ limit: 3, sortBy: 'impressions' }));
      expect(res.attachments).toBeDefined();
      expect(res.attachments?.[0].type).toBe('post');
      expect(res.attachments?.[0].metrics?.impressions).toBe(45000);
    });

    it('SearchUsersTool should query users and filter by status', async () => {
      const tool = new SearchUsersTool();
      const res = await tool.execute({ query: '@cyber', status: 'ACTIVE' }, { usersRepo, isEn: false });

      expect(usersRepo.getAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'cyber' }));
      expect(res.attachments?.[0].type).toBe('user');
      expect(res.attachments?.[0].title).toContain('Cyber Master');
    });

    it('SearchAssetsTool should use vector search when semanticQuery is given and api key is present', async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: new Array(768).fill(0.05) }]
      });

      const tool = new SearchAssetsTool();
      const res = await tool.execute(
        { semanticQuery: 'cyberpunk neon street' },
        { assetsRepo, isEn: false }
      );

      expect(mockEmbedContent).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gemini-embedding-2',
        contents: 'cyberpunk neon street'
      }));
      expect(assetsRepo.findByVector).toHaveBeenCalled();
      expect(res.attachments?.[0].type).toBe('image');
      expect(res.attachments?.[0].title).toBe('neon_tokyo.png');
    });

    it('SearchAssetsTool should fall back to keyword search when vector search returns empty', async () => {
      mockEmbedContent.mockRejectedValueOnce(new Error('Embedding API offline'));

      const tool = new SearchAssetsTool();
      const res = await tool.execute(
        { semanticQuery: 'cafe terrace' },
        { assetsRepo, isEn: false }
      );

      expect(assetsRepo.getPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: 'cafe terrace' }));
      expect(res.attachments?.[0].title).toBe('cafe_rebecca.png');
    });

    it('GetKpiSummaryTool should retrieve period metrics', async () => {
      const tool = new GetKpiSummaryTool();
      const res = await tool.execute({ period: 'weekly' }, { timelineRepo, isEn: false });

      expect(timelineRepo.getMetrics).toHaveBeenCalledWith('weekly');
      expect((res.data as any).followers).toBe(1250);
    });

    it('SearchSupportersTool should return ledger statistics and transactions', async () => {
      const tool = new SearchSupportersTool();
      const res = await tool.execute({ limit: 5 }, { supportersRepo, isEn: false });

      expect(supportersRepo.getTransactions).toHaveBeenCalledWith({ limit: 5 });
      expect((res.data as any).recentCount).toBe(1);
    });

    it('GetFeatureGuideTool should return official system guidance', async () => {
      const tool = new GetFeatureGuideTool();
      const resJa = await tool.execute({ topic: 'dreaming' }, { isEn: false });
      expect((resJa.data as any).documentation).toContain('長期記憶の統合');

      const resEn = await tool.execute({ topic: 'assets' }, { isEn: true });
      expect((resEn.data as any).documentation).toContain('Asset Catalog');
    });

    it('ProposeDestructiveActionTool should cover all action types and localization branches', async () => {
      const tool = new ProposeDestructiveActionTool();

      // Invalid action
      const invalidRes = await tool.execute({ actionType: 'INVALID_ACTION' }, { isEn: false });
      expect((invalidRes.data as any).error).toContain('Invalid action type');

      // BLOCK_USER (en, with and without target)
      const blockEn = await tool.execute({ actionType: 'BLOCK_USER', targetId: 'spammer' }, { isEn: true });
      expect(blockEn.actionRequired?.title).toBe('Block User spammer');
      expect(blockEn.actionRequired?.payload?.handle).toBe('@spammer');

      const blockEnNoTarget = await tool.execute({ actionType: 'BLOCK_USER' }, { isEn: true });
      expect(blockEnNoTarget.actionRequired?.title).toBe('Block User');

      // UNBLOCK_USER (ja & en)
      const unblockJa = await tool.execute({ actionType: 'UNBLOCK_USER', targetId: '@friendly' }, { isEn: false });
      expect(unblockJa.actionRequired?.title).toContain('ユーザー @friendly のブロック解除');
      expect(unblockJa.actionRequired?.impactLevel).toBe('warning');

      const unblockEnNoTarget = await tool.execute({ actionType: 'UNBLOCK_USER' }, { isEn: true });
      expect(unblockEnNoTarget.actionRequired?.title).toBe('Unblock User');

      // DELETE_POST (en & ja)
      const deleteEn = await tool.execute({ actionType: 'DELETE_POST', targetId: '#post_999' }, { isEn: true });
      expect(deleteEn.actionRequired?.title).toBe('Confirm Post Deletion');
      expect(deleteEn.actionRequired?.payload?.postId).toBe('post_999');

      const deleteJa = await tool.execute({ actionType: 'DELETE_POST', targetId: 'post_999' }, { isEn: false });
      expect(deleteJa.actionRequired?.title).toBe('投稿の削除確認');

      // FORCE_DREAMING (en & ja)
      const dreamEn = await tool.execute({ actionType: 'FORCE_DREAMING' }, { isEn: true });
      expect(dreamEn.actionRequired?.title).toBe('Trigger Memory Consolidation (Dreaming)');

      const dreamJa = await tool.execute({ actionType: 'FORCE_DREAMING' }, { isEn: false });
      expect(dreamJa.actionRequired?.title).toContain('長期記憶の統合（ドリーミング）実行');

      // REGENERATE_CAPTIONS (en & ja)
      const regenEn = await tool.execute({ actionType: 'REGENERATE_CAPTIONS' }, { isEn: true });
      expect(regenEn.actionRequired?.title).toBe('Trigger Caption Regeneration');

      const regenJa = await tool.execute({ actionType: 'REGENERATE_CAPTIONS' }, { isEn: false });
      expect(regenJa.actionRequired?.title).toContain('キャプション再生成ジョブ実行');
    });

    it('GetFeatureGuideTool should handle all topics and unknown fallback in en and ja', async () => {
      const tool = new GetFeatureGuideTool();
      const topics = ['supporters', 'campaigns', 'users', 'timeline', 'unknown_topic'];

      for (const t of topics) {
        const resJa = await tool.execute({ topic: t }, { isEn: false });
        expect(resJa.data).toBeDefined();

        const resEn = await tool.execute({ topic: t }, { isEn: true });
        expect(resEn.data).toBeDefined();
      }
    });

    it('SearchTimelinePostsTool should handle edge cases, sorting, and missing repository', async () => {
      const tool = new SearchTimelinePostsTool();

      // Missing repo
      const noRepo = await tool.execute({}, { isEn: false });
      expect((noRepo.data as any).error).toContain('TimelineRepository is not configured');

      // Long snippet and no media
      (timelineRepo.getPosts as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            id: 'post_long',
            snippet: 'A'.repeat(120),
            time: '2026-11-10T12:00:00Z',
            impressions: 100,
            hasMedia: false,
            mediaUrls: []
          }
        ]
      });

      const res = await tool.execute({ sortBy: 'recent', sortOrder: 'asc', limit: 50 }, { timelineRepo, isEn: true });
      expect(timelineRepo.getPosts).toHaveBeenCalledWith(expect.objectContaining({
        sortBy: 'recent',
        sortOrder: 'asc',
        limit: 20
      }));
      expect(res.attachments?.[0].title.endsWith('...')).toBe(true);
      expect(res.attachments?.[0].imageUrl).toBeUndefined();
    });

    it('SearchUsersTool should handle missing repository, status filter, and users without name', async () => {
      const tool = new SearchUsersTool();

      // Missing repo
      const noRepo = await tool.execute({}, { isEn: false });
      expect((noRepo.data as any).error).toContain('UsersRepository is not configured');

      // User without name and status filter
      (usersRepo.getAll as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            id: 'u2',
            username: 'anon_user',
            name: '',
            status: UserStatus.BLOCKED,
            interactions: 5,
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-11-10T00:00:00Z'
          },
          {
            id: 'u3',
            username: 'active_user',
            name: 'Active',
            status: UserStatus.ACTIVE,
            interactions: 10,
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-11-10T00:00:00Z'
          }
        ]
      });

      const res = await tool.execute({ query: '@anon', status: UserStatus.BLOCKED }, { usersRepo, isEn: false });
      expect(res.attachments?.length).toBe(1);
      expect(res.attachments?.[0].title).toBe('@anon_user');
      expect(res.attachments?.[0].statusBadge).toBe(UserStatus.BLOCKED);
    });

    it('SearchAssetsTool should filter vector results by status and handle failed asset captions', async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2] }]
      });

      (assetsRepo.findByVector as jest.Mock).mockResolvedValueOnce([
        { id: 'a_succ', filename: 'ok.png', caption: 'Nice', status: AssetStatus.SUCCESS, url: '/ok.png' },
        { id: 'a_fail', filename: 'bad.png', caption: '', status: AssetStatus.FAILED, url: '/bad.png' }
      ]);

      const tool = new SearchAssetsTool();
      const res = await tool.execute(
        { semanticQuery: 'art', status: AssetStatus.FAILED },
        { assetsRepo, isEn: false }
      );

      expect(res.attachments?.length).toBe(1);
      expect(res.attachments?.[0].id).toBe('a_fail');
      expect(res.attachments?.[0].subtitle).toBe('Caption generation failed');
    });

    it('GetKpiSummaryTool and SearchSupportersTool should handle missing repository branches', async () => {
      const kpiTool = new GetKpiSummaryTool();
      const kpiNoRepo = await kpiTool.execute({}, { isEn: false });
      expect((kpiNoRepo.data as any).error).toContain('TimelineRepository is not configured');

      const kpiRes = await kpiTool.execute({}, { timelineRepo, isEn: false });
      expect((kpiRes.data as any).period).toBe('monthly');

      const supTool = new SearchSupportersTool();
      const supNoRepo = await supTool.execute({}, { isEn: false });
      expect((supNoRepo.data as any).error).toContain('SupportersRepository is not configured');
    });

    it('CopilotToolRegistry should execute known tools and handle unknown tools gracefully', async () => {
      const registry = new CopilotToolRegistry();
      const decls = registry.getFunctionDeclarations();
      expect(decls.length).toBe(7);

      const unknownRes = await registry.execute('non_existent_tool', {}, { isEn: false });
      expect(unknownRes.data).toEqual({ error: 'Tool non_existent_tool is not registered' });
    });

    it('ProposeDestructiveActionTool should generate safety confirmation cards for explicit commands', async () => {
      const tool = new ProposeDestructiveActionTool();
      const blockRes = await tool.execute(
        { actionType: 'BLOCK_USER', targetId: '@troublemaker' },
        { isEn: false }
      );

      expect(blockRes.actionRequired?.type).toBe('BLOCK_USER');
      expect(blockRes.actionRequired?.impactLevel).toBe('danger');
      expect(blockRes.actionRequired?.requiresConfirmation).toBe(true);
      expect(blockRes.actionRequired?.payload['handle']).toBe('@troublemaker');

      const deleteRes = await tool.execute(
        { actionType: 'DELETE_POST', targetId: 'post_999' },
        { isEn: true }
      );
      expect(deleteRes.actionRequired?.type).toBe('DELETE_POST');
      expect(deleteRes.actionRequired?.payload['postId']).toBe('post_999');
    });
  });

  describe('Autonomous ReAct Multi-Turn Loop in CopilotUseCase', () => {
    it('should autonomously call search_timeline_posts and synthesize final response', async () => {
      // Turn 1: Model decides to call search_timeline_posts
      mockGenerateContent.mockResolvedValueOnce({
        functionCalls: [
          {
            name: 'search_timeline_posts',
            args: { limit: 3, sortBy: 'impressions' }
          }
        ],
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'search_timeline_posts', args: { limit: 3, sortBy: 'impressions' } } }]
            }
          }
        ]
      });

      // Turn 2: Model synthesizes final analytical response with attachments
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'マスター！直近で一番伸びたのは新モデル発表のポストよ♡ 45,000インプレッション超えで大好評ね！',
          suggestionChips: ['他の投稿を見る', 'ユーザー分析', 'アセット確認']
        })
      });

      const copilot = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo, supportersRepo);
      const res = await copilot.processChat({
        message: '先週一番伸びた投稿と数値を教えて',
        currentContext: 'Timeline Analytics',
        language: 'ja'
      });

      expect(res.reply).toContain('マスター！直近で一番伸びたのは');
      expect(res.attachments).toBeDefined();
      expect(res.attachments?.length).toBe(1);
      expect(res.attachments?.[0].type).toBe('post');
      expect(res.actionRequired).toBeNull();
    });

    it('should directly reply for casual conversation without triggering tools', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'マスター、今日もお疲れ様〜！♡ いつでも頼りにしてね！',
          suggestionChips: ['ありがとう', '調子はどう？', '今日のサマリー']
        })
      });

      const copilot = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo, supportersRepo);
      const res = await copilot.processChat({
        message: 'レベッカ、今日もお疲れ様！',
        currentContext: 'Dashboard Overview',
        language: 'ja'
      });

      expect(res.reply).toContain('マスター、今日もお疲れ様〜！♡');
      expect(res.attachments).toBeUndefined();
      expect(res.actionRequired).toBeNull();
      expect(timelineRepo.getPosts).not.toHaveBeenCalled();
    });

    it('should safely handle explicit administrative commands via propose_destructive_action', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        functionCalls: [
          {
            name: 'propose_destructive_action',
            args: { actionType: 'BLOCK_USER', targetId: '@bad_bot' }
          }
        ],
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'propose_destructive_action', args: { actionType: 'BLOCK_USER', targetId: '@bad_bot' } } }]
            }
          }
        ]
      });

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'マスターの指示通り、悪質なユーザー @bad_bot のブロック承認カードを用意したわよ♡ 確認して実行してね！',
          suggestionChips: ['承認する', 'キャンセル']
        })
      });

      const copilot = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo, supportersRepo);
      const res = await copilot.processChat({
        message: '@bad_bot を即座にブロックして',
        currentContext: 'User Moderation',
        language: 'ja'
      });

      expect(res.actionRequired).toBeDefined();
      expect(res.actionRequired?.type).toBe('BLOCK_USER');
      expect(res.actionRequired?.requiresConfirmation).toBe(true);
    });

    it('should fail fast on empty message', async () => {
      const copilot = new CopilotUseCase();
      await expect(copilot.processChat({ message: '   ' })).rejects.toThrow('User message is required');
    });

    it('should fall back gracefully when Gemini API is unconfigured', async () => {
      const copilot = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo, supportersRepo);
      (copilot as any).ai = null;

      const res = await copilot.processChat({
        message: '画像アセットを見せて',
        currentContext: 'Asset Library',
        language: 'ja'
      });

      expect(res.reply).toContain('レベッカAIの接続キーが設定されていません');
      expect(res.actionRequired).toBeNull();
    });
  });

  describe('extractStructuredCopilotResponse Robust Parsing & Dynamic Context Fallbacks', () => {
    it('should parse raw JSON properly', () => {
      const res = extractStructuredCopilotResponse(
        '{"reply": "Hello Master♡", "suggestionChips": ["A", "B"]}',
        'Dashboard',
        true
      );
      expect(res.reply).toBe('Hello Master♡');
      expect(res.suggestionChips).toEqual(['A', 'B']);
    });

    it('should unwrap markdown-fenced json (```json ... ```)', () => {
      const raw = '```json\n{\n  "reply": "こんにちはマスター♡",\n  "suggestionChips": ["人気投稿", "アセット"]\n}\n```';
      const res = extractStructuredCopilotResponse(raw, 'Dashboard', false);
      expect(res.reply).toBe('こんにちはマスター♡');
      expect(res.suggestionChips).toEqual(['人気投稿', 'アセット']);
    });

    it('should unwrap markdown fences without language identifier (``` ... ```)', () => {
      const raw = '```\n{\n  "reply": "Analyzed successfully",\n  "suggestionChips": ["Next"]\n}\n```';
      const res = extractStructuredCopilotResponse(raw, 'Dashboard', true);
      expect(res.reply).toBe('Analyzed successfully');
      expect(res.suggestionChips).toEqual(['Next']);
    });

    it('should extract JSON embedded inside conversational text', () => {
      const raw = 'Here is what you asked for:\n{"reply": "KPI is growing!", "suggestionChips": ["Export"]}\nHope that helps!';
      const res = extractStructuredCopilotResponse(raw, 'Dashboard', true);
      expect(res.reply).toBe('KPI is growing!');
      expect(res.suggestionChips).toEqual(['Export']);
    });

    it('should strip markdown fences and apply contextual fallbacks when JSON is malformed', () => {
      const raw = '```json\nThis is not valid JSON at all\n```';
      const res = extractStructuredCopilotResponse(raw, 'Dashboard', false);
      expect(res.reply).toBe('This is not valid JSON at all');
      expect(res.suggestionChips.length).toBeGreaterThan(0);
    });

    it('should generate context-specific suggestion chips for different page views in JA and EN', () => {
      const contexts = ['supporters', 'assets', 'users', 'campaigns', 'memory', 'overview'];
      for (const ctx of contexts) {
        const resEn = extractStructuredCopilotResponse('Raw text without chips', ctx, true);
        const resJa = extractStructuredCopilotResponse('チップなしテキスト', ctx, false);
        expect(resEn.suggestionChips.length).toBe(3);
        expect(resJa.suggestionChips.length).toBe(3);
      }
    });

    it('should forward actionRequired if present in structured JSON', () => {
      const raw = JSON.stringify({
        reply: 'Proposing action',
        actionRequired: {
          type: 'BLOCK_USER',
          title: 'Block User',
          description: 'Desc',
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { userId: '123' }
        },
        suggestionChips: ['Confirm']
      });
      const res = extractStructuredCopilotResponse(raw, 'Users', true);
      expect(res.actionRequired?.type).toBe('BLOCK_USER');
    });
  });

  describe('ProposeDestructiveActionTool Target Existence & Disambiguation', () => {
    it('should return error when target user does not exist in usersRepo', async () => {
      const tool = new ProposeDestructiveActionTool();
      const mockUsersRepo = {
        getById: jest.fn().mockResolvedValue(null),
        getAll: jest.fn().mockResolvedValue({ data: [] })
      } as unknown as UsersRepository;

      const jaRes = await tool.execute(
        { actionType: 'BLOCK_USER', targetId: '@ghost_user' },
        { usersRepo: mockUsersRepo, isEn: false }
      );
      expect((jaRes.data as any).error).toContain('データベースに見つかりませんでした');
      expect(jaRes.actionRequired).toBeUndefined();

      const enRes = await tool.execute(
        { actionType: 'UNBLOCK_USER', targetId: 'ghost_user' },
        { usersRepo: mockUsersRepo, isEn: true }
      );
      expect((enRes.data as any).error).toContain('was not found in the database');
      expect(enRes.actionRequired).toBeUndefined();
    });

    it('should resolve user handle and display name when searched via getAll', async () => {
      const tool = new ProposeDestructiveActionTool();
      const mockUsersRepo = {
        getById: jest.fn().mockResolvedValue(null),
        getAll: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'doc_123',
              username: 'se_akina',
              name: 'AKINA',
              status: UserStatus.ACTIVE,
              interactions: 50
            }
          ]
        })
      } as unknown as UsersRepository;

      const res = await tool.execute(
        { actionType: 'BLOCK_USER', targetId: 'AKINA' },
        { usersRepo: mockUsersRepo, isEn: false }
      );
      expect(res.actionRequired).toBeDefined();
      expect(res.actionRequired?.payload['userId']).toBe('doc_123');
      expect(res.actionRequired?.payload['handle']).toBe('@se_akina');
      expect(res.actionRequired?.title).toContain('AKINA (@se_akina)');
    });

    it('should resolve user directly when getById returns matching user with name', async () => {
      const tool = new ProposeDestructiveActionTool();
      const mockUsersRepo = {
        getById: jest.fn().mockResolvedValue({
          id: 'user_999',
          username: 'vip_user',
          name: 'VIP Member',
          status: UserStatus.ACTIVE
        })
      } as unknown as UsersRepository;

      const res = await tool.execute(
        { actionType: 'UNBLOCK_USER', targetId: '@vip_user' },
        { usersRepo: mockUsersRepo, isEn: false }
      );
      expect(res.actionRequired).toBeDefined();
      expect(res.actionRequired?.payload['userId']).toBe('user_999');
      expect(res.actionRequired?.payload['handle']).toBe('@vip_user');
    });

    it('should return error when DELETE_POST target is empty or not found in timelineRepo', async () => {
      const tool = new ProposeDestructiveActionTool();
      const emptyRes = await tool.execute({ actionType: 'DELETE_POST', targetId: '' }, { isEn: false });
      expect((emptyRes.data as any).error).toContain('投稿の削除には対象の投稿ID');

      const mockTimelineRepo = {
        getPostById: jest.fn().mockResolvedValue(null)
      } as unknown as TimelineRepository;

      const notFoundRes = await tool.execute(
        { actionType: 'DELETE_POST', targetId: 'missing_post_123' },
        { timelineRepo: mockTimelineRepo, isEn: false }
      );
      expect((notFoundRes.data as any).error).toContain('データベースに見つかりませんでした');
      expect(notFoundRes.actionRequired).toBeUndefined();

      const notFoundEn = await tool.execute(
        { actionType: 'DELETE_POST', targetId: 'missing_post_123' },
        { timelineRepo: mockTimelineRepo, isEn: true }
      );
      expect((notFoundEn.data as any).error).toContain('was not found in the database');
    });

    it('should create DELETE_POST action card when post exists in timelineRepo', async () => {
      const tool = new ProposeDestructiveActionTool();
      const mockTimelineRepo = {
        getPostById: jest.fn().mockResolvedValue({ id: 'post_valid_100', snippet: 'Post content' })
      } as unknown as TimelineRepository;

      const res = await tool.execute(
        { actionType: 'DELETE_POST', targetId: 'post_valid_100' },
        { timelineRepo: mockTimelineRepo, isEn: false }
      );
      expect(res.actionRequired).toBeDefined();
      expect(res.actionRequired?.type).toBe('DELETE_POST');
      expect(res.actionRequired?.payload['postId']).toBe('post_valid_100');
    });
  });
});
