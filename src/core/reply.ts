import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import * as xApi from '../services/xApi';
import { checkAndIncrementRateLimits } from './rateLimiter';
import { getWorkingMemory, saveInteraction } from './memory';
import { buildSystemPrompt } from './contextInjector';
import { downloadImage } from '../utils/image';

/**
 * Processes a reply task, fetching necessary context, calling the AI model, and posting the reply.
 */
export const processReplyTask = async (tweetId: string, text: string, authorId: string) => {
    // 1. Rate Limit Check
    const rateLimit = await checkAndIncrementRateLimits(authorId);
    if (!rateLimit.allowed) {
        console.log(`Rate limit exceeded for user ${authorId.replace(/[\r\n]/g, '')}, reason: ${rateLimit.reason.replace(/[\r\n]/g, '')}`);
        return { status: 'rate_limited', reason: rateLimit.reason };
    }

    // 2. Fetch User Data & Memory
    let userData = await firestore.getUserDoc(authorId);
    let isFirstTime = false;
    if (!userData) {
        userData = { episodicBuffer: [], coreProfile: {} };
        isFirstTime = true;
    }

    if (isFirstTime) {
        try {
            // Analyze the user's X profile only on their first interaction to create the initial coreProfile
            const profileRes = await xApi.getUserProfile(authorId);
            const desc = profileRes?.data?.description;
            if (desc) {
                const parsedProfile = await gemini.analyzeUserProfile(desc);
                userData.coreProfile = parsedProfile;
                // Inject a single history log hinting that the profile has been read
                userData.episodicBuffer.push({ role: 'model', content: 'アンタのプロフィール文、舐めるように見といたわ。これからよろしくね。' });
            }
        } catch(e) {
            console.error("Failed to fetch/analyze user profile on first time", e);
        }
    }

    const workingMemory = getWorkingMemory(userData.episodicBuffer);

    let processedText = text;
    try {
        const tweetDetails = await xApi.getTweetDetails(tweetId);
        const mediaKeys = tweetDetails?.data?.attachments?.media_keys;
        const mediaIncludes = tweetDetails.includes?.media || [];

        const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
        if (hasMedia) {
            for (const media of mediaIncludes) {
                if (media.type !== 'photo' || !media.url) continue;

                const { buffer, mimeType } = await downloadImage(media.url);
                const imageCaption = await gemini.analyzeImageCaption(buffer, mimeType);
                
                if (imageCaption) {
                    processedText += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
                }
            }
        }
    } catch (e) {
        console.error('Failed to process mention image', e);
    }

    // 3. RAG Retrieval & Context Injection (Build prompt)
    const extendedPrompt = await firestore.getExtendedPrompt();
    const timelineSummary = await firestore.getTimelineSummary();
    
    let ragMemories = [];
    const query = await gemini.generateSearchQuery(workingMemory.map(m => `${m.role}: ${m.content}`).join('\n'), processedText);
    if (query) {
        const queryEmb = await gemini.generateEmbedding(query);
        ragMemories = await firestore.findRagMemories(authorId, queryEmb);
    }

    const lang = await gemini.detectLanguage(processedText);
    const systemPrompt = buildSystemPrompt('reply', userData, processedText, extendedPrompt, timelineSummary, ragMemories, lang);

    // 4. Generate AI Reply
    const aiResponseText = await gemini.generateReply(systemPrompt, workingMemory, processedText);

    // 5. Post to X
    await xApi.replyToMention(tweetId, aiResponseText);

    // 6. Save Interaction to Memory (Working Memory / Episodic Buffer)
    await saveInteraction(authorId, processedText, aiResponseText);

    // 6.5. Save RAG Memory (Long-term Episodic Vector)
    const combinedText = `User: ${processedText}\nRebecca: ${aiResponseText}`;
    const memoryVector = await gemini.generateEmbedding(combinedText);
    if (memoryVector && memoryVector.length > 0) {
        await firestore.saveRagMemory(authorId, combinedText, memoryVector);
    }

    // 7. Save Raw Log for Analysis
    await firestore.saveRawConversationLog(authorId, processedText, aiResponseText);

    console.log(`Successfully replied to tweet ${tweetId.replace(/[\r\n]/g, '')} by user ${authorId.replace(/[\r\n]/g, '')}`);
    return { status: 'success' };
};
