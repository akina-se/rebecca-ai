import { PersonaPatternWithVector } from './personaPatternVectors';
import {
  IPersonaDefinition,
  PersonaMetadata,
  PersonaPattern,
  PromptContext,
  Language,
} from './types';

/**
 * Calculates cosine similarity between two numeric vectors.
 * Returns 0 if either vector is empty, malformed, or has zero magnitude.
 *
 * @param vecA - First numeric vector.
 * @param vecB - Second numeric vector.
 * @returns Cosine similarity score between -1.0 and 1.0.
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
 * Abstract base class providing common algorithmic infrastructure for all persona definitions.
 *
 * Implements invariant responsibilities:
 * - Dynamic anchor pattern retrieval via vector cosine similarity (`findTopPatterns`).
 * - Formatted few-shot example construction for LLM prompts (`buildFewShotPrompt`).
 * - Pattern catalog text formatting (`getFormattedPatternsText`).
 *
 * Concrete subclasses must provide persona-specific domain properties and templates:
 * - `metadata`: Unique identity, callsigns, and UI branding.
 * - `patterns` & `patternVectors`: Domain-specific behavioral pattern datasets.
 * - `getBasePrompt`: Core identity and platform-specific behavioral rules.
 * - `getDreamingPrompt`: Memory consolidation guidelines.
 * - `formatAbsenceInstruction`: Contextual absence reaction strings.
 */
export abstract class BasePersona implements IPersonaDefinition {
  /** Persona descriptive metadata, branding, and platform configurations. */
  abstract readonly metadata: PersonaMetadata;

  /** Complete list of situational behavioral patterns defined for this persona. */
  abstract readonly patterns: PersonaPattern[];

  /** Precomputed semantic embedding vectors corresponding to each pattern in `patterns`. */
  abstract readonly patternVectors: PersonaPatternWithVector[];

  /**
   * Generates the foundational system prompt combining core identity with platform-specific rules.
   *
   * @param context - The execution context ('reply', 'timeline', 'random_engagement', 'copilot', 'chat').
   * @param lang - Target language ('ja' or 'en').
   * @returns Complete base prompt string.
   */
  abstract getBasePrompt(context: PromptContext, lang: Language): string;

  /**
   * Generates instructions guiding the Dreaming memory consolidation engine.
   *
   * @returns System instructions for the Dreaming LLM prompt.
   */
  abstract getDreamingPrompt(): string;

  /**
   * Formats contextual behavioral instructions when a user returns after a prolonged absence.
   *
   * @param diffDays - Number of elapsed days since the user's last interaction.
   * @param lang - Target language ('ja' or 'en').
   * @returns Injected absence instruction string, or empty string if no threshold is met.
   */
  abstract formatAbsenceInstruction(diffDays: number, lang: Language): string;

  /**
   * Retrieves the top-K persona patterns closest to the given query embedding vector.
   *
   * @param queryVector - Embedding vector representing the current conversational trigger.
   * @param topK - Maximum number of patterns to return (defaults to 3).
   * @returns Array of matching PersonaPattern instances ranked by similarity.
   */
  findTopPatterns(queryVector: number[], topK = 3): PersonaPattern[] {
    if (!queryVector || queryVector.length === 0 || !this.patternVectors || this.patternVectors.length === 0) {
      return this.patterns.slice(0, Math.min(topK, this.patterns.length));
    }

    const scored = this.patternVectors.map((item) => ({
      id: item.id,
      score: cosineSimilarity(queryVector, item.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    const patternMap = new Map<number, PersonaPattern>();
    for (const p of this.patterns) {
      patternMap.set(p.id, p);
    }

    const result: PersonaPattern[] = [];
    for (const item of scored.slice(0, topK)) {
      const pattern = patternMap.get(item.id);
      if (pattern) {
        result.push(pattern);
      }
    }
    return result;
  }

  /**
   * Constructs dynamic few-shot prompt instructions from the selected persona patterns.
   *
   * @param patterns - The top matched patterns to format into few-shot examples.
   * @param lang - Target language for the prompt ('ja' or 'en'). Defaults to 'ja'.
   * @returns Formatted prompt section string.
   */
  buildFewShotPrompt(patterns: PersonaPattern[], lang: Language = 'ja'): string {
    if (!patterns || patterns.length === 0) return '';

    if (lang === 'en') {
      const examples = patterns
        .map(
          (p, idx) => `[Example ${idx + 1}: ${p.category}]
Trigger: ${p.trigger}
Inner Thought: ${p.internal_thought}
Behavior: ${p.behavior}
Sample Response: ${p.sample_response}`
        )
        .join('\n\n');
      return `[Dynamic Few-Shot Persona Anchors]\n${examples}`;
    } else {
      const examples = patterns
        .map(
          (p, idx) => `【模範パターン ${idx + 1}：${p.category}】
・トリガー（状況）：${p.trigger}
・内省（本音と思考）：${p.internal_thought}
・行動指針：${p.behavior}
・発話例：${p.sample_response}`
        )
        .join('\n\n');
      return `【動的Few-Shotペルソナアンカー（思考と発話の指針）】\n以下の状況別パターンを参考に、内省思考(thought)と発話(reply)を生成してください：\n\n${examples}`;
    }
  }

  /**
   * Formats all loaded persona patterns into a human-readable summary string.
   *
   * @returns Formatted multi-line string of all patterns.
   */
  getFormattedPatternsText(): string {
    return this.patterns
      .map(
        (p) =>
          `#${p.id} [${p.category}]\n  状況: ${p.trigger}\n  本音: ${p.internal_thought}\n  行動: ${p.behavior}\n  台詞: ${p.sample_response}`
      )
      .join('\n\n');
  }
}
