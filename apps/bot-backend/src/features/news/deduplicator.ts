import { AppDependencies } from '../../types';
import { cosineSimilarity } from '@rebecca/persona';

import { NewsItem, CandidateNewsItem } from './types';

/**
 * Evaluates candidate news items against recent news postings using vector cosine similarity.
 * Returns only fresh news items that do not exceed the similarity threshold, with 1-based IDs assigned.
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

  // Compute embeddings in parallel across all candidate news headlines
  const embeddings = await Promise.all(
    rawNews.map(async (item) => {
      try {
        return await deps.gemini.generateEmbedding(item.title);
      } catch (error) {
        console.warn('[NewsDeduplicator] Failed to compute embedding for headline:', error);
        return [];
      }
    }),
  );

  const freshCandidates: CandidateNewsItem[] = [];

  for (let i = 0; i < rawNews.length; i++) {
    const item = rawNews[i];
    const embedding = embeddings[i];
    let isDuplicate = false;

    if (recentNews.length > 0 && embedding.length > 0) {
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

    if (!isDuplicate) {
      freshCandidates.push({
        id: freshCandidates.length + 1,
        headline: item.title,
        embedding,
        item,
      });
    }
  }

  return freshCandidates;
};
