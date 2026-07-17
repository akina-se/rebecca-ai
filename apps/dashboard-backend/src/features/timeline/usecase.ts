import { TimelineRepository } from './repository';
import { KpiMetrics, PostLeaderboard, PostDetail } from '@rebecca/types';

export class TimelineUseCase {
  constructor(private repo: TimelineRepository) {}

  async getMetrics(): Promise<KpiMetrics> {
    return this.repo.getMetrics();
  }

  async getPosts(): Promise<PostLeaderboard[]> {
    return this.repo.getPosts();
  }

  async getPostById(id: string): Promise<PostDetail> {
    return this.repo.getPostById(id);
  }

  async deletePosts(ids: string[]): Promise<void> {
    await this.repo.deletePosts(ids);
  }
}
