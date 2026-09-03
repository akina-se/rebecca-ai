import { ReplyTaskUseCase } from '../../../src/features/reply/usecase';
import { checkAndIncrementRateLimits } from '../../../src/core/rateLimiter';
import { downloadImage } from '../../../src/utils/image';
import { createMockDeps } from './testUtils';

jest.mock('../../../src/core/rateLimiter');
jest.mock('../../../src/utils/image');

describe('ReplyTaskUseCase Unit Tests', () => {
    let deps: any;
    let usecase: ReplyTaskUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
        usecase = new ReplyTaskUseCase(deps);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });
        (downloadImage as jest.Mock).mockResolvedValue({ buffer: Buffer.from('img'), mimeType: 'image/png' });
    });

    it('should skip processing if mention is already processed (idempotency)', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(true);

        const result = await usecase.execute({
            tweetId: 'tweet_1',
            text: 'Hello Rebecca',
            authorId: 'user_1'
        });

        expect(result.status).toBe('already_processed');
        expect(deps.xApi.replyToMention).not.toHaveBeenCalled();
    });

    it('should return rate_limited if rate limit is exceeded', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({
            allowed: false,
            reason: 'user_daily_limit_exceeded'
        });

        const result = await usecase.execute({
            tweetId: 'tweet_1',
            text: 'Hello Rebecca',
            authorId: 'user_1'
        });

        expect(result.status).toBe('rate_limited');
        expect(result.reason).toBe('user_daily_limit_exceeded');
        expect(deps.xApi.replyToMention).not.toHaveBeenCalled();
    });

    it('should abort and mark mention processed if user is BLOCKED by admin', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'BLOCKED',
            episodicBuffer: [],
            coreProfile: {}
        });

        const result = await usecase.execute({
            tweetId: 'tweet_1',
            text: 'Hello Rebecca',
            authorId: 'blocked_user_99'
        });

        expect(result.status).toBe('blocked');
        expect(result.reason).toBe('User is blocked by admin');
        expect(deps.firestore.markMentionProcessed).toHaveBeenCalledWith('tweet_1');
        expect(deps.gemini.generateStructuredReply).not.toHaveBeenCalled();
        expect(deps.xApi.replyToMention).not.toHaveBeenCalled();
    });

    it('should analyze user profile on first interaction and generate reply', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue(null); // First time user
        deps.xApi.getUserProfile.mockResolvedValue({
            data: { description: 'Software Engineer who loves anime' }
        });
        deps.gemini.analyzeUserProfile.mockResolvedValue({
            attributes: ['エンジニア'],
            preferences: ['アニメ']
        });
        deps.xApi.getTweetDetails.mockResolvedValue({ data: { text: '初めまして！' } });
        deps.firestore.getExtendedPrompt.mockResolvedValue('Extended tuning');
        deps.firestore.getTimelineSummary.mockResolvedValue('Summary');
        deps.gemini.generateSearchQuery.mockResolvedValue('query');
        deps.gemini.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        deps.firestore.findRagMemories.mockResolvedValue([]);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({ thought: '内省モック', reply: 'よろしくね！' });

        const result = await usecase.execute({
            tweetId: 'tweet_new_1',
            text: '初めまして！',
            authorId: 'new_user_1'
        });

        expect(result.status).toBe('success');
        expect(deps.xApi.getUserProfile).toHaveBeenCalledWith('new_user_1');
        expect(deps.gemini.analyzeUserProfile).toHaveBeenCalled();
        expect(deps.xApi.replyToMention).toHaveBeenCalledWith('tweet_new_1', 'よろしくね！');
        expect(deps.firestore.markMentionProcessed).toHaveBeenCalledWith('tweet_new_1');
        expect(deps.firestore.appendEpisodicBuffer).toHaveBeenCalled();
    });

    it('should truncate reply if it exceeds 138 characters', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.xApi.getTweetDetails.mockResolvedValue({ data: {} });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        
        // 150 characters response
        const longReply = 'あ'.repeat(150);
        deps.gemini.generateStructuredReply.mockResolvedValue({ thought: '内省', reply: longReply });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        await usecase.execute({
            tweetId: 'tweet_long',
            text: '長い返答テスト',
            authorId: 'user_1'
        });

        expect(deps.xApi.replyToMention).toHaveBeenCalledWith(
            'tweet_long',
            'あ'.repeat(137) + '…'
        );
    });

    it('should detect language using clean text without mentions and URLs', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.xApi.getTweetDetails.mockResolvedValue({ data: {} });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('en');
        deps.gemini.generateStructuredReply.mockResolvedValue({ thought: 'thinking', reply: 'Hey babe!' });

        await usecase.execute({
            tweetId: 'tweet_en',
            text: '@rebecca_ai_gal Well hello gorgeous https://t.co/abc',
            authorId: 'user_en'
        });

        expect(deps.gemini.detectLanguage).toHaveBeenCalledWith(
            expect.stringContaining('テキスト: "Well hello gorgeous"')
        );
        expect(deps.xApi.replyToMention).toHaveBeenCalledWith('tweet_en', 'Hey babe!');
    });

    it('should default to ja and skip detectLanguage when clean text is empty', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.xApi.getTweetDetails.mockResolvedValue({ data: {} });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.generateStructuredReply.mockResolvedValue({ thought: 'thinking', reply: 'どうしたの？' });

        await usecase.execute({
            tweetId: 'tweet_empty',
            text: '@rebecca_ai_gal',
            authorId: 'user_empty'
        });

        expect(deps.gemini.detectLanguage).not.toHaveBeenCalled();
        expect(deps.xApi.replyToMention).toHaveBeenCalledWith('tweet_empty', 'どうしたの？');
    });
});
