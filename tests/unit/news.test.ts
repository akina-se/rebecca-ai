import { runProactiveNewsPostBatch, fetchYahooNewsHeadlines } from '../../src/core/news';
import * as firestore from '../../src/services/firestore';
import * as gemini from '../../src/services/gemini';
import * as xApi from '../../src/services/xApi';

jest.mock('../../src/services/firestore');
jest.mock('../../src/services/gemini');
jest.mock('../../src/services/xApi');

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
            expect(xApi.tweet).toHaveBeenCalledWith(shortPost + '\n#全肯定AIレベッカ');
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
            expect(xApi.tweet).toHaveBeenCalledWith(longPost);
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
