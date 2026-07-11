import { Timestamp } from '@google-cloud/firestore';

/**
 * Service Interfaces (Dependency Inversion)
 * These interfaces define the contracts that the Infrastructure layer must fulfill.
 * The Core Domain relies ONLY on these interfaces, completely decoupling it from specific implementations.
 */

export * from './interfaces';
import {
    IFirestoreService,
    IGeminiService,
    IXApiService,
    ITasksService,
    IStorageService,
    INewsFetcherService
} from './interfaces';

export interface AppDependencies {
    firestore: IFirestoreService;
    gemini: IGeminiService;
    xApi: IXApiService;
    tasks: ITasksService;
    storage: IStorageService;
    newsFetcher: INewsFetcherService;
}
/**
 * Represents the core profile of a user.
 */
export interface UserCoreProfile {
    [key: string]: unknown;
}

/**
 * Represents a single entry in a conversation log.
 */
export interface ConversationLogEntry {
    role: 'user' | 'model';
    content: string;
    timestamp?: string; // ISO string
}

/**
 * Represents a user document as stored in Firestore.
 */
export interface FirestoreUser {
    coreProfile: UserCoreProfile;
    working_memory?: ConversationLogEntry[];
    episodicBuffer: ConversationLogEntry[];
    last_reply_date?: string;
    daily_reply_count?: number;
}

/**
 * Represents a memory used in Retrieval-Augmented Generation (RAG).
 */
export interface RagMemory {
    userId: string;
    text: string;
    embedding: number[];
    timestamp: string;
}

/**
 * Represents a raw conversation log between a user and the AI.
 */
export interface RawConversationLog {
    userId: string;
    userText: string;
    aiText: string;
    timestamp: string;
    expireAt: Timestamp;
}

/**
 * Represents a post on the timeline.
 */
export interface TimelinePost {
    text: string;
    timestamp: string;
    expireAt: Timestamp;
}

/**
 * Represents the rate limit document for a user.
 */
export interface RateLimitDoc {
    count: number;
}

/**
 * Represents the persona configuration document.
 */
export interface PersonaDoc {
    extended_prompt?: string;
    updatedAt?: string;
    timeline_summary?: string;
    timelineSummaryUpdatedAt?: string;
}

/**
 * Represents the state of the X API integration.
 */
export interface XApiStateDoc {
    last_mention_id?: string | null;
    updatedAt?: string;
}

/**
 * Represents a documented image with its embedding and usage data.
 */
export interface ImageDoc {
    url: string;
    caption: string;
    embedding: number[];
    lastUsedAt: Timestamp | null;
    useCount: number;
}

/**
 * Represents a documented image that includes its unique identifier.
 */
export interface ImageDocWithId extends ImageDoc {
    id: string;
}

/**
 * Represents a follower that has been processed.
 */
export interface ProcessedFollower {
    userId: string;
    timestamp: string;
}

/**
 * Represents an interaction with a list member.
 */
export interface ListInteraction {
    userId: string;
    lastInteractionAt: Timestamp;
}

export interface XApiMedia {
    type: string;
    url?: string;
}

/**
 * Represents a tweet returned from the X API.
 */
export interface XApiTweet {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    in_reply_to_user_id?: string;
    referenced_tweets?: Array<{ type: string; id: string }>;
    conversation_id?: string;
    attachments?: { media_keys?: string[] };
}

/**
 * Represents a user returned from the X API.
 */
export interface XApiUser {
    id: string;
    name: string;
    username: string;
    description?: string;
}

/**
 * Represents the response from the X API when fetching tweets (mentions or user timeline).
 */
export interface XApiMentionResponse {
    data?: XApiTweet[];
    includes?: {
        media?: XApiMedia[];
    };
    meta?: {
        resultCount: number;
        oldest_id?: string;
        newest_id?: string;
        next_token?: string;
    };
}

/**
 * Represents the response from the X API when fetching tweet details.
 */
export interface XApiTweetDetailsResponse {
    data?: XApiTweet;
    includes?: {
        media?: XApiMedia[];
    };
}

/**
 * Represents the response from the X API when fetching followers.
 */
export interface XApiFollowersResponse {
    data?: XApiUser[];
    meta?: {
        resultCount: number;
        next_token?: string;
    };
}

/**
 * Represents the response from the X API when fetching list members.
 */
export interface XApiListMembersResponse {
    data?: XApiUser[];
    meta?: {
        resultCount: number;
        next_token?: string;
    };
}

/**
 * Represents the response from the X API when creating a tweet.
 */
export interface XApiCreateResponse {
    data?: {
        id: string;
        text: string;
    };
}
