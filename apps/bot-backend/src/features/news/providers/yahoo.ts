import { INewsProvider } from '../types';

/**
 * Timeout in milliseconds for news fetch requests.
 */
const NEWS_FETCH_TIMEOUT_MS = 5000;

/**
 * News provider that fetches headlines from Yahoo News RSS feeds.
 */
export class YahooNewsProvider implements INewsProvider {
  private categories: string[];

  /**
   * Initializes the YahooNewsProvider.
   *
   * @param categories Optional specific RSS categories to select from.
   */
  constructor(categories: string[] = ['top-picks', 'domestic', 'entertainment', 'it', 'sports']) {
    this.categories = categories;
  }

  /**
   * Fetches latest headlines from Yahoo News RSS.
   *
   * @returns Array of clean headline strings, or empty array upon failure.
   */
  async getHeadlines(): Promise<string[]> {
    try {
      const randomCategory = this.categories[Math.floor(Math.random() * this.categories.length)];
      const url = `https://news.yahoo.co.jp/rss/topics/${randomCategory}.xml`;
      console.log(`[YahooNewsProvider] Fetching news from: ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(NEWS_FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'RebeccaBot/1.0 (https://github.com/akina-se/rebecca-ai)',
        },
      });

      if (response && response.ok === false) {
        console.warn(`[YahooNewsProvider] Failed to fetch news RSS: HTTP ${response.status}`);
        return [];
      }

      const text = await response.text();

      const titleRegex = /<title>(.*?)<\/title>/g;
      let match;
      const headlines: string[] = [];

      while ((match = titleRegex.exec(text)) !== null) {
        const title = match[1];
        if (title && !title.includes('Yahoo!ニュース') && !title.includes('Yahoo!')) {
          headlines.push(title.trim());
        }
      }

      return headlines.slice(0, 5);
    } catch (error) {
      console.error('[YahooNewsProvider] Error fetching news:', error);
      return [];
    }
  }
}
