import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { Client, OAuth1 } from '@xdevplatform/xdk';

const COLLECTIONS = {
  TIMELINE_HISTORY: 'timeline_history',
  SYSTEM_STATS: 'system_stats',
} as const;

export interface RawTweetItem {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

export interface RawMediaItem {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
}

export interface RawTweetsResponse {
  data?: RawTweetItem[];
  includes?: {
    media?: RawMediaItem[];
  };
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
  };
}

/**
 * Initializes an X API v2 Client.
 * Supports OAuth1.0a or Bearer token from environment variables or Secret Manager.
 */
export const getXClient = (): Client | null => {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  const bearerToken = process.env.X_BEARER_TOKEN;

  if (apiKey && apiSecret && accessToken && accessSecret) {
    const oauth1 = new OAuth1({
      apiKey,
      apiSecret,
      callback: 'oob',
      accessToken,
      accessTokenSecret: accessSecret,
    });
    return new Client({ oauth1 });
  }

  if (bearerToken) {
    return new Client({ bearerToken });
  }

  return null;
};

/**
 * Core business logic for syncing X timeline posts and engagement metrics into Firestore.
 * Exposed as an exported async function to facilitate comprehensive unit testing.
 */
export const syncTimelinePostsAndMetrics = async (
  xClient: Client | null,
  userId: string | undefined,
  db = getFirestore()
): Promise<{ processed: number; updated: number; created: number; errors: number }> => {
  if (!xClient) {
    console.warn('[TimelineSync] X API client not configured. Skipping sync.');
    return { processed: 0, updated: 0, created: 0, errors: 0 };
  }

  if (!userId) {
    console.warn('[TimelineSync] X_MY_USER_ID is not configured. Skipping sync.');
    return { processed: 0, updated: 0, created: 0, errors: 0 };
  }

  try {
    // 1. Single bulk request to fetch up to 100 recent timeline posts
    const response = (await xClient.users.getPosts(userId, {
      max_results: 100,
      exclude: ['retweets', 'replies'],
      'tweet.fields': ['created_at', 'public_metrics', 'attachments', 'text'],
      expansions: ['attachments.media_keys'],
      'media.fields': ['url', 'preview_image_url', 'type'],
    } as Parameters<typeof xClient.users.getPosts>[1])) as unknown as RawTweetsResponse;

    const tweets = response?.data || [];
    if (tweets.length === 0) {
      console.log('[TimelineSync] No tweets returned from X API.');
      return { processed: 0, updated: 0, created: 0, errors: 0 };
    }

    // Build media key -> url lookup map
    const mediaMap = new Map<string, string>();
    if (response.includes?.media) {
      for (const media of response.includes.media) {
        const mediaUrl = media.url || media.preview_image_url;
        if (media.media_key && mediaUrl) {
          mediaMap.set(media.media_key, mediaUrl);
        }
      }
    }

    // 2. Fetch existing Firestore timeline documents for lookup
    const timelineRef = db.collection(COLLECTIONS.TIMELINE_HISTORY);
    const existingSnap = await timelineRef.get();

    const existingByTweetId = new Map<string, { id: string; data: Record<string, unknown> }>();
    const existingByText = new Map<string, { id: string; data: Record<string, unknown> }>();

    existingSnap.forEach((doc) => {
      const data = doc.data();
      if (data.tweetId) existingByTweetId.set(String(data.tweetId), { id: doc.id, data });
      if (data.tweet_id) existingByTweetId.set(String(data.tweet_id), { id: doc.id, data });

      const content = String(data.text || data.content || '').trim();
      if (content) {
        existingByText.set(content, { id: doc.id, data });
      }
    });

    let updatedCount = 0;
    let createdCount = 0;
    const batch = db.batch();

    for (const tweet of tweets) {
      const metrics = tweet.public_metrics || {};
      const impressions = typeof metrics.impression_count === 'number' ? metrics.impression_count : 0;
      const likes = typeof metrics.like_count === 'number' ? metrics.like_count : 0;
      const reposts = typeof metrics.retweet_count === 'number' ? metrics.retweet_count : 0;
      const replies = typeof metrics.reply_count === 'number' ? metrics.reply_count : 0;

      const mediaUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const url = mediaMap.get(key);
          if (url) mediaUrls.push(url);
        }
      }

      // Check if document already exists
      const existing = existingByTweetId.get(tweet.id) || existingByText.get(tweet.text.trim());

      if (existing) {
        // Update existing document with latest metrics & ensure tweetId is set
        const docRef = timelineRef.doc(existing.id);
        const updatePayload: Record<string, unknown> = {
          impressions,
          likes,
          reposts,
          replies,
          tweetId: tweet.id,
          tweet_id: tweet.id,
          lastSyncedAt: new Date().toISOString(),
        };

        // If mediaUrls were missing in Firestore, populate them
        const existingMedia = (existing.data.mediaUrls || existing.data.media_urls || []) as string[];
        if (existingMedia.length === 0 && mediaUrls.length > 0) {
          updatePayload.mediaUrls = mediaUrls;
          updatePayload.media_urls = mediaUrls;
        }

        batch.set(docRef, updatePayload, { merge: true });
        updatedCount++;
      } else {
        // Create new document for manual/untracked tweet
        const newDocRef = timelineRef.doc();
        const tweetDate = tweet.created_at ? new Date(tweet.created_at) : new Date();
        const expireAt = new Date(tweetDate);
        expireAt.setFullYear(expireAt.getFullYear() + 5);

        batch.set(newDocRef, {
          text: tweet.text,
          content: tweet.text,
          timestamp: tweetDate.toISOString(),
          created_at: tweetDate.toISOString(),
          expireAt: expireAt.toISOString(),
          mediaUrls,
          media_urls: mediaUrls,
          impressions,
          likes,
          reposts,
          replies,
          status: 'SUCCESS',
          tweetId: tweet.id,
          tweet_id: tweet.id,
          lastSyncedAt: new Date().toISOString(),
        });
        createdCount++;
      }
    }

    if (updatedCount > 0 || createdCount > 0) {
      await batch.commit();
    }

    console.log(`[TimelineSync] Success: processed ${tweets.length} tweets (Updated: ${updatedCount}, Created: ${createdCount}).`);
    return { processed: tweets.length, updated: updatedCount, created: createdCount, errors: 0 };
  } catch (error) {
    console.error('[TimelineSync] Failed to sync timeline posts from X API:', error);
    return { processed: 0, updated: 0, created: 0, errors: 1 };
  }
};

/**
 * Scheduled Cloud Function trigger that executes once daily at 04:00 JST (19:00 UTC).
 */
export const scheduledTimelineSync = onSchedule(
  {
    schedule: 'every day 04:00',
    timeZone: 'Asia/Tokyo',
    retryCount: 1,
    memory: '256MiB',
    timeoutSeconds: 120,
    secrets: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'X_BEARER_TOKEN', 'X_MY_USER_ID'],
  },
  async () => {
    const xClient = getXClient();
    const userId = process.env.X_MY_USER_ID;
    await syncTimelinePostsAndMetrics(xClient, userId);
  }
);
