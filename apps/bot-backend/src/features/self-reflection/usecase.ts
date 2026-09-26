import { AppDependencies } from '../../types';
import { SelfReflectionResult } from './types';
import { logger } from '../../utils/logger';

/**
 * Configuration options for the SelfReflectionUseCase.
 */
export interface SelfReflectionConfig {
  postLimit?: number;
}

/**
 * Orchestrates Rebecca's self-reflection batch process.
 * Summarizes recent timeline events into Layer 2 long-term memory (system/persona.timeline_summary).
 * Enforces fail-fast semantics and ensures existing memory is never overwritten with blank data.
 */
export class SelfReflectionUseCase {
  private readonly postLimit: number;

  /**
   * Initializes a new instance of SelfReflectionUseCase.
   *
   * @param deps - Application dependencies providing access to Firestore, Gemini, and Persona services.
   * @param config - Optional configuration specifying the number of recent posts to summarize.
   */
  constructor(
    private readonly deps: AppDependencies,
    config?: SelfReflectionConfig,
  ) {
    this.postLimit = config?.postLimit ?? 20;
  }

  /**
   * Executes timeline summarization.
   *
   * @returns A promise resolving to a SelfReflectionResult detailing execution status.
   * @throws Error if Gemini API fails or returns invalid/empty content, preventing data corruption.
   */
  async execute(): Promise<SelfReflectionResult> {
    logger.info('[SelfReflectionUseCase] Starting timeline self-reflection');

    const recentPosts = await this.deps.firestore.getRecentTimelinePosts({ limit: this.postLimit });
    if (!recentPosts || recentPosts.length === 0) {
      logger.info('[SelfReflectionUseCase] No recent timeline posts found. Skipping summarization');
      return { status: 'skipped', reason: 'no_recent_timeline_posts', postsCount: 0 };
    }

    const previousSummary = await this.deps.firestore.getTimelineSummary();
    const personaName = this.deps.persona.metadata.displayName;

    const formattedPosts = recentPosts.map((post, index) => {
      const thoughtSuffix = post.thought ? ` (内心: ${post.thought})` : '';
      return `[${index + 1}] ${post.text}${thoughtSuffix}`;
    });

    const prompt = `【過去の要約】
${previousSummary ? previousSummary : '（まだ要約なし）'}

【${personaName}の最近のツイート（古い順）】
${formattedPosts.join('\n')}`;

    try {
      const newSummary = await this.deps.gemini.generateTimelineSummary(prompt);
      const trimmedSummary = newSummary ? newSummary.trim() : '';

      if (trimmedSummary.length === 0) {
        throw new Error('[SelfReflectionUseCase] Generated timeline summary was empty.');
      }

      await this.deps.firestore.saveTimelineSummary(trimmedSummary);
      logger.info('[SelfReflectionUseCase] Timeline summary successfully updated');

      return {
        status: 'success',
        summary: trimmedSummary,
        previousSummary,
        postsCount: recentPosts.length,
      };
    } catch (error) {
      logger.error('[SelfReflectionUseCase] Timeline summary generation failed', error);
      throw error;
    }
  }
}
