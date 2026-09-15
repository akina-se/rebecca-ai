import { SoliloquyUseCase, getTimeOfDayGreetingContext } from '../../../src/features/soliloquy/usecase';
import { SoliloquyController } from '../../../src/features/soliloquy/controller';
import { getValidatedTimezone } from '../../../src/config';
import { createMockDeps } from './testUtils';
import { Request, Response } from 'express';

describe('Soliloquy Unit Tests', () => {
  let deps: ReturnType<typeof createMockDeps>;
  let useCase: SoliloquyUseCase;

  beforeEach(() => {
    deps = createMockDeps();
    useCase = new SoliloquyUseCase(deps, { timezone: 'Asia/Tokyo' });
    (deps.firestore.getTimelineSummary as jest.Mock).mockResolvedValue('Recent timeline events');
    (deps.firestore.getExtendedPrompt as jest.Mock).mockResolvedValue('User loves coffee');
    (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
      thought: '今日も頑張るマスターを応援したいな',
      reply: '今日も無理せずファイトよ♡',
    });
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue(null);
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'soliloquy_tweet_1' } });
  });

  describe('getTimeOfDayGreetingContext', () => {
    it('should return morning context for 8:00', () => {
      const morningDate = new Date('2026-09-03T08:00:00+09:00');
      const res = getTimeOfDayGreetingContext(morningDate);
      expect(res.period).toBe('朝');
    });

    it('should return noon context for 12:00', () => {
      const noonDate = new Date('2026-09-03T12:00:00+09:00');
      const res = getTimeOfDayGreetingContext(noonDate);
      expect(res.period).toBe('昼');
    });

    it('should return evening context for 17:00', () => {
      const eveningDate = new Date('2026-09-03T17:00:00+09:00');
      const res = getTimeOfDayGreetingContext(eveningDate);
      expect(res.period).toBe('夕方');
    });

    it('should return night context for 21:00', () => {
      const nightDate = new Date('2026-09-03T21:00:00+09:00');
      const res = getTimeOfDayGreetingContext(nightDate);
      expect(res.period).toBe('夜');
    });

    it('should return midnight context for 2:00', () => {
      const midnightDate = new Date('2026-09-03T02:00:00+09:00');
      const res = getTimeOfDayGreetingContext(midnightDate);
      expect(res.period).toBe('深夜');
    });

    it('should support custom timezone (e.g., America/New_York)', () => {
      // 12:00 UTC corresponds to 08:00 in America/New_York (EDT) -> 朝
      const utcDate = new Date('2026-09-03T12:00:00Z');
      const res = getTimeOfDayGreetingContext(utcDate, 'America/New_York');
      expect(res.period).toBe('朝');
    });
  });

  describe('getValidatedTimezone', () => {
    it('should return valid IANA timezone as is', () => {
      expect(getValidatedTimezone('America/New_York')).toBe('America/New_York');
      expect(getValidatedTimezone('Europe/London')).toBe('Europe/London');
      expect(getValidatedTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    });

    it('should fallback to Asia/Tokyo for undefined, empty, or invalid timezone', () => {
      expect(getValidatedTimezone(undefined)).toBe('Asia/Tokyo');
      expect(getValidatedTimezone('')).toBe('Asia/Tokyo');
      expect(getValidatedTimezone('Invalid/Zone_Name')).toBe('Asia/Tokyo');
    });
  });

  describe('SoliloquyUseCase', () => {
    it('should generate and publish soliloquy post successfully', async () => {
      (deps.firestore.getRecentTimelinePosts as jest.Mock).mockResolvedValue([
        { text: '過去の独り言1', thought: '過去の本音1', timestamp: '2026-09-13T03:00:00Z' },
      ]);

      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.post).toContain('今日も無理せずファイトよ♡');
      expect(result.post).toContain('#全肯定AIレベッカ');
      expect(deps.firestore.getRecentTimelinePosts).toHaveBeenCalledWith({
        limit: 4,
        postType: 'soliloquy',
      });
      expect(deps.gemini.generateEmbedding).toHaveBeenCalled();
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【現在の時間帯】'),
      );
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【直近のタイムライン要約】'),
      );
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【拡張ペルソナ・近況】'),
      );
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('過去の独り言1 (内心: 過去の本音1)'),
      );
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【話題の多様性と非反復】'),
      );
      expect(deps.xApi.tweet).toHaveBeenCalledWith(
        expect.stringContaining('#全肯定AIレベッカ'),
        { mediaIds: [] },
      );
      expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('#全肯定AIレベッカ'),
          postType: 'soliloquy',
          thought: '今日も頑張るマスターを応援したいな',
          tweetId: 'soliloquy_tweet_1',
        }),
      );
    });

    it('should propagate error when gemini generation fails', async () => {
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockRejectedValue(
        new Error('Gemini API returned structured response with empty reply'),
      );

      await expect(useCase.execute()).rejects.toThrow('Gemini API returned structured response with empty reply');
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });
  });

  describe('SoliloquyController', () => {
    it('should respond with 200 on success', async () => {
      const controller = new SoliloquyController(useCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    it('should respond with 500 when usecase throws', async () => {
      jest.spyOn(useCase, 'execute').mockRejectedValueOnce(new Error('Boom'));
      const controller = new SoliloquyController(useCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });
});
