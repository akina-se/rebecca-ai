import { IGeminiService } from '../types';
import {
  findTopPersonaPatterns,
  buildPersonaFewShotPrompt,
} from '@rebecca/persona';
import { getPersonaPatternEmbeddings } from './personaEmbeddingCache';

/**
 * Resolves dynamic few-shot persona anchors from the 120-pattern master dataset
 * by vectorizing synthesized multi-dimensional situational context.
 *
 * @param gemini - The Gemini service for generating embeddings.
 * @param contextElements - Array of descriptive context strings (time, news, mood, timeline).
 * @param lang - Target language ('ja' | 'en'). Defaults to 'ja'.
 * @param topK - Number of exemplar patterns to retrieve. Defaults to 3.
 * @returns Formatted Few-Shot prompt block or empty string if not available.
 */
export const resolveSituationalPersonaAnchors = async (
  gemini: IGeminiService,
  contextElements: string[],
  lang: 'ja' | 'en' = 'ja',
  topK = 3,
): Promise<string> => {
  const query = contextElements
    .filter(Boolean)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');

  if (!query) {
    return '';
  }

  try {
    const patternVectors = getPersonaPatternEmbeddings();
    const queryVector = await gemini.generateEmbedding(query);
    if (!queryVector || queryVector.length === 0) {
      return '';
    }
    const topPatterns = findTopPersonaPatterns(queryVector, patternVectors, topK);
    return buildPersonaFewShotPrompt(topPatterns, lang);
  } catch (e) {
    console.warn('Failed to resolve dynamic situational persona anchors:', e);
    return '';
  }
};
