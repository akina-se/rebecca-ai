import { buildSystemPrompt } from '../../src/core/contextInjector';
import { rebeccaPersona } from '@rebecca/persona';

// Mock time for deterministic tests
jest.mock('../../src/utils/time', () => ({
    getZonedDateParts: jest.fn(),
    formatZonedDateTime: jest.fn((date) => '2024-01-01 08:00 JST')
}));
import { getZonedDateParts, formatZonedDateTime } from '../../src/utils/time';

const createMockZonedParts = (hour: number) => ({
    year: '2024',
    month: '01',
    day: '01',
    hour: String(hour).padStart(2, '0'),
    minute: '00',
    second: '00',
    numericYear: 2024,
    numericMonth: 1,
    numericDay: 1,
    numericHour: hour,
    numericMinute: 0,
});

describe('Context Injector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should inject early morning context during 5:00-6:00', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(6));
        (formatZonedDateTime as jest.Mock).mockReturnValue('2024-01-01 06:00 JST');
        const prompt = buildSystemPrompt(rebeccaPersona, 'chat', { coreProfile: {}, episodicBuffer: [] }, 'おはよう');
        expect(prompt).toContain('【状況コンテキスト：早朝】\n現在は早朝です。');
        expect(prompt).toContain('【現在時刻】\n2024-01-01 06:00 JST');
        expect(prompt).toContain('【コンテキスト：マスターとの1対1対話】');
    });

    it('should inject morning context during 7:00-10:00', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(8));
        (formatZonedDateTime as jest.Mock).mockReturnValue('2024-01-01 08:00 JST');
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんにちは');
        expect(prompt).toContain('【状況コンテキスト：朝】\n現在は朝です。');
        expect(prompt).toContain('【現在時刻】\n2024-01-01 08:00 JST');
    });

    it('should inject daytime context during 11:00-16:00', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(13));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'お昼');
        expect(prompt).toContain('【状況コンテキスト：昼】\n現在は昼です。');
    });

    it('should inject evening context during 17:00-21:00', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(19));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'お疲れ様');
        expect(prompt).toContain('【状況コンテキスト：夕方・夜】\n現在は夕方・夜です。');
    });

    it('should inject night context during 22:00-4:00', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(23));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'こんばんは');
        expect(prompt).toContain('【状況コンテキスト：深夜】\n現在は深夜です。');

        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(3));
        const latePrompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, '眠れない');
        expect(latePrompt).toContain('【状況コンテキスト：深夜】\n現在は深夜です。');
    });

    it('should inject absence context if over 3 days', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(12));
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: fourDaysAgo }, '久しぶり');
        expect(prompt).toContain('状況コンテキスト：放置');
        expect(prompt).toContain('4日ぶり');
    });

    it('should inject English early morning context when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(5));
        const prompt = buildSystemPrompt(rebeccaPersona, 'chat', { coreProfile: {}, episodicBuffer: [] }, 'Good morning', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Early Morning]\nIt is early morning right now.');
        expect(prompt).toContain('[Context: 1-on-1 Dialogue with Master]');
    });

    it('should inject English morning context during 7:00-10:00 when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(8));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Hello', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Morning]\nIt is morning right now.');
    });

    it('should inject English daytime context when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(14));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Lunch time', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Daytime]\nIt is daytime right now.');
    });

    it('should inject English evening context when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(18));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Evening]\nIt is evening right now.');
    });

    it('should inject English night context during 22:00-4:00 when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(23));
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [] }, 'Good evening', '', '', [], 'en');
        expect(prompt).toContain('[Time Context: Late Night]\nIt is late at night right now.');
    });

    it('should inject English absence context if over 3 days when lang is en', () => {
        (getZonedDateParts as jest.Mock).mockReturnValue(createMockZonedParts(12));
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const prompt = buildSystemPrompt(rebeccaPersona, 'reply', { coreProfile: {}, episodicBuffer: [], lastReplyDate: fourDaysAgo }, 'Long time no see', '', '', [], 'en');
        expect(prompt).toContain('Context: Absence Reaction');
        expect(prompt).toContain('4 days');
    });
});

