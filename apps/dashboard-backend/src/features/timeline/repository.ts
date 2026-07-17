import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { KpiMetrics, PostLeaderboard, PostDetail } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { config } from '../../config';

/**
 * Repository class for retrieving timeline history, leaderboard posts, and system KPI metrics from Firestore.
 */
export class TimelineRepository {
  private collections;
  private storage: Storage;

  /**
   * Creates an instance of TimelineRepository.
   * 
   * @param firestore - The Firestore instance.
   */
  constructor(private firestore: Firestore) {
    this.collections = getCollections(firestore);
    this.storage = new Storage();
  }

  /**
   * Generates a signed URL for a given GCS object path.
   * The URL is valid for 15 minutes.
   * 
   * @param gcsPath - The GCS path (e.g. gs://bucket/object).
   * @returns A promise that resolves to the signed HTTP URL, or the original path if not a GCS path.
   */
  private async getSignedUrl(gcsPath: string): Promise<string> {
    if (!gcsPath || !gcsPath.startsWith('gs://')) {
      return gcsPath; // Return as-is if it's already an HTTP URL or empty
    }

    try {
      const bucketName = config.gcp.imageBucketName;
      // Extract object name from gs://bucket-name/object/name
      const objectName = gcsPath.replace(`gs://${bucketName}/`, '');
      
      const [url] = await this.storage
         .bucket(bucketName)
         .file(objectName)
         .getSignedUrl({
           version: 'v4',
           action: 'read',
           expires: Date.now() + 15 * 60 * 1000, // 15 minutes
         });
      
      return url;
    } catch (e) {
      console.error('Failed to generate Signed URL', e);
      return ''; // Fallback for broken images
    }
  }

  /**
   * Retrieves global system KPI metrics.
   * 
   * @returns A promise that resolves to the global KPI metrics.
   */
  async getMetrics(): Promise<KpiMetrics> {
    const doc = await this.collections.systemStats.doc('global').get();
    const data = (doc.data() || {}) as any;
    
    return {
      followers: data.total_followers || 0,
      followersTrend: data.followers_trend || 0,
      engagementRate: data.avg_engagement_rate || 0,
      engagementTrend: data.engagement_trend || 0,
      dailyActiveUsers: data.dau || 0,
      dauTrend: data.dau_trend || 0,
      apiCalls: data.api_calls_today || 0,
      apiTrendStatus: data.api_trend_status || 'Steady'
    };
  }

  /**
   * Retrieves leaderboard posts ordered by impressions descending, limited to 50 posts.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(): Promise<PostLeaderboard[]> {
    const snapshot = await this.collections.timelineHistory
      .orderBy('impressions', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        time: data.created_at || new Date().toISOString(),
        snippet: data.content ? data.content.substring(0, 50) + '...' : '',
        impressions: data.impressions || 0,
        hasMedia: !!data.media_urls && data.media_urls.length > 0
      };
    });
  }

  /**
   * Retrieves detailed post information by ID, resolving any GCS media URLs.
   * 
   * @param id - The ID of the post to retrieve.
   * @returns A promise that resolves to the post details, or null if the post was not found.
   */
  async getPostById(id: string): Promise<PostDetail | null> {
    const doc = await this.collections.timelineHistory.doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data() as any;
    const rawMediaUrls: string[] = data.media_urls || [];
    
    // Resolve GCS paths to secure 15-minute Signed URLs
    const resolvedMediaUrls = await Promise.all(
      rawMediaUrls.map(url => this.getSignedUrl(url))
    );

    return {
      id: doc.id,
      time: data.created_at || new Date().toISOString(),
      content: data.content || '',
      impressions: data.impressions || 0,
      mediaUrls: resolvedMediaUrls.filter(url => url !== '')
    };
  }

  /**
   * Deletes multiple posts by their IDs.
   * 
   * @param ids - The array of post IDs to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deletePosts(ids: string[]): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      batch.delete(this.collections.timelineHistory.doc(id));
    }
    await batch.commit();
  }
}
