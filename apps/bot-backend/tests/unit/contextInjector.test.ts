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

    it('should inject early morning context during 5:00-6:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T06:00:00'));
        (formatJSTDateTime as jest.Mock).mockReturnValue('2024-01-01 06:00 JST');
        const prompt = buildSystemPrompt(rebeccaPersona, 'chat', { coreProfile: {}, episodicBuffer: [] }, 'おはよう');
        expect(prompt).toContain('【状況コンテキスト：早朝】\n現在は早朝です。');
        expect(prompt).toContain('【現在時刻（JST）】\n2024-01-01 06:00 JST');
        expect(prompt).toContain('【コンテキスト：マスターとの1対1対話】');
    });

    it('should inject morning context during 7:00-10:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00'));
        (formatJSTDateTime as jest.Mock).mockReturnValue('2024-01-01 08:00 JST');
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんにちは');
        expect(prompt).toContain('【状況コンテキスト：朝】\n現在は朝です。');
        expect(prompt).toContain('【現在時刻（JST）】\n2024-01-01 08:00 JST');
    });

    it('should inject daytime context during 11:00-16:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T13:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'お昼');
        expect(prompt).toContain('【状況コンテキスト：昼】\n現在は昼です。');
    });

    it('should inject evening context during 17:00-21:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T19:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'お疲れ様');
        expect(prompt).toContain('【状況コンテキスト：夕方・夜】\n現在は夕方・夜です。');
    });

    it('should inject night context during 22:00-4:00', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんばんは');
        expect(prompt).toContain('【状況コンテキスト：深夜】\n現在は深夜です。');

        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T03:00:00'));
        const latePrompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, '眠れない');
        expect(latePrompt).toContain('【状況コンテキスト：深夜】\n現在は深夜です。');
    });

    it('should inject absence context if over 3 days', () => {
        // Current date: Jan 5. Last reply: Jan 1. (4 days diff)
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: '2024-01-01T12:00:00' }, '久しぶり');
        expect(prompt).toContain('状況コンテキスト：放置');
        expect(prompt).toContain('4日ぶり');
    });

    it('should inject English early morning context when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T05:30:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'chat', { coreProfile: {}, episodicBuffer: [] }, 'Good morning', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Early Morning]\nIt is early morning right now.');
        expect(prompt).toContain('[Context: 1-on-1 Dialogue with Master]');
    });

    it('should inject English morning context during 7:00-10:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T08:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Hello', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Morning]\nIt is morning right now.');
    });

    it('should inject English daytime context when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T14:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Lunch time', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Daytime]\nIt is daytime right now.');
    });

    it('should inject English evening context when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T18:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Evening]\nIt is evening right now.');
    });

    it('should inject English night context during 22:00-4:00 when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T23:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Late Night]\nIt is late at night right now.');
    });

    it('should inject English absence context if over 3 days when lang is en', () => {
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-05T12:00:00'));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: '2024-01-01T12:00:00' }, 'Long time no see', '', '', [], 'en');
        expect(prompt).toContain('Context: Absence Reaction');
        expect(prompt).toContain('4 days');
    });

});
