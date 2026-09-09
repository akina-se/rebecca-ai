import { AppDependencies } from '../../types';
import { cosineSimilarity } from '@rebecca/persona';

import { NewsItem } from './types';

export interface CandidateHeadline {
  headline: string;
  embedding: number[];
  item?: NewsItem;
}

/**
 * Evaluates candidate headlines against recent news postings using vector cosine similarity.
 * Returns only fresh headlines that do not exceed the similarity threshold.
 *
 * @param deps - Injected application dependencies containing firestore and gemini services.
 * @param rawHeadlines - Array of raw headline strings retrieved from the news provider.
 * @param lookbackDays - Number of days to inspect for past news posts.
 * @param similarityThreshold - Cosine similarity cutoff above which a headline is deemed duplicate.
 * @returns Array of fresh candidate headlines with their generated embeddings.
 */
export const filterFreshHeadlines = async (
  deps: AppDependencies,
  rawHeadlines: (string | NewsItem)[],
  lookbackDays: number,
  similarityThreshold: number,
): Promise<CandidateHeadline[]> => {
  if (rawHeadlines.length === 0) {
    return [];
  }

  const recentNews = await deps.firestore.getRecentNewsEmbeddings(lookbackDays);
  const candidates: CandidateHeadline[] = [];

  for (const entry of rawHeadlines) {
    const headline = typeof entry === 'string' ? entry : entry.title;
    const item = typeof entry === 'string' ? undefined : entry;
    let isDuplicate = false;
    let embedding: number[] = [];

    if (recentNews.length > 0) {
      try {
        embedding = await deps.gemini.generateEmbedding(headline);
        if (embedding.length > 0) {
          for (const past of recentNews) {
            const sim = cosineSimilarity(embedding, past.embedding);
            if (sim >= similarityThreshold) {
              console.log(
                `[NewsDeduplicator] Filtered duplicate headline (sim=${sim.toFixed(3)} >= ${similarityThreshold}): "${headline}" matches past: "${past.title}"`,
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
      candidates.push({ headline, embedding, item });
    }
  }

  return candidates;
};
