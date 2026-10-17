/**
 * @fileoverview Type definitions and contracts for the X Poll & Result Reaction feature.
 */

/**
 * Configuration options for PollUseCase.
 */
export interface PollUseCaseConfig {
  /** IANA time zone identifier used for formatting timestamps and time-of-day context (e.g. 'Asia/Tokyo'). */
  timezone: string;
  /** Default poll voting duration in minutes (clamped to X API v2 bounds: 5..10080). */
  durationMinutes: number;
}

/**
 * Structured LLM output schema for creating a new X poll post.
 */
export interface StructuredPollPostResponse {
  /** Persona's internal monologue and rationale for the poll question (persisted to Firestore). */
  thought: string;
  /** Public tweet text inviting followers to vote and reply. */
  reply: string;
  /** List of 3 to 4 poll option labels (each up to 25 characters). */
  options: string[];
}

/**
 * Result returned by PollUseCase batch operations.
 */
export interface PollBatchResult {
  /** Execution outcome status of the batch operation. */
  status: 'success' | 'skipped';
  /** Machine-readable skip reason when status is 'skipped'. */
  reason?: string;
  /** Published tweet text when status is 'success'. */
  post?: string;
  /** Indicates whether media was attached to the published post (always false for poll posts). */
  attachedMedia?: boolean;
  /** X (Twitter) tweet ID of the published post. */
  tweetId?: string;
  /** Published poll option labels when a poll was created. */
  options?: string[];
}
