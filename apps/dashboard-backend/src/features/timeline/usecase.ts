import { TimelineRepository } from './repository';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert } from '@rebecca/types';
import { deleteTweetViaGrpc } from '../../core/grpcClient';

/**
 * Use case class for orchestrating timeline and metrics-related operations.
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
   * @returns A promise that resolves to the global KPI metrics.
   */
  async getMetrics(): Promise<KpiMetrics> {
    return this.repo.getMetrics();
  }

  /**
   * Retrieves top leaderboard posts.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { limit?: number; startAfterId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; }): Promise<PostLeaderboard[]> {
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
    await this.repo.deletePosts(ids);
    
    // Call bot-backend via gRPC to delete the tweets on X
    await Promise.all(
      ids.map(async (id) => {
        try {
          console.log(`Triggering gRPC deleteTweet for X ID: ${id}`);
          const response = await deleteTweetViaGrpc(id);
          console.log(`gRPC deleteTweet response for ${id}:`, response);
        } catch (err) {
          console.error(`Failed to delete tweet ${id} via gRPC:`, err);
        }
      })
    );
  }

  /**
   * Retrieves dynamically aggregated active warnings.
   */
  async getAlerts(): Promise<SystemAlert[]> {
    return this.repo.getAlerts();
  }
}
