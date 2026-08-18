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

    test('getBasePrompt should return string with context', () => {
        const jaPrompt = getBasePrompt('reply', 'ja');
        expect(jaPrompt).toContain('公開SNS（X/Twitter）であるため');
        
        const enPrompt = getBasePrompt('reply', 'en');
        expect(enPrompt).toContain('public SNS');
    });

    test('getDreamingPrompt should return the dreaming instruction', () => {
        const dreamingPrompt = getDreamingPrompt();
        expect(dreamingPrompt).toContain('記憶の統合（Dreaming）');
        expect(dreamingPrompt).toContain('JSONのフォーマットは以下のキーを持つ');
    });
});
