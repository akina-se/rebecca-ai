import { GoogleGenAI } from '@google/genai';
import config from '../../../config';
import { INewsProvider } from '../types';

/**
 * Prompt instructing Gemini to search real-time headlines via Google Search Grounding.
 */
const NEWS_SEARCH_PROMPT = `あなたは最新ニュースリサーチャーです。
Google検索を利用して、日本の今日の最新トレンド、エンタメ、スイーツ・グルメ、カルチャー、新商品、お出かけ・天気に関するニュース見出しを【5件】取得してください。

【厳守ルール】
- 殺人、事故、事件、政治的論争など過度に暗いニュースや人が亡くなっているニュースは絶対に除外すること。
- 若者やSNSで話題になりそうな明るくポジティブなトピックを厳選すること。
- 各見出しは1行ずつ、箇条書き記号（- や 1. など）を付けずに見出しタイトルのみをシンプルに出力すること。
- 余計な挨拶、説明文、引用記号は一切出力せず、5行の見出しテキストのみを出力してください。`;

/**
 * News provider that fetches real-time headlines using Google Search Grounding via Gemini API.
 */
export class GeminiSearchNewsProvider implements INewsProvider {
  private ai: GoogleGenAI | null = null;
  private model: string;

  constructor(model?: string, client?: GoogleGenAI) {
    this.model = model || config.gemini.newsSearchModel;
    if (client) {
      this.ai = client;
    } else if (config.gemini.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    }
  }

  /**
   * Fetches latest fresh headlines using Google Search Grounding.
   *
   * @returns Array of headline strings (up to 5), or empty array upon failure.
   */
  async getHeadlines(): Promise<string[]> {
    if (!this.ai) {
      console.warn('[GeminiSearchNewsProvider] Gemini client is not initialized.');
      return [];
    }

    try {
      console.log(`[GeminiSearchNewsProvider] Fetching news via Google Search Grounding (model: ${this.model})...`);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: NEWS_SEARCH_PROMPT,
        config: {
          tools: [{ googleSearch: {} }],
          safetySettings: [] as never[],
        },
      });

      const text = response.text?.trim() || '';
      if (!text) {
        console.warn('[GeminiSearchNewsProvider] Empty response from search grounding.');
        return [];
      }

      const headlines = text
        .split('\n')
        .map((line) => line.replace(/^[\s*\-・\d.]+\s*/, '').trim())
        .filter((line) => line.length > 5);

      console.log(`[GeminiSearchNewsProvider] Successfully fetched ${headlines.length} headlines.`);
      return headlines.slice(0, 5);
    } catch (error) {
      console.error('[GeminiSearchNewsProvider] Error fetching news via search grounding:', error);
      return [];
    }
  }
}
