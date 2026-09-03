/**
 * @fileoverview Text processing utilities for input cleaning and sanitization.
 */

/**
 * Extracts a clean message body by stripping mentions and URLs,
 * providing pure text for accurate AI language detection.
 *
 * @param text - The raw message or tweet text.
 * @returns The sanitized text with handles and URLs removed.
 */
export const extractCleanTextForLanguageDetection = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/@\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
};
