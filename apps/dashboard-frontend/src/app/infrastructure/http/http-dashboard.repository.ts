import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardRepository } from '../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the dashboard BFF backend.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpDashboardRepository implements DashboardRepository {
  private http = inject(HttpClient);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:8081/api/v1/dashboard';

  /**
   * Fetches global KPI metrics from the backend.
   * 
   * @param period The time period filter.
   * @returns Observable of KPI metrics.
   */
  getKpiMetrics(period: string): Observable<KpiMetrics> {
    return this.http.get<KpiMetrics>(`${this.baseUrl}/metrics`);
  }

  /**
   * Fetches the top timeline posts from the backend.
   * 
   * @param period The time period filter.
   * @returns Observable list of top posts.
   */
  getTopPosts(period: string): Observable<PostLeaderboard[]> {
    return this.http.get<PostLeaderboard[]>(`${this.baseUrl}/posts`);
  }

  /**
   * Fetches the top engaged users from the backend.
   * 
   * @param period The time period filter.
   * @returns Observable list of top users.
   */
  getTopUsers(period: string): Observable<UserLeaderboard[]> {
    return this.http.get<UserLeaderboard[]>(`${this.baseUrl}/users`);
  }
}
