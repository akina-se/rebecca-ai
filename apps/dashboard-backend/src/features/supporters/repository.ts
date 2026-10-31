import { AggregateField, Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';
import { getCollections, DbCollections } from '@rebecca/db';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupporterLedgerQuery,
  SupporterLedgerResponse,
  PaginationMeta,
} from '@rebecca/types';
import { logger } from '../../utils/logger';

const MAX_LEDGER_LIMIT = 100;
const DEFAULT_LEDGER_LIMIT = 30;
const MAX_SEARCH_SCAN_LIMIT = 500;

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
   * Computes system-wide summary metrics (`totalCount`, `totalAmount`, and status counts)
   * using Firestore Server-Side Aggregation (`AggregateField.count()`, `AggregateField.sum('amount')`)
   * so full documents are never loaded into memory.
   */
  private async computeLedgerSummary(): Promise<SupporterLedgerResponse['summary']> {
    const baseColl = this.collections.supportTransactions;

    const [totalAgg, failedAgg, pendingAgg, completedAgg] = await Promise.all([
      baseColl
        .aggregate({
          totalCount: AggregateField.count(),
          totalAmount: AggregateField.sum('amount'),
        })
        .get(),
      baseColl.where('status', '==', 'failed').count().get(),
      baseColl.where('status', '==', 'pending').count().get(),
      baseColl.where('status', 'in', ['completed', 'manual']).count().get(),
    ]);

    const totalData = totalAgg.data();
    return {
      totalCount: Number(totalData.totalCount || 0),
      totalAmount: Number(totalData.totalAmount || 0),
      failedCount: Number(failedAgg.data().count || 0),
      pendingCount: Number(pendingAgg.data().count || 0),
      completedCount: Number(completedAgg.data().count || 0),
    };
  }

  /**
   * Retrieves a paginated list of support transactions along with system-wide summary metrics.
   *
   * Uses server-side Firestore aggregation and query-level pagination (`offset`/`limit` or `startAfter`)
   * to prevent unbounded full-collection scans and cap `limit` at `MAX_LEDGER_LIMIT` (100).
   *
   * @param query - Query filters including status, tier, search term, and limit.
   * @returns A promise resolving to the ledger response containing transactions, summary, and next cursor.
   */
  async getTransactions(query: SupporterLedgerQuery): Promise<SupporterLedgerResponse> {
    try {
      const requestedLimit = Number(query.limit);
      const limit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(Math.floor(requestedLimit), MAX_LEDGER_LIMIT)
          : DEFAULT_LEDGER_LIMIT;
      const requestedPage = Number(query.page);
      const page =
        Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

      let q: FirebaseFirestore.Query<SupportTransactionDoc> = this.collections.supportTransactions;

      if (query.status && query.status !== 'all') {
        q = q.where('status', '==', query.status);
      }

      if (query.tier && query.tier !== 'all') {
        q = q.where('tier', '==', query.tier);
      }

      q = q.orderBy('createdAt', 'desc');

      const summaryPromise = this.computeLedgerSummary();
      const trimmedSearch = query.search?.trim().toLowerCase() || '';

      if (trimmedSearch) {
        // Bounded scan for in-memory substring search across safeName, rawName, and Stripe IDs
        const [searchSnapshot, summary] = await Promise.all([
          q.limit(MAX_SEARCH_SCAN_LIMIT).get(),
          summaryPromise,
        ]);

        const allDocs: SupportTransactionDoc[] = searchSnapshot.docs
          .map((doc: QueryDocumentSnapshot<SupportTransactionDoc>) => ({
            ...doc.data(),
            id: doc.id,
          }))
          .filter(
            (d) =>
              Boolean(d.id && d.id.toLowerCase().includes(trimmedSearch)) ||
              Boolean(d.safeName && d.safeName.toLowerCase().includes(trimmedSearch)) ||
              Boolean(d.rawName && d.rawName.toLowerCase().includes(trimmedSearch)) ||
              Boolean(d.stripeSessionId && d.stripeSessionId.toLowerCase().includes(trimmedSearch)) ||
              Boolean(
                d.stripePaymentIntentId &&
                  d.stripePaymentIntentId.toLowerCase().includes(trimmedSearch)
              )
          );

        const totalFiltered = allDocs.length;
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

        return {
          transactions: paged,
          summary,
          meta: {
            totalItems: totalFiltered,
            totalPages,
            currentPage: page,
            limit,
            itemCount: paged.length,
            itemsPerPage: limit,
          },
          nextCursor,
        };
      }

      // Server-side pagination path (no substring search):
      // Fetch filtered count and summary in parallel, and only read `limit + 1` docs for the current page
      const filteredCountPromise = q.count().get();
      let pagedQuery = q;

      if (query.cursor && !query.page) {
        const cursorSnap = await this.collections.supportTransactions.doc(query.cursor).get();
        if (cursorSnap.exists) {
          pagedQuery = pagedQuery.startAfter(cursorSnap);
        }
      } else {
        const startIndex = (page - 1) * limit;
        if (startIndex > 0) {
          pagedQuery = pagedQuery.offset(startIndex);
        }
      }

      const [pageSnapshot, filteredCountSnap, summary] = await Promise.all([
        pagedQuery.limit(limit + 1).get(),
        filteredCountPromise,
        summaryPromise,
      ]);

      const fetchedDocs: SupportTransactionDoc[] = pageSnapshot.docs.map(
        (doc: QueryDocumentSnapshot<SupportTransactionDoc>) => ({
          ...doc.data(),
          id: doc.id,
        })
      );

      const hasMore = fetchedDocs.length > limit;
      const paged = hasMore ? fetchedDocs.slice(0, limit) : fetchedDocs;
      const nextCursor = hasMore && paged.length > 0 ? paged[paged.length - 1].id : undefined;

      const totalFiltered = Number(filteredCountSnap.data().count || 0);
      const totalPages = Math.ceil(totalFiltered / limit) || 1;

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
        summary,
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

  /**
   * Deletes a support transaction document by its ID.
   *
   * @param id - Document ID.
   */
  async deleteTransaction(id: string): Promise<void> {
    try {
      await this.collections.supportTransactions.doc(id).delete();
    } catch (error) {
      logger.error('[SupportersRepository] Failed to delete transaction', error, { id });
      throw error;
    }
  }
}
