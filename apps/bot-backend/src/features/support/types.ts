/**
 * @fileoverview Type definitions for the support appreciation post feature.
 */

import type { SupportTransactionDoc, SupportTier, CreditVisibility, SupportTransactionStatus } from '@rebecca/types';

export type { SupportTransactionDoc, SupportTier, CreditVisibility, SupportTransactionStatus };

/**
 * Payload sent by Cloud Tasks to the /worker/support-post endpoint.
 */
export interface SupportTaskPayload {
  /** Firestore transaction document ID in support_transactions */
  transactionId: string;
}

/**
 * Structured Gemini LLM response for support post generation.
 */
export interface StructuredSupportPostResponse {
  /** Persona inner monologue (thought) reflecting genuine feelings, living context, and pride */
  thought: string;
  /** Dynamically crafted tsundere appreciation tweet body (strictly within 90 chars, no fixed templates) */
  replyBody: string;
}

/**
 * Result returned by SupportTaskUseCase.
 */
export interface SupportTaskResult {
  status: 'completed' | 'skipped' | 'failed';
  transactionId: string;
  tweetId?: string;
  tweetText?: string;
  safeName?: string;
  isNameSanitized?: boolean;
  attachedMedia?: boolean;
  reason?: string;
}
