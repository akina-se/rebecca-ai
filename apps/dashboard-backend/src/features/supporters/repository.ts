import { Firestore } from '@google-cloud/firestore';
import { getCollections, SupportTransactionDoc, RewardImageDoc } from '@rebecca/db';
import { SupporterLedgerQuery, SupporterLedgerResponse } from './types';
import { logger } from '../../utils/logger';

/**
 * Repository responsible for data access operations related to support transactions
 * and reward assets in Firestore.
 */
export class SupportersRepository {
  private collections;
  private firestore: Firestore;

  /**
   * Creates an instance of SupportersRepository.
   *
   * @param firestore - The Firestore instance.
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves a paginated list of support transactions along with system-wide summary metrics.
   *
   * @param query - Query filters including status, tier, search term, and limit.
   * @returns A promise resolving to the ledger response containing transactions, summary, and next cursor.
   */
  async getTransactions(query: SupporterLedgerQuery): Promise<SupporterLedgerResponse> {
    try {
      let q: FirebaseFirestore.Query = this.collections.supportTransactions;

      if (query.status && query.status !== 'all') {
        q = q.where('status', '==', query.status);
      }

      if (query.tier && query.tier !== 'all') {
        q = q.where('tier', '==', query.tier);
      }

      q = q.orderBy('createdAt', 'desc');

      const snapshot = await q.get();
      let allDocs: SupportTransactionDoc[] = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          stripeSessionId: data.stripeSessionId || '',
          stripePaymentIntentId: data.stripePaymentIntentId || undefined,
          rawName: data.rawName || '',
          safeName: data.safeName || data.rawName || '名無しのマスター',
          isNameSanitized: Boolean(data.isNameSanitized),
          creditVisibility: data.creditVisibility || 'show',
          amount: Number(data.amount || 0),
          currency: 'jpy',
          tier: data.tier || 'bronze',
          itemLabel: data.itemLabel || '',
          rewardImageId: data.rewardImageId || 'default',
          status: data.status || 'pending',
          isBanned: Boolean(data.isBanned),
          tweetId: data.tweetId || undefined,
          tweetText: data.tweetText || undefined,
          errorMessage: data.errorMessage || undefined,
          createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
          processedAt: typeof data.processedAt?.toDate === 'function' ? data.processedAt.toDate().toISOString() : data.processedAt ? String(data.processedAt) : undefined,
          updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt ? String(data.updatedAt) : undefined,
        };
      });

      // Calculate summary metrics across the matched set (or all)
      const summary = {
        totalCount: allDocs.length,
        failedCount: allDocs.filter((d) => d.status === 'failed').length,
        pendingCount: allDocs.filter((d) => d.status === 'pending').length,
        completedCount: allDocs.filter((d) => d.status === 'completed' || d.status === 'manual').length,
        totalAmount: allDocs.reduce((acc, curr) => acc + (curr.amount || 0), 0),
      };

      // In-memory filter for search keywords (rawName, safeName, stripeSessionId)
      if (query.search && query.search.trim()) {
        const s = query.search.trim().toLowerCase();
        allDocs = allDocs.filter(
          (d) =>
            d.rawName.toLowerCase().includes(s) ||
            d.safeName.toLowerCase().includes(s) ||
            d.stripeSessionId.toLowerCase().includes(s)
        );
      }

      // Pagination
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
      let startIndex = 0;
      if (query.cursor) {
        const found = allDocs.findIndex((d) => d.id === query.cursor);
        if (found !== -1) {
          startIndex = found + 1;
        }
      }

      const paginated = allDocs.slice(startIndex, startIndex + limit);
      const nextCursor = startIndex + limit < allDocs.length ? paginated[paginated.length - 1]?.id : undefined;

      return {
        transactions: paginated,
        summary,
        nextCursor,
      };
    } catch (error) {
      logger.error('[SupportersRepository] Failed to get transactions', error);
      throw error;
    }
  }

  /**
   * Retrieves a single support transaction by its unique identifier.
   *
   * @param id - Document ID in support_transactions collection.
   * @returns A promise resolving to the transaction document, or null if not found.
   */
  async getTransactionById(id: string): Promise<SupportTransactionDoc | null> {
    try {
      const doc = await this.collections.supportTransactions.doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as any;
      return {
        id: doc.id,
        stripeSessionId: data.stripeSessionId || '',
        stripePaymentIntentId: data.stripePaymentIntentId || undefined,
        rawName: data.rawName || '',
        safeName: data.safeName || data.rawName || '名無しのマスター',
        isNameSanitized: Boolean(data.isNameSanitized),
        creditVisibility: data.creditVisibility || 'show',
        amount: Number(data.amount || 0),
        currency: 'jpy',
        tier: data.tier || 'bronze',
        itemLabel: data.itemLabel || '',
        rewardImageId: data.rewardImageId || 'default',
        status: data.status || 'pending',
        isBanned: Boolean(data.isBanned),
        tweetId: data.tweetId || undefined,
        tweetText: data.tweetText || undefined,
        errorMessage: data.errorMessage || undefined,
        createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
        processedAt: typeof data.processedAt?.toDate === 'function' ? data.processedAt.toDate().toISOString() : data.processedAt ? String(data.processedAt) : undefined,
        updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt ? String(data.updatedAt) : undefined,
      };
    } catch (error) {
      logger.error('[SupportersRepository] Failed to get transaction by ID', error, { id });
      throw error;
    }
  }

  /**
   * Updates an existing support transaction.
   *
   * @param id - Document ID.
   * @param data - Fields to update.
   */
  async updateTransaction(id: string, data: Partial<SupportTransactionDoc>): Promise<void> {
    try {
      await this.collections.supportTransactions.doc(id).set(data as any, { merge: true });
    } catch (error) {
      logger.error('[SupportersRepository] Failed to update transaction', error, { id });
      throw error;
    }
  }

  /**
   * Creates a new support transaction document.
   *
   * @param data - Support transaction data without document ID.
   * @returns The generated document ID.
   */
  async createTransaction(data: Omit<SupportTransactionDoc, 'id'>): Promise<string> {
    try {
      const ref = this.collections.supportTransactions.doc();
      await ref.set({
        ...data,
        id: ref.id,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      return ref.id;
    } catch (error) {
      logger.error('[SupportersRepository] Failed to create transaction', error);
      throw error;
    }
  }

  /**
   * Retrieves all reward image assets from the reward_images collection.
   *
   * @returns Array of reward image documents.
   */
  async getRewardImages(): Promise<RewardImageDoc[]> {
    try {
      const snapshot = await this.collections.rewardImages.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          title: data.title || '',
          imageUrl: data.imageUrl || '',
          storagePath: data.storagePath || '',
          isActive: Boolean(data.isActive),
          distributedCount: Number(data.distributedCount || 0),
          createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
          updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : String(data.updatedAt || ''),
        };
      });
    } catch (error) {
      logger.error('[SupportersRepository] Failed to get reward images', error);
      throw error;
    }
  }

  /**
   * Retrieves a single reward image document by its ID.
   *
   * @param id - Document ID.
   */
  async getRewardImageById(id: string): Promise<RewardImageDoc | null> {
    try {
      const doc = await this.collections.rewardImages.doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: data.title || '',
        imageUrl: data.imageUrl || '',
        storagePath: data.storagePath || '',
        isActive: Boolean(data.isActive),
        distributedCount: Number(data.distributedCount || 0),
        createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
        updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : String(data.updatedAt || ''),
      };
    } catch (error) {
      logger.error('[SupportersRepository] Failed to get reward image by ID', error, { id });
      throw error;
    }
  }

  /**
   * Creates a new reward image document.
   *
   * @param data - Reward image data without ID.
   * @returns The generated document ID.
   */
  async createRewardImage(data: Omit<RewardImageDoc, 'id'>): Promise<string> {
    try {
      const ref = this.collections.rewardImages.doc();
      await ref.set({
        ...data,
        id: ref.id,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      return ref.id;
    } catch (error) {
      logger.error('[SupportersRepository] Failed to create reward image', error);
      throw error;
    }
  }

  /**
   * Updates an existing reward image document.
   *
   * @param id - Document ID.
   * @param data - Fields to update.
   */
  async updateRewardImage(id: string, data: Partial<RewardImageDoc>): Promise<void> {
    try {
      await this.collections.rewardImages.doc(id).set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        } as any,
        { merge: true }
      );
    } catch (error) {
      logger.error('[SupportersRepository] Failed to update reward image', error, { id });
      throw error;
    }
  }

  /**
   * Deletes a reward image document by ID.
   *
   * @param id - Document ID.
   */
  async deleteRewardImage(id: string): Promise<void> {
    try {
      await this.collections.rewardImages.doc(id).delete();
    } catch (error) {
      logger.error('[SupportersRepository] Failed to delete reward image', error, { id });
      throw error;
    }
  }
}
