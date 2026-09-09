import { AppDependencies } from '../../types';
import { cosineSimilarity } from '@rebecca/persona';

import { NewsItem } from './types';

export interface CandidateNewsItem {
  headline: string;
  embedding: number[];
  item: NewsItem;
}

/**
 * Evaluates candidate news items against recent news postings using vector cosine similarity.
 * Returns only fresh news items that do not exceed the similarity threshold.
 *
 * @param deps - Injected application dependencies containing firestore and gemini services.
 * @param rawNews - Array of raw NewsItem objects retrieved from the news provider.
 * @param lookbackDays - Number of days to inspect for past news posts.
 * @param similarityThreshold - Cosine similarity cutoff above which a headline is deemed duplicate.
 * @returns Array of fresh candidate news items with their generated embeddings.
 */
export const filterFreshNews = async (
  deps: AppDependencies,
  rawNews: NewsItem[],
  lookbackDays: number,
  similarityThreshold: number,
): Promise<CandidateNewsItem[]> => {
  if (rawNews.length === 0) {
    return [];
  }

  const recentNews = await deps.firestore.getRecentNewsEmbeddings(lookbackDays);
  const candidates: CandidateNewsItem[] = [];

  for (const item of rawNews) {
    let isDuplicate = false;
    let embedding: number[] = [];

    if (recentNews.length > 0) {
      try {
        embedding = await deps.gemini.generateEmbedding(item.title);
        if (embedding.length > 0) {
          for (const past of recentNews) {
            const sim = cosineSimilarity(embedding, past.embedding);
            if (sim >= similarityThreshold) {
              console.log(
                `[NewsDeduplicator] Filtered duplicate headline (sim=${sim.toFixed(3)} >= ${similarityThreshold}): "${item.title}" matches past: "${past.title}"`,
              );
              isDuplicate = true;
              break;
            }
          }
        }
      } catch (error) {
        console.warn('[NewsDeduplicator] Failed to compute embedding for headline:', error);
      }
    }

    if (!isDuplicate) {
      candidates.push({ headline: item.title, embedding, item });
    }
  }

  return candidates;
};
