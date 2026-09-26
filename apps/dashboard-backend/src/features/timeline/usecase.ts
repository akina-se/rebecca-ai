import { TimelineRepository } from './repository';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert, PaginationMeta } from '@rebecca/types';
import { deleteTweetViaGrpc } from '../../core/grpcClient';
import { logger } from '../../utils/logger';

/**
 * Contains business logic and orchestrates operations related to the timeline and system metrics.
 * Coordinates between the repository for data access and external services (like gRPC) for actions.
 */
export class TimelineUseCase {
  /**
   * Creates an instance of TimelineUseCase.
   * 
   * @param repo - The timeline repository instance.
   */
  constructor(private repo: TimelineRepository) {}

  /**
   * Retrieves global system KPI metrics.
   * 
   * @param period The time period filter.
   * @returns A promise that resolves to the global KPI metrics.
   */
  async getMetrics(period: string = 'monthly'): Promise<KpiMetrics> {
    return this.repo.getMetrics(period);
  }

  /**
   * Retrieves top leaderboard posts.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<{ data: PostLeaderboard[]; meta: PaginationMeta }> {
    return this.repo.getPosts(params);
  }

  /**
   * Retrieves detailed post information by ID.
   * 
   * @param id - The ID of the post to retrieve.
   * @returns A promise that resolves to the post details, or null if not found.
   */
  async getPostById(id: string): Promise<PostDetail | null> {
    return this.repo.getPostById(id);
  }

  /**
   * Deletes multiple posts by their IDs, coordinating database removal and X API tweet deletion via gRPC.
   * 
   * @param ids - The array of post IDs to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deletePosts(ids: string[]): Promise<void> {
    // Call bot-backend via gRPC to delete the tweets on X prior to database removal
    await Promise.all(
      ids.map(async (id) => {
        try {
          logger.info('Triggering gRPC deleteTweet', { tweetId: id });
          const response = await deleteTweetViaGrpc(id);
          logger.info('gRPC deleteTweet response received', { tweetId: id, response });
        } catch (err) {
          logger.error('Failed to delete tweet via gRPC', err, { tweetId: id });
        }
      })
    );

    // After external deletion, remove documents from Firestore repository
    await this.repo.deletePosts(ids);
  }

  /**
   * Retrieves dynamically aggregated active warnings.
   */
  async getAlerts(): Promise<SystemAlert[]> {
    return this.repo.getAlerts();
  }
}
