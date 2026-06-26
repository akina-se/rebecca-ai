import { TwitterApi  } from 'twitter-api-v2';
import config from '../config';

// Initialize client if credentials exist, otherwise let it be empty (e.g. during test)
let rwClient = null;
if (config.xApi.appKey) {
  const client = new TwitterApi({
    appKey: config.xApi.appKey,
    appSecret: config.xApi.appSecret,
    accessToken: config.xApi.accessToken,
    accessSecret: config.xApi.accessSecret,
  });
  rwClient = client.readWrite;
}

const replyToMention = async (tweetId, text) => {
  if (!rwClient) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id' } };
  }
  try {
    const response = await rwClient.v2.reply(text, tweetId);
    return response;
  } catch (error) {
    console.error('Error replying to mention:', error);
    throw error;
  }
};

const getTweetDetails = async (tweetId) => {
    if (!rwClient) return { data: null };
    try {
        const response = await rwClient.v2.singleTweet(tweetId, {
            expansions: ['attachments.media_keys'],
            'media.fields': ['url']
        });
        return response;
    } catch (error) {
        console.error('Error getting tweet details:', error);
        throw error;
    }
}

const tweet = async (text) => {
  if (!rwClient) {
      console.warn('Twitter API client not initialized. Skipping actual API call.');
      return { data: { id: 'mock_tweet_id' } };
  }
  try {
    const response = await rwClient.v2.tweet(text);
    return response;
  } catch (error) {
    console.error('Error posting tweet:', error);
    throw error;
  }
};

const getUserProfile = async (userId) => {
    if (!rwClient) return { data: { description: 'ダミーのプロフィール文です。仕事に疲れています。' } };
    try {
        const response = await rwClient.v2.user(userId, {
            'user.fields': ['description']
        });
        return response;
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
