/**
 * apps/bot-backend/src/types/interfaces.ts
 *
 * Backend-only service interface contracts (Dependency Inversion Principle).
 * These interfaces are consumed exclusively by the bot-backend application.
 * Data model types are imported from @rebecca/types to ensure a single source of truth.
 */

import type {
  FirestoreUser,
  UserCoreProfile,
  ImageDocWithId,
  RawConversationLog,
  ConversationLogEntry,
  XApiMentionResponse,
  XApiTweetDetailsResponse,
  XApiFollowersResponse,
  XApiListMembersResponse,
  XApiCreateResponse,
  XApiUser,
} from '@rebecca/types';

// ---------------------------------------------------------------------------
// Firestore Service
// ---------------------------------------------------------------------------

/**
 * Manages all database operations, abstracting away the Google Cloud Firestore
 * implementation from the core domain logic.
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
    limits: { globalDaily: number; spamMinute: number },
  ): Promise<{ allowed: boolean; reason?: string }>;
  getAllUsers(): Promise<FirestoreUser[]>;
  saveRawConversationLog(userId: string, userText: string, aiText: string): Promise<void>;
  getRecentConversationLogs(limit?: number, days?: number, somethingElse?: unknown): Promise<RawConversationLog[]>;
  getExtendedPrompt(): Promise<string>;
  saveExtendedPrompt(promptText: string): Promise<void>;
  getTimelineSummary(): Promise<string>;
  saveTimelineSummary(summaryText: string): Promise<void>;
  saveTimelinePost(
    text: string,
    options?: { mediaUrls?: string[]; assetId?: string; tweetId?: string },
  ): Promise<void>;
  getRecentTimelinePosts(limit?: number): Promise<string[]>;
  saveRagMemory(userId: string, text: string, embedding: number[]): Promise<void>;
  findRagMemories(userId: string, queryVector: number[], limit?: number): Promise<string[]>;
  getLastMentionId(): Promise<string | null>;
  setLastMentionId(mentionId: string): Promise<void>;
  hasProcessedMention(tweetId: string): Promise<boolean>;
  markMentionProcessed(tweetId: string): Promise<void>;
  saveImageMetadata(hash: string, url: string, description: string, vector: number[]): Promise<void>;
  getImageByHash(hash: string): Promise<ImageDocWithId | null>;
  findImageByVector(queryVector: number[], similarityThreshold?: number): Promise<ImageDocWithId | null>;
  updateImageLastUsed(hash: string): Promise<void>;
  hasProcessedFollower(followerId: string): Promise<boolean>;
  markFollowerProcessed(followerId: string): Promise<void>;
  getLastListInteraction(userId: string): Promise<Date | null>;
  updateLastListInteraction(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Gemini (LLM) Service
// ---------------------------------------------------------------------------

/**
 * Manages all interactions with Google's Gemini Large Language Models.
 * Responsible for text generation, memory consolidation (Dreaming),
 * embedding creation, and image analysis.
 */
export interface IGeminiService {
  generateReply(systemInstruction: string, history: ConversationLogEntry[], userInput: string): Promise<string>;
  generateStructuredReply(systemInstruction: string, history: ConversationLogEntry[], userInput: string): Promise<{ thought: string; reply: string }>;
  verifyImageRelevance(imageCaption: string, postText: string): Promise<boolean>;
  generateDreaming(systemPrompt: string, episodicBuffer: ConversationLogEntry[], coreProfile: UserCoreProfile): Promise<UserCoreProfile>;
  generateEvolutionPrompt(prompt: string): Promise<string>;
  auditEvolutionPrompt(candidatePrompt: string, auditInstruction: string): Promise<{ pass: boolean; reason?: string }>;
  analyzeUserProfile(prompt: string): Promise<UserCoreProfile>;
  generateNewsPost(systemInstruction: string, prompt: string): Promise<string>;
  generateTimelineSummary(prompt: string): Promise<string>;
  detectLanguage(prompt: string): Promise<'ja' | 'en'>;
  generateEmbedding(text: string): Promise<number[]>;
  generateSearchQuery(prompt: string): Promise<string>;
  analyzeImageCaption(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string>;
  inferImageSearchQuery(prompt: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// X (Twitter) API Service
// ---------------------------------------------------------------------------

/**
 * Handles all communication with the X (Twitter) API v2 and v1.1.
 * Responsible for fetching mentions, posting tweets, uploading media,
 * managing lists, and retrieving user profiles.
 */
export interface IXApiService {
  replyToMention(tweetId: string, text: string, mediaIds?: string[]): Promise<XApiCreateResponse>;
  getTweetDetails(tweetId: string): Promise<XApiTweetDetailsResponse>;
  tweet(text: string, options?: { mediaIds?: string[]; quote_tweet_id?: string }): Promise<XApiCreateResponse>;
  uploadMedia(buffer: Buffer, mimeType: string): Promise<string | null>;
  getUserProfile(userId: string): Promise<{ data: XApiUser } | null>;
  getMentions(sinceId?: string): Promise<XApiMentionResponse>;
  getFollowers(userId: string, paginationToken?: string): Promise<XApiFollowersResponse>;
  addListMember(listId: string, userId: string): Promise<boolean>;
  getListMembers(listId: string): Promise<XApiListMembersResponse>;
  getUserTweets(userId: string, maxResults?: number): Promise<XApiMentionResponse>;
  cachedNumericMyUserId: string | null;
}

// ---------------------------------------------------------------------------
// Cloud Tasks Service
// ---------------------------------------------------------------------------

/**
 * Manages asynchronous task queuing via Google Cloud Tasks.
 * Ensures resilient background processing for reply generation.
 */
export interface ITasksService {
  enqueueReplyTask(payload: Record<string, unknown>, delaySeconds?: number): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Cloud Storage Service
// ---------------------------------------------------------------------------

/**
 * Manages object storage operations via Google Cloud Storage.
 * Responsible for downloading and uploading image assets.
 */
export interface IStorageService {
  downloadImage(gsUri: string): Promise<Buffer>;
  uploadImage(hash: string, buffer: Buffer, mimeType: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// News Fetcher Service
// ---------------------------------------------------------------------------

/**
 * Utility service for fetching external news feeds (e.g., Yahoo News RSS).
 * Provides the AI with real-world events for proactive engagement.
 */
export interface INewsFetcherService {
  fetchYahooNewsHeadlines(): Promise<string[]>;
}
