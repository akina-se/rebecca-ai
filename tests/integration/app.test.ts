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
}));

jest.mock('../../src/services/gemini', () => ({
    generateReply: jest.fn().mockResolvedValue('Mock AI Reply'),
    generateSearchQuery: jest.fn().mockResolvedValue('Mock Query'),
    generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    detectLanguage: jest.fn().mockResolvedValue('ja'),
}));

jest.mock('../../src/services/xApi', () => ({
    replyToMention: jest.fn().mockResolvedValue({ data: { id: 'mock_reply_id' } }),
}));

jest.mock('../../src/services/tasks', () => ({
    enqueueReplyTask: jest.fn().mockResolvedValue({ name: 'mock_task' }),
}));

describe('Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /webhook/x', () => {
        it('should receive webhook and enqueue task', async () => {
            const payload = {
                tweet_id: '12345',
                text: '@rebecca_ai Hello',
                author_id: 'user_1'
            };

            const response = await request(app)
                .post('/webhook/x')
                .send(payload);
            
            expect(response.status).toBe(200);
            expect(tasks.enqueueReplyTask).toHaveBeenCalled();
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
});
