/**
 * @fileoverview Type definitions and abstract interface contracts for News Providers.
 */

/**
 * Interface representing a news headline item.
 */
export interface NewsItem {
  /** The headline title. */
  title: string;
  /** The URL source of the news item, if available. */
  url?: string;
}

/**
 * Abstract provider interface for retrieving real-time news headlines.
 * Adheres to the Dependency Inversion Principle (DIP).
 */
export interface INewsProvider {
  /**
   * Fetches latest candidate news headlines.
   *
   * @returns Array of headline strings (or NewsItem titles).
   */
  getHeadlines(): Promise<string[]>;
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
