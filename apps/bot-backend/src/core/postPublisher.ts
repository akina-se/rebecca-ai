/**
 * @fileoverview Unified publisher for X (Twitter) posts.
 * Handles multimodal image query inference, vector image retrieval, LLM re-ranking,
 * asset upload to X, and tweet or reply dispatching.
 *
 * Database persistence is deliberately decoupled from this service; callers (use cases)
 * retain responsibility for persisting timeline posts or conversation logs.
 */
import { AppDependencies, ImageDocWithId } from '../types';

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
  let bestImage: ImageDocWithId | null = null;

  if (attachImage) {
    try {
      const searchPrompt = `あなたはAIキャラクター「レベッカ」の投稿に添えるイラスト画像を検索するAIです。
画像データベースには、様々な衣装やシチュエーションで描かれたレベッカのイラストと、その視覚的描写（キャプション）が登録されています。

以下のツイート文${context ? 'と参考文脈' : ''}から、投稿のビジュアルとして最も調和するイラスト検索クエリ（20〜40文字程度の日本語）を1行で生成してください。

【クエリ生成の指針】
1. 視覚的アクション・シチュエーションの具体化:
   投稿の話題・文脈から「レベッカがどこで、何をして、どんな表情をしているか」を具体的にイメージしてください。
   （例：音楽の話題なら演奏やライブ・歌唱、スポーツならスタジアムや観戦・応援、日常なら部屋でくつろぐ姿など、その話題の核心を視覚化した情景にする）
2. 構成要素のバランス:
   「場所や舞台」「具体的な動作や衣装・身につけている物」「表情や雰囲気」を自然に組み合わせて描写してください。
3. 画像不要の判定:
   純粋なシステム通知や事務連絡など、キャラクターイラストの添付が不自然な投稿の場合は "null" と出力してください。

${context ? `【参考文脈】\n${context}\n` : ''}【ツイート内容】
${text}

出力は検索クエリ（または null）のテキストのみとし、解説や装飾、引用符は含めないでください。`;

      const searchQuery = await deps.gemini.inferImageSearchQuery(searchPrompt);

      if (searchQuery) {
        console.log(`[PostPublisher] Inferred image search query: ${searchQuery}`);
        const queryVector = await deps.gemini.generateEmbedding(searchQuery);

        const candidates = queryVector.length > 0 ? await deps.firestore.findImagesByVector(queryVector, undefined, 3) : [];

        if (candidates.length > 0) {
          for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            console.log(`[PostPublisher] Evaluating image candidate ${i + 1}/${candidates.length}: ${candidate.url}`);
            const isRelevant = await deps.gemini.verifyImageRelevance(
              candidate.caption || '',
              text,
            );

            if (isRelevant) {
              console.log(`[PostPublisher] Image approved by LLM re-ranking (candidate ${i + 1}).`);
              bestImage = candidate;
              break;
            } else {
              console.log(`[PostPublisher] Image candidate ${i + 1} rejected by LLM re-ranking.`);
            }
          }

          if (bestImage) {
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
          } else {
            console.log('[PostPublisher] All image candidates rejected by LLM re-ranking. Fallback to text-only.');
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
