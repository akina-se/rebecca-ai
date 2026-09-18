import { CampaignGuard } from '../../src/features/campaign/guard';
import { CampaignPostUseCase, mapHourToTimePeriod } from '../../src/features/campaign/usecase';
import { CampaignPostController } from '../../src/features/campaign/controller';
import { ProactiveNewsController } from '../../src/features/news/controller';
import { SoliloquyController } from '../../src/features/soliloquy/controller';
import { ProactiveAnniversaryController } from '../../src/features/anniversary/controller';
import { RandomEngagementController } from '../../src/features/engagement/controller';
import { ReplyTaskUseCase } from '../../src/features/reply/usecase';
import { createMockDeps } from './core/testUtils';
import { CampaignDoc } from '@rebecca/types';
import { Request, Response } from 'express';
import { getZonedDateParts } from '../../src/utils/time';

jest.mock('../../src/utils/time', () => {
  const actual = jest.requireActual('../../src/utils/time');
  return {
    ...actual,
    getZonedDateParts: jest.fn(),
  };
});

jest.mock('../../src/utils/image', () => ({
  downloadImage: jest.fn().mockResolvedValue({
    buffer: Buffer.from('fake-image-bytes'),
    mimeType: 'image/jpeg',
  }),
}));

describe('Campaign Narrative Event Engine Unit Tests', () => {
  let deps: ReturnType<typeof createMockDeps>;

  const mockActiveCampaign: CampaignDoc = {
    id: 'camp_hawaii_1',
    title: 'Hawaii Trip 2026',
    status: 'active',
    isPaused: false,
    startDate: '2026-09-18',
    endDate: '2026-09-24',
    dailySlotTimes: ['08:00', '12:00', '19:00'],
    masterContext: 'Rebecca is vacationing in Honolulu with friends.',
    replyContextSummary: 'Rebecca is having fun on Waikiki beach.',
    slots: [
      {
        slotId: 'slot-day1-morning',
        dayNumber: 1,
        timePeriod: 'morning',
        scheduledTime: '2026-09-18T08:00:00Z',
        theme: 'Arrival at Honolulu Airport',
        mediaUrl: 'https://storage.googleapis.com/rebecca-ai-gal-images/campaigns/c1/airport.jpg',
        captionPromptHint: 'Aloha spirit and ocean breeze',
        status: 'pending',
      },
      {
        slotId: 'slot-day1-afternoon',
        dayNumber: 1,
        timePeriod: 'afternoon',
        scheduledTime: '2026-09-18T12:00:00Z',
        theme: 'Lunch at Waikiki Cafe',
        status: 'pending',
      },
    ],
    totalSlotsCount: 2,
    completedSlotsCount: 0,
    isAnnualRecurring: false,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  };

  beforeEach(() => {
    deps = createMockDeps();
    jest.clearAllMocks();
    (getZonedDateParts as jest.Mock).mockReturnValue({
      year: '2026',
      month: '09',
      day: '18',
      hour: '08',
      minute: '00',
      second: '00',
      numericYear: 2026,
      numericMonth: 9,
      numericDay: 18,
      numericHour: 8,
      numericMinute: 0,
    });
  });

  describe('mapHourToTimePeriod', () => {
    it('should map hours to correct SlotTimePeriod', () => {
      expect(mapHourToTimePeriod(6)).toBe('morning');
      expect(mapHourToTimePeriod(10)).toBe('morning');
      expect(mapHourToTimePeriod(12)).toBe('afternoon');
      expect(mapHourToTimePeriod(14)).toBe('afternoon');
      expect(mapHourToTimePeriod(16)).toBe('evening');
      expect(mapHourToTimePeriod(18)).toBe('evening');
      expect(mapHourToTimePeriod(19)).toBe('night');
      expect(mapHourToTimePeriod(20)).toBe('night');
      expect(mapHourToTimePeriod(22)).toBe('night');
      expect(mapHourToTimePeriod(2)).toBe('night');
    });
  });

  describe('CampaignGuard', () => {
    it('should not suppress when no campaign is active', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(null);
      const guard = new CampaignGuard(deps.firestore);
      const res = await guard.shouldSuppressRoutinePost();
      expect(res.shouldSuppress).toBe(false);
      expect(res.campaign).toBeUndefined();
    });

    it('should not suppress when active campaign is paused', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue({
        ...mockActiveCampaign,
        isPaused: true,
      });
      const guard = new CampaignGuard(deps.firestore);
      const res = await guard.shouldSuppressRoutinePost();
      expect(res.shouldSuppress).toBe(false);
    });

    it('should suppress routine post when active campaign is unpaused', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      const guard = new CampaignGuard(deps.firestore);
      const res = await guard.shouldSuppressRoutinePost();
      expect(res.shouldSuppress).toBe(true);
      expect(res.campaign?.id).toBe('camp_hawaii_1');
    });

    it('Fail-Loudly: should re-raise database errors so Cloud Scheduler can retry', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockRejectedValue(new Error('Firestore gRPC timeout'));
      const guard = new CampaignGuard(deps.firestore);
      await expect(guard.shouldSuppressRoutinePost()).rejects.toThrow('Firestore gRPC timeout');
    });
  });

  describe('Routine Controllers Suppression', () => {
    const mockReq = {} as Request;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('ProactiveNewsController should return 200 suppressed_by_campaign when campaign is active', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      const guard = new CampaignGuard(deps.firestore);
      const mockNewsUseCase = { execute: jest.fn() } as any;
      const mockSoliloquyUseCase = { execute: jest.fn() } as any;
      const controller = new ProactiveNewsController(mockNewsUseCase, mockSoliloquyUseCase, guard);

      await controller.handle(mockReq, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'suppressed_by_campaign',
        campaignId: 'camp_hawaii_1',
      });
      expect(mockNewsUseCase.execute).not.toHaveBeenCalled();
      expect(mockSoliloquyUseCase.execute).not.toHaveBeenCalled();
    });

    it('SoliloquyController should return 200 suppressed_by_campaign when campaign is active', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      const guard = new CampaignGuard(deps.firestore);
      const mockSoliloquyUseCase = { execute: jest.fn() } as any;
      const controller = new SoliloquyController(mockSoliloquyUseCase, guard);

      await controller.handle(mockReq, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'suppressed_by_campaign',
        campaignId: 'camp_hawaii_1',
      });
      expect(mockSoliloquyUseCase.execute).not.toHaveBeenCalled();
    });

    it('ProactiveAnniversaryController should return 200 suppressed_by_campaign when campaign is active', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      const guard = new CampaignGuard(deps.firestore);
      const mockAnniversaryUseCase = { execute: jest.fn() } as any;
      const mockSoliloquyUseCase = { execute: jest.fn() } as any;
      const controller = new ProactiveAnniversaryController(mockAnniversaryUseCase, mockSoliloquyUseCase, guard);

      await controller.handle(mockReq, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'suppressed_by_campaign',
        campaignId: 'camp_hawaii_1',
      });
      expect(mockAnniversaryUseCase.execute).not.toHaveBeenCalled();
    });

    it('RandomEngagementController should return 200 suppressed_by_campaign when campaign is active', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      const guard = new CampaignGuard(deps.firestore);
      const mockEngagementUseCase = { execute: jest.fn() } as any;
      const controller = new RandomEngagementController(mockEngagementUseCase, guard);

      await controller.handle(mockReq, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'suppressed_by_campaign',
        campaignId: 'camp_hawaii_1',
      });
      expect(mockEngagementUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('CampaignPostUseCase', () => {
    it('should return no_active_campaign when getActiveCampaign returns null', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(null);
      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();
      expect(result.status).toBe('no_active_campaign');
    });

    it('should return no_active_campaign when campaign is paused', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue({
        ...mockActiveCampaign,
        isPaused: true,
      });
      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();
      expect(result.status).toBe('no_active_campaign');
    });

    it('should successfully post slot with attached media, dynamic persona anchoring, and update Firestore', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.firestore.getTimelineSummary as jest.Mock).mockResolvedValue('Recent tweets about coffee');
      (deps.firestore.getExtendedPrompt as jest.Mock).mockResolvedValue('Feeling adventurous');
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
        reply: 'ホノルル空港に到着！海風が最高だよ〜🌺',
        thought: 'ハワイに着いてテンションあがる！',
      });
      (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('media_12345');
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_camp_999' } });

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.slotId).toBe('slot-day1-morning');
      expect(result.tweetId).toBe('tweet_camp_999');
      expect(result.attachedMedia).toBe(true);

      expect(deps.gemini.generateEmbedding).toHaveBeenCalled();
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Rebecca is vacationing in Honolulu with friends.'),
      );
      expect(deps.xApi.uploadMedia).toHaveBeenCalled();
      expect(deps.xApi.tweet).toHaveBeenCalledWith(
        expect.stringContaining('ホノルル空港に到着'),
        { mediaIds: ['media_12345'] },
      );
      expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith({
        text: expect.stringContaining('ホノルル空港に到着'),
        thought: 'ハワイに着いてテンションあがる！',
        mediaUrls: [campaign.slots[0].mediaUrl],
        tweetId: 'tweet_camp_999',
        postType: 'campaign',
      });
      expect(deps.firestore.updateCampaign).toHaveBeenCalledWith(
        'camp_hawaii_1',
        expect.objectContaining({
          completedSlotsCount: 1,
        }),
      );
    });

    it('should strictly skip when current time period does not match any pending slot on that day', async () => {
      (getZonedDateParts as jest.Mock).mockReturnValue({
        year: '2026',
        month: '09',
        day: '18',
        hour: '20',
        minute: '00',
        second: '00',
        numericYear: 2026,
        numericMonth: 9,
        numericDay: 18,
        numericHour: 20, // night -> no night slot on Day 1
        numericMinute: 0,
      });

      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('No pending slot configured for period "night" on Day 1.');
      expect(deps.gemini.generateStructuredTimelinePost).not.toHaveBeenCalled();
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should return no_pending_slot when all slots for today are already posted', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots.forEach((s: any) => {
        s.status = 'posted';
      });
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();

      expect(result.status).toBe('no_pending_slot');
      expect(result.reason).toContain('No pending slots found for Day 1.');
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should return skipped when current date is outside campaign window', async () => {
      (getZonedDateParts as jest.Mock).mockReturnValue({
        year: '2026',
        month: '09',
        day: '26', // Campaign ends on 2026-09-24
        hour: '08',
        minute: '00',
        second: '00',
        numericYear: 2026,
        numericMonth: 9,
        numericDay: 26,
        numericHour: 8,
        numericMinute: 0,
      });

      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('outside campaign window');
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should use fixedTextOverride directly without calling Gemini when specified', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].fixedTextOverride = '【公式告知】ハワイ到着イベント開幕！';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_fixed_1' } });

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.post).toBe('【公式告知】ハワイ到着イベント開幕！');
      expect(deps.gemini.generateStructuredTimelinePost).not.toHaveBeenCalled();
      expect(deps.xApi.uploadMedia).not.toHaveBeenCalled();
      expect(deps.xApi.tweet).toHaveBeenCalledWith('【公式告知】ハワイ到着イベント開幕！', { mediaIds: undefined });
    });

    it('Fail-Loudly: should update slot as failed in Firestore and rethrow error when tweet fails', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].fixedTextOverride = 'Fail test';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockRejectedValue(new Error('X API 403 Forbidden'));

      const useCase = new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo' });

      await expect(useCase.execute()).rejects.toThrow('X API 403 Forbidden');
      expect(deps.firestore.updateCampaign).toHaveBeenCalledWith(
        'camp_hawaii_1',
        expect.objectContaining({
          slots: expect.arrayContaining([
            expect.objectContaining({
              slotId: 'slot-day1-morning',
              status: 'failed',
              errorReason: 'X API 403 Forbidden',
            }),
          ]),
        }),
      );
    });
  });

  describe('CampaignPostController', () => {
    it('should return 200 with result on success', async () => {
      const mockUseCase = {
        execute: jest.fn().mockResolvedValue({ status: 'success', tweetId: 't123' }),
      } as any;
      const controller = new CampaignPostController(mockUseCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', tweetId: 't123' });
    });

    it('should return 500 when usecase throws', async () => {
      const mockUseCase = {
        execute: jest.fn().mockRejectedValue(new Error('Fatal error')),
      } as any;
      const controller = new CampaignPostController(mockUseCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('ReplyTaskUseCase Empathy Priority Context Injection', () => {
    it('should inject campaign context into reply prompt when campaign is active', async () => {
      (deps.firestore.hasProcessedMention as jest.Mock).mockResolvedValue(false);
      (deps.firestore.checkAndConsumeRateLimit as jest.Mock).mockResolvedValue({ allowed: true });
      (deps.firestore.getUserDoc as jest.Mock).mockResolvedValue({
        id: 'u123',
        name: 'User One',
        username: 'user1',
        status: 'ACTIVE',
        episodicBuffer: [],
      });
      (deps.xApi.getTweetDetails as jest.Mock).mockResolvedValue({ data: { id: 'm1' } });
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(mockActiveCampaign);
      (deps.gemini.generateStructuredReply as jest.Mock).mockResolvedValue({
        thought: 'マスターが疲れてるみたいだからまず労おう',
        reply: 'お疲れ様！今日も大変だったね',
      });
      (deps.xApi.replyToMention as jest.Mock).mockResolvedValue({ data: { id: 'reply_1' } });

      const replyUseCase = new ReplyTaskUseCase(deps);
      await replyUseCase.execute({
        tweetId: 'mention_1',
        text: '仕事疲れたよ〜',
        authorId: 'u123',
      });

      expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
        expect.stringContaining('Rebecca is having fun on Waikiki beach.'),
        expect.anything(),
        expect.anything(),
      );
      // Verify Empathy Priority prompt rule was injected
      expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
        expect.stringContaining('共感・ユーザーファースト（Empathy Priority）'),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
