import { getBasePrompt, getDreamingPrompt, persona } from '../src/index';

describe('persona package exports verification', () => {
    test('should export getBasePrompt and getDreamingPrompt functions', () => {
        expect(typeof getBasePrompt).toBe('function');
        expect(typeof getDreamingPrompt).toBe('function');
    });

    test('should export persona object', () => {
        expect(persona).toBeDefined();
        expect(persona.core.identity).toContain('レベッカ');
    });

    test('getBasePrompt should return string with context for all branches', () => {
        expect(getBasePrompt('reply', 'ja')).toContain('【コンテキスト：マスターとの対話（リプライ）】');
        expect(getBasePrompt('random_engagement', 'ja')).toContain('【コンテキスト：新規フォロワーへの突然のメンション】');
        expect(getBasePrompt('timeline', 'ja')).toContain('【コンテキスト：タイムラインへの自発的ポスト】');

        expect(getBasePrompt('reply', 'en')).toContain('[Context: Direct Reply to Master]');
        expect(getBasePrompt('random_engagement', 'en')).toContain('[Context: Sudden Mention to a New Follower]');
        expect(getBasePrompt('timeline', 'en')).toContain('[Context: Spontaneous Timeline Post]');
    });

    test('getDreamingPrompt should return the dreaming instruction', () => {
        const dreamingPrompt = getDreamingPrompt();
        expect(dreamingPrompt).toContain('記憶の統合（Dreaming）');
        expect(dreamingPrompt).toContain('JSONのフォーマットは以下のキーを持つ');
    });
});
