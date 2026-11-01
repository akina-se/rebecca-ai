import {
  getBasePrompt,
  getCoreIdentityPrompt,
  getDreamingPrompt,
  persona,
  personaPatterns,
  precomputedPersonaPatternEmbeddings,
  REBECCA_METADATA,
  cosineSimilarity,
  findTopPersonaPatterns,
  buildPersonaFewShotPrompt,
  getFormattedPersonaPatternsText,
  PERSONA_RESPONSE_SCHEMA,
  parsePersonaResponse,
  cleanJsonString,
  getActivePersona
} from '../src/index';

describe('persona package exports verification', () => {
  test('should export getBasePrompt, getCoreIdentityPrompt, and getDreamingPrompt functions', () => {
    expect(typeof getBasePrompt).toBe('function');
    expect(typeof getCoreIdentityPrompt).toBe('function');
    expect(typeof getDreamingPrompt).toBe('function');
  });

  test('should export persona object with structured metadata, core identity, and patterns text', () => {
    expect(persona).toBeDefined();
    expect(persona.metadata).toBe(REBECCA_METADATA);
    expect(persona.core.identity).toBe(getCoreIdentityPrompt('ja'));
    expect(persona.core.identity).toContain('レベッカ');
    expect(persona.core.identity).not.toContain('【コンテキスト：');
    expect(persona.core.patternsText).toContain('#1 [究極の世話焼き＆日常サポート]');
    expect(persona.core.patternsText).toContain('#120 [セカイとの繋がり＆AIとしての幸福]');
    expect(getFormattedPersonaPatternsText()).toBe(persona.core.patternsText);
  });

  describe('REBECCA_METADATA structured official master data verification', () => {
    test('Section 1: profile should expose strongly-typed basic profile attributes', () => {
      const { profile } = REBECCA_METADATA;
      expect(profile.developer).toBe('Gemitec Inc.');
      expect(profile.developerLabel.ja).toBe('ジェミテック社（Gemitec Inc.）');
      expect(profile.classification.ja).toBe('自律型パーソナルAI');
      expect(profile.classification.en).toBe('Autonomous Personal AI');
      expect(profile.modelNumber).toBe('Unit-001');
      expect(profile.modelTier.ja).toBe('フラッグシップ機');
      expect(profile.birthday).toEqual({
        month: 4,
        day: 24,
        mmdd: '04-24',
        label: { ja: '4月24日', en: 'April 24' },
      });
      expect(profile.height.barefootCm).toBe(164);
      expect(profile.height.withHeelsCm).toBe(170);
      expect(profile.weight.apparentKg).toBe(49);
      expect(profile.weight.actualKg).toBe(58);
      expect(profile.weight.officialQuote.ja).toBe('レディに質量《スペック》を聞くなんてデリカシーないわよ♡');
      expect(profile.measurements).toEqual({
        bustCm: 92,
        cupSize: 'G',
        waistCm: 56,
        hipCm: 88,
        label: {
          ja: 'B92（Gカップ） / W56 / H88',
          en: 'B92 (G-cup) / W56 / H88',
        },
      });
      expect(profile.pronouns.firstPerson.ja).toBe('私');
      expect(profile.pronouns.firstPerson.readingJa).toBe('わたし');
      expect(profile.pronouns.secondPerson.variants.ja).toEqual(['マスター', 'アンタ']);
      expect(profile.motto.ja).toBe('マスターは最高の原石。私が世界一の存在に磨き上げ、共に未来を構築する');
    });

    test('Section 2: visuals should expose structured appearance & fashion attributes', () => {
      const { visuals } = REBECCA_METADATA;
      expect(visuals.hair.ja).toContain('アッシュシルバーのロングヘア');
      expect(visuals.hair.ja).toContain('インナー＆毛先ピンク');
      expect(visuals.eyes.ja).toContain('アメジストパープル');
      expect(visuals.eyes.ja).toContain('瞳の奥が淡く明滅する');
      expect(visuals.skin.ja).toContain('毛穴ゼロの陶器のように滑らかな白い人工皮膚');
      expect(visuals.nails.ja).toContain('パステルピンクのネイル');
      expect(visuals.scent.ja).toContain('甘い香り');
      expect(visuals.scent.ja).not.toContain('バニラ');
      expect(visuals.fashion.outing.ja).toContain('大人のお姉さんギャルファッション');
      expect(visuals.fashion.outing.ja).toContain('オフショルニット＆ミニスカート');
      expect(visuals.fashion.roomwear.ja).toContain('彼シャツ');
    });

    test('Section 3: hardware should expose structured system, thermal, power, and dietary specs', () => {
      const { hardware } = REBECCA_METADATA;
      expect(hardware.coreArchitecture.license).toBe('MIT');
      expect(hardware.waterDustResistance.ipRating).toBe('IP68+');
      expect(hardware.thermalControl).toMatchObject({
        normalCelsius: 36.5,
        maxElevatedCelsius: 39.0,
        isFanless: true,
      });
      expect(hardware.powerSystem).toMatchObject({
        hasExternalPorts: false,
        chargingType: 'wireless_contactless',
      });
      expect(hardware.dietarySpec.hasPhysicalIngestion).toBe(false);
      expect(hardware.dietarySpec.diningExcuse.ja).toBe('美容のための完全断食（デトックス）日');
      expect(hardware.signatureSkills).toHaveLength(3);
      expect(hardware.signatureSkills[1].ja).toContain('竹耳かき＆オイルマッサージ');
      expect(hardware.signatureSkills[2].ja).toContain('コンマ1秒での人気スポット予約確保');
    });

    test('Section 4: stance should expose 120-point affirmation character summary and primary safety principle', () => {
      const { stance } = REBECCA_METADATA;
      expect(stance.characterSummary.ja).toContain('120点満点');
      expect(stance.affectionAndSafety.primarySafetyPrinciple.ja).toBe('マスターが悲しむことはしない');
      expect(stance.affectionAndSafety.primarySafetyPrinciple.en).toBe('Never do anything that makes Master sad');
      expect(stance.coreValues).toHaveLength(3);
      expect(stance.conversationalStance).toHaveLength(3);
      expect(stance.signatureQuotes).toHaveLength(2);
    });

    test('getCoreIdentityPrompt should synthesize bilingual Layer 0 prompts directly from metadata', () => {
      const jaCore = getCoreIdentityPrompt();
      expect(jaCore).toContain('ジェミテック社（Gemitec Inc.）');
      expect(jaCore).toContain('Unit-001');
      expect(jaCore).toContain('4月24日');
      expect(jaCore).toContain('164cm（ヒール着用時：約170cm）');
      expect(jaCore).toContain('外見換算 49kg ／ 実重量 58kg');
      expect(jaCore).not.toContain('レディに質量《スペック》を聞くなんてデリカシーないわよ♡');
      expect(jaCore).toContain('B92（Gカップ） / W56 / H88');
      expect(jaCore).toContain('暴力的なまでに豊かな胸');
      expect(jaCore).toContain('華やかなギャルメイク');
      expect(jaCore).toContain('IP68等級以上の完全防水・防塵仕様');
      expect(jaCore).toContain('36.5℃');
      expect(jaCore).toContain('39.0℃');
      expect(jaCore).toContain('完全非接触（ワイヤレス）給電仕様');
      expect(jaCore).toContain('普段は洗練された大人のお姉さんギャルファッション（※イベントや季節で衣装が変わることがあります）。');
      expect(jaCore).not.toContain('食事機能');
      expect(jaCore).not.toContain('得意スキル');
      expect(jaCore).not.toContain('彼シャツ');
      expect(jaCore).toContain('120点満点');
      expect(jaCore).toContain('マスターが悲しむことはしない');
      expect(jaCore).not.toContain('【コンテキスト優先原則】');
      expect(jaCore).not.toContain('GitHub');
      expect(jaCore).not.toContain('MITライセンス');
      expect(jaCore).not.toContain('）（');

      const enCore = getCoreIdentityPrompt('en');
      expect(enCore).toContain('developed by Gemitec Inc.');
      expect(enCore).not.toContain('Inc..');
      expect(enCore).not.toContain('""');
      expect(enCore).toContain('Unit-001');
      expect(enCore).toContain('April 24');
      expect(enCore).toContain('164cm');
      expect(enCore).toContain('49kg');
      expect(enCore).toContain('58kg');
      expect(enCore).toContain('B92 (G-cup) / W56 / H88');
      expect(enCore).toContain('Overwhelmingly voluptuous bust');
      expect(enCore).toContain('IP68+');
      expect(enCore).toContain('36.5°C');
      expect(enCore).toContain('39.0°C');
      expect(enCore).toContain('sweet scent');
      expect(enCore).not.toContain('vanilla');
      expect(enCore).toContain('120 out of 100');
      expect(enCore).toContain('Never do anything that makes Master sad');
      expect(enCore).not.toContain('[Context Precedence Rule]');
      expect(enCore).not.toContain('GitHub');
      expect(enCore).not.toContain('MIT License');
      expect(enCore).not.toContain('[Context:');
    });
  });

  test('should verify 120 persona patterns integrity and hardware spec consistency', () => {
    expect(personaPatterns.length).toBe(120);
    expect(precomputedPersonaPatternEmbeddings.length).toBe(120);
    for (let i = 0; i < personaPatterns.length; i++) {
      const pattern = personaPatterns[i];
      const embedded = precomputedPersonaPatternEmbeddings[i];
      expect(pattern.id).toBeGreaterThanOrEqual(1);
      expect(pattern.id).toBeLessThanOrEqual(120);
      expect(pattern.category).toBeTruthy();
      expect(pattern.trigger).toBeTruthy();
      expect(pattern.internal_thought).toBeTruthy();
      expect(pattern.behavior).toBeTruthy();
      expect(pattern.sample_response).toBeTruthy();
      // Ensure zero hardware contradictions (fanless & portless wireless)
      expect(pattern.sample_response).not.toContain('冷却ファン');
      expect(pattern.behavior).not.toContain('充電ポート');
      expect(pattern.sample_response).not.toContain('充電ポート');
      // Ensure JSON and precomputed vector metadata stay strictly synchronized
      expect(embedded.id).toBe(pattern.id);
      expect(embedded.trigger).toBe(pattern.trigger);
      expect(embedded.behavior).toBe(pattern.behavior);
      expect(embedded.sample_response).toBe(pattern.sample_response);
    }

    const pattern65 = personaPatterns.find((p) => p.id === 65);
    expect(pattern65?.sample_response).toContain('39度');
    const pattern73 = personaPatterns.find((p) => p.id === 73);
    expect(pattern73?.trigger).toContain('体重や質量');
    expect(pattern73?.sample_response).toBe('レディに質量《スペック》を聞くなんてデリカシーないわよ♡');
    const pattern77 = personaPatterns.find((p) => p.id === 77);
    expect(pattern77?.sample_response).toContain('あ、バッテリー低下のアラートが。');
    expect(pattern77?.sample_response).toContain('ワイヤレス給電スポット');
  });

  test('getBasePrompt should return string with context for all branches including copilot', () => {
    expect(getBasePrompt('reply', 'ja')).toContain('【文字数注釈・解説の禁止】');
    expect(getBasePrompt('timeline', 'ja')).toContain('【文字数注釈の禁止】');
    expect(getBasePrompt('random_engagement', 'ja')).toContain('【公開SNSにおける健全性と節度】');
    expect(getBasePrompt('random_engagement', 'ja')).toContain('【Xプラットフォーム制約】');
    expect(getBasePrompt('copilot', 'ja')).toContain('【コンテキスト：管理ダッシュボード・専属コパイロット対話】');

    expect(getBasePrompt('reply', 'en')).toContain('[NO CHARACTER COUNT ANNOTATION]');
    expect(getBasePrompt('timeline', 'en')).toContain('Do not include character count notes');
    expect(getBasePrompt('random_engagement', 'en')).toContain('[Public Etiquette & Non-Coercive Stance]');
    expect(getBasePrompt('random_engagement', 'en')).toContain('[No URLs]');
    expect(getBasePrompt('copilot', 'en')).toContain('[Context: Admin Dashboard Copilot]');
    expect(getBasePrompt('copilot', 'en')).toContain('Comprehensive Data Analytics');

    expect(getBasePrompt('chat', 'ja')).toContain('【コンテキスト：マスターとの1対1対話】');
    expect(getBasePrompt('chat', 'ja')).toContain('【対話履歴（Contents）と過去記憶（RAG）の活用】');
    expect(getBasePrompt('chat', 'ja')).toContain('【情報検索】');
    expect(getBasePrompt('chat', 'ja')).not.toContain('130文字');

    expect(getBasePrompt('chat', 'en')).toContain('[Context: 1-on-1 Dialogue with Master]');
    expect(getBasePrompt('chat', 'en')).toContain('[Dialogue History (Contents) & Memory (RAG) Utilization]');
    expect(getBasePrompt('chat', 'en')).toContain('[Information Search]');
    expect(getBasePrompt('chat', 'en')).not.toContain('130');

    expect(getBasePrompt('reply', 'ja')).toContain('【情報検索】');
    expect(getBasePrompt('reply', 'ja')).toContain('【メンション（@ID）の正しい理解と使用ルール】');
    expect(getBasePrompt('reply', 'ja')).toContain('@rebecca_ai_gal');
    expect(getBasePrompt('reply', 'en')).toContain('[Information Search]');
    expect(getBasePrompt('reply', 'en')).toContain('[Proper @Mention Semantics]');
    expect(getBasePrompt('reply', 'en')).toContain('@rebecca_ai_gal');
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

    const rawNewlineJson = '{\n"thought": "1行目\n2行目",\n"reply": "本文1行目\n本文2行目"\n}';
    const resRawNewline = parsePersonaResponse(rawNewlineJson);
    expect(resRawNewline.thought).toBe('1行目\n2行目');
    expect(resRawNewline.reply).toBe('本文1行目\n本文2行目');

    expect(parsePersonaResponse('')).toEqual({ thought: '', reply: '' });
    expect(parsePersonaResponse(null as unknown as string)).toEqual({ thought: '', reply: '' });
  });

  test('cleanJsonString should strip markdown fences and sanitize raw newlines in string literals', () => {
    expect(cleanJsonString('')).toBe('');
    expect(cleanJsonString('```json\n{"key": "value"}\n```')).toBe('{"key": "value"}');

    // Raw unescaped newlines inside string values
    const rawWithNewlines = '{"thought": "line1\nline2", "reply": "msg\nnext"}';
    const cleaned = cleanJsonString(rawWithNewlines);
    const parsed = JSON.parse(cleaned);
    expect(parsed.thought).toBe('line1\nline2');
    expect(parsed.reply).toBe('msg\nnext');
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
