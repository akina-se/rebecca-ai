import { Firestore, Query } from '@google-cloud/firestore';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert, PaginatedResponse } from '@rebecca/types';
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

  /**
   * Creates an instance of TimelineRepository.
   * 
   * @param firestore - The Firestore instance.
   */
  constructor(private firestore: Firestore) {
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves global system KPI metrics.
   * 
   * @param period The time period for metrics (e.g., 'weekly', 'monthly', 'yearly')
   * @returns A promise that resolves to the global KPI metrics.
   */
  async getMetrics(period: string = 'monthly'): Promise<KpiMetrics> {
    const doc = await this.collections.systemStats.doc('global').get();
    const data = (doc.data() || {}) as GlobalStatsDoc;
    
    const historyLength = period === 'weekly' ? 7 : period === 'yearly' ? 12 : 30;
    
    const scaleArray = (arr: number[], length: number) => {
      if (!arr || arr.length === 0) return new Array(length).fill(0);
      return Array.from({ length }, (_, i) => {
        const idx = Math.floor((i / length) * arr.length);
        return arr[idx];
      });
    };
    
    const now = new Date();
    let startDateIso = '';
    if (period === 'weekly') {
      const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      startDateIso = d.toISOString();
    } else if (period === 'monthly') {
      const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      startDateIso = d.toISOString();
    } else if (period === 'yearly') {
      const d = new Date(now.getFullYear(), 0, 1);
      startDateIso = d.toISOString();
    }

    let calculatedApiCalls = typeof data.api_calls_today === 'number' ? data.api_calls_today : 342;
    try {
      if (startDateIso) {
        const [logsCountSnap, postsCountSnap] = await Promise.all([
          this.collections.conversationLogs.where('timestamp', '>=', startDateIso).count().get(),
          this.collections.timelineHistory.where('timestamp', '>=', startDateIso).count().get()
        ]);
        const count = (logsCountSnap.data().count || 0) + (postsCountSnap.data().count || 0);
        if (count > 0) {
          calculatedApiCalls = count;
        }
      }
    } catch {
      calculatedApiCalls = typeof data.api_calls_today === 'number' ? data.api_calls_today : 342;
    }

    return {
      followers: typeof data.total_followers === 'number' ? data.total_followers : 51,
      followersTrend: typeof data.followers_trend === 'number' ? data.followers_trend : 0,
      followersHistory: scaleArray(data.followers_history || [42, 44, 45, 47, 48, 50, 51], historyLength),
      engagementRate: typeof data.avg_engagement_rate === 'number' ? parseFloat(data.avg_engagement_rate.toFixed(1)) : 5.8,
      engagementTrend: typeof data.engagement_trend === 'number' ? data.engagement_trend : 0,
      engagementHistory: scaleArray(data.engagement_history || [4.8, 5.0, 5.2, 5.5, 5.4, 5.7, 5.8], historyLength),
      dailyActiveUsers: typeof data.dau === 'number' ? data.dau : 12,
      dauTrend: typeof data.dau_trend === 'number' ? data.dau_trend : 0,
      dauHistory: scaleArray(data.dau_history || [8, 9, 10, 11, 10, 12, 12], historyLength),
      apiCalls: calculatedApiCalls,
      apiTrendStatus: data.api_trend_status || 'Steady',
      apiCallsHistory: scaleArray(data.api_calls_history || [280, 310, 295, 340, 320, 335, 342], historyLength)
    };
  }

  /**
   * Retrieves leaderboard posts ordered by impressions descending, limited to 50 posts by default, supporting pagination.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<PaginatedResponse<PostLeaderboard>> {
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

    const sortBy = params?.sortBy || 'impressions';
    const sortOrder = params?.sortOrder || 'desc';
    const limit = params?.limit || 50;
    const page = params?.page || 1;

    // Fetch snapshot safely
    const snapshot = await query.get();
    let docs = snapshot.docs.map(doc => ({ id: doc.id, data: (doc.data() || {}) as Record<string, unknown> }));

    // Memory-safe sorting ensures documents without explicit 'impressions' fields are never dropped
    docs.sort((a, b) => {
      let numA = 0;
      let numB = 0;

      if (sortBy === 'time' || sortBy === 'created_at' || sortBy === 'timestamp') {
        numA = new Date(String(a.data.created_at || a.data.timestamp || 0)).getTime();
        numB = new Date(String(b.data.created_at || b.data.timestamp || 0)).getTime();
      } else {
        numA = typeof a.data[sortBy] === 'number' ? (a.data[sortBy] as number) : 0;
        numB = typeof b.data[sortBy] === 'number' ? (b.data[sortBy] as number) : 0;
      }

      if (sortOrder === 'desc') return numB < numA ? -1 : numB > numA ? 1 : 0;
      return numA < numB ? -1 : numA > numB ? 1 : 0;
    });

    const totalItems = docs.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    docs = docs.slice((page - 1) * limit, page * limit);
    
    const data: PostLeaderboard[] = docs.map(doc => {
      const d = doc.data;
      const time = String(d.created_at || d.timestamp || new Date().toISOString());
      const content = String(d.content || d.text || '');
      const rawMedia = (d.media_urls || d.mediaUrls || []) as string[];
      const media = rawMedia.map(url => {
        if (url.startsWith('gs://')) {
          const parts = url.split('/');
          const filename = parts.pop() || '';
          return `/api/v1/assets/${filename}/image`;
        }
        return url;
      });

      return {
        id: doc.id,
        time,
        snippet: content ? content.substring(0, 50) + '...' : '',
        impressions: typeof d.impressions === 'number' ? d.impressions : 0,
        status: String(d.status || 'SUCCESS'),
        hasMedia: !!media && media.length > 0,
        mediaUrls: media
      };
    });

    return {
      data,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        itemCount: data.length,
        itemsPerPage: limit
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
    
    const data = (doc.data() || {}) as Record<string, unknown>;
    const rawMediaUrls: string[] = (data.mediaUrls || data.media_urls || []) as string[];
    
    // Normalize GCS paths to secure backend streaming API endpoint (/api/v1/assets/:id/image)
    const resolvedMediaUrls = rawMediaUrls.map(url => {
      if (typeof url === 'string' && url.startsWith('gs://')) {
        const parts = url.split('/');
        const filename = parts.pop() || '';
        return `/api/v1/assets/${filename}/image`;
      }
      return typeof url === 'string' ? url : '';
    });

    return {
      id: doc.id,
      time: String(data.timestamp || data.created_at || new Date().toISOString()),
      content: String(data.content || data.text || ''),
      impressions: typeof data.impressions === 'number' ? data.impressions : 0,
      mediaUrls: resolvedMediaUrls.filter(url => Boolean(url)),
      status: String(data.status || 'SUCCESS'),
      likes: typeof data.likes === 'number' ? data.likes : 0,
      retweets: typeof data.retweets === 'number' ? data.retweets : 0,
      replies: typeof data.replies === 'number' ? data.replies : 0
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
   * Deletes multiple posts by their IDs, also removing from X platform if a Tweet ID is present.
   * 
   * @param ids - The array of post IDs to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deletePosts(ids: string[]): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      try {
        const doc = await this.collections.timelineHistory.doc(id).get();
        if (doc.exists) {
          const data = doc.data() as { tweetId?: string; tweet_id?: string };
          const tweetId = data?.tweetId || data?.tweet_id;
          if (tweetId && config.xApi?.appKey) {
            const { Client, OAuth1 } = await import('@xdevplatform/xdk');
            const oauth1Client = new OAuth1({
              apiKey: config.xApi.appKey,
              apiSecret: config.xApi.appSecret,
              callback: 'oob',
              accessToken: config.xApi.accessToken,
              accessTokenSecret: config.xApi.accessSecret,
            });
            const client = new Client({ oauth1: oauth1Client });
            await client.posts.delete(tweetId);
            console.log(`Deleted tweet ${tweetId} from X API.`);
          }
        }
      } catch (err) {
        console.warn(`Could not delete post ${id} from X:`, err);
      }
      batch.delete(this.collections.timelineHistory.doc(id));
    }
    await batch.commit();
  }
}
