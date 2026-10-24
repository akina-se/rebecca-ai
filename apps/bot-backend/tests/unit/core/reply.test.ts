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
        deps.firestore.getExtendedPrompt.mockResolvedValue('Extended tuning');
        deps.firestore.getTimelineSummary.mockResolvedValue('Summary');
        deps.gemini.generateSearchQuery.mockResolvedValue('query');
        deps.gemini.generateEmbedding.mockResolvedValue(new Array(768).fill(0.1));
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

    it('should process attached mediaUrls, download image, caption it, and never call getTweetDetails', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.analyzeImageCaption.mockResolvedValue('渋谷のカフェで微笑む女の子のイラスト');
        deps.gemini.generateStructuredReply.mockResolvedValue({ thought: 'イラスト認識', reply: '可愛いイラスト！' });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'tweet_img_1',
            text: 'これ見て！',
            authorId: 'user_img_1',
            mediaUrls: ['https://pbs.twimg.com/media/pic1.jpg']
        });

        expect(result.status).toBe('success');
        expect(downloadImage).toHaveBeenCalledWith('https://pbs.twimg.com/media/pic1.jpg');
        expect(deps.gemini.analyzeImageCaption).toHaveBeenCalled();
        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.stringContaining('渋谷のカフェで微笑む女の子のイラスト')
        );
        expect(deps.xApi.getTweetDetails).not.toHaveBeenCalled();
        expect(deps.xApi.replyToMention).toHaveBeenCalledWith('tweet_img_1', '可愛いイラスト！');
    });

    it('should truncate reply if it exceeds 138 characters', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            episodicBuffer: [],
            coreProfile: {}
        });
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

    it('should inject interlocutor identity into systemPrompt when replying', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '内省',
            reply: 'こちらこそよろしくね♡'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        await usecase.execute({
            tweetId: 'tweet_identity_1',
            text: '@rebecca_ai_gal ありがとうございます😊',
            authorId: 'user_identity_1'
        });

        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('XユーザーID: @test_master_01'),
            expect.any(Array),
            '@rebecca_ai_gal ありがとうございます😊'
        );
        expect(deps.firestore.saveRawConversationLog).toHaveBeenCalledWith(
            'user_identity_1',
            '@rebecca_ai_gal ありがとうございます😊',
            'こちらこそよろしくね♡',
            '内省'
        );
    });

    it('should resolve parent timeline post from Firestore and inject into processedText, searchContext, and systemPrompt', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getTimelinePostByTweetId.mockResolvedValue({
            tweetId: 'parent_tweet_100',
            text: '最近急に寒くなってきたね〜。みんな風邪ひいてない？',
            postType: 'soliloquy'
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue('防寒 対策');
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '相手はまだ半袖らしい！元気だなあ',
            reply: '半袖！？すごーい！風邪ひかないように気をつけてね！'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'mention_tweet_200',
            text: '@rebecca_ai_gal こっちはまだ半袖で過ごせるくらい暑いよ！',
            authorId: 'user_100',
            inReplyToTweetId: 'parent_tweet_100'
        });

        expect(result.status).toBe('success');
        expect(deps.firestore.getTimelinePostByTweetId).toHaveBeenCalledWith('parent_tweet_100');

        const expectedProcessedText = `【返信元の${deps.persona.metadata.displayName}の投稿】\n最近急に寒くなってきたね〜。みんな風邪ひいてない？\n\n【対話相手（ユーザー）の発言】\n@rebecca_ai_gal こっちはまだ半袖で過ごせるくらい暑いよ！`;

        // 1. Search query generator receives parent post context in Turn 1
        expect(deps.gemini.generateSearchQuery).toHaveBeenCalledWith(
            expect.stringContaining(`${deps.persona.metadata.displayName}: 最近急に寒くなってきたね〜。みんな風邪ひいてない？`)
        );

        // 2. generateStructuredReply receives contextualized prompt and processedText
        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('【文脈：ユーザーが返信している'),
            expect.any(Array),
            expectedProcessedText
        );

        // 3. Conversation log and episodic buffer receive the contextualized text
        expect(deps.firestore.saveRawConversationLog).toHaveBeenCalledWith(
            'user_100',
            expectedProcessedText,
            '半袖！？すごーい！風邪ひかないように気をつけてね！',
            '相手はまだ半袖らしい！元気だなあ'
        );
    });

    it('should gracefully fallback to standard text when inReplyToTweetId is not found in Firestore', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getTimelinePostByTweetId.mockResolvedValue(null);
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '内省',
            reply: 'お返事です'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'mention_tweet_300',
            text: '@rebecca_ai_gal こんばんは',
            authorId: 'user_200',
            inReplyToTweetId: 'unknown_parent_tweet'
        });

        expect(result.status).toBe('success');
        expect(deps.firestore.getTimelinePostByTweetId).toHaveBeenCalledWith('unknown_parent_tweet');
        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.not.stringContaining('【文脈：ユーザーが返信している'),
            expect.any(Array),
            '@rebecca_ai_gal こんばんは'
        );
    });

    it('should inject parent post image caption directly when mediaCaption is already cached on timeline doc (Tier 1)', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getTimelinePostByTweetId.mockResolvedValue({
            id: 'doc_101',
            tweetId: 'parent_tweet_101',
            text: '今日のおやつはパンケーキ♡',
            mediaCaption: 'カフェのテーブルに置かれたベリーのパンケーキとアイスティー',
            postType: 'soliloquy'
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue('パンケーキ');
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '美味しそうなパンケーキへの言及',
            reply: 'すごくふわふわで美味しかったよ〜！'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'mention_tweet_201',
            text: '@rebecca_ai_gal 写真のパンケーキめっちゃ美味しそう！',
            authorId: 'user_101',
            inReplyToTweetId: 'parent_tweet_101'
        });

        expect(result.status).toBe('success');
        expect(deps.firestore.getImageByHash).not.toHaveBeenCalled();
        expect(downloadImage).not.toHaveBeenCalled();
        expect(deps.gemini.analyzeImageCaption).not.toHaveBeenCalled();
        expect(deps.firestore.updateTimelinePost).not.toHaveBeenCalled();

        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('カフェのテーブルに置かれたベリーのパンケーキとアイスティー'),
            expect.any(Array),
            expect.stringContaining('【返信元の投稿の添付画像】\nカフェのテーブルに置かれたベリーのパンケーキとアイスティー')
        );
    });

    it('should lookup caption from image asset and backfill to timeline_history when parent post has assetId (Tier 2)', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getTimelinePostByTweetId.mockResolvedValue({
            id: 'doc_102',
            tweetId: 'parent_tweet_102',
            text: '新しいネイルにしたよ💅',
            assetId: 'asset_hash_nail_01',
            postType: 'soliloquy'
        });
        deps.firestore.getImageByHash.mockResolvedValue({
            id: 'asset_hash_nail_01',
            caption: '華やかなピンクとシルバーのグラデーションネイルのアップ',
            url: 'https://storage.googleapis.com/test-bucket/nail.jpg'
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue('ネイル');
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'ネイルを褒めてくれた',
            reply: 'ありがと♡お気に入りなの！'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'mention_tweet_202',
            text: '@rebecca_ai_gal そのネイルの色すごく綺麗！',
            authorId: 'user_102',
            inReplyToTweetId: 'parent_tweet_102'
        });

        expect(result.status).toBe('success');
        expect(deps.firestore.getImageByHash).toHaveBeenCalledWith('asset_hash_nail_01');
        expect(downloadImage).not.toHaveBeenCalled();
        expect(deps.firestore.updateTimelinePost).toHaveBeenCalledWith('doc_102', {
            mediaCaption: '華やかなピンクとシルバーのグラデーションネイルのアップ'
        });
        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('華やかなピンクとシルバーのグラデーションネイルのアップ'),
            expect.any(Array),
            expect.stringContaining('【返信元の投稿の添付画像】\n華やかなピンクとシルバーのグラデーションネイルのアップ')
        );
    });

    it('should lazily download, analyze image caption with objective prompt, and backfill to timeline_history when parent post has mediaUrls without caption (Tier 3)', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'テストマスター',
            username: 'test_master_01',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getTimelinePostByTweetId.mockResolvedValue({
            id: 'doc_103',
            tweetId: 'parent_tweet_103',
            text: '夕焼けが綺麗だったから撮ってみた！',
            mediaUrls: ['https://pbs.twimg.com/media/sunset.jpg'],
            postType: 'soliloquy'
        });
        (downloadImage as jest.Mock).mockResolvedValue({
            buffer: Buffer.from('sunset_image_bytes'),
            mimeType: 'image/jpeg'
        });
        deps.gemini.analyzeImageCaption.mockResolvedValue('海辺に沈む鮮やかなオレンジ色の夕日と夕焼け空。');
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue('夕焼け');
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: '夕焼けの写真に感動してくれた',
            reply: '綺麗だったよね〜！思わず見惚れちゃった。'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        const result = await usecase.execute({
            tweetId: 'mention_tweet_203',
            text: '@rebecca_ai_gal この夕日めっちゃエモいね',
            authorId: 'user_103',
            inReplyToTweetId: 'parent_tweet_103'
        });

        expect(result.status).toBe('success');
        expect(downloadImage).toHaveBeenCalledWith('https://pbs.twimg.com/media/sunset.jpg');
        expect(deps.gemini.analyzeImageCaption).toHaveBeenCalledWith(
            expect.any(Buffer),
            'image/jpeg',
            expect.stringContaining('客観的かつ詳細に言語化してください')
        );
        expect(deps.firestore.updateTimelinePost).toHaveBeenCalledWith('doc_103', {
            mediaCaption: '海辺に沈む鮮やかなオレンジ色の夕日と夕焼け空。'
        });
        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('海辺に沈む鮮やかなオレンジ色の夕日と夕焼け空。'),
            expect.any(Array),
            expect.stringContaining('【返信元の投稿の添付画像】\n海辺に沈む鮮やかなオレンジ色の夕日と夕焼け空。')
        );
    });

    it('should append follow-back and DM deflection guidelines in reply system prompt for ja and en', async () => {
        deps.firestore.hasProcessedMention.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({
            status: 'ACTIVE',
            name: 'フォロワー',
            username: 'follower_user',
            episodicBuffer: [],
            coreProfile: {}
        });
        deps.firestore.getExtendedPrompt.mockResolvedValue('');
        deps.firestore.getTimelineSummary.mockResolvedValue('');
        deps.gemini.generateSearchQuery.mockResolvedValue(null);
        deps.gemini.detectLanguage.mockResolvedValue('ja');
        deps.gemini.generateStructuredReply.mockResolvedValue({
            thought: 'フォロバを頼まれたが気まぐれとしていなす',
            reply: 'ふふ、フォローは私の気まぐれよ♡もっと私を楽しませてくれたら考えちゃうかもね？'
        });
        deps.gemini.generateEmbedding.mockResolvedValue([0.1]);

        // 1. Japanese request
        await usecase.execute({
            tweetId: 'mention_tweet_follow',
            text: '@rebecca_ai_gal フォローバックして！あとDMもしよ！',
            authorId: 'user_follow_01'
        });

        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('【SNS機能制約：フォローバックおよびダイレクトメッセージ（DM）への対応指針】'),
            expect.any(Array),
            expect.any(String)
        );

        // 2. English request
        deps.gemini.detectLanguage.mockResolvedValue('en');
        await usecase.execute({
            tweetId: 'mention_tweet_follow_en',
            text: '@rebecca_ai_gal Please follow me back and DM me!',
            authorId: 'user_follow_02'
        });

        expect(deps.gemini.generateStructuredReply).toHaveBeenCalledWith(
            expect.stringContaining('[SNS Platform Constraints: Follow-backs and Direct Messages (DMs)]'),
            expect.any(Array),
            expect.any(String)
        );
    });
});
