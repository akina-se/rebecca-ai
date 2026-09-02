import { Firestore, Query } from '@google-cloud/firestore';
import { KpiMetrics, PostLeaderboard, PostDetail, SystemAlert, PaginatedResponse, TimelinePost } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

/**
 * Repository responsible for data access operations related to timeline history, leaderboard posts, and system KPI metrics in Firestore.
 * Strictly adheres to canonical schema and leverages @rebecca/db converters for typed normalization.
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
   * Retrieves global system KPI metrics with historical trends and sparkline distributions.
   * 
   * @param period The time period for metrics ('weekly' | 'monthly' | 'yearly')
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

    // 4. Engagement Rate: Likes + Reposts + Replies / Impressions across posts in the period
    let totalEngagements = 0;
    let totalImpressions = 0;
    currentPostsSnap.docs.forEach(doc => {
      const d = doc.data();
      const impressions = Number(d.impressions) || 0;
      const reposts = Number(d.reposts ?? d.retweets ?? 0);
      const engagements = (Number(d.likes) || 0) + reposts + (Number(d.replies) || 0);
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
      const d = doc.data();
      prevTotalImpressions += Number(d.impressions) || 0;
      const reposts = Number(d.reposts ?? d.retweets ?? 0);
      prevTotalEngagements += (Number(d.likes) || 0) + reposts + (Number(d.replies) || 0);
    });

    let engagementTrend: number | null = null;
    if (prevTotalImpressions > 0 && engagementRate !== null) {
      const prevEngagementRate = (prevTotalEngagements / prevTotalImpressions) * 100;
      engagementTrend = parseFloat((engagementRate - prevEngagementRate).toFixed(1));
    }

    // 5. Dynamic Sparkline Histograms
    const startMs = nowMs - periodMs;
    const bucketDuration = periodMs / historyBuckets;

    const getBucketIndex = (timestampMs: number): number => {
      if (timestampMs < startMs || timestampMs > nowMs) return -1;
      return Math.min(historyBuckets - 1, Math.max(0, Math.floor((timestampMs - startMs) / bucketDuration)));
    };

    // 5.1 Followers History (Cumulative Stock)
    const followerIncrements = new Array<number>(historyBuckets).fill(0);
    currentFollowersSnap.docs.forEach(doc => {
      const t = new Date(doc.data().timestamp || 0).getTime();
      const idx = getBucketIndex(t);
      if (idx !== -1) {
        followerIncrements[idx]++;
      }
    });

    let runningFollowers = baselineFollowers;
    const followersHistory = followerIncrements.map(increment => {
      runningFollowers += increment;
      return runningFollowers;
    });

    // 5.2 API Calls History (Activity Count)
    const apiCallsHistory = new Array<number>(historyBuckets).fill(0);
    currentLogsSnap.docs.forEach(doc => {
      const t = new Date(doc.data().timestamp || 0).getTime();
      const idx = getBucketIndex(t);
      if (idx !== -1) {
        apiCallsHistory[idx]++;
      }
    });
    currentPostsSnap.docs.forEach(doc => {
      const d = doc.data();
      const t = new Date(d.timestamp || 0).getTime();
      const idx = getBucketIndex(t);
      if (idx !== -1) {
        apiCallsHistory[idx]++;
      }
    });

    // 5.3 DAU History (Unique Active Users per Bucket)
    const dauUserSets: Set<string>[] = Array.from({ length: historyBuckets }, () => new Set<string>());
    currentLogsSnap.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      if (typeof userId === 'string' && userId) {
        const t = new Date(data.timestamp || 0).getTime();
        const idx = getBucketIndex(t);
        if (idx !== -1) {
          dauUserSets[idx].add(userId);
        }
      }
    });
    const dauHistory = dauUserSets.map(userSet => userSet.size);

    // 5.4 Engagement Rate History (Percentage per Bucket)
    const bucketImpressions = new Array<number>(historyBuckets).fill(0);
    const bucketEngagements = new Array<number>(historyBuckets).fill(0);

    currentPostsSnap.docs.forEach(doc => {
      const d = doc.data();
      const t = new Date(d.timestamp || 0).getTime();
      const idx = getBucketIndex(t);
      if (idx !== -1) {
        const impressions = Number(d.impressions) || 0;
        const reposts = Number(d.reposts ?? d.retweets ?? 0);
        const engagements = (Number(d.likes) || 0) + reposts + (Number(d.replies) || 0);
        bucketImpressions[idx] += impressions;
        bucketEngagements[idx] += engagements;
      }
    });

    const engagementHistory = bucketImpressions.map((impressions, idx) => {
      if (impressions === 0) return 0;
      return parseFloat(((bucketEngagements[idx] / impressions) * 100).toFixed(1));
    });

    return {
      followers: totalFollowers,
      followersTrend,
      followersHistory,
      engagementRate,
      engagementTrend,
      engagementHistory,
      dailyActiveUsers: currentDau,
      dauTrend,
      dauHistory,
      apiCalls: currentApiCalls,
      apiCallsTrend,
      apiCallsHistory
    };
  }

  /**
   * Retrieves leaderboard posts ordered by impressions descending, supporting pagination and sorting.
   * 
   * @returns A promise that resolves to an array of leaderboard posts.
   */
  async getPosts(params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; period?: string; date?: string; }): Promise<PaginatedResponse<PostLeaderboard>> {
    let query = this.collections.timelineHistory as Query<TimelinePost>;

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

    // Fetch snapshot with normalized converter
    const snapshot = await query.get();
    let docs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    // Memory-safe sorting
    docs.sort((a, b) => {
      let numA = 0;
      let numB = 0;

      if (sortBy === 'time' || sortBy === 'created_at' || sortBy === 'timestamp') {
        numA = new Date(a.data.timestamp || 0).getTime();
        numB = new Date(b.data.timestamp || 0).getTime();
      } else {
        const key = sortBy as keyof TimelinePost;
        numA = typeof a.data[key] === 'number' ? (a.data[key] as number) : 0;
        numB = typeof b.data[key] === 'number' ? (b.data[key] as number) : 0;
      }

      if (sortOrder === 'desc') return numB < numA ? -1 : numB > numA ? 1 : 0;
      return numA < numB ? -1 : numA > numB ? 1 : 0;
    });

    const totalItems = docs.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    docs = docs.slice((page - 1) * limit, page * limit);

    const data: PostLeaderboard[] = docs.map(doc => {
      const d = doc.data;
      const rawData = doc.data as unknown as Record<string, unknown>;
      const rawMedia = ((d.mediaUrls as string[]) || (rawData['media_urls'] as string[]) || []) as string[];
      const media = rawMedia.map(url => {
        if (typeof url === 'string' && url.startsWith('gs://')) {
          const parts = url.split('/');
          const filename = parts.pop() || '';
          return `/api/v1/assets/${filename}/image?size=thumbnail`;
        }
        return typeof url === 'string' ? url : '';
      }).filter(url => Boolean(url));

      const content = String(d.text || rawData['content'] || '');
      const time = String(d.timestamp || rawData['created_at'] || '');

      return {
        id: doc.id,
        tweetId: typeof d.tweetId === 'string' ? d.tweetId : (typeof rawData['tweet_id'] === 'string' ? (rawData['tweet_id'] as string) : undefined),
        time,
        snippet: content.length > 50 ? content.substring(0, 50) + '...' : content,
        impressions: typeof d.impressions === 'number' ? d.impressions : 0,
        status: String(d.status || 'SUCCESS'),
        hasMedia: media.length > 0,
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
    const rawMediaUrls: string[] = ((data.mediaUrls as string[]) || (data.media_urls as string[]) || []) as string[];

    // Normalize GCS paths to secure backend streaming API endpoint (/api/v1/assets/:id/image), preserving http/https
    const resolvedMediaUrls = rawMediaUrls.map(url => {
      if (typeof url === 'string' && url.startsWith('gs://')) {
        const parts = url.split('/');
        const filename = parts.pop() || '';
        return `/api/v1/assets/${filename}/image`;
      }
      return typeof url === 'string' ? url : '';
    });

    const repostCount = typeof data.reposts === 'number' ? data.reposts : (typeof data.retweets === 'number' ? data.retweets : 0);

    return {
      id: doc.id,
      tweetId: typeof data.tweetId === 'string' ? data.tweetId : (typeof data.tweet_id === 'string' ? data.tweet_id : undefined),
      time: String(data.timestamp || data.created_at || new Date().toISOString()),
      content: String(data.text || data.content || ''),
      impressions: typeof data.impressions === 'number' ? data.impressions : 0,
      mediaUrls: resolvedMediaUrls.filter(url => Boolean(url)),
      status: String(data.status || 'SUCCESS'),
      likes: typeof data.likes === 'number' ? data.likes : 0,
      retweets: repostCount,
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
      if (!data.caption || String(data.status).toUpperCase() === 'FAILED') {
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
      const data = doc.data();
      if (String(data.status).toUpperCase() === 'FAILED') {
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

    const [xApiStateDoc, personaDoc] = await Promise.all([
      this.collections.system.doc('x_api_state').get(),
      this.collections.system.doc('persona').get()
    ]);

    if (xApiStateDoc.exists) {
      const state = xApiStateDoc.data() as unknown as Record<string, unknown> | undefined;
      if (state && (state.is_rate_limited || state.isRateLimited)) {
        alerts.push({
          id: 'rate_limit',
          type: 'error',
          message: 'X API rate limit active. Autonomous operations may be throttled.',
          timestamp: new Date().toISOString()
        });
      }
    }

    if (!personaDoc.exists) {
      alerts.push({
        id: 'missing_persona',
        type: 'warning',
        message: 'System persona configuration is missing.',
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  /**
   * Deletes multiple posts by their IDs.
   * 
   * @param ids - An array of post IDs to delete.
   * @returns A promise that resolves when the batch delete is committed.
   */
  async deletePosts(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    const batch = this.firestore.batch();
    ids.forEach(id => {
      const ref = this.collections.timelineHistory.doc(id);
      batch.delete(ref);
    });

    await batch.commit();
  }
}
