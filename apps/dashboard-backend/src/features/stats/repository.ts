import { DashboardStats } from './entities';

export interface IStatsRepository {
  getLatestStats(): Promise<DashboardStats>;
}
