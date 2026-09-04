import { AppDependencies } from '../../types';
import config from '../../config';

/**
 * Execution result for the stealth onboarding process.
 */
export interface OnboardingResult {
  status: 'success' | 'failed';
  processed: number;
  reason?: string;
}

/**
 * Use case for onboarding new followers by stealthily adding them to a target list.
 * Orchestrates self-healing retries for previously failed followers and paginated ingestion of new followers.
 */
export class StealthOnboardingUseCase {
  constructor(private deps: AppDependencies) {}

  /**
   * Executes the stealth onboarding background workflow.
   */
  async execute(): Promise<OnboardingResult> {
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

      // 1. Retry list addition for previously FAILED followers
      const retriedCount = await this.retryFailedFollowers(targetListId);

      // 2. Ingest new followers with pagination
      const ingestedCount = await this.ingestNewFollowers(myUserId, targetListId);

      const totalProcessed = retriedCount + ingestedCount;
      console.log(`Stealth Onboarding Batch completed. Processed ${totalProcessed} followers (Retried: ${retriedCount}, New: ${ingestedCount}).`);

      await this.syncTotalFollowersCount();

      return { status: 'success', processed: totalProcessed };
    } catch (e) {
      console.error('Error in StealthOnboardingUseCase.execute:', e);
      throw e;
    }
  }

  /**
   * Performs self-healing retries on followers whose list addition previously failed.
   */
  private async retryFailedFollowers(targetListId: string): Promise<number> {
    let retriedCount = 0;
    try {
      const failedFollowers = await this.deps.firestore.getFailedFollowers(10);
      if (failedFollowers.length === 0) {
        return 0;
      }

      console.log(`Found ${failedFollowers.length} previously FAILED followers. Retrying list addition...`);
      for (const failed of failedFollowers) {
        try {
          const added = await this.deps.xApi.addListMember(targetListId, failed.userId);
          if (added) {
            await this.deps.firestore.updateFollowerListStatus(failed.userId, 'ADDED');
            console.log(`Self-healing retry succeeded for follower (${failed.userId}): transitioned to ADDED.`);
            retriedCount++;
          }
        } catch (retryErr: unknown) {
          const errStr = String(retryErr);
          if (errStr.includes('"status":403')) {
            await this.deps.firestore.updateFollowerListStatus(failed.userId, 'REJECTED');
            console.log(`Self-healing retry for follower (${failed.userId}) got 403: transitioned to REJECTED.`);
          } else if (errStr.includes('"status":429')) {
            console.warn('X API rate limit (429) encountered during self-healing retry. Halting retry phase.');
            break;
          } else {
            console.error(`Self-healing retry error for follower (${failed.userId}):`, retryErr);
          }
        }
      }
    } catch (retryPhaseErr) {
      console.error('Error during self-healing retry phase:', retryPhaseErr);
    }
    return retriedCount;
  }

  /**
   * Fetches new followers paginated from X API and adds eligible followers to the curated list.
   */
  private async ingestNewFollowers(myUserId: string, targetListId: string): Promise<number> {
    const pageSize = config.xApi.followersPageSize || 10;
    const maxResults = config.xApi.followersMaxResults || 50;

    let processedCount = 0;
    let fetchedCount = 0;
    let nextToken: string | undefined = undefined;
    while (fetchedCount < maxResults) {
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
          if (errStr.includes('"status":403')) {
            console.log(`Follower @${follower.username} (${follower.id}) rejected list addition (403). Marking REJECTED.`);
            await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
          } else {
            console.error(`Error adding follower @${follower.username} (${follower.id}) to list. Marking FAILED:`, listErr);
            await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
          }
        }

        if (fetchedCount >= maxResults) {
          console.log(`Reached maximum followers fetch limit of ${maxResults}. Stopping batch.`);
          break;
        }
      }

      if (fetchedCount >= maxResults) {
        break;
      }

      if (!batchHasNewFollower) {
        console.log('All followers in the current batch have already been processed. Stopping fetch.');
        break;
      }

      nextToken = followersResp.meta?.next_token;
      if (!nextToken) {
        console.log('No nextToken found. Reached end of followers list.');
        break;
      }
    }

    return processedCount;
  }

  /**
   * Synchronizes the total processed followers count with systemStats in Firestore.
   */
  private async syncTotalFollowersCount(): Promise<void> {
    try {
      const totalCount = await this.deps.firestore.getProcessedFollowersCount();
      if (totalCount > 0) {
        await this.deps.firestore.updateTotalFollowers(totalCount);
        console.log(`Updated global systemStats total_followers to ${totalCount}`);
      }
    } catch (statsErr) {
      console.error('Failed to update systemStats total_followers:', statsErr);
    }
  }
}
