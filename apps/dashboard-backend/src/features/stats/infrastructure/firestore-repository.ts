import { Firestore } from '@google-cloud/firestore';
import { IStatsRepository } from '../repository';
import { DashboardStats } from '../entities';

export class FirestoreStatsRepository implements IStatsRepository {
  private readonly COLLECTION_NAME = 'dashboard_stats';
  private readonly STATS_DOC_ID = 'daily_aggregated';

  constructor(private readonly firestore: Firestore) {}

  public async getLatestStats(): Promise<DashboardStats> {
    const docRef = this.firestore.collection(this.COLLECTION_NAME).doc(this.STATS_DOC_ID);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        dailyActiveUsers: 0,
        totalInteractions: 0,
        aiResponseTimeMs: 0,
        systemHealth: 'Unknown',
        updatedAt: new Date()
      };
    }

    const data = doc.data()!;
    return {
      dailyActiveUsers: data.dailyActiveUsers || 0,
      totalInteractions: data.totalInteractions || 0,
      aiResponseTimeMs: data.aiResponseTimeMs || 0,
      systemHealth: data.systemHealth || 'Healthy',
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
    };
  }
}
