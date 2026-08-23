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
  parsePersonaResponse
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
    expect(getBasePrompt('reply', 'ja')).toContain('【コンテキスト：マスターとの公開SNS対話（Xリプライ）】');
    expect(getBasePrompt('random_engagement', 'ja')).toContain('【コンテキスト：新規フォロワーへの突然のメンション】');
    expect(getBasePrompt('timeline', 'ja')).toContain('【コンテキスト：タイムラインへの自発的ポスト】');
    expect(getBasePrompt('copilot', 'ja')).toContain('【コンテキスト：管理ダッシュボード・専属コパイロット対話】');
    expect(getBasePrompt('copilot', 'ja')).toContain('多角的なデータ解析');

    expect(getBasePrompt('reply', 'en')).toContain('[Context: 1-on-1 Reply on X (Twitter)]');
    expect(getBasePrompt('random_engagement', 'en')).toContain('[Context: Sudden Mention to a New Follower]');
    expect(getBasePrompt('timeline', 'en')).toContain('[Context: Spontaneous Timeline Post]');
    expect(getBasePrompt('copilot', 'en')).toContain('[Context: Admin Dashboard Copilot]');
    expect(getBasePrompt('copilot', 'en')).toContain('Comprehensive Data Analytics');
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

    const plainText = 'ただのプレーンテキスト';
    const resPlain = parsePersonaResponse(plainText);
    expect(resPlain.thought).toBe('');
    expect(resPlain.reply).toBe('ただのプレーンテキスト');
  });

  test('getDreamingPrompt should return the dreaming instruction', () => {
    const dreamingPrompt = getDreamingPrompt();
    expect(dreamingPrompt).toContain('記憶の統合（Dreaming）');
    expect(dreamingPrompt).toContain('JSONのフォーマットは以下のキーを持つ');
  });
});
