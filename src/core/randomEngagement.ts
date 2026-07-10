import * as xApi from '../services/xApi';
import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import config from '../config';
import { getBasePrompt } from './prompt';
import { checkAndIncrementRateLimits } from './rateLimiter';
import { downloadImage } from '../utils/image';

/**
 * Executes a background job to randomly engage with a user from the target list.
 * Analyzes the user's profile and generates a spontaneous mention.
 * 
 * @returns A promise resolving to an object indicating the status of the operation and the processed user.
 */
const runRandomEngagementBatch = async (): Promise<{ status: string; processedUser?: string; reason?: string }> => {
    console.log("Starting Random Engagement Batch...");
    try {
        const targetListId = config.xApi.targetListId;
        if (!targetListId) {
            return { status: 'failed', reason: 'Missing X_TARGET_LIST_ID' };
        }

        const membersResp = await xApi.getListMembers(targetListId);
        const members = membersResp.data || [];
        
        if (members.length === 0) {
            console.log("List is empty.");
            return { status: 'success' };
        }

        const shuffled = members.sort(() => 0.5 - Math.random());
        let targetUser = null;

        for (const user of shuffled) {
            const lastInteraction = await firestore.getLastListInteraction(user.id);
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

        const rateLimitResult = await checkAndIncrementRateLimits(targetUser.id);
        if (!rateLimitResult.allowed) {
            console.warn(`Rate limit hit for ${targetUser.id}: ${rateLimitResult.reason}`);
            return { status: 'skipped', reason: 'rate_limited' };
        }

        const profileResp = await xApi.getUserProfile(targetUser.id);
        const description = profileResp.data.description || '';
        
        const profileAnalysis = await gemini.analyzeUserProfile(description);
        console.log("Profile Analysis:", profileAnalysis);

        let tweetContext = '';
        let targetTweetId: string | undefined = undefined;
        try {
            const recentTweets = await xApi.getUserTweets(targetUser.id, 5);
            if (recentTweets.data && recentTweets.data.length > 0) {
                const latestTweet = recentTweets.data[0];
                targetTweetId = latestTweet.id as string;
                tweetContext += `\n【直近の投稿内容】\n${latestTweet.text as string}`;
                
                const attachments = latestTweet.attachments as { media_keys?: string[] } | undefined;
                const mediaKeys = attachments?.media_keys;
                const includes = recentTweets.includes as { media?: { type: string, url?: string }[] } | undefined;
                const mediaIncludes = includes?.media || [];
                
                const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
                if (hasMedia) {
                    for (const media of mediaIncludes) {
                        if (media.type !== 'photo' || !media.url) continue;

                        const { buffer, mimeType } = await downloadImage(media.url);
                        const imageCaption = await gemini.analyzeImageCaption(buffer, mimeType);
                        
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
            return { status: 'skipped', reason: 'No valid tweets to quote' };
        }

        const lang = await gemini.detectLanguage(description + tweetContext);

        const systemPrompt = getBasePrompt('random_engagement', lang);
        const userInput = `【ターゲットユーザー情報】\nユーザー名: @${targetUser.username}\nプロフィール: ${description}\n分析属性: ${JSON.stringify(profileAnalysis)}\n${tweetContext}\n\n上記を踏まえて、ターゲットユーザーの最新の投稿に対して不意打ちで引用リポスト（話しかけ）を行ってください。`;

        const generatedText = await gemini.generateReply(systemPrompt, [], userInput);

        let finalText = generatedText;
        if (!finalText.includes(`@${targetUser.username}`)) {
            finalText = `@${targetUser.username}\n${finalText}`;
        }

        console.log(`Generated Engagement Text:\n${finalText}`);

        await xApi.tweet(finalText, { quote_tweet_id: targetTweetId });

        await firestore.updateLastListInteraction(targetUser.id);

        return { status: 'success', processedUser: targetUser.username };
    } catch (e) {
        console.error("Error in runRandomEngagementBatch:", e);
        throw e;
    }
};

export {
    runRandomEngagementBatch
};
