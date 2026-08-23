import { personaPatterns } from '@rebecca/persona';
import { IGeminiService } from '../types/interfaces';

let cachedPatternVectors: Array<{ id: number; vector: number[] }> | null = null;
let isInitializing = false;

/**
 * Initializes and retrieves cached embeddings for the 120 persona patterns.
 * Embeddings are calculated based on the pattern trigger text and cached in-memory.
 *
 * @param gemini - The Gemini service instance for generating embeddings.
 * @returns An array of pattern IDs paired with their embedding vectors.
 */
export async function getPersonaPatternEmbeddings(
  gemini: IGeminiService
): Promise<Array<{ id: number; vector: number[] }>> {
  if (cachedPatternVectors && cachedPatternVectors.length === personaPatterns.length) {
    return cachedPatternVectors;
  }

  if (isInitializing) {
    // If initialization is in progress, return whatever is available or simple fallback
    return cachedPatternVectors || [];
  }

  try {
    isInitializing = true;
    console.log('[PersonaEmbeddings] Initializing in-memory embeddings for 120 persona patterns...');
    const vectors: Array<{ id: number; vector: number[] }> = [];

    // Batch process in chunks of 20 to respect concurrency limits
    const chunkSize = 20;
    for (let i = 0; i < personaPatterns.length; i += chunkSize) {
      const chunk = personaPatterns.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (pattern) => {
        try {
          const vector = await gemini.generateEmbedding(pattern.trigger);
          return { id: pattern.id, vector };
        } catch (err) {
          console.warn(`[PersonaEmbeddings] Failed to embed pattern #${pattern.id}:`, err);
          return { id: pattern.id, vector: [] };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      vectors.push(...chunkResults.filter((r) => r.vector.length > 0));
    }

    cachedPatternVectors = vectors;
    console.log(`[PersonaEmbeddings] Initialized ${vectors.length} pattern embeddings.`);
    return cachedPatternVectors;
  } catch (error) {
    console.error('[PersonaEmbeddings] Failed to initialize pattern embeddings:', error);
    return [];
  } finally {
    isInitializing = false;
  }
}
