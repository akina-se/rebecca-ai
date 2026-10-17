/**
 * @fileoverview Type definitions for the X Poll & Result Reaction feature.
 */

import { ProactiveBatchResult } from '../../types';

/**
 * Structured output returned by Gemini when generating a new poll post.
 */
export interface StructuredPollPostResponse {
  /** Inner thought and reasoning of the persona (within 150 characters). */
  thought: string;
  /** The public poll tweet text (within 140 characters). */
  reply: string;
  /** Poll choices (3 to 4 options, each 1 to 25 characters). */
  options: string[];
}

/**
 * Configuration required for poll use case execution.
 */
export interface PollUseCaseConfig {
  /** Application IANA timezone identifier (e.g., config.appTimezone). */
  timezone: string;
  /** Duration of the poll in minutes (5 to 10080, configured via config.poll.durationMinutes). */
  durationMinutes: number;
}

/**
 * Optional runtime overrides when triggering poll creation.
 */
export interface CreatePollOptions {
  /** Optional override for poll duration in minutes (5 to 10080). */
  durationMinutes?: number;
  /** Optional override for poll duration in days (converted to minutes, clamped 5 to 10080). */
  durationDays?: number;
}

/**
 * Result of a poll creation or poll result reaction execution.
 */
export interface PollBatchResult extends ProactiveBatchResult {
  tweetId?: string;
  options?: string[];
}
