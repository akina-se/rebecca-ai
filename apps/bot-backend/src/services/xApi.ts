import { Client, OAuth1 } from '@xdevplatform/xdk';
import config from '../config';
import type { 
    XApiCreateResponse, 
    XApiMentionResponse, 
    XApiUser, 
    XApiFollowersResponse,
    XApiListMembersResponse,
    XApiTweetDetailsResponse
} from '../types';

/**
 * Singleton instance of the X (Twitter) API v2 client.
 * Handles primary interactions with the X platform endpoints.
 */
let client: Client | null = null;

/**
 * OAuth 1.0a client instance for the X API.
 * Required specifically for generating signatures for media uploads and certain legacy endpoint access.
 */
let oauth1Client: OAuth1 | null = null;

if (config.xApi.appKey) {
  oauth1Client = new OAuth1({
    apiKey: config.xApi.appKey,
    apiSecret: config.xApi.appSecret,
    callback: 'oob',
    accessToken: config.xApi.accessToken,
    accessTokenSecret: config.xApi.accessSecret,
  });
  client = new Client({
    oauth1: oauth1Client
  });
}

/**
 * Posts a reply to a specific tweet.
 *
 * This function handles sending a targeted response to an existing tweet thread.
 * If the API client is uninitialized, it falls back to returning a mock response.
 *
 * @param tweetId - The unique identifier of the tweet being replied to.
 * @param text - The textual content of the reply.
 * @returns A Promise that resolves to the newly created tweet data (`XApiCreateResponse`).
 * @throws {Error} If the API request fails unexpectedly.
 */
const replyToMention = async (tweetId: string, text: string): Promise<XApiCreateResponse> => {
  if (!client) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id', text } };
  }
    try {
    const response = await client.posts.create({
      text,
      reply: { in_reply_to_tweet_id: tweetId }
    } as Parameters<typeof client.posts.create>[0]);
    return response as unknown as XApiCreateResponse;
  } catch (error) {
    console.error('Error replying to mention:', error);
    throw error;
  }
};

/**
 * Retrieves detailed information for a specific tweet by its ID.
 *
 * Requests additional expansions specifically to fetch associated media keys and metadata
 * (e.g., images, videos) attached to the tweet.
 *
 * @param tweetId - The unique identifier of the target tweet.
 * @returns A Promise that resolves to the tweet details (`XApiTweetDetailsResponse`), or an empty object if the client is missing.
 * @throws {Error} If the fetch operation fails due to network or authentication issues.
 */
const getTweetDetails = async (tweetId: string): Promise<XApiTweetDetailsResponse> => {
    if (!client) return { };
    try {
        const response = await client.posts.getById(tweetId, {
            expansions: ['attachments.media_keys'],
            'media.fields': ['url', 'type']
        } as Parameters<typeof client.posts.getById>[1]);
        return response as unknown as XApiTweetDetailsResponse;
    } catch (error) {
        console.error('Error getting tweet details:', error);
        throw error;
    }
}

/**
 * Uploads raw media data to the X platform and returns the allocated media identifier.
 *
 * Utilizes the legacy 1.1 `media/upload` endpoint and OAuth 1.0a authentication, as v2 media
 * upload support is limited. Returns a mock identifier if clients are uninitialized.
 *
 * @param buffer - The binary buffer containing the media file data.
 * @param mimeType - The MIME type of the media (e.g., 'image/jpeg', 'video/mp4').
 * @returns A Promise that resolves to the string identifier (`media_id_string`) for the uploaded asset.
 * @throws {Error} If the upload request fails or returns a non-200 status code.
 */
const uploadMedia = async (buffer: Buffer, mimeType: string) => {
    if (!client || !oauth1Client) {
        console.warn('Twitter API client not initialized. Mocking media upload.');
        return 'mock_media_id';
    }
    try {
        const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
        const form = new FormData();
        form.append('media', blob, 'image.jpg');

        const url = 'https://upload.twitter.com/1.1/media/upload.json';
        const authHeader = await oauth1Client.buildRequestHeader('POST', url);

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
};

/**
 * Publishes a new top-level tweet, optionally attaching media or quoting an existing tweet.
 *
 * @param text - The primary text content of the tweet.
 * @param options - Optional configuration for the tweet.
 * @param options.mediaIds - An array of previously uploaded media IDs to attach to the tweet.
 * @param options.quote_tweet_id - The ID of another tweet to quote.
 * @returns A Promise that resolves to the newly created tweet data (`XApiCreateResponse`).
 * @throws {Error} If the API request is rejected.
 */
const tweet = async (text: string, options?: { mediaIds?: string[], quote_tweet_id?: string }): Promise<XApiCreateResponse> => {
  if (!client) {
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
    const response = await client.posts.create(payload as Parameters<typeof client.posts.create>[0]);
    return response as unknown as XApiCreateResponse;
  } catch (error) {
    console.error('Error posting tweet:', error);
    throw error;
  }
};

/**
 * Fetches the public profile information for a given X user.
 *
 * Extends the default user payload to include the user's profile `description`.
 *
 * @param userId - The unique identifier of the target user.
 * @returns A Promise resolving to an object containing the user's profile data (`XApiUser`).
 * @throws {Error} If the request fails.
 */
const getUserProfile = async (userId: string): Promise<{ data: XApiUser }> => {
    if (!client) return { data: { id: userId, name: 'Dummy', username: 'dummy', description: 'ダミーのプロフィール文です。仕事に疲れています。' } };
    try {
        const response = await client.users.getById(userId, {
            'user.fields': ['description']
        } as Parameters<typeof client.users.getById>[1]);
        return response as unknown as { data: XApiUser };
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
    }
}

/**
 * In-memory cache for the authenticated bot's internal numeric user ID.
 * Used to avoid redundant `getMe` API calls when resolving self-referential endpoints.
 */
let cachedNumericMyUserId: string | null = null;

/**
 * Retrieves recent tweet mentions directed at the currently authenticated bot user.
 *
 * Dynamically resolves the bot's numeric user ID if not provided directly in the configuration.
 * Requests extended tweet fields such as `created_at` and `conversation_id` for context.
 *
 * @param sinceId - Optional. A tweet ID acting as a lower bound; only mentions newer than this ID are returned.
 * @returns A Promise resolving to a payload of mentions (`XApiMentionResponse`), capped at 100 results.
 * @throws {Error} If the fetch operation encounters a problem.
 */
const getMentions = async (sinceId?: string): Promise<XApiMentionResponse> => {
    if (!client) return { data: [], meta: { resultCount: 0 } };
    try {
        let userId = config.xApi.myUserId;
        if (!userId) {
            console.error('X_MY_USER_ID is not set in config!');
            return { data: [], meta: { resultCount: 0 } };
        }

        if (!/^\d+$/.test(userId)) {
            if (!cachedNumericMyUserId) {
                const me = await client.users.getMe();
                cachedNumericMyUserId = me.data.id;
                console.log(`Resolved numeric user ID for bot: ${cachedNumericMyUserId}`);
            }
            userId = cachedNumericMyUserId;
        }

        const params: Record<string, unknown> = {
            "max_results": 100,
            "expansions": ["author_id"],
            "tweet.fields": ["created_at", "text", "author_id", "in_reply_to_user_id", "referenced_tweets", "conversation_id"]
        };
        if (sinceId) {
            params.since_id = sinceId;
        }
        
        const response = await client.users.getMentions(userId, params as Parameters<typeof client.users.getMentions>[1]);
        return response as unknown as XApiMentionResponse;
    } catch (error) {
        console.error('Error fetching mentions:', error);
        throw error;
    }
}

/**
 * Retrieves a paginated list of followers for a specified user ID.
 *
 * @param userId - The unique identifier of the user whose followers are being queried.
 * @param paginationToken - Optional. A token retrieved from a previous request to fetch the next page of results.
 * @returns A Promise resolving to the followers data (`XApiFollowersResponse`).
 * @throws {Error} If the API request fails.
 */
const getFollowers = async (userId: string, paginationToken?: string): Promise<XApiFollowersResponse> => {
    if (!client) return { data: [], meta: { resultCount: 0 } };
    try {
        const params: Record<string, unknown> = {
            max_results: config.xApi.followersMaxResults || 1000
        };
        if (paginationToken) {
            params.pagination_token = paginationToken;
        }
        
        const response = await client.users.getFollowers(userId, params as Parameters<typeof client.users.getFollowers>[1]);
        return response as unknown as XApiFollowersResponse;
    } catch (error) {
        console.error('Error getting followers:', error);
        throw error;
    }
};

/**
 * Adds a specified user to a curated X list.
 *
 * Uses direct HTTP fetching with OAuth 1.0a headers, as this specific v2 endpoint
 * management might require distinct authorization parameters.
 *
 * @param listId - The unique identifier of the target list.
 * @param userId - The unique identifier of the user to be added.
 * @returns A Promise resolving to `true` if the operation was successful, or `false` if the OAuth client is uninitialized.
 * @throws {Error} If the API responds with a failure status code.
 */
const addListMember = async (listId: string, userId: string): Promise<boolean> => {
    if (!oauth1Client) return false;
    try {
        const url = `https://api.twitter.com/2/lists/${listId}/members`;
        const authHeader = await oauth1Client.buildRequestHeader('POST', url);
        
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
};

/**
 * Retrieves the current members belonging to a specified X list.
 *
 * Queries up to 100 members per request. Built using standard `fetch` with OAuth 1.0a signatures.
 *
 * @param listId - The unique identifier of the target list.
 * @returns A Promise resolving to the list's member data (`XApiListMembersResponse`).
 * @throws {Error} If the list cannot be fetched or the user lacks authorization.
 */
const getListMembers = async (listId: string): Promise<XApiListMembersResponse> => {
    if (!client) return { data: [], meta: { resultCount: 0 } };
    try {
        if (!oauth1Client) throw new Error('OAuth1 client required');
        const url = `https://api.twitter.com/2/lists/${listId}/members?max_results=100`;
        const authHeader = await oauth1Client.buildRequestHeader('GET', url);
        
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(`Failed to get list members: ${JSON.stringify(errData)}`);
        }
        const data = await res.json();
        return data as XApiListMembersResponse;
    } catch (error) {
        console.error('Error getting list members:', error);
        throw error;
    }
};

/**
 * Retrieves recent original tweets authored by a specific user.
 *
 * Explicitly excludes retweets and replies to focus on standalone posts.
 * Includes associated media metadata in the response payload.
 *
 * @param userId - The unique identifier of the target author.
 * @param maxResults - The maximum number of tweets to retrieve. Defaults to `5`.
 * @returns A Promise resolving to the timeline payload (`XApiMentionResponse`).
 * @throws {Error} If the retrieval request fails.
 */
const getUserTweets = async (userId: string, maxResults: number = 5): Promise<XApiMentionResponse> => {
    if (!client) return { data: [] };
    try {
        const response = await client.users.getPosts(userId, {
            max_results: maxResults,
            exclude: ['retweets', 'replies'],
            expansions: ['attachments.media_keys'],
            'media.fields': ['url', 'type']
        } as Parameters<typeof client.users.getPosts>[1]);
        return response as unknown as XApiMentionResponse;
    } catch (error) {
        console.error('Error getting user tweets:', error);
        throw error;
    }
};

/**
 * Deletes a previously published tweet by its ID.
 *
 * Uses a heuristic approach to determine the correct deletion method across different client versions,
 * falling back to a direct fetch with OAuth 1.0a if standard SDK methods are unavailable.
 *
 * @param tweetId - The unique identifier of the tweet to be deleted.
 * @returns A Promise resolving to `true` if the deletion was successful.
 * @throws {Error} If the deletion request fails or no valid client is available.
 */
const deleteTweet = async (tweetId: string): Promise<boolean> => {
    if (!client || !/^\d+$/.test(tweetId)) {
        console.warn(`Twitter API client not initialized or test ID detected (${tweetId}). Mocking tweet deletion.`);
        return true;
    }
    try {
        const postsObj = client.posts as unknown as Record<string, unknown>;
        if (typeof postsObj['destroy'] === 'function') {
            await (postsObj['destroy'] as (id: string) => Promise<unknown>)(tweetId);
            return true;
        } else if (typeof postsObj['delete'] === 'function') {
            await (postsObj['delete'] as (id: string) => Promise<unknown>)(tweetId);
            return true;
        } else if (oauth1Client) {
            const url = `https://api.twitter.com/2/tweets/${tweetId}`;
            const authHeader = await oauth1Client.buildRequestHeader('DELETE', url);
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
};

export { 
  replyToMention,
  getTweetDetails,
  tweet,
  uploadMedia,
  getUserProfile,
  getMentions,
  getFollowers,
  addListMember,
  getListMembers,
  getUserTweets,
  deleteTweet,
  cachedNumericMyUserId
};

