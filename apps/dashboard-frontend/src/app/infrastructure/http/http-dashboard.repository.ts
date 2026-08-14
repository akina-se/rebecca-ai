import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardRepository } from '../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert, PaginatedResponse } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the dashboard BFF backend.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpDashboardRepository implements DashboardRepository {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1';
  private postsBaseUrl = `${this.baseUrl}/posts`;

  /**
   * Fetches global KPI metrics from the backend.
   * 
   * @param period The time period filter.
   * @returns Observable of KPI metrics.
   */
  getKpiMetrics(period: string): Observable<KpiMetrics> {
    const params = new HttpParams().set('period', period);
    return this.http.get<KpiMetrics>(`${this.baseUrl}/metrics`, { params });
  }

  /**
   * Fetches the top timeline posts from the backend.
   * 
   * @param period The time period filter.
   * @returns Observable list of top posts.
   */
  getTopPosts(period: string, date?: string): Observable<PaginatedResponse<PostLeaderboard>> {
    let params = new HttpParams().set('period', period);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<PaginatedResponse<PostLeaderboard>>(`${this.postsBaseUrl}`, { params });
  }

  getTopUsers(period: string, date?: string): Observable<PaginatedResponse<UserLeaderboard>> {
    let params = new HttpParams().set('period', period);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<PaginatedResponse<UserLeaderboard>>(`${this.baseUrl}/users`, { params });
  }

  /**
   * Fetches active system alerts from the backend.
   * 
   * @returns Observable list of system alerts.
   */
  getAlerts(): Observable<SystemAlert[]> {
    return this.http.get<SystemAlert[]>(`${this.baseUrl}/alerts`);
  }

  getTimelineHistory(page: number, limit: number): Observable<PaginatedResponse<PostLeaderboard>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortBy', 'created_at')
      .set('sortOrder', 'desc');
    return this.http.get<PaginatedResponse<PostLeaderboard>>(`${this.postsBaseUrl}`, { params });
  }

  getPostById(id: string): Observable<any> {
    return this.http.get<any>(`${this.postsBaseUrl}/${id}`);
  }

  deletePosts(ids: string[]): Observable<void> {
    return this.http.delete<void>(`${this.postsBaseUrl}`, { body: { ids } });
  }
}
