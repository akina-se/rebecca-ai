import { ProactiveNewsUseCase } from '../../src/features/news/usecase';
import { createMockDeps } from './core/testUtils';

describe('runProactiveNewsPostBatch', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
    });

    it('should skip if no headlines are fetched', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue([]);

        const result = await new ProactiveNewsUseCase(deps).execute();
        expect(result).toEqual({ status: 'skipped', reason: 'No headlines' });
        expect(deps.gemini.generateNewsPost).not.toHaveBeenCalled();
    });

    it('should fail if generation fails', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        deps.gemini.generateNewsPost.mockResolvedValue('');

        const result = await new ProactiveNewsUseCase(deps).execute();
        expect(result).toEqual({ status: 'failed', reason: 'Generation failed' });
        expect(deps.gemini.inferImageSearchQuery).not.toHaveBeenCalled();
        expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should append hashtag if total length <= 140', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        
        const shortPost = 'A short news post.'; // 18 chars
        deps.gemini.generateNewsPost.mockResolvedValue(shortPost);

        const result = await new ProactiveNewsUseCase(deps).execute();
        
        expect(result.status).toBe('success');
        expect(result.post).toBe(shortPost + '\n#全肯定AIレベッカ');
        expect(deps.xApi.tweet).toHaveBeenCalledWith(shortPost + '\n#全肯定AIレベッカ', { mediaIds: [] });
        expect(deps.firestore.saveTimelinePost).toHaveBeenCalled();
    });

    it('should omit hashtag if total length > 140', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        
        const longPost = 'A'.repeat(135); 
        deps.gemini.generateNewsPost.mockResolvedValue(longPost);

        const result = await new ProactiveNewsUseCase(deps).execute();
        
        expect(result.status).toBe('success');
        expect(result.post).toBe(longPost); 
        expect(deps.xApi.tweet).toHaveBeenCalledWith(longPost, { mediaIds: [] });
    });

    it('should infer keyword, find image, and attach media if successful', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        const text = 'A post about coffee';
        deps.gemini.generateNewsPost.mockResolvedValue(text);
        deps.firestore.getTimelineSummary.mockResolvedValue('summary');
        deps.gemini.inferImageSearchQuery.mockResolvedValue('coffee');
        deps.gemini.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        deps.firestore.findImageByVector.mockResolvedValue({
            id: 'hash123',
            url: 'gs://bucket/images/hash123.jpg'
        });
        deps.storage.downloadImage.mockResolvedValue(Buffer.from('image'));
        deps.xApi.uploadMedia.mockResolvedValue('media_123');

        const result = await new ProactiveNewsUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.attachedMedia).toBe(true);
        expect(deps.storage.downloadImage).toHaveBeenCalledWith('gs://bucket/images/hash123.jpg');
        expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg');
        expect(deps.firestore.updateImageLastUsed).toHaveBeenCalledWith('hash123');
        expect(deps.xApi.tweet).toHaveBeenCalledWith(text + '\n#全肯定AIレベッカ', { mediaIds: ['media_123'] });
    });

    it('should reject image and post text-only if verifyImageRelevance returns false', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        const text = 'A post about coffee';
        deps.gemini.generateNewsPost.mockResolvedValue(text);
        deps.firestore.getTimelineSummary.mockResolvedValue('summary');
        deps.gemini.inferImageSearchQuery.mockResolvedValue('coffee');
        deps.gemini.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        deps.firestore.findImageByVector.mockResolvedValue({
            id: 'hash123',
            url: 'gs://bucket/images/hash123.jpg',
            caption: 'irrelevant image'
        });
        deps.gemini.verifyImageRelevance.mockResolvedValue(false);

        const result = await new ProactiveNewsUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.attachedMedia).toBe(false);
        expect(deps.storage.downloadImage).not.toHaveBeenCalled();
        expect(deps.xApi.tweet).toHaveBeenCalledWith(text + '\n#全肯定AIレベッカ', { mediaIds: [] });
    });

    it('should handle image download or upload failure gracefully', async () => {
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        deps.gemini.generateNewsPost.mockResolvedValue('post');
        deps.gemini.inferImageSearchQuery.mockResolvedValue('coffee');
        deps.gemini.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        deps.firestore.findImageByVector.mockResolvedValue({
            id: 'hash123',
            url: 'gs://bucket/images/hash123.jpg'
        });
        deps.storage.downloadImage.mockRejectedValue(new Error('GCS Error'));

        const result = await new ProactiveNewsUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.attachedMedia).toBe(false);
        expect(deps.xApi.tweet).toHaveBeenCalledWith('post\n#全肯定AIレベッカ', { mediaIds: [] });
    });

    it('should throw and log if tweet fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        deps.newsFetcher.fetchYahooNewsHeadlines.mockResolvedValue(['News 1']);
        deps.gemini.generateNewsPost.mockResolvedValue('text');
        deps.xApi.tweet.mockRejectedValue(new Error('Twitter API down'));

        await expect(new ProactiveNewsUseCase(deps).execute()).rejects.toThrow('Twitter API down');
        
        expect(consoleSpy).toHaveBeenCalledWith('Error in runProactiveNewsPostBatch:', expect.any(Error));
        consoleSpy.mockRestore();
    });
});
