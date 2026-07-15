import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { KpiMetrics, PostLeaderboard, UserLeaderboard } from '../models/dashboard.model';

export interface DashboardRepository {
  getKpiMetrics(period: string): Observable<KpiMetrics>;
  getTopPosts(period: string): Observable<PostLeaderboard[]>;
  getTopUsers(period: string): Observable<UserLeaderboard[]>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
