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

  it('should fetch and parse clean headlines from search grounding output', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: `
1. 「アメ横AIコンシェルジュ」β版を公開！4カ国語で加盟店を案内
2. 日本橋三越本店の洋菓子エリアがリニューアル、新9ブランド手土産スイーツ
- 伊藤園「TULLY'S COFFEE BOTTLE-IN COFFEE」が新発売
4. 全国 お出かけスポット 週末の天気・紫外線情報
5. スタバ新作フラペチーノがSNSで話題沸騰
      `,
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ['日本の最新トレンド', 'スイーツ 新商品'],
          },
        },
      ],
    });

    const provider = new GeminiSearchNewsProvider('gemini-2.5-flash', mockClient);
    const headlines = await provider.getHeadlines();

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: expect.stringContaining('最新ニュースリサーチャー'),
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: [],
      },
    });

    expect(headlines).toHaveLength(5);
    expect(headlines[0]).toBe('「アメ横AIコンシェルジュ」β版を公開！4カ国語で加盟店を案内');
    expect(headlines[1]).toBe('日本橋三越本店の洋菓子エリアがリニューアル、新9ブランド手土産スイーツ');
    expect(headlines[2]).toBe('伊藤園「TULLY\'S COFFEE BOTTLE-IN COFFEE」が新発売');
    expect(headlines[3]).toBe('全国 お出かけスポット 週末の天気・紫外線情報');
    expect(headlines[4]).toBe('スタバ新作フラペチーノがSNSで話題沸騰');
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
