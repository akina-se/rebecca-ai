import { GoogleGenAI } from '@google/genai';
import config from '../../../config';
import { INewsProvider, NewsItem } from '../types';

/**
 * Prompt instructing Gemini to search real-time news via Google Search Grounding and output structured JSON.
 */
const NEWS_STRUCTURED_SEARCH_PROMPT = `あなたは最新ニュースリサーチャーです。
Google検索を利用して、日本の今日の最新トレンド、エンタメ、スイーツ・グルメ、カルチャー、新商品、お出かけ・天気に関するニュースを【5件】検索・取得し、必ず以下のJSON配列形式のみで出力してください。

【出力フォーマット】
[
  {
    "title": "ニュース見出し（30文字以内）",
    "summary": "ニュースの簡単な概要や背景（1〜2文）",
    "category": "エンタメ | トレンド | グルメ | 新商品 | カルチャー | お出かけ"
  }
]

【厳守ルール】
- 殺人、事故、事件、政治的論争など過度に暗いニュースや人が亡くなっているニュースは絶対に除外すること。
- 若者やSNSで話題になりそうな明るくポジティブなトピックを厳選すること。
- Markdownコードブロックや余計な前置き・解説は一切含めず、純粋なJSON文字列のみを出力すること。`;

/**
 * Validates whether an unknown value conforms to the NewsItem structure.
 */
const isValidNewsItem = (item: unknown): item is NewsItem => {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.summary === 'string' &&
    candidate.summary.trim().length > 0 &&
    typeof candidate.category === 'string' &&
    candidate.category.trim().length > 0
  );
};

/**
 * News provider that fetches real-time news using Google Search Grounding via Gemini API.
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
   * Fetches latest structured news items using Google Search Grounding.
   *
   * @returns Array of valid NewsItem objects (up to 5), or empty array upon failure.
   */
  async getNews(): Promise<NewsItem[]> {
    if (!this.ai) {
      console.warn('[GeminiSearchNewsProvider] Gemini client is not initialized.');
      return [];
    }

    try {
      console.log(`[GeminiSearchNewsProvider] Fetching structured news via Google Search Grounding (model: ${this.model})...`);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: NEWS_STRUCTURED_SEARCH_PROMPT,
        config: {
          tools: [{ googleSearch: {} }],
          safetySettings: [] as never[],
        },
      });

      const rawText = response.text?.trim() || '';
      if (!rawText) {
        console.warn('[GeminiSearchNewsProvider] Empty response from search grounding.');
        return [];
      }

      let cleanJson = rawText;
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed)) {
        console.warn('[GeminiSearchNewsProvider] Response is not a JSON array:', cleanJson);
        return [];
      }

      const items: NewsItem[] = parsed
        .filter(isValidNewsItem)
        .map((item) => ({
          title: item.title.trim(),
          summary: item.summary.trim(),
          category: item.category.trim(),
        }));

      console.log(`[GeminiSearchNewsProvider] Successfully fetched ${items.length} structured news items.`);
      return items.slice(0, 5);
    } catch (error) {
      console.error('[GeminiSearchNewsProvider] Error fetching structured news via search grounding:', error);
      throw error;
    }
  }
}
