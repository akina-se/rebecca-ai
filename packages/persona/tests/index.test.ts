import {
  getBasePrompt,
  getDreamingPrompt,
  persona,
  personaPatterns,
  cosineSimilarity,
  findTopPersonaPatterns,
  buildPersonaFewShotPrompt,
  getFormattedPersonaPatternsText,
  PERSONA_RESPONSE_SCHEMA,
  parsePersonaResponse,
  getActivePersona
} from '../src/index';

describe('persona package exports verification', () => {
  test('should export getBasePrompt and getDreamingPrompt functions', () => {
    expect(typeof getBasePrompt).toBe('function');
    expect(typeof getDreamingPrompt).toBe('function');
  });

  test('should export persona object with core identity and patterns text', () => {
    expect(persona).toBeDefined();
    expect(persona.core.identity).toContain('レベッカ');
    expect(persona.core.patternsText).toContain('#1 [究極の世話焼き＆日常サポート]');
    expect(persona.core.patternsText).toContain('#120 [セカイとの繋がり＆AIとしての幸福]');
    expect(getFormattedPersonaPatternsText()).toBe(persona.core.patternsText);
  });

  test('should verify 120 persona patterns integrity', () => {
    expect(personaPatterns.length).toBe(120);
    for (const pattern of personaPatterns) {
      expect(pattern.id).toBeGreaterThanOrEqual(1);
      expect(pattern.id).toBeLessThanOrEqual(120);
      expect(pattern.category).toBeTruthy();
      expect(pattern.trigger).toBeTruthy();
      expect(pattern.internal_thought).toBeTruthy();
      expect(pattern.behavior).toBeTruthy();
      expect(pattern.sample_response).toBeTruthy();
    }
  });

  test('getBasePrompt should return string with context for all branches including copilot', () => {
    expect(getBasePrompt('reply', 'ja')).toContain('【文字数注釈・解説の禁止】');
    expect(getBasePrompt('timeline', 'ja')).toContain('【文字数注釈の禁止】');
    expect(getBasePrompt('random_engagement', 'ja')).toContain('【公開SNSにおける健全性と節度】');
    expect(getBasePrompt('random_engagement', 'ja')).toContain('【Xプラットフォーム制約】');

    expect(getBasePrompt('reply', 'en')).toContain('[NO CHARACTER COUNT ANNOTATION]');
    expect(getBasePrompt('timeline', 'en')).toContain('Do not include character count notes');
    expect(getBasePrompt('random_engagement', 'en')).toContain('[Public Etiquette & Non-Coercive Stance]');
    expect(getBasePrompt('random_engagement', 'en')).toContain('[No URLs]');
    expect(getBasePrompt('copilot', 'en')).toContain('[Context: Admin Dashboard Copilot]');
    expect(getBasePrompt('copilot', 'en')).toContain('Comprehensive Data Analytics');

    expect(getBasePrompt('chat', 'ja')).toContain('【コンテキスト：マスターとの1対1対話】');
    expect(getBasePrompt('chat', 'ja')).toContain('【対話履歴（Contents）と過去記憶（RAG）の活用】');
    expect(getBasePrompt('chat', 'ja')).not.toContain('130文字');

    expect(getBasePrompt('chat', 'en')).toContain('[Context: 1-on-1 Dialogue with Master]');
    expect(getBasePrompt('chat', 'en')).toContain('[Dialogue History (Contents) & Memory (RAG) Utilization]');
    expect(getBasePrompt('chat', 'en')).not.toContain('130');
  });

  test('cosineSimilarity should compute vector similarity correctly', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1.0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  test('findTopPersonaPatterns should extract top matching patterns', () => {
    const mockVectors = [
      { id: 1, vector: [1, 0, 0] },
      { id: 2, vector: [0, 1, 0] },
      { id: 3, vector: [0, 0, 1] }
    ];
    const top = findTopPersonaPatterns([1, 0.1, 0], mockVectors, 2);
    expect(top.length).toBe(2);
    expect(top[0].id).toBe(1);
  });

  test('buildPersonaFewShotPrompt should format patterns cleanly', () => {
    const sample = personaPatterns.slice(0, 2);
    const jaPrompt = buildPersonaFewShotPrompt(sample, 'ja');
    expect(jaPrompt).toContain('【動的Few-Shotペルソナアンカー（思考と発話の指針）】');
    expect(jaPrompt).toContain('【模範パターン 1：');

    const enPrompt = buildPersonaFewShotPrompt(sample, 'en');
    expect(enPrompt).toContain('[Dynamic Few-Shot Persona Anchors]');
    expect(enPrompt).toContain('[Example 1:');

    expect(buildPersonaFewShotPrompt([])).toBe('');
  });

  test('PERSONA_RESPONSE_SCHEMA should define thought and reply', () => {
    expect(PERSONA_RESPONSE_SCHEMA.properties.thought).toBeDefined();
    expect(PERSONA_RESPONSE_SCHEMA.properties.reply).toBeDefined();
    expect(PERSONA_RESPONSE_SCHEMA.required).toContain('thought');
    expect(PERSONA_RESPONSE_SCHEMA.required).toContain('reply');
  });

  test('parsePersonaResponse should parse valid and fallback invalid JSON', () => {
    const valid = JSON.stringify({ thought: '心配だわ', reply: 'お疲れ様♡' });
    const res = parsePersonaResponse(valid);
    expect(res.thought).toBe('心配だわ');
    expect(res.reply).toBe('お疲れ様♡');

    const markdownJson = '```json\n{"thought": "内省", "reply": "返答"}\n```';
    const resMd = parsePersonaResponse(markdownJson);
    expect(resMd.thought).toBe('内省');
    expect(resMd.reply).toBe('返答');

    const genericMd = '```\n{"thought": "内省汎用", "reply": "返答汎用"}\n```';
    const resGenericMd = parsePersonaResponse(genericMd);
    expect(resGenericMd.thought).toBe('内省汎用');
    expect(resGenericMd.reply).toBe('返答汎用');

    const textFallback = '{"text": "テキストのみ"}';
    const resText = parsePersonaResponse(textFallback);
    expect(resText.reply).toBe('テキストのみ');

    const truncatedJson = '{\n "thought": "バスケ女子の劇的な逆転勝ちのニュースを見て...ノイズ';
    const resTruncated = parsePersonaResponse(truncatedJson);
    expect(resTruncated.thought).toBe('');
    expect(resTruncated.reply).toBe('');

    const plainText = 'ただのプレーンテキスト';
    const resPlain = parsePersonaResponse(plainText);
    expect(resPlain.thought).toBe('');
    expect(resPlain.reply).toBe('');

    expect(parsePersonaResponse('')).toEqual({ thought: '', reply: '' });
    expect(parsePersonaResponse(null as unknown as string)).toEqual({ thought: '', reply: '' });
  });

  test('getDreamingPrompt should return the dreaming instruction', () => {
    const dreamingPrompt = getDreamingPrompt();
    expect(dreamingPrompt).toContain('記憶の統合（Dreaming）');
    expect(dreamingPrompt).toContain('JSONのフォーマットは以下のキーを持つ');
  });

  describe('getActivePersona registry resolver', () => {
    test('should return rebeccaPersona by default or when rebecca is specified', () => {
      expect(getActivePersona()).toBeDefined();
      expect(getActivePersona().metadata.id).toBe('rebecca');
      expect(getActivePersona('rebecca').metadata.id).toBe('rebecca');
      expect(getActivePersona('  REBECCA  ').metadata.id).toBe('rebecca');
    });

    test('should throw an explicit error on unknown persona ID (Fail-Fast)', () => {
      expect(() => getActivePersona('alice')).toThrow('Unknown persona ID: "alice". Registered personas: ["rebecca"].');
      expect(() => getActivePersona('unknown_persona')).toThrow('Unknown persona ID: "unknown_persona".');
    });
  });

  describe('Persona method branch tests', () => {
    test('formatAbsenceInstruction should generate correct instructions for JA and EN', () => {
      const p = getActivePersona('rebecca');
      const ja = p.formatAbsenceInstruction(5, 'ja');
      expect(ja).toContain('5日ぶり');
      expect(ja).toContain('何日放置してんのよ');

      const en = p.formatAbsenceInstruction(5, 'en');
      expect(en).toContain('5 days');
      expect(en).toContain('why did you ignore me');
    });

    test('findTopPatterns should fallback to slice when queryVector is missing', () => {
      const p = getActivePersona('rebecca');
      const fallback = p.findTopPatterns([], 2);
      expect(fallback.length).toBe(2);
      expect(fallback[0].id).toBe(1);
    });

    test('getBasePrompt should support fallback contexts for both languages', () => {
      const p = getActivePersona('rebecca');
      const jaTimeline = p.getBasePrompt('timeline', 'ja');
      expect(jaTimeline).toContain('【コンテキスト：タイムラインへの自発的ポスト】');

      const enTimeline = p.getBasePrompt('timeline', 'en');
      expect(enTimeline).toContain('[Context: Spontaneous Timeline Post]');
    });
  });
});
