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
  fetchRecentTimelineTweets(userId: string, limit?: number): Promise<TimelineTweetDto[]>;
}

/**
 * Infrastructure service responsible for interacting with the X (Twitter) API v2.
 * Encapsulates the external SDK and maps responses to clean DTOs.
 */
export class XApiService implements IXApiService {
  private client: Client | null = null;

  constructor(xApiConfig: XApiConfig) {
    this.client = this.createClient(xApiConfig);
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
   * Fetches recent timeline posts authored by the specified user, excluding retweets and replies.
   *
   * @param userId - The X user ID whose tweets are to be fetched.
   * @param limit - Maximum number of tweets to fetch (defaults to 100).
   * @returns Array of normalized TimelineTweetDto items.
   */
  async fetchRecentTimelineTweets(userId: string, limit = 100): Promise<TimelineTweetDto[]> {
    if (!this.client) {
      console.warn('[XApiService] X API client is not configured.');
      return [];
    }

    if (!userId) {
      console.warn('[XApiService] Target userId is not specified.');
      return [];
    }

    const response = (await this.client.users.getPosts(userId, {
      max_results: limit,
      exclude: ['retweets', 'replies'],
      'tweet.fields': ['created_at', 'public_metrics', 'attachments', 'text'],
      expansions: ['attachments.media_keys'],
      'media.fields': ['url', 'preview_image_url', 'type'],
    } as Parameters<typeof this.client.users.getPosts>[1])) as {
      data?: Array<{
        id: string;
        text: string;
        created_at?: string;
        public_metrics?: {
          impression_count?: number;
          like_count?: number;
          retweet_count?: number;
          reply_count?: number;
        };
        attachments?: {
          media_keys?: string[];
        };
      }>;
      includes?: {
        media?: Array<{
          media_key: string;
          url?: string;
          preview_image_url?: string;
        }>;
      };
    };

    const tweets = response?.data || [];
    if (tweets.length === 0) {
      return [];
    }

    // Build media map for fast lookups
    const mediaMap = new Map<string, string>();
    if (response.includes?.media) {
      for (const media of response.includes.media) {
        const mediaUrl = media.url || media.preview_image_url;
        if (media.media_key && mediaUrl) {
          mediaMap.set(media.media_key, mediaUrl);
        }
      }
    }

    return tweets.map((tweet) => {
      const metrics = tweet.public_metrics || {};
      const mediaUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const url = mediaMap.get(key);
          if (url) mediaUrls.push(url);
        }
      }

      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        impressions: typeof metrics.impression_count === 'number' ? metrics.impression_count : 0,
        likes: typeof metrics.like_count === 'number' ? metrics.like_count : 0,
        reposts: typeof metrics.retweet_count === 'number' ? metrics.retweet_count : 0,
        replies: typeof metrics.reply_count === 'number' ? metrics.reply_count : 0,
        mediaUrls,
      };
    });
  }
}
