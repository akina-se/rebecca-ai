import { ProactiveNewsUseCase } from '../../src/features/news/usecase';
import { createMockDeps } from './core/testUtils';

describe('ProactiveNewsUseCase Unit Tests', () => {
    let deps: any;
    let mockSoliloquy: { execute: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
        mockSoliloquy = {
            execute: jest.fn().mockResolvedValue({
                status: 'success',
                post: '独り言テスト #全肯定AIレベッカ',
                attachedMedia: false,
            }),
        };
        deps.firestore.getRecentNewsEmbeddings.mockResolvedValue([]);
        deps.firestore.getTimelineSummary.mockResolvedValue('Recent timeline events');
        deps.firestore.getExtendedPrompt.mockResolvedValue('User loves coffee');
        deps.gemini.generateEmbedding.mockResolvedValue(new Array(768).fill(0.1));
        deps.xApi.tweet.mockResolvedValue({ data: { id: 'tweet_news_123' } });
    });

    it('should fall back to soliloquy if no headlines are fetched', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue([]);

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();
        expect(mockSoliloquy.execute).toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(result.post).toContain('独り言テスト');
        expect(deps.gemini.generateNewsPost).not.toHaveBeenCalled();
    });

    it('should fall back to soliloquy if all headlines are duplicates of recent news', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['ITパスポート シラバス案公開']);
        // Past news has same embedding [1, 0], cosine similarity is 1.0 >= 0.82
        deps.firestore.getRecentNewsEmbeddings.mockResolvedValue([
            { title: 'ITパスポート 新シラバス', embedding: [1, 0] },
        ]);
        deps.gemini.generateEmbedding.mockResolvedValue([1, 0]);

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();

        expect(mockSoliloquy.execute).toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(deps.gemini.generateNewsPost).not.toHaveBeenCalled();
    });

    it('should filter out duplicate headlines and post fresh headline', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue([
            'ITパスポート 重複ニュース',
            '完全新作ゲーム発表！',
        ]);
        deps.firestore.getRecentNewsEmbeddings.mockResolvedValue([
            { title: 'ITパスポート 既出', embedding: [1, 0] },
        ]);
        // First headline returns [1, 0] (duplicate), second returns [0, 1] (cosine similarity 0)
        deps.gemini.generateEmbedding
            .mockResolvedValueOnce([1, 0])
            .mockResolvedValueOnce([0, 1]);

        deps.gemini.generateNewsPost.mockResolvedValue('新作ゲーム楽しみね！');

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();

        expect(deps.firestore.getRecentNewsEmbeddings).toHaveBeenCalledWith(30);
        expect(mockSoliloquy.execute).not.toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(result.post).toBe('新作ゲーム楽しみね！\n#全肯定AIレベッカ');
        expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('完全新作ゲーム発表！'),
        );
        expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('【直近のタイムライン要約】'),
        );
        expect(deps.gemini.generateNewsPost).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('【拡張ペルソナ・近況】'),
        );
        expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
            expect.stringContaining('新作ゲーム楽しみね！'),
            expect.objectContaining({
                postType: 'news',
                newsTitle: '完全新作ゲーム発表！',
            }),
        );
    });

    it('should fall back to soliloquy if generation fails', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        deps.gemini.generateNewsPost.mockResolvedValue('');

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();
        expect(mockSoliloquy.execute).toHaveBeenCalled();
        expect(result.status).toBe('success');
    });

    it('should append hashtag if total length <= 140', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        const shortPost = 'A short news post.';
        deps.gemini.generateNewsPost.mockResolvedValue(shortPost);

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();

        expect(result.status).toBe('success');
        expect(result.post).toBe(shortPost + '\n#全肯定AIレベッカ');
        expect(deps.xApi.tweet).toHaveBeenCalledWith(shortPost + '\n#全肯定AIレベッカ', { mediaIds: [] });
    });

    it('should omit hashtag if total length > 140', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        const longPost = 'A'.repeat(135);
        deps.gemini.generateNewsPost.mockResolvedValue(longPost);

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();

        expect(result.status).toBe('success');
        expect(result.post).toBe(longPost);
        expect(deps.xApi.tweet).toHaveBeenCalledWith(longPost, { mediaIds: [] });
    });

    it('should attach media when image inference succeeds', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        const text = 'A post about coffee';
        deps.gemini.generateNewsPost.mockResolvedValue(text);
        deps.firestore.getTimelineSummary.mockResolvedValue('summary');
        deps.gemini.inferImageSearchQuery.mockResolvedValue('coffee');
        deps.gemini.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        deps.firestore.findImageByVector.mockResolvedValue({
            id: 'hash123',
            url: 'gs://bucket/images/hash123.jpg',
        });
        deps.gemini.verifyImageRelevance.mockResolvedValue(true);
        deps.storage.downloadImage.mockResolvedValue(Buffer.from('image'));
        deps.xApi.uploadMedia.mockResolvedValue('media_123');

        const result = await new ProactiveNewsUseCase(deps, mockSoliloquy).execute();

        expect(result.status).toBe('success');
        expect(result.attachedMedia).toBe(true);
        expect(deps.storage.downloadImage).toHaveBeenCalledWith('gs://bucket/images/hash123.jpg');
        expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg');
        expect(deps.firestore.updateImageLastUsed).toHaveBeenCalledWith('hash123');
        expect(deps.xApi.tweet).toHaveBeenCalledWith(text + '\n#全肯定AIレベッカ', { mediaIds: ['media_123'] });
    });
});
