import { runProactiveNewsPostBatch, fetchYahooNewsHeadlines } from '../../src/core/news';
import * as firestore from '../../src/services/firestore';
import * as gemini from '../../src/services/gemini';
import * as xApi from '../../src/services/xApi';
import * as storage from '../../src/services/storage';

jest.mock('../../src/services/firestore');
jest.mock('../../src/services/gemini');
jest.mock('../../src/services/xApi');
jest.mock('../../src/services/storage');

describe('news.ts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    describe('fetchYahooNewsHeadlines', () => {
        it('should fetch and parse RSS titles (normal case)', async () => {
            const mockRss = `
                <rss>
                    <channel>
                        <title>Yahoo!ニュース・トピックス - 主要</title>
                        <item><title>Important News 1</title></item>
                        <item><title>Important News 2</title></item>
                        <item><title>Yahoo! JAPAN</title></item>
                    </channel>
                </rss>
            `;
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce(mockRss)
            });

            const headlines = await fetchYahooNewsHeadlines();
            
            // Should exclude the main title and 'Yahoo! JAPAN'
            expect(headlines).toEqual(['Important News 1', 'Important News 2']);
        });

        it('should return empty array on fetch error (abnormal case)', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
            
            const headlines = await fetchYahooNewsHeadlines();
            expect(headlines).toEqual([]);
        });
    });

    describe('runProactiveNewsPostBatch', () => {
        it('should skip if no headlines are fetched (boundary case)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<rss></rss>')
            });

            const result = await runProactiveNewsPostBatch();
            expect(result).toEqual({ status: 'skipped', reason: 'No headlines' });
            expect(gemini.generateNewsPost).not.toHaveBeenCalled();
        });

        it('should fail if generation fails (abnormal case)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce('');

            const result = await runProactiveNewsPostBatch();
            expect(result).toEqual({ status: 'failed', reason: 'Generation failed' });
            expect(gemini.inferImageSearchQuery).not.toHaveBeenCalled();
            expect(xApi.tweet).not.toHaveBeenCalled();
        });

        it('should append hashtag if total length <= 140 (normal case)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            
            const shortPost = 'A short news post.'; // 18 chars
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce(shortPost);

            const result = await runProactiveNewsPostBatch();
            
            expect(result.status).toBe('success');
            expect(result.post).toBe(shortPost + '\n#全肯定AIレベッカ');
            expect(xApi.tweet).toHaveBeenCalledWith(shortPost + '\n#全肯定AIレベッカ', []);
            expect(firestore.saveTimelinePost).toHaveBeenCalled();
        });

        it('should omit hashtag if total length > 140 (boundary case)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            
            // 135 chars + hashtag (12 chars) = 147 > 140
            const longPost = 'A'.repeat(135); 
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce(longPost);

            const result = await runProactiveNewsPostBatch();
            
            expect(result.status).toBe('success');
            expect(result.post).toBe(longPost); // no hashtag appended
            expect(xApi.tweet).toHaveBeenCalledWith(longPost, []);
        });

        it('should infer keyword, find image, and attach media if successful', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            const text = 'A post about coffee';
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce(text);
            (firestore.getTimelineSummary as jest.Mock).mockResolvedValueOnce('summary');
            (gemini.inferImageSearchQuery as jest.Mock).mockResolvedValueOnce('coffee');
            (gemini.generateEmbedding as jest.Mock).mockResolvedValueOnce([0.1, 0.2]);
            (firestore.findImageByVector as jest.Mock).mockResolvedValueOnce({
                id: 'hash123',
                url: 'gs://bucket/images/hash123.jpg'
            });
            (storage.downloadImage as jest.Mock).mockResolvedValueOnce(Buffer.from('image'));
            (xApi.uploadMedia as jest.Mock).mockResolvedValueOnce('media_123');

            const result = await runProactiveNewsPostBatch();

            expect(result.status).toBe('success');
            expect(result.attachedMedia).toBe(true);
            expect(storage.downloadImage).toHaveBeenCalledWith('gs://bucket/images/hash123.jpg');
            expect(xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg');
            expect(firestore.updateImageLastUsed).toHaveBeenCalledWith('hash123');
            // Check tweet was called with mediaId
            expect(xApi.tweet).toHaveBeenCalledWith(text + '\n#全肯定AIレベッカ', ['media_123']);
        });

        it('should handle image download or upload failure gracefully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce('post');
            (gemini.inferImageSearchQuery as jest.Mock).mockResolvedValueOnce('coffee');
            (gemini.generateEmbedding as jest.Mock).mockResolvedValueOnce([0.1, 0.2]);
            (firestore.findImageByVector as jest.Mock).mockResolvedValueOnce({
                id: 'hash123',
                url: 'gs://bucket/images/hash123.jpg'
            });
            (storage.downloadImage as jest.Mock).mockRejectedValueOnce(new Error('GCS Error'));

            const result = await runProactiveNewsPostBatch();

            // Still posts successfully but without media
            expect(result.status).toBe('success');
            expect(result.attachedMedia).toBe(false);
            expect(xApi.tweet).toHaveBeenCalledWith('post\n#全肯定AIレベッカ', []);
        });

        it('should throw and log if tweet fails (abnormal case)', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                text: jest.fn().mockResolvedValueOnce('<title>News 1</title>')
            });
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce('text');
            (xApi.tweet as jest.Mock).mockRejectedValueOnce(new Error('Twitter API down'));

            await expect(runProactiveNewsPostBatch()).rejects.toThrow('Twitter API down');
            
            expect(consoleSpy).toHaveBeenCalledWith('Error in runProactiveNewsPostBatch:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
