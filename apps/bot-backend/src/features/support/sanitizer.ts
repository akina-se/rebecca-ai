/**
 * @fileoverview Deterministic pre-filter for supporter display names.
 *
 * Implements a strict single-responsibility security & formatting policy:
 * - Replaces empty, whitespace-only, or overly long names with a configurable fallback.
 * - Strips or rejects names containing prohibited characters: '@' (unsolicited mentions),
 *   '#' (hashtags), or URLs (spam/phishing links).
 */

import { SupportConfig } from './types';

/**
 * Result structure returned by {@link sanitizeSupporterName}.
 */
export interface NameSanitizationResult {
  /** The guaranteed safe name to be called by Rebecca in public tweets. */
  safeName: string;

  /** Whether the original name was sanitized/modified from the raw input. */
  isSanitized: boolean;

  /** Diagnostic security categorization explaining why sanitization occurred. */
  reason: 'none' | 'empty' | 'mention' | 'hashtag' | 'url' | 'too_long';
}

/** Default fallback supporter name when unconfigured. */
export const DEFAULT_FALLBACK_SUPPORTER_NAME = '名無しのマスター';

/** Default maximum permitted character length for supporter display names. */
export const DEFAULT_MAX_SUPPORTER_NAME_LENGTH = 20;

// Export legacy aliases for backward compatibility with existing tests
export const FALLBACK_SUPPORTER_NAME = DEFAULT_FALLBACK_SUPPORTER_NAME;
export const MAX_SUPPORTER_NAME_LENGTH = DEFAULT_MAX_SUPPORTER_NAME_LENGTH;

/**
 * Sanitizes untrusted user-provided supporter names using deterministic security invariants.
 *
 * @remarks
 * Security Filtering Invariants (Order of Precedence):
 * 1. Null / Undefined / Empty Check: Replaces with fallback.
 * 2. Unsolicited Mention Check (`@`): Blocks mention injections that could spam or harass third parties.
 * 3. Hashtag Check (`#`): Blocks hashtag hijacking or tag clutter.
 * 4. URL / Phishing Check (`http://`, `https://`, `www.`): Blocks malicious domain promotion.
 * 5. Length Check: Bounds string length to `maxNameLength` (default: 20) to maintain tweet brevity.
 *
 * @param rawName - Untrusted input string from Stripe checkout custom fields.
 * @param config - Optional configuration overrides for fallback name and max length.
 * @returns {@link NameSanitizationResult} containing the safeName and audit metadata.
 */
export function sanitizeSupporterName(
  rawName?: string | null,
  config?: Partial<Pick<SupportConfig, 'fallbackName' | 'maxNameLength'>>,
): NameSanitizationResult {
  const fallback = config?.fallbackName || DEFAULT_FALLBACK_SUPPORTER_NAME;
  const maxLength = config?.maxNameLength || DEFAULT_MAX_SUPPORTER_NAME_LENGTH;

  if (!rawName || typeof rawName !== 'string') {
    return { safeName: fallback, isSanitized: true, reason: 'empty' };
  }

  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return { safeName: fallback, isSanitized: true, reason: 'empty' };
  }

  // 1. Reject unsolicited X mentions (@) - highest security priority to prevent harassment
  if (trimmed.includes('@')) {
    return { safeName: fallback, isSanitized: true, reason: 'mention' };
  }

  // 2. Reject hashtags (#) - prevents timeline spam & tag hijacking
  if (trimmed.includes('#')) {
    return { safeName: fallback, isSanitized: true, reason: 'hashtag' };
  }

  // 3. Reject URLs (http://, https://, www., or suspicious domain patterns) - anti-phishing
  const urlPattern = /(https?:\/\/|www\.)/i;
  if (urlPattern.test(trimmed)) {
    return { safeName: fallback, isSanitized: true, reason: 'url' };
  }

  // 4. Reject overly long names
  if (trimmed.length > maxLength) {
    return { safeName: fallback, isSanitized: true, reason: 'too_long' };
  }

  return { safeName: trimmed, isSanitized: false, reason: 'none' };
}
