import { DashboardStats } from '../entities/DashboardStats';

/**
 * Interface for the stats repository.
 * The core domain depends ONLY on this interface, not on Firestore.
 */
export interface IStatsRepository {
  getLatestStats(): Promise<DashboardStats>;
}
