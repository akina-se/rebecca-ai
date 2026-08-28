import { Firestore, Query } from '@google-cloud/firestore';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert, PaginatedResponse } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { config } from '../../config';

interface TimelinePostDoc {
  created_at?: string;
  timestamp?: string;
  content?: string;
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
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
    const now = new Date();
    const nowMs = now.getTime();

    let periodMs = 30 * 24 * 3600 * 1000;
    let historyBuckets = 30;

    if (period === 'weekly') {
      periodMs = 7 * 24 * 3600 * 1000;
      historyBuckets = 7;
    } else if (period === 'yearly') {
      periodMs = 365 * 24 * 3600 * 1000;
      historyBuckets = 12;
    }

    const currentPeriodStartIso = new Date(nowMs - periodMs).toISOString();
    const previousPeriodStartIso = new Date(nowMs - periodMs * 2).toISOString();
    const oneDayAgoIso = new Date(nowMs - 24 * 3600 * 1000).toISOString();
    const twoDaysAgoIso = new Date(nowMs - 48 * 3600 * 1000).toISOString();

    // 1. Total Followers & Period Trend
    const [followersSnap, prevFollowersSnap, currentFollowersSnap] = await Promise.all([
      this.collections.processedFollowers.count().get(),
      this.collections.processedFollowers.where('timestamp', '<', currentPeriodStartIso).count().get(),
      this.collections.processedFollowers.where('timestamp', '>=', currentPeriodStartIso).get()
    ]);
    const totalFollowers = followersSnap.data().count || 0;
    const baselineFollowers = prevFollowersSnap.data().count || 0;

    let followersTrend: number | null = null;
    if (baselineFollowers > 0) {
      followersTrend = parseFloat((((totalFollowers - baselineFollowers) / baselineFollowers) * 100).toFixed(1));
    }

    // 2. API Calls & Volume Trend (Conversation logs + timeline posts)
    const [currentLogsSnap, currentPostsSnap, prevLogsSnap, prevPostsSnap] = await Promise.all([
      this.collections.conversationLogs.where('timestamp', '>=', currentPeriodStartIso).get(),
      this.collections.timelineHistory.where('timestamp', '>=', currentPeriodStartIso).get(),
      this.collections.conversationLogs.where('timestamp', '>=', previousPeriodStartIso).where('timestamp', '<', currentPeriodStartIso).count().get(),
      this.collections.timelineHistory.where('timestamp', '>=', previousPeriodStartIso).where('timestamp', '<', currentPeriodStartIso).count().get()
    ]);

    const currentApiCalls = currentLogsSnap.size + currentPostsSnap.size;
    const previousApiCalls = (prevLogsSnap.data().count || 0) + (prevPostsSnap.data().count || 0);

    let apiCallsTrend: number | null = null;
    if (previousApiCalls > 0) {
      apiCallsTrend = parseFloat((((currentApiCalls - previousApiCalls) / previousApiCalls) * 100).toFixed(1));
    }

    // 3. Daily Active Users (DAU): Distinct users in the past 24 hours
    const [recentLogsSnap, prevRecentLogsSnap] = await Promise.all([
      this.collections.conversationLogs.where('timestamp', '>=', oneDayAgoIso).get(),
      this.collections.conversationLogs.where('timestamp', '>=', twoDaysAgoIso).where('timestamp', '<', oneDayAgoIso).get()
    ]);

    const currentDauUsers = new Set(recentLogsSnap.docs.map(d => d.data().userId).filter(Boolean));
    const currentDau = currentDauUsers.size;

    const prevDauUsers = new Set(prevRecentLogsSnap.docs.map(d => d.data().userId).filter(Boolean));
    const prevDau = prevDauUsers.size;

    let dauTrend: number | null = null;
    if (prevDau > 0) {
      dauTrend = parseFloat((((currentDau - prevDau) / prevDau) * 100).toFixed(1));
    }

    // 4. Engagement Rate: Likes + Retweets + Replies / Impressions across posts in the period
    let totalEngagements = 0;
    let totalImpressions = 0;
    currentPostsSnap.docs.forEach(doc => {
      const d = doc.data() as TimelinePostDoc;
      const impressions = Number(d.impressions) || 0;
      const engagements = (Number(d.likes) || 0) + (Number(d.retweets) || 0) + (Number(d.replies) || 0);
      totalImpressions += impressions;
      totalEngagements += engagements;
    });

    const engagementRate: number | null = totalImpressions > 0
      ? parseFloat(((totalEngagements / totalImpressions) * 100).toFixed(1))
      : null;

    // Previous period engagement rate for trend comparison
    let prevTotalEngagements = 0;
    let prevTotalImpressions = 0;
    const prevPostsListSnap = await this.collections.timelineHistory
      .where('timestamp', '>=', previousPeriodStartIso)
      .where('timestamp', '<', currentPeriodStartIso)
      .get();

    prevPostsListSnap.docs.forEach(doc => {
      const d = doc.data() as TimelinePostDoc;
      prevTotalImpressions += Number(d.impressions) || 0;
      prevTotalEngagements += (Number(d.likes) || 0) + (Number(d.retweets) || 0) + (Number(d.replies) || 0);
    });

    let engagementTrend: number | null = null;
    if (prevTotalImpressions > 0 && engagementRate !== null) {
      const prevEngagementRate = (prevTotalEngagements / prevTotalImpressions) * 100;
      engagementTrend = parseFloat((engagementRate - prevEngagementRate).toFixed(1));
    }

    // 5. Dynamic Sparkline Histograms from actual timestamps
    const buildSparklineBuckets = (timestamps: number[], bucketsCount: number, startMs: number, endMs: number): number[] => {
      if (timestamps.length === 0) return [];
      const bucketDuration = (endMs - startMs) / bucketsCount;
      const counts = new Array<number>(bucketsCount).fill(0);
      for (const t of timestamps) {
        if (t >= startMs && t <= endMs) {
          const idx = Math.min(bucketsCount - 1, Math.max(0, Math.floor((t - startMs) / bucketDuration)));
          counts[idx]++;
        }
      }
      return counts;
    };

    const startMs = nowMs - periodMs;
    const followerTimestamps = currentFollowersSnap.docs
      .map(d => new Date(d.data().timestamp || 0).getTime())
      .filter(t => t > 0);
    const followersHistory = buildSparklineBuckets(followerTimestamps, historyBuckets, startMs, nowMs);

    const logTimestamps = [
      ...currentLogsSnap.docs.map(d => new Date(d.data().timestamp || 0).getTime()),
      ...currentPostsSnap.docs.map(d => new Date(d.data().timestamp || 0).getTime())
    ].filter(t => t > 0);

    const apiCallsHistory = buildSparklineBuckets(logTimestamps, historyBuckets, startMs, nowMs);

    return {
      followers: totalFollowers,
      followersTrend,
      followersHistory,
      engagementRate,
      engagementTrend,
      engagementHistory: [],
      dailyActiveUsers: currentDau,
      dauTrend,
      dauHistory: [],
      apiCalls: currentApiCalls,
      apiCallsTrend,
      apiCallsHistory
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
        if (typeof url === 'string' && url.startsWith('gs://')) {
          const parts = url.split('/');
          const filename = parts.pop() || '';
          return `/api/v1/assets/${filename}/image?size=thumbnail`;
        }
        return typeof url === 'string' ? url : '';
      }).filter(url => Boolean(url));

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
            const safeTweetId = String(tweetId).replace(/[\r\n\u2028\u2029]/g, '');
            console.log('Deleted tweet %s from X API.', safeTweetId);
          }
        }
      } catch (err) {
        const safeId = String(id).replace(/[\r\n\u2028\u2029]/g, '');
        console.warn('Could not delete post %s from X:', safeId, err);
      }
      batch.delete(this.collections.timelineHistory.doc(id));
    }
    await batch.commit();
  }
}
