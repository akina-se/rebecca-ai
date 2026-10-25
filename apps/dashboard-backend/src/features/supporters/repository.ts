import { Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';
import { getCollections, DbCollections } from '@rebecca/db';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupporterLedgerQuery,
  SupporterLedgerResponse,
  PaginationMeta,
} from '@rebecca/types';
import { logger } from '../../utils/logger';

/**
 * Repository class providing Firestore data access for supporter transactions
 * and digital reward image catalogs.
 */
export class SupportersRepository {
  private firestore: Firestore;
  private collections: DbCollections;

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
      let q: FirebaseFirestore.Query<SupportTransactionDoc> = this.collections.supportTransactions;

      if (query.status && query.status !== 'all') {
        q = q.where('status', '==', query.status);
      }

      if (query.tier && query.tier !== 'all') {
        q = q.where('tier', '==', query.tier);
      }

      q = q.orderBy('createdAt', 'desc');

      const snapshot = await q.get();
      let allDocs: SupportTransactionDoc[] = snapshot.docs.map((doc: QueryDocumentSnapshot<SupportTransactionDoc>) => ({ ...doc.data(), id: doc.id }));

      // In-memory filter for search (Stripe ID, safeName, rawName)
      if (query.search && query.search.trim()) {
        const term = query.search.trim().toLowerCase();
        allDocs = allDocs.filter(
          (d) =>
            Boolean(d.id && d.id.toLowerCase().includes(term)) ||
            Boolean(d.safeName && d.safeName.toLowerCase().includes(term)) ||
            Boolean(d.rawName && d.rawName.toLowerCase().includes(term)) ||
            Boolean(d.stripeSessionId && d.stripeSessionId.toLowerCase().includes(term)) ||
            Boolean(d.stripePaymentIntentId && d.stripePaymentIntentId.toLowerCase().includes(term))
        );
      }

      // Compute aggregates across all transactions in database
      const fullSnapshot = await this.collections.supportTransactions.get();
      let totalCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      let completedCount = 0;
      let totalAmount = 0;

      for (const d of fullSnapshot.docs) {
        const item = d.data();
        totalCount++;
        totalAmount += Number(item.amount || 0);
        if (item.status === 'failed') failedCount++;
        else if (item.status === 'pending') pendingCount++;
        else if (item.status === 'completed' || item.status === 'manual') completedCount++;
      }

      // Pagination
      const totalFiltered = allDocs.length;
      const limit = query.limit && query.limit > 0 ? query.limit : 30;
      const page = query.page && query.page > 0 ? query.page : 1;
      const totalPages = Math.ceil(totalFiltered / limit) || 1;

      let startIndex = (page - 1) * limit;
      if (query.cursor && !query.page) {
        const found = allDocs.findIndex((d) => d.id === query.cursor);
        if (found !== -1) {
          startIndex = found + 1;
        }
      }

      const paged = allDocs.slice(startIndex, startIndex + limit);
      const nextCursor =
        startIndex + limit < allDocs.length && paged.length > 0
          ? paged[paged.length - 1].id
          : undefined;

      const paginationMeta: PaginationMeta = {
        totalItems: totalFiltered,
        totalPages,
        currentPage: page,
        limit,
        itemCount: paged.length,
        itemsPerPage: limit,
      };

      return {
        transactions: paged,
        summary: {
          totalCount,
          failedCount,
          pendingCount,
          completedCount,
          totalAmount,
        },
        pagination: paginationMeta,
        meta: paginationMeta,
        nextCursor,
      };
    } catch (error) {
      logger.error('[SupportersRepository] Failed to retrieve transactions', error);
      throw error;
    }
  }

  /**
   * Retrieves a single support transaction document by its ID.
   *
   * @param id - Document ID in support_transactions collection.
   * @returns A promise resolving to the transaction document, or null if not found.
   */
  async getTransactionById(id: string): Promise<SupportTransactionDoc | null> {
    try {
      const doc = await this.collections.supportTransactions.doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as SupportTransactionDoc;
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
      await this.collections.supportTransactions.doc(id).set(data as FirebaseFirestore.PartialWithFieldValue<SupportTransactionDoc>, { merge: true });
    } catch (error) {
      logger.error('[SupportersRepository] Failed to update transaction', error, { id });
      throw error;
    }
  }

  /**
   * Creates a new support transaction document.
   *
   * @param data - Transaction document fields without ID.
   * @returns The generated document ID.
   */
  async createTransaction(data: Omit<SupportTransactionDoc, 'id'>): Promise<string> {
    try {
      const ref = this.collections.supportTransactions.doc();
      const newDoc: SupportTransactionDoc = {
        ...data,
        id: ref.id,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ref.set(newDoc);
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
      return snapshot.docs.map((doc: QueryDocumentSnapshot<RewardImageDoc>) => ({ ...doc.data(), id: doc.id }));
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
      return { ...doc.data(), id: doc.id } as RewardImageDoc;
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
      const newDoc: RewardImageDoc = {
        ...data,
        id: ref.id,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ref.set(newDoc);
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
        } as FirebaseFirestore.PartialWithFieldValue<RewardImageDoc>,
        { merge: true }
      );
    } catch (error) {
      logger.error('[SupportersRepository] Failed to update reward image', error, { id });
      throw error;
    }
  }

  /**
   * Deletes a reward image document by its ID.
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
