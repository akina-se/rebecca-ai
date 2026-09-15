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

/**
 * Abstract provider interface for retrieving real-time news items.
 * Adheres to the Dependency Inversion Principle (DIP).
 */
export interface INewsProvider {
  /**
   * Fetches latest structured news items containing titles, summaries, and categories.
   *
   * @returns Array of NewsItem objects.
   */
  getNews(): Promise<NewsItem[]>;
}

/**
 * Enriched candidate news item with 1-based index and semantic embedding vector.
 */
export interface CandidateNewsItem {
  id: number;
  headline: string;
  embedding: number[];
  item: NewsItem;
}

/**
 * Interface representing the result of a proactive news execution.
 */
export interface NewsResult {
  /** The execution status of the news job. */
  status: 'skipped' | 'success' | 'failed';
  /** A descriptive reason if the status is skipped or failed. */
  reason?: string;
  /** The content of the tweet that was posted, if successful. */
  post?: string;
  /** Indicates whether media (e.g., an image) was attached to the post. */
  attachedMedia?: boolean;
}

/**
 * Structured output representation produced by Gemini for news posts,
 * containing explicit candidate index selection alongside the persona response.
 */
export interface StructuredNewsPostResponse {
  /** 1-based index of the candidate news item selected by the model. */
  readonly selectedIndex: number;
  /** The persona's private internal thought process. */
  readonly thought: string;
  /** The public text response intended to be delivered. */
  readonly reply: string;
}

