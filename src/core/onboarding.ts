import * as xApi from '../services/xApi';
import * as firestore from '../services/firestore';
import config from '../config';

/**
 * Executes a background job to onboard new followers by stealthily adding them to a target list.
 * 
 * @returns A promise resolving to an object containing the status and the count of processed users.
 */
const runStealthOnboardingBatch = async (): Promise<{ status: string; processed: number; reason?: string }> => {
    console.log("Starting Stealth Onboarding Batch...");
    try {
        const myUserId = config.xApi.myUserId || xApi.cachedNumericMyUserId;
        if (!myUserId) {
            console.error('X_MY_USER_ID is not set and could not be resolved.');
            return { status: 'failed', processed: 0, reason: 'Missing X_MY_USER_ID' };
        }

        const targetListId = config.xApi.targetListId;
        if (!targetListId) {
            console.error('X_TARGET_LIST_ID is not set in config.');
            return { status: 'failed', processed: 0, reason: 'Missing X_TARGET_LIST_ID' };
        }

        const followersResp = await xApi.getFollowers(myUserId);
        const followers = followersResp.data || [];
        
        if (followers.length === 0) {
            console.log("No followers retrieved or list is empty.");
            return { status: 'success', processed: 0 };
        }

        let processedCount = 0;

        for (const follower of followers) {
            const hasProcessed = await firestore.hasProcessedFollower(follower.id);
            if (!hasProcessed) {
                console.log(`New follower detected: ${follower.username} (${follower.id})`);
                const added = await xApi.addListMember(targetListId, follower.id);
                if (added) {
                    await firestore.markFollowerProcessed(follower.id);
                    console.log(`Successfully onboarded (added to list): ${follower.username}`);
                    processedCount++;
                } else {
                    console.error(`Failed to add ${follower.username} to list.`);
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
