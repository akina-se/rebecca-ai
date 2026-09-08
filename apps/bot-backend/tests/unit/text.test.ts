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

import { getJSTDate, formatJSTDateTime } from '../../src/utils/time';

describe('Time Utils - getJSTDate and formatJSTDateTime', () => {
    it('should return a valid Date object in JST timezone', () => {
        const date = getJSTDate();
        expect(date).toBeInstanceOf(Date);
        expect(isNaN(date.getTime())).toBe(false);
    });

    it('should format a valid ISO string into JST format', () => {
        const iso = '2026-09-08T12:02:00.000Z'; // 21:02 in JST
        const formatted = formatJSTDateTime(iso);
        expect(formatted).toBe('2026-09-08 21:02 JST');
    });

    it('should return empty string for falsy or invalid input', () => {
        expect(formatJSTDateTime(null)).toBe('');
        expect(formatJSTDateTime(undefined)).toBe('');
        expect(formatJSTDateTime('')).toBe('');
        expect(formatJSTDateTime('invalid-date')).toBe('');
    });
});
