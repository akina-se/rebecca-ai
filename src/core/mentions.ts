import config from '../config';
import { AppDependencies } from '../types';

/**
 * Polls the X API for new mentions and enqueues tasks to reply to them.
 *
 * @returns {Promise<{count: number, newestId?: string}>} An object containing the count of new mentions and the ID of the newest mention.
 */
export const pollMentions = async (deps: AppDependencies) => {
    try {
        console.log("Polling mentions from X API...");
        const sinceId = await deps.firestore.getLastMentionId();
        const mentionsRes = await deps.xApi.getMentions(sinceId || undefined);
        
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

            // Update newestId
            if (!newestId || BigInt(tweetId) > BigInt(newestId)) {
                newestId = tweetId;
            }

            if (!authorId) {
                console.warn(`Could not determine author ID for tweet ${tweetId}. Tweet object:`, JSON.stringify(tweet));
                continue;
            }

            // Ignore self-mentions
            if (authorId === config.xApi.myUserId) {
                console.log(`Ignoring self-mention ${tweetId}`);
                continue;
            }

            try {
                // Enqueue with intentional delay (60 to 180 seconds)
                const delaySeconds = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
                await deps.tasks.enqueueReplyTask({
                    tweetId,
                    text,
                    authorId
                }, delaySeconds);
                console.log(`Enqueued mention ${tweetId} from ${authorId}`);
            } catch (e) {
                console.error(`Failed to enqueue task for mention ${tweetId}`, e);
            }
        }

        // Save the newest mention ID to avoid fetching them again
        if (newestId && newestId !== sinceId) {
            await deps.firestore.setLastMentionId(newestId);
            console.log(`Updated last_mention_id to ${newestId}`);
        }

        return { count: mentionsRes.data.length, newestId };
    } catch (error) {
        console.error("Error during pollMentions:", error);
        throw error;
    }
};
