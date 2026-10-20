/**
 * @fileoverview Deterministic pre-filter for supporter display names.
 *
 * Implements a strict single-responsibility security & formatting policy:
 * - Replaces empty, whitespace-only, or overly long names with "名無しのマスター".
 * - Strips or rejects names containing prohibited characters: '@' (unsolicited mentions),
 *   '#' (hashtags), or URLs (spam/phishing links).
 */

export interface NameSanitizationResult {
  /** The guaranteed safe name to be called by Rebecca */
  safeName: string;
  /** Whether the original name was sanitized/modified */
  isSanitized: boolean;
  /** Specific reason if sanitized */
  reason: 'none' | 'empty' | 'mention' | 'hashtag' | 'url' | 'too_long';
}

export const FALLBACK_SUPPORTER_NAME = '名無しのマスター';
export const MAX_SUPPORTER_NAME_LENGTH = 20;

/**
 * Sanitizes a raw user-provided name using deterministic security rules.
 *
 * @param rawName - The untrusted input string from Stripe custom field.
 * @returns NameSanitizationResult containing the safeName and audit metadata.
 */
export function sanitizeSupporterName(rawName?: string | null): NameSanitizationResult {
  if (!rawName || typeof rawName !== 'string') {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'empty' };
  }

  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'empty' };
  }

  // 1. Reject unsolicited X mentions (@) - security priority
  if (trimmed.includes('@')) {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'mention' };
  }

  // 2. Reject hashtags (#) - hijacking prevention
  if (trimmed.includes('#')) {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'hashtag' };
  }

  // 3. Reject URLs (http://, https://, www., or suspicious domain patterns) - anti-spam/phishing
  const urlPattern = /(https?:\/\/|www\.)/i;
  if (urlPattern.test(trimmed)) {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'url' };
  }

  // 4. Reject overly long names
  if (trimmed.length > MAX_SUPPORTER_NAME_LENGTH) {
    return { safeName: FALLBACK_SUPPORTER_NAME, isSanitized: true, reason: 'too_long' };
  }

  return { safeName: trimmed, isSanitized: false, reason: 'none' };
}
