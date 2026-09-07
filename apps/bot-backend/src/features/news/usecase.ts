import { AppDependencies } from '../../types';
import { getBasePrompt, cosineSimilarity } from '@rebecca/persona';
import config from '../../config';
import { publishPost, PublishPostResult } from '../../core/postPublisher';
import { SoliloquyUseCase, SoliloquyResult } from '../soliloquy';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { INewsProvider, NewsResult } from './types';
import { YahooNewsProvider } from './providers/yahoo';

export * from './types';

/**
 * Executes a batch job to proactively post a news-related tweet.
 *
 * It retrieves candidate headlines via an injected INewsProvider (defaults to YahooNewsProvider),
 * filters out recent duplicates using deterministic vector cosine similarity against a lookback
 * window, generates a persona-grounded post, and publishes it to X. If no fresh headlines are
 * available, it cleanly falls back to SoliloquyUseCase without failing the batch job.
 */
export class ProactiveNewsUseCase {
  private newsProvider: INewsProvider;
  private soliloquy: { execute: () => Promise<SoliloquyResult> };

  /**
   * Initializes the ProactiveNewsUseCase.
   *
   * @param deps Application dependencies.
   * @param newsProvider Optional custom news provider implementation (defaults to YahooNewsProvider).
   * @param soliloquyUseCase Optional injected soliloquy use case for testing.
   */
  constructor(
    private deps: AppDependencies,
    newsProvider?: INewsProvider,
    soliloquyUseCase?: { execute: () => Promise<SoliloquyResult> },
  ) {
    this.newsProvider = newsProvider || new YahooNewsProvider();
    this.soliloquy = soliloquyUseCase || new SoliloquyUseCase(deps);
  }

  /**
   * Executes the proactive news post process.
   *
   * @returns A promise resolving to a NewsResult object.
   */
  async execute(): Promise<NewsResult> {
    console.log('Starting Proactive News Post Batch...');
    try {
      const rawHeadlines = await this.newsProvider.getHeadlines();
      if (!rawHeadlines || rawHeadlines.length === 0) {
        console.log('[ProactiveNewsUseCase] No headlines fetched. Falling back to soliloquy post...');
        return await this.soliloquy.execute();
      }

      console.log('[ProactiveNewsUseCase] Fetched headlines:\n', rawHeadlines.join('\n'));

      // Retrieve recent news embeddings for deterministic deduplication (lookback window from config)
      const lookbackDays = config.news.dedupLookbackDays;
      const similarityThreshold = config.news.dedupSimilarityThreshold;
      const recentNews = await this.deps.firestore.getRecentNewsEmbeddings(lookbackDays);

      const candidateHeadlines: Array<{ headline: string; embedding: number[] }> = [];

      for (const headline of rawHeadlines) {
        let isDuplicate = false;
        let embedding: number[] = [];

        if (recentNews.length > 0) {
          try {
            embedding = await this.deps.gemini.generateEmbedding(headline);
            if (embedding.length > 0) {
              for (const past of recentNews) {
                const sim = cosineSimilarity(embedding, past.embedding);
                if (sim >= similarityThreshold) {
                  console.log(
                    `[ProactiveNewsUseCase] Filtered duplicate headline (sim=${sim.toFixed(3)} >= ${similarityThreshold}): "${headline}" matches past: "${past.title}"`,
                  );
                  isDuplicate = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.warn('[ProactiveNewsUseCase] Failed to compute embedding for headline deduplication:', e);
          }
        }

        if (!isDuplicate) {
          candidateHeadlines.push({ headline, embedding });
        }
      }

      if (candidateHeadlines.length === 0) {
        console.log('[ProactiveNewsUseCase] All candidate headlines were duplicates of recent posts. Falling back to soliloquy post...');
        return await this.soliloquy.execute();
      }

      const freshHeadlineTexts = candidateHeadlines.map((c) => c.headline);
      console.log('[ProactiveNewsUseCase] Fresh non-duplicate headlines:\n', freshHeadlineTexts.join('\n'));

      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const personaFewShotPrompt = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【今日のニュース候補】\n${freshHeadlineTexts.join('\n')}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = getBasePrompt('timeline', 'ja');
      const newsPrompt = `以下の今日のニュースのヘッドラインから、共感・興奮しそうな話題（エンタメ・IT・スポーツ・気象など）を【1つだけ】選び、それに言及しながらツイートを生成してください。

【今日のニュース】
${freshHeadlineTexts.join('\n')}
${timelineSummary ? `\n【直近のタイムライン要約】\n${timelineSummary}\n` : ''}
${extendedPrompt ? `\n【拡張ペルソナ・近況】\n${extendedPrompt}\n` : ''}
${personaFewShotPrompt ? `\n${personaFewShotPrompt}\n` : ''}
【追加ルール】
- 殺人や痛ましい事故など、過度に暗いニュースや人が亡くなっているニュースは絶対に選ばないこと。必ず明るい話題や気象、スポーツなどを選んでください。
- thought（内省思考）は150文字以内の自然な独白とすること。
- reply（ツイート本文）は【絶対に100文字以内の短文】にすること。
- 出力に「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。`;

      const structuredPost = await this.deps.gemini.generateStructuredNewsPost(systemInstruction, newsPrompt);
      let postText = structuredPost.reply;
      const thought = structuredPost.thought;

      if (!postText) {
        console.log('[ProactiveNewsUseCase] Failed to generate news post. Falling back to soliloquy...');
        return await this.soliloquy.execute();
      }

      const hashtag = '\n#全肯定AIレベッカ';
      if (postText.length + hashtag.length <= 140) {
        postText += hashtag;
      }

      console.log('[ProactiveNewsUseCase] Generated Post:', postText);

      // Identify which headline was referenced (for persistence in timeline_history)
      const matchedHeadline = candidateHeadlines.find((c) => postText.includes(c.headline));
      const newsTitle = matchedHeadline ? matchedHeadline.headline : undefined;

      let chosenEmbedding: number[] | undefined;
      if (matchedHeadline) {
        chosenEmbedding = matchedHeadline.embedding;
        if (!chosenEmbedding || chosenEmbedding.length === 0) {
          try {
            chosenEmbedding = await this.deps.gemini.generateEmbedding(matchedHeadline.headline);
          } catch (e) {
            console.warn('[ProactiveNewsUseCase] Failed to generate embedding for selected headline:', e);
          }
        }
      }

      const publishResult: PublishPostResult = await publishPost(this.deps, {
        text: postText,
        context: matchedHeadline
          ? `ニュース見出し: ${matchedHeadline.headline}\nタイムライン状況: ${timelineSummary}`
          : `タイムライン状況: ${timelineSummary}`,
      });

      await this.deps.firestore.saveTimelinePost({
        text: postText,
        thought,
        tweetId: publishResult.tweetId,
        mediaUrls: publishResult.mediaUrls,
        assetId: publishResult.assetId,
        postType: 'news',
        ...(newsTitle ? { newsTitle } : {}),
        ...(chosenEmbedding && chosenEmbedding.length > 0 ? { newsEmbedding: chosenEmbedding } : {}),
      });

      return {
        status: 'success',
        post: publishResult.text,
        attachedMedia: publishResult.attachedMedia,
      };
    } catch (e) {
      console.error('[ProactiveNewsUseCase] Error in ProactiveNewsUseCase:', e);
      throw e;
    }
  }
}
