import { publishPost } from '../../../src/core/postPublisher';
import { createMockDeps } from './testUtils';

describe('PostPublisher Unit Tests', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it('should publish top-level tweet with attached image when image is found and relevant', async () => {
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue('happy gal');
    (deps.gemini.generateEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2]);
    (deps.firestore.findImageByVector as jest.Mock).mockResolvedValue({
      id: 'img_1',
      url: 'https://storage.googleapis.com/test.png',
      caption: 'smiling rebecca',
    });
    (deps.gemini.verifyImageRelevance as jest.Mock).mockResolvedValue(true);
    (deps.storage.downloadImage as jest.Mock).mockResolvedValue(Buffer.from('fake'));
    (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('media_123');
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_123' } });

    const result = await publishPost(deps, {
      text: '今日も一日お疲れ様♡ #全肯定AIレベッカ',
      context: 'タイムラインの直近状況',
    });

    expect(result.text).toBe('今日も一日お疲れ様♡ #全肯定AIレベッカ');
    expect(result.attachedMedia).toBe(true);
    expect(result.tweetId).toBe('tweet_123');
    expect(result.mediaUrls).toEqual(['https://storage.googleapis.com/test.png']);
    expect(result.assetId).toBe('img_1');

    expect(deps.gemini.inferImageSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining('【参考文脈】\nタイムラインの直近状況'),
    );
    expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/png');
    expect(deps.firestore.updateImageLastUsed).toHaveBeenCalledWith('img_1');
    expect(deps.xApi.tweet).toHaveBeenCalledWith(
      '今日も一日お疲れ様♡ #全肯定AIレベッカ',
      { mediaIds: ['media_123'] },
    );
    // DB persistence and timeline summary fetching are decoupled from PostPublisher
    expect(deps.firestore.getTimelineSummary).not.toHaveBeenCalled();
    expect(deps.firestore.saveTimelinePost).not.toHaveBeenCalled();
  });

  it('should publish replyToMention with attachImage: false (bypassing image inference completely)', async () => {
    (deps.xApi.replyToMention as jest.Mock).mockResolvedValue({ data: { id: 'reply_tweet_999' } });

    const result = await publishPost(deps, {
      text: '@user その調子よ♡',
      inReplyToTweetId: 'in_reply_123',
      attachImage: false,
    });

    expect(result.tweetId).toBe('reply_tweet_999');
    expect(result.attachedMedia).toBe(false);
    expect(result.mediaUrls).toEqual([]);
    expect(result.assetId).toBeUndefined();

    // Verify image pipeline is completely bypassed
    expect(deps.firestore.getTimelineSummary).not.toHaveBeenCalled();
    expect(deps.gemini.inferImageSearchQuery).not.toHaveBeenCalled();
    expect(deps.firestore.findImageByVector).not.toHaveBeenCalled();
    expect(deps.xApi.uploadMedia).not.toHaveBeenCalled();

    expect(deps.xApi.replyToMention).toHaveBeenCalledWith(
      'in_reply_123',
      '@user その調子よ♡',
    );
    expect(deps.xApi.tweet).not.toHaveBeenCalled();
  });

  it('should publish text-only post when image is rejected by re-ranking', async () => {
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue('query');
    (deps.gemini.generateEmbedding as jest.Mock).mockResolvedValue([0.1]);
    (deps.firestore.findImageByVector as jest.Mock).mockResolvedValue({
      id: 'img_2',
      url: 'https://storage.googleapis.com/test.jpg',
    });
    (deps.gemini.verifyImageRelevance as jest.Mock).mockResolvedValue(false);
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_text_only' } });

    const result = await publishPost(deps, {
      text: 'ニュース投稿 #全肯定AIレベッカ',
    });

    expect(result.attachedMedia).toBe(false);
    expect(result.mediaUrls).toEqual([]);
    expect(deps.xApi.uploadMedia).not.toHaveBeenCalled();
    expect(deps.xApi.tweet).toHaveBeenCalledWith('ニュース投稿 #全肯定AIレベッカ', { mediaIds: [] });
  });

  it('should publish text-only post when inferImageSearchQuery returns null or empty', async () => {
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue(null);
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_no_query' } });

    const result = await publishPost(deps, {
      text: '独り言 #全肯定AIレベッカ',
    });

    expect(result.attachedMedia).toBe(false);
    expect(deps.firestore.findImageByVector).not.toHaveBeenCalled();
    expect(deps.xApi.tweet).toHaveBeenCalledWith('独り言 #全肯定AIレベッカ', { mediaIds: [] });
  });

  it('should publish in-reply-to tweet with media when attachImage is true and image is found', async () => {
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue('relevant query');
    (deps.gemini.generateEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2]);
    (deps.firestore.findImageByVector as jest.Mock).mockResolvedValue({
      id: 'img_reply_1',
      url: 'https://storage.googleapis.com/reply.gif',
    });
    (deps.gemini.verifyImageRelevance as jest.Mock).mockResolvedValue(true);
    (deps.storage.downloadImage as jest.Mock).mockResolvedValue(Buffer.from('gif-bytes'));
    (deps.xApi.uploadMedia as jest.Mock).mockResolvedValue('media_reply_gif');
    (deps.xApi.replyToMention as jest.Mock).mockResolvedValue({ data: { id: 'reply_with_image_id' } });

    const result = await publishPost(deps, {
      text: '@user 画像付きで返信するわね！',
      inReplyToTweetId: 'mention_target_456',
      attachImage: true,
    });

    expect(result.attachedMedia).toBe(true);
    expect(result.tweetId).toBe('reply_with_image_id');
    expect(result.mediaUrls).toEqual(['https://storage.googleapis.com/reply.gif']);
    expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/gif');
    expect(deps.xApi.replyToMention).toHaveBeenCalledWith(
      'mention_target_456',
      '@user 画像付きで返信するわね！',
      { mediaIds: ['media_reply_gif'] },
    );
  });
});
