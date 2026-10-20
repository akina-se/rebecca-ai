import { sanitizeSupporterName } from '../../src/features/support/sanitizer';
import config from '../../src/config';

describe('Supporter Name Sanitizer Unit Tests', () => {
  const defaultOptions = {
    fallbackName: config.support.fallbackName,
    maxNameLength: config.support.maxNameLength,
  };

  it('should accept clean and valid supporter names', () => {
    const validNames = ['たろう', 'Alice', 'Tech Master', 'AIマスター_01'];
    for (const name of validNames) {
      const result = sanitizeSupporterName(name, defaultOptions);
      expect(result.safeName).toBe(name);
      expect(result.isSanitized).toBe(false);
      expect(result.reason).toBe('none');
    }
  });

  it('should trim surrounding whitespace from clean names', () => {
    const result = sanitizeSupporterName('  たろう  ', defaultOptions);
    expect(result.safeName).toBe('たろう');
    expect(result.isSanitized).toBe(false);
    expect(result.reason).toBe('none');
  });

  it('should fallback on undefined, null, or empty string', () => {
    expect(sanitizeSupporterName(undefined, defaultOptions)).toEqual({
      safeName: config.support.fallbackName,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName(null, defaultOptions)).toEqual({
      safeName: config.support.fallbackName,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName('', defaultOptions)).toEqual({
      safeName: config.support.fallbackName,
      isSanitized: true,
      reason: 'empty',
    });
    expect(sanitizeSupporterName('   ', defaultOptions)).toEqual({
      safeName: config.support.fallbackName,
      isSanitized: true,
      reason: 'empty',
    });
  });

  it('should reject names with @ (unsolicited mention prevention)', () => {
    const mentionNames = ['@rebecca_ai_gal', 'test@user', 'Hello @world'];
    for (const name of mentionNames) {
      const result = sanitizeSupporterName(name, defaultOptions);
      expect(result.safeName).toBe(config.support.fallbackName);
      expect(result.isSanitized).toBe(true);
      expect(result.reason).toBe('mention');
    }
  });

  it('should reject names with # (hashtag hijacking prevention)', () => {
    const hashtagNames = ['#tag', 'Master #1', 'super#hashtag'];
    for (const name of hashtagNames) {
      const result = sanitizeSupporterName(name, defaultOptions);
      expect(result.safeName).toBe(config.support.fallbackName);
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
      const result = sanitizeSupporterName(name, defaultOptions);
      expect(result.safeName).toBe(config.support.fallbackName);
      expect(result.isSanitized).toBe(true);
      expect(result.reason).toBe('url');
    }
  });

  it('should reject names exceeding max length', () => {
    const longName = 'あ'.repeat(config.support.maxNameLength + 1);
    const result = sanitizeSupporterName(longName, defaultOptions);
    expect(result.safeName).toBe(config.support.fallbackName);
    expect(result.isSanitized).toBe(true);
    expect(result.reason).toBe('too_long');
  });

  it('should accept names exactly at max length', () => {
    const exactName = 'あ'.repeat(config.support.maxNameLength);
    const result = sanitizeSupporterName(exactName, defaultOptions);
    expect(result.safeName).toBe(exactName);
    expect(result.isSanitized).toBe(false);
  });

  it('should respect custom config overrides for fallbackName and maxNameLength', () => {
    const customConfig = {
      fallbackName: 'Anonymous Backer',
      maxNameLength: 5,
    };
    // Exceeds custom max length of 5
    const resultLong = sanitizeSupporterName('VeryLongName', customConfig);
    expect(resultLong.safeName).toBe('Anonymous Backer');
    expect(resultLong.isSanitized).toBe(true);
    expect(resultLong.reason).toBe('too_long');

    // Empty input returns custom fallback
    const resultEmpty = sanitizeSupporterName('', customConfig);
    expect(resultEmpty.safeName).toBe('Anonymous Backer');
    expect(resultEmpty.isSanitized).toBe(true);
    expect(resultEmpty.reason).toBe('empty');

    // Valid short name
    const resultOk = sanitizeSupporterName('Alice', customConfig);
    expect(resultOk.safeName).toBe('Alice');
    expect(resultOk.isSanitized).toBe(false);
  });
});
