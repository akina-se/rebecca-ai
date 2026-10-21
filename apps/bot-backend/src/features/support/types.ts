/**
 * @fileoverview Type definitions and domain contracts for the support appreciation feature.
 *
 * Provides strongly-typed models for:
 * - Worker task payloads from Cloud Tasks
 * - LLM structured response contracts
 * - Execution results with idempotency and audit metadata
 * - Feature runtime configuration
 */

import type {
  SupportTransactionDoc,
  SupportTier,
  CreditVisibility,
  SupportTransactionStatus,
} from '@rebecca/types';

export type { SupportTransactionDoc, SupportTier, CreditVisibility, SupportTransactionStatus };

/**
 * Runtime configuration contract for the supporter appreciation and tipping feature.
 */
export interface SupportConfig {
  /**
   * The public portal URL (with `#supporters` anchor) appended to appreciation tweets.
   *
   * @example 'https://rebecca-ai.net/#supporters'
   */
  officialPortalUrl: string;

  /**
   * Safe fallback display name used when submitted name is empty or fails security filtering.
   *
   * @example '名無しのマスター'
   */
  fallbackName: string;

  /**
   * Maximum permitted character length for supporter display names.
   * Names exceeding this limit are automatically sanitized to fallbackName.
   *
   * @default 20
   */
  maxNameLength: number;

  /**
   * Secret key for verifying Stripe Webhook signatures.
   */
  stripeWebhookSecret?: string;

  /**
   * Stripe API Secret Key for server-side verification calls.
   */
  stripeSecretKey?: string;

  /**
   * Public Stripe payment links for supporter tiers (Test or Live mode URLs).
   */
  paymentLinks?: {
    bronze: string;
    silver: string;
    gold: string;
  };
}

/**
 * Task payload dispatched by Cloud Tasks to the `/worker/support-post` endpoint.
 */
export interface SupportTaskPayload {
  /**
   * Unique Firestore document ID in the `support_transactions` collection.
   */
  transactionId: string;
}

/**
 * Structured Gemini LLM response contract for dynamic support post generation.
 */
export interface StructuredSupportPostResponse {
  /**
   * Autonomous persona inner monologue reflecting genuine feelings, living context, and pride.
   */
  thought: string;

  /**
   * Dynamically generated tsundere appreciation tweet body (strictly <= 90 characters, no templates).
   */
  replyBody: string;
}

/**
 * Execution result returned by {@link SupportTaskUseCase}.
 */
export interface SupportTaskResult {
  /** Lifecycle outcome of the task execution. */
  status: 'completed' | 'skipped' | 'failed';

  /** Target transaction identifier. */
  transactionId: string;

  /** Identifier of the published tweet on X (if completed). */
  tweetId?: string;

  /** Full formatted tweet text including URL anchor and hashtags (if completed). */
  tweetText?: string;

  /** Validated and sanitized name used in post and persisted to database. */
  safeName?: string;

  /** Indicates whether the original raw name required sanitization. */
  isNameSanitized?: boolean;

  /** Indicates whether an image asset was attached to the tweet. */
  attachedMedia?: boolean;

  /** Detailed diagnostic message when status is skipped or failed. */
  reason?: string;
}
