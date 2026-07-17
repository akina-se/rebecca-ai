import request from 'supertest';
import app from '../../src/index';
import * as firestore from '../../src/services/firestore';
import * as gemini from '../../src/services/gemini';
import * as xApi from '../../src/services/xApi';
import * as tasks from '../../src/services/tasks';

// Mock dependencies
jest.mock('../../src/services/firestore', () => ({
    getUserDoc: jest.fn().mockResolvedValue({ episodicBuffer: [], coreProfile: {} }),
    updateUserDoc: jest.fn().mockResolvedValue(undefined),
    appendEpisodicBuffer: jest.fn().mockResolvedValue(undefined),
    checkAndConsumeRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    getAllUsers: jest.fn().mockResolvedValue([]),
    getRecentTimelinePosts: jest.fn().mockResolvedValue([]),
    getRecentConversationLogs: jest.fn().mockResolvedValue([]),
    saveExtendedPrompt: jest.fn().mockResolvedValue(undefined),
    hasProcessedFollower: jest.fn().mockResolvedValue(false),
    markFollowerProcessed: jest.fn().mockResolvedValue(undefined),
    getLastListInteraction: jest.fn().mockResolvedValue(null),
    updateLastListInteraction: jest.fn().mockResolvedValue(undefined),
    hasProcessedMention: jest.fn().mockResolvedValue(false),
    markMentionProcessed: jest.fn().mockResolvedValue(undefined),
    getExtendedPrompt: jest.fn().mockResolvedValue(''),
    getTimelineSummary: jest.fn().mockResolvedValue(''),
    saveRawConversationLog: jest.fn().mockResolvedValue(undefined),
    findRagMemories: jest.fn().mockResolvedValue([]),
    saveRagMemory: jest.fn().mockResolvedValue(undefined),
    getLastMentionId: jest.fn().mockResolvedValue(undefined),
    setLastMentionId: jest.fn().mockResolvedValue(undefined),
    saveTimelinePost: jest.fn().mockResolvedValue(undefined),
    findImageByVector: jest.fn().mockResolvedValue(null),
    updateImageLastUsed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/gemini', () => ({
    generateReply: jest.fn().mockResolvedValue('Mock AI Reply'),
    generateSearchQuery: jest.fn().mockResolvedValue('Mock Query'),
    generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    detectLanguage: jest.fn().mockResolvedValue('ja'),
    generateNewsPost: jest.fn().mockResolvedValue('Mock News Post'),
    analyzeUserProfile: jest.fn().mockResolvedValue({ attributes: ['test'] }),
    inferImageSearchQuery: jest.fn().mockResolvedValue('Mock Query'),
    generateEvolutionPrompt: jest.fn().mockResolvedValue('Mock Prompt'),
    auditEvolutionPrompt: jest.fn().mockResolvedValue({ isSafe: true }),
    generateTimelineSummary: jest.fn().mockResolvedValue('Mock Summary'),
    generateDreaming: jest.fn().mockResolvedValue({}),
    analyzeImageCaption: jest.fn().mockResolvedValue('Mock image caption')
}));

jest.mock('../../src/services/xApi', () => ({
    replyToMention: jest.fn().mockResolvedValue({ data: { id: 'mock_reply_id' } }),
    getMentions: jest.fn().mockResolvedValue({ data: [], meta: { resultCount: 0 } }),
    getFollowers: jest.fn().mockResolvedValue({ data: [] }),
    addListMember: jest.fn().mockResolvedValue(undefined),
    getListMembers: jest.fn().mockResolvedValue({ data: [] }),
    getTweetDetails: jest.fn().mockResolvedValue({ data: { text: '' }, includes: { media: [] } }),
    tweet: jest.fn().mockResolvedValue({ data: { id: 'mock_tweet_id' } }),
    getUserProfile: jest.fn().mockResolvedValue({ data: { description: 'bio' } }),
}));

jest.mock('../../src/services/tasks', () => ({
    enqueueReplyTask: jest.fn().mockResolvedValue({ name: 'mock_task' }),
}));

describe('Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /batch/mentions', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });

        it('should fetch mentions and enqueue tasks', async () => {
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({
                data: [
                    { id: '12345', text: '@rebecca_ai Hello', authorId: 'user_1' }
                ],
                meta: { resultCount: 1 }
            });

            const response = await request(app).get('/batch/mentions').set('x-batch-secret', 'test_secret');
            
            expect(response.status).toBe(200);
            expect(xApi.getMentions).toHaveBeenCalled();
            expect(tasks.enqueueReplyTask).toHaveBeenCalledWith(
                { tweetId: '12345', text: '@rebecca_ai Hello', authorId: 'user_1' },
                expect.any(Number)
            );
        });

        it('should handle no mentions gracefully', async () => {
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({
                data: [],
                meta: { resultCount: 0 }
            });
            const response = await request(app).get('/batch/mentions').set('x-batch-secret', 'test_secret');
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(0);
        });

        it('should skip mention with no authorId', async () => {
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({
                data: [{ id: '123', text: 'hi' }], // no authorId
                meta: { resultCount: 1 }
            });
            const response = await request(app).get('/batch/mentions').set('x-batch-secret', 'test_secret');
            expect(response.status).toBe(200);
        });
    });

    describe('POST /worker/reply', () => {
        it('should process reply task successfully', async () => {
            const payload = {
                tweetId: '12345',
                text: '@rebecca_ai Hello',
                authorId: 'user_1'
            };

            const response = await request(app)
                .post('/worker/reply')
                .set('x-worker-secret', 'test_secret')
                .send(payload);
            
            expect(response.status).toBe(200);
            
            // Check if rate limits were checked
            expect(firestore.checkAndConsumeRateLimit).toHaveBeenCalled();
            // Check if user was fetched
            expect(firestore.getUserDoc).toHaveBeenCalledWith('user_1');
            // Check if reply was generated
            expect(gemini.generateReply).toHaveBeenCalled();
            // Check if reply was posted
            expect(xApi.replyToMention).toHaveBeenCalledWith('12345', 'Mock AI Reply');
            // Check if memory was appended
            expect(firestore.appendEpisodicBuffer).toHaveBeenCalledTimes(2); // user and model
        });

        it('should process english reply task successfully', async () => {
            const payload = {
                tweetId: '12345',
                text: '@rebecca_ai Hello',
                authorId: 'user_1'
            };
            (gemini.detectLanguage as jest.Mock).mockResolvedValueOnce('en');
            const response = await request(app)
                .post('/worker/reply')
                .set('x-worker-secret', 'test_secret')
                .send(payload);
            
            expect(response.status).toBe(200);
            
            // Check if reply was generated
            expect(gemini.generateReply).toHaveBeenCalled();
            
            const generateReplyCalls = (gemini.generateReply as jest.Mock).mock.calls;
            const lastCall = generateReplyCalls[generateReplyCalls.length - 1];
            expect(lastCall[0]).toContain('developed by Gemitech'); // BASE_SYSTEM_PROMPT_EN starts or contains this

            // Check if reply was posted
            expect(xApi.replyToMention).toHaveBeenCalledWith('12345', 'Mock AI Reply');
        });

        it('should skip if mention already processed', async () => {
            (firestore.hasProcessedMention as jest.Mock).mockResolvedValueOnce(true);
            const payload = { tweetId: 'dup', text: 'hello', authorId: 'user_1' };
            const response = await request(app).post('/worker/reply').set('x-worker-secret', 'test_secret').send(payload);
            expect(response.status).toBe(200);
            expect(gemini.generateReply).not.toHaveBeenCalled();
        });

        it('should process reply task with image attachment', async () => {
            (xApi.getTweetDetails as jest.Mock).mockResolvedValueOnce({
                data: { text: 'hello image', attachments: { mediaKeys: ['media_1'] } },
                includes: { media: [{ media_key: 'media_1', type: 'photo', url: 'https://example.com/image.jpg' }] }
            });
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
                headers: { get: jest.fn().mockReturnValue('image/jpeg') }
            }) as any;

            const payload = { tweetId: 'with_image', text: 'hello image', authorId: 'user_1' };
            const response = await request(app).post('/worker/reply').set('x-worker-secret', 'test_secret').send(payload);
            
            global.fetch = originalFetch; // Restore fetch
            expect(response.status).toBe(200);
            expect(gemini.generateReply).toHaveBeenCalled();
        });

        it('should handle errors when analyzing user profile gracefully', async () => {
            (firestore.getUserDoc as jest.Mock).mockResolvedValueOnce(null);
            (xApi.getUserProfile as jest.Mock).mockResolvedValueOnce({ data: { description: 'bio' } });
            (gemini.analyzeUserProfile as jest.Mock).mockRejectedValueOnce(new Error('Analysis failed'));

            const payload = { tweetId: 'err_profile', text: 'hello', authorId: 'user_1' };
            const response = await request(app).post('/worker/reply').set('x-worker-secret', 'test_secret').send(payload);
            
            expect(response.status).toBe(200);
            expect(gemini.generateReply).toHaveBeenCalled(); // Should continue processing
        });

        it('should block unauthorized access to worker', async () => {
            const response = await request(app).post('/worker/reply').send({});
            expect(response.status).toBe(401);
        });

        it('should initialize new user profile on first interaction', async () => {
            (firestore.getUserDoc as jest.Mock).mockResolvedValueOnce(null);
            (xApi.getUserProfile as jest.Mock).mockResolvedValueOnce({ data: { description: 'bio' } });
            (gemini.analyzeUserProfile as jest.Mock).mockResolvedValueOnce({ attributes: ['test'] });

            const payload = { tweetId: 'new', text: 'hello', authorId: 'new_user' };
            const response = await request(app)
                .post('/worker/reply')
                .set('x-worker-secret', 'test_secret')
                .send(payload);
            
            expect(response.status).toBe(200);
            expect(firestore.getUserDoc).toHaveBeenCalledWith('new_user');
            expect(gemini.analyzeUserProfile).toHaveBeenCalledWith('bio');
        });

        it('should block if rate limit is exceeded', async () => {
            (firestore.checkAndConsumeRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: false, reason: 'global_daily' }); // Blocked

            const payload = {
                tweetId: '12345',
                text: '@rebecca_ai Hello',
                authorId: 'user_1'
            };

            const response = await request(app)
                .post('/worker/reply')
                .set('x-worker-secret', 'test_secret')
                .send(payload);
            
            expect(response.status).toBe(200); // Worker still acks
            expect(xApi.replyToMention).not.toHaveBeenCalled(); // Should not reply
        });
    });

    describe('GET /batch/dreaming', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });
        it('should process dreaming successfully', async () => {
            (firestore.getAllUsers as jest.Mock).mockResolvedValueOnce([{ id: 'user1' }]);
            (firestore.getUserDoc as jest.Mock).mockResolvedValueOnce({ episodicBuffer: ['test'], coreProfile: {} });
            (gemini.generateDreaming as jest.Mock).mockResolvedValueOnce({ preferences: ['test'] });
            (gemini.generateTimelineSummary as jest.Mock).mockResolvedValueOnce('Mock Summary');
            
            const response = await request(app).get('/batch/dreaming').set('x-batch-secret', 'test_secret');
            
            expect(response.status).toBe(200);
            expect(firestore.getAllUsers).toHaveBeenCalled();
            expect(gemini.generateDreaming).toHaveBeenCalled();
            expect(firestore.updateUserDoc).toHaveBeenCalled();
            expect(gemini.generateTimelineSummary).toHaveBeenCalled();
        });
    });

    describe('GET /batch/evolution', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });
        it('should process evolution successfully when audit passes', async () => {
            (firestore.getRecentConversationLogs as jest.Mock).mockResolvedValueOnce([{ userText: 'hello', aiText: 'hi' }]);
            (gemini.generateEvolutionPrompt as jest.Mock).mockResolvedValueOnce('New Prompt');
            (gemini.auditEvolutionPrompt as jest.Mock).mockResolvedValueOnce({ pass: true });
            
            const response = await request(app).get('/batch/evolution').set('x-batch-secret', 'test_secret');
            
            expect(response.status).toBe(200);
            expect(firestore.getRecentConversationLogs).toHaveBeenCalled();
            expect(gemini.generateEvolutionPrompt).toHaveBeenCalled();
            expect(gemini.auditEvolutionPrompt).toHaveBeenCalled();
            expect(firestore.saveExtendedPrompt).toHaveBeenCalledWith('New Prompt');
        });
    });

    describe('GET /batch/news-post', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });
        it('should process news-post successfully', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({
                text: jest.fn().mockResolvedValue('<rss><channel><item><title>Test News</title><link>http://example.com</link><description>Test</description></item></channel></rss>')
            }) as any;
            (gemini.generateNewsPost as jest.Mock).mockResolvedValueOnce('Mock News Post');
            (xApi.tweet as jest.Mock).mockResolvedValueOnce({ data: { id: 'mock_tweet_id' } });
            
            const response = await request(app).get('/batch/news-post').set('x-batch-secret', 'test_secret');
            
            global.fetch = originalFetch;
            expect(response.status).toBe(200);
            expect(gemini.generateNewsPost).toHaveBeenCalled();
            expect(xApi.tweet).toHaveBeenCalledWith(expect.stringContaining('Mock News Post'), expect.any(Object));
        }, 15000);
    });

    describe('GET /batch/stealth-onboarding', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });
        it('should process stealth onboarding successfully', async () => {
            (xApi.getFollowers as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'follower_1', username: 'test', description: 'bio' }] });
            (firestore.hasProcessedFollower as jest.Mock).mockResolvedValueOnce(false);
            (gemini.analyzeUserProfile as jest.Mock).mockResolvedValueOnce({ attributes: ['tech'] });
            
            const response = await request(app).get('/batch/stealth-onboarding').set('x-batch-secret', 'test_secret');
            
            expect(response.status).toBe(200);
            expect(xApi.getFollowers).toHaveBeenCalled();
            expect(gemini.analyzeUserProfile).toHaveBeenCalled();
            expect(xApi.addListMember).toHaveBeenCalledWith(expect.any(String), 'follower_1');
            expect(firestore.markFollowerProcessed).toHaveBeenCalledWith('follower_1');
        });
    });

    describe('GET /batch/random-engagement', () => {
        beforeEach(() => {
            require('../../src/config').default.batchSecret = 'test_secret';
        });
        it('should process random engagement successfully', async () => {
            (xApi.getListMembers as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'target_1', username: 'target_user' }] });
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({ data: [], meta: { resultCount: 0 } }); // mock get user tweets (reusing getMentions mock shape for simplicity here)
            (gemini.generateReply as jest.Mock).mockResolvedValueOnce('Mock Engagement Reply');
            
            const response = await request(app).get('/batch/random-engagement').set('x-batch-secret', 'test_secret');
            
            expect(response.status).toBe(200);
            expect(xApi.getListMembers).toHaveBeenCalled();
            // xApi.tweet is used for engagement (replying to target)
            expect(xApi.tweet).toHaveBeenCalled();
        });
    });
});
