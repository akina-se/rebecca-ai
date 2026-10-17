import { PollUseCase } from '../../../src/features/poll/usecase';
import { PollController } from '../../../src/features/poll/controller';
import { createMockDeps } from './testUtils';
import { Request, Response } from 'express';

describe('X Poll & Result Reaction Unit Tests', () => {
  let deps: ReturnType<typeof createMockDeps>;
  let useCase: PollUseCase;

  beforeEach(() => {
    deps = createMockDeps();
    useCase = new PollUseCase(deps, {
      timezone: 'Asia/Tokyo',
      durationMinutes: 1380,
    });
    (deps.firestore.getTimelineSummary as jest.Mock).mockResolvedValue('Recent timeline context');
    (deps.firestore.getExtendedPrompt as jest.Mock).mockResolvedValue('Current mood context');
    (deps.gemini.generateStructuredPollPost as jest.Mock).mockResolvedValue({
      thought: 'みんなの夜更かし事情が気になるな',
      reply: '夜ってみんな何して過ごすのが一番幸せ？選んだ理由もリプで教えて〜！',
      options: ['🎮 ゲーム・アニメ', '🍺 お酒・晩酌', '🛌 即爆睡', '💃 夜更かしトーク'],
    });
    (deps.gemini.generateStructuredTimelinePost as jest.Mock).mockResolvedValue({
      thought: 'ゲーム・アニメ派が圧倒的だったな〜！',
      reply: 'アンケ結果出たよ〜！やっぱりゲーム・アニメ派が1位か〜！わかる〜♡',
    });
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'poll_tweet_123' } });
  });

  describe('PollUseCase.executeCreatePoll', () => {
    it('should fetch past polls, inject persona interests and core prompt, publish without image, and save with pending status', async () => {
      (deps.firestore.getRecentTimelinePosts as jest.Mock).mockResolvedValue([
        {
          text: '過去のアンケート質問',
          timestamp: '2026-10-10T11:00:00Z',
          poll: {
            durationMinutes: 1380,
            votingStatus: 'closed',
            options: [
              { position: 1, label: '選択肢A', votes: 10 },
              { position: 2, label: '選択肢B', votes: 5 },
            ],
          },
        },
      ]);

      const result = await useCase.executeCreatePoll();

      expect(result.status).toBe('success');
      expect(result.attachedMedia).toBe(false);
      expect(result.tweetId).toBe('poll_tweet_123');
      expect(result.options).toEqual([
        '🎮 ゲーム・アニメ',
        '🍺 お酒・晩酌',
        '🛌 即爆睡',
        '💃 夜更かしトーク',
      ]);

      expect(deps.firestore.getRecentTimelinePosts).toHaveBeenCalledWith({
        limit: 30,
        postType: 'poll',
      });

      expect(deps.gemini.generateStructuredPollPost).toHaveBeenCalledWith(
        expect.stringContaining(deps.persona.getBasePrompt('timeline', 'ja')),
        expect.stringContaining('過去のアンケート質問 (選択肢: 選択肢A / 選択肢B)'),
      );
      expect(deps.gemini.generateStructuredPollPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('【あなたの関心領域・好む話題】'),
      );

      expect(deps.xApi.tweet).toHaveBeenCalledWith(
        expect.stringContaining('夜ってみんな何して過ごすのが一番幸せ？'),
        {
          mediaIds: [],
          poll: {
            options: ['🎮 ゲーム・アニメ', '🍺 お酒・晩酌', '🛌 即爆睡', '💃 夜更かしトーク'],
            durationMinutes: 1380,
          },
        },
      );

      expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'poll',
          tweetId: 'poll_tweet_123',
          pollResultStatus: 'pending',
          poll: {
            durationMinutes: 1380,
            votingStatus: 'open',
            options: [
              { position: 1, label: '🎮 ゲーム・アニメ', votes: 0 },
              { position: 2, label: '🍺 お酒・晩酌', votes: 0 },
              { position: 3, label: '🛌 即爆睡', votes: 0 },
              { position: 4, label: '💃 夜更かしトーク', votes: 0 },
            ],
          },
        }),
      );
    });
  });

  describe('PollUseCase.executePollResult', () => {
    it('should skip when no pending poll exists', async () => {
      (deps.firestore.getLatestPendingPoll as jest.Mock).mockResolvedValue(null);

      const result = await useCase.executePollResult();

      expect(result).toEqual({ status: 'skipped', reason: 'no_pending_poll' });
      expect(deps.xApi.getTweetDetails).not.toHaveBeenCalled();
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should sync poll data and skip when poll votingStatus is still open', async () => {
      (deps.firestore.getLatestPendingPoll as jest.Mock).mockResolvedValue({
        id: 'poll_doc_1',
        tweetId: 'poll_tweet_123',
        text: 'アンケート質問',
        pollResultStatus: 'pending',
      });
      (deps.xApi.getTweetDetails as jest.Mock).mockResolvedValue({
        data: { id: 'poll_tweet_123', text: 'アンケート質問' },
        includes: {
          polls: [
            {
              id: 'poll_id_1',
              durationMinutes: 1380,
              votingStatus: 'open',
              options: [
                { position: 1, label: 'A', votes: 5 },
                { position: 2, label: 'B', votes: 3 },
              ],
            },
          ],
        },
      });

      const result = await useCase.executePollResult();

      expect(result).toEqual({ status: 'skipped', reason: 'poll_still_open' });
      expect(deps.firestore.updateTimelinePost).toHaveBeenCalledWith('poll_doc_1', {
        poll: expect.objectContaining({ votingStatus: 'open' }),
      });
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should mark pollResultStatus as skipped and not post when closed with 0 total votes', async () => {
      (deps.firestore.getLatestPendingPoll as jest.Mock).mockResolvedValue({
        id: 'poll_doc_zero',
        tweetId: 'poll_tweet_zero',
        text: '0票のアンケート',
        pollResultStatus: 'pending',
      });
      (deps.xApi.getTweetDetails as jest.Mock).mockResolvedValue({
        data: { id: 'poll_tweet_zero', text: '0票のアンケート' },
        includes: {
          polls: [
            {
              id: 'poll_id_zero',
              durationMinutes: 1380,
              votingStatus: 'closed',
              options: [
                { position: 1, label: 'A', votes: 0 },
                { position: 2, label: 'B', votes: 0 },
              ],
            },
          ],
        },
      });

      const result = await useCase.executePollResult();

      expect(result).toEqual({ status: 'skipped', reason: 'zero_votes' });
      expect(deps.firestore.updateTimelinePost).toHaveBeenLastCalledWith('poll_doc_zero', {
        poll: expect.objectContaining({ votingStatus: 'closed' }),
        pollResultStatus: 'skipped',
      });
      expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should publish quote post without image and mark pollResultStatus as posted when closed with votes', async () => {
      (deps.firestore.getLatestPendingPoll as jest.Mock).mockResolvedValue({
        id: 'poll_doc_closed',
        tweetId: 'poll_tweet_closed_1',
        text: '夜ってみんな何して過ごす？',
        pollResultStatus: 'pending',
      });
      (deps.xApi.getTweetDetails as jest.Mock).mockResolvedValue({
        data: { id: 'poll_tweet_closed_1', text: '夜ってみんな何して過ごす？' },
        includes: {
          polls: [
            {
              id: 'poll_id_closed_1',
              durationMinutes: 1380,
              votingStatus: 'closed',
              options: [
                { position: 1, label: '🎮 ゲーム・アニメ', votes: 15 },
                { position: 2, label: '🍺 お酒・晩酌', votes: 5 },
              ],
            },
          ],
        },
      });
      (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'result_tweet_999' } });

      const result = await useCase.executePollResult();

      expect(result.status).toBe('success');
      expect(result.attachedMedia).toBe(false);
      expect(result.tweetId).toBe('result_tweet_999');

      expect(deps.gemini.generateStructuredTimelinePost).toHaveBeenCalledWith(
        expect.stringContaining(deps.persona.getBasePrompt('timeline', 'ja')),
        expect.stringContaining('1. 🎮 ゲーム・アニメ: 15票 (75%)\n2. 🍺 お酒・晩酌: 5票 (25%)'),
      );

      expect(deps.xApi.tweet).toHaveBeenCalledWith(
        expect.stringContaining('アンケ結果出たよ〜！'),
        {
          mediaIds: [],
          quote_tweet_id: 'poll_tweet_closed_1',
        },
      );

      expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'poll_result',
          tweetId: 'result_tweet_999',
        }),
      );

      expect(deps.firestore.updateTimelinePost).toHaveBeenLastCalledWith('poll_doc_closed', {
        poll: expect.objectContaining({ votingStatus: 'closed' }),
        pollResultStatus: 'posted',
        pollResultTweetId: 'result_tweet_999',
      });
    });
  });

  describe('PollController', () => {
    it('should suppress poll creation when active campaign guard triggers', async () => {
      const mockGuard = {
        shouldSuppressRoutinePost: jest.fn().mockResolvedValue({
          shouldSuppress: true,
          campaign: { id: 'camp_1', title: 'Test Campaign' },
        }),
      } as any;
      const controller = new PollController(useCase, mockGuard);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handleCreate(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'suppressed_by_campaign',
        campaignId: 'camp_1',
      });
    });

    it('should return 200 on handleResult success', async () => {
      (deps.firestore.getLatestPendingPoll as jest.Mock).mockResolvedValue(null);
      const controller = new PollController(useCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handleResult(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'skipped',
        reason: 'no_pending_poll',
      });
    });
  });
});
