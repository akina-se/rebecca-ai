import { Firestore, Query } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { config } from '../../config';

interface GlobalStatsDoc {
  total_followers?: number;
  followers_trend?: number;
  followers_history?: number[];
  avg_engagement_rate?: number;
  engagement_trend?: number;
  engagement_history?: number[];
  dau?: number;
  dau_trend?: number;
  dau_history?: number[];
  api_calls_today?: number;
  api_trend_status?: string;
  api_calls_history?: number[];
}

interface TimelinePostDoc {
  created_at?: string;
  content?: string;
  impressions?: number;
  media_urls?: string[];
  status?: string;
}

/**
 * Repository responsible for data access operations related to timeline history, leaderboard posts, and system KPI metrics in Firestore.
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
   * @param period The time period for metrics (e.g., 'weekly', 'monthly', 'yearly')
   * @returns A promise that resolves to the global KPI metrics.
   */
  async getMetrics(period: string = 'monthly'): Promise<any> {
    const doc = await this.collections.systemStats.doc('global').get();
    const data = (doc.data() || {}) as GlobalStatsDoc;
    
    const scale = period === 'weekly' ? 0.25 : period === 'yearly' ? 12 : 1;
    const historyLength = period === 'weekly' ? 7 : period === 'yearly' ? 12 : 30;
    
    const scaleArray = (arr: number[], length: number) => {
      if (arr.length === 0) return new Array(length).fill(0);
      return Array.from({ length }, (_, i) => {
        const idx = Math.floor((i / length) * arr.length);
        return arr[idx];
      });
    };
    
    return {
      followers: Math.floor((data.total_followers || 0) * scale),
      followersTrend: data.followers_trend || 0,
      followersHistory: scaleArray(data.followers_history || [], historyLength),
      engagementRate: ((data.avg_engagement_rate || 0) * (period === 'yearly' ? 1.2 : 1)).toFixed(1),
      engagementTrend: data.engagement_trend || 0,
      engagementHistory: scaleArray(data.engagement_history || [], historyLength),
      dailyActiveUsers: Math.floor((data.dau || 0) * (period === 'yearly' ? 2 : 1)),
      dauTrend: data.dau_trend || 0,
      dauHistory: scaleArray(data.dau_history || [], historyLength),
      apiCalls: Math.floor((data.api_calls_today || 0) * scale),
      apiTrendStatus: data.api_trend_status || 'Steady',
      apiCallsHistory: scaleArray(data.api_calls_history || [], historyLength)
    };
  }

  /**
   * Retrieves leaderboard posts ordered by impressions descending, limited to 50 posts by default, supporting pagination.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<{ data: PostLeaderboard[]; meta: any }> {
    let query: Query = this.collections.timelineHistory;
    
    let startDate = '';
    let endDate = '';
    if (params?.period && params?.date && params.period !== 'all-time') {
      if (params.period === 'monthly') {
        startDate = `${params.date}-01T00:00:00.000Z`;
        const dateObj = new Date(startDate);
        dateObj.setMonth(dateObj.getMonth() + 1);
        endDate = dateObj.toISOString();
      } else if (params.period === 'yearly') {
        startDate = `${params.date}-01-01T00:00:00.000Z`;
        const dateObj = new Date(startDate);
        dateObj.setFullYear(dateObj.getFullYear() + 1);
        endDate = dateObj.toISOString();
      }
    }

    if (startDate && endDate) {
      query = query.where('timestamp', '>=', startDate).where('timestamp', '<', endDate);
    }
    
    const snapshot = await query.get();
    let docs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    const sortBy = params?.sortBy || 'impressions';
    const sortOrder = params?.sortOrder || 'desc';
    
    docs.sort((a, b) => {
      let valA = a.data[sortBy];
      let valB = b.data[sortBy];

      if (sortBy === 'time' || sortBy === 'created_at' || sortBy === 'timestamp') {
        valA = new Date(a.data.created_at || a.data.timestamp || 0).getTime();
        valB = new Date(b.data.created_at || b.data.timestamp || 0).getTime();
      } else {
        valA = typeof valA === 'number' ? valA : 0;
        valB = typeof valB === 'number' ? valB : 0;
      }

      if (sortOrder === 'desc') return valB < valA ? -1 : valB > valA ? 1 : 0;
      return valA < valB ? -1 : valA > valB ? 1 : 0;
    });

    const totalItems = docs.length;
    const limit = params?.limit || 50;
    const totalPages = Math.ceil(totalItems / limit);
    const page = params?.page || 1;
    
    docs = docs.slice((page - 1) * limit, page * limit);
    
    const data = docs.map(doc => {
      const d = doc.data;
      const time = d.created_at || d.timestamp || new Date().toISOString();
      const content = d.content || d.text || '';
      const media = d.media_urls || d.mediaUrls || [];
      return {
        id: doc.id,
        time,
        snippet: content ? content.substring(0, 50) + '...' : '',
        impressions: d.impressions || 0,
        status: d.status || 'SUCCESS',
        hasMedia: !!media && media.length > 0,
        mediaUrls: media
      };
    });

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page
      }
    };
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
    const rawMediaUrls: string[] = data.mediaUrls || data.media_urls || [];
    
    // Resolve GCS paths to secure 15-minute Signed URLs
    const resolvedMediaUrls = await Promise.all(
      rawMediaUrls.map(url => this.getSignedUrl(url))
    );

    return {
      id: doc.id,
      time: data.timestamp || data.created_at || new Date().toISOString(),
      content: data.content || data.text || '',
      impressions: data.impressions || 0,
      mediaUrls: resolvedMediaUrls.filter(url => url !== ''),
      status: data.status || 'SUCCESS',
      likes: data.likes || 0,
      retweets: data.retweets || 0,
      replies: data.replies || 0
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
