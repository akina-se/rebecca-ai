/**
 * Configuration options for PollUseCase.
 */
export interface PollUseCaseConfig {
  timezone: string;
  durationMinutes: number;
}

/**
 * Structured LLM output schema for creating a new X poll post.
 */
export interface StructuredPollPostResponse {
  thought: string;
  reply: string;
  options: string[];
}

/**
 * Result returned by PollUseCase batch operations.
 */
export interface PollBatchResult {
  status: 'success' | 'skipped';
  reason?: string;
  post?: string;
  attachedMedia?: boolean;
  tweetId?: string;
  options?: string[];
}
