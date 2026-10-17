/**
 * @fileoverview Type definitions for the Weekly X Poll & Result Reaction feature.
 */

import { ProactiveBatchResult } from '../../types';

/**
 * Canonical weekly poll theme categories used for deterministic rotation.
 */
export const POLL_CATEGORIES = [
  '恋愛・デート観・男女のリアルな本音',
  '週末の過ごし方・夜更かし・お酒・チルタイム',
  'ファッション・美容・ギャルマインド・推し活',
  '食のこだわり・究極の選択（甘党vs辛党、〆グルメ等）',
  'デジタル・SNSあるある・現代人のクセ',
  '人生観・お金の使い道・もしも系の妄想トーク',
] as const;

export type PollCategory = (typeof POLL_CATEGORIES)[number];

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
  timezone: string;
  /** Duration of the poll in minutes (defaults to 1380 = 23 hours). */
  durationMinutes?: number;
}

/**
 * Result of a poll creation or poll result reaction execution.
 */
export interface PollBatchResult extends ProactiveBatchResult {
  tweetId?: string;
  options?: string[];
}
