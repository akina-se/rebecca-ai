import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert, PaginatedResponse } from '@rebecca/types';

export interface DashboardRepository {
  getKpiMetrics(period: string): Observable<KpiMetrics>;
  getTopPosts(period: string, date?: string): Observable<PaginatedResponse<PostLeaderboard>>;
  getTopUsers(period: string, date?: string): Observable<PaginatedResponse<UserLeaderboard>>;
  getAlerts(): Observable<SystemAlert[]>;
  getTimelineHistory(page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Observable<PaginatedResponse<PostLeaderboard>>;
  getPostById(id: string): Observable<any>;
  deletePosts(ids: string[]): Observable<void>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
