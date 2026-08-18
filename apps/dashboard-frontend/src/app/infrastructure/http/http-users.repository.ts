import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UsersRepository } from '../../core/ports/users.repository';
import { UserDetail, UserStatus, PaginatedResponse } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the users BFF endpoints.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpUsersRepository implements UsersRepository {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1';

  /**
   * Fetches all user details from the backend supporting pagination, search, and sorting.
   * 
   * @returns Observable list of users.
   */
  getAll(params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; }): Observable<PaginatedResponse<UserDetail>> {
    let httpParams = new HttpParams();
    if (params?.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    return this.http.get<PaginatedResponse<UserDetail>>(`${this.baseUrl}/users`, { params: httpParams }).pipe(
      map(response => ({
        ...response,
        data: (response.data || []).map((user: UserDetail) => ({
          ...user,
          status: this.mapStatus(user.status)
        }))
      }))
    );
  }

  /**
   * Fetches a specific user profile and status by ID, supporting conversation beforeTimestamp pagination.
   * 
   * @param id - The user ID/handle to look up.
   * @param beforeTimestamp - Optional filter for chat logs.
   * @param limit - Optional limit for chat logs.
   * @returns Observable of user detail.
   */
  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail> {
    let params = new HttpParams();
    if (beforeTimestamp) {
      params = params.set('beforeTimestamp', beforeTimestamp);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<UserDetail>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, { params }).pipe(
      map((user: UserDetail) => ({
        ...user,
        status: this.mapStatus(user.status)
      }))
    );
  }

  /**
   * Updates a user's core personality memory on the backend.
   * 
   * @param id - The user ID/handle to update.
   * @param coreProfile - The JSON string representing the new memory.
   * @returns Observable resolving when update completes.
   */
  updateMemory(id: string, coreProfile: string): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/users/${encodeURIComponent(id)}/memory`, { coreProfile });
  }

  /**
   * Updates the status of multiple users in a bulk operation.
   * 
   * @param ids - The array of user IDs/handles to update.
   * @param status - The new status (Active, Blocked, Muted) to apply.
   * @returns Observable resolving when bulk update completes.
   */
  bulkUpdateStatus(ids: string[], status: UserStatus): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/users/status`, { ids, status });
  }

  /**
   * Helper to map status values to strictly-typed UserStatus enum.
   * 
   * @param status - The raw status input.
   * @returns The resolved UserStatus.
   */
  private mapStatus(status: unknown): UserStatus {
    if (!status) return UserStatus.ACTIVE;
    const s = String(status).toUpperCase();
    if (s === 'ACTIVE') return UserStatus.ACTIVE;
    if (s === 'BLOCKED') return UserStatus.BLOCKED;
    if (s === 'MUTED') return UserStatus.MUTED;
    return UserStatus.ACTIVE;
  }

  /**
   * Helper to serialize enum to expected backend format.
   * 
   * @param status - The status string.
   * @returns The backend string representation.
   */
  private mapStatusToBackend(status: string): string {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return 'Active';
    if (s === 'BLOCKED') return 'Blocked';
    if (s === 'MUTED') return 'Muted';
    return status;
  }
}
