import { PersonaPatternWithVector } from './personaPatternVectors';

export type PromptContext = 'reply' | 'timeline' | 'random_engagement' | 'copilot';
export type Language = 'ja' | 'en';

export interface PersonaPattern {
  id: number;
  category: string;
  trigger: string;
  internal_thought: string;
  behavior: string;
  sample_response: string;
}

export interface StructuredPersonaResponse {
  thought: string;
  reply: string;
}

export interface PersonaMetadata {
  readonly id: string;
  readonly displayName: string;
  readonly englishName: string;
  readonly role: string;
  readonly toneDescription: string;
  readonly userCallsign: {
    readonly ja: string;
    readonly en: string;
  };
  readonly firstPerson: {
    readonly ja: string;
    readonly en: string;
  };
  readonly defaultHashtag: string;
  readonly userAgent: string;
  readonly interests: readonly string[];
  readonly coreGuidelines: readonly string[];
  readonly adminTitle: string;
  readonly brandName: string;
  readonly avatarUrl: string;
}

export interface IPersonaDefinition {
  readonly metadata: PersonaMetadata;

  // Base identity and contextual behavioral rules
  getBasePrompt(context: PromptContext, lang: Language): string;
  getDreamingPrompt(): string;

  // Dynamic Anchors
  readonly patterns: PersonaPattern[];
  readonly patternVectors: PersonaPatternWithVector[];
  findTopPatterns(queryVector: number[], topK?: number): PersonaPattern[];
  buildFewShotPrompt(patterns: PersonaPattern[], lang?: Language): string;
  getFormattedPatternsText(): string;

  // Absence reaction instruction
  formatAbsenceInstruction(diffDays: number, lang: Language): string;
}
