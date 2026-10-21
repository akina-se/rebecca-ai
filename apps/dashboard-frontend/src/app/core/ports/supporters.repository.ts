import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupporterLedgerQuery,
  SupporterLedgerResponse,
  UpdateSupportTransactionDto,
  ManualResolveSupportDto,
  ManualEntrySupportDto,
} from '@rebecca/types';

/**
 * Port interface defining data operations for the supporter management ledger,
 * automated X appreciation post retry mechanisms, and digital reward catalog.
 */
export interface SupportersRepository {
  /** Retrieves paginated ledger transactions with KPI summary */
  getLedger(query?: SupporterLedgerQuery): Observable<SupporterLedgerResponse>;

  /** Retrieves single transaction document by ID */
  getTransactionById(id: string): Observable<SupportTransactionDoc>;

  /** Updates transaction fields (producer overrides: safeName, VIP tier, isBanned, creditVisibility) */
  updateTransaction(id: string, dto: UpdateSupportTransactionDto): Observable<SupportTransactionDoc>;

  /** Retries appreciation post generation for a failed transaction */
  retryTransaction(id: string): Observable<{ success: boolean; message: string; transaction: SupportTransactionDoc }>;

  /** Resolves transaction manually with custom tweet text */
  manualResolve(id: string, dto: ManualResolveSupportDto): Observable<SupportTransactionDoc>;

  /** Ingests a missing transaction manually from Stripe dashboard records */
  manualEntry(dto: ManualEntrySupportDto): Observable<SupportTransactionDoc>;

  /** Retrieves all digital reward image assets */
  getRewards(): Observable<{ rewards: RewardImageDoc[] }>;

  /** Uploads a new digital reward asset */
  uploadReward(file: File, title: string): Observable<RewardImageDoc>;

  /** Updates reward asset title or active status */
  updateReward(id: string, dto: { title?: string; isActive?: boolean }): Observable<RewardImageDoc>;

  /** Deletes a reward image asset */
  deleteReward(id: string): Observable<{ success: boolean }>;
}

export const SUPPORTERS_REPOSITORY = new InjectionToken<SupportersRepository>('SUPPORTERS_REPOSITORY');
