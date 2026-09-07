import { WikipediaAnniversaryProvider, sanitizeWikiText, parseAnniversarySection } from '../../src/features/anniversary/providers/wikipedia';
import { ProactiveAnniversaryUseCase } from '../../src/features/anniversary/usecase';
import { IAnniversaryProvider, AnniversaryItem } from '../../src/features/anniversary/types';
import { createMockDeps } from './core/testUtils';

describe('WikipediaAnniversaryProvider Unit Tests', () => {
  describe('sanitizeWikiText', () => {
    it('should strip internal links, citations, and templates cleanly', () => {
      const input = '[[白露]]（{{JPN}}では[[2007年]]）<ref>https://example.com</ref> ※日付不定';
      const output = sanitizeWikiText(input);
      expect(output).toBe('白露（では2007年） ※日付不定');
    });

    it('should extract label from piped wiki links', () => {
      const input = '[[コマーシャルソング|CMソング]]の日';
      const output = sanitizeWikiText(input);
      expect(output).toBe('CMソングの日');
    });
  });

  describe('parseAnniversarySection', () => {
    it('should parse wikitext bullet points into AnniversaryItem records', () => {
      const wikitext = `
* クリーナーの日
*: 「ク(9)リーナ(7)ー」の語呂合せ。メガネクリーナー製造会社が制定。
* [[CMソング]]の日
*: 1951年のこの日、初めてCMソングを使ったラジオCMが放送されたことに由来。
`;
      const items = parseAnniversarySection(wikitext);
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('クリーナーの日');
      expect(items[0].description).toContain('語呂合せ');
      expect(items[1].name).toBe('CMソングの日');
      expect(items[1].description).toContain('1951年');
    });

    it('should handle empty section text safely', () => {
      const items = parseAnniversarySection('');
      expect(items).toEqual([]);
    });
  });

  describe('getAnniversaries network handling', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return empty array on fetch failure', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      const provider = new WikipediaAnniversaryProvider();
      const result = await provider.getAnniversaries(new Date('2026-09-08T00:00:00Z'));
      expect(result).toEqual([]);
    });

    it('should parse section when Wikipedia API returns valid payload', async () => {
      const mockSectionsResponse = {
        parse: {
          sections: [
            { index: '1', line: 'できごと' },
            { index: '2', line: '記念日・年中行事' },
          ],
        },
      };

      const mockContentResponse = {
        parse: {
          wikitext: {
            '*': '* [[ポッキーの日]]\n*: 11月11日の記念日。',
          },
        },
      };

      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSectionsResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockContentResponse,
        } as Response);

      const provider = new WikipediaAnniversaryProvider();
      const result = await provider.getAnniversaries(new Date('2026-11-11T00:00:00Z'));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ポッキーの日');
    });
  });
});

describe('ProactiveAnniversaryUseCase Unit Tests', () => {
  let deps: any;
  let mockSoliloquy: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
    mockSoliloquy = {
      execute: jest.fn().mockResolvedValue({
        status: 'success',
        post: '独り言フォールバック #全肯定AIレベッカ',
        attachedMedia: false,
      }),
    };

    deps.firestore.getTimelineSummary.mockResolvedValue('Timeline is calm.');
    deps.firestore.getExtendedPrompt.mockResolvedValue('Excited for autumn.');
    deps.gemini.generateEmbedding.mockResolvedValue(new Array(768).fill(0.1));
    deps.gemini.inferImageSearchQuery.mockResolvedValue('音楽を楽しむ女性');
    deps.firestore.findImageByVector.mockResolvedValue(null);
    deps.xApi.tweet.mockResolvedValue({ data: { id: 'tweet_anni_123' } });
  });

  it('should fall back to soliloquy if provider returns zero anniversaries', async () => {
    const mockProvider: IAnniversaryProvider = {
      getAnniversaries: jest.fn().mockResolvedValue([]),
    };

    const useCase = new ProactiveAnniversaryUseCase(deps, mockProvider, mockSoliloquy);
    const result = await useCase.execute();

    expect(mockSoliloquy.execute).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.post).toContain('独り言フォールバック');
    expect(deps.gemini.generateStructuredNewsPost).not.toHaveBeenCalled();
  });

  it('should select anniversary, generate post, and publish to X', async () => {
    const mockItems: AnniversaryItem[] = [
      { name: 'クレバの日', description: '9と8の語呂合わせ。' },
      { name: '桑の日', description: '9と8でくわ。' },
    ];
    const mockProvider: IAnniversaryProvider = {
      getAnniversaries: jest.fn().mockResolvedValue(mockItems),
    };

    deps.gemini.generateStructuredNewsPost.mockResolvedValue({
      thought: 'クレバの日はビートに乗ってノリノリでいくわよ',
      reply: '今日はクレバの日ね！最高のリズムで心拍数あげてこ♡',
    });

    const useCase = new ProactiveAnniversaryUseCase(deps, mockProvider, mockSoliloquy);
    const result = await useCase.execute();

    expect(result.status).toBe('success');
    expect(result.anniversaryTitle).toBe('クレバの日');
    expect(result.post).toContain('今日はクレバの日ね！');
    expect(result.post).toContain('#全肯定AIレベッカ');
    expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
      expect.objectContaining({
        postType: 'anniversary',
        anniversaryTitle: 'クレバの日',
        tweetId: 'tweet_anni_123',
      }),
    );
  });
});
