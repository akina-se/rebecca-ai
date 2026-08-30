import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { IXApiService } from '../services/xApi';

const COLLECTIONS = {
  TIMELINE_HISTORY: 'timeline_history',
} as const;

export interface SyncTimelineResult {
  processed: number;
  updated: number;
  created: number;
  errors: number;
}

/**
 * Domain UseCase that synchronizes external X timeline posts and engagement metrics
 * into the Firestore timeline_history collection.
 */
export class SyncTimelineUseCase {
  constructor(
    private xApiService: IXApiService,
    private db: Firestore = getFirestore()
  ) {}

  /**
   * Executes the timeline synchronization workflow.
   *
   * @param userId - Optional. Target author's X user ID. Auto-resolved via getMyUserId if omitted.
   * @param limit - Optional max tweets to fetch. Defaults to configured limit.
   * @returns Aggregated synchronization metrics.
   */
  async execute(userId?: string, limit?: number): Promise<SyncTimelineResult> {
    try {
      // 1. Fetch normalized tweets from external service adapter (auto-resolves userId if omitted)
      const tweets = await this.xApiService.fetchRecentTimelineTweets(userId, limit);
      if (tweets.length === 0) {
        console.log('[SyncTimelineUseCase] No tweets retrieved from X API.');
        return { processed: 0, updated: 0, created: 0, errors: 0 };
      }

      // 2. Fetch existing Firestore timeline documents for lookup
      const timelineRef = this.db.collection(COLLECTIONS.TIMELINE_HISTORY);
      const existingSnap = await timelineRef.get();

      const existingByTweetId = new Map<string, { id: string; data: Record<string, unknown> }>();
      const existingByText = new Map<string, { id: string; data: Record<string, unknown> }>();

      existingSnap.forEach((doc) => {
        const data = doc.data();
        if (data.tweetId) existingByTweetId.set(String(data.tweetId), { id: doc.id, data });
        if (data.tweet_id) existingByTweetId.set(String(data.tweet_id), { id: doc.id, data });

        const content = String(data.text || data.content || '').trim();
        if (content) {
          existingByText.set(content, { id: doc.id, data });
        }
      });

      let updatedCount = 0;
      let createdCount = 0;
      const batch = this.db.batch();

      for (const tweet of tweets) {
        const existing = existingByTweetId.get(tweet.id) || existingByText.get(tweet.text.trim());

        if (existing) {
          // Update existing document with verified metrics & ensure tweetId is set
          const docRef = timelineRef.doc(existing.id);
          const updatePayload: Record<string, unknown> = {
            impressions: tweet.impressions,
            likes: tweet.likes,
            reposts: tweet.reposts,
            replies: tweet.replies,
            tweetId: tweet.id,
            tweet_id: tweet.id,
            lastSyncedAt: new Date().toISOString(),
          };

          // If mediaUrls were missing in Firestore, populate them
          const existingMedia = (existing.data.mediaUrls || existing.data.media_urls || []) as string[];
          if (existingMedia.length === 0 && tweet.mediaUrls.length > 0) {
            updatePayload.mediaUrls = tweet.mediaUrls;
            updatePayload.media_urls = tweet.mediaUrls;
          }

          batch.set(docRef, updatePayload, { merge: true });
          updatedCount++;
        } else {
          // Create new document for manual/untracked tweet
          const newDocRef = timelineRef.doc();
          const tweetDate = tweet.createdAt ? new Date(tweet.createdAt) : new Date();
          const expireAt = new Date(tweetDate);
          expireAt.setFullYear(expireAt.getFullYear() + 5);

          batch.set(newDocRef, {
            text: tweet.text,
            content: tweet.text,
            timestamp: tweetDate.toISOString(),
            created_at: tweetDate.toISOString(),
            expireAt: expireAt.toISOString(),
            mediaUrls: tweet.mediaUrls,
            media_urls: tweet.mediaUrls,
            impressions: tweet.impressions,
            likes: tweet.likes,
            reposts: tweet.reposts,
            replies: tweet.replies,
            status: 'SUCCESS',
            tweetId: tweet.id,
            tweet_id: tweet.id,
            lastSyncedAt: new Date().toISOString(),
          });
          createdCount++;
        }
      }

      if (updatedCount > 0 || createdCount > 0) {
        await batch.commit();
      }

      console.log(`[SyncTimelineUseCase] Processed ${tweets.length} tweets (Updated: ${updatedCount}, Created: ${createdCount}).`);
      return { processed: tweets.length, updated: updatedCount, created: createdCount, errors: 0 };
    } catch (error) {
      console.error('[SyncTimelineUseCase] Sync workflow encountered an error:', error);
      return { processed: 0, updated: 0, created: 0, errors: 1 };
    }
  }
}
