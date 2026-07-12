import { AppDependencies } from '../types';
import config from '../config';

/**
 * Executes a background job to onboard new followers by stealthily adding them to a target list.
 * 
 * @returns A promise resolving to an object containing the status and the count of processed users.
 */
const runStealthOnboardingBatch = async (deps: AppDependencies): Promise<{ status: string; processed: number; reason?: string }> => {
    console.log("Starting Stealth Onboarding Batch...");
    try {
        const myUserId = config.xApi.myUserId || deps.xApi.cachedNumericMyUserId;
        if (!myUserId) {
            console.error('X_MY_USER_ID is not set and could not be resolved.');
            return { status: 'failed', processed: 0, reason: 'Missing X_MY_USER_ID' };
        }

        const targetListId = config.xApi.targetListId;
        if (!targetListId) {
            console.error('X_TARGET_LIST_ID is not set in config.');
            return { status: 'failed', processed: 0, reason: 'Missing X_TARGET_LIST_ID' };
        }

        let processedCount = 0;
        let nextToken: string | undefined = undefined;
        let keepFetching = true;

        while (keepFetching) {
            const followersResp = await deps.xApi.getFollowers(myUserId, nextToken);
            const followers = followersResp.data || [];
            
            if (followers.length === 0) {
                console.log("No more followers retrieved.");
                break;
            }

            for (const follower of followers) {
                const hasProcessed = await deps.firestore.hasProcessedFollower(follower.id);
                if (hasProcessed) {
                    console.log(`Reached already processed follower: ${follower.username}. Stopping fetch.`);
                    keepFetching = false;
                    break; // break the for-loop
                }

                console.log(`New follower detected: ${follower.username} (${follower.id})`);
                const added = await deps.xApi.addListMember(targetListId, follower.id);
                if (added) {
                    await deps.firestore.markFollowerProcessed(follower.id);
                    console.log(`Successfully onboarded (added to list): ${follower.username}`);
                    processedCount++;
                } else {
                    console.error(`Failed to add ${follower.username} to list.`);
                }
            }

            if (keepFetching) {
                nextToken = followersResp.meta?.next_token;
                if (!nextToken) {
                    console.log("No next_token found. Reached end of followers list.");
                    break; // no more pages
                }
            }
        }

        console.log(`Stealth Onboarding Batch completed. Processed ${processedCount} new followers.`);
        return { status: 'success', processed: processedCount };
    } catch (e) {
        console.error("Error in runStealthOnboardingBatch:", e);
        throw e;
    }
};

export {
    runStealthOnboardingBatch
};
