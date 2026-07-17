import config from '../../config';
import { AppDependencies } from '../../types';

/**
 * UseCase for polling new mentions and dispatching reply tasks.
 * Encapsulates the core business logic independent of external frameworks.
 */
export class PollMentionsUseCase {
    /**
     * Initializes the PollMentionsUseCase.
     * @param deps Application dependencies including repositories and external APIs.
     */
    constructor(
        private deps: AppDependencies
    ) {}

    /**
     * Executes the polling of mentions, enqueues replies for new mentions, 
     * and updates the last processed mention ID.
     * @returns A promise resolving to an object containing the count of processed mentions and optionally the newest mention ID.
     */
    async execute(): Promise<{ count: number, newestId?: string }> {
        console.log("Polling mentions from X API...");
        const sinceId = await this.deps.firestore.getLastMentionId();
        
        // Ensure we pass undefined instead of null to the platform repo
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
