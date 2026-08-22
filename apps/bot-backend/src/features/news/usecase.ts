import { AppDependencies } from '../../types';
import { getBasePrompt } from '@rebecca/persona';



/**
 * Interface representing the result of a proactive news execution.
 */
export interface NewsResult {
    /** The execution status of the news job. */
    status: 'skipped' | 'success' | 'failed';
    /** A descriptive reason if the status is skipped or failed. */
    reason?: string;
    /** The content of the tweet that was posted, if successful. */
    post?: string;
    /** Indicates whether media (e.g., an image) was attached to the post. */
    attachedMedia?: boolean;
}

/**
 * Executes a batch job to proactively post a news-related tweet.
 * It fetches headlines, generates a post, infers a relevant image,
 * and posts it to the configured X (Twitter) account.
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
    async execute(): Promise<NewsResult> {
    console.log("Starting Proactive News Post Batch...");
    try {
        const headlines = await this.deps.newsFetcher.fetchYahooNewsHeadlines();
        if (headlines.length === 0) {
            console.log("No headlines fetched, skipping.");
            return { status: 'skipped', reason: 'No headlines' };
        }

        console.log("Fetched headlines:\n", headlines.join('\n'));

        const systemInstruction = getBasePrompt('timeline', 'ja');
        const newsPrompt = `以下の今日のニュースのヘッドラインから、マスターが疲れそうな話題、または共感・興奮しそうな話題（エンタメ・IT・スポーツ・気象など）を【1つだけ】選び、それに言及しながらツイートを生成してください。

【今日のニュース】
${headlines.join('\n')}

【追加ルール】
- 殺人や痛ましい事故など、過度に暗いニュースや人が亡くなっているニュースは絶対に選ばないこと。必ず明るい話題や気象、スポーツなどを選んでください。
- 【絶対に100文字以内の短文】にすること。
- 出力はツイートのテキストのみ。`;
        let postText = await this.deps.gemini.generateNewsPost(systemInstruction, newsPrompt);
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
        const searchPrompt = `あなたはAIキャラクター「レベッカ」の心情を分析するAIです。
以下のレベッカがたった今投稿しようとしているツイート文と、直近のタイムライン要約から、レベッカの現在の感情や状況を推測し、画像検索のための「検索クエリ（短い一文または単語の羅列）」を出力してください。
画像が不要だと思われる内容（事務連絡や抽象的すぎる内容）の場合は、"null" という文字列だけを出力してください。

【直近のタイムライン要約】
${timelineSummary}

【今回のツイート内容】
${postText}

出力は検索クエリのテキストのみとし、不要な解説やMarkdown表記は含めないでください。`;
        const searchQuery = await this.deps.gemini.inferImageSearchQuery(searchPrompt);
        
        const mediaIds: string[] = [];
        let bestImage: { id: string; url: string } | null = null;
        if (searchQuery) {
            console.log(`Inferred image search query: ${searchQuery}`);
            const queryVector = await this.deps.gemini.generateEmbedding(searchQuery);
            bestImage = queryVector.length > 0 ? await this.deps.firestore.findImageByVector(queryVector) : null;
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

        const tweetRes = await this.deps.xApi.tweet(postText, { mediaIds });
        const tweetId = (tweetRes as { data?: { id?: string } })?.data?.id;
        const attachedUrl = bestImage ? bestImage.url : undefined;
        const assetId = bestImage ? bestImage.id : undefined;

        await this.deps.firestore.saveTimelinePost(postText, {
            mediaUrls: attachedUrl ? [attachedUrl] : [],
            assetId,
            tweetId
        });

        return { status: 'success', post: postText, attachedMedia: mediaIds.length > 0 };
    } catch (e) {
        console.error("Error in runProactiveNewsPostBatch:", e);
        throw e;
    }
};

}
