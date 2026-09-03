import { AppDependencies } from '../../types';
import { checkAndIncrementRateLimits } from '../../core/rateLimiter';
import { getWorkingMemory, saveInteraction } from '../../core/memory';
import { buildSystemPrompt } from '../../core/contextInjector';
import { downloadImage } from '../../utils/image';
import { extractCleanTextForLanguageDetection } from '../../utils/text';
import { buildPersonaFewShotPrompt, findTopPersonaPatterns } from '@rebecca/persona';
import { getPersonaPatternEmbeddings } from '../../core/personaEmbeddingCache';

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
        if (userData?.status === 'BLOCKED') {
            console.log(`User ${sanitizeForLog(authorId)} is blocked by admin. Skipping reply for tweet ${sanitizeForLog(tweetId)}.`);
            await deps.firestore.markMentionProcessed(tweetId);
            return { status: 'blocked', reason: 'User is blocked by admin' };
        }

        let isFirstTime = false;
        if (!userData) {
            userData = { episodicBuffer: [], coreProfile: {} };
            isFirstTime = true;
        }

        if (isFirstTime || !userData.username || !userData.name) {
            try {
                // Fetch and analyze the user's X profile
                const profileRes = await deps.xApi.getUserProfile(authorId);
                const xUser = profileRes?.data;
                if (xUser) {
                    if (xUser.username) userData.username = xUser.username;
                    if (xUser.name) userData.name = xUser.name;
                    await deps.firestore.updateUserDoc(authorId, {
                        username: xUser.username,
                        name: xUser.name
                    });
                }
                const desc = xUser?.description;
                if (desc && isFirstTime) {
                    const profilePrompt = `あなたはAIキャラクターのシステムです。ユーザーのX(Twitter)のプロフィール文を分析し、ユーザーの属性や好みをJSONで出力してください。
【プロフィール文】
${desc}

出力フォーマット（必ずJSONのみ）:
{
  "attributes": ["社会人", "エンジニア"など],
  "preferences": ["ゲーム", "酒"など]
}`;
                    const parsedProfile = await deps.gemini.analyzeUserProfile(profilePrompt);
                    userData.coreProfile = parsedProfile;
                    // Inject a single history log hinting that the profile has been read
                    userData.episodicBuffer.push({ role: 'model', content: 'アンタのプロフィール文、舐めるように見といたわ。これからよろしくね。' });
                }
            } catch(e) {
                console.error("Failed to fetch/analyze user profile", e);
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
                    const captionPrompt = `この画像に写っている状況、被写体の表情、および感情を説明するテキスト（キャプション）を生成してください。ベクトル検索のクエリとして使用するため、具体的なキーワード（場所、服の色、表情、シチュエーション）を豊富に含めた自然な日本語にしてください。途中で途切れないように、必ず完全な文章（句点で終わる）で出力してください。`;
                    const imageCaption = await deps.gemini.analyzeImageCaption(buffer, mimeType, captionPrompt);
                    
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
        const searchContext = workingMemory.map(m => `${m.role}: ${m.content}`).join('\n');
        const searchPrompt = `あなたは検索クエリ生成AIです。以下の直近の会話文脈とユーザーの最新の発言を踏まえて、ユーザーの意図を汲み取った「検索用クエリ（短い一文または単語の羅列）」を生成してください。
【直前の会話文脈】
${searchContext}
【ユーザーの最新の発言】
${processedText}
出力は検索クエリのみとし、不要な解説は含めないでください。`;
        const query = await deps.gemini.generateSearchQuery(searchPrompt);
        if (query) {
            const queryEmb = await deps.gemini.generateEmbedding(query);
            ragMemories = await deps.firestore.findRagMemories(authorId, queryEmb);
        }

        const cleanUserText = extractCleanTextForLanguageDetection(text);
        let lang: 'ja' | 'en' = 'ja';
        if (cleanUserText) {
            const detectPrompt = `このテキストは何語ですか？日本語（ローマ字表記を含む）であれば'ja'、それ以外（主に英語）であれば'en'と、2文字の言語コードのみを出力してください。\nテキスト: "${cleanUserText}"`;
            lang = await deps.gemini.detectLanguage(detectPrompt);
        }
        // Dynamic Few-Shot Persona Anchors
        let personaFewShotPrompt = '';
        try {
            const patternVectors = getPersonaPatternEmbeddings();
            const userVector = await deps.gemini.generateEmbedding(processedText);
            const topPatterns = findTopPersonaPatterns(userVector, patternVectors, 3);
            personaFewShotPrompt = buildPersonaFewShotPrompt(topPatterns, lang);
        } catch (e) {
            console.warn('Failed to generate dynamic few-shot persona anchors:', e);
        }

        const systemPrompt = buildSystemPrompt('reply', userData, processedText, extendedPrompt, timelineSummary, ragMemories, lang, personaFewShotPrompt);

        // Generate the structured AI response (thought + reply) based on the contextualized prompt
        const structuredReply = await deps.gemini.generateStructuredReply(systemPrompt, workingMemory, processedText);
        let aiResponseText = structuredReply.reply;
        const internalThought = structuredReply.thought;

        console.log(`Generated AI Thought for tweet ${sanitizeForLog(tweetId)}: ${sanitizeForLog(internalThought)}`);
        console.log(`Generated AI Reply for tweet ${sanitizeForLog(tweetId)}: ${sanitizeForLog(aiResponseText)}`);

        // Fallback: X API limits Japanese text effectively to 140 characters.
        if (aiResponseText.length > 138) {
            aiResponseText = aiResponseText.substring(0, 137) + '…';
            console.log(`Truncated AI Reply to 138 characters: ${sanitizeForLog(aiResponseText)}`);
        }

        // Publish ONLY the reply back to the user on X (thought is private)
        await deps.xApi.replyToMention(tweetId, aiResponseText);
        
        // Record the mention as processed to ensure idempotency
        await deps.firestore.markMentionProcessed(tweetId);

        // Persist the conversation history with thought in the user's episodic buffer
        await saveInteraction(this.deps, authorId, processedText, aiResponseText, internalThought);

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