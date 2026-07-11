import { Timestamp } from '@google-cloud/firestore';

/**
 * Firestore Service Interface
 * 
 * Handles all database operations, abstracting away the underlying Google Cloud Firestore implementation.
 * Responsible for managing user profiles, conversation logs, rate limits, timeline summaries, and RAG memories.
 */
export interface IFirestoreService {
    getUserDoc(userId: string): Promise<any>;
    updateUserDoc(userId: string, data: Partial<any>): Promise<void>;
    appendEpisodicBuffer(userId: string, log: any): Promise<void>;
    updateCoreProfile(userId: string, profile: any): Promise<void>;
    checkAndConsumeRateLimit(
        userId: string,
        dateStr: string,
        monthStr: string,
        minuteStr: string,
        limits: { globalDaily: number; spamMinute: number }
    ): Promise<{ allowed: boolean; reason?: string }>;
    
    getAllUsers(): Promise<any[]>;
    
    saveRawConversationLog(userId: string, userText: string, aiText: string): Promise<void>;
    getRecentConversationLogs(limit?: number, days?: number, somethingElse?: any): Promise<any[]>;
    
    getExtendedPrompt(): Promise<string>;
    saveExtendedPrompt(promptText: string): Promise<void>;
    getTimelineSummary(): Promise<string>;
    saveTimelineSummary(summaryText: string): Promise<void>;
    
    saveTimelinePost(text: string): Promise<void>;
    getRecentTimelinePosts(limit?: number): Promise<any[]>;
    
    saveRagMemory(userId: string, text: string, embedding: number[]): Promise<void>;
    findRagMemories(userId: string, queryVector: number[], limit?: number): Promise<string[]>;
    
    getLastMentionId(): Promise<string | null>;
    setLastMentionId(mentionId: string): Promise<void>;
    
    hasProcessedMention(tweetId: string): Promise<boolean>;
    markMentionProcessed(tweetId: string): Promise<void>;
    
    saveImageMetadata(hash: string, url: string, description: string, vector: number[]): Promise<void>;
    getImageByHash(hash: string): Promise<any | null>;
    findImageByVector(queryVector: number[]): Promise<any | null>;
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
    generateReply(systemInstruction: string, history: any[], userInput: string): Promise<string>;
    generateDreaming(systemPrompt: string, episodicBuffer: any[], coreProfile: any): Promise<any>;
    generateEvolutionPrompt(logsText: string): Promise<string>;
    auditEvolutionPrompt(candidatePrompt: string): Promise<{ pass: boolean; reason?: string; }>;
    analyzeUserProfile(description: string): Promise<any>;
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
    replyToMention(tweetId: string, text: string, mediaIds?: string[]): Promise<any>;
    getTweetDetails(tweetId: string): Promise<any>;
    tweet(text: string, options?: { mediaIds?: string[]; quote_tweet_id?: string; }): Promise<any>;
    uploadMedia(buffer: Buffer, mimeType: string): Promise<string | null>;
    getUserProfile(userId: string): Promise<any>;
    getMentions(sinceId?: string): Promise<{ data?: any[]; meta?: any }>;
    getFollowers(userId: string, paginationToken?: string): Promise<{ data?: any[], meta?: any }>;
    addListMember(listId: string, userId: string): Promise<boolean>;
    getListMembers(listId: string): Promise<{ data?: any[]; meta?: any }>;
    getUserTweets(userId: string, maxResults?: number): Promise<{ data?: any[]; meta?: any; includes?: any }>;
    cachedNumericMyUserId: string | null;
}

/**
 * Cloud Tasks Service Interface
 * 
 * Manages asynchronous task queuing via Google Cloud Tasks.
 * Responsible for enqueuing worker tasks such as reply generation to ensure resilient background processing.
 */
export interface ITasksService {
    enqueueReplyTask(payload: any, delaySeconds?: number): Promise<any>;
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
