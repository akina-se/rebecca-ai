/**
 * @fileoverview Type definitions and abstract interface contracts for News Providers.
 */

/**
 * Canonical news categories supported by the proactive news feature.
 */
export const NEWS_CATEGORIES = [
  '最新テクノロジー・IT',
  'エンタメ・カルチャー',
  '新商品・トレンド',
  'ライフスタイル・お出かけ・気象',
  'グルメ・スイーツ',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/**
 * Interface representing a structured news item.
 */
export interface NewsItem {
  /** The headline title. */
  title: string;
  /** Brief summary or background of the news. */
  summary: string;
  /** Category/genre of the news. */
  category: NewsCategory;
}

export type CategorySelector = () => NewsCategory;

/**
 * Abstract provider interface for retrieving real-time news items.
 * Adheres to the Dependency Inversion Principle (DIP).
 */
export interface INewsProvider {
  /**
   * Fetches latest structured news items for the specified news category.
   *
   * @param category The target news category to fetch.
   * @returns Array of NewsItem objects belonging to the target category.
   */
  getNews(category: NewsCategory): Promise<NewsItem[]>;
}

/**
 * Enriched candidate news item with semantic embedding vector and original NewsItem metadata.
 */
export interface CandidateNewsItem {
  headline: string;
  embedding: number[];
  item: NewsItem;
}

import { ProactiveBatchResult } from '../../types';

/**
 * Configuration required for proactive news usecase execution.
 */
export interface NewsUseCaseConfig {
  dedupLookbackDays: number;
  dedupSimilarityThreshold: number;
  timezone: string;
}

/**
 * Interface representing the result of a proactive news execution.
 * Extends the canonical ProactiveBatchResult.
 */
export interface NewsResult extends ProactiveBatchResult {}

import type { StructuredPersonaResponse } from '@rebecca/persona';

/**
 * Structured output representation produced by Gemini for news posts,
 * containing the exact headline title selected from candidates constrained by enum.
 * Extends the canonical StructuredPersonaResponse (thought + reply).
 */
export interface StructuredNewsPostResponse extends StructuredPersonaResponse {
  /** The exact headline title selected from candidates, constrained by enum. */
  readonly selectedTitle: string;
}

