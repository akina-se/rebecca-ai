import { AppDependencies } from '../types';
import { checkAndIncrementRateLimits } from './rateLimiter';
import { getWorkingMemory, saveInteraction } from './memory';
import { buildSystemPrompt } from './contextInjector';
import { downloadImage } from '../utils/image';

const sanitizeForLog = (value: unknown): string => {
    return String(value).replace(/[\r\n\u2028\u2029]/g, '');
};

/**
 * Processes a reply task, fetching necessary context, calling the AI model, and posting the reply.
 */
export const processReplyTask = async (deps: AppDependencies, tweetId: string, text: string, authorId: string) => {
    // 1. Idempotency Check
    const alreadyProcessed = await deps.firestore.hasProcessedMention(tweetId);
    if (alreadyProcessed) {
        console.log(`Mention ${sanitizeForLog(tweetId)} already processed. Skipping.`);
        return { status: 'already_processed' };
    }

    // 2. Rate Limit Check (Domain level: per X user & Global LLM budget)
    const rateLimit = await checkAndIncrementRateLimits(deps, authorId);
    if (!rateLimit.allowed) {
        console.log(`Rate limit exceeded for user ${sanitizeForLog(authorId)}, reason: ${sanitizeForLog(rateLimit.reason)}`);
        return { status: 'rate_limited', reason: rateLimit.reason };
    }
    let userData = await deps.firestore.getUserDoc(authorId);
    let isFirstTime = false;
    if (!userData) {
        userData = { episodicBuffer: [], coreProfile: {} };
        isFirstTime = true;
    }

    if (isFirstTime) {
        try {
            // Analyze the user's X profile only on their first interaction to create the initial coreProfile
            const profileRes = await deps.xApi.getUserProfile(authorId);
            const desc = profileRes?.data?.description;
            if (desc) {
                const parsedProfile = await deps.gemini.analyzeUserProfile(desc);
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
        const tweetDetails = await deps.xApi.getTweetDetails(tweetId);
        const mediaKeys = tweetDetails?.data?.attachments?.media_keys;
        const mediaIncludes = tweetDetails.includes?.media || [];

        const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
        if (hasMedia) {
            for (const media of mediaIncludes) {
                if (media.type !== 'photo' || !media.url) continue;

                const { buffer, mimeType } = await downloadImage(media.url);
                const imageCaption = await deps.gemini.analyzeImageCaption(buffer, mimeType);
                
                if (imageCaption) {
                    processedText += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
                }
            }
        }
    } catch (e) {
        console.error('Failed to process mention image', e);
    }

    // 3. RAG Retrieval & Context Injection (Build prompt)
    const extendedPrompt = await deps.firestore.getExtendedPrompt();
    const timelineSummary = await deps.firestore.getTimelineSummary();
    
    let ragMemories: string[] = [];
    const query = await deps.gemini.generateSearchQuery(workingMemory.map(m => `${m.role}: ${m.content}`).join('\n'), processedText);
    if (query) {
        const queryEmb = await deps.gemini.generateEmbedding(query);
        ragMemories = await deps.firestore.findRagMemories(authorId, queryEmb);
    }

    const lang = await deps.gemini.detectLanguage(processedText);
    const systemPrompt = buildSystemPrompt('reply', userData, processedText, extendedPrompt, timelineSummary, ragMemories, lang);

    // 4. Generate AI Reply
    const aiResponseText = await deps.gemini.generateReply(systemPrompt, workingMemory, processedText);

    // 5. Post to X
    await deps.xApi.replyToMention(tweetId, aiResponseText);
    
    // 5.5 Mark as processed for idempotency
    await deps.firestore.markMentionProcessed(tweetId);

    // 6. Save Interaction to Memory (Working Memory / Episodic Buffer)
    await saveInteraction(deps, authorId, processedText, aiResponseText);

    // 6.5. Save RAG Memory (Long-term Episodic Vector)
    const combinedText = `User: ${processedText}\nRebecca: ${aiResponseText}`;
    const memoryVector = await deps.gemini.generateEmbedding(combinedText);
    if (memoryVector && memoryVector.length > 0) {
        await deps.firestore.saveRagMemory(authorId, combinedText, memoryVector);
    }

    // 7. Save Raw Log for Analysis
    await deps.firestore.saveRawConversationLog(authorId, processedText, aiResponseText);

    console.log(`Successfully replied to tweet ${sanitizeForLog(tweetId)} by user ${sanitizeForLog(authorId)}`);
    return { status: 'success' };
};
