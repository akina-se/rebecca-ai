import { AppDependencies } from '../types';
import { publishPost, PublishPostResult } from './postPublisher';

export interface ExecutePostPipelineParams {
  postType: 'soliloquy' | 'news' | 'anniversary' | 'random_engagement';
  text: string;
  thought?: string;
  imageContext?: string;
  metadata?: {
    newsTitle?: string;
    newsEmbedding?: number[];
    anniversaryTitle?: string;
  };
}

export interface PostPipelineResult {
  status: 'success' | 'failed';
  post: string;
  attachedMedia: boolean;
  tweetId?: string;
  metadata?: {
    newsTitle?: string;
    anniversaryTitle?: string;
  };
}

/**
 * Unified pipeline that coordinates multimodal image inference, post publishing to X,
 * and persistence to Firestore's timeline_posts collection.
 *
 * @param deps - Injected application dependencies.
 * @param params - Pipeline execution parameters including text, persona thought, and domain metadata.
 * @returns Execution result containing the published text, tweetId, and media attachment status.
 */
export const executePostPipeline = async (
  deps: AppDependencies,
  params: ExecutePostPipelineParams,
): Promise<PostPipelineResult> => {
  const { postType, text, thought, imageContext, metadata } = params;

  const publishResult: PublishPostResult = await publishPost(deps, {
    text,
    context: imageContext,
    attachImage: true,
  });

  await deps.firestore.saveTimelinePost({
    text,
    thought,
    tweetId: publishResult.tweetId,
    mediaUrls: publishResult.mediaUrls,
    assetId: publishResult.assetId,
    postType,
    ...(metadata?.newsTitle ? { newsTitle: metadata.newsTitle } : {}),
    ...(metadata?.newsEmbedding && metadata.newsEmbedding.length > 0
      ? { newsEmbedding: metadata.newsEmbedding }
      : {}),
    ...(metadata?.anniversaryTitle ? { anniversaryTitle: metadata.anniversaryTitle } : {}),
  });

  return {
    status: 'success',
    post: publishResult.text,
    attachedMedia: publishResult.attachedMedia,
    tweetId: publishResult.tweetId,
    ...(metadata?.newsTitle ? { metadata: { newsTitle: metadata.newsTitle } } : {}),
    ...(metadata?.anniversaryTitle ? { metadata: { anniversaryTitle: metadata.anniversaryTitle } } : {}),
  };
};
