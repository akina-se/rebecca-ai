import * as xApi from '../../../src/services/xApi';
import * as firestore from '../../../src/services/firestore';
import * as gemini from '../../../src/services/gemini';
import { runRandomEngagementBatch } from '../../../src/core/randomEngagement';
import { checkAndIncrementRateLimits } from '../../../src/core/rateLimiter';
import * as imageUtils from '../../../src/utils/image';

jest.mock('../../../src/services/xApi');
jest.mock('../../../src/services/firestore');
jest.mock('../../../src/services/gemini');
jest.mock('../../../src/core/rateLimiter');
jest.mock('../../../src/utils/image');
jest.mock('../../../src/config', () => ({
  __esModule: true,
  default: {
    gcp: { projectId: 'test' },
    xApi: { targetListId: 'list_abc' },
    limits: {},
    images: { bucketName: 'test-bucket' },
    gemini: { apiKey: 'test-key' }
  }
}));

/**
 * Unit tests for the Random Engagement Batch.
 * 
 * Verifies that the system can randomly select an eligible user from the "Special Treatment" list,
 * fetch their recent tweets and profile, analyze any attached images, and generate a 
 * standalone @mention tweet (due to X API Free Tier limitations on Quote Tweets).
 */
describe('Random Engagement Batch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should engage with a random eligible user', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({
            data: [
                { id: 'user1', username: 'already_engaged' },
                { id: 'user2', username: 'target_user' }
            ]
        });

        (firestore.getLastListInteraction as jest.Mock).mockImplementation(async (id) => {
            return id === 'user1' ? new Date() : null;
        });

        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });

        (xApi.getUserProfile as jest.Mock).mockResolvedValue({
            data: { description: 'I love games.' }
        });

        (xApi.getUserTweets as jest.Mock).mockResolvedValue({
            data: [{ id: 'tweet123', text: 'Playing games!' }]
        });

        (gemini.analyzeUserProfile as jest.Mock).mockResolvedValue({ attributes: [], preferences: ['games'] });
        (gemini.detectLanguage as jest.Mock).mockResolvedValue('ja');
        (gemini.generateReply as jest.Mock).mockResolvedValue('Hey @target_user, playing games again?');

        const result = await runRandomEngagementBatch();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('target_user');
        
        expect(xApi.tweet).toHaveBeenCalledWith(
            'Hey @target_user, playing games again?'
        );
        expect(firestore.updateLastListInteraction).toHaveBeenCalledWith('user2');
    });

    it('should skip if all users have already been engaged', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({
            data: [
                { id: 'user1', username: 'user1' },
                { id: 'user2', username: 'user2' }
            ]
        });

        (firestore.getLastListInteraction as jest.Mock).mockResolvedValue(new Date()); // All engaged

        const result = await runRandomEngagementBatch();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBeUndefined();
        expect(xApi.tweet).not.toHaveBeenCalled();
    });
    
    it('should return failed if targetListId is not set', async () => {
        const originalList = require('../../../src/config').default.xApi.targetListId;
        require('../../../src/config').default.xApi.targetListId = '';
        const result = await runRandomEngagementBatch();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.targetListId = originalList;
    });

    it('should return success if list is empty', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({ data: [] });
        const result = await runRandomEngagementBatch();
        expect(result.status).toBe('success');
    });

    it('should return skipped if rate limit hit', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({ data: [{ id: 'u1', username: 'u1' }] });
        (firestore.getLastListInteraction as jest.Mock).mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: false, reason: 'limit' });
        
        const result = await runRandomEngagementBatch();
        expect(result.status).toBe('skipped');
    });

    it('should prepend username if not included in generated text', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({ data: [{ id: 'u2', username: 'target2' }] });
        (firestore.getLastListInteraction as jest.Mock).mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        (xApi.getUserProfile as jest.Mock).mockResolvedValue({ data: { description: '' } });
        (xApi.getUserTweets as jest.Mock).mockResolvedValue({ data: [{ id: 't2', text: 'hi' }] });
        (gemini.analyzeUserProfile as jest.Mock).mockResolvedValue({});
        (gemini.detectLanguage as jest.Mock).mockResolvedValue('ja');
        (gemini.generateReply as jest.Mock).mockResolvedValue('Hello without mention'); // missing @target2

        await runRandomEngagementBatch();

        expect(xApi.tweet).toHaveBeenCalledWith(
            '@target2\nHello without mention'
        );
    });

    it('should handle tweets with attached media and analyze them', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({ data: [{ id: 'u3', username: 'media_user' }] });
        (firestore.getLastListInteraction as jest.Mock).mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        (xApi.getUserProfile as jest.Mock).mockResolvedValue({ data: { description: '' } });
        (xApi.getUserTweets as jest.Mock).mockResolvedValue({ 
            data: [{ 
                id: 't3', 
                text: 'look at this', 
                attachments: { media_keys: ['media1'] } 
            }],
            includes: {
                media: [{ type: 'photo', url: 'http://example.com/photo.jpg' }]
            }
        });
        (imageUtils.downloadImage as jest.Mock).mockResolvedValue(Buffer.from('fakeimage'));
        (gemini.analyzeUserProfile as jest.Mock).mockResolvedValue({});
        (gemini.detectLanguage as jest.Mock).mockResolvedValue('ja');
        (gemini.analyzeImageCaption as jest.Mock).mockResolvedValue('a nice photo');
        (gemini.generateReply as jest.Mock).mockResolvedValue('@media_user cool photo!'); 

        await runRandomEngagementBatch();

        expect(gemini.analyzeImageCaption).toHaveBeenCalled();
        expect(xApi.tweet).toHaveBeenCalledWith(
            '@media_user cool photo!'
        );
    });
});
