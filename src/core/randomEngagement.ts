import { AppDependencies } from '../types';
import config from '../config';
import { getBasePrompt } from './prompt';
import { checkAndIncrementRateLimits } from './rateLimiter';
import { downloadImage } from '../utils/image';

/**
 * Executes a background job to randomly engage with a user from the "Special Treatment" list.
 * 
 * Due to X API Free Tier limitations regarding Quote Tweets and Native Replies, 
 * this function instead fetches the user's recent timeline to build context,
 * analyzes their profile, and generates a standalone tweet containing an @mention
 * that naturally responds to their recent activities.
 * 
 * @returns {Promise<{ status: string; processedUser?: string; reason?: string }>} 
 *          A promise resolving to an object indicating the status of the operation, 
 *          the username of the engaged user (if any), and the reason (if skipped or failed).
 */
const runRandomEngagementBatch = async (deps: AppDependencies): Promise<{ status: string; processedUser?: string; reason?: string }> => {
    console.log("Starting Random Engagement Batch...");
    try {
        const targetListId = config.xApi.targetListId;
        if (!targetListId) {
            return { status: 'failed', reason: 'Missing X_TARGET_LIST_ID' };
        }

        const membersResp = await deps.xApi.getListMembers(targetListId);
        const members = membersResp.data || [];
        
        if (members.length === 0) {
            console.log("List is empty.");
            return { status: 'success' };
        }

        const shuffled = members.sort(() => 0.5 - Math.random());
        let targetUser = null;

        for (const user of shuffled) {
            const lastInteraction = await deps.firestore.getLastListInteraction(user.id);
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

        const rateLimitResult = await checkAndIncrementRateLimits(deps, targetUser.id);
        if (!rateLimitResult.allowed) {
            console.warn(`Rate limit hit for ${targetUser.id}: ${rateLimitResult.reason}`);
            return { status: 'skipped', reason: 'rate_limited' };
        }

        const profileResp = await deps.xApi.getUserProfile(targetUser.id);
        const description = profileResp.data.description || '';
        
        const profileAnalysis = await deps.gemini.analyzeUserProfile(description);
        console.log("Profile Analysis:", profileAnalysis);

        let tweetContext = '';
        let targetTweetId: string | undefined = undefined;
        try {
            const recentTweets = await deps.xApi.getUserTweets(targetUser.id, 5);
            if (recentTweets.data && recentTweets.data.length > 0) {
                const latestTweet = recentTweets.data[0];
                targetTweetId = latestTweet.id;
                tweetContext += `\n【直近の投稿内容】\n${latestTweet.text}`;
                
                const mediaKeys = latestTweet.attachments?.media_keys;
                const mediaIncludes = recentTweets.includes?.media || [];
                
                const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
                if (hasMedia) {
                    for (const media of mediaIncludes) {
                        if (media.type !== 'photo' || !media.url) continue;

                        const { buffer, mimeType } = await downloadImage(media.url);
                        const imageCaption = await deps.gemini.analyzeImageCaption(buffer, mimeType);
                        
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

        const lang = await deps.gemini.detectLanguage(description + tweetContext);

        const systemPrompt = getBasePrompt('random_engagement', lang);
        const userInput = `【ターゲットユーザー情報】\nユーザー名: @${targetUser.username}\nプロフィール: ${description}\n分析属性: ${JSON.stringify(profileAnalysis)}\n${tweetContext}\n\n上記を踏まえて、ターゲットユーザーの最近の活動や投稿内容に言及しつつ、不意打ちで話しかける独立したメンション投稿を作成してください。`;

        const generatedText = await deps.gemini.generateReply(systemPrompt, [], userInput);

        let finalText = generatedText;
        if (!finalText.includes(`@${targetUser.username}`)) {
            finalText = `@${targetUser.username}\n${finalText}`;
        }

        console.log(`Generated Engagement Text:\n${finalText}`);

        await deps.xApi.tweet(finalText);

        await deps.firestore.updateLastListInteraction(targetUser.id);

        return { status: 'success', processedUser: targetUser.username };
    } catch (e) {
        console.error("Error in runRandomEngagementBatch:", e);
        throw e;
    }
};

export {
    runRandomEngagementBatch
};
