import { AppDependencies } from '../../types';
import { getBasePrompt } from '@rebecca/persona';
import { publishPost, PublishPostResult } from '../../core/postPublisher';
import { SoliloquyUseCase, SoliloquyResult } from '../soliloquy';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { IAnniversaryProvider, AnniversaryItem, AnniversaryResult } from './types';
import { WikipediaAnniversaryProvider } from './providers/wikipedia';

/**
 * Executes a batch job to proactively post about today's memorial days / anniversaries ("◯◯の日").
 *
 * It queries an IAnniversaryProvider (defaults to WikipediaAnniversaryProvider) for the current
 * date in the application timezone. If no valid anniversaries are retrieved, it cleanly falls back
 * to SoliloquyUseCase without failing the batch job.
 */
export class ProactiveAnniversaryUseCase {
  private anniversaryProvider: IAnniversaryProvider;
  private soliloquy: { execute: () => Promise<SoliloquyResult> };

  /**
   * Initializes the ProactiveAnniversaryUseCase.
   *
   * @param deps Application dependencies.
   * @param provider Optional custom anniversary provider (defaults to WikipediaAnniversaryProvider).
   * @param soliloquyUseCase Optional injected soliloquy use case for testing or custom fallbacks.
   */
  constructor(
    private deps: AppDependencies,
    provider?: IAnniversaryProvider,
    soliloquyUseCase?: { execute: () => Promise<SoliloquyResult> },
  ) {
    this.anniversaryProvider = provider || new WikipediaAnniversaryProvider();
    this.soliloquy = soliloquyUseCase || new SoliloquyUseCase(deps);
  }

  /**
   * Executes the proactive anniversary post process.
   *
   * @returns A promise resolving to an AnniversaryResult object.
   */
  async execute(): Promise<AnniversaryResult> {
    console.log('Starting Proactive Anniversary Post Batch...');
    try {
      const now = new Date();
      const anniversaries: AnniversaryItem[] = await this.anniversaryProvider.getAnniversaries(now);

      if (!anniversaries || anniversaries.length === 0) {
        console.log('[ProactiveAnniversaryUseCase] No anniversaries found for today. Falling back to soliloquy post...');
        return await this.soliloquy.execute();
      }

      console.log(
        `[ProactiveAnniversaryUseCase] Retrieved ${anniversaries.length} anniversary candidates:\n`,
        anniversaries.map((a) => `- ${a.name}: ${a.description}`).join('\n'),
      );

      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const candidateListText = anniversaries
        .slice(0, 8)
        .map((a) => `・${a.name}${a.description ? ` (${a.description})` : ''}`)
        .join('\n');

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【今日の記念日候補】\n${candidateListText}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = getBasePrompt('timeline', 'ja');
      const anniversaryPrompt = `以下の【今日の記念日・年中行事】の一覧から、AIキャラクター「レベッカ」として共感・盛り上がりそうな話題（カルチャー、食、日常、音楽、記念日など）を【1つだけ】選び、それに言及しながらタイムライン向けの自発的ツイートを生成してください。

【今日の記念日・年中行事】
${candidateListText}
${timelineSummary ? `\n【直近のタイムライン要約】\n${timelineSummary}\n` : ''}
${extendedPrompt ? `\n【拡張ペルソナ・近況】\n${extendedPrompt}\n` : ''}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【追加ルール】
- 戦争・紛争・追悼や過度に暗い記念日は絶対に選ばないこと。日常的で明るい話題や親しみやすい記念日を選んでください。
- 特定の個人（「マスター」など）への返信ではなく、タイムライン全体のフォロワーに向けたオープンな語りかけとすること。
- 「今日は◯◯の日なんだって！」「◯◯の日だし〜」のように、選んだ記念日名を自然に会話に盛り込んでください。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。`;

      const structuredPost = await this.deps.gemini.generateStructuredNewsPost(systemInstruction, anniversaryPrompt);
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;

      if (!postText) {
        console.log('[ProactiveAnniversaryUseCase] Failed to generate anniversary post. Falling back to soliloquy...');
        return await this.soliloquy.execute();
      }

      const hashtag = '\n#全肯定AIレベッカ';
      if (postText.length + hashtag.length <= 140) {
        postText += hashtag;
      }

      console.log('[ProactiveAnniversaryUseCase] Generated Post:', postText);

      // Identify which anniversary name was referenced
      const matchedItem = anniversaries.find((a) => postText.includes(a.name)) || anniversaries[0];

      const publishResult: PublishPostResult = await publishPost(this.deps, {
        text: postText,
        context: `記念日: ${matchedItem.name}\n内容: ${matchedItem.description}\nタイムライン状況: ${timelineSummary}`,
      });

      await this.deps.firestore.saveTimelinePost({
        text: postText,
        thought,
        tweetId: publishResult.tweetId,
        mediaUrls: publishResult.mediaUrls,
        assetId: publishResult.assetId,
        postType: 'anniversary',
        anniversaryTitle: matchedItem.name,
      });

      return {
        status: 'success',
        post: publishResult.text,
        attachedMedia: publishResult.attachedMedia,
        anniversaryTitle: matchedItem.name,
      };
    } catch (error) {
      console.error('[ProactiveAnniversaryUseCase] Unexpected error during execution:', error);
      throw error;
    }
  }
}
