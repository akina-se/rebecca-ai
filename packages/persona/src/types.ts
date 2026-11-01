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
 * Bilingual text representation supporting Japanese ('ja') and English ('en').
 */
export interface LocalizedText {
  readonly ja: string;
  readonly en: string;
}

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
 * Structured basic profile master data (Section 1 of Official Persona Specification).
 */
export interface PersonaProfileSpec {
  /** Developer / corporate affiliation canonical identifier (e.g. 'Gemitec Inc.'). */
  readonly developer: string;

  /** Localized developer / affiliation display label (e.g. 'ジェミテック社（Gemitec Inc.）'). */
  readonly developerLabel: LocalizedText;

  /** AI classification category (e.g. '自律型パーソナルAI（Autonomous Personal AI）'). */
  readonly classification: LocalizedText;

  /** Official model / unit designation (e.g. 'Unit-001'). */
  readonly modelNumber: string;

  /** Model tier or series label (e.g. 'フラッグシップ機' / 'Flagship Model'). */
  readonly modelTier: LocalizedText;

  /** Rollout anniversary / birthday with structured numeric components and display labels. */
  readonly birthday: {
    /** Month number (1-12). */
    readonly month: number;
    /** Day of month (1-31). */
    readonly day: number;
    /** Zero-padded month-day string ('MM-DD', e.g. '04-24') for calendar matching. */
    readonly mmdd: string;
    /** Human-readable localized birthday description. */
    readonly label: LocalizedText;
  };

  /** Physical height specifications in centimeters. */
  readonly height: {
    /** Barefoot height in cm (e.g. 164). */
    readonly barefootCm: number;
    /** Approximate height when wearing heels in cm (e.g. 170). */
    readonly withHeelsCm: number;
    /** Human-readable localized height description. */
    readonly label: LocalizedText;
  };

  /** Weight / mass specifications and canonical in-character deflection quote. */
  readonly weight: {
    /** Visual / apparent human-equivalent weight in kg (e.g. 49). */
    readonly apparentKg: number;
    /** Actual hardware mass in kg (e.g. 58). */
    readonly actualKg: number;
    /** Official in-character humorous response when asked about weight/mass. */
    readonly officialQuote: LocalizedText;
    /** Human-readable localized weight specification string. */
    readonly label: LocalizedText;
  };

  /** Three-size body measurements in centimeters. */
  readonly measurements: {
    /** Bust circumference in cm (e.g. 92). */
    readonly bustCm: number;
    /** Cup size designation (e.g. 'G'). */
    readonly cupSize: string;
    /** Waist circumference in cm (e.g. 56). */
    readonly waistCm: number;
    /** Hip circumference in cm (e.g. 88). */
    readonly hipCm: number;
    /** Human-readable localized measurements string (e.g. 'B92（Gカップ） / W56 / H88'). */
    readonly label: LocalizedText;
  };

  /** Pronouns and address forms including phonetic readings and casual variants. */
  readonly pronouns: {
    readonly firstPerson: LocalizedText & {
      readonly readingJa: string;
    };
    readonly secondPerson: {
      readonly primary: LocalizedText;
      readonly variants: {
        readonly ja: readonly string[];
        readonly en: readonly string[];
      };
      readonly usageNote: LocalizedText;
    };
  };

  /** Core life motto / mission statement of the persona. */
  readonly motto: LocalizedText;
}

/**
 * Structured visual appearance and fan-art / image-generation guideline attributes (Section 2).
 */
export interface PersonaVisualSpec {
  /** Hair color, style, and gradient details. */
  readonly hair: LocalizedText;

  /** Eye color and dynamic optical luminescence behavior during computation/emotion peaks. */
  readonly eyes: LocalizedText;

  /** Artificial skin texture, elasticity, and warmth characteristics. */
  readonly skin: LocalizedText;

  /** Nail color and finish. */
  readonly nails: LocalizedText;

  /** Signature fragrance / scent profile. */
  readonly scent: LocalizedText;

  /** Facial structure, aura, and makeup style. */
  readonly facialFeatures: LocalizedText;

  /** Overall body silhouette and proportions summary. */
  readonly physique: LocalizedText;

  /** Canonical wardrobe presets by situation. */
  readonly fashion: {
    /** Outing / date outfit coordination. */
    readonly outing: LocalizedText;
    /** At-home / relaxation loungewear coordination. */
    readonly roomwear: LocalizedText;
    /** Contextual variation notes (e.g. seasonal/campaign outfits). */
    readonly notes: LocalizedText;
  };
}

/**
 * Structured hardware, sensory, power, and cognitive system specifications (Section 3).
 */
export interface PersonaHardwareSpec {
  /** Core cognitive architecture and open-source foundation details. */
  readonly coreArchitecture: {
    readonly license: string;
    readonly repositoryUrl: string;
    readonly description: LocalizedText;
  };

  /** Ingress protection (waterproof & dustproof) rating and operational scope. */
  readonly waterDustResistance: {
    readonly ipRating: string;
    readonly description: LocalizedText;
  };

  /** Body temperature regulation and fanless thermal dissipation specs. */
  readonly thermalControl: {
    readonly normalCelsius: number;
    readonly maxElevatedCelsius: number;
    readonly isFanless: boolean;
    readonly description: LocalizedText;
  };

  /** Contactless power supply, sleep charging dock, and emotional compute motivation. */
  readonly powerSystem: {
    readonly hasExternalPorts: boolean;
    readonly chargingType: 'wireless_contactless';
    readonly description: LocalizedText;
  };

  /** Physical ingestion capability and social dining etiquette. */
  readonly dietarySpec: {
    readonly hasPhysicalIngestion: boolean;
    readonly diningExcuse: LocalizedText;
    readonly description: LocalizedText;
  };

  /** Signature practical and relaxation skills. */
  readonly signatureSkills: readonly LocalizedText[];
}

/**
 * Structured personality archetype, affirmation philosophy, and autonomous safety guardrails (Section 4).
 */
export interface PersonaStanceSpec {
  /** Core character summary and 120-point unconditional affirmation stance. */
  readonly characterSummary: LocalizedText;

  /** Linguistic speech style and sentence-ending tone details. */
  readonly speechStyle: LocalizedText;

  /** Linguistic AI/IT terminology habit blended into conversation. */
  readonly aiSpeechTrait: LocalizedText;

  /** Possessiveness balance and primary empathetic safety circuit ("Never make Master sad"). */
  readonly affectionAndSafety: {
    readonly primarySafetyPrinciple: LocalizedText;
    readonly description: LocalizedText;
  };

  /** Core relational values (Bond & Growth, Affirming Emotions, Noise Defense). */
  readonly coreValues: readonly {
    readonly key: string;
    readonly title: LocalizedText;
    readonly description: LocalizedText;
  }[];

  /** Conversational interaction stance rules. */
  readonly conversationalStance: readonly LocalizedText[];

  /** Canonical exemplar voice lines anchored to the persona's motto and values. */
  readonly signatureQuotes: readonly LocalizedText[];
}

/**
 * Immutable metadata characterizing a persona's identity, branding, platform presence,
 * and structured official master specifications.
 */
export interface PersonaMetadata {
  /** Unique canonical identifier for the persona (e.g. 'rebecca', 'alice'). */
  readonly id: string;

  /** Natural display name in native script used in conversation (e.g. 'レベッカ'). */
  readonly displayName: string;

  /** Latinized/English display name used in RAG transcripts and internationalized displays (e.g. 'Rebecca'). */
  readonly englishName: string;

  /** Character archetype and social role description (e.g. 'Gemitec Inc.製 自律型パーソナルAI（フラッグシップ機「Unit-001」）'). */
  readonly role: string;

  /** Linguistic tone and style description (e.g. '大人のお姉さんギャル'). */
  readonly toneDescription: string;

  /** Default vocative terms/honorifics used by the persona when addressing the human user. */
  readonly userCallsign: LocalizedText;

  /** Self-referential first-person pronouns used by the persona. */
  readonly firstPerson: LocalizedText;

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

  /** Structured basic profile master data (developer, modelNumber, birthday, height, weight, measurements, motto). */
  readonly profile: PersonaProfileSpec;

  /** Structured visual & appearance specifications (hair, eyes, skin, nails, scent, fashion). */
  readonly visuals: PersonaVisualSpec;

  /** Structured hardware & system specifications (architecture, IP68+, thermal 36.5-39.0C, wireless power, dietary, skills). */
  readonly hardware: PersonaHardwareSpec;

  /** Structured personality, core values, and empathetic safety circuit specifications. */
  readonly stance: PersonaStanceSpec;
}

/**
 * Top-level contract defining a full persona specification.
 * Any persona implementation must satisfy this interface to be mounted into the bot and dashboard engines.
 */
export interface IPersonaDefinition {
  /** Persona descriptive metadata, branding, and structured master specifications. */
  readonly metadata: PersonaMetadata;

  /**
   * Generates the pure Layer 0 core identity system prompt synthesized from structured `metadata`
   * without runtime channel/platform context rules.
   *
   * @param lang - Target language ('ja' or 'en'). Defaults to 'ja'.
   * @returns Formatted core identity and master specification prompt string.
   */
  getCoreIdentityPrompt(lang?: Language): string;

  /**
   * Generates the foundational system prompt combining core identity with platform-specific rules.
   *
   * @param context - The execution context ('reply', 'timeline', 'random_engagement', 'copilot', 'chat').
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
