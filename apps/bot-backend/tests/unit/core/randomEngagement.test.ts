import { RandomEngagementUseCase } from '../../../src/features/engagement/usecase';
import { checkAndIncrementRateLimits } from '../../../src/core/rateLimiter';
import { downloadImage } from '../../../src/utils/image';
import { createMockDeps } from './testUtils';

jest.mock('../../../src/core/rateLimiter');
jest.mock('../../../src/utils/image');

const testConfig = { cooldownDays: 365 };

describe('Random Engagement Batch', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
    });

    it('should engage with a random eligible user', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([
            { id: 'user1' },
            { id: 'user2' }
        ]);

        // user1 is already engaged recently, user2 is untouched
        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([['user1', new Date()]]),
        );

        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });

        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'user2', username: 'target_user', name: 'Target', description: 'I love games.' }
        });

        deps.xApi.getUserTweets.mockResolvedValue({
            data: [{ id: 'tweet123', text: 'Playing games!' }]
        });

        deps.gemini.analyzeUserProfile.mockResolvedValue({ attributes: [], preferences: ['games'] });
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'ゲームの話題に共感しつつ突っ込む',
            reply: 'Hey @target_user, playing games again?'
        });

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('target_user');
        expect(deps.xApi.tweet).toHaveBeenCalledWith('Hey @target_user, playing games again?', { mediaIds: [] });
        expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'Hey @target_user, playing games again?',
                thought: 'ゲームの話題に共感しつつ突っ込む',
                postType: 'random_engagement',
            })
        );
        expect(deps.firestore.updateLastListInteraction).toHaveBeenCalledWith('user2');
    });

    it('should skip blocked user during random engagement selection', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([
            { id: 'blocked_u1' },
            { id: 'active_u2' }
        ]);

        deps.firestore.getUserDoc.mockImplementation(async (id: string) => {
            if (id === 'blocked_u1') return { status: 'BLOCKED' };
            return { status: 'ACTIVE' };
        });

        deps.firestore.getAllListInteractions.mockResolvedValue(new Map());
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'active_u2', username: 'active_u2', name: 'Active', description: '' }
        });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't2', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'アクティブユーザーに挨拶する',
            reply: '@active_u2 Hello!'
        });

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('active_u2');
        expect(deps.xApi.tweet).toHaveBeenCalledWith('@active_u2 Hello!', { mediaIds: [] });
    });

    it('should skip if all users are still within the cooldown window', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([
            { id: 'user1' },
            { id: 'user2' }
        ]);

        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([
                ['user1', new Date()],
                ['user2', new Date(Date.now() - 364 * 24 * 60 * 60 * 1000)],
            ]),
        );

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBeUndefined();
        expect(deps.xApi.tweet).not.toHaveBeenCalled();
    });

    it('should return success immediately if list cache is empty', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([]);
        const result = await new RandomEngagementUseCase(deps, testConfig).execute();
        expect(result.status).toBe('success');
        expect(result.processedUser).toBeUndefined();
    });

    it('should return skipped if rate limit hit', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([{ id: 'u1' }]);
        deps.firestore.getAllListInteractions.mockResolvedValue(new Map());
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: false, reason: 'limit' });

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();
        expect(result.status).toBe('skipped');
    });

    it('should prioritize untouched followers before falling back to cooldown-eligible followers', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([
            { id: 'cooldown_ready' },
            { id: 'untouched_user' },
        ]);
        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([['cooldown_ready', new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)]]),
        );
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'untouched_user', username: 'fresh_user', name: 'Fresh', description: '' },
        });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't_fresh', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '初接触のフォロワーに挨拶する',
            reply: '@fresh_user nice to meet you!',
        });

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('fresh_user');
        expect(deps.firestore.updateLastListInteraction).toHaveBeenCalledWith('untouched_user');
    });

    it('should fall back to cooldown-eligible followers when only untouched users are blocked', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([
            { id: 'blocked_untouched' },
            { id: 'cooldown_ready' },
        ]);
        deps.firestore.getUserDoc.mockImplementation(async (id: string) =>
            id === 'blocked_untouched' ? { status: 'BLOCKED' } : { status: 'ACTIVE' },
        );
        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([['cooldown_ready', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 - 1000)]]),
        );
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'cooldown_ready', username: 'returning_user', name: 'Returning', description: '' },
        });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't_ret', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '1年ぶりの再交流',
            reply: '@returning_user long time no see!',
        });

        const result = await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('returning_user');
        expect(deps.firestore.updateLastListInteraction).toHaveBeenCalledWith('cooldown_ready');
    });

    it('should respect custom cooldownDays boundary', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([{ id: 'u_custom' }]);
        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([['u_custom', new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)]]),
        );

        const skipped = await new RandomEngagementUseCase(deps, { cooldownDays: 90 }).execute();
        expect(skipped.processedUser).toBeUndefined();

        deps.firestore.getAllListInteractions.mockResolvedValue(
            new Map([['u_custom', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000 - 1000)]]),
        );
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'u_custom', username: 'custom_user', name: 'Custom', description: '' },
        });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't_c', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'カスタムクールダウン後の返信',
            reply: '@custom_user hey!',
        });

        const engaged = await new RandomEngagementUseCase(deps, { cooldownDays: 90 }).execute();
        expect(engaged.processedUser).toBe('custom_user');
    });

    it('should prepend username if not included in generated text', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([{ id: 'u2' }]);
        deps.firestore.getAllListInteractions.mockResolvedValue(new Map());
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'u2', username: 'target2', name: 'Target2', description: '' }
        });
        deps.xApi.getUserTweets.mockResolvedValue({ data: [{ id: 't2', text: 'hi' }] });
        deps.gemini.analyzeUserProfile.mockResolvedValue({});
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'メンションなしで挨拶',
            reply: 'Hello without mention'
        }); // missing @target2

        await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(deps.xApi.tweet).toHaveBeenCalledWith('@target2\nHello without mention', { mediaIds: [] });
    });

    it('should handle tweets with attached media and analyze them', async () => {
        deps.firestore.getListMembersFromCache.mockResolvedValue([{ id: 'u3' }]);
        deps.firestore.getAllListInteractions.mockResolvedValue(new Map());
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { id: 'u3', username: 'media_user', name: 'Media User', description: '' }
        });
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
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '写真にコメントする',
            reply: '@media_user cool photo!'
        });

        await new RandomEngagementUseCase(deps, testConfig).execute();

        expect(deps.gemini.analyzeImageCaption).toHaveBeenCalled();
        expect(deps.xApi.tweet).toHaveBeenCalledWith('@media_user cool photo!', { mediaIds: [] });
    });
});
