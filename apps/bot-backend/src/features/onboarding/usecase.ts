import { UpstreamApiError, XApiFollowersResponse, XApiUser } from '@rebecca/types';
import { AppDependencies } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Configuration required for stealth onboarding execution.
 */
export interface StealthOnboardingConfig {
  myUserId?: string;
  targetListId?: string;
  followersPageSize: number;
  followersMaxResults: number;
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

      const targetListId = this.config.targetListId?.trim() || undefined;
      if (!targetListId) {
        logger.warn(
          '[StealthOnboardingUseCase] X_TARGET_LIST_ID is not set. List addition and failed-list retries are disabled; continuing follower ingestion with SKIPPED status.',
        );
      }

      // 1. Retry list addition for previously FAILED followers only when list curation is enabled
      const retriedCount = targetListId ? await this.retryFailedFollowers(targetListId) : 0;

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
          if (retryErr instanceof UpstreamApiError && retryErr.statusCode === 403) {
            await this.deps.firestore.updateFollowerListStatus(failed.userId, 'REJECTED');
            logger.info('[StealthOnboardingUseCase] Self-healing retry for follower got 403: transitioned to REJECTED', {
              userId: failed.userId,
            });
          } else if (retryErr instanceof UpstreamApiError && retryErr.statusCode === 429) {
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
   * Fetches new followers paginated from X API and ingests eligible followers.
   * When `targetListId` is omitted, followers are recorded as `SKIPPED` without calling X list APIs.
   */
  private async ingestNewFollowers(myUserId: string, targetListId?: string): Promise<number> {
    const pageSize = this.config.followersPageSize;
    const maxResults = this.config.followersMaxResults;

    let processedCount = 0;
    let fetchedCount = 0;
    let nextToken: string | undefined = undefined;
    while (fetchedCount < maxResults) {
      const batchLimit = Math.min(pageSize, maxResults - fetchedCount);
      let followersResp: XApiFollowersResponse;
      try {
        followersResp = await this.deps.xApi.getFollowers(myUserId, nextToken, batchLimit);
      } catch (fetchErr: unknown) {
        if (fetchErr instanceof UpstreamApiError && fetchErr.statusCode === 429) {
          logger.warn(
            '[StealthOnboardingUseCase] X API rate limit (429) reached during follower ingestion. Stopping pagination cleanly with partial progress',
            { fetchedCount, processedCount },
          );
          break;
        }
        throw fetchErr;
      }

      const followers = followersResp.data ?? [];
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
        } else {
          batchHasNewFollower = true;
          const processed = await this.processNewFollower(follower, targetListId);
          if (processed) {
            processedCount++;
          }
        }

        if (fetchedCount >= maxResults) {
          break;
        }
      }

      nextToken = followersResp.meta?.nextToken;
      if (fetchedCount >= maxResults) {
        if (nextToken && batchHasNewFollower) {
          logger.warn('[StealthOnboardingUseCase] Reached maximum followers fetch limit before exhausting pagination', {
            maxResults,
            fetchedCount,
          });
        } else {
          logger.info('[StealthOnboardingUseCase] Reached maximum followers fetch limit. Stopping batch', {
            maxResults,
          });
        }
        break;
      }

      if (!batchHasNewFollower) {
        logger.info('[StealthOnboardingUseCase] All followers in current batch already processed. Stopping fetch');
        break;
      }

      if (!nextToken) {
        logger.info('[StealthOnboardingUseCase] No nextToken found. Reached end of followers list');
        break;
      }
    }

    return processedCount;
  }

  /**
   * Processes a single newly detected follower, optionally adding them to the curated X list.
   * Returns true if the follower was newly onboarded (`ADDED` or `SKIPPED`), false otherwise.
   */
  private async processNewFollower(follower: XApiUser, targetListId?: string): Promise<boolean> {
    logger.info('[StealthOnboardingUseCase] New follower detected', {
      userId: follower.id,
      username: follower.username,
    });
    const userDoc = await this.deps.firestore.getUserDoc(follower.id);
    if (userDoc?.status === 'BLOCKED') {
      logger.info('[StealthOnboardingUseCase] Follower is blocked by admin. Skipping onboarding', {
        userId: follower.id,
        username: follower.username,
      });
      await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
      return false;
    }

    if (!targetListId) {
      await this.deps.firestore.markFollowerProcessed(follower.id, 'SKIPPED');
      logger.info('[StealthOnboardingUseCase] New follower recorded without list addition (SKIPPED)', {
        userId: follower.id,
        username: follower.username,
      });
      return true;
    }

    try {
      const added = await this.deps.xApi.addListMember(targetListId, follower.id);
      if (added) {
        await this.deps.firestore.markFollowerProcessed(follower.id, 'ADDED');
        logger.info('[StealthOnboardingUseCase] Successfully onboarded (added to list)', {
          userId: follower.id,
          username: follower.username,
        });
        return true;
      }
      logger.error('[StealthOnboardingUseCase] Failed to add user to list: addListMember returned false', undefined, {
        userId: follower.id,
        username: follower.username,
      });
      await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
      return false;
    } catch (listErr: unknown) {
      if (listErr instanceof UpstreamApiError && listErr.statusCode === 403) {
        logger.info('[StealthOnboardingUseCase] Follower rejected list addition (403). Marking REJECTED', {
          userId: follower.id,
          username: follower.username,
        });
        await this.deps.firestore.markFollowerProcessed(follower.id, 'REJECTED');
      } else if (listErr instanceof UpstreamApiError && listErr.statusCode === 429) {
        logger.warn('[StealthOnboardingUseCase] X API rate limit (429) adding follower to list. Marking FAILED', {
          userId: follower.id,
          username: follower.username,
        });
        await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
      } else {
        logger.error('[StealthOnboardingUseCase] Error adding follower to list. Marking FAILED', listErr, {
          userId: follower.id,
          username: follower.username,
        });
        await this.deps.firestore.markFollowerProcessed(follower.id, 'FAILED');
      }
      return false;
    }
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
