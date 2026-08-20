import { GoogleGenAI } from '@google/genai';
import config from '../../src/config';
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

jest.mock('../../src/utils/newsFetcher', () => ({
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
        let gemini: any;
        let newsFetcher: any;
        jest.isolateModules(() => {
            gemini = require('../../src/services/gemini');
            newsFetcher = require('../../src/utils/newsFetcher');
        });
        return { gemini, news: newsFetcher };
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
            const result = await gemini.generateNewsPost('mock instruction', ['Headlines']);
            expect(result).toBe('News tweet');
        });

        it('should return empty string on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
            const result = await gemini.generateNewsPost('mock instruction', ['Headlines']);
            expect(result).toBe('');
        });

        it('should return empty string if headlines are empty (boundary case)', async () => {
            const { gemini } = getGeminiModule();
            const result = await gemini.generateNewsPost('mock instruction', []);
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

        it('should handle markdown code block without language', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: '```\n{"pass":true}\n```' });
            const result = await gemini.auditEvolutionPrompt('test prompt');
            expect(result).toEqual({ pass: true });
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

    describe('analyzeImageCaption', () => {
        it('should return caption successfully', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'A nice view' });
            const result = await gemini.analyzeImageCaption(Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('A nice view');
        });

        it('should return empty string on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.analyzeImageCaption(Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('');
        });
    });

    describe('inferImageSearchQuery', () => {
        it('should return search query successfully', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'coffee' });
            const result = await gemini.inferImageSearchQuery('tweet text', 'timeline');
            expect(result).toBe('coffee');
        });

        it('should return null if it outputs null', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'null' });
            const result = await gemini.inferImageSearchQuery('tweet text', 'timeline');
            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.inferImageSearchQuery('tweet text', 'timeline');
            expect(result).toBeNull();
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

    describe('generateNewsPost', () => {
        it('should handle array of headlines and string prompt', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'News post content' });

            const res1 = await gemini.generateNewsPost('sys', ['headline 1', 'headline 2']);
            expect(res1).toBe('News post content');

            mockGenerateContent.mockResolvedValueOnce({ text: 'News post content 2' });
            const res2 = await gemini.generateNewsPost('sys', 'single prompt');
            expect(res2).toBe('News post content 2');
        });

        it('should return empty string if prompt is empty or error occurs', async () => {
            const { gemini } = getGeminiModule();
            expect(await gemini.generateNewsPost('sys', [])).toBe('');
            expect(await gemini.generateNewsPost('sys', '')).toBe('');

            mockGenerateContent.mockRejectedValueOnce(new Error('Gemini error'));
            expect(await gemini.generateNewsPost('sys', 'prompt')).toBe('');
        });
    });

    describe('generateTimelineSummary', () => {
        it('should handle prompt array and fallback to previous summary on error or empty', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'New summary' });

            const res = await gemini.generateTimelineSummary(['post1', 'post2'], 'old summary');
            expect(res).toBe('New summary');

            mockGenerateContent.mockRejectedValueOnce(new Error('Gemini error'));
            const resFallback = await gemini.generateTimelineSummary('prompt', 'old summary');
            expect(resFallback).toBe('old summary');

            expect(await gemini.generateTimelineSummary([], 'prev')).toBe('prev');
        });
    });

    describe('auditEvolutionPrompt', () => {
        it('should strip json and generic markdown blocks', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({
                text: '```json\n{"pass": true, "reason": "Looks good"}\n```',
            });

            const res = await gemini.auditEvolutionPrompt('cand', 'audit instructions');
            expect(res).toEqual({ pass: true, reason: 'Looks good' });

            mockGenerateContent.mockResolvedValueOnce({
                text: '```\n{"pass": false, "reason": "Unsafe"}\n```',
            });
            const res2 = await gemini.auditEvolutionPrompt('cand', 'audit instructions');
            expect(res2).toEqual({ pass: false, reason: 'Unsafe' });
        });

        it('should return pass: false on parse error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'INVALID_JSON' });
            const res = await gemini.auditEvolutionPrompt('cand', 'audit');
            expect(res.pass).toBe(false);
        });
    });

    describe('generateSearchQuery', () => {
        it('should handle string and array prompts and fallback on error', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockResolvedValueOnce({ text: 'search keywords' });

            const res1 = await gemini.generateSearchQuery('sys', ['ctx1', 'ctx2']);
            expect(res1).toBe('search keywords');

            mockGenerateContent.mockRejectedValueOnce(new Error('Search query error'));
            const resFallback = await gemini.generateSearchQuery('sys', 'initial query');
            expect(resFallback).toBe('initial query');

            expect(await gemini.generateSearchQuery('sys', [])).toEqual([]);
        });
    });

    describe('analyzeUserProfile', () => {
        it('should catch error and return empty object', async () => {
            const { gemini } = getGeminiModule();
            mockGenerateContent.mockRejectedValueOnce(new Error('Analysis failed'));
            const res = await gemini.analyzeUserProfile('user bio');
            expect(res).toEqual({});
        });
    });

    describe('Missing Credentials Fallback (!ai)', () => {
        it('should return mock responses when API key is missing', async () => {
            const originalKey = config.gemini.apiKey;
            config.gemini.apiKey = '';
            const { gemini } = getGeminiModule();

            expect(await gemini.generateReply('sys', [], 'test')).toBe('Mock AI response');
            expect(await gemini.generateDreaming('sys', [], {})).toEqual({ attributes: [], preferences: [], concerns: [], important_memories: [] });
            expect(await gemini.generateEvolutionPrompt('logs')).toBe('');
            expect(await gemini.auditEvolutionPrompt('cand', 'audit')).toEqual({ pass: true });
            expect(await gemini.analyzeUserProfile('desc')).toEqual({});
            expect(await gemini.generateNewsPost('sys', ['news'])).toBe('');
            expect(await gemini.generateTimelineSummary(['post'], 'prev')).toBe('prev');
            expect(await gemini.detectLanguage('test')).toBe('ja');
            expect(await gemini.generateEmbedding('test')).toEqual([]);
            expect(await gemini.generateSearchQuery('ctx', 'in')).toBe('in');

            config.gemini.apiKey = originalKey;
        });
    });
});
