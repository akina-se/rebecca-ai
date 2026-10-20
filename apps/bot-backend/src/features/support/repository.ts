/**
 * @fileoverview Repository interface and implementation for support transactions.
 */

import { IFirestoreService } from '../../types';
import { SupportTransactionDoc } from './types';

/**
 * Persistence abstraction contract for support transactions.
 */
export interface ISupportRepository {
  /**
   * Retrieves a support transaction by its unique ID.
   *
   * @param transactionId - Unique ID of the target transaction.
   * @returns A Promise resolving to {@link SupportTransactionDoc} or null if not found.
   */
  getTransactionById(transactionId: string): Promise<SupportTransactionDoc | null>;

  /**
   * Updates partial fields of an existing support transaction.
   *
   * @param transactionId - Unique ID of the transaction to update.
   * @param data - Partial fields to merge into the document.
   * @returns A Promise resolving when the update completes.
   */
  updateTransaction(transactionId: string, data: Partial<SupportTransactionDoc>): Promise<void>;
}

/**
 * Concrete Firestore implementation of {@link ISupportRepository}.
 */
export class SupportRepository implements ISupportRepository {
  /**
   * Initializes a new instance of SupportRepository.
   *
   * @param firestore - Injected Firestore service implementing database operations.
   */
  constructor(private readonly firestore: IFirestoreService) {}

  /**
   * @inheritdoc
   */
  async getTransactionById(transactionId: string): Promise<SupportTransactionDoc | null> {
    return this.firestore.getSupportTransactionById(transactionId);
  }

  /**
   * @inheritdoc
   */
  async updateTransaction(
    transactionId: string,
    data: Partial<SupportTransactionDoc>,
  ): Promise<void> {
    return this.firestore.updateSupportTransaction(transactionId, data);
  }
}
