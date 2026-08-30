import { AppDependencies } from '../../types';
import config from '../../config';

/**
 * Use case for onboarding new followers by stealthily adding them to a target list.
 * Responsible for fetching followers, checking processing status, and updating list membership.
 */
export class StealthOnboardingUseCase {
  /**
   * Initializes the use case with application dependencies.
   * 
   * @param deps The application dependencies.
   */
  constructor(private deps: AppDependencies) {}
    
  /**
   * Executes the stealth onboarding background job.
   * Checks for new followers, marks them as processed, and adds them to a target list.
   * 
   * @returns A promise resolving to an object containing the execution status, the count of processed users, and optionally a reason for failure.
   */
  async execute(): Promise<{ status: string; processed: number; reason?: string }> {
    console.log('Starting Stealth Onboarding Batch...');
    try {
      const myUserId = config.xApi.myUserId || this.deps.xApi.cachedNumericMyUserId;
      if (!myUserId) {
        console.error('X_MY_USER_ID is not set and could not be resolved.');
        return { status: 'failed', processed: 0, reason: 'Missing X_MY_USER_ID' };
      }

      const targetListId = config.xApi.targetListId;
      if (!targetListId) {
        console.error('X_TARGET_LIST_ID is not set in config.');
        return { status: 'failed', processed: 0, reason: 'Missing X_TARGET_LIST_ID' };
      }

      const pageSize = config.xApi.followersPageSize || 10;
      const maxResults = config.xApi.followersMaxResults || 50;

      let processedCount = 0;
      let fetchedCount = 0;
      let nextToken: string | undefined = undefined;
      let keepFetching = true;

      while (keepFetching && fetchedCount < maxResults) {
        const batchLimit = Math.min(pageSize, maxResults - fetchedCount);
        const followersResp = await this.deps.xApi.getFollowers(myUserId, nextToken, batchLimit);
        const followers = followersResp.data || [];
        
        if (followers.length === 0) {
          console.log('No more followers retrieved.');
          break;
        }

        for (const follower of followers) {
          fetchedCount++;
          const hasProcessed = await this.deps.firestore.hasProcessedFollower(follower.id);
          if (hasProcessed) {
            console.log(`Reached already processed follower: ${follower.username}. Stopping fetch.`);
            keepFetching = false;
            break;
          }

          console.log(`New follower detected: ${follower.username} (${follower.id})`);
          const userDoc = await this.deps.firestore.getUserDoc(follower.id);
          if (userDoc?.status === 'BLOCKED') {
            console.log(`Follower @${follower.username} (${follower.id}) is blocked by admin. Skipping list addition.`);
            await this.deps.firestore.markFollowerProcessed(follower.id);
            if (fetchedCount >= maxResults) {
              keepFetching = false;
              break;
            }
            continue;
          }
          const added = await this.deps.xApi.addListMember(targetListId, follower.id);
          if (added) {
            await this.deps.firestore.markFollowerProcessed(follower.id);
            console.log(`Successfully onboarded (added to list): ${follower.username}`);
            processedCount++;
          } else {
            console.error(`Failed to add ${follower.username} to list.`);
          }

          if (fetchedCount >= maxResults) {
            console.log(`Reached maximum followers fetch limit of ${maxResults}. Stopping batch.`);
            keepFetching = false;
            break;
          }
        }

        if (keepFetching) {
          nextToken = followersResp.meta?.nextToken;
          if (!nextToken) {
            console.log('No nextToken found. Reached end of followers list.');
            break;
          }
        }
      }

      console.log(`Stealth Onboarding Batch completed. Processed ${processedCount} new followers.`);
      try {
        const totalCount = await this.deps.firestore.getProcessedFollowersCount();
        if (totalCount > 0) {
          await this.deps.firestore.updateTotalFollowers(totalCount);
          console.log(`Updated global systemStats total_followers to ${totalCount}`);
        }
      } catch (statsErr) {
        console.error('Failed to update systemStats total_followers:', statsErr);
      }
      return { status: 'success', processed: processedCount };
    } catch (e) {
      console.error('Error in StealthOnboardingUseCase.execute:', e);
      throw e;
    }
  }
}
