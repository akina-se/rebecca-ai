import type { FirestoreUser, UserCoreProfile, ImageDocWithId, RawConversationLog, ConversationLogEntry, XApiMentionResponse, XApiTweetDetailsResponse, XApiFollowersResponse, XApiListMembersResponse, XApiCreateResponse, XApiUser } from './index';
/**
 * Firestore Service Interface
 * 
 * Handles all database operations, abstracting away the underlying Google Cloud Firestore implementation.
 * Responsible for managing user profiles, conversation logs, rate limits, timeline summaries, and RAG memories.
 */
export interface IFirestoreService {
    getUserDoc(userId: string): Promise<FirestoreUser | null>;
    updateUserDoc(userId: string, data: Partial<FirestoreUser>): Promise<void>;
    appendEpisodicBuffer(userId: string, log: ConversationLogEntry): Promise<void>;
    updateCoreProfile(userId: string, profile: UserCoreProfile): Promise<void>;
    checkAndConsumeRateLimit(
        userId: string,
        dateStr: string,
        monthStr: string,
        minuteStr: string,
        limits: { globalDaily: number; spamMinute: number }
    ): Promise<{ allowed: boolean; reason?: string }>;
    
    getAllUsers(): Promise<FirestoreUser[]>;
    
    saveRawConversationLog(userId: string, userText: string, aiText: string): Promise<void>;
    getRecentConversationLogs(limit?: number, days?: number, somethingElse?: unknown): Promise<RawConversationLog[]>;
    
    getExtendedPrompt(): Promise<string>;
    saveExtendedPrompt(promptText: string): Promise<void>;
    getTimelineSummary(): Promise<string>;
    saveTimelineSummary(summaryText: string): Promise<void>;
    
    saveTimelinePost(text: string): Promise<void>;
    getRecentTimelinePosts(limit?: number): Promise<string[]>;
    
    saveRagMemory(userId: string, text: string, embedding: number[]): Promise<void>;
    findRagMemories(userId: string, queryVector: number[], limit?: number): Promise<string[]>;
    
    getLastMentionId(): Promise<string | null>;
    setLastMentionId(mentionId: string): Promise<void>;
    
    hasProcessedMention(tweetId: string): Promise<boolean>;
    markMentionProcessed(tweetId: string): Promise<void>;
    
    saveImageMetadata(hash: string, url: string, description: string, vector: number[]): Promise<void>;
    getImageByHash(hash: string): Promise<ImageDocWithId | null>;
    findImageByVector(queryVector: number[]): Promise<ImageDocWithId | null>;
    updateImageLastUsed(hash: string): Promise<void>;
    
    hasProcessedFollower(followerId: string): Promise<boolean>;
    markFollowerProcessed(followerId: string): Promise<void>;
    getLastListInteraction(userId: string): Promise<Date | null>;
    updateLastListInteraction(userId: string): Promise<void>;
}

/**
 * Gemini Service Interface
 * 
 * Manages all interactions with Google's Gemini Large Language Models.
 * Responsible for generating text replies, dreaming (memory consolidation), evolution prompts, embeddings, and image analysis.
 */
export interface IGeminiService {
    generateReply(systemInstruction: string, history: ConversationLogEntry[], userInput: string): Promise<string>;
    generateDreaming(systemPrompt: string, episodicBuffer: ConversationLogEntry[], coreProfile: UserCoreProfile): Promise<UserCoreProfile>;
    generateEvolutionPrompt(logsText: string): Promise<string>;
    auditEvolutionPrompt(candidatePrompt: string): Promise<{ pass: boolean; reason?: string; }>;
    analyzeUserProfile(description: string): Promise<UserCoreProfile>;
    generateNewsPost(systemInstruction: string, headlines: string[]): Promise<string>;
    generateTimelineSummary(recentPosts: string[], previousSummary?: string): Promise<string>;
    detectLanguage(text: string): Promise<'ja' | 'en'>;
    generateEmbedding(text: string): Promise<number[]>;
    generateSearchQuery(context: string, input: string): Promise<string>;
    analyzeImageCaption(imageBuffer: Buffer, mimeType: string): Promise<string>;
    inferImageSearchQuery(tweetText: string, timelineSummary: string): Promise<string | null>;
}

/**
 * X (Twitter) API Service Interface
 * 
 * Handles all communication with the X (Twitter) API v2 and v1.1.
 * Responsible for fetching mentions, posting tweets, uploading media, managing lists, and retrieving user profiles.
 */
export interface IXApiService {
    replyToMention(tweetId: string, text: string, mediaIds?: string[]): Promise<XApiCreateResponse>;
    getTweetDetails(tweetId: string): Promise<XApiTweetDetailsResponse>;
    tweet(text: string, options?: { mediaIds?: string[]; quote_tweet_id?: string; }): Promise<XApiCreateResponse>;
    uploadMedia(buffer: Buffer, mimeType: string): Promise<string | null>;
    getUserProfile(userId: string): Promise<{ data: XApiUser } | null>;
    getMentions(sinceId?: string): Promise<XApiMentionResponse>;
    getFollowers(userId: string, paginationToken?: string): Promise<XApiFollowersResponse>;
    addListMember(listId: string, userId: string): Promise<boolean>;
    getListMembers(listId: string): Promise<XApiListMembersResponse>;
    getUserTweets(userId: string, maxResults?: number): Promise<XApiMentionResponse>;
    cachedNumericMyUserId: string | null;
}

/**
 * Cloud Tasks Service Interface
 * 
 * Manages asynchronous task queuing via Google Cloud Tasks.
 * Responsible for enqueuing worker tasks such as reply generation to ensure resilient background processing.
 */
export interface ITasksService {
    enqueueReplyTask(payload: Record<string, unknown>, delaySeconds?: number): Promise<unknown>;
}

/**
 * Cloud Storage Service Interface
 * 
 * Manages object storage operations via Google Cloud Storage.
 * Responsible for downloading and uploading images and other media assets.
 */
export interface IStorageService {
    downloadImage(gsUri: string): Promise<Buffer>;
    uploadImage(hash: string, buffer: Buffer, mimeType: string): Promise<string>;
}

/**
 * News Fetcher Service Interface
 * 
 * Utility service for fetching external news feeds (e.g., Yahoo News RSS).
 * Provides the AI with up-to-date real-world events for proactive engagement.
 */
export interface INewsFetcherService {
    fetchYahooNewsHeadlines(): Promise<string[]>;
}
