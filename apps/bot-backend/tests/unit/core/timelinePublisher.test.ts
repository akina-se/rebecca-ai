import { publishTimelinePost } from '../../../src/core/timelinePublisher';
import { createMockDeps } from './testUtils';

describe('TimelinePublisher Unit Tests', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
    (deps.firestore.getTimelineSummary as jest.Mock).mockResolvedValue('Recent summary');
  });

  it('should publish post with attached image when image is found and relevant', async () => {
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

    const result = await publishTimelinePost(deps, {
      postText: '今日も一日お疲れ様♡ #全肯定AIレベッカ',
      postType: 'soliloquy',
    });

    expect(result.status).toBe('success');
    expect(result.attachedMedia).toBe(true);
    expect(result.tweetId).toBe('tweet_123');
    expect(deps.xApi.uploadMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/png');
    expect(deps.firestore.updateImageLastUsed).toHaveBeenCalledWith('img_1');
    expect(deps.xApi.tweet).toHaveBeenCalledWith(
      '今日も一日お疲れ様♡ #全肯定AIレベッカ',
      { mediaIds: ['media_123'] },
    );
    expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
      '今日も一日お疲れ様♡ #全肯定AIレベッカ',
      expect.objectContaining({
        tweetId: 'tweet_123',
        mediaUrls: ['https://storage.googleapis.com/test.png'],
        assetId: 'img_1',
        postType: 'soliloquy',
      }),
    );
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

    const result = await publishTimelinePost(deps, {
      postText: 'ニュース投稿 #全肯定AIレベッカ',
      postType: 'news',
      newsTitle: 'IT News',
      newsEmbedding: [0.5],
    });

    expect(result.status).toBe('success');
    expect(result.attachedMedia).toBe(false);
    expect(deps.xApi.uploadMedia).not.toHaveBeenCalled();
    expect(deps.xApi.tweet).toHaveBeenCalledWith('ニュース投稿 #全肯定AIレベッカ', { mediaIds: [] });
    expect(deps.firestore.saveTimelinePost).toHaveBeenCalledWith(
      'ニュース投稿 #全肯定AIレベッカ',
      expect.objectContaining({
        tweetId: 'tweet_text_only',
        mediaUrls: [],
        assetId: undefined,
        postType: 'news',
        newsTitle: 'IT News',
        newsEmbedding: [0.5],
      }),
    );
  });

  it('should publish text-only post when inferImageSearchQuery returns null or empty', async () => {
    (deps.gemini.inferImageSearchQuery as jest.Mock).mockResolvedValue(null);
    (deps.xApi.tweet as jest.Mock).mockResolvedValue({ data: { id: 'tweet_no_query' } });

    const result = await publishTimelinePost(deps, {
      postText: '独り言 #全肯定AIレベッカ',
      postType: 'soliloquy',
    });

    expect(result.status).toBe('success');
    expect(result.attachedMedia).toBe(false);
    expect(deps.firestore.findImageByVector).not.toHaveBeenCalled();
    expect(deps.xApi.tweet).toHaveBeenCalledWith('独り言 #全肯定AIレベッカ', { mediaIds: [] });
  });
});
