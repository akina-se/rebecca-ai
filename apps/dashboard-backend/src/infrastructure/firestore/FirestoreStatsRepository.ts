import { Firestore } from '@google-cloud/firestore';
import { IStatsRepository } from '../../domain/repositories/IStatsRepository';
import { DashboardStats } from '../../domain/entities/DashboardStats';

/**
 * Firestore implementation of IStatsRepository.
 * This class handles the specific details of connecting to Google Cloud Firestore.
 */
export class FirestoreStatsRepository implements IStatsRepository {
  private firestore: Firestore;
  private readonly COLLECTION_NAME = 'dashboard_stats';
  private readonly STATS_DOC_ID = 'daily_aggregated';

  constructor(projectId?: string) {
    this.firestore = new Firestore({
      projectId: projectId || process.env.GCP_PROJECT_ID,
    });
  }

  public async getLatestStats(): Promise<DashboardStats> {
    const docRef = this.firestore.collection(this.COLLECTION_NAME).doc(this.STATS_DOC_ID);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Fallback for initial state
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
