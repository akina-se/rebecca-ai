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
    getGlobalRateLimit: jest.fn().mockResolvedValue(0),
    getUserDailyLimit: jest.fn().mockResolvedValue(0),
    getUserMinuteLimit: jest.fn().mockResolvedValue(0),
    getDailyActiveUsersCount: jest.fn().mockResolvedValue(1),
    incrementGlobalRateLimit: jest.fn().mockResolvedValue(undefined),
    incrementUserDailyLimit: jest.fn().mockResolvedValue(undefined),
    incrementUserMinuteLimit: jest.fn().mockResolvedValue(undefined),
    getExtendedPrompt: jest.fn().mockResolvedValue(''),
    getTimelineSummary: jest.fn().mockResolvedValue(''),
    saveRawConversationLog: jest.fn().mockResolvedValue(undefined),
    findRagMemories: jest.fn().mockResolvedValue([]),
    saveRagMemory: jest.fn().mockResolvedValue(undefined),
    getLastMentionId: jest.fn().mockResolvedValue(undefined),
    setLastMentionId: jest.fn().mockResolvedValue(undefined),
    saveTimelinePost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/gemini', () => ({
    generateReply: jest.fn().mockResolvedValue('Mock AI Reply'),
    generateSearchQuery: jest.fn().mockResolvedValue('Mock Query'),
    generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    detectLanguage: jest.fn().mockResolvedValue('ja'),
    generateNewsPost: jest.fn().mockResolvedValue('Mock News Post'),
    analyzeUserProfile: jest.fn().mockResolvedValue({ attributes: ['test'] }),
}));

jest.mock('../../src/services/xApi', () => ({
    replyToMention: jest.fn().mockResolvedValue({ data: { id: 'mock_reply_id' } }),
    getMentions: jest.fn().mockResolvedValue({ data: [], meta: { resultCount: 0 } }),
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
        it('should fetch mentions and enqueue tasks', async () => {
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({
                data: [
                    { id: '12345', text: '@rebecca_ai Hello', author_id: 'user_1' }
                ],
                meta: { resultCount: 1 }
            });

            const response = await request(app).get('/batch/mentions');
            
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
            const response = await request(app).get('/batch/mentions');
            expect(response.status).toBe(200);
            expect(response.body.result.count).toBe(0);
        });

        it('should skip mention with no authorId', async () => {
            (xApi.getMentions as jest.Mock).mockResolvedValueOnce({
                data: [{ id: '123', text: 'hi' }], // no authorId
                meta: { resultCount: 1 }
            });
            const response = await request(app).get('/batch/mentions');
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
                .send(payload);
            
            expect(response.status).toBe(200);
            
            // Check if rate limits were checked
            expect(firestore.getGlobalRateLimit).toHaveBeenCalled();
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

        it('should initialize new user profile on first interaction', async () => {
            (firestore.getUserDoc as jest.Mock).mockResolvedValueOnce(null);
            (xApi.getUserProfile as jest.Mock).mockResolvedValueOnce({ data: { description: 'bio' } });
            (gemini.analyzeUserProfile as jest.Mock).mockResolvedValueOnce({ attributes: ['test'] });

            const payload = { tweetId: 'new', text: 'hello', authorId: 'new_user' };
            const response = await request(app).post('/worker/reply').send(payload);
            
            expect(response.status).toBe(200);
            expect(firestore.getUserDoc).toHaveBeenCalledWith('new_user');
            expect(gemini.analyzeUserProfile).toHaveBeenCalledWith('bio');
        });

        it('should block if rate limit is exceeded', async () => {
            // Mock rate limit exceeded
            (firestore.getGlobalRateLimit as jest.Mock).mockResolvedValueOnce(1000); // Exceed default 140

            const payload = {
                tweetId: '12345',
                text: '@rebecca_ai Hello',
                authorId: 'user_1'
            };

            const response = await request(app)
                .post('/worker/reply')
                .send(payload);
            
            expect(response.status).toBe(200); // Worker still acks
            expect(xApi.replyToMention).not.toHaveBeenCalled(); // Should not reply
        });
    });

    describe('GET /batch/dreaming', () => {
        it('should return 200', async () => {
            const memory = require('../../src/core/memory');
            memory.runGlobalDreamingBatch = jest.fn().mockResolvedValue(undefined);
            const response = await request(app).get('/batch/dreaming');
            expect(response.status).toBe(200);
        });
    });

    describe('GET /batch/evolution', () => {
        it('should return 200', async () => {
            const evolution = require('../../src/core/evolution');
            evolution.runGlobalEvolutionBatch = jest.fn().mockResolvedValue(undefined);
            const response = await request(app).get('/batch/evolution');
            expect(response.status).toBe(200);
        });
    });

    describe('GET /batch/news-post', () => {
        it('should return 200', async () => {
            const response = await request(app).get('/batch/news-post');
            expect(response.status).toBe(200);
        });
    });
});
