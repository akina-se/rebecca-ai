import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UsersRepository } from '../../core/ports/users.repository';
import { UserDetail, UserStatus } from '@rebecca/types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HttpUsersRepository implements UsersRepository {
  private http = inject(HttpClient);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:8081/api/v1/dashboard';

  getAll(): Observable<UserDetail[]> {
    return this.http.get<UserDetail[]>(`${this.baseUrl}/users`).pipe(
      map(users => users.map(user => ({
        ...user,
        status: this.mapStatus(user.status)
      })))
    );
  }

  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail> {
    let params = new HttpParams();
    if (beforeTimestamp) {
      params = params.set('beforeTimestamp', beforeTimestamp);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<UserDetail>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, { params }).pipe(
      map(user => ({
        ...user,
        status: this.mapStatus(user.status)
      }))
    );
  }

  updateMemory(id: string, coreProfile: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/users/${encodeURIComponent(id)}/memory`, { coreProfile });
  }

  bulkUpdateStatus(ids: string[], status: string): Observable<any> {
    const backendStatus = this.mapStatusToBackend(status);
    return this.http.put<any>(`${this.baseUrl}/users/status`, { ids, status: backendStatus });
  }

  private mapStatus(status: any): UserStatus {
    if (!status) return 'ACTIVE';
    const s = String(status).toUpperCase();
    if (s === 'ACTIVE') return 'ACTIVE';
    if (s === 'BLOCKED') return 'BLOCKED';
    if (s === 'MUTED') return 'MUTED';
    return 'ACTIVE';
  }

  private mapStatusToBackend(status: string): string {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return 'Active';
    if (s === 'BLOCKED') return 'Blocked';
    if (s === 'MUTED') return 'Muted';
    return status;
  }
}
