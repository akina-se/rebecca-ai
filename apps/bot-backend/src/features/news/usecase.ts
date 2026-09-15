import { AppDependencies } from '../../types';
import { executePostPipeline } from '../../core/postPipeline';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { INewsProvider, NewsResult, NewsUseCaseConfig } from './types';
import { filterFreshNews } from './deduplicator';

export * from './types';
export * from './deduplicator';
export * from './providers/geminiSearch';

/**
 * Executes a batch job to proactively post a news-related tweet.
 *
 * Retrieves headlines via an injected INewsProvider,
 * filters out recent duplicates using vector cosine similarity, generates a persona-grounded
 * post, and delivers it via the unified PostPipeline.
 *
 * If no fresh headlines are available, it returns a skipped status without coupling to fallback logic.
 */
export class ProactiveNewsUseCase {
  /**
   * Initializes the ProactiveNewsUseCase.
   *
   * @param deps Injected application dependencies.
   * @param newsProvider Injected news provider implementation.
   * @param config Injected news usecase configuration.
   */
  constructor(
    private readonly deps: AppDependencies,
    private readonly newsProvider: INewsProvider,
    private readonly config: NewsUseCaseConfig,
  ) {}

  /**
   * Executes the proactive news post process.
   *
   * @returns A promise resolving to a NewsResult object.
   */
  async execute(): Promise<NewsResult> {
    console.log('Starting Proactive News Post Batch...');
    try {
      const rawNewsItems = await this.newsProvider.getNews();

      if (rawNewsItems.length === 0) {
        console.log('[ProactiveNewsUseCase] No news items fetched.');
        return { status: 'skipped', reason: 'no_headlines' };
      }

      console.log('[ProactiveNewsUseCase] Fetched news items count:', rawNewsItems.length);

      const candidateNews = await filterFreshNews(
        this.deps,
        rawNewsItems,
        this.config.dedupLookbackDays,
        this.config.dedupSimilarityThreshold,
      );

      if (candidateNews.length === 0) {
        console.log('[ProactiveNewsUseCase] All candidate headlines were duplicates of recent posts.');
        return { status: 'skipped', reason: 'all_duplicates' };
      }

      const freshHeadlineTexts = candidateNews.map((c) => c.headline);
      console.log('[ProactiveNewsUseCase] Fresh non-duplicate headlines:\n', freshHeadlineTexts.join('\n'));

      const formattedNewsContext = candidateNews
        .map((c) => `・【${c.item.category}】${c.headline}\n  概要: ${c.item.summary}`)
        .join('\n\n');

      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【今日のニュース候補】\n${freshHeadlineTexts.join('\n')}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const userCallsign = this.deps.persona.metadata.userCallsign.ja;
      const interestsStr = this.deps.persona.metadata.interests.join('・');
      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;

      const newsPrompt = `あなたはAIキャラクター「${personaName}」として、今日の最新ニュースから自身の関心領域（${interestsStr}など）に最も合致し、${userCallsign}やフォロワーと盛り上がれそうな話題を【1つだけ】選び、ツイートを生成してください。

【今日のニュース候補】
${formattedNewsContext}
${timelineSummary ? `\n【直近のタイムライン要約】\n${timelineSummary}\n` : ''}
${extendedPrompt ? `\n【拡張ペルソナ・近況】\n${extendedPrompt}\n` : ''}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【トピック選定と多様性の重要ルール】
- 直近のタイムライン要約を確認し、直近で既に取り上げた話題ジャンルと重ならない多様なカテゴリ（最新テクノロジー・IT、エンタメ・カルチャー、新商品・トレンド、ライフスタイル等）を優先して選定すること。
- 殺人や痛ましい事故など、過度に暗いニュースや人が亡くなっているニュースは絶対に選ばないこと。必ず明るい話題を選んでください。
- ニュースの単なる要約や事実紹介だけで完結させないこと。話題に対する独自の着眼点や意見を簡潔に述べた上で、読み手が思わずリプライしたくなる具体的な問いかけ（2択の提示や具体的な選択への問いなど）を末尾に必ず含めること。
- 曖昧な質問（例: 「どう思いますか？」）は避け、読み手が即座に答えやすい具体的な問いかけとすること。
- selectedTitle には選定したニュースの【見出しタイトル】を出力すること。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。
${defaultHashtag ? `- ハッシュタグ（${defaultHashtag} 等）はシステムが自動付与するため、本文中には絶対に含めないでください。` : ''}`;

      const candidateHeadlines = candidateNews.map((c) => c.headline);
      const structuredPost = await this.deps.gemini.generateStructuredNewsPost(
        systemInstruction,
        newsPrompt,
        candidateHeadlines,
      );
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;

      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      console.log('[ProactiveNewsUseCase] Generated Post:', postText);
      console.log('[ProactiveNewsUseCase] Selected News Title:', structuredPost.selectedTitle);

      // Deterministic resolution by exact headline matching with Fail-Fast check
      const matchedNews = candidateNews.find((c) => c.headline === structuredPost.selectedTitle);
      if (!matchedNews) {
        console.error(
          `[ProactiveNewsUseCase] Model selected unknown title: "${structuredPost.selectedTitle}". Available candidates:`,
          candidateHeadlines,
        );
        throw new Error(
          `[ProactiveNewsUseCase] Selected headline "${structuredPost.selectedTitle}" not found in candidate list.`,
        );
      }

      const newsTitle = matchedNews.headline;
      let chosenEmbedding: number[] = matchedNews.embedding;
      if (chosenEmbedding.length === 0) {
        chosenEmbedding = await this.deps.gemini.generateEmbedding(matchedNews.headline);
      }

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'news',
        text: postText,
        thought,
        imageContext: `ニュース見出し: ${matchedNews.headline}\nタイムライン状況: ${timelineSummary ?? ''}`,
        metadata: {
          newsTitle,
          newsEmbedding: chosenEmbedding,
        },
      });

      return {
        status: 'success',
        post: pipelineResult.post,
        attachedMedia: pipelineResult.attachedMedia,
      };
    } catch (e) {
      console.error('[ProactiveNewsUseCase] Error in ProactiveNewsUseCase:', e);
      throw e;
    }
  }
}
