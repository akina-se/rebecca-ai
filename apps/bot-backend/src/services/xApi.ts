import { Client, OAuth1 } from '@xdevplatform/xdk';
import type { 
  XApiCreateResponse, 
  XApiMentionResponse, 
  XApiUser, 
  XApiFollowersResponse,
  XApiTweetDetailsResponse,
  IXApiService
} from '../types';

/**
 * Configuration options required by XApiService.
 */
export interface XApiServiceConfig {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  accessSecret?: string;
  myUserId?: string;
  targetListId?: string;
  followersPageSize?: number;
  followersMaxResults?: number;
}

/**
 * Encapsulates interactions with the X (formerly Twitter) platform.
 * Implements IXApiService with explicit constructor injection, eliminating ambient config coupling.
 */
export class XApiService implements IXApiService {
  private client: Client | null = null;
  private oauth1Client: OAuth1 | null = null;
  public cachedNumericMyUserId: string | null = null;

  constructor(
    private readonly config: XApiServiceConfig,
    client?: Client,
    oauth1Client?: OAuth1,
  ) {
    if (client) {
      this.client = client;
      this.oauth1Client = oauth1Client ?? null;
    } else if (config.appKey) {
      this.oauth1Client = new OAuth1({
        apiKey: config.appKey,
        apiSecret: config.appSecret ?? '',
        callback: 'oob',
        accessToken: config.accessToken ?? '',
        accessTokenSecret: config.accessSecret ?? '',
      });
      this.client = new Client({
        oauth1: this.oauth1Client,
      });
    }
  }

  /**
   * Posts a reply to a specific tweet.
   *
   * @param tweetId - The unique identifier of the tweet being replied to.
   * @param text - The textual content of the reply.
   * @param options - Optional media attachment IDs.
   * @returns A Promise that resolves to the newly created tweet data.
   */
  async replyToMention(
    tweetId: string,
    text: string,
    options?: { mediaIds?: string[] }
  ): Promise<XApiCreateResponse> {
    if (!this.client) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id', text } };
    }
    try {
      const payload: Record<string, unknown> = {
        text,
        reply: { inReplyToTweetId: tweetId }
      };
      if (options?.mediaIds && options.mediaIds.length > 0) {
        payload.media = { media_ids: options.mediaIds };
      }
      const response = await this.client.posts.create(payload as Parameters<typeof this.client.posts.create>[0]);
      return response as unknown as XApiCreateResponse;
    } catch (error) {
      console.error('Error replying to mention:', error);
      throw error;
    }
  }

  /**
   * Retrieves detailed information for a specific tweet by its ID.
   *
   * @param tweetId - The unique identifier of the target tweet.
   * @returns A Promise resolving to tweet details.
   */
  async getTweetDetails(tweetId: string): Promise<XApiTweetDetailsResponse> {
    if (!this.client) return {};
    try {
      const response = await this.client.posts.getById(tweetId, {
        expansions: ['attachments.media_keys'],
        'media.fields': ['url', 'type']
      } as Parameters<typeof this.client.posts.getById>[1]);
      return response as unknown as XApiTweetDetailsResponse;
    } catch (error) {
      console.error('Error getting tweet details:', error);
      throw error;
    }
  }

  /**
   * Uploads raw media data to the X platform and returns the allocated media identifier.
   *
   * @param buffer - The binary buffer containing the media file data.
   * @param mimeType - The MIME type of the media.
   * @returns The media identifier string.
   */
  async uploadMedia(buffer: Buffer, mimeType: string): Promise<string | null> {
    if (!this.client || !this.oauth1Client) {
      throw new Error('Twitter API client not initialized');
    }
    try {
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const form = new FormData();
      form.append('media', blob, 'image.jpg');

      const url = 'https://upload.twitter.com/1.1/media/upload.json';
      const authHeader = await this.oauth1Client.buildRequestHeader('POST', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader
        },
        body: form
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Upload failed: ${JSON.stringify(data)}`);
      }
      return data.media_id_string;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }

  /**
   * Publishes a new top-level tweet, optionally attaching media or quoting an existing tweet.
   *
   * @param text - The primary text content of the tweet.
   * @param options - Optional configuration for media IDs and quote tweet ID.
   * @returns A Promise resolving to the newly created tweet data.
   */
  async tweet(text: string, options?: { mediaIds?: string[], quote_tweet_id?: string }): Promise<XApiCreateResponse> {
    if (!this.client) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id', text } };
    }
    try {
      const payload: Record<string, unknown> = { text };
      if (options?.mediaIds && options.mediaIds.length > 0) {
        payload.media = { media_ids: options.mediaIds };
      }
      if (options?.quote_tweet_id) {
        payload.quote_tweet_id = options.quote_tweet_id;
      }
      const response = await this.client.posts.create(payload as Parameters<typeof this.client.posts.create>[0]);
      return response as unknown as XApiCreateResponse;
    } catch (error) {
      console.error('Error posting tweet:', error);
      throw error;
    }
  }

  /**
   * Fetches the public profile information for a given X user.
   *
   * @param userId - The unique identifier of the target user.
   * @returns The user's profile data.
   */
  async getUserProfile(userId: string): Promise<{ data: XApiUser }> {
    if (!this.client) throw new Error('X API client is not initialized');
    try {
      const response = await this.client.users.getById(userId, {
        'user.fields': ['description']
      } as Parameters<typeof this.client.users.getById>[1]);
      return response as unknown as { data: XApiUser };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Retrieves recent tweet mentions directed at the currently authenticated bot user.
   *
   * @param sinceId - Optional lower bound tweet ID.
   * @returns The mentions payload.
   */
  async getMentions(sinceId?: string): Promise<XApiMentionResponse> {
    if (!this.client) return { data: [], meta: { resultCount: 0 } };
    try {
      let userId = this.config.myUserId;
      if (!userId) {
        console.error('X_MY_USER_ID is not set in config!');
        return { data: [], meta: { resultCount: 0 } };
      }

      if (!/^\d+$/.test(userId)) {
        if (!this.cachedNumericMyUserId) {
          const me = await this.client.users.getMe();
          this.cachedNumericMyUserId = me.data.id;
          console.log(`Resolved numeric user ID for bot: ${this.cachedNumericMyUserId}`);
        }
        userId = this.cachedNumericMyUserId;
      }

      const params: Record<string, unknown> = {
        "max_results": 100,
        "tweet.fields": ["created_at", "text", "author_id", "in_reply_to_user_id", "referenced_tweets", "conversation_id"]
      };
      if (sinceId) {
        params.since_id = sinceId;
      }
      
      const response = await this.client.users.getMentions(userId, params as Parameters<typeof this.client.users.getMentions>[1]);
      return response as unknown as XApiMentionResponse;
    } catch (error) {
      console.error('Error fetching mentions:', error);
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of followers for a specified user ID.
   *
   * @param userId - The unique identifier of the user.
   * @param paginationToken - Optional pagination token.
   * @param pageSize - Optional page size.
   * @returns Followers response.
   */
  async getFollowers(userId: string, paginationToken?: string, pageSize?: number): Promise<XApiFollowersResponse> {
    if (!this.client) return { data: [], meta: { resultCount: 0 } };
    try {
      const effectivePageSize = pageSize ?? this.config.followersPageSize ?? 10;
      const params: Record<string, unknown> = {
        max_results: effectivePageSize
      };
      if (paginationToken) {
        params.pagination_token = paginationToken;
      }
      
      const response = await this.client.users.getFollowers(userId, params as Parameters<typeof this.client.users.getFollowers>[1]);
      return response as unknown as XApiFollowersResponse;
    } catch (error) {
      console.error('Error getting followers:', error);
      throw error;
    }
  }

  /**
   * Adds a specified user to a curated X list.
   *
   * @param listId - The unique identifier of the target list.
   * @param userId - The unique identifier of the user to add.
   * @returns True if successful, false if uninitialized.
   */
  async addListMember(listId: string, userId: string): Promise<boolean> {
    if (!this.oauth1Client) return false;
    try {
      const url = `https://api.twitter.com/2/lists/${listId}/members`;
      const authHeader = await this.oauth1Client.buildRequestHeader('POST', url);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(`Failed to add list member: ${JSON.stringify(errData)}`);
      }
      return true;
    } catch (error) {
      console.error('Error adding list member:', error);
      throw error;
    }
  }

  /**
   * Retrieves recent original tweets authored by a specific user.
   *
   * @param userId - Target author user ID.
   * @param maxResults - Maximum results to retrieve (default 5).
   * @returns User tweets payload.
   */
  async getUserTweets(userId: string, maxResults: number = 5): Promise<XApiMentionResponse> {
    if (!this.client) return { data: [] };
    try {
      const response = await this.client.users.getPosts(userId, {
        max_results: maxResults,
        exclude: ['retweets', 'replies'],
        expansions: ['attachments.media_keys'],
        'media.fields': ['url', 'type']
      } as Parameters<typeof this.client.users.getPosts>[1]);
      return response as unknown as XApiMentionResponse;
    } catch (error) {
      console.error('Error getting user tweets:', error);
      throw error;
    }
  }

  /**
   * Deletes a previously published tweet by its ID.
   *
   * @param tweetId - The unique identifier of the tweet to be deleted.
   * @returns True if deletion succeeded.
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    if (!tweetId || !/^\d+$/.test(tweetId)) {
      throw new Error(`Invalid tweet ID: expected numeric ID string, received "${tweetId}"`);
    }
    if (!this.client && !this.oauth1Client) {
      throw new Error('Twitter API client not initialized');
    }
    try {
      const postsObj = (this.client?.posts ?? {}) as unknown as Record<string, unknown>;
      if (typeof postsObj['destroy'] === 'function') {
        await (postsObj['destroy'] as (id: string) => Promise<unknown>)(tweetId);
        return true;
      } else if (typeof postsObj['delete'] === 'function') {
        await (postsObj['delete'] as (id: string) => Promise<unknown>)(tweetId);
        return true;
      } else if (this.oauth1Client) {
        const url = `https://api.twitter.com/2/tweets/${tweetId}`;
        const authHeader = await this.oauth1Client.buildRequestHeader('DELETE', url);
        const res = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': authHeader,
          }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Failed to delete tweet: ${JSON.stringify(errData)}`);
        }
        return true;
      }
      throw new Error('No client or oauth1Client available to delete tweet');
    } catch (error) {
      console.error('Error deleting tweet:', error);
      throw error;
    }
  }
}
