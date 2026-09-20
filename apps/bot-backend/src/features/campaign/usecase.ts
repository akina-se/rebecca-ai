import { AppDependencies } from '../../types';
import { CampaignSlot, SlotTimePeriod } from '@rebecca/types';
import { CampaignPostResult } from './types';
import { getZonedDateParts } from '../../utils/time';
import { downloadImage } from '../../utils/image';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';

/**
 * Configuration for the CampaignPostUseCase.
 */
export interface CampaignPostUseCaseConfig {
  timezone: string;
}

/**
 * Maps the current clock hour (0-23) to a canonical SlotTimePeriod.
 *
 * @param hour - The hour of day in 24-hour format.
 * @returns The corresponding SlotTimePeriod.
 */
export const mapHourToTimePeriod = (hour: number): SlotTimePeriod => {
  if (hour >= 5 && hour < 11) {
    return 'morning';
  } else if (hour >= 11 && hour < 15) {
    return 'afternoon';
  } else if (hour >= 15 && hour < 19) {
    return 'evening';
  } else {
    return 'night';
  }
};

/**
 * Orchestrates the execution of a scheduled campaign narrative post.
 * Matches current time to an active campaign's itinerary slot, generates
 * story-aligned content, attaches isolated media if configured, and publishes to X.
 */
export class CampaignPostUseCase {
  constructor(
    private readonly deps: AppDependencies,
    private readonly config: CampaignPostUseCaseConfig,
  ) {}

  /**
   * Executes the campaign slot post workflow.
   *
   * @returns A Promise resolving to the CampaignPostResult.
   */
  async execute(): Promise<CampaignPostResult> {
    console.log('[CampaignPostUseCase] Starting Narrative Event Campaign Slot Execution...');

    const campaign = await this.deps.firestore.getActiveCampaign();
    if (!campaign || campaign.isPaused) {
      console.log('[CampaignPostUseCase] No active campaign running or campaign is paused.');
      return {
        status: 'no_active_campaign',
        reason: 'No active campaign found or campaign is paused.',
      };
    }

    const { year, month, day, numericHour } = getZonedDateParts(new Date(), this.config.timezone);
    const todayStr = `${year}-${month}-${day}`;

    // Calculate current day index relative to campaign start
    const startTime = new Date(`${campaign.startDate}T00:00:00Z`).getTime();
    const currentTime = new Date(`${todayStr}T00:00:00Z`).getTime();
    const dayNumber = Math.floor((currentTime - startTime) / (1000 * 60 * 60 * 24)) + 1;

    if (dayNumber < 1 || todayStr > campaign.endDate) {
      console.log(`[CampaignPostUseCase] Current date ${todayStr} is outside campaign bounds (${campaign.startDate} to ${campaign.endDate}).`);
      return {
        status: 'skipped',
        reason: `Current date ${todayStr} is outside campaign window.`,
      };
    }

    const currentPeriod = mapHourToTimePeriod(numericHour);

    // Find the pending slot for today matching the current period strictly
    const pendingSlotsForToday = campaign.slots.filter(
      (s: CampaignSlot) => s.dayNumber === dayNumber && s.status === 'pending',
    );

    if (pendingSlotsForToday.length === 0) {
      console.log(`[CampaignPostUseCase] No pending slots found for Day ${dayNumber} (${todayStr}).`);
      return {
        status: 'no_pending_slot',
        reason: `No pending slots found for Day ${dayNumber}.`,
      };
    }

    // Find matching pending slot:
    // Priority 1: Match exact hour from scheduledTime (handles 1-hour granular slots)
    // Priority 2: Fallback to canonical timePeriod matching for full backward compatibility
    const targetSlot =
      pendingSlotsForToday.find((s) => {
        if (s.scheduledTime) {
          const timePart = s.scheduledTime.includes('T')
            ? s.scheduledTime.split('T')[1]
            : s.scheduledTime;
          const [hStr] = timePart.split(':');
          const slotHour = parseInt(hStr, 10);
          if (!isNaN(slotHour) && slotHour === numericHour) {
            return true;
          }
        }
        return false;
      }) ?? pendingSlotsForToday.find((s) => s.timePeriod === currentPeriod);

    if (!targetSlot) {
      console.log(`[CampaignPostUseCase] No pending slot configured for hour ${numericHour} (period "${currentPeriod}") on Day ${dayNumber}. Skipping.`);
      return {
        status: 'skipped',
        reason: `No pending slot configured for period "${currentPeriod}" on Day ${dayNumber}.`,
      };
    }

    console.log(`[CampaignPostUseCase] Target slot matched: ID=${targetSlot.slotId}, Day=${targetSlot.dayNumber}, Period=${targetSlot.timePeriod}, Theme="${targetSlot.theme}"`);

    let postText: string;
    let thought: string;

    try {
      if (targetSlot.fixedTextOverride && targetSlot.fixedTextOverride.trim()) {
        postText = targetSlot.fixedTextOverride.trim();
        thought = 'Pre-defined narrative script for campaign slot.';
      } else {
        const personaName = this.deps.persona.metadata.displayName;
        const userCallsign = this.deps.persona.metadata.userCallsign.ja;
        const defaultHashtag = this.deps.persona.metadata.defaultHashtag;

        const timelineSummary = await this.deps.firestore.getTimelineSummary();
        const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

        const personaFewShotPrompt = await resolveSituationalPersonaAnchors(
          this.deps.gemini,
          [
            `【イベント・ストーリー設定】${campaign.masterContext}`,
            `【本日のテーマ】${targetSlot.theme}`,
            `【時間帯】${targetSlot.timePeriod}`,
            targetSlot.captionPromptHint && targetSlot.captionPromptHint.trim()
              ? `【演出ヒント】${targetSlot.captionPromptHint.trim()}`
              : '',
            extendedPrompt ? `【拡張ペルソナ・近況】${extendedPrompt}` : '',
            timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
          ].filter(Boolean),
          'ja',
          3,
        );

        const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
        const captionHintText = targetSlot.captionPromptHint && targetSlot.captionPromptHint.trim()
          ? targetSlot.captionPromptHint.trim()
          : '（特記事項なし）';
        const campaignPrompt = `あなたはAIキャラクター「${personaName}」として、現在実施中の特別ストーリー（イベント・キャンペーン）に沿ったX（Twitter）のポストを1つ作成してください。

【特別ストーリー設定（Master Context）】
${campaign.masterContext}

【本日の旅程・タイムスロット情報】
- キャンペーン進行: Day ${targetSlot.dayNumber}（${todayStr}）
- 時間帯: ${targetSlot.timePeriod}
- このスロットのテーマ: ${targetSlot.theme}
- 描写・演出ヒント: ${captionHintText}
${targetSlot.mediaUrl ? '- 本投稿にはイラスト写真が添付されます。写真に写っている情景を自然に共有するトーンで語りかけてください。' : '- 本投稿はテキストのみのつぶやきです。'}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【生成ルール】
- Master Contextの世界観と現在のスロットのテーマを自然に織り込み、生き生きとした実況感や日常の体験を${userCallsign}（ユーザー）に伝えてください。
- 一方的な報告にならず、${personaName}らしい親しみやすい語りかけや問いかけを交えてください。
- thought（内省思考）は150文字以内の自然な独白としてください。
- reply（ツイート本文）は【絶対に100文字以内の短文】にしてください。
- ハッシュタグはシステムが自動付与するため、本文中には絶対に含めないでください。`;

        const structuredPost = await this.deps.gemini.generateStructuredTimelinePost(
          systemInstruction,
          campaignPrompt,
        );
        postText = structuredPost.reply;
        thought = structuredPost.thought;

        if (defaultHashtag) {
          const hashtag = `\n${defaultHashtag}`;
          if (postText.length + hashtag.length <= 140) {
            postText += hashtag;
          }
        }
      }

      console.log(`[CampaignPostUseCase] Generated text for slot ${targetSlot.slotId}: "${postText}"`);

      // Handle media attachment if mediaUrl is provided (Strict Asset Segregation: isolated event illustration)
      const mediaIds: string[] = [];
      if (targetSlot.mediaUrl) {
        try {
          const { buffer, mimeType } = await downloadImage(targetSlot.mediaUrl);
          const uploadedMediaId = await this.deps.xApi.uploadMedia(buffer, mimeType);
          if (uploadedMediaId) {
            mediaIds.push(uploadedMediaId);
          }
        } catch (mediaErr) {
          console.error(`[CampaignPostUseCase] Failed to download or upload campaign media (${targetSlot.mediaUrl}):`, mediaErr);
          throw mediaErr;
        }
      }

      // Publish tweet to X
      const tweetResponse = await this.deps.xApi.tweet(postText, {
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      });
      const tweetId = tweetResponse.data?.id;

      // Record to timeline history
      await this.deps.firestore.saveTimelinePost({
        text: postText,
        thought,
        mediaUrls: targetSlot.mediaUrl ? [targetSlot.mediaUrl] : [],
        tweetId,
        postType: 'campaign',
      });

      // Update slot state and campaign progress in Firestore
      targetSlot.status = 'posted';
      targetSlot.postedTweetId = tweetId;
      targetSlot.postedAt = new Date().toISOString();

      const completedSlotsCount = campaign.slots.filter((s) => s.status === 'posted').length;
      const allSlotsFinished = campaign.slots.every(
        (s) => s.status === 'posted' || s.status === 'skipped',
      );
      const newStatus = allSlotsFinished ? 'completed' : campaign.status;

      if (campaign.id) {
        await this.deps.firestore.updateCampaign(campaign.id, {
          slots: campaign.slots,
          completedSlotsCount,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`[CampaignPostUseCase] Successfully posted slot ${targetSlot.slotId} (Tweet ID: ${tweetId})`);

      return {
        status: 'success',
        slotId: targetSlot.slotId,
        dayNumber: targetSlot.dayNumber,
        timePeriod: targetSlot.timePeriod,
        tweetId,
        post: postText,
        attachedMedia: mediaIds.length > 0,
      };
    } catch (err: unknown) {
      console.error(`[CampaignPostUseCase] Failed to post campaign slot ${targetSlot.slotId}:`, err);
      // Mark slot as failed in Firestore for dashboard visibility
      targetSlot.status = 'failed';
      targetSlot.errorReason = err instanceof Error ? err.message : 'Unknown error occurred during posting';
      if (campaign.id) {
        try {
          await this.deps.firestore.updateCampaign(campaign.id, {
            slots: campaign.slots,
            updatedAt: new Date().toISOString(),
          });
        } catch (updateErr) {
          console.error('[CampaignPostUseCase] Failed to persist slot failure status:', updateErr);
        }
      }
      // Re-throw so Cloud Scheduler registers a failure and can retry (Fail-Loudly)
      throw err;
    }
  }
}
