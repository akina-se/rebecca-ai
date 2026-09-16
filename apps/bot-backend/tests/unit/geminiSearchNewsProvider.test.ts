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

  it('should return empty array if client is not provided or null', async () => {
    const provider = new GeminiSearchNewsProvider(null as any, 'test-model');
    const news = await provider.getNews('最新テクノロジー・IT');
    expect(news).toEqual([]);
  });

  it('should fetch and parse structured news items from search grounding JSON output for target category', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: `\`\`\`json
[
  {
    "title": "「アメ横AIコンシェルジュ」β版を公開",
    "summary": "4カ国語で加盟店を案内する新サービスが開始。",
    "category": "最新テクノロジー・IT"
  },
  {
    "title": "次世代ロボットアーム発表",
    "summary": "AI制御による高精度な作業を実現。",
    "category": "最新テクノロジー・IT"
  }
]
\`\`\``,
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ['AI ロボット 最新'],
          },
        },
      ],
    });

    const provider = new GeminiSearchNewsProvider(mockClient, 'gemini-2.5-flash');
    const items = await provider.getNews('最新テクノロジー・IT');

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: expect.stringContaining('最新テクノロジー・IT'),
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: [],
      },
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: '「アメ横AIコンシェルジュ」β版を公開',
      summary: '4カ国語で加盟店を案内する新サービスが開始。',
      category: '最新テクノロジー・IT',
    });
    expect(items[1]).toEqual({
      title: '次世代ロボットアーム発表',
      summary: 'AI制御による高精度な作業を実現。',
      category: '最新テクノロジー・IT',
    });
  });

  it('should rethrow API errors so transient errors can propagate to controller', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));

    const provider = new GeminiSearchNewsProvider(mockClient, 'gemini-2.5-flash');
    await expect(provider.getNews('最新テクノロジー・IT')).rejects.toThrow('API quota exceeded');
  });

  it('should handle empty text response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '   ',
    });

    const provider = new GeminiSearchNewsProvider(mockClient, 'gemini-2.5-flash');
    const news = await provider.getNews('最新テクノロジー・IT');

    expect(news).toEqual([]);
  });
});
