/**
 * @fileoverview Text processing utilities for input cleaning, sanitization,
 * Twitter-compliant weighted length calculation, and safe word-boundary truncation.
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

/**
 * Maximum weighted character count allowed for a standard X (Twitter) post/reply.
 * 280 weight corresponds to 280 Latin/ASCII characters or 140 CJK/full-width characters.
 */
export const TWITTER_MAX_WEIGHTED_LENGTH = 280;

/**
 * Calculates the weighted character count according to X (Twitter) text specifications.
 * Basic Latin and European characters (codepoint <= U+10FF) count as 1 weight.
 * CJK, full-width characters, symbols, and emojis count as 2 weights.
 *
 * @param text - The string to measure.
 * @returns The total weighted length.
 */
export function getTwitterTextWeightedLength(text: string): number {
  if (!text) return 0;
  let weight = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    // Twitter text specification: <= 0x10FF (Basic Latin, Latin-1, Extended, Greek, Cyrillic) = 1
    // >= 0x1100 (Hangul, CJK, Emoji, Full-width) = 2
    weight += codePoint <= 0x10ff ? 1 : 2;
  }
  return weight;
}

/**
 * Truncates text so that its weighted character count does not exceed `maxWeight`.
 * Appends an ellipsis character ('…', weight 2) when truncated.
 * If the text contains spaces (e.g. English), truncation occurs at the last
 * whitespace boundary before the limit to avoid breaking words in half.
 *
 * @param text - The string to truncate.
 * @param maxWeight - The maximum allowed weighted length (defaults to 280).
 * @returns The truncated string if exceeding maxWeight, or the original string.
 */
export function truncateTwitterText(text: string, maxWeight: number = TWITTER_MAX_WEIGHTED_LENGTH): string {
  if (!text) return '';
  if (getTwitterTextWeightedLength(text) <= maxWeight) {
    return text;
  }

  const ellipsis = '…';
  const ellipsisWeight = getTwitterTextWeightedLength(ellipsis); // 2
  const targetWeight = Math.max(0, maxWeight - ellipsisWeight);

  let currentWeight = 0;
  let cutIndex = 0;
  for (const char of text) {
    const charWeight = (char.codePointAt(0)!) <= 0x10ff ? 1 : 2;
    if (currentWeight + charWeight > targetWeight) {
      break;
    }
    currentWeight += charWeight;
    cutIndex += char.length; // handles surrogate pairs
  }

  const candidate = text.slice(0, cutIndex);

  // If text contains spaces within candidate, find the last word boundary to avoid partial words
  const lastSpaceIndex = candidate.lastIndexOf(' ');
  if (lastSpaceIndex > Math.floor(cutIndex * 0.6)) {
    return candidate.slice(0, lastSpaceIndex).trimEnd() + ellipsis;
  }

  return candidate.trimEnd() + ellipsis;
}
