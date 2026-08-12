import { Firestore, Query } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { config } from '../../config';

interface GlobalStatsDoc {
  total_followers?: number;
  followers_trend?: number;
  avg_engagement_rate?: number;
  engagement_trend?: number;
  dau?: number;
  dau_trend?: number;
  api_calls_today?: number;
  api_trend_status?: string;
}

interface TimelinePostDoc {
  created_at?: string;
  content?: string;
  impressions?: number;
  media_urls?: string[];
  status?: string;
}

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
    const data = (doc.data() || {}) as GlobalStatsDoc;
    
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
   * Retrieves leaderboard posts ordered by impressions descending, limited to 50 posts by default, supporting pagination.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { limit?: number; startAfterId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; }): Promise<PostLeaderboard[]> {
    let query: Query = this.collections.timelineHistory;
    
    const sortBy = params?.sortBy || 'impressions';
    const sortOrder = params?.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    if (params?.startAfterId) {
      const doc = await this.collections.timelineHistory.doc(params.startAfterId).get();
      if (doc.exists) {
        query = query.startAfter(doc);
      }
    }

    const limit = params?.limit || 50;
    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data() as TimelinePostDoc;
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
    
    const data = doc.data() as TimelinePostDoc;
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
   * Aggregates active warnings dynamically.
   */
  async getAlerts(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    
    // 1. Count images with failed/empty caption or status FAILED
    const imagesSnapshot = await this.collections.images.get();
    let failedCaptionsCount = 0;
    imagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.caption || data.status === 'FAILED') {
        failedCaptionsCount++;
      }
    });
    
    if (failedCaptionsCount > 0) {
      alerts.push({
        id: 'failed_captions',
        type: 'warning',
        message: `${failedCaptionsCount} image captions failed generation.`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. Count failed posts
    const postsSnapshot = await this.collections.timelineHistory.get();
    let failedPostsCount = 0;
    postsSnapshot.docs.forEach(doc => {
      const data = doc.data() as TimelinePostDoc;
      if (data.status === 'FAILED') {
        failedPostsCount++;
      }
    });
    
    if (failedPostsCount > 0) {
      alerts.push({
        id: 'failed_posts',
        type: 'error',
        message: `${failedPostsCount} posts failed to publish to X.`,
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts;
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
