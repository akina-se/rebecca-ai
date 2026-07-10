import * as xApi from '../services/xApi';
import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import config from '../config';
import { getBasePrompt } from './prompt';
import { checkAndIncrementRateLimits } from './rateLimiter';

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

        const lang = await gemini.detectLanguage(description);

        const systemPrompt = getBasePrompt('random_engagement', lang);
        const userInput = `【ターゲットユーザー情報】\nユーザー名: @${targetUser.username}\nプロフィール: ${description}\n分析属性: ${JSON.stringify(profileAnalysis)}\n\n上記を踏まえて、ターゲットユーザーに対して不意打ちでメンション（話しかけ）を行ってください。`;

        const generatedText = await gemini.generateReply(systemPrompt, [], userInput);

        let finalText = generatedText;
        if (!finalText.includes(`@${targetUser.username}`)) {
            finalText = `@${targetUser.username}\n${finalText}`;
        }

        console.log(`Generated Engagement Text:\n${finalText}`);

        await xApi.tweet(finalText);

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
