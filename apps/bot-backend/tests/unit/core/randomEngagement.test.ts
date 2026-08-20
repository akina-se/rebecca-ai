import { RandomEngagementUseCase } from '../../../src/features/engagement/usecase';
import { checkAndIncrementRateLimits } from '../../../src/core/rateLimiter';
import { downloadImage } from '../../../src/utils/image';
import { createMockDeps } from './testUtils';

jest.mock('../../../src/core/rateLimiter');
jest.mock('../../../src/utils/image');

describe('Random Engagement Batch', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
        
        // Setup default config values
        require('../../../src/config').default.xApi.targetListId = 'test-list-id';
    });

    it('should engage with a random eligible user', async () => {
        deps.xApi.getListMembers.mockResolvedValue({
            data: [
                { id: 'user1', username: 'already_engaged' },
                { id: 'user2', username: 'target_user' }
            ]
        });

        // user1 is engaged, user2 is not
        deps.firestore.getLastListInteraction.mockImplementation(async (id: string) => {
            return id === 'user1' ? new Date() : null;
        });

        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });

        deps.xApi.getUserProfile.mockResolvedValue({
            data: { description: 'I love games.' }
        });

        deps.xApi.getUserTweets.mockResolvedValue({
            data: [{ id: 'tweet123', text: 'Playing games!' }]
        });

        deps.gemini.analyzeUserProfile.mockResolvedValue({ attributes: [], preferences: ['games'] });
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateReply.mockResolvedValue('Hey @target_user, playing games again?');

        const result = await new RandomEngagementUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('target_user');
        
        expect(deps.xApi.tweet).toHaveBeenCalledWith('Hey @target_user, playing games again?');
        expect(deps.firestore.updateLastListInteraction).toHaveBeenCalledWith('user2');
    });

    it('should skip blocked user during random engagement selection', async () => {
        deps.xApi.getListMembers.mockResolvedValue({
            data: [
                { id: 'blocked_u1', username: 'blocked_u1' },
                { id: 'active_u2', username: 'active_u2' }
            ]
        });

        deps.firestore.getUserDoc.mockImplementation(async (id: string) => {
            if (id === 'blocked_u1') return { status: 'BLOCKED' };
            return { status: 'ACTIVE' };
        });

        deps.firestore.getLastListInteraction.mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({ data: { description: '' } });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't2', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateReply.mockResolvedValue('@active_u2 Hello!');

        const result = await new RandomEngagementUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('active_u2');
        expect(deps.xApi.tweet).toHaveBeenCalledWith('@active_u2 Hello!');
    });

    it('should skip if all users have already been engaged', async () => {
        deps.xApi.getListMembers.mockResolvedValue({
            data: [
                { id: 'user1', username: 'user1' },
                { id: 'user2', username: 'user2' }
            ]
        });

        deps.firestore.getLastListInteraction.mockResolvedValue(new Date()); // All engaged

        const result = await new RandomEngagementUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBeUndefined();
        expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });
    
    it('should return failed if targetListId is not set', async () => {
        const originalList = require('../../../src/config').default.xApi.targetListId;
        require('../../../src/config').default.xApi.targetListId = '';
        const result = await new RandomEngagementUseCase(deps).execute();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.targetListId = originalList;
    });

    it('should return success if list is empty', async () => {
        deps.xApi.getListMembers.mockResolvedValue({ data: [] });
        const result = await new RandomEngagementUseCase(deps).execute();
        expect(result.status).toBe('success');
    });

    it('should return skipped if rate limit hit', async () => {
        deps.xApi.getListMembers.mockResolvedValue({ data: [{ id: 'u1', username: 'u1' }] });
        deps.firestore.getLastListInteraction.mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: false, reason: 'limit' });
        
        const result = await new RandomEngagementUseCase(deps).execute();
        expect(result.status).toBe('skipped');
    });

    it('should prepend username if not included in generated text', async () => {
        deps.xApi.getListMembers.mockResolvedValue({ data: [{ id: 'u2', username: 'target2' }] });
        deps.firestore.getLastListInteraction.mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({ data: { description: '' } });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't2', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateReply.mockResolvedValue('Hello without mention'); // missing @target2

        await new RandomEngagementUseCase(deps).execute();

        expect(deps.xApi.tweet).toHaveBeenCalledWith('@target2\nHello without mention');
    });

    it('should handle tweets with attached media and analyze them', async () => {
        deps.xApi.getListMembers.mockResolvedValue({ data: [{ id: 'u3', username: 'media_user' }] });
        deps.firestore.getLastListInteraction.mockResolvedValue(null);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({ data: { description: '' } });
        deps.xApi.getUserTweets.mockResolvedValue({ 
            data: [{ 
                id: 't3', 
                text: 'look at this', 
                attachments: { mediaKeys: ['media1'] } 
            }],
            includes: {
                media: [{ type: 'photo', url: 'http://example.com/photo.jpg' }]
            }
        });
        (downloadImage as jest.Mock).mockResolvedValue({ buffer: Buffer.from('fakeimage'), mimeType: 'image/jpeg' });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.analyzeImageCaption.mockResolvedValue('a nice photo');
        deps.gemini.generateReply.mockResolvedValue('@media_user cool photo!'); 

        await new RandomEngagementUseCase(deps).execute();

        expect(deps.gemini.analyzeImageCaption).toHaveBeenCalled();
        expect(deps.xApi.tweet).toHaveBeenCalledWith('@media_user cool photo!');
    });
});
