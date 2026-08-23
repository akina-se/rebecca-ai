import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardRepository } from '../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert, PaginatedResponse, PostDetail } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the dashboard BFF backend.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpDashboardRepository implements DashboardRepository {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;
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
   * Fetches the top timeline posts from the backend with server-side pagination.
   * 
   * @param period The time period filter.
   * @param date Optional date filter.
   * @param page Page number (1-based).
   * @param limit Page size.
   * @returns Observable list of top posts with metadata.
   */
  getTopPosts(period: string, date?: string, page = 1, limit = 10): Observable<PaginatedResponse<PostLeaderboard>> {
    let params = new HttpParams()
      .set('period', period)
      .set('sortBy', 'impressions')
      .set('sortOrder', 'desc')
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<PaginatedResponse<PostLeaderboard>>(`${this.postsBaseUrl}`, { params });
  }

  /**
   * Fetches top engaged users from the backend with server-side pagination.
   * 
   * @param period The time period filter.
   * @param date Optional date filter.
   * @param page Page number (1-based).
   * @param limit Page size.
   * @returns Observable list of top users with metadata.
   */
  getTopUsers(period: string, date?: string, page = 1, limit = 10): Observable<PaginatedResponse<UserLeaderboard>> {
    let params = new HttpParams()
      .set('period', period)
      .set('sortBy', 'interactions')
      .set('sortOrder', 'desc')
      .set('page', page.toString())
      .set('limit', limit.toString());
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

  getTimelineHistory(page: number, limit: number, sortBy = 'created_at', sortOrder: 'asc' | 'desc' = 'desc'): Observable<PaginatedResponse<PostLeaderboard>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortBy', sortBy)
      .set('sortOrder', sortOrder);
    return this.http.get<PaginatedResponse<PostLeaderboard>>(`${this.postsBaseUrl}`, { params });
  }

  getPostById(id: string): Observable<PostDetail> {
    return this.http.get<PostDetail>(`${this.postsBaseUrl}/${id}`);
  }

  deletePosts(ids: string[]): Observable<void> {
    return this.http.request('DELETE', this.postsBaseUrl, { body: { ids } }) as unknown as Observable<void>;
  }
}
