import { GeminiService, GeminiServiceConfig } from '../../src/services/gemini';

describe('GeminiService Unit Tests', () => {
    let mockGenerateContent: jest.Mock;
    let mockEmbedContent: jest.Mock;
    let mockAiClient: any;
    let defaultConfig: GeminiServiceConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateContent = jest.fn();
        mockEmbedContent = jest.fn();

        mockAiClient = {
            models: {
                generateContent: mockGenerateContent,
                embedContent: mockEmbedContent,
            },
        };

        defaultConfig = {
            apiKey: 'test-key',
            model: 'test-model',
            embeddingModel: 'test-embedding-model',
            newsPostModel: 'test-news-post-model',
            judgeModel: 'test-judge-model',
            languageModel: 'test-language-model',
            visionModel: 'test-vision-model',
            imageInferenceModel: 'test-image-inference-model',
            appTimezone: 'Asia/Tokyo',
        };
    });

    const getGeminiService = (configOverride?: Partial<GeminiServiceConfig>, client = mockAiClient) => {
        return new GeminiService({ ...defaultConfig, ...configOverride }, client);
    };

    describe('generateDreaming', () => {
        it('should generate dreaming data successfully', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '{"attributes":["test"]}' });
            const result = await gemini.generateDreaming('sys', [{ role: 'user', content: 'test' }], {});
            expect(result).toEqual({ attributes: ['test'] });
        });

        it('should throw error if JSON parsing fails', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'invalid json' });
            await expect(gemini.generateDreaming('sys', [], {})).rejects.toThrow(SyntaxError);
        });
    });

    describe('generateStructuredNewsPost', () => {
        it('should generate structured news post successfully', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: '{"selectedTitle":"Headlines","thought":"News thought","reply":"News tweet"}'
            });
            const result = await gemini.generateStructuredNewsPost('mock instruction', 'prompt with headlines', ['Headlines']);
            expect(result).toEqual({
                selectedTitle: 'Headlines',
                thought: 'News thought',
                reply: 'News tweet'
            });
        });

        it('should throw error on API error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
            await expect(gemini.generateStructuredNewsPost('mock instruction', 'prompt with headlines', ['Headlines'])).rejects.toThrow('Network error');
        });

        it('should throw error if prompt or headlines are empty (boundary case)', async () => {
            const gemini = getGeminiService();
            await expect(gemini.generateStructuredNewsPost('mock instruction', '', ['Headlines'])).rejects.toThrow('Prompt cannot be empty');
            await expect(gemini.generateStructuredNewsPost('mock instruction', 'prompt', [])).rejects.toThrow('Candidate headlines cannot be empty');
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('auditEvolutionPrompt', () => {
        it('should return pass if audit is successful', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '```json\n{"pass":true}\n```' });
            const result = await gemini.auditEvolutionPrompt('test prompt', 'audit instruction');
            expect(result).toEqual({ pass: true });
        });

        it('should return pass: false on API error (fail-safe)', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.auditEvolutionPrompt('test prompt', 'audit instruction');
            expect(result.pass).toBe(false);
            expect(result.reason).toBe('Audit API Error');
        });

        it('should handle markdown code block without language', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '```\n{"pass":true}\n```' });
            const result = await gemini.auditEvolutionPrompt('test prompt', 'audit instruction');
            expect(result).toEqual({ pass: true });
        });
    });

    describe('generateTimelineSummary', () => {
        it('should generate timeline summary', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'Summary' });
            const result = await gemini.generateTimelineSummary(['post1']);
            expect(result).toBe('Summary');
        });

        it('should throw error when Gemini API generation fails', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));
            await expect(gemini.generateTimelineSummary(['post1'])).rejects.toThrow('API quota exceeded');
        });
    });

    describe('generateEmbedding', () => {
        it('should return embeddings', async () => {
            const gemini = getGeminiService();
            mockEmbedContent.mockResolvedValueOnce({ embeddings: [{ values: [0.1, 0.2] }] });
            const result = await gemini.generateEmbedding('test');
            expect(result).toEqual([0.1, 0.2]);
        });

        it('should return empty array on error', async () => {
            const gemini = getGeminiService();
            mockEmbedContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.generateEmbedding('test');
            expect(result).toEqual([]);
        });
    });

    describe('analyzeUserProfile', () => {
        it('should return profile data', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '{"attributes":["worker"]}' });
            const result = await gemini.analyzeUserProfile('Bio');
            expect(result).toEqual({ attributes: ['worker'] });
        });

        it('should return empty object on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.analyzeUserProfile('Bio');
            expect(result).toEqual({});
        });
    });

    describe('generateSearchQuery', () => {
        it('should return search query', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'search term' });
            const result = await gemini.generateSearchQuery('context', 'input');
            expect(result).toBe('search term');
        });

        it('should fallback to input on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.generateSearchQuery('context', 'input');
            expect(result).toBe('input');
        });
    });

    describe('analyzeImageCaption', () => {
        it('should return caption successfully', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'A nice view' });
            const result = await gemini.analyzeImageCaption(Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('A nice view');
        });

        it('should return empty string on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.analyzeImageCaption(Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('');
        });
    });

    describe('inferImageSearchQuery', () => {
        it('should return search query successfully', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'coffee' });
            const result = await gemini.inferImageSearchQuery('tweet text');
            expect(result).toBe('coffee');
        });

        it('should return null if it outputs null', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'null' });
            const result = await gemini.inferImageSearchQuery('tweet text');
            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.inferImageSearchQuery('tweet text');
            expect(result).toBeNull();
        });
    });

    describe('generateEvolutionPrompt', () => {
        it('should return generated text', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'New prompt' });
            const result = await gemini.generateEvolutionPrompt('logs');
            expect(result).toBe('New prompt');
        });

        it('should throw on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            await expect(gemini.generateEvolutionPrompt('logs')).rejects.toThrow('Error');
        });
    });

    describe('detectLanguage', () => {
        it('should return en if text contains en', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'en' });
            const result = await gemini.detectLanguage('Hello');
            expect(result).toBe('en');
        });

        it('should return ja if text is ja', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'ja' });
            const result = await gemini.detectLanguage('こんにちは');
            expect(result).toBe('ja');
        });

        it('should fallback to ja on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Error'));
            const result = await gemini.detectLanguage('Hello');
            expect(result).toBe('ja');
        });

        it('should call generateContent with maxOutputTokens: 300', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'en' });
            await gemini.detectLanguage('Hello');
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
                config: { maxOutputTokens: 300 }
            }));
        });
    });

    describe('generateStructuredNewsPost and generateStructuredTimelinePost', () => {
        it('should handle array of headlines and string prompt', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: '{"selectedTitle":"headline 1","thought":"t1","reply":"News post content"}'
            });

            const res1 = await gemini.generateStructuredNewsPost('sys', 'prompt', ['headline 1', 'headline 2']);
            expect(res1).toEqual({
                selectedTitle: 'headline 1',
                thought: 't1',
                reply: 'News post content',
            });

            mockGenerateContent.mockResolvedValueOnce({ text: '{"thought":"t2","reply":"Soliloquy post content 2"}' });
            const res2 = await gemini.generateStructuredTimelinePost('sys', 'single prompt');
            expect(res2).toEqual({ thought: 't2', reply: 'Soliloquy post content 2' });
        });

        it('should throw error if prompt is empty or error occurs', async () => {
            const gemini = getGeminiService();
            await expect(gemini.generateStructuredNewsPost('sys', '', ['h1'])).rejects.toThrow('Prompt cannot be empty');
            await expect(gemini.generateStructuredTimelinePost('sys', '')).rejects.toThrow('Prompt cannot be empty');

            mockGenerateContent.mockRejectedValueOnce(new Error('Gemini error'));
            await expect(gemini.generateStructuredNewsPost('sys', 'prompt', ['h1'])).rejects.toThrow('Gemini error');

            mockGenerateContent.mockResolvedValueOnce({
                text: '{"selectedTitle":"h1","thought":"only thought","reply":""}'
            });
            await expect(gemini.generateStructuredNewsPost('sys', 'prompt', ['h1'])).rejects.toThrow('empty reply');
        });
    });

    describe('generateTimelineSummary', () => {
        it('should handle prompt array and return trimmed text', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '  New summary  ' });

            const res = await gemini.generateTimelineSummary(['post1', 'post2']);
            expect(res).toBe('New summary');
        });

        it('should throw error when prompt is empty array or blank string', async () => {
            const gemini = getGeminiService();
            await expect(gemini.generateTimelineSummary([])).rejects.toThrow(
                '[GeminiService] Prompt for timeline summary cannot be empty.',
            );
            await expect(gemini.generateTimelineSummary('   ')).rejects.toThrow(
                '[GeminiService] Prompt for timeline summary cannot be empty.',
            );
        });

        it('should throw error when Gemini returns empty response', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '   ' });
            await expect(gemini.generateTimelineSummary('prompt')).rejects.toThrow(
                '[GeminiService] Gemini returned empty response for timeline summary.',
            );
        });
    });

    describe('auditEvolutionPrompt', () => {
        it('should strip json and generic markdown blocks', async () => {
            const gemini = getGeminiService();
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
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'INVALID_JSON' });
            const res = await gemini.auditEvolutionPrompt('cand', 'audit');
            expect(res.pass).toBe(false);
        });
    });

    describe('generateSearchQuery', () => {
        it('should handle string and array prompts and fallback on error', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: 'search keywords' });

            const res1 = await gemini.generateSearchQuery('sys', 'ctx1');
            expect(res1).toBe('search keywords');

            mockGenerateContent.mockRejectedValueOnce(new Error('Search query error'));
            const resFallback = await gemini.generateSearchQuery('sys', 'initial query');
            expect(resFallback).toBe('initial query');
        });
    });

    describe('analyzeUserProfile', () => {
        it('should catch error and return empty object', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('Analysis failed'));
            const res = await gemini.analyzeUserProfile('user bio');
            expect(res).toEqual({});
        });
    });

    describe('generateStructuredReply', () => {
        it('should generate structured thought and reply JSON', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ thought: '心配だわ', reply: 'お疲れ様♡' })
            });

            const res = await gemini.generateStructuredReply('System', [], '疲れた');
            expect(res.thought).toBe('心配だわ');
            expect(res.reply).toBe('お疲れ様♡');
        });

        it('should handle tool calling with web search in structured reply', async () => {
            const gemini = getGeminiService();

            mockGenerateContent
                .mockResolvedValueOnce({
                    functionCalls: [{ name: 'search_web', args: { query: '最新の量子コンピュータ' } }],
                    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_web', args: { query: '最新の量子コンピュータ' } } }] } }]
                })
                .mockResolvedValueOnce({
                    text: '量子コンピュータの最新ブレークスルー概要'
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ thought: '量子コンピュータについて調べたわ', reply: '最新のブレークスルーについて教えてあげるね！' })
                });

            const res = await gemini.generateStructuredReply('System', [], '量子コンピュータの最新動向教えて');
            expect(res.thought).toBe('量子コンピュータについて調べたわ');
            expect(res.reply).toBe('最新のブレークスルーについて教えてあげるね！');
            expect(mockGenerateContent).toHaveBeenCalledTimes(3);

            expect(mockGenerateContent).toHaveBeenNthCalledWith(2, {
                model: 'test-model',
                contents: [{ role: 'user', parts: [{ text: '最新の量子コンピュータ' }] }],
                config: {
                    tools: [{ googleSearch: {} }],
                    safetySettings: []
                }
            });
        });

        it('should handle search_web gracefully when query is missing or empty without falling back to userInput', async () => {
            const gemini = getGeminiService();

            mockGenerateContent
                .mockResolvedValueOnce({
                    functionCalls: [{ name: 'search_web', args: {} }],
                    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_web', args: {} } }] } }]
                })
                .mockResolvedValueOnce({
                    text: JSON.stringify({ thought: 'クエリがなかったわ', reply: '何を調べればいいか教えてね♡' })
                });

            const res = await gemini.generateStructuredReply('System', [], 'これ調べて');
            expect(res.thought).toBe('クエリがなかったわ');
            expect(res.reply).toBe('何を調べればいいか教えてね♡');
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);

            const secondCallContents = mockGenerateContent.mock.calls[1][0].contents;
            const functionRespPart = secondCallContents[secondCallContents.length - 1].parts[0];
            expect(functionRespPart.functionResponse.response.result).toBe('検索クエリが指定されていません。');
        });
    });

    describe('verifyImageRelevance', () => {
        it('should return true when LLM evaluates image as relevant', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ relevant: true, reason: 'Context matches' })
            });

            const res = await gemini.verifyImageRelevance('A cute cat enjoying sunshine', '今日はいい天気で猫もまったりしてるわね');
            expect(res).toBe(true);
        });

        it('should return false when LLM evaluates image as irrelevant', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ relevant: false, reason: 'Mismatch' })
            });

            const res = await gemini.verifyImageRelevance('A sports car on highway', 'おいしいパスタ作ったわ♡');
            expect(res).toBe(false);
        });

        it('should handle parsing error and return false safely', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

            const res = await gemini.verifyImageRelevance('Caption', 'Post text');
            expect(res).toBe(false);
        });
    });

    describe('Constructor initialization', () => {
        it('should instantiate GoogleGenAI when apiKey is provided without custom client', () => {
            const service = new GeminiService({
                apiKey: 'test-key-direct',
                model: 'test-model',
                embeddingModel: 'test-emb',
            });
            expect(service).toBeDefined();
        });
    });

    describe('generateStructuredReply edge branches', () => {
        it('should format history with timestamp and thought accurately', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ thought: '思考', reply: '返信' })
            });

            const history = [
                { role: 'user' as const, content: 'User message', timestamp: '2026-09-08T00:00:00Z' },
                { role: 'model' as const, content: 'AI reply', thought: 'AI thought', timestamp: '2026-09-08T00:01:00Z' },
                { role: 'model' as const, content: 'AI reply no thought' }
            ];

            const res = await gemini.generateStructuredReply('System', history, 'Hello');
            expect(res.reply).toBe('返信');
            const calledContents = mockGenerateContent.mock.calls[0][0].contents;
            expect(calledContents[0].parts[0].text).toContain('User message');
            expect(calledContents[1].parts[0].text).toContain('【思考・本音】AI thought');
            expect(calledContents[2].parts[0].text).toBe('AI reply no thought');
        });

        it('should throw error when rawText is empty or reply is empty', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '' });
            await expect(gemini.generateStructuredReply('System', [], 'Hello')).rejects.toThrow('empty structured response');

            mockGenerateContent.mockResolvedValueOnce({ text: '{"thought":"t","reply":"   "}' });
            await expect(gemini.generateStructuredReply('System', [], 'Hello')).rejects.toThrow('empty reply');
        });

        it('should handle executeWebSearch error gracefully', async () => {
            const gemini = getGeminiService();
            mockGenerateContent
                .mockResolvedValueOnce({
                    functionCalls: [{ name: 'search_web', args: { query: 'fail_query' } }],
                    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_web', args: { query: 'fail_query' } } }] } }]
                })
                .mockRejectedValueOnce(new Error('Search engine down'))
                .mockResolvedValueOnce({
                    text: JSON.stringify({ thought: 'エラーだった', reply: '検索できなかったよ' })
                });

            const res = await gemini.generateStructuredReply('System', [], 'fail_query 調べて');
            expect(res.reply).toBe('検索できなかったよ');
        });

        it('should throw when post-search final response has empty text or empty reply', async () => {
            const gemini = getGeminiService();
            mockGenerateContent
                .mockResolvedValueOnce({
                    functionCalls: [{ name: 'search_web', args: { query: 'q' } }],
                    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_web', args: { query: 'q' } } }] } }]
                })
                .mockResolvedValueOnce({ text: 'search results' })
                .mockResolvedValueOnce({ text: '' });

            await expect(gemini.generateStructuredReply('System', [], 'q')).rejects.toThrow('empty structured response after function execution');
        });
    });

    describe('generateStructuredNewsPost edge branches', () => {
        it('should throw when response text is empty or schema is malformed', async () => {
            const gemini = getGeminiService();
            mockGenerateContent.mockResolvedValueOnce({ text: '' });
            await expect(gemini.generateStructuredNewsPost('sys', 'prompt', ['title1'])).rejects.toThrow('empty response for structured news post');

            mockGenerateContent.mockResolvedValueOnce({ text: '{"thought":123,"reply":"abc","selectedTitle":"title1"}' });
            await expect(gemini.generateStructuredNewsPost('sys', 'prompt', ['title1'])).rejects.toThrow('malformed response schema');
        });
    });

    describe('Missing Credentials Guard (!ai)', () => {
        it('should throw explicit error for core generation operations when API key is missing', async () => {
            const gemini = new GeminiService({ model: 'm', embeddingModel: 'e' });

            await expect(gemini.generateStructuredReply('sys', [], 'test')).rejects.toThrow('Gemini API client not initialized');
            await expect(gemini.generateDreaming('sys', [], {} as any)).rejects.toThrow('Gemini API client not initialized');
            expect(await gemini.verifyImageRelevance('caption', 'post')).toBe(false);
            expect(await gemini.generateEvolutionPrompt('logs')).toBe('');
            expect(await gemini.auditEvolutionPrompt('cand', 'audit')).toEqual({ pass: true });
            expect(await gemini.analyzeUserProfile('desc')).toEqual({});
            await expect(gemini.generateStructuredNewsPost('sys', 'prompt', ['news'])).rejects.toThrow('Gemini API client not initialized');
            await expect(gemini.generateStructuredTimelinePost('sys', 'soliloquy')).rejects.toThrow('Gemini API client not initialized');
            await expect(gemini.generateTimelineSummary(['post'])).rejects.toThrow('Gemini API client not initialized');
            expect(await gemini.detectLanguage('test')).toBe('ja');
            expect(await gemini.generateEmbedding('test')).toEqual([]);
            expect(await gemini.generateSearchQuery('ctx', 'in')).toBe('in');
        });
    });
});
