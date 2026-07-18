import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DashboardRepository } from '../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert } from '@rebecca/types';

@Injectable({
  providedIn: 'root'
})
export class MockDashboardRepository implements DashboardRepository {
  getKpiMetrics(period: string): Observable<KpiMetrics> {
    // Simulated mock data from the server based on the selected period
    return of({
      followers: 1248,
      followersTrend: 12,
      engagementRate: 4.2,
      engagementTrend: 0.5,
      dailyActiveUsers: 45,
      dauTrend: -2,
      apiCalls: 3142,
      apiTrendStatus: 'Steady'
    });
  }

  getTopPosts(period: string, date?: string): Observable<PostLeaderboard[]> {
    return of([
      { id: '1', time: '2026-07-10 18:00', snippet: '水星の魔女、最新話見た！？...', impressions: 5120, hasMedia: true },
      { id: '2', time: '2026-07-09 08:00', snippet: 'おはよう！今日も1日頑張ろうね', impressions: 4800, hasMedia: false },
      { id: '3', time: '2026-07-08 12:00', snippet: '夏コミ行く人いるー？', impressions: 3950, hasMedia: true }
    ]);
  }

  getTopUsers(period: string, date?: string): Observable<UserLeaderboard[]> {
    return of([
      { userId: '@gundam_fan_88', interactions: 156 },
      { userId: '@rebecca_oshi', interactions: 132 },
      { userId: '@tech_geek_tokyo', interactions: 89 }
    ]);
  }

  getAlerts(): Observable<SystemAlert[]> {
    return of([
      {
        id: 'assets-caption-failed',
        type: 'warning',
        message: '2 assets failed to generate AI captions. Interaction required to resolve pipeline blocks.',
        link: '/assets',
        linkText: 'Review Assets'
      }
    ]);
  }
}
