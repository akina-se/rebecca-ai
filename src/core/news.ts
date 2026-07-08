import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import * as xApi from '../services/xApi';
import * as storage from '../services/storage';
import { getBasePrompt } from './prompt';

const fetchYahooNewsHeadlines = async () => {
    try {
        const categories = ['top-picks', 'domestic', 'entertainment', 'it', 'sports'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const url = `https://news.yahoo.co.jp/rss/topics/${randomCategory}.xml`;
        console.log(`Fetching news from: ${url}`);
        const response = await fetch(url);
        const text = await response.text();
        
        // Extract titles from RSS using simple regex (to avoid adding dependencies)
        const titleRegex = /<title>(.*?)<\/title>/g;
        let match;
        const headlines = [];
        
        while ((match = titleRegex.exec(text)) !== null) {
            const title = match[1];
            // Remove noise like Yahoo News site names
            if (title !== 'Yahoo!ニュース・トピックス - 主要' && !title.includes('Yahoo!')) {
                headlines.push(title);
            }
        }
        
        // Return top 5 items
        return headlines.slice(0, 5);
    } catch (e) {
        console.error("Failed to fetch news", e);
        return [];
    }
};

const runProactiveNewsPostBatch = async () => {
    console.log("Starting Proactive News Post Batch...");
    try {
        const headlines = await fetchYahooNewsHeadlines();
        if (headlines.length === 0) {
            console.log("No headlines fetched, skipping.");
            return { status: 'skipped', reason: 'No headlines' };
        }

        console.log("Fetched headlines:\n", headlines.join('\n'));

        // Generate tweet
        const systemInstruction = getBasePrompt('timeline', 'ja');
        let postText = await gemini.generateNewsPost(systemInstruction, headlines);
        if (!postText) {
            console.log("Failed to generate news post.");
            return { status: 'failed', reason: 'Generation failed' };
        }

        // Tagging feature: Append a hashtag only if character limits allow
        const hashtag = "\n#全肯定AIレベッカ";
        if (postText.length + hashtag.length <= 140) {
            postText += hashtag;
        }

        console.log("Generated Post:", postText);

        // 2-step: Infer keyword based on the generated text and recent timeline
        const timelineSummary = await firestore.getTimelineSummary();
        const searchQuery = await gemini.inferImageSearchQuery(postText, timelineSummary);
        
        const mediaIds: string[] = [];
        if (searchQuery) {
            console.log(`Inferred image search query: ${searchQuery}`);
            const queryVector = await gemini.generateEmbedding(searchQuery);
            const bestImage = queryVector.length > 0 ? await firestore.findImageByVector(queryVector) : null;
            if (bestImage) {
                console.log(`Found matching image: ${bestImage.url}`);
                try {
                    // Download from GCS privately
                    const buffer = await storage.downloadImage(bestImage.url);
                    // Determine mimetype from extension (defaulting to jpeg if unknown)
                    let mimeType = 'image/jpeg';
                    if (bestImage.url.endsWith('.png')) mimeType = 'image/png';
                    else if (bestImage.url.endsWith('.gif')) mimeType = 'image/gif';
                    
                    // Upload to X
                    const mediaId = await xApi.uploadMedia(buffer, mimeType);
                    if (mediaId && mediaId !== 'mock_media_id') {
                        mediaIds.push(mediaId);
                        await firestore.updateImageLastUsed(bestImage.id);
                        console.log(`Attached media ID: ${mediaId}`);
                    }
                } catch (e) {
                    console.error("Failed to attach image to post:", e);
                }
            } else {
                console.log("No matching image found or all are in cooldown.");
            }
        }

        // Post to X
        await xApi.tweet(postText, mediaIds);
        
        // Save history to Firestore
        await firestore.saveTimelinePost(postText);

        return { status: 'success', post: postText, attachedMedia: mediaIds.length > 0 };
    } catch (e) {
        console.error("Error in runProactiveNewsPostBatch:", e);
        throw e;
    }
};

export { 
    runProactiveNewsPostBatch,
    fetchYahooNewsHeadlines
 };
