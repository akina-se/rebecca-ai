import { AppDependencies } from '../../types';
import { getBasePrompt } from '@rebecca/persona';



/**
 * Executes a batch job to proactively post a news-related tweet.
 * It fetches headlines, generates a post, infers a relevant image,
 * and posts it to the configured X (Twitter) account.
 * 
 * @returns A promise resolving to an object indicating the status of the operation.
 */
export class ProactiveNewsUseCase {
    /**
     * Initializes the ProactiveNewsUseCase.
     * @param deps Application dependencies including repositories, APIs, and AI services.
     */
    constructor(private deps: AppDependencies) {}
    /**
     * Executes the process to fetch headlines, generate a post, attach an image, and tweet.
     * @returns A promise resolving to an object indicating the status of the operation, the post content, and whether media was attached.
     */
    async execute(): Promise<any> {
    console.log("Starting Proactive News Post Batch...");
    try {
        const headlines = await this.deps.newsFetcher.fetchYahooNewsHeadlines();
        if (headlines.length === 0) {
            console.log("No headlines fetched, skipping.");
            return { status: 'skipped', reason: 'No headlines' };
        }

        console.log("Fetched headlines:\n", headlines.join('\n'));

        const systemInstruction = getBasePrompt('timeline', 'ja');
        let postText = await this.deps.gemini.generateNewsPost(systemInstruction, headlines);
        if (!postText) {
            console.log("Failed to generate news post.");
            return { status: 'failed', reason: 'Generation failed' };
        }

        const hashtag = "\n#全肯定AIレベッカ";
        if (postText.length + hashtag.length <= 140) {
            postText += hashtag;
        }

        console.log("Generated Post:", postText);

        const timelineSummary = await this.deps.firestore.getTimelineSummary();
        const searchQuery = await this.deps.gemini.inferImageSearchQuery(postText, timelineSummary);
        
        const mediaIds: string[] = [];
        if (searchQuery) {
            console.log(`Inferred image search query: ${searchQuery}`);
            const queryVector = await this.deps.gemini.generateEmbedding(searchQuery);
            const bestImage = queryVector.length > 0 ? await this.deps.firestore.findImageByVector(queryVector) : null;
            if (bestImage) {
                console.log(`Found matching image: ${bestImage.url}`);
                try {
                    const buffer = await this.deps.storage.downloadImage(bestImage.url);
                    let mimeType = 'image/jpeg';
                    if (bestImage.url.endsWith('.png')) mimeType = 'image/png';
                    else if (bestImage.url.endsWith('.gif')) mimeType = 'image/gif';
                    
                    const mediaId = await this.deps.xApi.uploadMedia(buffer, mimeType);
                    if (mediaId && mediaId !== 'mock_media_id') {
                        mediaIds.push(mediaId);
                        await this.deps.firestore.updateImageLastUsed(bestImage.id);
                        console.log(`Attached media ID: ${mediaId}`);
                    }
                } catch (e) {
                    console.error("Failed to attach image to post:", e);
                }
            } else {
                console.log("No matching image found or all are in cooldown.");
            }
        }

        await this.deps.xApi.tweet(postText, { mediaIds });
        
        await this.deps.firestore.saveTimelinePost(postText);

        return { status: 'success', post: postText, attachedMedia: mediaIds.length > 0 };
    } catch (e) {
        console.error("Error in runProactiveNewsPostBatch:", e);
        throw e;
    }
};

}
