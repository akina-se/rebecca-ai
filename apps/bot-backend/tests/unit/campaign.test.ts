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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T08:00:00.000Z'));
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

  afterEach(() => {
    jest.useRealTimers();
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
    const defaultUseCaseConfig = {
      timezone: 'Asia/Tokyo',
      bucketName: 'rebecca-ai-gal-images',
    };

    it('should throw error in constructor if timezone is missing or empty', () => {
      expect(() => new CampaignPostUseCase(deps, { timezone: '', bucketName: 'rebecca-ai-gal-images' })).toThrow(
        'config.timezone is required',
      );
    });

    it('should throw error in constructor if bucketName is missing or empty', () => {
      expect(() => new CampaignPostUseCase(deps, { timezone: 'Asia/Tokyo', bucketName: '  ' })).toThrow(
        'config.bucketName is required',
      );
    });

    it('should return no_active_campaign when getActiveCampaign returns null', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(null);
      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();
      expect(result.status).toBe('no_active_campaign');
    });

    it('should return no_active_campaign when campaign is paused', async () => {
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue({
        ...mockActiveCampaign,
        isPaused: true,
      });
      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
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

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
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

    it('should include campaign hashtag and adjust prompt character limit to guarantee total <= 140 chars', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.hashtag = 'レベッカ京都旅';
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.gemini.generateEmbedding as jest.Mock).mockResolvedValue(new Array(768).fill(0.1));
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
        reply: '京都の紅葉が綺麗すぎて言葉が出ないよ〜🍁',
        thought: '京都満喫中！',
      });
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_camp_hashtag_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      // Verify prompt instruction includes dynamic limit
      // hashtagsBlock is "\n#レベッカ京都旅 #RebeccaAI" (length: 1 + 8 + 1 + 10 = 20)
      // maxBodyChars = Math.min(100, 140 - 20) = 100
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【絶対に100文字以内の短文】にしてください。'),
      );
      // Verify both hashtags were appended
      expect(result.post).toContain('#レベッカ京都旅');
      expect(result.post).toContain(deps.persona.metadata.defaultHashtag);
      expect(result.post.length).toBeLessThanOrEqual(140);
    });

    it('should append campaign hashtag to fixedTextOverride if not already present and space permits', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.hashtag = 'レベッカ京都旅';
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = '金閣寺にやってきました！金色が眩しい！';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_fixed_hashtag_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.post).toBe('金閣寺にやってきました！金色が眩しい！\n#レベッカ京都旅');
      expect(result.post.length).toBeLessThanOrEqual(140);
    });

    it('should strictly skip when current time period does not match any pending slot on that day', async () => {
      jest.setSystemTime(new Date('2026-09-18T20:00:00.000Z'));
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
        numericHour: 20,
        numericMinute: 0,
      });

      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('No pending slot scheduled for current execution window on Day 1.');
      expect(deps.gemini.generateStructuredTimelinePost).not.toHaveBeenCalled();
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should auto-activate scheduled campaign due today upon executing first pending slot', async () => {
      const scheduledCampaign: CampaignDoc = {
        ...JSON.parse(JSON.stringify(mockActiveCampaign)),
        status: 'scheduled',
      };

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(null);
      (deps.firestore.getScheduledCampaignDueToday as jest.Mock).mockResolvedValue(scheduledCampaign);
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
        reply: '初日スタート！アロハ！🌺',
        thought: 'キャンペーン開始！',
      });
      (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('media_999');
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_scheduled_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.firestore.updateCampaign).toHaveBeenCalledWith(
        'camp_hawaii_1',
        expect.objectContaining({ status: 'active' }),
      );
    });

    it('should transition campaign to completed status when the final pending slot finishes', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      // First slot already posted, only 1 pending slot remains
      campaign.slots[0].status = 'posted';
      campaign.slots[1].status = 'pending';
      campaign.slots[1].scheduledTime = '2026-09-18T08:00:00.000Z'; // matches current mock time

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
        reply: 'ラストスロット完了！楽しかった〜🌺',
        thought: '完走！',
      });
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_final_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.firestore.updateCampaign).toHaveBeenCalledWith(
        'camp_hawaii_1',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should prioritize exact hour match when multiple slots exist within the same time period', async () => {
      jest.setSystemTime(new Date('2026-09-18T10:00:00.000Z'));
      (getZonedDateParts as jest.Mock).mockReturnValue({
        year: '2026',
        month: '09',
        day: '18',
        hour: '10',
        minute: '00',
        second: '00',
        numericYear: 2026,
        numericMonth: 9,
        numericDay: 18,
        numericHour: 10,
        numericMinute: 0,
      });

      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots = [
        {
          slotId: 'slot-1-0800',
          dayNumber: 1,
          timePeriod: 'morning',
          scheduledTime: '2026-09-18T08:00:00Z',
          theme: 'Theme 8am',
          status: 'pending',
          isFixedText: true,
          fixedTextOverride: 'Fixed 8am',
        },
        {
          slotId: 'slot-1-1000',
          dayNumber: 1,
          timePeriod: 'morning',
          scheduledTime: '2026-09-18T10:00:00Z',
          theme: 'Theme 10am',
          status: 'pending',
          isFixedText: true,
          fixedTextOverride: 'Fixed 10am',
        },
      ];
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_exact_hour_123' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.slotId).toBe('slot-1-1000');
      expect(result.post).toBe('Fixed 10am');
    });

    it('should return no_pending_slot when all slots for today are already posted', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots.forEach((s: any) => {
        s.status = 'posted';
      });
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
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

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('outside campaign window');
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should use fixedTextOverride directly without calling Gemini when specified', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = '【公式告知】ハワイ到着イベント開幕！';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_fixed_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(result.post).toBe('【公式告知】ハワイ到着イベント開幕！');
      expect(deps.gemini.generateStructuredTimelinePost).not.toHaveBeenCalled();
      expect(deps.xApi.uploadMedia).not.toHaveBeenCalled();
      expect(deps.xApi.tweet).toHaveBeenCalledWith('【公式告知】ハワイ到着イベント開幕！', { mediaIds: undefined });
    });

    it('Fail-Loudly: should update slot as failed in Firestore and rethrow error when tweet fails', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fail test';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.xApi.tweet as jest.Mock).mockRejectedValue(new Error('X API 403 Forbidden'));

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);

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

    it('should generate with Gemini when isFixedText is false even if fixedTextOverride contains text', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = false;
      campaign.slots[0].fixedTextOverride = 'Unused fixed text draft';
      delete campaign.slots[0].mediaUrl;

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
        thought: 'AI generated thought',
        reply: 'Waikiki beach is sunny! #Hawaii',
      });
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_ai_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalled();
      expect(result.post).toContain('Waikiki beach is sunny! #Hawaii');
    });

    it('should throw error when isFixedText is true but fixedTextOverride is empty', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = '   ';

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      await expect(useCase.execute()).rejects.toThrow('configured for fixed text but fixedTextOverride is empty');
    });

    it('should resolve relative campaign asset proxy path to GCS and upload media', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fixed text with photo';
      campaign.slots[0].mediaUrl = '/api/v1/campaigns/camp_hawaii_1/assets/1790081914358_e5cf4b.jpeg';

      const mockBuffer = Buffer.from('jpeg-binary-data');
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.storage.downloadImage as jest.Mock).mockResolvedValue(mockBuffer);
      (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('uploaded_media_999');
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_media_1' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.storage.downloadImage).toHaveBeenCalledWith('gs://rebecca-ai-gal-images/campaigns/camp_hawaii_1/1790081914358_e5cf4b.jpeg');
      expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(mockBuffer, 'image/jpeg');
      expect(deps.xApi.tweet).toHaveBeenCalledWith(expect.any(String), { mediaIds: ['uploaded_media_999'] });
    });

    it('should download directly from GCS when mediaUrl starts with gs://', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fixed text with gs uri';
      campaign.slots[0].mediaUrl = 'gs://rebecca-ai-gal-images/campaigns/custom/pic.png';

      const mockBuffer = Buffer.from('png-binary-data');
      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);
      (deps.storage.downloadImage as jest.Mock).mockResolvedValue(mockBuffer);
      (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('uploaded_media_png');
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_media_2' } });

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      const result = await useCase.execute();

      expect(result.status).toBe('success');
      expect(deps.storage.downloadImage).toHaveBeenCalledWith('gs://rebecca-ai-gal-images/campaigns/custom/pic.png');
      expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(mockBuffer, 'image/png');
    });

    it('should throw error when mediaUrl has unsupported format', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fixed text with bad mediaUrl';
      campaign.slots[0].mediaUrl = '/invalid/relative/path.jpg';

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      await expect(useCase.execute()).rejects.toThrow('Unsupported or malformed mediaUrl');
    });

    it('should throw error when mediaUrl uses insecure http protocol', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fixed text with insecure http';
      campaign.slots[0].mediaUrl = 'http://example.com/image.jpg';

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      await expect(useCase.execute()).rejects.toThrow('Insecure protocol "http:" in mediaUrl');
    });

    it('should throw error when mediaUrl has unsupported image extension', async () => {
      const campaign = JSON.parse(JSON.stringify(mockActiveCampaign));
      campaign.slots[0].isFixedText = true;
      campaign.slots[0].fixedTextOverride = 'Fixed text with svg';
      campaign.slots[0].mediaUrl = 'gs://rebecca-ai-gal-images/campaigns/c1/vector.svg';

      (deps.firestore.getActiveCampaign as jest.Mock).mockResolvedValue(campaign);

      const useCase = new CampaignPostUseCase(deps, defaultUseCaseConfig);
      await expect(useCase.execute()).rejects.toThrow('Unsupported media extension in');
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
