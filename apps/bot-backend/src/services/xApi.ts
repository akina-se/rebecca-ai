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
 * X API client instance.
 */
let client: Client | null = null;

/**
 * X API OAuth1 client instance used for signing requests.
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
 * Replies to a specific tweet ID with the provided text.
 * 
 * @param tweetId - The ID of the tweet to reply to.
 * @param text - The content of the reply.
 * @returns A promise resolving to the created post data.
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
 * Retrieves details for a specific tweet by ID, including associated media.
 * 
 * @param tweetId - The ID of the tweet.
 * @returns A promise resolving to the tweet data object.
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
 * Uploads media to X platform and retrieves the corresponding media ID.
 * 
 * @param buffer - The media file buffer to upload.
 * @param mimeType - The MIME type of the media file.
 * @returns A promise resolving to the media ID string.
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
 * Publishes a new tweet optionally attaching media files or quoting another tweet.
 * 
 * @param text - The content of the tweet.
 * @param options - Optional parameters for the tweet (e.g., mediaIds, quote_tweet_id).
 * @returns A promise resolving to the created post data.
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
 * Retrieves the public profile information of an X user.
 * 
 * @param userId - The ID of the user.
 * @returns A promise resolving to the user profile data.
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
 * Cached internal numeric user ID of the authenticated bot.
 */
let cachedNumericMyUserId: string | null = null;

/**
 * Retrieves recent mentions directed at the authenticated bot user.
 * 
 * @param sinceId - Optional tweet ID to fetch mentions after.
 * @returns A promise resolving to the list of mention data.
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
 * Retrieves the followers for a specified user ID.
 * 
 * @param userId - The ID of the user.
 * @param paginationToken - Optional token for pagination.
 * @returns A promise resolving to the followers data object.
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
 * Adds a specified user to an X list.
 * 
 * @param listId - The ID of the list.
 * @param userId - The ID of the user to add.
 * @returns A promise resolving to true if successful.
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
 * Retrieves the current members of an X list.
 * 
 * @param listId - The ID of the list.
 * @returns A promise resolving to the list members response.
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
 * Retrieves the recent tweets of a user.
 * 
 * @param userId - The ID of the user.
 * @param maxResults - The maximum number of tweets to retrieve (default 5).
 * @returns A promise resolving to the user's tweets data.
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

const deleteTweet = async (tweetId: string): Promise<boolean> => {
    if (!client) {
        console.warn('Twitter API client not initialized. Mocking tweet deletion.');
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

