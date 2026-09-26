import { GoogleGenAI } from '@google/genai';
import { INewsProvider, NewsItem, NewsCategory } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Descriptive details for each canonical category used to guide search grounding.
 */
const CATEGORY_DESCRIPTIONS: Record<NewsCategory, string> = {
  '最新テクノロジー・IT': 'AI、最新ガジェット、Web、ロボット、先端技術、デジタルサービスなど',
  'エンタメ・カルチャー': '音楽、映画、アニメ、マンガ、ゲーム、アート、展覧会、舞台など',
  '新商品・トレンド': '話題の新作グッズ、生活トレンド、SNS話題など',
  'ライフスタイル・お出かけ・気象': '季節のイベント、お出かけスポット、旅行・レジャー、気象・天候、健康など',
  'グルメ・スイーツ': 'カフェ、飲食店、新作フード・スイーツなど',
};

/**
 * Creates the search grounding prompt for a single target category.
 */
const createNewsStructuredSearchPrompt = (category: NewsCategory): string => {
  const details = CATEGORY_DESCRIPTIONS[category];
  return `あなたは最新ニュースリサーチャーです。
Google検索を利用して、日本の今日の最新ニュースの中から【${category}（${details}）】に関する話題を【3〜5件】厳選して取得し、必ず以下のJSON配列形式のみで出力してください。

【出力フォーマット】
[
  {
    "title": "ニュース見出し（30文字以内）",
    "summary": "ニュースの簡単な概要や背景（1〜2文）",
    "category": "${category}"
  }
]

【厳守ルール】
- 指定カテゴリ【${category}】に合致する話題のみを抽出すること。
- 殺人、事故、事件、政治的論争など過度に暗いニュースや人が亡くなっているニュースは絶対に除外すること。
- 若者やSNSで話題になりそうな明るくポジティブなトピックを厳選すること。
- Markdownコードブロックや余計な前置き・解説は一切含めず、純粋なJSON文字列のみを出力すること。`;
};

/**
 * Validates whether an unknown value conforms to the NewsItem structure with a valid NewsCategory.
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
    candidate.summary.trim().length > 0
  );
};

/**
 * News provider that fetches real-time news using Google Search Grounding via Gemini API.
 */
export class GeminiSearchNewsProvider implements INewsProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(ai: GoogleGenAI, model: string) {
    this.ai = ai;
    this.model = model;
  }

  /**
   * Fetches latest structured news items for the designated category using Google Search Grounding.
   *
   * @param category The target news category.
   * @returns Array of valid NewsItem objects (up to 5), or empty array upon failure.
   */
  async getNews(category: NewsCategory): Promise<NewsItem[]> {
    if (!this.ai) {
      logger.warn('[GeminiSearchNewsProvider] Gemini client is not initialized');
      return [];
    }

    try {
      logger.info(
        '[GeminiSearchNewsProvider] Fetching structured news via Google Search Grounding',
        { category, model: this.model },
      );

      const prompt = createNewsStructuredSearchPrompt(category);
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          safetySettings: [] as never[],
        },
      });

      const rawText = response.text?.trim() ?? '';
      if (!rawText) {
        logger.warn('[GeminiSearchNewsProvider] Empty response from search grounding');
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
        logger.warn('[GeminiSearchNewsProvider] Response is not a JSON array', { cleanJson });
        return [];
      }

      const validItems = parsed.filter(isValidNewsItem).map((item) => ({
        title: item.title.trim(),
        summary: item.summary.trim(),
        category,
      }));

      // Deduplicate identical titles if returned
      const uniqueItemsMap = new Map<string, NewsItem>();
      for (const item of validItems) {
        if (!uniqueItemsMap.has(item.title)) {
          uniqueItemsMap.set(item.title, item);
        }
      }

      const items = Array.from(uniqueItemsMap.values());
      logger.info('[GeminiSearchNewsProvider] Successfully fetched news items', {
        count: items.length,
        category,
      });
      return items;
    } catch (error) {
      logger.error('[GeminiSearchNewsProvider] Error fetching structured news via search grounding', error);
      throw error;
    }
  }
}
