import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert } from '@rebecca/types';

export interface DashboardRepository {
  getKpiMetrics(period: string): Observable<KpiMetrics>;
  getTopPosts(period: string, date?: string): Observable<PostLeaderboard[]>;
  getTopUsers(period: string, date?: string): Observable<UserLeaderboard[]>;
  getAlerts(): Observable<SystemAlert[]>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
