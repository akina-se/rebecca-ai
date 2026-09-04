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
  constructor(private deps: AppDependencies) { }

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

      // -----------------------------------------------------------------------
      // Phase 1: Self-Healing Retry for previously FAILED followers
      // -----------------------------------------------------------------------
      try {
        const failedFollowers = await this.deps.firestore.getFailedFollowers(10);
        if (failedFollowers.length > 0) {
          console.log(`Found ${failedFollowers.length} previously FAILED followers. Retrying list addition...`);
          for (const failed of failedFollowers) {
            try {
              const added = await this.deps.xApi.addListMember(targetListId, failed.userId);
              if (added) {
                await this.deps.firestore.updateFollowerListStatus(failed.userId, 'ADDED');
                console.log(`Self-healing retry succeeded for follower (${failed.userId}): transitioned to ADDED.`);
                processedCount++;
              }
            } catch (retryErr: unknown) {
              const errStr = String(retryErr);
              if (errStr.includes('"status":403') || errStr.includes('Forbidden')) {
                await this.deps.firestore.updateFollowerListStatus(failed.userId, 'REJECTED');
                console.log(`Self-healing retry for follower (${failed.userId}) got 403: transitioned to REJECTED.`);
              } else if (errStr.includes('"status":429') || errStr.includes('Too Many Requests')) {
                console.warn(`X API rate limit (429) encountered during self-healing retry. Halting retry phase.`);
                break;
              } else {
                console.error(`Self-healing retry error for follower (${failed.userId}):`, retryErr);
              }
            }
          }
        }
      } catch (retryPhaseErr) {
        console.error('Error during self-healing retry phase:', retryPhaseErr);
      }

      // -----------------------------------------------------------------------
      // Phase 2: Ingest New Followers (Paginated)
      // -----------------------------------------------------------------------
      const pageSize = config.xApi.followersPageSize || 10;
      const maxResults = config.xApi.followersMaxResults || 50;

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

        let batchHasNewFollower = false;

        for (const follower of followers) {
          fetchedCount++;
          const hasProcessed = await this.deps.firestore.hasProcessedFollower(follower.id);
          if (hasProcessed) {
            console.log(`Follower @${follower.username} (${follower.id}) already processed. Skipping.`);
            if (fetchedCount >= maxResults) {
              console.log(`Reached maximum followers fetch limit of ${maxResults}. Stopping batch.`);
              keepFetching = false;
              break;
            }
            continue;
          }

          batchHasNewFollower = true;
          console.log(`New follower detected: ${follower.username} (${follower.id})`);
          const userDoc = await this.deps.firestore.getUserDoc(follower.id);
          if (userDoc?.status === 'BLOCKED') {
            console.log(`Follower @${follower.username} (${follower.id}) is blocked by admin. Skipping list addition.`);
            await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
            if (fetchedCount >= maxResults) {
              console.log(`Reached maximum followers fetch limit of ${maxResults}. Stopping batch.`);
              keepFetching = false;
              break;
            }
            continue;
          }

          try {
            const added = await this.deps.xApi.addListMember(targetListId, follower.id);
            if (added) {
              await this.deps.firestore.markFollowerProcessed(follower.id, 'ADDED');
              console.log(`Successfully onboarded (added to list): ${follower.username}`);
              processedCount++;
            } else {
              console.error(`Failed to add ${follower.username} to list: addListMember returned false.`);
              await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
            }
          } catch (listErr: unknown) {
            const errStr = String(listErr);
            if (errStr.includes('"status":403') || errStr.includes('Forbidden')) {
              console.log(`Follower @${follower.username} (${follower.id}) rejected list addition (403). Marking REJECTED.`);
              await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
            } else {
              console.error(`Error adding follower @${follower.username} (${follower.id}) to list. Marking FAILED:`, listErr);
              await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
            }
          }

          if (fetchedCount >= maxResults) {
            console.log(`Reached maximum followers fetch limit of ${maxResults}. Stopping batch.`);
            keepFetching = false;
            break;
          }
        }

        if (!batchHasNewFollower) {
          console.log('All followers in the current batch have already been processed. Stopping fetch.');
          keepFetching = false;
          break;
        }

        if (keepFetching) {
          nextToken = followersResp.meta?.nextToken || followersResp.meta?.next_token;
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
