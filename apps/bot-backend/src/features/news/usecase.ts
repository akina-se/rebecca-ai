import { AppDependencies } from '../../types';
import config from '../../config';
import { executePostPipeline } from '../../core/postPipeline';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { INewsProvider, NewsResult } from './types';
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
   */
  constructor(
    private readonly deps: AppDependencies,
    private readonly newsProvider: INewsProvider,
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
        config.news.dedupLookbackDays,
        config.news.dedupSimilarityThreshold,
      );

      if (candidateNews.length === 0) {
        console.log('[ProactiveNewsUseCase] All candidate headlines were duplicates of recent posts.');
        return { status: 'skipped', reason: 'all_duplicates' };
      }

      const freshHeadlineTexts = candidateNews.map((c) => c.headline);
      console.log('[ProactiveNewsUseCase] Fresh non-duplicate headlines:\n', freshHeadlineTexts.join('\n'));

      const formattedNewsContext = candidateNews
        .map((c) => `・【${c.item.category}】${c.item.title}\n  概要: ${c.item.summary}`)
        .join('\n');

      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【今日のニュース候補】\n${freshHeadlineTexts.join('\n')}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const interestsStr = this.deps.persona.metadata.interests.join('・');
      const newsPrompt = `以下の今日の最新ニュースから、共感・興奮しそうな話題（${interestsStr}など）を【1つだけ】選び、ニュースの概要や背景に触れながらツイートを生成してください。

【今日のニュース】
${formattedNewsContext}
${timelineSummary ? `\n【直近のタイムライン要約】\n${timelineSummary}\n` : ''}
${extendedPrompt ? `\n【拡張ペルソナ・近況】\n${extendedPrompt}\n` : ''}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【追加ルール】
- 殺人や痛ましい事故など、過度に暗いニュースや人が亡くなっているニュースは絶対に選ばないこと。必ず明るい話題や気象、カルチャーなどを選んでください。
- ニュースの単なる要約や事実紹介だけで完結させないこと。話題に対する独自の着眼点や意見を簡潔に述べた上で、読み手が思わずリプライしたくなる具体的な問いかけ（2択の提示や具体的な選択への問いなど）を末尾に必ず含めること。
- 曖昧な質問（例: 「どう思いますか？」）は避け、読み手が即座に答えやすい具体的な問いかけとすること。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。`;

      const structuredPost = await this.deps.gemini.generateStructuredNewsPost(systemInstruction, newsPrompt);
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;

      if (!postText) {
        console.log('[ProactiveNewsUseCase] Failed to generate news post.');
        return { status: 'skipped', reason: 'generation_failed' };
      }

      const defaultHashtag = this.deps.persona.metadata.defaultHashtag;
      if (defaultHashtag) {
        const hashtag = `\n${defaultHashtag}`;
        if (postText.length + hashtag.length <= 140) {
          postText += hashtag;
        }
      }

      console.log('[ProactiveNewsUseCase] Generated Post:', postText);

      // Identify which headline was referenced
      const matchedNews = candidateNews.find((c) => postText.includes(c.headline));
      const newsTitle = matchedNews ? matchedNews.headline : undefined;

      let chosenEmbedding: number[] | undefined;
      if (matchedNews) {
        chosenEmbedding = matchedNews.embedding;
        if (!chosenEmbedding || chosenEmbedding.length === 0) {
          try {
            chosenEmbedding = await this.deps.gemini.generateEmbedding(matchedNews.headline);
          } catch (e) {
            console.warn('[ProactiveNewsUseCase] Failed to generate embedding for selected headline:', e);
          }
        }
      }

      const pipelineResult = await executePostPipeline(this.deps, {
        postType: 'news',
        text: postText,
        thought,
        imageContext: matchedNews
          ? `ニュース見出し: ${matchedNews.headline}\nタイムライン状況: ${timelineSummary}`
          : `タイムライン状況: ${timelineSummary}`,
        metadata: {
          newsTitle,
          newsEmbedding: chosenEmbedding && chosenEmbedding.length > 0 ? chosenEmbedding : undefined,
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
