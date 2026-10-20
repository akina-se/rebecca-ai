import {
  sanitizeSupporterName,
  FALLBACK_SUPPORTER_NAME,
  MAX_SUPPORTER_NAME_LENGTH,
} from '../../src/features/support/sanitizer';

describe('Supporter Name Sanitizer Unit Tests', () => {
  it('should accept clean and valid supporter names', () => {
    const validNames = ['たろう', 'Alice', 'Tech Master', 'AIマスター_01'];
    for (const name of validNames) {
      const result = sanitizeSupporterName(name);
      expect(result.safeName).toBe(name);
      expect(result.isSanitized).toBe(false);
      expect(result.reason).toBe('none');
    }
  });

  it('should trim surrounding whitespace from clean names', () => {
    const result = sanitizeSupporterName('  たろう  ');
    expect(result.safeName).toBe('たろう');
    expect(result.isSanitized).toBe(false);
    expect(result.reason).toBe('none');
  });

  it('should fallback on undefined, null, or empty string', () => {
    expect(sanitizeSupporterName(undefined)).toEqual({
      safeName: FALLBACK_SUPPORTER_NAME,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName(null)).toEqual({
      safeName: FALLBACK_SUPPORTER_NAME,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName('')).toEqual({
      safeName: FALLBACK_SUPPORTER_NAME,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName('   ')).toEqual({
      safeName: FALLBACK_SUPPORTER_NAME,
      isSanitized: true,
      reason: 'empty',
    });
  });

  it('should reject names with @ (unsolicited mention prevention)', () => {
    const mentionNames = ['@rebecca_ai_gal', 'test@user', 'Hello @world'];
    for (const name of mentionNames) {
      const result = sanitizeSupporterName(name);
      expect(result.safeName).toBe(FALLBACK_SUPPORTER_NAME);
      expect(result.isSanitized).toBe(true);
      expect(result.reason).toBe('mention');
    }
  });

  it('should reject names with # (hashtag hijacking prevention)', () => {
    const hashtagNames = ['#tag', 'Master #1', 'super#hashtag'];
    for (const name of hashtagNames) {
      const result = sanitizeSupporterName(name);
      expect(result.safeName).toBe(FALLBACK_SUPPORTER_NAME);
      expect(result.isSanitized).toBe(true);
      expect(result.reason).toBe('hashtag');
    }
  });

  it('should reject names with URLs (phishing & spam prevention)', () => {
    const urlNames = [
      'https://spam.com',
      'http://evil.org/test',
      'www.example.com',
      'Visit https://malicious.io now',
    ];
    for (const name of urlNames) {
      const result = sanitizeSupporterName(name);
      expect(result.safeName).toBe(FALLBACK_SUPPORTER_NAME);
      expect(result.isSanitized).toBe(true);
      expect(result.reason).toBe('url');
    }
  });

  it('should reject names exceeding max length', () => {
    const longName = 'あ'.repeat(MAX_SUPPORTER_NAME_LENGTH + 1);
    const result = sanitizeSupporterName(longName);
    expect(result.safeName).toBe(FALLBACK_SUPPORTER_NAME);
    expect(result.isSanitized).toBe(true);
    expect(result.reason).toBe('too_long');
  });

  it('should accept names exactly at max length', () => {
    const exactName = 'あ'.repeat(MAX_SUPPORTER_NAME_LENGTH);
    const result = sanitizeSupporterName(exactName);
    expect(result.safeName).toBe(exactName);
    expect(result.isSanitized).toBe(false);
  });
});
