/**
 * @fileoverview Unified publisher for proactive timeline posts (News and Soliloquy).
 * Handles multimodal image inference, vector retrieval, re-ranking, asset upload,
 * tweet publication, and timeline history persistence.
 */
import { AppDependencies } from '../types';

export interface PublishTimelinePostOptions {
  postText: string;
  thought?: string;
  postType: 'news' | 'soliloquy';
  newsTitle?: string;
  newsEmbedding?: number[];
}

export interface PublishTimelinePostResult {
  status: 'success';
  post: string;
  attachedMedia: boolean;
  tweetId?: string;
}

/**
 * Publishes a timeline post with multimodal image inference and saves it to timeline history.
 *
 * @param deps - Application dependencies.
 * @param options - Options containing post text, post type, and optional news metadata.
 * @returns Result object with status, post text, and attachedMedia boolean.
 */
export const publishTimelinePost = async (
  deps: AppDependencies,
  options: PublishTimelinePostOptions,
): Promise<PublishTimelinePostResult> => {
  const { postText, thought, postType, newsTitle, newsEmbedding } = options;

  const timelineSummary = await deps.firestore.getTimelineSummary();
  const searchPrompt = `あなたはAIキャラクター「レベッカ」の心情を分析するAIです。
以下のレベッカがたった今投稿しようとしているツイート文と、直近のタイムライン要約から、レベッカの現在の感情や状況を推測し、画像検索のための「検索クエリ（短い一文または単語の羅列）」を出力してください。
画像が不要だと思われる内容（事務連絡や抽象的すぎる内容）の場合は、"null" という文字列だけを出力してください。

【直近のタイムライン要約】
${timelineSummary}

【今回のツイート内容】
${postText}

出力は検索クエリのテキストのみとし、不要な解説やMarkdown表記は含めないでください。`;

  const searchQuery = await deps.gemini.inferImageSearchQuery(searchPrompt);

  const mediaIds: string[] = [];
  let bestImage: { id: string; url: string; caption?: string; description?: string } | null = null;

  if (searchQuery) {
    console.log(`Inferred image search query: ${searchQuery}`);
    const queryVector = await deps.gemini.generateEmbedding(searchQuery);
    bestImage = queryVector.length > 0 ? await deps.firestore.findImageByVector(queryVector) : null;

    if (bestImage) {
      console.log(`Found matching image candidate: ${bestImage.url}`);
      const isRelevant = await deps.gemini.verifyImageRelevance(
        bestImage.caption || bestImage.description || '',
        postText,
      );

      if (!isRelevant) {
        console.log('Image rejected by LLM re-ranking (irrelevant to context). Fallback to text-only.');
        bestImage = null;
      } else {
        console.log('Image approved by LLM re-ranking.');
        try {
          const buffer = await deps.storage.downloadImage(bestImage.url);
          let mimeType = 'image/jpeg';
          if (bestImage.url.endsWith('.png')) mimeType = 'image/png';
          else if (bestImage.url.endsWith('.gif')) mimeType = 'image/gif';

          const mediaId = await deps.xApi.uploadMedia(buffer, mimeType);
          if (mediaId && mediaId !== 'mock_media_id') {
            mediaIds.push(mediaId);
            await deps.firestore.updateImageLastUsed(bestImage.id);
            console.log(`Attached media ID: ${mediaId}`);
          }
        } catch (e) {
          console.error('Failed to attach image to post:', e);
        }
      }
    } else {
      console.log('No matching image found or all are in cooldown.');
    }
  }

  const tweetRes = await deps.xApi.tweet(postText, { mediaIds });
  const tweetId = (tweetRes as { data?: { id?: string } })?.data?.id;
  const attachedUrl = bestImage ? bestImage.url : undefined;
  const assetId = bestImage ? bestImage.id : undefined;

  await deps.firestore.saveTimelinePost(postText, {
    thought,
    mediaUrls: mediaIds.length > 0 && attachedUrl ? [attachedUrl] : [],
    assetId: mediaIds.length > 0 ? assetId : undefined,
    tweetId,
    postType,
    newsTitle,
    newsEmbedding,
  });

  return {
    status: 'success',
    post: postText,
    attachedMedia: mediaIds.length > 0,
    tweetId,
  };
};
