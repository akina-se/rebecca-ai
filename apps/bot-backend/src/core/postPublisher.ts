/**
 * @fileoverview Unified publisher for X (Twitter) posts.
 * Handles multimodal image query inference, vector image retrieval, LLM re-ranking,
 * asset upload to X, and tweet or reply dispatching.
 *
 * Database persistence is deliberately decoupled from this service; callers (use cases)
 * retain responsibility for persisting timeline posts or conversation logs.
 */
import { AppDependencies } from '../types';

export interface PublishPostOptions {
  /** The text content to post. */
  text: string;
  /** Optional tweet ID to reply to. When specified, executes replyToMention instead of tweet. */
  inReplyToTweetId?: string;
  /** Whether to run multimodal image inference and attach relevant media. Defaults to true. */
  attachImage?: boolean;
  /**
   * Optional contextual background text to assist multimodal image inference.
   * e.g. timeline summary for soliloquy, news headline for news, target tweet for engagement, conversation history for reply.
   */
  context?: string;
}

export interface PublishPostResult {
  /** Identifier of the created tweet on X. */
  tweetId?: string;
  /** Final text that was posted. */
  text: string;
  /** Whether an image media was uploaded and attached to the tweet. */
  attachedMedia: boolean;
  /** Array of media URLs attached to the post (empty if text-only). */
  mediaUrls: string[];
  /** Firestore asset ID if a database image asset was matched. */
  assetId?: string;
}

/**
 * Publishes a post to X with automated multimodal image inference and attachment.
 *
 * @param deps - Injected application dependencies.
 * @param options - Post publication options including text, reply target, and image attachment toggle.
 * @returns Publication result containing the tweet ID and attached media details.
 */
export const publishPost = async (
  deps: AppDependencies,
  options: PublishPostOptions,
): Promise<PublishPostResult> => {
  const { text, inReplyToTweetId, attachImage = true, context } = options;

  const mediaIds: string[] = [];
  let bestImage: { id: string; url: string; caption?: string; description?: string } | null = null;

  if (attachImage) {
    try {
      const searchPrompt = `あなたはAIキャラクター「レベッカ」の心情を分析するAIです。
以下のレベッカがたった今投稿しようとしているツイート文${context ? 'と参考文脈' : ''}から、レベッカの現在の感情や状況を推測し、画像検索のための「検索クエリ（短い一文または単語の羅列）」を出力してください。
画像が不要だと思われる内容（事務連絡や抽象的すぎる内容）の場合は、"null" という文字列だけを出力してください。
${context ? `\n【参考文脈】\n${context}\n` : ''}
【今回のツイート内容】
${text}

出力は検索クエリのテキストのみとし、不要な解説やMarkdown表記は含めないでください。`;

      const searchQuery = await deps.gemini.inferImageSearchQuery(searchPrompt);

      if (searchQuery) {
        console.log(`[PostPublisher] Inferred image search query: ${searchQuery}`);
        const queryVector = await deps.gemini.generateEmbedding(searchQuery);

        bestImage = queryVector.length > 0 ? await deps.firestore.findImageByVector(queryVector) : null;

        if (bestImage) {
          console.log(`[PostPublisher] Found matching image candidate: ${bestImage.url}`);
          const isRelevant = await deps.gemini.verifyImageRelevance(
            bestImage.caption || bestImage.description || '',
            text,
          );

          if (!isRelevant) {
            console.log('[PostPublisher] Image rejected by LLM re-ranking (irrelevant to context). Fallback to text-only.');
            bestImage = null;
          } else {
            console.log('[PostPublisher] Image approved by LLM re-ranking.');
            try {
              const buffer = await deps.storage.downloadImage(bestImage.url);
              let mimeType = 'image/jpeg';
              if (bestImage.url.endsWith('.png')) mimeType = 'image/png';
              else if (bestImage.url.endsWith('.gif')) mimeType = 'image/gif';

              const mediaId = await deps.xApi.uploadMedia(buffer, mimeType);
              if (mediaId && mediaId !== 'mock_media_id') {
                mediaIds.push(mediaId);
                await deps.firestore.updateImageLastUsed(bestImage.id);
                console.log(`[PostPublisher] Attached media ID: ${mediaId}`);
              }
            } catch (e) {
              console.error('[PostPublisher] Failed to upload media to X:', e);
            }
          }
        } else {
          console.log('[PostPublisher] No matching image found or all are in cooldown.');
        }
      }
    } catch (err) {
      console.warn('[PostPublisher] Image inference/attachment encountered non-fatal error, falling back to text-only:', err);
    }
  }

  // Dispatch to X API based on whether inReplyToTweetId is provided
  let tweetRes: { data?: { id?: string } };
  if (inReplyToTweetId) {
    tweetRes = mediaIds.length > 0
      ? await deps.xApi.replyToMention(inReplyToTweetId, text, { mediaIds })
      : await deps.xApi.replyToMention(inReplyToTweetId, text);
  } else {
    tweetRes = mediaIds.length > 0
      ? await deps.xApi.tweet(text, { mediaIds })
      : await deps.xApi.tweet(text, { mediaIds: [] });
  }

  const tweetId = tweetRes?.data?.id;
  const attachedMedia = mediaIds.length > 0;
  const mediaUrls = attachedMedia && bestImage?.url ? [bestImage.url] : [];
  const assetId = attachedMedia ? bestImage?.id : undefined;

  return {
    tweetId,
    text,
    attachedMedia,
    mediaUrls,
    assetId,
  };
};
