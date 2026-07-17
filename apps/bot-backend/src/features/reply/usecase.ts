import { AppDependencies } from '../../types';
import { checkAndIncrementRateLimits } from '../../core/rateLimiter';
import { getWorkingMemory, saveInteraction } from '../../core/memory';
import { buildSystemPrompt } from '../../core/contextInjector';
import { downloadImage } from '../../utils/image';

const sanitizeForLog = (value: unknown): string => {
    return String(value).replace(/[\r\n\u2028\u2029]/g, '');
};

/**
 * Use case for handling reply tasks.
 * Responsible for processing mentions, managing rate limits, interacting with the LLM, and publishing replies.
 */
export class ReplyTaskUseCase {
    /**
     * Initializes the use case with application dependencies.
     * 
     * @param deps The application dependencies.
     */
    constructor(private deps: AppDependencies) {}

    /**
     * Executes the reply task logic.
     * It processes a mention, ensures idempotency, applies rate limits, generates an AI response, and publishes it.
     * 
     * @param payload An object containing the tweet ID, the tweet text, and the author ID.
     * @returns A promise resolving to an object containing the execution status and optionally a reason if not successful.
     */
    async execute(payload: { tweetId: string, text: string, authorId: string }): Promise<{ status: string, reason?: string }> {
        const { tweetId, text, authorId } = payload;
        const { deps } = this;
        
        // Prevent duplicate processing of the same mention
        const alreadyProcessed = await deps.firestore.hasProcessedMention(tweetId);
        if (alreadyProcessed) {
            console.log(`Mention ${sanitizeForLog(tweetId)} already processed. Skipping.`);
            return { status: 'already_processed' };
        }

        // Enforce rate limits to prevent abuse and manage LLM API budget
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
            const mediaKeys = tweetDetails?.data?.attachments?.mediaKeys;
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

        // Retrieve relevant past memories and inject context to build the system prompt
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

        // Generate the AI response based on the contextualized prompt
        let aiResponseText = await deps.gemini.generateReply(systemPrompt, workingMemory, processedText);
        console.log(`Generated AI Reply for tweet ${sanitizeForLog(tweetId)}: ${sanitizeForLog(aiResponseText)}`);

        // Fallback: X API limits Japanese text effectively to 140 characters.
        if (aiResponseText.length > 138) {
            aiResponseText = aiResponseText.substring(0, 137) + '…';
            console.log(`Truncated AI Reply to 138 characters: ${sanitizeForLog(aiResponseText)}`);
        }

        // Publish the generated reply back to the user on X
        await deps.xApi.replyToMention(tweetId, aiResponseText);
        
        // Record the mention as processed to ensure idempotency
        await deps.firestore.markMentionProcessed(tweetId);

        // Persist the conversation history in the user's episodic buffer
        await saveInteraction(this.deps, authorId, processedText, aiResponseText);

        // Store a vectorized representation of the interaction for long-term retrieval
        const combinedText = `User: ${processedText}\nRebecca: ${aiResponseText}`;
        const memoryVector = await deps.gemini.generateEmbedding(combinedText);
        if (memoryVector && memoryVector.length > 0) {
            await deps.firestore.saveRagMemory(authorId, combinedText, memoryVector);
        }

        // Preserve the raw logs for future analysis or model evolution
        await deps.firestore.saveRawConversationLog(authorId, processedText, aiResponseText);

        console.log(`Successfully replied to tweet ${sanitizeForLog(tweetId)} by user ${sanitizeForLog(authorId)}`);
        return { status: 'success' };
    }
}