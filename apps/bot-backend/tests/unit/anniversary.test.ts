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

    it('should extract label from piped wiki links and kari-links', () => {
      const input = '[[コマーシャルソング|CMソング]]の日と{{仮リンク|記事名|en|元の記事名|label=勝利の日}}';
      const output = sanitizeWikiText(input);
      expect(output).toBe('CMソングの日と勝利の日');
    });

    it('should strip language templates and clean dangling empty parentheses', () => {
      const input = '戦没者追悼記念日（{{lang-en|Remembrance Day}}）（{{GBR}}・{{CAN}}）';
      const output = sanitizeWikiText(input);
      expect(output).toBe('戦没者追悼記念日');
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

    it('should support nested bullets (**) and multi-colon descriptions (**:) accurately', () => {
      const wikitext = `
* 第一次世界大戦休戦記念日
*: 1918年の停戦記念。
** [[リメンブランス・デー]]
**: 戦没者を追悼する日。
`;
      const items = parseAnniversarySection(wikitext);
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('第一次世界大戦休戦記念日');
      expect(items[1].name).toBe('リメンブランス・デー');
      expect(items[1].description).toBe('戦没者を追悼する日。');
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

    it('should throw an error when initialized with an empty userAgent', () => {
      expect(() => new WikipediaAnniversaryProvider('')).toThrow('WikipediaAnniversaryProvider requires a non-empty User-Agent string.');
      expect(() => new WikipediaAnniversaryProvider('   ')).toThrow('WikipediaAnniversaryProvider requires a non-empty User-Agent string.');
    });

    it('should throw error on fetch failure so transient errors propagate', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      const provider = new WikipediaAnniversaryProvider('TestBot/1.0');
      await expect(provider.getAnniversaries(new Date('2026-09-08T00:00:00Z'))).rejects.toThrow('Network error');
    });

    it('should parse section when Wikipedia API returns valid payload', async () => {
      const mockContentResponse = {
        parse: {
          wikitext: {
            '*': '== 記念日・年中行事 ==\n* [[ポッキーの日]]\n*: 11月11日の記念日。',
          },
        },
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentResponse,
      } as Response);

      const provider = new WikipediaAnniversaryProvider('TestBot/1.0');
      const result = await provider.getAnniversaries(new Date('2026-11-11T00:00:00Z'));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ポッキーの日');
      expect(result[0].description).toBe('11月11日の記念日。');
    });

    it('should parse across level-3 subheadings without premature termination', async () => {
      const mockContentResponse = {
        parse: {
          wikitext: {
            '*': '== 記念日・年中行事 ==\n=== 海外 ===\n* [[聖マルティヌスの日]]\n*: 収穫祭。\n=== 日本 ===\n* [[ポッキー&プリッツの日]]\n*: グリコが制定。\n== 脚注 ==\n* 脚注リスト',
          },
        },
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentResponse,
      } as Response);

      const provider = new WikipediaAnniversaryProvider('TestBot/1.0');
      const result = await provider.getAnniversaries(new Date('2026-11-11T00:00:00Z'));
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('聖マルティヌスの日');
      expect(result[1].name).toBe('ポッキー&プリッツの日');
    });
  });
});

describe('ProactiveAnniversaryUseCase Unit Tests', () => {
  let deps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();

    deps.firestore.getTimelineSummary.mockResolvedValue('Timeline is calm.');
    deps.firestore.getExtendedPrompt.mockResolvedValue('Excited for autumn.');
    deps.gemini.generateEmbedding.mockResolvedValue(new Array(768).fill(0.1));
    deps.gemini.inferImageSearchQuery.mockResolvedValue('音楽を楽しむ女性');
    deps.firestore.findImagesByVector.mockResolvedValue([]);
    deps.xApi.tweet.mockResolvedValue({ data: { id: 'tweet_anni_123' } });
  });

  it('should return skipped status if provider returns zero anniversaries', async () => {
    const mockProvider: IAnniversaryProvider = {
      getAnniversaries: jest.fn().mockResolvedValue([]),
    };

    const useCase = new ProactiveAnniversaryUseCase(deps, mockProvider);
    const result = await useCase.execute();

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no_anniversaries');
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

    const useCase = new ProactiveAnniversaryUseCase(deps, mockProvider);
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

describe('ProactiveAnniversaryController Unit Tests', () => {
  let mockUseCase: { execute: jest.Mock };
  let mockSoliloquyUseCase: { execute: jest.Mock };
  let req: any;
  let res: any;

  beforeEach(() => {
    mockUseCase = { execute: jest.fn() };
    mockSoliloquyUseCase = { execute: jest.fn() };
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('should return 200 with result when useCase succeeds', async () => {
    const { ProactiveAnniversaryController } = await import('../../src/features/anniversary/controller');
    mockUseCase.execute.mockResolvedValue({
      status: 'success',
      post: 'Anniversary post #全肯定AIレベッカ',
    });

    const controller = new ProactiveAnniversaryController(
      mockUseCase as any,
      mockSoliloquyUseCase as any,
    );
    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' }),
    );
    expect(mockSoliloquyUseCase.execute).not.toHaveBeenCalled();
  });

  it('should fall back to soliloquyUseCase when anniversary useCase returns skipped', async () => {
    const { ProactiveAnniversaryController } = await import('../../src/features/anniversary/controller');
    mockUseCase.execute.mockResolvedValue({
      status: 'skipped',
      reason: 'no_anniversaries',
    });
    mockSoliloquyUseCase.execute.mockResolvedValue({
      status: 'success',
      post: 'Soliloquy fallback #全肯定AIレベッカ',
    });

    const controller = new ProactiveAnniversaryController(
      mockUseCase as any,
      mockSoliloquyUseCase as any,
    );
    await controller.handle(req, res);

    expect(mockSoliloquyUseCase.execute).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ post: 'Soliloquy fallback #全肯定AIレベッカ' }),
    );
  });

  it('should return 500 Internal Server Error when useCase throws an error', async () => {
    const { ProactiveAnniversaryController } = await import('../../src/features/anniversary/controller');
    mockUseCase.execute.mockRejectedValue(new Error('Transient downstream failure'));

    const controller = new ProactiveAnniversaryController(
      mockUseCase as any,
      mockSoliloquyUseCase as any,
    );
    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    expect(mockSoliloquyUseCase.execute).not.toHaveBeenCalled();
  });
});
