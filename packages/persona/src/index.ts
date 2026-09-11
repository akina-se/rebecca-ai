export * from './types';
export { precomputedPersonaPatternEmbeddings, PersonaPatternWithVector } from './personaPatternVectors';
export { rebeccaPersona, RebeccaPersona, REBECCA_METADATA } from './personas/rebecca';

import { rebeccaPersona } from './personas/rebecca';
import { IPersonaDefinition, PersonaPattern, PromptContext, Language, StructuredPersonaResponse } from './types';

/**
 * Registry resolver for active persona.
 * Fail-fast: Throws an explicit error if an unrecognized persona ID is requested.
 * Defaults to 'rebecca' if id is undefined, null, or empty string.
 */
export function getActivePersona(id?: string): IPersonaDefinition {
  const normalizedId = (id || 'rebecca').trim().toLowerCase();
  if (normalizedId === 'rebecca') {
    return rebeccaPersona;
  }
  throw new Error(`Unknown persona ID: "${id}". Registered personas: ["rebecca"].`);
}

/**
 * Default patterns (from Rebecca persona)
 */
export const personaPatterns: PersonaPattern[] = rebeccaPersona.patterns;

/**
 * Calculates cosine similarity between two numeric vectors.
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Finds top-K matching persona patterns based on cosine similarity against trigger vectors.
 */
export const findTopPersonaPatterns = (
  queryVector: number[],
  patternVectors: Array<{ id: number; vector: number[] }>,
  topK = 3
): PersonaPattern[] => {
  return rebeccaPersona.findTopPatterns(queryVector, topK);
};

/**
 * Builds the few-shot prompt section from selected persona patterns.
 */
export const buildPersonaFewShotPrompt = (patterns: PersonaPattern[], lang: Language = 'ja'): string => {
  return rebeccaPersona.buildFewShotPrompt(patterns, lang);
};

/**
 * Formats all persona patterns into a clean, human-readable text string for Layer 0 inspection.
 */
export const getFormattedPersonaPatternsText = (): string => {
  return rebeccaPersona.getFormattedPatternsText();
};

/**
 * Constructs base prompt by delegating to rebeccaPersona.
 */
export const getBasePrompt = (context: PromptContext, lang: Language): string => {
  return rebeccaPersona.getBasePrompt(context, lang);
};

/**
 * Generates dreaming prompt by delegating to rebeccaPersona.
 */
export const getDreamingPrompt = (): string => {
  return rebeccaPersona.getDreamingPrompt();
};

/**
 * Gemini Structured Outputs schema for Persona reply generation.
 */
export const PERSONA_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    thought: {
      type: 'string',
      description: 'Inner thoughts, true feelings, and emotional shifts based on the persona.',
    },
    reply: {
      type: 'string',
      description: 'The actual reply intended for the user.',
    },
  },
  required: ['thought', 'reply'],
};

/**
 * Parses structured persona responses from Gemini.
 * Fails fast and returns empty strings if the output is not valid JSON conforming to the schema.
 */
export const parsePersonaResponse = (raw: string): StructuredPersonaResponse => {
  if (!raw || typeof raw !== 'string') {
    return { thought: '', reply: '' };
  }

  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      const thought = typeof parsed.thought === 'string' ? parsed.thought.trim() : '';
      const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : (typeof parsed.text === 'string' ? parsed.text.trim() : '');
      return { thought, reply };
    }
  } catch (err) {
    console.error('Failed to parse structured persona response JSON:', err);
  }

  return { thought: '', reply: '' };
};

/**
 * Persona configuration object exposed for dashboard rendering or inspection.
 */
export const persona = {
  core: {
    identity: rebeccaPersona.getBasePrompt('timeline', 'ja').split('【コンテキスト')[0].trim(),
    role: rebeccaPersona.metadata.role,
    tone: rebeccaPersona.metadata.toneDescription,
    patternsText: rebeccaPersona.getFormattedPatternsText(),
  },
};
