import * as xApi from '../src/services/xApi';
import * as gemini from '../src/services/gemini';
import { getBasePrompt } from '../src/core/prompt';
import { downloadImage } from '../src/utils/image';
import * as xdk from '@xdevplatform/xdk';
import config from '../src/config';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    console.log('Testing Quote Retweet on master (akina-se)...');
    try {
        const oauth1Client = new xdk.OAuth1({
            apiKey: config.xApi.appKey || '',
            apiSecret: config.xApi.appSecret || '',
            callback: 'oob',
            accessToken: config.xApi.accessToken || '',
            accessTokenSecret: config.xApi.accessSecret || '',
        });
        const client = new xdk.Client({
            oauth1: oauth1Client
        });
        
        // 1. Get first user that the bot follows
        const botMe = await client.users.getMe();
        const followingRes = await client.users.getFollowing(botMe.data.id, { max_results: 5 });
        if (!followingRes.data || followingRes.data.length === 0) {
            console.log("Bot is not following anyone.");
            return;
        }
        const targetUser = followingRes.data[0];
        const userId = targetUser.id;
        console.log(`Resolved target user from following: @${targetUser.username} (${userId})`);
        
        // 2. Fetch latest tweet
        const recentTweets = await xApi.getUserTweets(userId, 5);
        if (!recentTweets.data || recentTweets.data.length === 0) {
            console.log("No recent tweets found for akina_se.");
            return;
        }
        
        const latestTweet = recentTweets.data[0];
        const targetTweetId = latestTweet.id;
        let tweetContext = `\n【直近の投稿内容】\n${latestTweet.text}`;
        
        const mediaKeys = latestTweet.attachments?.media_keys;
        if (mediaKeys && mediaKeys.length > 0 && recentTweets.includes?.media) {
            for (const media of recentTweets.includes.media) {
                if (media.type === 'photo' && media.url) {
                    console.log(`Downloading image: ${media.url}`);
                    const { buffer, mimeType } = await downloadImage(media.url);
                    const imageCaption = await gemini.analyzeImageCaption(buffer, mimeType);
                    if (imageCaption) {
                        tweetContext += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
                    }
                }
            }
        }
        
        console.log("Tweet Context:", tweetContext);
        
        const lang = await gemini.detectLanguage(tweetContext);
        const systemPrompt = getBasePrompt('random_engagement', lang);
        const userInput = `【ターゲットユーザー情報】\nユーザー名: @akina_se\n${tweetContext}\n\n上記を踏まえて、ターゲットユーザーの最新の投稿に対して不意打ちで引用リポスト（話しかけ）を行ってください。`;
        
        const generatedText = await gemini.generateReply(systemPrompt, [], userInput);
        
        let finalText = generatedText;
        if (!finalText.includes(`@akina_se`)) {
            finalText = `@akina_se\n${finalText}`;
        }
        
        console.log(`Generated Quote Retweet Text:\n${finalText}`);
        
        const tweetRes = await xApi.tweet(finalText, { quote_tweet_id: targetTweetId });
        console.log("Success! Tweet ID:", tweetRes?.data?.id);
        
    } catch (e: unknown) {
        console.error("Test failed:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.error("API Error Data:", JSON.stringify((e as any).data, null, 2));
    }
};

run();
