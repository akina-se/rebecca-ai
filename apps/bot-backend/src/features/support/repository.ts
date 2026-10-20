/**
 * @fileoverview Repository layer for support transactions.
 */

import { SupportTransactionDoc } from './types';
import { IFirestoreService } from '../../types';

/**
 * Interface contract for support transaction data access.
 */
export interface ISupportRepository {
  /**
   * Fetches a transaction by its Firestore document ID.
   */
  getTransactionById(transactionId: string): Promise<SupportTransactionDoc | null>;

  /**
   * Updates partial fields of a transaction document.
   */
  updateTransaction(transactionId: string, data: Partial<SupportTransactionDoc>): Promise<void>;
}

/**
 * Production implementation of ISupportRepository delegating to IFirestoreService.
 */
export class SupportRepository implements ISupportRepository {
  constructor(private firestoreService: IFirestoreService) {}

  async getTransactionById(transactionId: string): Promise<SupportTransactionDoc | null> {
    return this.firestoreService.getSupportTransactionById(transactionId);
  }

  async updateTransaction(transactionId: string, data: Partial<SupportTransactionDoc>): Promise<void> {
    return this.firestoreService.updateSupportTransaction(transactionId, data);
  }
}
