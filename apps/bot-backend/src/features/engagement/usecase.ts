import { AppDependencies } from '../../types';
import config from '../../config';
import { getBasePrompt } from '@rebecca/persona';
import { checkAndIncrementRateLimits } from '../../core/rateLimiter';
import { downloadImage } from '../../utils/image';

/**
 * Encapsulates the business logic for the random engagement background job.
 * Responsible for randomly selecting a target user, analyzing their profile and recent activity,
 * and generating a contextually relevant, AI-driven interaction.
 */
export class RandomEngagementUseCase {
    /**
     * Instantiates the RandomEngagementUseCase.
     * 
     * @param deps - The application dependencies required to execute the engagement workflow.
     */
    constructor(private deps: AppDependencies) {}

    /**
     * Executes the random engagement workflow.
     * 
     * This process retrieves a list of target users, filters for those who haven't been engaged recently,
     * analyzes their profile and recent posts to build context, and generates a tailored response using AI.
     * The generated message is then posted as an @mention.
     * 
     * @returns A promise resolving to an object detailing the operation's outcome, 
     *          including the status, the username of the engaged user (if successful), 
     *          and an optional reason string (if skipped or failed).
     */
    async execute(): Promise<{ status: string; processedUser?: string; reason?: string }> {
    console.log("Starting Random Engagement Batch...");
    try {
        const targetListId = config.xApi.targetListId;
        if (!targetListId) {
            return { status: 'failed', reason: 'Missing X_TARGET_LIST_ID' };
        }

        const membersResp = await this.deps.xApi.getListMembers(targetListId);
        const members = membersResp.data || [];
        
        if (members.length === 0) {
            console.log("List is empty.");
            return { status: 'success' };
        }

        const shuffled = members.sort(() => 0.5 - Math.random());
        let targetUser = null;

        for (const user of shuffled) {
            const lastInteraction = await this.deps.firestore.getLastListInteraction(user.id);
            if (!lastInteraction) {
                targetUser = user;
                break;
            }
        }

        if (!targetUser) {
            console.log("No eligible users found for random engagement (all already engaged).");
            return { status: 'success' };
        }

        console.log(`Targeting user for random engagement: @${targetUser.username} (${targetUser.id})`);

        const rateLimitResult = await checkAndIncrementRateLimits(this.deps, targetUser.id);
        if (!rateLimitResult.allowed) {
            console.warn(`Rate limit hit for ${targetUser.id}: ${rateLimitResult.reason}`);
            return { status: 'skipped', reason: 'rate_limited' };
        }

        const profileResp = await this.deps.xApi.getUserProfile(targetUser.id);
        const description = profileResp.data.description || '';
        
        const profilePrompt = `あなたはAIキャラクターのシステムです。ユーザーのX(Twitter)のプロフィール文を分析し、ユーザーの属性や好みをJSONで出力してください。
【プロフィール文】
${description}

出力フォーマット（必ずJSONのみ）:
{
  "attributes": ["社会人", "エンジニア"など],
  "preferences": ["ゲーム", "酒"など]
}`;
        const profileAnalysis = await this.deps.gemini.analyzeUserProfile(profilePrompt);
        console.log("Profile Analysis:", profileAnalysis);

        let tweetContext = '';
        let targetTweetId: string | undefined = undefined;
        try {
            const recentTweets = await this.deps.xApi.getUserTweets(targetUser.id, 5);
            if (recentTweets.data && recentTweets.data.length > 0) {
                const latestTweet = recentTweets.data[0];
                targetTweetId = latestTweet.id;
                tweetContext += `\n【直近の投稿内容】\n${latestTweet.text}`;
                
                const mediaKeys = latestTweet.attachments?.mediaKeys;
                const mediaIncludes = recentTweets.includes?.media || [];
                
                const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
                if (hasMedia) {
                    for (const media of mediaIncludes) {
                        if (media.type !== 'photo' || !media.url) continue;

                        const { buffer, mimeType } = await downloadImage(media.url);
                        const captionPrompt = `この画像に写っている状況、被写体の表情、および感情を説明するテキスト（キャプション）を生成してください。ベクトル検索のクエリとして使用するため、具体的なキーワード（場所、服の色、表情、シチュエーション）を豊富に含めた自然な日本語にしてください。途中で途切れないように、必ず完全な文章（句点で終わる）で出力してください。`;
                        const imageCaption = await this.deps.gemini.analyzeImageCaption(buffer, mimeType, captionPrompt);
                        
                        if (imageCaption) {
                            tweetContext += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
                        }
                    }
                }
            }
        } catch(e) {
            console.error('Failed to fetch recent tweets for random engagement:', e);
        }

        if (!targetTweetId) {
            console.log(`User ${targetUser.id} has no recent organic tweets to engage with. Skipping...`);
            return { status: 'skipped', reason: 'No valid tweets to engage with' };
        }

        const detectPrompt = `このテキストは何語ですか？日本語が含まれていれば'ja'、それ以外（主に英語）であれば'en'と、2文字の言語コードのみを出力してください。
テキスト: "${description + tweetContext}"`;
        const lang = await this.deps.gemini.detectLanguage(detectPrompt);

        const systemPrompt = getBasePrompt('random_engagement', lang);
        const userInput = `【ターゲットユーザー情報】\nユーザー名: @${targetUser.username}\nプロフィール: ${description}\n分析属性: ${JSON.stringify(profileAnalysis)}\n${tweetContext}\n\n上記を踏まえて、ターゲットユーザーの最近の活動や投稿内容に言及しつつ、不意打ちで話しかける独立したメンション投稿を作成してください。`;

        const generatedText = await this.deps.gemini.generateReply(systemPrompt, [], userInput);

        let finalText = generatedText;
        if (!finalText.includes(`@${targetUser.username}`)) {
            finalText = `@${targetUser.username}\n${finalText}`;
        }

        console.log(`Generated Engagement Text:\n${finalText}`);

        await this.deps.xApi.tweet(finalText);

        await this.deps.firestore.updateLastListInteraction(targetUser.id);

        return { status: 'success', processedUser: targetUser.username };
    } catch (e) {
        console.error("Error in runRandomEngagementBatch:", e);
        throw e;
    }
};

}
