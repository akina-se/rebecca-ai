import type { XApiMentionResponse } from '@rebecca/types';

/**
 * Interface for managing the persistent state of mentions polling.
 */
export interface IMentionsStateRepository {
    /**
     * Retrieves the ID of the last processed mention.
     * @returns A promise that resolves to the last mention ID, or null if none exists.
     */
    getLastMentionId(): Promise<string | null>;
    /**
     * Updates the persistent state with the ID of the last processed mention.
     * @param mentionId The ID of the most recently processed mention.
     * @returns A promise that resolves when the operation completes.
     */
    setLastMentionId(mentionId: string): Promise<void>;
}

/**
 * Interface for communicating with the social platform to fetch mentions.
 */
export interface IMentionsPlatformRepository {
    /**
     * Fetches mentions from the social platform.
     * @param sinceId Optional ID to fetch mentions that occurred after this specific ID.
     * @returns A promise resolving to the API response containing the mentions.
     */
    getMentions(sinceId?: string): Promise<XApiMentionResponse>;
}

/**
 * Interface for enqueuing async background tasks.
 */
export interface IReplyTaskQueueRepository {
    /**
     * Enqueues a background task to reply to a specific mention.
     * @param payload The data necessary to execute the reply task (tweetId, text, authorId).
     * @param delaySeconds Optional delay in seconds before the task should be processed.
     * @returns A promise that resolves when the task has been enqueued.
     */
    enqueueReplyTask(payload: { tweetId: string, text: string, authorId: string }, delaySeconds?: number): Promise<void>;
}
