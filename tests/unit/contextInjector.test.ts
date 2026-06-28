import { buildSystemPrompt  } from '../../src/core/contextInjector';

// Mock time for deterministic tests
jest.mock('../../src/utils/time', () => ({
    getJSTDate: jest.fn()
}));
import { getJSTDate  } from '../../src/utils/time';

describe('Context Injector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should inject morning context during 7:00-9:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00+09:00'));
        const prompt = buildSystemPrompt({}, 'こんにちは');
        expect(prompt).toContain('現在時刻は朝です');
    });

    it('should inject night context during 22:00-2:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00+09:00'));
        const prompt = buildSystemPrompt({}, 'こんばんは');
        expect(prompt).toContain('現在時刻は深夜です');
    });

    it('should inject absence context if over 3 days', () => {
        // Current date: Jan 5. Last reply: Jan 1. (4 days diff)
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00+09:00'));
        const prompt = buildSystemPrompt({ last_reply_date: '2024-01-01T12:00:00+09:00' }, '久しぶり');
        expect(prompt).toContain('状況コンテキスト：放置');
        expect(prompt).toContain('4日ぶり');
    });

    it('should inject English morning context during 7:00-9:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00+09:00'));
        const prompt = buildSystemPrompt({}, 'Hello', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Morning]');
    });

    it('should inject English night context during 22:00-2:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00+09:00'));
        const prompt = buildSystemPrompt({}, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Late Night]');
    });

    it('should inject English absence context if over 3 days when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00+09:00'));
        const prompt = buildSystemPrompt({ last_reply_date: '2024-01-01T12:00:00+09:00' }, 'Long time no see', '', '', [], 'en');
        expect(prompt).toContain('Context: Master has been absent');
        expect(prompt).toContain('4 days');
    });

});
