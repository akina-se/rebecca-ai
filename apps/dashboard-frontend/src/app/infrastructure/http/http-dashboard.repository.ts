import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardRepository } from '../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert } from '@rebecca/types';
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
  getTopPosts(period: string, date?: string): Observable<PostLeaderboard[]> {
    let params = new HttpParams().set('period', period);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<PostLeaderboard[]>(`${this.baseUrl}/posts`, { params });
  }

  getTopUsers(period: string, date?: string): Observable<UserLeaderboard[]> {
    let params = new HttpParams().set('period', period);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<UserLeaderboard[]>(`${this.baseUrl}/users`, { params });
  }

  /**
   * Fetches active system alerts from the backend.
   * 
   * @returns Observable list of system alerts.
   */
  getAlerts(): Observable<SystemAlert[]> {
    return this.http.get<SystemAlert[]>(`${this.baseUrl}/alerts`);
  }
}
