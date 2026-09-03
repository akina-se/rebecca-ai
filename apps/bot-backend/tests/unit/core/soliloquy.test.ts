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
    useCase = new SoliloquyUseCase(deps);
    (deps.firestore.getTimelineSummary as jest.Mock).mockResolvedValue('Recent timeline events');
    (deps.firestore.getExtendedPrompt as jest.Mock).mockResolvedValue('User loves coffee');
    (deps.gemini.generateNewsPost as jest.Mock).mockResolvedValue('今日も無理せずファイトよ♡');
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
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.post).toContain('今日も無理せずファイトよ♡');
      expect(result.post).toContain('#全肯定AIレベッカ');
      expect(deps.gemini.generateEmbedding).toHaveBeenCalled();
      expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【現在の時間帯】'),
      );
      expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【直近のタイムライン要約】'),
      );
      expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【拡張ペルソナ・近況】'),
      );
      expect(deps.xApi.tweet).toHaveBeenCalledWith(
        expect.stringContaining('#全肯定AIレベッカ'),
        { mediaIds: [] },
      );
      expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
        expect.stringContaining('#全肯定AIレベッカ'),
        expect.objectContaining({
          postType: 'soliloquy',
          tweetId: 'soliloquy_tweet_1',
        }),
      );
    });

    it('should return failed when gemini generation returns empty', async () => {
      (deps.gemini.generateNewsPost as jest.Mock).mockResolvedValue('');

      const result = await useCase.execute();

      expect(result.status).toBe('failed');
      expect(result.reason).toBe('Generation failed');
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
