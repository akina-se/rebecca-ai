import { extractCleanTextForLanguageDetection } from '../../src/utils/text';

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

