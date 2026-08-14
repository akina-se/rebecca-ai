import config from '../../config';
import { AppDependencies } from '../../types';

/**
 * Implements the core business logic for polling new mentions and delegating reply tasks.
 * It coordinates fetching mentions from the platform, filtering them, and enqueuing background workers.
 */
export class PollMentionsUseCase {
    /**
     * Instantiates the PollMentionsUseCase with required application dependencies.
     * 
     * @param deps - A container holding the required repositories and external platform APIs.
     */
    constructor(
        private deps: AppDependencies
    ) {}

    /**
     * Executes the polling workflow. Retrieves new mentions since the last recorded ID,
     * enqueues asynchronous reply tasks, and updates the persistent high-water mark.
     * 
     * @returns A Promise resolving to an object containing the total count of newly processed mentions 
     *          and the newest encountered mention ID (if any).
     */
    async execute(): Promise<{ count: number, newestId?: string }> {
        console.log("Polling mentions from X API...");
        const sinceId = await this.deps.firestore.getLastMentionId();
        
        const mentionsRes = await this.deps.xApi.getMentions(sinceId || undefined);
        
        if (!mentionsRes.data || mentionsRes.data.length === 0) {
            console.log("No new mentions found.");
            return { count: 0 };
        }

        console.log(`Found ${mentionsRes.data.length} new mentions.`);
        let newestId = sinceId;

        for (const tweet of mentionsRes.data) {
            const tweetId = tweet.id;
            const text = tweet.text;
            const authorId = tweet.authorId;

            if (!newestId || BigInt(tweetId) > BigInt(newestId)) {
                newestId = tweetId;
            }

            if (!authorId) {
                console.warn(`Could not determine author ID for tweet ${tweetId}. Tweet object:`, JSON.stringify(tweet));
                continue;
            }

            if (authorId === config.xApi.myUserId) {
                console.log(`Ignoring self-mention ${tweetId}`);
                continue;
            }

            try {
                // Enqueue with intentional delay (60 to 180 seconds) to seem more human-like
                const delaySeconds = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
                await this.deps.tasks.enqueueReplyTask({
                    tweetId,
                    text,
                    authorId
                }, delaySeconds);
                console.log(`Enqueued mention ${tweetId} from ${authorId}`);
            } catch (e) {
                console.error(`Failed to enqueue task for mention ${tweetId}`, e);
            }
        }

        if (newestId && newestId !== sinceId) {
            await this.deps.firestore.setLastMentionId(newestId);
            console.log(`Updated last_mention_id to ${newestId}`);
        }

        return { count: mentionsRes.data.length, newestId: newestId || undefined };
    }
}
