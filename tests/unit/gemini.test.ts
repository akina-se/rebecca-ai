import { GoogleGenAI } from '@google/genai';

jest.mock('../../src/config', () => ({
    __esModule: true,
    default: {
        gemini: {
            apiKey: 'test-key',
            model: 'test-model'
        },
        gcp: {
            projectId: 'test-project'
        }
    }
}));

jest.mock('@google/genai', () => {
    return {
        GoogleGenAI: jest.fn()
    };
});

jest.mock('../../src/core/news', () => ({
    fetchYahooNewsHeadlines: jest.fn()
}));

describe('gemini.ts', () => {
    let mockGenerateContent: jest.Mock;
    let mockEmbedContent: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateContent = jest.fn();
        mockEmbedContent = jest.fn();
        
        (GoogleGenAI as jest.Mock).mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent,
                embedContent: mockEmbedContent
            }
        }));
    });

    const getGeminiModule = () => {
        let module: any;
        let newsModule: any;
        jest.isolateModules(() => {
            module = require('../../src/services/gemini');
            newsModule = require('../../src/core/news');
        });
        return { gemini: module, news: newsModule };
    };

    describe('generateReply', () => {
        it('should generate a reply successfully (normal case)', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'Hello Master' });

            const history = [{ role: 'user', content: 'Hi' }];
            const result = await gemini.generateReply('System instruction', history, 'How are you?');

            expect(result).toBe('Hello Master');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('should handle function calling (search_news) successfully', async () => {
            const { gemini, news } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({
                functionCalls: [{ name: 'search_news' }],
                candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_news' } }] } }]
            });
            news.fetchYahooNewsHeadlines.mockResolvedValueOnce(['News 1', 'News 2']);
            mockGenerateContent.mockResolvedValueOnce({ text: 'Here is the news' });

            const result = await gemini.generateReply('System instruction', [], 'News?');

            expect(result).toBe('Here is the news');
            expect(news.fetchYahooNewsHeadlines).toHaveBeenCalled();
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        });

        it('should handle API errors (abnormal case)', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));
            await expect(gemini.generateReply('sys', [], 'test')).rejects.toThrow('API quota exceeded');
        });
    });

    describe('generateDreaming', () => {
        it('should generate dreaming data successfully', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: '{"attributes":["test"]}' });
            const result = await gemini.generateDreaming('sys', [{role:'user', content:'test'}], {});
            expect(result).toEqual({ attributes: ['test'] });
        });

        it('should throw error if JSON parsing fails', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'invalid json' });
            await expect(gemini.generateDreaming('sys', [], {})).rejects.toThrow(SyntaxError);
        });
    });

    describe('generateNewsPost', () => {
        it('should generate news post successfully', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'News tweet' });
            const result = await gemini.generateNewsPost(['Headlines']);
            expect(result).toBe('News tweet');
        });

        it('should return empty string on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
            const result = await gemini.generateNewsPost(['Headlines']);
            expect(result).toBe('');
        });

        it('should return empty string if headlines are empty (boundary case)', async () => {
            const { gemini } = getGeminiModule();
            const result = await gemini.generateNewsPost([]);
            expect(result).toBe('');
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('auditEvolutionPrompt', () => {
        it('should return pass if audit is successful', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: '```json\n{"pass":true}\n```' });
            const result = await gemini.auditEvolutionPrompt('test prompt');
            expect(result).toEqual({ pass: true });
        });

        it('should return pass: false on API error (fail-safe)', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.auditEvolutionPrompt('test prompt');
            expect(result.pass).toBe(false);
            expect(result.reason).toBe('Audit API Error');
        });
    });

    describe('generateTimelineSummary', () => {
        it('should generate timeline summary', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'Summary' });
            const result = await gemini.generateTimelineSummary(['post1']);
            expect(result).toBe('Summary');
        });

        it('should return previous summary on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.generateTimelineSummary(['post1'], 'Prev Summary');
            expect(result).toBe('Prev Summary');
        });
    });

    describe('generateEmbedding', () => {
        it('should return embeddings', async () => {
            const { gemini } = getGeminiModule();
            mockEmbedContent.mockResolvedValueOnce({ embeddings: [{ values: [0.1, 0.2] }] });
            const result = await gemini.generateEmbedding('test');
            expect(result).toEqual([0.1, 0.2]);
        });

        it('should return empty array on error', async () => {
            const { gemini } = getGeminiModule();
            mockEmbedContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.generateEmbedding('test');
            expect(result).toEqual([]);
        });
    });

    describe('analyzeUserProfile', () => {
        it('should return profile data', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: '{"attributes":["worker"]}' });
            const result = await gemini.analyzeUserProfile('Bio');
            expect(result).toEqual({ attributes: ['worker'] });
        });

        it('should return empty object on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.analyzeUserProfile('Bio');
            expect(result).toEqual({});
        });
    });

    describe('generateSearchQuery', () => {
        it('should return search query', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'search term' });
            const result = await gemini.generateSearchQuery('context', 'input');
            expect(result).toBe('search term');
        });

        it('should fallback to input on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.generateSearchQuery('context', 'input');
            expect(result).toBe('input');
        });
    });

    describe('generateEvolutionPrompt', () => {
        it('should return generated text', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'New prompt' });
            const result = await gemini.generateEvolutionPrompt('logs');
            expect(result).toBe('New prompt');
        });

        it('should throw on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            await expect(gemini.generateEvolutionPrompt('logs')).rejects.toThrow('Error');
        });
    });

    describe('detectLanguage', () => {
        it('should return en if text contains en', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'en' });
            const result = await gemini.detectLanguage('Hello');
            expect(result).toBe('en');
        });

        it('should return ja if text is ja', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'ja' });
            const result = await gemini.detectLanguage('こんにちは');
            expect(result).toBe('ja');
        });

        it('should fallback to ja on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.detectLanguage('Hello');
            expect(result).toBe('ja');
        });
    });
});
