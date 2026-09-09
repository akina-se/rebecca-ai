/**
 * @fileoverview Type definitions and abstract interface contracts for News Providers.
 */

/**
 * Interface representing a structured news item.
 */
export interface NewsItem {
  /** The headline title. */
  title: string;
  /** Brief summary or background of the news. */
  summary: string;
  /** Category/genre of the news (e.g. エンタメ, トレンド, グルメ). */
  category: string;
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
