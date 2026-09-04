import { Client, OAuth1 } from '@xdevplatform/xdk';
import { XApiConfig } from '../config';

export interface TimelineTweetDto {
  id: string;
  text: string;
  createdAt?: string;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  mediaUrls: string[];
}

export interface IXApiService {
  fetchRecentTimelineTweets(userId?: string, limit?: number): Promise<TimelineTweetDto[]>;
  getMyUserId(): Promise<string | null>;
  cachedMyUserId: string | null;
}

interface XdkTweetResponse {
  data?: Array<{
    id: string;
    text: string;
    createdAt?: string;
    attachments?: {
      mediaKeys?: string[];
    };
    publicMetrics?: {
      impressionCount?: number;
      likeCount?: number;
      retweetCount?: number;
      replyCount?: number;
    };
  }>;
  includes?: {
    media?: Array<{
      mediaKey: string;
      url?: string;
      previewImageUrl?: string;
      type?: string;
    }>;
  };
}

/**
 * Infrastructure service responsible for interacting with the X (Twitter) API v2.
 * Encapsulates the external SDK and maps responses to clean DTOs.
 */
export class XApiService implements IXApiService {
  private client: Client | null = null;
  public cachedMyUserId: string | null = null;

  constructor(private xApiConfig: XApiConfig) {
    this.client = this.createClient(xApiConfig);
    if (xApiConfig.myUserId) {
      this.cachedMyUserId = xApiConfig.myUserId;
    }
  }

  private createClient(cfg: XApiConfig): Client | null {
    const { apiKey, apiSecret, accessToken, accessSecret, bearerToken } = cfg;

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
  }

  /**
   * Resolves the authenticated user ID via getMe() and caches it.
   */
  async getMyUserId(): Promise<string | null> {
    if (this.cachedMyUserId) {
      return this.cachedMyUserId;
    }
    if (!this.client?.users?.getMe) {
      return null;
    }
    try {
      const meResponse = await this.client.users.getMe();
      const resolvedId = meResponse?.data?.id;
      if (resolvedId) {
        this.cachedMyUserId = resolvedId;
        return resolvedId;
      }
    } catch (error) {
      console.error('[XApiService] Failed to auto-resolve authenticated user ID via getMe:', error);
    }
    return null;
  }

  /**
   * Fetches recent timeline posts authored by the specified user, excluding retweets and replies.
   *
   * @param userId - Optional. The X user ID whose tweets are to be fetched. If omitted, auto-resolves via getMyUserId().
   * @param limit - Maximum number of tweets to fetch (defaults to configured syncMaxResults, max 100).
   * @returns Array of normalized TimelineTweetDto items.
   */
  async fetchRecentTimelineTweets(userId?: string, limit?: number): Promise<TimelineTweetDto[]> {
    if (!this.client) {
      console.warn('[XApiService] X API client is not configured.');
      return [];
    }

    const targetUserId = userId || this.cachedMyUserId || (await this.getMyUserId());
    if (!targetUserId) {
      console.warn('[XApiService] Target userId is not specified and could not be resolved.');
      return [];
    }

    const effectiveLimit = limit ?? this.xApiConfig.syncMaxResults ?? 100;

    const response = (await this.client.users.getPosts(targetUserId, {
      maxResults: effectiveLimit,
      exclude: ['retweets', 'replies'],
      postFields: ['created_at', 'public_metrics', 'attachments', 'text'],
      expansions: ['attachments.media_keys'],
      mediaFields: ['url', 'preview_image_url', 'type'],
    } as Parameters<typeof this.client.users.getPosts>[1])) as XdkTweetResponse;

    const tweets = response?.data || [];
    if (tweets.length === 0) {
      return [];
    }

    // Build media map for fast lookups
    const mediaMap = new Map<string, string>();
    if (response.includes?.media) {
      for (const media of response.includes.media) {
        const mediaUrl = media.url || media.previewImageUrl;
        if (media.mediaKey && mediaUrl) {
          mediaMap.set(media.mediaKey, mediaUrl);
        }
      }
    }

    return tweets.map((tweet) => {
      const pm = tweet.publicMetrics;
      const mediaKeys = tweet.attachments?.mediaKeys;

      const mediaUrls: string[] = [];
      if (Array.isArray(mediaKeys)) {
        for (const key of mediaKeys) {
          const url = mediaMap.get(key);
          if (url) mediaUrls.push(url);
        }
      }

      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.createdAt,
        impressions: pm?.impressionCount ?? 0,
        likes: pm?.likeCount ?? 0,
        reposts: pm?.retweetCount ?? 0,
        replies: pm?.replyCount ?? 0,
        mediaUrls,
      };
    });
  }
}
