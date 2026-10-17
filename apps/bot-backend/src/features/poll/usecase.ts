import { AppDependencies, PollData } from '../../types';
import { executePostPipeline } from '../../core/postPipeline';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { formatZonedDateTime, getZonedDateParts } from '../../utils/time';
import { logger } from '../../utils/logger';
import {
  POLL_CATEGORIES,
  PollCategory,
  PollUseCaseConfig,
  PollBatchResult,
} from './types';

const DEFAULT_POLL_DURATION_MINUTES = 1380; // 23 hours (Saturday 20:00 -> Sunday 19:00 JST)

/**
 * Deterministically selects a weekly poll theme category based on the date in the target timezone.
 *
 * @param date - The reference date.
 * @param timezone - IANA time zone identifier. Defaults to 'Asia/Tokyo'.
 * @returns The selected PollCategory for the week.
 */
export const getWeeklyPollCategory = (
  date: Date,
  timezone: string = 'Asia/Tokyo',
): PollCategory => {
  const { year, month, day } = getZonedDateParts(date, timezone);
  const utcDate = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const yearStart = Date.UTC(Number(year), 0, 1);
  const dayOfYear = Math.floor((utcDate - yearStart) / (24 * 60 * 60 * 1000));
  const weekIndex = Math.floor(dayOfYear / 7);
  return POLL_CATEGORIES[weekIndex % POLL_CATEGORIES.length];
};

/**
 * Orchestrates weekly X poll creation (Saturday night) and poll result commentary (Sunday night).
 */
export class PollUseCase {
  constructor(
    private readonly deps: AppDependencies,
    private readonly config: PollUseCaseConfig,
  ) {}

  /**
   * Generates and publishes a new Saturday night interactive poll post on X.
   */
  async executeCreatePoll(): Promise<PollBatchResult> {
    logger.info('[PollUseCase] Starting Weekly Poll Creation');
    try {
      const now = new Date();
      const category = getWeeklyPollCategory(now, this.config.timezone);
      const durationMinutes = this.config.durationMinutes ?? DEFAULT_POLL_DURATION_MINUTES;

      const [timelineSummary, extendedPrompt, recentPolls] = await Promise.all([
        this.deps.firestore.getTimelineSummary(),
        this.deps.firestore.getExtendedPrompt(),
        this.deps.firestore.getRecentTimelinePosts({ limit: 30, postType: 'poll' }),
      ]);

      const formattedPastPolls = (recentPolls || []).map((p) => {
        const timeStr = formatZonedDateTime(p.timestamp);
        const prefix = timeStr ? `[${timeStr}] ` : '';
        const optionsStr =
          p.poll?.options && p.poll.options.length > 0
            ? ` (選択肢: ${p.poll.options.map((o) => o.label).join(' / ')})`
            : '';
        return `${prefix}${p.text.replace(/\s+/g, ' ').trim()}${optionsStr}`;
      });

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【時間帯・シチュエーション】土曜の夜・フォロワーへの週末アンケート出題（テーマ: ${category}）`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const userCallsign = this.deps.persona.metadata.userCallsign.ja;
      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;

      const pollPrompt = `あなたはAIキャラクター「${personaName}」として、土曜の夜にX（Twitter）のフォロワー（${userCallsign}）と盛り上がるための「アンケート機能付きポスト」を1つ作成してください。

【今週のアンケート切り口テーマ】
${category}

【直近のタイムライン要約】
${timelineSummary || '（特記事項なし）'}

【拡張ペルソナ・近況】
${extendedPrompt || '（特記事項なし）'}

【過去に出題済みのアンケート履歴（直近最大30件）】
${formattedPastPolls.length > 0 ? formattedPastPolls.map((p, i) => `${i + 1}. ${p}`).join('\n') : '（過去のアンケート履歴なし）'}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【生成ルール】
- 【過去問との重複厳禁】: 上記【過去に出題済みのアンケート履歴】にある質問や選択肢の切り口と被らない、新鮮な問いかけにすること。
- 【思わず投票＆リプしたくなる設計】: 専門知識がなくても直感で1タップ投票でき、「自分はこれ！なぜなら〜」とリプライ欄で語りたくなる身近で楽しいテーマにすること。
- 【本文（reply）のルール】:
  - 土曜の夜らしいテンションで問いかけ、末尾に「選んだ理由もリプで教えて〜！」等のリプライ誘導を自然に入れること。
  - 本文は【絶対に110文字以内】に収めること。
  - 出力に文字数カウント表記や解説、引用符は含めないこと。
  ${defaultHashtag ? `- ハッシュタグ（${defaultHashtag} 等）はシステムが自動付与するため、本文中には含めないこと。` : ''}
- 【選択肢（options）のルール】:
  - 選択肢は **3個または4個** とすること。
  - X APIの仕様上、各選択肢は **絶対に15文字以内（最大でも25文字以内）** の簡潔でキャッチーな表現（絵文字1つ＋短いフレーズ等）にすること。
  - 最後の選択肢には、${personaName}らしいギャルっぽいユーモアや斜め上のオチ選択肢を1つ混ぜてもよい。
- 【思考（thought）のルール】:
  - なぜ今週このアンケートを聞いてみたいと思ったのか、${personaName}の内心思考を150文字以内で記述すること。`;

      const structuredPoll = await this.deps.gemini.generateStructuredPollPost(
        systemInstruction,
        pollPrompt,
      );

      let postText = structuredPoll.reply;
      const thought = structuredPoll.thought;
      const options = structuredPoll.options;

      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      const initialPollData: PollData = {
        options: options.map((label, idx) => ({
          position: idx + 1,
          label,
          votes: 0,
        })),
        durationMinutes,
        votingStatus: 'open',
      };

      logger.info('[PollUseCase] Generated Weekly Poll Post', { postText, options });

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'poll',
        text: postText,
        thought,
        attachImage: false,
        poll: {
          options,
          durationMinutes,
        },
        metadata: {
          pollData: initialPollData,
          pollResultStatus: 'pending',
        },
      });

      return {
        status: 'success',
        post: pipelineResult.post,
        attachedMedia: false,
        tweetId: pipelineResult.tweetId,
        options,
      };
    } catch (e) {
      logger.error('[PollUseCase] Error in executeCreatePoll', e);
      throw e;
    }
  }

  /**
   * Fetches the final results of the latest closed, unanswered poll and publishes a quote post reaction.
   */
  async executePollResult(): Promise<PollBatchResult> {
    logger.info('[PollUseCase] Starting Weekly Poll Result Reaction');
    try {
      const pendingPoll = await this.deps.firestore.getLatestPendingPoll();
      if (!pendingPoll || !pendingPoll.tweetId) {
        logger.info('[PollUseCase] No pending poll found to react to');
        return { status: 'skipped', reason: 'no_pending_poll' };
      }

      const tweetDetails = await this.deps.xApi.getTweetDetails(pendingPoll.tweetId);
      const latestPoll = tweetDetails.includes?.polls?.[0];

      if (!latestPoll || !Array.isArray(latestPoll.options) || latestPoll.options.length === 0) {
        logger.warn('[PollUseCase] Poll details not found in X API response', {
          tweetId: pendingPoll.tweetId,
        });
        return { status: 'skipped', reason: 'poll_details_unavailable' };
      }

      // Sync latest poll tally to Firestore
      await this.deps.firestore.updateTimelinePost(pendingPoll.id, {
        poll: latestPoll,
      });

      if (latestPoll.votingStatus !== 'closed') {
        logger.info('[PollUseCase] Poll is still open; skipping result post until closed', {
          tweetId: pendingPoll.tweetId,
          votingStatus: latestPoll.votingStatus,
        });
        return { status: 'skipped', reason: 'poll_still_open' };
      }

      const totalVotes = latestPoll.options.reduce((sum, opt) => sum + opt.votes, 0);
      if (totalVotes === 0) {
        logger.info('[PollUseCase] Poll closed with 0 total votes; marking as skipped', {
          tweetId: pendingPoll.tweetId,
        });
        await this.deps.firestore.updateTimelinePost(pendingPoll.id, {
          poll: latestPoll,
          pollResultStatus: 'skipped',
        });
        return { status: 'skipped', reason: 'zero_votes' };
      }

      const maxVotes = Math.max(...latestPoll.options.map((o) => o.votes));
      const winningOptions = latestPoll.options.filter((o) => o.votes === maxVotes);
      const formattedOptions = latestPoll.options
        .map((o) => {
          const pct = Math.round((o.votes / totalVotes) * 1000) / 10;
          const crown = o.votes === maxVotes ? '👑 ' : '';
          return `${o.position}. ${crown}${o.label}: ${o.votes}票 (${pct}%)`;
        })
        .join('\n');

      const [timelineSummary, extendedPrompt] = await Promise.all([
        this.deps.firestore.getTimelineSummary(),
        this.deps.firestore.getExtendedPrompt(),
      ]);

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【時間帯・シチュエーション】日曜の夜・昨日のアンケート結果発表と感想トーク`,
        `【アンケート内容】${pendingPoll.text}`,
        `【結果】1位: ${winningOptions.map((w) => w.label).join(' / ')}（総投票数: ${totalVotes}票）`,
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const userCallsign = this.deps.persona.metadata.userCallsign.ja;
      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;

      const resultPrompt = `あなたはAIキャラクター「${personaName}」として、土曜夜に出題したXアンケートの最終結果（日曜夜・集計終了）を見て、引用リポストで結果発表＆感想ポストを1つ作成してください。

【元のアンケート投稿文】
${pendingPoll.text}

【最終投票結果（合計 ${totalVotes}票）】
${formattedOptions}

【1位の選択肢】
${winningOptions.map((w) => w.label).join('、')}${winningOptions.length > 1 ? '（同率1位！）' : ''}

【直近のタイムライン要約】
${timelineSummary || '（特記事項なし）'}

【拡張ペルソナ・近況】
${extendedPrompt || '（特記事項なし）'}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【生成ルール】
- 投票してくれた${userCallsign}（フォロワー）への感謝やリアクションを入れつつ、1位になった選択肢（または票の割れ方・意外な結果）に対して、${personaName}自身の視点で納得・驚き・ツッコミなどの感想を語ること。
- 元のアンケートツイートを引用リポスト（Quote Post）する形で投稿されるため、結果の数字を機械的に全部読み上げるのではなく、結果を見た素直なリアクションと「みんなはどうだった？」という余韻のある語りかけにすること。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に110文字以内】にすること。
- 出力に文字数カウント表記や解説、引用符は絶対に含めないこと。
${defaultHashtag ? `- ハッシュタグ（${defaultHashtag} 等）はシステムが自動付与するため、本文中には絶対に含めないこと。` : ''}`;

      const structuredReaction = await this.deps.gemini.generateStructuredTimelinePost(
        systemInstruction,
        resultPrompt,
      );

      let postText = structuredReaction.reply;
      const thought = structuredReaction.thought;

      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      logger.info('[PollUseCase] Generated Poll Result Reaction Post', {
        pollTweetId: pendingPoll.tweetId,
        postText,
      });

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'poll_result',
        text: postText,
        thought,
        attachImage: false,
        quoteTweetId: pendingPoll.tweetId,
      });

      await this.deps.firestore.updateTimelinePost(pendingPoll.id, {
        poll: latestPoll,
        pollResultStatus: 'posted',
        ...(pipelineResult.tweetId ? { pollResultTweetId: pipelineResult.tweetId } : {}),
      });

      return {
        status: 'success',
        post: pipelineResult.post,
        attachedMedia: false,
        tweetId: pipelineResult.tweetId,
      };
    } catch (e) {
      logger.error('[PollUseCase] Error in executePollResult', e);
      throw e;
    }
  }
}
