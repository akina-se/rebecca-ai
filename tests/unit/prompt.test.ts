import { PromptContext, Language, getBasePrompt, getDreamingPrompt } from '../../src/core/prompt';
import * as promptModule from '../../src/core/prompt';

describe('prompt.ts exports verification', () => {
    test('should export getBasePrompt and getDreamingPrompt functions', () => {
        expect(typeof getBasePrompt).toBe('function');
        expect(typeof getDreamingPrompt).toBe('function');
    });

    test('should NOT export BASE_SYSTEM_PROMPT directly anymore (must use getBasePrompt)', () => {
        expect((promptModule as any).BASE_SYSTEM_PROMPT).toBeUndefined();
        expect((promptModule as any).BASE_SYSTEM_PROMPT_EN).toBeUndefined();
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
