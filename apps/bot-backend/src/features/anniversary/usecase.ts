import { AppDependencies } from '../../types';
import { executePostPipeline } from '../../core/postPipeline';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { IAnniversaryProvider, AnniversaryItem, AnniversaryResult } from './types';

export * from './types';

/**
 * Executes a batch job to proactively post about today's memorial days / anniversaries ("◯◯の日").
 *
 * It queries an IAnniversaryProvider for the current date in the application timezone,
 * generates a persona-grounded post, and publishes it via PostPipeline.
 * If no valid anniversaries are retrieved, it returns a skipped status.
 */
export class ProactiveAnniversaryUseCase {
  /**
   * Initializes the ProactiveAnniversaryUseCase.
   *
   * @param deps Application dependencies.
   * @param anniversaryProvider Provider satisfying the IAnniversaryProvider contract.
   */
  constructor(
    private readonly deps: AppDependencies,
    private readonly anniversaryProvider: IAnniversaryProvider,
  ) {}

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
        console.log('[ProactiveAnniversaryUseCase] No anniversaries found for today.');
        return { status: 'skipped', reason: 'no_anniversaries' };
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

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const anniversaryPrompt = `以下の【今日の記念日・年中行事】の一覧から、AIキャラクター「${personaName}」として共感・盛り上がりそうな話題（カルチャー、食、日常、音楽、記念日など）を【1つだけ】選び、それに言及しながらタイムライン向けの自発的ツイートを生成してください。

【今日の記念日・年中行事】
${candidateListText}
${timelineSummary ? `\n【直近のタイムライン要約】\n${timelineSummary}\n` : ''}
${extendedPrompt ? `\n【拡張ペルソナ・近況】\n${extendedPrompt}\n` : ''}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【追加ルール】
- 戦争・紛争・追悼や過度に暗い記念日は絶対に選ばないこと。日常的で明るい話題や親しみやすい記念日を選んでください。
- 特定の個人への返信ではなく、タイムライン全体のフォロワーに向けたオープンな語りかけとすること。
- 「今日は◯◯の日なんだって！」「◯◯の日だし〜」のように、選んだ記念日名を自然に会話に盛り込んでください。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。`;

      const structuredPost = await this.deps.gemini.generateStructuredNewsPost(systemInstruction, anniversaryPrompt);
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;

      if (!postText) {
        console.log('[ProactiveAnniversaryUseCase] Failed to generate anniversary post.');
        return { status: 'skipped', reason: 'generation_failed' };
      }

      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;
      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      console.log('[ProactiveAnniversaryUseCase] Generated Post:', postText);

      // Identify which anniversary name was referenced
      const matchedItem = anniversaries.find((a) => postText.includes(a.name));
      const anniversaryTitle = matchedItem ? matchedItem.name : undefined;

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'anniversary',
        text: postText,
        thought,
        imageContext: matchedItem
          ? `記念日: ${matchedItem.name}\n内容: ${matchedItem.description}\nタイムライン状況: ${timelineSummary}`
          : `タイムライン状況: ${timelineSummary}`,
        metadata: {
          anniversaryTitle,
        },
      });

      return {
        status: 'success',
        post: pipelineResult.post,
        attachedMedia: pipelineResult.attachedMedia,
        ...(anniversaryTitle ? { anniversaryTitle } : {}),
      };
    } catch (error) {
      console.error('[ProactiveAnniversaryUseCase] Unexpected error during execution:', error);
      throw error;
    }
  }
}
