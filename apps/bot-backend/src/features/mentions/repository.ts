import type { XApiMentionResponse } from '@rebecca/types';

/**
 * Provides an abstraction layer for managing the persistent state of the mentions polling process.
 * Implementations of this interface are responsible for tracking the high-water mark (last processed ID).
 */
export interface IMentionsStateRepository {
    /**
     * Retrieves the identifier of the most recently processed mention.
     * 
     * @returns A Promise that resolves to the last mention ID, or null if no previous state exists.
     */
    getLastMentionId(): Promise<string | null>;
    /**
     * Persists the identifier of the most recently processed mention to state storage.
     * 
     * @param mentionId - The unique identifier of the latest processed mention.
     * @returns A Promise that resolves once the state has been successfully updated.
     */
    setLastMentionId(mentionId: string): Promise<void>;
}

/**
 * Provides an abstraction layer for communicating with the external social platform API.
 * Encapsulates the network calls required to fetch mentions.
 */
export interface IMentionsPlatformRepository {
    /**
     * Fetches mentions directed at the authenticated user from the social platform.
     * 
     * @param sinceId - An optional identifier used as a lower bound to fetch only new mentions.
     * @returns A Promise that resolves to the standardized API response containing mention data.
     */
    getMentions(sinceId?: string): Promise<XApiMentionResponse>;
}

/**
 * Provides an abstraction layer for enqueuing asynchronous background tasks.
 * Used for offloading time-consuming operations, such as generating AI replies.
 */
export interface IReplyTaskQueueRepository {
    /**
     * Enqueues a background task to process and reply to a specific mention.
     * 
     * @param payload - The core data required to process the reply, including tweet ID, content, and author.
     * @param delaySeconds - An optional delay in seconds before the task becomes available for processing.
     * @returns A Promise that resolves once the task has been successfully enqueued.
     */
    enqueueReplyTask(payload: { tweetId: string, text: string, authorId: string }, delaySeconds?: number): Promise<void>;
}
