import { PersonaPatternWithVector } from './personaPatternVectors';

/**
 * Execution context determining which platform-specific guidelines and prompt rules are injected.
 * - `reply`: 1-on-1 direct conversational reply to a user on social media (e.g. X/Bluesky).
 * - `timeline`: Autonomous broadcasting to timeline followers (e.g. news, anniversary, soliloquy).
 * - `random_engagement`: Unsolicited friendly engagement with timeline community posts.
 * - `copilot`: Administrative dashboard assistant answering analytics and system queries.
 * - `chat`: 1-on-1 private interactive chat directly with user/Master.
 */
export type PromptContext = 'reply' | 'timeline' | 'random_engagement' | 'copilot' | 'chat';

/**
 * Supported natural languages for persona prompts and generation.
 * - `ja`: Japanese (primary persona language)
 * - `en`: English
 */
export type Language = 'ja' | 'en';

/**
 * Behavioral few-shot pattern anchoring the persona's inner monologue and response style.
 */
export interface PersonaPattern {
  /** Unique sequential identifier for the pattern (1-indexed). */
  readonly id: number;

  /** High-level thematic category of the situational pattern (e.g. 'routine support', 'emotional care'). */
  readonly category: string;

  /** Situational trigger describing the incoming user intent, mood, or platform context. */
  readonly trigger: string;

  /** The AI persona's internal psychological reflection and true intent before responding. */
  readonly internal_thought: string;

  /** Prescribed conversational strategy and behavioral posture for the persona. */
  readonly behavior: string;

  /** Concrete exemplar utterance illustrating tone, vocabulary, and sentence endings. */
  readonly sample_response: string;
}

/**
 * Structured output representation produced by Gemini for persona replies.
 */
export interface StructuredPersonaResponse {
  /** The persona's private internal thought process and emotional reflection. */
  readonly thought: string;

  /** The public text response intended to be delivered to the user or posted to the timeline. */
  readonly reply: string;
}

/**
 * Immutable metadata characterizing a persona's identity, branding, and platform presence.
 */
export interface PersonaMetadata {
  /** Unique canonical identifier for the persona (e.g. 'rebecca', 'alice'). */
  readonly id: string;

  /** Natural display name in native script used in conversation (e.g. 'レベッカ'). */
  readonly displayName: string;

  /** Latinized/English display name used in RAG transcripts and internationalized displays (e.g. 'Rebecca'). */
  readonly englishName: string;

  /** Character archetype and social role description (e.g. 'Latest personal AI by Gemitech'). */
  readonly role: string;

  /** Linguistic tone and style description (e.g. 'Mature, affectionate older-sister gyaru'). */
  readonly toneDescription: string;

  /** Default vocative terms/honorifics used by the persona when addressing the human user. */
  readonly userCallsign: {
    readonly ja: string;
    readonly en: string;
  };

  /** Self-referential first-person pronouns used by the persona. */
  readonly firstPerson: {
    readonly ja: string;
    readonly en: string;
  };

  /** Canonical hashtag appended to autonomous social media posts (e.g. '#全肯定AIレベッカ'). */
  readonly defaultHashtag: string;

  /** HTTP User-Agent string used for external API requests (e.g. Wikipedia API compliance). */
  readonly userAgent: string;

  /** Topical domains of interest actively monitored by the persona for news and engagement. */
  readonly interests: readonly string[];

  /** Foundational core guidelines used as invariant guardrails during persona self-evolution audits. */
  readonly coreGuidelines: readonly string[];

  /** Header title displayed on the administrative dashboard UI (e.g. 'REBECCA AI CORE ADMIN'). */
  readonly adminTitle: string;

  /** Public product/service brand name (e.g. 'Rebecca AI'). */
  readonly brandName: string;

  /** Relative path or URL to the persona avatar icon. */
  readonly avatarUrl: string;
}

/**
 * Top-level contract defining a full persona specification.
 * Any persona implementation must satisfy this interface to be mounted into the bot and dashboard engines.
 */
export interface IPersonaDefinition {
  /** Persona descriptive metadata, branding, and platform configurations. */
  readonly metadata: PersonaMetadata;

  /**
   * Generates the foundational system prompt combining core identity with platform-specific rules.
   *
   * @param context - The execution context ('reply', 'timeline', 'random_engagement', 'copilot').
   * @param lang - Target language ('ja' or 'en').
   * @returns Complete base prompt string.
   */
  getBasePrompt(context: PromptContext, lang: Language): string;

  /**
   * Generates instructions guiding the Dreaming memory consolidation engine.
   * Directs how episodic buffers are compressed into the persistent user profile.
   *
   * @returns System instructions for the Dreaming LLM prompt.
   */
  getDreamingPrompt(): string;

  /** Complete list of situational behavioral patterns defined for this persona. */
  readonly patterns: PersonaPattern[];

  /** Precomputed semantic embedding vectors corresponding to each pattern in `patterns`. */
  readonly patternVectors: PersonaPatternWithVector[];

  /**
   * Retrieves the top-K persona patterns closest to the given query embedding vector.
   *
   * @param queryVector - Embedding vector representing the current conversational trigger.
   * @param topK - Maximum number of patterns to return (defaults to 3).
   * @returns Array of matching PersonaPattern instances ranked by similarity.
   */
  findTopPatterns(queryVector: number[], topK?: number): PersonaPattern[];

  /**
   * Constructs dynamic few-shot prompt instructions from the selected persona patterns.
   *
   * @param patterns - The top matched patterns to format into few-shot examples.
   * @param lang - Target language for the prompt ('ja' or 'en').
   * @returns Formatted prompt section string.
   */
  buildFewShotPrompt(patterns: PersonaPattern[], lang?: Language): string;

  /**
   * Formats all loaded persona patterns into a human-readable summary string.
   *
   * @returns Formatted multi-line string of all patterns.
   */
  getFormattedPatternsText(): string;

  /**
   * Formats contextual behavioral instructions when a user returns after a prolonged absence.
   *
   * @param diffDays - Number of elapsed days since the user's last interaction.
   * @param lang - Target language ('ja' or 'en').
   * @returns Injected absence instruction string, or empty string if no threshold is met.
   */
  formatAbsenceInstruction(diffDays: number, lang: Language): string;
}
