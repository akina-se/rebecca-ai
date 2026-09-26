import { AppDependencies } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Configuration required for stealth onboarding execution.
 */
export interface StealthOnboardingConfig {
  myUserId?: string;
  targetListId?: string;
  followersPageSize?: number;
  followersMaxResults?: number;
}

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
  constructor(
    private readonly deps: AppDependencies,
    private readonly config: StealthOnboardingConfig,
  ) {}

  /**
   * Executes the stealth onboarding background workflow.
   */
  async execute(): Promise<OnboardingResult> {
    logger.info('[StealthOnboardingUseCase] Starting Stealth Onboarding Batch');
    try {
      const myUserId = this.config.myUserId;
      if (!myUserId) {
        logger.error('[StealthOnboardingUseCase] X_MY_USER_ID is not set in config');
        return { status: 'failed', processed: 0, reason: 'Missing X_MY_USER_ID' };
      }

      const targetListId = this.config.targetListId;
      if (!targetListId) {
        logger.error('[StealthOnboardingUseCase] X_TARGET_LIST_ID is not set in config');
        return { status: 'failed', processed: 0, reason: 'Missing X_TARGET_LIST_ID' };
      }

      // 1. Retry list addition for previously FAILED followers
      const retriedCount = await this.retryFailedFollowers(targetListId);

      // 2. Ingest new followers with pagination
      const ingestedCount = await this.ingestNewFollowers(myUserId, targetListId);

      const totalProcessed = retriedCount + ingestedCount;
      logger.info('[StealthOnboardingUseCase] Stealth Onboarding Batch completed', {
        totalProcessed,
        retriedCount,
        ingestedCount,
      });

      await this.syncTotalFollowersCount();

      return { status: 'success', processed: totalProcessed };
    } catch (e) {
      logger.error('[StealthOnboardingUseCase] Error in StealthOnboardingUseCase.execute', e);
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

      logger.info('[StealthOnboardingUseCase] Found previously FAILED followers. Retrying list addition', {
        count: failedFollowers.length,
      });
      for (const failed of failedFollowers) {
        try {
          const added = await this.deps.xApi.addListMember(targetListId, failed.userId);
          if (added) {
            await this.deps.firestore.updateFollowerListStatus(failed.userId, 'ADDED');
            logger.info('[StealthOnboardingUseCase] Self-healing retry succeeded for follower: transitioned to ADDED', {
              userId: failed.userId,
            });
            retriedCount++;
          }
        } catch (retryErr: unknown) {
          const errStr = String(retryErr);
          if (errStr.includes('"status":403')) {
            await this.deps.firestore.updateFollowerListStatus(failed.userId, 'REJECTED');
            logger.info('[StealthOnboardingUseCase] Self-healing retry for follower got 403: transitioned to REJECTED', {
              userId: failed.userId,
            });
          } else if (errStr.includes('"status":429')) {
            logger.warn('[StealthOnboardingUseCase] X API rate limit (429) encountered during self-healing retry. Halting retry phase');
            break;
          } else {
            logger.error('[StealthOnboardingUseCase] Self-healing retry error for follower', retryErr, {
              userId: failed.userId,
            });
          }
        }
      }
    } catch (retryPhaseErr) {
      logger.error('[StealthOnboardingUseCase] Error during self-healing retry phase', retryPhaseErr);
    }
    return retriedCount;
  }

  /**
   * Fetches new followers paginated from X API and adds eligible followers to the curated list.
   */
  private async ingestNewFollowers(myUserId: string, targetListId: string): Promise<number> {
    const pageSize = this.config.followersPageSize ?? 10;
    const maxResults = this.config.followersMaxResults ?? 30;

    let processedCount = 0;
    let fetchedCount = 0;
    let nextToken: string | undefined = undefined;
    while (fetchedCount < maxResults) {
      const batchLimit = Math.min(pageSize, maxResults - fetchedCount);
      const followersResp = await this.deps.xApi.getFollowers(myUserId, nextToken, batchLimit);
      const followers = followersResp.data || [];

      if (followers.length === 0) {
        logger.info('[StealthOnboardingUseCase] No more followers retrieved');
        break;
      }

      let batchHasNewFollower = false;

      for (const follower of followers) {
        fetchedCount++;
        const hasProcessed = await this.deps.firestore.hasProcessedFollower(follower.id);
        if (hasProcessed) {
          logger.info('[StealthOnboardingUseCase] Follower already processed. Skipping', {
            userId: follower.id,
            username: follower.username,
          });
          if (fetchedCount >= maxResults) {
            logger.info('[StealthOnboardingUseCase] Reached maximum followers fetch limit. Stopping batch', {
              maxResults,
            });
            break;
          }
          continue;
        }

        batchHasNewFollower = true;
        logger.info('[StealthOnboardingUseCase] New follower detected', {
          userId: follower.id,
          username: follower.username,
        });
        const userDoc = await this.deps.firestore.getUserDoc(follower.id);
        if (userDoc?.status === 'BLOCKED') {
          logger.info('[StealthOnboardingUseCase] Follower is blocked by admin. Skipping list addition', {
            userId: follower.id,
            username: follower.username,
          });
          await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
          if (fetchedCount >= maxResults) {
            logger.info('[StealthOnboardingUseCase] Reached maximum followers fetch limit. Stopping batch', {
              maxResults,
            });
            break;
          }
          continue;
        }

        try {
          const added = await this.deps.xApi.addListMember(targetListId, follower.id);
          if (added) {
            await this.deps.firestore.markFollowerProcessed(follower.id, 'ADDED');
            logger.info('[StealthOnboardingUseCase] Successfully onboarded (added to list)', {
              userId: follower.id,
              username: follower.username,
            });
            processedCount++;
          } else {
            logger.error('[StealthOnboardingUseCase] Failed to add user to list: addListMember returned false', undefined, {
              userId: follower.id,
              username: follower.username,
            });
            await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
          }
        } catch (listErr: unknown) {
          const errStr = String(listErr);
          if (errStr.includes('"status":403')) {
            logger.info('[StealthOnboardingUseCase] Follower rejected list addition (403). Marking REJECTED', {
              userId: follower.id,
              username: follower.username,
            });
            await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
          } else {
            logger.error('[StealthOnboardingUseCase] Error adding follower to list. Marking FAILED', listErr, {
              userId: follower.id,
              username: follower.username,
            });
            await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
          }
        }

        if (fetchedCount >= maxResults) {
          logger.info('[StealthOnboardingUseCase] Reached maximum followers fetch limit. Stopping batch', {
            maxResults,
          });
          break;
        }
      }

      if (fetchedCount >= maxResults) {
        break;
      }

      if (!batchHasNewFollower) {
        logger.info('[StealthOnboardingUseCase] All followers in current batch already processed. Stopping fetch');
        break;
      }

      nextToken = followersResp.meta?.next_token;
      if (!nextToken) {
        logger.info('[StealthOnboardingUseCase] No nextToken found. Reached end of followers list');
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
        logger.info('[StealthOnboardingUseCase] Updated global systemStats total_followers', { totalCount });
      }
    } catch (statsErr) {
      logger.error('[StealthOnboardingUseCase] Failed to update systemStats total_followers', statsErr);
    }
  }
}
