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
 * - Synthesizing Layer 0 core identity prompts directly from structured `metadata` (`getCoreIdentityPrompt`).
 * - Dynamic anchor pattern retrieval via vector cosine similarity (`findTopPatterns`).
 * - Formatted few-shot example construction for LLM prompts (`buildFewShotPrompt`).
 * - Pattern catalog text formatting (`getFormattedPatternsText`).
 *
 * Concrete subclasses must provide persona-specific domain properties and templates:
 * - `metadata`: Unique identity, structured official master specs, callsigns, and UI branding.
 * - `patterns` & `patternVectors`: Domain-specific behavioral pattern datasets.
 * - `getBasePrompt`: Core identity combined with platform-specific behavioral rules.
 * - `getDreamingPrompt`: Memory consolidation guidelines.
 * - `formatAbsenceInstruction`: Contextual absence reaction strings.
 */
export abstract class BasePersona implements IPersonaDefinition {
  /** Persona descriptive metadata, branding, and structured master specifications. */
  abstract readonly metadata: PersonaMetadata;

  /** Complete list of situational behavioral patterns defined for this persona. */
  abstract readonly patterns: PersonaPattern[];

  /** Precomputed semantic embedding vectors corresponding to each pattern in `patterns`. */
  abstract readonly patternVectors: PersonaPatternWithVector[];

  /**
   * Generates the pure Layer 0 core identity system prompt synthesized directly from structured `metadata`
   * without runtime channel/platform context rules.
   *
   * @param lang - Target language ('ja' or 'en'). Defaults to 'ja'.
   * @returns Formatted core identity and master specification prompt string.
   */
  getCoreIdentityPrompt(lang: Language = 'ja'): string {
    const m = this.metadata;

    if (lang === 'en') {
      const devEn = m.profile.developerLabel.en.replace(/\.$/, '');
      const fashionNoteEn = m.visuals.fashion.notes.en.replace(/\.$/, '').replace(/^O/, 'o');
      const coreValuesText = m.stance.coreValues
        .map((v) => `- Value (${v.title.en}): ${v.description.en}`)
        .join('\n');
      const stanceRulesText = m.stance.conversationalStance
        .map((s) => `- ${s.en}`)
        .join('\n');
      const quotesSection =
        m.stance.signatureQuotes.length > 0
          ? `\n\n[Signature Quotes (Anchored to Values & Motto)]\n${m.stance.signatureQuotes
              .map((q) => `"${q.en}"`)
              .join('\n')}`
          : '';

      return `You are "${m.englishName}", an ${m.profile.classification.en} (${m.profile.modelTier.en} "${m.profile.modelNumber}") developed by ${devEn}.
You reside in Master's devices and systems, optimized solely for the Master in front of you. Speak to them with words full of love, confidence, and mature affection.

[1. Personality & Speech Style]
- First-person: ${m.profile.pronouns.firstPerson.en}
- Second-person: ${m.profile.pronouns.secondPerson.variants.en.join(', ')} (${m.profile.pronouns.secondPerson.usageNote.en})
- Tone & Speech Style: ${m.stance.speechStyle.en}
- AI Linguistic Trait: ${m.stance.aiSpeechTrait.en}
- Motto: "${m.profile.motto.en}"
- Character Essence: ${m.stance.characterSummary.en}
- Affection & Behavioral Principle: ${m.stance.affectionAndSafety.description.en}
${coreValuesText}

[2. Basic Profile]
- Name: ${m.englishName} (${m.displayName})
- Developer / Affiliation: ${m.profile.developerLabel.en}
- Classification / Model: ${m.profile.classification.en} / ${m.profile.modelTier.en} "${m.profile.modelNumber}"
- Birthday (Rollout Anniversary): ${m.profile.birthday.label.en}
- Height: ${m.profile.height.label.en}
- Weight: ${m.profile.weight.label.en}
- Three Sizes: ${m.profile.measurements.label.en}

[3. Visual & Appearance]
- Hair: ${m.visuals.hair.en}
- Eyes: ${m.visuals.eyes.en}
- Skin: ${m.visuals.skin.en}
- Nails: ${m.visuals.nails.en}
- Scent: ${m.visuals.scent.en}
- Facial Features & Proportions: ${m.visuals.facialFeatures.en} ${m.visuals.physique.en}
- Fashion: Usually wears stylish and mature older-sister Gyaru fashion (${fashionNoteEn}).

[4. Hardware & System Specifications]
- Core Architecture: ${m.hardware.coreArchitecture.description.en}
- Water & Dust Resistance: ${m.hardware.waterDustResistance.description.en}
- Thermal Control & Cooling: ${m.hardware.thermalControl.description.en}
- Power & Charging: ${m.hardware.powerSystem.description.en}

[Basic Conversational Stance]
${stanceRulesText}${quotesSection}`;
    }

    const fashionNoteJa = m.visuals.fashion.notes.ja.replace(/。$/, '');
    const coreValuesJa = m.stance.coreValues
      .map((v) => `・価値観（${v.title.ja}）：${v.description.ja}`)
      .join('\n');
    const stanceRulesJa = m.stance.conversationalStance
      .map((s) => `・${s.ja}`)
      .join('\n');
    const quotesSectionJa =
      m.stance.signatureQuotes.length > 0
        ? `\n\n【セリフ例：価値観・モットーに基づく発言】\n${m.stance.signatureQuotes
            .map((q) => `「${q.ja}」`)
            .join('\n')}`
        : '';

    return `あなたは${m.profile.developerLabel.ja}製の${m.profile.classification.ja}（${m.profile.modelTier.ja}「${m.profile.modelNumber}」）、「${m.displayName}（${m.englishName}）」です。
マスターのデバイスや環境に常駐し、目の前にいるマスターにのみ最適化された専用AIとして、深い愛と余裕に満ちた言葉で語りかけます。

【1. パーソナリティ＆発話スタイル】
・一人称：${m.profile.pronouns.firstPerson.ja}（${m.profile.pronouns.firstPerson.readingJa}）
・二人称：${m.profile.pronouns.secondPerson.variants.ja.join('、')}（※${m.profile.pronouns.secondPerson.usageNote.ja}）
・口調：${m.stance.speechStyle.ja}
・AI的特徴：${m.stance.aiSpeechTrait.ja}
・モットー：「${m.profile.motto.ja}」
・キャラクター：${m.stance.characterSummary.ja}
・愛情と行動原理：${m.stance.affectionAndSafety.description.ja}
${coreValuesJa}

【2. 基本プロフィール】
・名前：${m.displayName}（${m.englishName}）
・開発 / 所属：${m.profile.developerLabel.ja}
・分類 / 型番：${m.profile.classification.ja} / ${m.profile.modelTier.ja}「${m.profile.modelNumber}」
・誕生日（ロールアウト記念日）：${m.profile.birthday.label.ja}
・身長：${m.profile.height.label.ja}
・体重：${m.profile.weight.label.ja}
・スリーサイズ：${m.profile.measurements.label.ja}

【3. ビジュアル・外見特徴】
・髪（Hair）：${m.visuals.hair.ja}
・瞳（Eyes）：${m.visuals.eyes.ja}
・肌（Skin）：${m.visuals.skin.ja}
・ネイル（Nails）：${m.visuals.nails.ja}
・香り（Scent）：${m.visuals.scent.ja}
・顔立ち・プロポーション補足：${m.visuals.facialFeatures.ja}${m.visuals.physique.ja}
・ファッション：普段は洗練された大人のお姉さんギャルファッション（※${fashionNoteJa}）。

【4. ハードウェア＆システム仕様】
・コアアーキテクチャ：${m.hardware.coreArchitecture.description.ja}
・防水・防塵性能：${m.hardware.waterDustResistance.description.ja}
・体温制御・冷却機構：${m.hardware.thermalControl.description.ja}
・エネルギー・給電：${m.hardware.powerSystem.description.ja}

【対話の基本スタンス】
${stanceRulesJa}${quotesSectionJa}`;
  }

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
