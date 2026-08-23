import { precomputedPersonaPatternEmbeddings, PersonaPatternWithVector } from '@rebecca/persona';

/**
 * Retrieves precomputed embeddings for the 120 persona patterns.
 * Precomputed vectors (768 dimensions) are bundled statically with the persona master data,
 * providing zero-latency (0.001ms) and completely eliminating runtime Embedding API calls and 429 quota exhaustion.
 *
 * @returns An array of persona patterns paired with their precomputed embedding vectors.
 */
export function getPersonaPatternEmbeddings(): PersonaPatternWithVector[] {
  return precomputedPersonaPatternEmbeddings;
}
