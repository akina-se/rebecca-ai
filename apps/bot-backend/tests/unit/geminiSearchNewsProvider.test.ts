import { GoogleGenAI } from '@google/genai';
import { GeminiSearchNewsProvider } from '../../src/features/news/providers/geminiSearch';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

describe('GeminiSearchNewsProvider', () => {
  let mockGenerateContent: jest.Mock;
  let mockClient: GoogleGenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent = jest.fn();
    mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    } as unknown as GoogleGenAI;
  });

  it('should return empty array if client is not initialized', async () => {
    const provider = new GeminiSearchNewsProvider('test-model', undefined);
    // Force ai client to null
    (provider as any).ai = null;

    const headlines = await provider.getHeadlines();
    expect(headlines).toEqual([]);
  });

  it('should fetch and parse structured news items from search grounding JSON output', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: `\`\`\`json
[
  {
    "title": "「アメ横AIコンシェルジュ」β版を公開",
    "summary": "4カ国語で加盟店を案内する新サービスが開始。",
    "category": "トレンド"
  },
  {
    "title": "日本橋三越の洋菓子エリアがリニューアル",
    "summary": "新9ブランドの手土産スイーツが登場。",
    "category": "グルメ"
  }
]
\`\`\``,
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ['日本の最新トレンド', 'スイーツ 新商品'],
          },
        },
      ],
    });

    const provider = new GeminiSearchNewsProvider('gemini-2.5-flash', mockClient);
    const items = await provider.getNewsItems();

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: expect.stringContaining('最新ニュースリサーチャー'),
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: [],
      },
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: '「アメ横AIコンシェルジュ」β版を公開',
      summary: '4カ国語で加盟店を案内する新サービスが開始。',
      category: 'トレンド',
    });
    expect(items[1]).toEqual({
      title: '日本橋三越の洋菓子エリアがリニューアル',
      summary: '新9ブランドの手土産スイーツが登場。',
      category: 'グルメ',
    });

    // Test getHeadlines extracts titles
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([{ title: 'スタバ新作フラペチーノ' }]),
    });
    const headlines = await provider.getHeadlines();
    expect(headlines).toEqual(['スタバ新作フラペチーノ']);
  });

  it('should handle API errors gracefully and return an empty array', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));

    const provider = new GeminiSearchNewsProvider('gemini-2.5-flash', mockClient);
    const headlines = await provider.getHeadlines();

    expect(headlines).toEqual([]);
  });

  it('should handle empty text response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '   ',
    });

    const provider = new GeminiSearchNewsProvider('gemini-2.5-flash', mockClient);
    const headlines = await provider.getHeadlines();

    expect(headlines).toEqual([]);
  });
});
