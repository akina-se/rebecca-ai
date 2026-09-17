import { SelfReflectionUseCase } from '../../src/features/self-reflection/usecase';
import { SelfReflectionController } from '../../src/features/self-reflection/controller';
import { createSelfReflectionModule } from '../../src/features/self-reflection';
import { createMockDeps } from './core/testUtils';

describe('SelfReflection Feature Tests', () => {
  let deps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
    deps.persona = {
      metadata: {
        displayName: 'レベッカ',
      },
    };
  });

  describe('SelfReflectionUseCase', () => {
    it('should skip summarization when no recent timeline posts are found', async () => {
      deps.firestore.getRecentTimelinePosts.mockResolvedValue([]);

      const useCase = new SelfReflectionUseCase(deps, { postLimit: 20 });
      const result = await useCase.execute();

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('no_recent_timeline_posts');
      expect(result.postsCount).toBe(0);
      expect(deps.gemini.generateTimelineSummary).not.toHaveBeenCalled();
      expect(deps.firestore.saveTimelineSummary).not.toHaveBeenCalled();
    });

    it('should generate timeline summary, format prompt with previous summary and posts, and persist to firestore', async () => {
      deps.firestore.getRecentTimelinePosts.mockResolvedValue([
        { text: '最新の秋スイーツをチェックしたよ！', thought: '美味しそうだったな' },
        { text: '今日もお疲れ様〜！' },
      ]);
      deps.firestore.getTimelineSummary.mockResolvedValue('以前のタイムライン要約');
      deps.gemini.generateTimelineSummary.mockResolvedValue('新しく生成された客観的要約テキスト');

      const useCase = new SelfReflectionUseCase(deps);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.summary).toBe('新しく生成された客観的要約テキスト');
      expect(result.previousSummary).toBe('以前のタイムライン要約');
      expect(result.postsCount).toBe(2);

      expect(deps.gemini.generateTimelineSummary).toHaveBeenCalledWith(
        expect.stringContaining('【過去の要約】\n以前のタイムライン要約'),
      );
      expect(deps.gemini.generateTimelineSummary).toHaveBeenCalledWith(
        expect.stringContaining('[1] 最新の秋スイーツをチェックしたよ！ (内心: 美味しそうだったな)'),
      );
      expect(deps.gemini.generateTimelineSummary).toHaveBeenCalledWith(
        expect.stringContaining('[2] 今日もお疲れ様〜！'),
      );
      expect(deps.firestore.saveTimelineSummary).toHaveBeenCalledWith('新しく生成された客観的要約テキスト');
    });

    it('should handle missing previous summary with default indicator', async () => {
      deps.firestore.getRecentTimelinePosts.mockResolvedValue([{ text: '初ツイート' }]);
      deps.firestore.getTimelineSummary.mockResolvedValue('');
      deps.gemini.generateTimelineSummary.mockResolvedValue('初回の要約');

      const useCase = new SelfReflectionUseCase(deps);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.gemini.generateTimelineSummary).toHaveBeenCalledWith(
        expect.stringContaining('（まだ要約なし）'),
      );
      expect(deps.firestore.saveTimelineSummary).toHaveBeenCalledWith('初回の要約');
    });

    it('should throw error and NOT call saveTimelineSummary if Gemini returns empty string', async () => {
      deps.firestore.getRecentTimelinePosts.mockResolvedValue([{ text: 'ツイート' }]);
      deps.firestore.getTimelineSummary.mockResolvedValue('既存の要約');
      deps.gemini.generateTimelineSummary.mockResolvedValue('   ');

      const useCase = new SelfReflectionUseCase(deps);
      await expect(useCase.execute()).rejects.toThrow(
        '[SelfReflectionUseCase] Generated timeline summary was empty.',
      );

      expect(deps.firestore.saveTimelineSummary).not.toHaveBeenCalled();
    });

    it('should throw error and NOT call saveTimelineSummary if Gemini throws an error (e.g. 429 quota)', async () => {
      deps.firestore.getRecentTimelinePosts.mockResolvedValue([{ text: 'ツイート' }]);
      deps.firestore.getTimelineSummary.mockResolvedValue('既存の要約');
      deps.gemini.generateTimelineSummary.mockRejectedValue(new Error('429 Quota Exceeded'));

      const useCase = new SelfReflectionUseCase(deps);
      await expect(useCase.execute()).rejects.toThrow('429 Quota Exceeded');

      expect(deps.firestore.saveTimelineSummary).not.toHaveBeenCalled();
    });
  });

  describe('SelfReflectionController', () => {
    let useCase: jest.Mocked<SelfReflectionUseCase>;
    let controller: SelfReflectionController;
    let req: any;
    let res: any;

    beforeEach(() => {
      useCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<SelfReflectionUseCase>;
      controller = new SelfReflectionController(useCase);
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return 200 with result on success', async () => {
      const mockResult = { status: 'success' as const, summary: 'Summary' };
      useCase.execute.mockResolvedValue(mockResult);

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 when useCase throws', async () => {
      useCase.execute.mockRejectedValue(new Error('Gemini 429'));

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          message: 'Gemini 429',
        }),
      );
    });
  });

  describe('createSelfReflectionModule', () => {
    it('should instantiate an express Router with self-reflection routes', () => {
      const router = createSelfReflectionModule(deps);
      expect(router).toBeDefined();
    });
  });
});
