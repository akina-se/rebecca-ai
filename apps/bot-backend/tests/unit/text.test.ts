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
