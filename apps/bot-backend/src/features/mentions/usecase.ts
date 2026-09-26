import { AppDependencies } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Configuration required for mention polling.
 */
export interface PollMentionsConfig {
    myUserId?: string;
}

/**
 * Implements the core business logic for polling new mentions and delegating reply tasks.
 * It coordinates fetching mentions from the platform, filtering them, and enqueuing background workers.
 */
export class PollMentionsUseCase {
    /**
     * Instantiates the PollMentionsUseCase with required application dependencies and config.
     * 
     * @param deps - A container holding the required repositories and external platform APIs.
     * @param config - Configuration options including the bot's own user ID.
     */
    constructor(
        private readonly deps: AppDependencies,
        private readonly config: PollMentionsConfig,
    ) {}

    /**
     * Executes the polling workflow. Retrieves new mentions since the last recorded ID,
     * enqueues asynchronous reply tasks, and updates the persistent high-water mark.
     * 
     * @returns A Promise resolving to an object containing the total count of newly processed mentions 
     *          and the newest encountered mention ID (if any).
     */
    async execute(): Promise<{ count: number, newestId?: string }> {
        logger.info('[PollMentionsUseCase] Polling mentions from X API');
        const sinceId = await this.deps.firestore.getLastMentionId();
        
        const mentionsRes = await this.deps.xApi.getMentions(sinceId || undefined);
        
        if (!mentionsRes.data || mentionsRes.data.length === 0) {
            logger.info('[PollMentionsUseCase] No new mentions found');
            return { count: 0 };
        }

        logger.info('[PollMentionsUseCase] Found new mentions', { count: mentionsRes.data.length });
        let newestId = sinceId;

        for (const tweet of mentionsRes.data) {
            const tweetId = tweet.id;
            const text = tweet.text;
            const authorId = tweet.authorId;

            if (!newestId || BigInt(tweetId) > BigInt(newestId)) {
                newestId = tweetId;
            }

            if (!authorId) {
                logger.warn('[PollMentionsUseCase] Could not determine author ID for tweet', {
                    tweetId,
                    tweet: JSON.stringify(tweet),
                });
                continue;
            }

            if (authorId === this.config.myUserId) {
                logger.info('[PollMentionsUseCase] Ignoring self-mention', { tweetId });
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
                logger.info('[PollMentionsUseCase] Enqueued mention task', { tweetId, authorId });
            } catch (e) {
                logger.error('[PollMentionsUseCase] Failed to enqueue task for mention', e, { tweetId });
            }
        }

        if (newestId && newestId !== sinceId) {
            await this.deps.firestore.setLastMentionId(newestId);
            logger.info('[PollMentionsUseCase] Updated last_mention_id', { newestId });
        }

        return { count: mentionsRes.data.length, newestId: newestId || undefined };
    }
}
