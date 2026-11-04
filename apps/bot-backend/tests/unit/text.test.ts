import {
    extractCleanTextForLanguageDetection,
    getTwitterTextWeightedLength,
    truncateTwitterText,
    TWITTER_MAX_WEIGHTED_LENGTH,
} from '../../src/utils/text';

describe('Text Utils - extractCleanTextForLanguageDetection', () => {
    it('should strip mentions and URLs from text', () => {
        const input = '@rebecca_ai_gal Look at this https://t.co/12345 cool photo!';
        const result = extractCleanTextForLanguageDetection(input);
        expect(result).toBe('Look at this  cool photo!');
    });

    it('should extract clean English text from mention reply', () => {
        const input = '@rebecca_ai_gal Well hello gorgeous';
        const result = extractCleanTextForLanguageDetection(input);
        expect(result).toBe('Well hello gorgeous');
    });

    it('should extract clean Japanese text from mention reply with URL', () => {
        const input = '@rebecca_ai_gal https://t.co/xyz 楽しかった！';
        const result = extractCleanTextForLanguageDetection(input);
        expect(result).toBe('楽しかった！');
    });

    it('should return empty string when input is only mentions and URLs', () => {
        const input = '@rebecca_ai_gal @other_user https://t.co/abc';
        const result = extractCleanTextForLanguageDetection(input);
        expect(result).toBe('');
    });

    it('should return empty string for empty input', () => {
        expect(extractCleanTextForLanguageDetection('')).toBe('');
        expect(extractCleanTextForLanguageDetection(null as unknown as string)).toBe('');
        expect(extractCleanTextForLanguageDetection(undefined as unknown as string)).toBe('');
    });
});

describe('Text Utils - getTwitterTextWeightedLength', () => {
    it('should return 0 for empty or falsy inputs', () => {
        expect(getTwitterTextWeightedLength('')).toBe(0);
        expect(getTwitterTextWeightedLength(null as unknown as string)).toBe(0);
        expect(getTwitterTextWeightedLength(undefined as unknown as string)).toBe(0);
    });

    it('should count ASCII / Latin characters as 1 weight', () => {
        expect(getTwitterTextWeightedLength('Hello World!')).toBe(12);
        expect(getTwitterTextWeightedLength('abc 123')).toBe(7);
    });

    it('should count CJK characters, full-width symbols, and emojis as 2 weight', () => {
        expect(getTwitterTextWeightedLength('こんにちは')).toBe(10);
        expect(getTwitterTextWeightedLength('日本語とEnglish')).toBe(4 * 2 + 7); // 15
        expect(getTwitterTextWeightedLength('🎉')).toBe(2);
        expect(getTwitterTextWeightedLength('✨Hello✨')).toBe(2 + 5 + 2); // 9
    });
});

describe('Text Utils - truncateTwitterText', () => {
    it('should return empty string for empty input', () => {
        expect(truncateTwitterText('')).toBe('');
        expect(truncateTwitterText(null as unknown as string)).toBe('');
    });

    it('should not truncate if weighted length is within limit', () => {
        const text = 'Hello Master, have a wonderful day!';
        expect(truncateTwitterText(text, 280)).toBe(text);
        const jaText = 'こんにちは、マスター！今日も頑張ろうね。';
        expect(truncateTwitterText(jaText, 280)).toBe(jaText);
    });

    it('should truncate Japanese text cleanly with ellipsis within limit', () => {
        const longJa = 'あ'.repeat(150); // 300 weight
        const result = truncateTwitterText(longJa, 280);
        // Ellipsis '…' is weight 2, so 139 'あ' (278 weight) + '…' (2 weight) = 280 weight
        expect(result).toBe('あ'.repeat(139) + '…');
        expect(getTwitterTextWeightedLength(result)).toBe(280);
    });

    it('should truncate English text at word boundary to prevent cutting words in half', () => {
        const sentence = 'The quick brown fox jumps over the lazy dog and keeps running across the green field until it reaches the edge';
        const truncated = truncateTwitterText(sentence, 60);
        expect(truncated.endsWith('…')).toBe(true);
        const withoutEllipsis = truncated.slice(0, -1);
        expect(withoutEllipsis.endsWith(' ')).toBe(false);
        expect(sentence.startsWith(withoutEllipsis)).toBe(true);
        expect(getTwitterTextWeightedLength(truncated)).toBeLessThanOrEqual(60);
        const words = withoutEllipsis.split(' ');
        expect(words[words.length - 1]).toMatch(/^[a-zA-Z]+$/);
    });

    it('should truncate without word boundary if no space is found within candidate', () => {
        const noSpace = 'a'.repeat(300);
        const truncated = truncateTwitterText(noSpace, 280);
        expect(truncated).toBe('a'.repeat(278) + '…');
        expect(getTwitterTextWeightedLength(truncated)).toBe(280);
    });
});

import { getZonedDateParts, formatZonedDateTime } from '../../src/utils/time';

describe('Time Utils - getZonedDateParts and formatZonedDateTime', () => {
    it('should extract correct date parts in default (Asia/Tokyo) timezone', () => {
        // 2026-09-12 22:00:00 UTC corresponds to 2026-09-13 07:00:00 in Asia/Tokyo
        const utcInstant = new Date('2026-09-12T22:00:00.000Z');
        const parts = getZonedDateParts(utcInstant);

        expect(parts.year).toBe('2026');
        expect(parts.month).toBe('09');
        expect(parts.day).toBe('13');
        expect(parts.hour).toBe('07');
        expect(parts.minute).toBe('00');
        expect(parts.numericYear).toBe(2026);
        expect(parts.numericMonth).toBe(9);
        expect(parts.numericDay).toBe(13);
        expect(parts.numericHour).toBe(7);
        expect(parts.numericMinute).toBe(0);
    });

    it('should extract correct date parts when configured with custom timezone (America/New_York)', () => {
        // 2026-09-12 22:00:00 UTC corresponds to 2026-09-12 18:00:00 in America/New_York (EDT)
        const utcInstant = new Date('2026-09-12T22:00:00.000Z');
        const parts = getZonedDateParts(utcInstant, 'America/New_York');

        expect(parts.year).toBe('2026');
        expect(parts.month).toBe('09');
        expect(parts.day).toBe('12');
        expect(parts.hour).toBe('18');
        expect(parts.numericHour).toBe(18);
        expect(parts.numericDay).toBe(12);
    });

    it('should format a valid ISO string into zoned format with timezone abbreviation', () => {
        const iso = '2026-09-08T12:02:00.000Z'; // 21:02 in JST
        const formatted = formatZonedDateTime(iso);
        expect(formatted).toBe('2026-09-08 21:02 JST');
    });

    it('should format using a custom timezone', () => {
        const iso = '2026-09-08T12:02:00.000Z';
        const formatted = formatZonedDateTime(iso, 'UTC');
        expect(formatted).toBe('2026-09-08 12:02 UTC');
    });

    it('should accept Date instance directly', () => {
        const date = new Date('2026-09-08T12:02:00.000Z');
        const formatted = formatZonedDateTime(date);
        expect(formatted).toBe('2026-09-08 21:02 JST');
    });

    it('should return empty string for falsy or invalid input', () => {
        expect(formatZonedDateTime(null)).toBe('');
        expect(formatZonedDateTime(undefined)).toBe('');
        expect(formatZonedDateTime('')).toBe('');
        expect(formatZonedDateTime('invalid-date')).toBe('');
    });
});

