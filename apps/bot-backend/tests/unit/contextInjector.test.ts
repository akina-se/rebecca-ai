import { buildSystemPrompt } from '../../src/core/contextInjector';
import { rebeccaPersona } from '@rebecca/persona';

// Mock time for deterministic tests
jest.mock('../../src/utils/time', () => ({
    getJSTDate: jest.fn(),
    formatJSTDateTime: jest.fn((date) => '2024-01-01 08:00 JST')
}));
import { getJSTDate, formatJSTDateTime } from '../../src/utils/time';

describe('Context Injector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should inject morning context during 7:00-9:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00'));
        (formatJSTDateTime as jest.Mock).mockReturnValue('2024-01-01 08:00 JST');
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんにちは');
        expect(prompt).toContain('現在時刻は朝（8時台）です。');
        expect(prompt).toContain('【現在時刻（JST）】\n2024-01-01 08:00 JST');
    });

    it('should inject night context during 22:00-2:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんばんは');
        expect(prompt).toContain('現在時刻は深夜（23時台）です。');
    });

    it('should inject absence context if over 3 days', () => {
        // Current date: Jan 5. Last reply: Jan 1. (4 days diff)
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: '2024-01-01T12:00:00' }, '久しぶり');
        expect(prompt).toContain('状況コンテキスト：放置');
        expect(prompt).toContain('4日ぶり');
    });

    it('should inject English morning context during 7:00-9:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Hello', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Morning (8:00)]');
    });

    it('should inject English night context during 22:00-2:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Late Night (23:00)]');
    });

    it('should inject English absence context if over 3 days when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: '2024-01-01T12:00:00' }, 'Long time no see', '', '', [], 'en');
        expect(prompt).toContain('Context: Absence Reaction');
        expect(prompt).toContain('4 days');
    });

});
