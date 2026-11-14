import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  KpiMetrics,
  PostLeaderboard,
  UserLeaderboard,
  SystemAlert,
  PaginatedResponse,
  PostDetail,
  BatchTriggerResponse,
} from '@rebecca/types';

export interface DashboardRepository {
  getKpiMetrics(period: string): Observable<KpiMetrics>;
  getTopPosts(period: string, date?: string, page?: number, limit?: number): Observable<PaginatedResponse<PostLeaderboard>>;
  getTopUsers(period: string, date?: string, page?: number, limit?: number): Observable<PaginatedResponse<UserLeaderboard>>;
  getAlerts(): Observable<SystemAlert[]>;
  getTimelineHistory(page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Observable<PaginatedResponse<PostLeaderboard>>;
  getPostById(id: string): Observable<PostDetail>;
  deletePosts(ids: string[]): Observable<void>;
  syncPosts(): Observable<BatchTriggerResponse>;
  triggerReply(): Observable<BatchTriggerResponse>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<DashboardRepository>('DashboardRepository');
