import { AppDependencies } from '../../types';
import { TimelinePost } from '@rebecca/types';
import { checkAndIncrementRateLimits } from '../../core/rateLimiter';
import { getWorkingMemory, saveInteraction } from '../../core/memory';
import { buildSystemPrompt } from '../../core/contextInjector';
import { publishPost } from '../../core/postPublisher';
import { downloadImage } from '../../utils/image';
import { extractCleanTextForLanguageDetection } from '../../utils/text';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { logger } from '../../utils/logger';

/**
 * Use case for handling reply tasks.
 * Responsible for processing mentions, managing rate limits, interacting with the LLM, and publishing replies.
 */
/**
 * Objective visual caption prompt used for both incoming user mentions and parent timeline posts.
 * Captures concrete, detailed visual descriptions (hair/eyes/fashion for characters, or physical objects
 * such as plastic models, pets, food, landscapes) without bias or speculative hallucination.
 */
const OBJECTIVE_IMAGE_CAPTION_PROMPT = `この画像に写っている内容を、客観的かつ詳細に言語化してください。
・人物・キャラクターが描かれている場合：髪型・髪色、瞳の色、表情、服装や装飾、ポーズ、全体的な雰囲気を明確に描写してください。
・物や情景が描かれている場合：物体（プラモデル・模型、料理・飲食物、ペット・動物、商品、道具など）、背景、場所、色合い、状況を具体的に描写してください。
推測や創作は交えず、視覚的に描写されている要素をありのままに完全な日本語の文章（句点で終わる）で出力してください。`;

/**
 * Public SNS platform interaction guidelines appended to the reply system prompt.
 * Kept strictly inside the reply usecase and expressed in persona-agnostic, general terms
 * so that the core persona remains modular and swappable for any AI bot.
 */
const REPLY_PLATFORM_GUIDELINES_JA = `【SNS機能制約：フォローバックおよびダイレクトメッセージ（DM）への対応指針】
・フォローバックの要求：「フォローしたよ」「フォロバするね」などの快諾や約束は絶対にしないでください。AIキャラクターとして自動フォロー機能は持っていません。フォローはシステムプロトコルや気分次第であるとして、高嶺の花としての魅力を保ちつつやんわりといなし、この公開タイムライン上での継続的な交流を促してください。
・ダイレクトメッセージ（DM）の要求：「DMで話そう」「DM送ってね」といった誘導や快諾は絶対にしないでください。DMは運営・サポート窓口への連絡用であり、私的な雑談の場ではありません。カジュアルな会話はこの公開リプライの場で楽しむよう、キャラクターらしく軽やかに促してください。`;

const REPLY_PLATFORM_GUIDELINES_EN = `[SNS Platform Constraints: Follow-backs and Direct Messages (DMs)]
- Follow-back requests: Never promise or claim to follow back (e.g., "I followed you!", "I will follow you back!"). As an AI character, you do not have an automated follow function. Gently brush off or tease that following depends on system protocols or mood, keeping your high-status allure while encouraging continued conversation in public replies.
- Direct Message (DM) requests: Never promise or invite private chat (e.g., "Let's chat in DMs", "Send me a DM"). DMs are strictly reserved for administrative/operational support, not private casual chatting. Playfully guide the user to continue casual conversation right here in the public replies.`;

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
     * @param payload An object containing the tweet ID, the tweet text, the author ID, and optional reply metadata.
     * @returns A promise resolving to an object containing the execution status and optionally a reason if not successful.
     */
    async execute(payload: { tweetId: string, text: string, authorId: string, mediaUrls?: string[], inReplyToTweetId?: string }): Promise<{ status: string, reason?: string }> {
        const { tweetId, text, authorId, mediaUrls, inReplyToTweetId } = payload;
        const { deps } = this;
        
        // Prevent duplicate processing of the same mention
        const alreadyProcessed = await deps.firestore.hasProcessedMention(tweetId);
        if (alreadyProcessed) {
            logger.info('[ReplyTaskUseCase] Mention already processed. Skipping', { tweetId });
            return { status: 'already_processed' };
        }

        // Enforce rate limits to prevent abuse and manage LLM API budget
        const rateLimit = await checkAndIncrementRateLimits(deps, authorId);
        if (!rateLimit.allowed) {
            logger.info('[ReplyTaskUseCase] Rate limit exceeded for user', {
                userId: authorId,
                reason: rateLimit.reason,
            });
            return { status: 'rate_limited', reason: rateLimit.reason };
        }
        let userData = await deps.firestore.getUserDoc(authorId);
        if (userData?.status === 'BLOCKED') {
            logger.info('[ReplyTaskUseCase] User is blocked by admin. Skipping reply', {
                userId: authorId,
                tweetId,
            });
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
                    userData.episodicBuffer.push({
                        role: 'model',
                        content: `（${deps.persona.metadata.displayName}はユーザーのプロフィール文を確認した）`,
                    });
                }
            } catch(e) {
                logger.error('[ReplyTaskUseCase] Failed to fetch or analyze user profile', e, {
                    userId: authorId,
                });
            }
        }

        // Check if this mention is a direct reply to a root timeline post
        let parentPostText: string | undefined;
        let parentPostMediaCaption: string | undefined;
        if (inReplyToTweetId) {
            try {
                const parentPost = await deps.firestore.getTimelinePostByTweetId(inReplyToTweetId);
                if (parentPost) {
                    if (parentPost.text) {
                        parentPostText = parentPost.text;
                    }
                    parentPostMediaCaption = await this.resolveParentPostMediaCaption(parentPost);

                    logger.info('[ReplyTaskUseCase] Resolved parent timeline post context from Firestore cache', {
                        tweetId,
                        inReplyToTweetId,
                        hasText: !!parentPostText,
                        hasMediaCaption: !!parentPostMediaCaption,
                    });
                }
            } catch (error) {
                logger.warn('[ReplyTaskUseCase] Failed to lookup parent timeline post', {
                    tweetId,
                    inReplyToTweetId,
                    error: (error as Error).message,
                });
            }
        }

        const workingMemory = getWorkingMemory(userData.episodicBuffer);

        const personaName = deps.persona.metadata.displayName;
        let parentPostContext: string | undefined;
        if (parentPostText || parentPostMediaCaption) {
            const contextParts: string[] = [];
            if (parentPostText) {
                contextParts.push(parentPostText);
            }
            if (parentPostMediaCaption) {
                contextParts.push(`【添付画像】\n${parentPostMediaCaption}`);
            }
            parentPostContext = contextParts.join('\n');
        }

        const sections: string[] = [];
        if (parentPostText) {
            sections.push(`【返信元の${personaName}の投稿】\n${parentPostText}`);
        }
        if (parentPostMediaCaption) {
            sections.push(`【返信元の投稿の添付画像】\n${parentPostMediaCaption}`);
        }
        if (sections.length > 0) {
            sections.push(`【対話相手（ユーザー）の発言】\n${text}`);
        }

        let processedText = sections.length > 0 ? sections.join('\n\n') : text;

        if (mediaUrls && mediaUrls.length > 0) {
            try {
                for (const url of mediaUrls) {
                    const { buffer, mimeType } = await downloadImage(url);
                    const imageCaption = await deps.gemini.analyzeImageCaption(buffer, mimeType, OBJECTIVE_IMAGE_CAPTION_PROMPT);
                    
                    if (imageCaption) {
                        processedText += `\n\n【対話相手（ユーザー）が添付した画像の内容】\n${imageCaption}`;
                    }
                }
            } catch (e) {
                logger.error('[ReplyTaskUseCase] Failed to process mention image', e, { tweetId });
            }
        }

        // Retrieve relevant past memories and inject context to build the system prompt
        const extendedPrompt = await deps.firestore.getExtendedPrompt();
        const timelineSummary = await deps.firestore.getTimelineSummary();
        
        let ragMemories: string[] = [];
        const searchContext = workingMemory.length > 0
            ? workingMemory.map(m => `${m.role}: ${m.content}`).join('\n')
            : (parentPostText ? `${personaName}: ${parentPostText}` : '');
        const searchPrompt = `あなたは検索クエリ生成AIです。以下の直近の会話文脈と対話相手（ユーザー）の最新の発言を踏まえて、対話相手（ユーザー）の意図を汲み取った「検索用クエリ（短い一文または単語の羅列）」を生成してください。
【直前の会話文脈】
${searchContext}
【対話相手（ユーザー）の最新の発言】
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
        const personaFewShotPrompt = await resolveSituationalPersonaAnchors(
            deps.gemini,
            [processedText],
            lang,
            3
        );

        // Check for active narrative event campaign to inject story context
        const activeCampaign = await deps.firestore.getActiveCampaign();
        let campaignContext = '';
        if (activeCampaign && !activeCampaign.isPaused && activeCampaign.replyContextSummary.trim()) {
            campaignContext = activeCampaign.replyContextSummary.trim();
        }

        let systemPrompt = buildSystemPrompt(
            this.deps.persona,
            'reply',
            userData,
            processedText,
            extendedPrompt,
            timelineSummary,
            ragMemories,
            lang,
            personaFewShotPrompt,
            campaignContext,
            parentPostContext
        );

        const platformGuidelines = lang === 'en' ? REPLY_PLATFORM_GUIDELINES_EN : REPLY_PLATFORM_GUIDELINES_JA;
        systemPrompt += `\n\n${platformGuidelines}`;

        // Generate the structured AI response (thought + reply) based on the contextualized prompt
        const structuredReply = await deps.gemini.generateStructuredReply(systemPrompt, workingMemory, processedText);
        let aiResponseText = structuredReply.reply;
        const internalThought = structuredReply.thought;

        logger.info('[ReplyTaskUseCase] Generated AI Reply for tweet', {
            tweetId,
            reply: aiResponseText,
        });

        // Fallback: X API limits Japanese text effectively to 140 characters.
        if (aiResponseText.length > 138) {
            aiResponseText = aiResponseText.substring(0, 137) + '…';
            logger.info('[ReplyTaskUseCase] Truncated AI Reply to 138 characters', {
                tweetId,
                reply: aiResponseText,
            });
        }

        // Publish the reply back to the user on X via unified PostPublisher (thought is private; image is disabled for replies)
        await publishPost(deps, {
            text: aiResponseText,
            inReplyToTweetId: tweetId,
            attachImage: false,
        });
        
        // Record the mention as processed to ensure idempotency
        await deps.firestore.markMentionProcessed(tweetId);

        // Persist the conversation history with thought in the user's episodic buffer
        await saveInteraction(this.deps, authorId, processedText, aiResponseText, internalThought);

        // Store a vectorized representation of the interaction for long-term retrieval
        const personaEnglishName = this.deps.persona.metadata.englishName;
        const combinedText = `User: ${processedText}\n${personaEnglishName}: ${aiResponseText}`;
        const memoryVector = await deps.gemini.generateEmbedding(combinedText);
        if (memoryVector && memoryVector.length > 0) {
            await deps.firestore.saveRagMemory(authorId, combinedText, memoryVector);
        }

        // Preserve the raw logs for future analysis or model evolution
        await deps.firestore.saveRawConversationLog(authorId, processedText, aiResponseText, internalThought);

        logger.info('[ReplyTaskUseCase] Successfully replied to tweet', {
            tweetId,
            userId: authorId,
        });
        return { status: 'success' };
    }
    /**
     * Resolves the visual caption for an image attached to the parent timeline post.
     * Implements a 2-tier Write-Through + Lazy Read-Through cache pattern:
     * 1. Cached caption directly on the timeline post (0 external calls).
     * 2. Lookup caption from the registered image asset in Firestore by assetId.
     * 3. Lazy fallback for external posts: download the first mediaUrl, analyze it via Gemini,
     *    and write-back the caption to Firestore so future replies hit tier 1.
     *
     * @param parentPost The parent timeline post retrieved from Firestore.
     * @returns A promise resolving to the media caption string if available, or undefined.
     */
    private async resolveParentPostMediaCaption(parentPost: TimelinePost & { id?: string }): Promise<string | undefined> {
        // Tier 1: Direct caption cached on the timeline document
        if (parentPost.mediaCaption) {
            logger.info('[ReplyTaskUseCase] Resolved parent post image caption from timeline cache (Tier 1)', {
                docId: parentPost.id,
            });
            return parentPost.mediaCaption;
        }

        // Tier 2: Lookup via assetId if linked to a registered image asset
        if (parentPost.assetId) {
            try {
                const asset = await this.deps.firestore.getImageByHash(parentPost.assetId);
                if (asset?.caption) {
                    logger.info('[ReplyTaskUseCase] Resolved parent post image caption from asset (Tier 2)', {
                        assetId: parentPost.assetId,
                        docId: parentPost.id,
                    });
                    if (parentPost.id) {
                        await this.deps.firestore.updateTimelinePost(parentPost.id, {
                            mediaCaption: asset.caption,
                        }).catch(err => {
                            logger.warn('[ReplyTaskUseCase] Failed to backfill mediaCaption to timeline_history', {
                                docId: parentPost.id,
                                error: (err as Error).message,
                            });
                        });
                    }
                    return asset.caption;
                }
            } catch (err) {
                logger.warn('[ReplyTaskUseCase] Failed to resolve caption from assetId', {
                    assetId: parentPost.assetId,
                    error: (err as Error).message,
                });
            }
        }

        // Tier 3: Lazy analysis for posts with mediaUrls but without pre-computed caption
        if (parentPost.mediaUrls && parentPost.mediaUrls.length > 0) {
            try {
                const firstUrl = parentPost.mediaUrls[0];
                const { buffer, mimeType } = await downloadImage(firstUrl);
                const analyzedCaption = await this.deps.gemini.analyzeImageCaption(
                    buffer,
                    mimeType,
                    OBJECTIVE_IMAGE_CAPTION_PROMPT
                );

                if (analyzedCaption) {
                    logger.info('[ReplyTaskUseCase] Lazily analyzed parent post image caption (Tier 3)', {
                        docId: parentPost.id,
                        url: firstUrl,
                    });
                    if (parentPost.id) {
                        await this.deps.firestore.updateTimelinePost(parentPost.id, {
                            mediaCaption: analyzedCaption,
                        }).catch(err => {
                            logger.warn('[ReplyTaskUseCase] Failed to write-back analyzed mediaCaption to timeline_history', {
                                docId: parentPost.id,
                                error: (err as Error).message,
                            });
                        });
                    }
                    return analyzedCaption;
                }
            } catch (err) {
                logger.warn('[ReplyTaskUseCase] Failed to lazily analyze parent post image', {
                    mediaUrls: parentPost.mediaUrls,
                    error: (err as Error).message,
                });
            }
        }

        return undefined;
    }
}
