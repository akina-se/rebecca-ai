import { Client, OAuth1 } from '@xdevplatform/xdk';
import config from '../config';

// Initialize client if credentials exist, otherwise let it be empty (e.g. during test)
let client: Client | null = null;
if (config.xApi.appKey) {
  const oauth1 = new OAuth1({
    apiKey: config.xApi.appKey,
    apiSecret: config.xApi.appSecret,
    callback: 'oob',
    accessToken: config.xApi.accessToken,
    accessTokenSecret: config.xApi.accessSecret,
  });
  client = new Client({
    oauth1
  });
}

const replyToMention = async (tweetId: string, text: string) => {
  if (!client) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id' } };
  }
    try {
    const response = await client.posts.create({
      text,
      reply: { in_reply_to_tweet_id: tweetId }
    } as any);
    return response as any;
  } catch (error) {
    console.error('Error replying to mention:', error);
    throw error;
  }
};

const getTweetDetails = async (tweetId: string) => {
    if (!client) return { data: null };
    try {
        const response = await client.posts.getById(tweetId, {
            expansions: ['attachments.media_keys'],
            'media.fields': ['url']
        } as any);
        return response as any;
    } catch (error) {
        console.error('Error getting tweet details:', error);
        throw error;
    }
}

const tweet = async (text: string) => {
  if (!client) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id' } };
  }
  try {
    const response = await client.posts.create({ text } as any);
    return response as any;
  } catch (error) {
    console.error('Error posting tweet:', error);
    throw error;
  }
};

const getUserProfile = async (userId: string) => {
    if (!client) return { data: { description: 'ダミーのプロフィール文です。仕事に疲れています。' } };
    try {
        const response = await client.users.getById(userId, {
            'user.fields': ['description']
        } as any);
        return response as any;
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
    }
}

export { 
  replyToMention,
  getTweetDetails,
  tweet,
  getUserProfile
};
