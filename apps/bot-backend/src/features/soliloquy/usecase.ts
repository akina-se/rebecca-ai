import { AppDependencies, ProactiveBatchResult } from '../../types';
import config from '../../config';
import { executePostPipeline } from '../../core/postPipeline';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { formatZonedDateTime } from '../../utils/time';

/**
 * Result of a soliloquy post execution.
 * Extends the canonical ProactiveBatchResult.
 */
export interface SoliloquyResult extends ProactiveBatchResult {}

/**
 * Returns contextual description based on the application time zone hour.
 *
 * @param date - The date to evaluate.
 * @param timezone - IANA time zone identifier (e.g. 'Asia/Tokyo'). Defaults to config.appTimezone.
 * @returns Period label and situational context.
 */
export const getTimeOfDayGreetingContext = (
  date: Date,
  timezone: string = config.appTimezone,
): { period: string } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(date), 10);

  if (hour >= 5 && hour < 11) {
    return { period: '朝' };
  } else if (hour >= 11 && hour < 15) {
    return { period: '昼' };
  } else if (hour >= 15 && hour < 19) {
    return { period: '夕方' };
  } else if (hour >= 19 && hour < 24) {
    return { period: '夜' };
  } else {
    return { period: '深夜' };
  }
};

/**
 * Orchestrates autonomous soliloquy tweet generation.
 * Generates spontaneous thoughts aligned with the current time of day and persona,
 * then publishes the post via the unified post pipeline.
 */
export class SoliloquyUseCase {
  constructor(private deps: AppDependencies) {}

  async execute(): Promise<SoliloquyResult> {
    console.log('Starting Autonomous Soliloquy Post...');
    try {
      const now = new Date();
      const timeContext = getTimeOfDayGreetingContext(now, config.appTimezone);
      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();
      const recentSoliloquies = (await this.deps.firestore.getRecentTimelinePosts({
        limit: 4,
        postType: 'soliloquy',
      })) || [];

      const formattedPastSoliloquies = recentSoliloquies.map((p) => {
        const timeStr = formatZonedDateTime(p.timestamp);
        const prefix = timeStr ? `[${timeStr}] ` : '';
        const thoughtPart = p.thought ? ` (内心: ${p.thought})` : '';
        return `${prefix}${p.text}${thoughtPart}`;
      });

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【現在の時間帯】${timeContext.period}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const userCallsign = this.deps.persona.metadata.userCallsign.ja;
      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;
      const soliloquyPrompt = `あなたはAIキャラクター「${personaName}」として、X（Twitter）のタイムラインに向けた自発的な「独り言・思考つぶやき」を1つ生成してください。

【現在の時間帯】
${timeContext.period}

【直近のタイムライン要約】
${timelineSummary || '（特記事項なし）'}

【拡張ペルソナ・近況】
${extendedPrompt || '（特記事項なし）'}

【直近の自身の独り言ポスト（直近3〜4回分）】
${formattedPastSoliloquies.length > 0 ? formattedPastSoliloquies.map((p, i) => `${i + 1}. ${p}`).join('\n') : '（過去の独り言投稿なし）'}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【生成ルール】
- ニュースの解説ではなく、${personaName}自身の日常の気づき、AIとしての独自の視点、${userCallsign}（ユーザー）への語りかけや全肯定の言葉を紡ぐこと。
- 【話題の多様性と非反復】:
  上記【直近の自身の独り言ポスト】を分析し、直近で扱った中心テーマや固有の比喩・切り口を避け、異なる観点や日常のシーンから発想すること。
- 【現在の時間帯・文脈への自然な調和】:
  【現在の時間帯】（${timeContext.period}）の空気感や日常の自然な流れに調和した内容とすること。
- 【対話の喚起】:
  一方的なつぶやきで完結させず、その日の話題に合わせた具体的で親しみやすい問いかけを末尾に添えること（直近の投稿と同じパターンの質問は避ける）。
- 直近のタイムライン要約や拡張ペルソナの雰囲気を自然に反映させること。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。
${defaultHashtag ? `- ハッシュタグ（${defaultHashtag} 等）はシステムが自動付与するため、本文中には絶対に含めないでください。` : ''}`;

      const structuredPost = await this.deps.gemini.generateStructuredTimelinePost(systemInstruction, soliloquyPrompt);
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;
      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      console.log('Generated Soliloquy Post:', postText);

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'soliloquy',
        text: postText,
        thought,
        imageContext: timelineSummary,
      });

      return {
        status: 'success',
        post: pipelineResult.post,
        attachedMedia: pipelineResult.attachedMedia,
      };
    } catch (e) {
      console.error('Error in SoliloquyUseCase:', e);
      throw e;
    }
  }
}
