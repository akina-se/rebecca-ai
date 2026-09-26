import { AppDependencies } from '../../types';
import { CampaignSlot, SlotTimePeriod } from '@rebecca/types';
import { CampaignPostResult } from './types';
import { getZonedDateParts } from '../../utils/time';
import { downloadImage } from '../../utils/image';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { logger } from '../../utils/logger';

/**
 * Configuration for the CampaignPostUseCase.
 */
export interface CampaignPostUseCaseConfig {
  timezone: string;
  bucketName: string;
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
  ) {
    if (!config.timezone || !config.timezone.trim()) {
      throw new Error('[CampaignPostUseCase] Invariant violation: config.timezone is required.');
    }
    if (!config.bucketName || !config.bucketName.trim()) {
      throw new Error('[CampaignPostUseCase] Invariant violation: config.bucketName is required.');
    }
  }

  /**
   * Executes the campaign slot post workflow.
   *
   * @returns A Promise resolving to the CampaignPostResult.
   */
  async execute(): Promise<CampaignPostResult> {
    logger.info('[CampaignPostUseCase] Starting Narrative Event Campaign Slot Execution');

    let campaign = await this.deps.firestore.getActiveCampaign();
    if (!campaign) {
      const scheduledCampaign = await this.deps.firestore.getScheduledCampaignDueToday();
      if (scheduledCampaign && !scheduledCampaign.isPaused) {
        campaign = scheduledCampaign;
      }
    }

    if (!campaign || campaign.isPaused) {
      logger.info('[CampaignPostUseCase] No active or scheduled campaign ready for today, or campaign is paused');
      return {
        status: 'no_active_campaign',
        reason: 'No active or scheduled campaign found or campaign is paused.',
      };
    }

    const { year, month, day } = getZonedDateParts(new Date(), this.config.timezone);
    const todayStr = `${year}-${month}-${day}`;

    // Calculate current day index relative to campaign start
    const startTime = new Date(`${campaign.startDate}T00:00:00Z`).getTime();
    const currentTime = new Date(`${todayStr}T00:00:00Z`).getTime();
    const dayNumber = Math.floor((currentTime - startTime) / (1000 * 60 * 60 * 24)) + 1;

    if (dayNumber < 1 || todayStr > campaign.endDate) {
      logger.info('[CampaignPostUseCase] Current date is outside campaign bounds', {
        today: todayStr,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      });
      return {
        status: 'skipped',
        reason: `Current date ${todayStr} is outside campaign window.`,
      };
    }

    // Find the pending slots for today
    const pendingSlotsForToday = campaign.slots.filter(
      (s: CampaignSlot) => s.dayNumber === dayNumber && s.status === 'pending',
    );

    if (pendingSlotsForToday.length === 0) {
      logger.info('[CampaignPostUseCase] No pending slots found for Day', {
        dayNumber,
        today: todayStr,
      });
      return {
        status: 'no_pending_slot',
        reason: `No pending slots found for Day ${dayNumber}.`,
      };
    }

    const now = new Date();
    const nowTime = now.getTime();

    // Match pending slot scheduled within current hourly execution window (within 30 minutes of scheduler trigger)
    const targetSlot = pendingSlotsForToday.find((s) => {
      const slotTime = new Date(s.scheduledTime).getTime();
      if (isNaN(slotTime)) {
        throw new Error(`Invalid scheduledTime for slot ${s.slotId}: "${s.scheduledTime}". Expected valid ISO8601 string.`);
      }
      return Math.abs(nowTime - slotTime) <= 30 * 60 * 1000;
    });

    if (!targetSlot) {
      logger.info('[CampaignPostUseCase] No pending slot scheduled for current execution window on Day. Skipping', {
        now: now.toISOString(),
        dayNumber,
      });
      return {
        status: 'skipped',
        reason: `No pending slot scheduled for current execution window on Day ${dayNumber}.`,
      };
    }

    // Auto-activate scheduled campaign upon executing its first matched slot
    if (campaign.status === 'scheduled') {
      logger.info('[CampaignPostUseCase] Auto-activating scheduled campaign at first slot post', {
        title: campaign.title,
        campaignId: campaign.id,
      });
      campaign.status = 'active';
      if (campaign.id) {
        await this.deps.firestore.updateCampaign(campaign.id, {
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    logger.info('[CampaignPostUseCase] Target slot matched', {
      slotId: targetSlot.slotId,
      dayNumber: targetSlot.dayNumber,
      timePeriod: targetSlot.timePeriod,
      theme: targetSlot.theme,
    });

    let postText: string;
    let thought: string;

    const defaultHashtag = this.deps.persona.metadata.defaultHashtag;
    const campaignHashtag = campaign.hashtag ? `#${campaign.hashtag.replace(/^#+/, '').trim()}` : '';
    const hashtagsList = [campaignHashtag, defaultHashtag].filter(Boolean);
    const hashtagsBlock = hashtagsList.length > 0 ? `\n${hashtagsList.join(' ')}` : '';

    try {
      if (targetSlot.isFixedText) {
        if (!targetSlot.fixedTextOverride || !targetSlot.fixedTextOverride.trim()) {
          throw new Error(`Slot ${targetSlot.slotId} is configured for fixed text but fixedTextOverride is empty.`);
        }
        postText = targetSlot.fixedTextOverride.trim();
        thought = 'Pre-defined narrative script for campaign slot.';
        if (campaignHashtag && !postText.includes(campaignHashtag)) {
          if (postText.length + `\n${campaignHashtag}`.length <= 140) {
            postText += `\n${campaignHashtag}`;
          }
        }
      } else {
        const personaName = this.deps.persona.metadata.displayName;
        const userCallsign = this.deps.persona.metadata.userCallsign.ja;

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

        // Calculate max body characters so body + hashtags strictly stay within 140 chars
        const maxBodyChars = Math.min(100, 140 - hashtagsBlock.length);

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
- reply（ツイート本文）は【絶対に${maxBodyChars}文字以内の短文】にしてください。
- ハッシュタグはシステムが自動付与するため、本文中には絶対に含めないでください。`;

        const structuredPost = await this.deps.gemini.generateStructuredTimelinePost(
          systemInstruction,
          campaignPrompt,
        );
        postText = structuredPost.reply;
        thought = structuredPost.thought;

        if (hashtagsBlock && postText.length + hashtagsBlock.length <= 140) {
          postText += hashtagsBlock;
        }
      }

      logger.info('[CampaignPostUseCase] Generated text for slot', {
        slotId: targetSlot.slotId,
        postText,
      });

      // Handle media attachment if mediaUrl is provided (Strict Asset Segregation: isolated event illustration)
      const mediaIds: string[] = [];
      if (targetSlot.mediaUrl) {
        try {
          const { buffer, mimeType } = await this.fetchSlotMedia(targetSlot.mediaUrl);
          const uploadedMediaId = await this.deps.xApi.uploadMedia(buffer, mimeType);
          if (uploadedMediaId) {
            mediaIds.push(uploadedMediaId);
          }
        } catch (mediaErr) {
          logger.error('[CampaignPostUseCase] Failed to download or upload campaign media', mediaErr, {
            mediaUrl: targetSlot.mediaUrl,
          });
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

      logger.info('[CampaignPostUseCase] Successfully posted slot', {
        slotId: targetSlot.slotId,
        tweetId,
      });

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
      logger.error('[CampaignPostUseCase] Failed to post campaign slot', err, {
        slotId: targetSlot.slotId,
      });
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
          logger.error('[CampaignPostUseCase] Failed to persist slot failure status', updateErr);
        }
      }
      // Re-throw so Cloud Scheduler registers a failure and can retry (Fail-Loudly)
      throw err;
    }
  }

  private static readonly ALLOWED_IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  /**
   * Downloads and infers MIME type for a slot media attachment.
   * Resolves direct GCS URIs (gs://...), relative campaign asset proxy URLs (/api/v1/campaigns/:id/assets/:filename),
   * and absolute HTTPS URLs.
   *
   * @param mediaUrl - Image path or URL configured on the slot.
   * @returns Buffer and verified MIME type.
   */
  private async fetchSlotMedia(mediaUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const trimmed = mediaUrl.trim();
    if (!trimmed) {
      throw new Error('[CampaignPostUseCase] Empty mediaUrl provided.');
    }

    // Direct Cloud Storage URI (gs://...)
    if (trimmed.startsWith('gs://')) {
      const buffer = await this.deps.storage.downloadImage(trimmed);
      const mimeType = this.resolveImageMimeType(trimmed);
      return { buffer, mimeType };
    }

    // Relative campaign asset proxy path: /api/v1/campaigns/:campaignId/assets/:filename or /api/campaigns/...
    const campaignAssetMatch = trimmed.match(
      /^(?:\/api\/v1|\/api)?\/campaigns\/([a-zA-Z0-9_.-]+)\/assets\/([a-zA-Z0-9_.-]+)$/,
    );
    if (campaignAssetMatch) {
      const campaignId = campaignAssetMatch[1];
      const filename = campaignAssetMatch[2];
      const gsUri = `gs://${this.config.bucketName}/campaigns/${campaignId}/${filename}`;
      const buffer = await this.deps.storage.downloadImage(gsUri);
      const mimeType = this.resolveImageMimeType(filename);
      return { buffer, mimeType };
    }

    // Absolute HTTPS URL (strict RFC validation via URL constructor)
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol !== 'https:') {
        throw new Error(
          `[CampaignPostUseCase] Insecure protocol "${parsedUrl.protocol}" in mediaUrl: "${trimmed}". Only https:// is permitted.`,
        );
      }
      return await downloadImage(parsedUrl.href);
    } catch (urlErr) {
      if (urlErr instanceof Error && urlErr.message.startsWith('[CampaignPostUseCase]')) {
        throw urlErr;
      }
      throw new Error(
        `[CampaignPostUseCase] Unsupported or malformed mediaUrl: "${mediaUrl}". Expected gs:// URI, campaign asset path, or https:// URL.`,
        { cause: urlErr },
      );
    }
  }

  private resolveImageMimeType(pathOrFilename: string): string {
    const clean = pathOrFilename.split('?')[0].split('#')[0].trim();
    const ext = clean.split('.').pop()?.toLowerCase();
    if (!ext || !CampaignPostUseCase.ALLOWED_IMAGE_EXTENSIONS[ext]) {
      throw new Error(
        `[CampaignPostUseCase] Unsupported media extension in "${pathOrFilename}". Allowed extensions: ${Object.keys(CampaignPostUseCase.ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
      );
    }
    return CampaignPostUseCase.ALLOWED_IMAGE_EXTENSIONS[ext];
  }
}
