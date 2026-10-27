import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SupportersRepository } from '../../core/ports/supporters.repository';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupporterLedgerQuery,
  SupporterLedgerResponse,
  UpdateSupportTransactionDto,
  ManualResolveSupportDto,
  ManualEntrySupportDto,
  SupportPlanItem,
} from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Concrete HTTP implementation of SupportersRepository communicating with dashboard-backend.
 */
@Injectable({
  providedIn: 'root',
})
export class HttpSupportersRepository implements SupportersRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/supporters`;

  getLedger(query?: SupporterLedgerQuery): Observable<SupporterLedgerResponse> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) {
        params = params.set('page', query.page.toString());
      }
      if (query.limit !== undefined) {
        params = params.set('limit', query.limit.toString());
      }
      if (query.cursor) {
        params = params.set('cursor', query.cursor);
      }
      if (query.status && query.status !== 'all') {
        params = params.set('status', query.status);
      }
      if (query.tier && query.tier !== 'all') {
        params = params.set('tier', query.tier);
      }
      if (query.search && query.search.trim()) {
        params = params.set('search', query.search.trim());
      }
    }
    return this.http.get<SupporterLedgerResponse>(this.baseUrl, { params });
  }

  getTransactionById(id: string): Observable<SupportTransactionDoc> {
    return this.http.get<SupportTransactionDoc>(`${this.baseUrl}/${id}`);
  }

  updateTransaction(id: string, dto: UpdateSupportTransactionDto): Observable<SupportTransactionDoc> {
    return this.http.patch<SupportTransactionDoc>(`${this.baseUrl}/${id}`, dto);
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`) as Observable<void>;
  }

  retryTransaction(id: string): Observable<{ success: boolean; message: string; transaction: SupportTransactionDoc }> {
    return this.http.post<{ success: boolean; message: string; transaction: SupportTransactionDoc }>(
      `${this.baseUrl}/${id}/retry`,
      {},
    );
  }

  manualResolve(id: string, dto: ManualResolveSupportDto): Observable<SupportTransactionDoc> {
    return this.http.post<SupportTransactionDoc>(`${this.baseUrl}/${id}/manual-resolve`, dto);
  }

  manualEntry(dto: ManualEntrySupportDto): Observable<SupportTransactionDoc> {
    return this.http.post<SupportTransactionDoc>(`${this.baseUrl}/manual-entry`, dto);
  }

  getPlans(): Observable<{ plans: SupportPlanItem[] }> {
    return this.http.get<{ plans: SupportPlanItem[] }>(`${this.baseUrl}/plans`);
  }

  getRewards(): Observable<{ rewards: RewardImageDoc[] }> {
    return this.http.get<{ rewards: RewardImageDoc[] }>(`${this.baseUrl}/rewards`);
  }

  uploadReward(file: File, title: string): Observable<RewardImageDoc> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    return this.http.post<RewardImageDoc>(`${this.baseUrl}/rewards`, formData);
  }

  updateReward(id: string, dto: { title?: string; isActive?: boolean }): Observable<RewardImageDoc> {
    return this.http.patch<RewardImageDoc>(`${this.baseUrl}/rewards/${id}`, dto);
  }

  deleteReward(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/rewards/${id}`);
  }

  getRewardImageBlob(id: string, type: 'thumbnail' | 'master'): Observable<Blob> {
    const params = new HttpParams().set('type', type);
    return this.http.get(`${this.baseUrl}/rewards/${id}/image`, {
      params,
      responseType: 'blob',
    });
  }
}
