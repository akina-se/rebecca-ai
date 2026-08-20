import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardPageComponent } from './dashboard-page.component';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../core/ports/dashboard.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { of } from 'rxjs';
import { KpiMetrics, PostLeaderboard, UserLeaderboard } from '@rebecca/types';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('DashboardPageComponent (White-box Coverage)', () => {
  let component: DashboardPageComponent;
  let fixture: ComponentFixture<DashboardPageComponent>;
  let mockDashboardRepo: jasmine.SpyObj<DashboardRepository>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const mockKpi: KpiMetrics = {
    followers: 1000,
    followersTrend: 5,
    engagementRate: 8.4,
    engagementTrend: 1.2,
    dailyActiveUsers: 45,
    dauTrend: 2,
    apiCalls: 1200,
    apiTrendStatus: 'Normal'
  };

  const mockPosts: PostLeaderboard[] = [
    { id: 'p1', time: '2026-07-20T10:00:00Z', snippet: 'Hello world', impressions: 1500, hasMedia: false },
    { id: 'p2', time: '2026-07-21T12:00:00Z', snippet: 'Testing AI', impressions: 900, hasMedia: false }
  ];

  const mockUsers: UserLeaderboard[] = [
    { userId: 'u1', interactions: 150 }
  ];

  beforeEach(async () => {
    mockDashboardRepo = jasmine.createSpyObj('DashboardRepository', [
      'getKpiMetrics', 'getTopPosts', 'getTopUsers', 'getTimelineHistory', 'deletePosts', 'getAlerts'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', ['show']);

    mockDashboardRepo.getKpiMetrics.and.returnValue(of(mockKpi));
    mockDashboardRepo.getTopPosts.and.returnValue(of({ data: mockPosts, meta: {} } as any));
    mockDashboardRepo.getTopUsers.and.returnValue(of({ data: mockUsers, meta: {} } as any));
    mockDashboardRepo.getTimelineHistory.and.returnValue(of({ data: mockPosts, meta: { totalPages: 1, totalItems: 2 } } as any));
    mockDashboardRepo.deletePosts.and.returnValue(of(void 0));
    mockDashboardRepo.getAlerts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DASHBOARD_REPOSITORY, useValue: mockDashboardRepo },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load KPIs, leaderboards, and timeline', () => {
    expect(component).toBeTruthy();
    expect(mockDashboardRepo.getKpiMetrics).toHaveBeenCalledWith('monthly');
    expect(mockDashboardRepo.getTopPosts).toHaveBeenCalled();
    expect(mockDashboardRepo.getTopUsers).toHaveBeenCalled();
    expect(mockDashboardRepo.getTimelineHistory).toHaveBeenCalled();
    expect(component.kpiMetrics).toEqual(mockKpi);
    expect(component.timelinePosts.length).toBe(2);
  });

  it('should load KPIs for different periods', () => {
    component.setKpiFilter('Last 7 Days');
    expect(mockDashboardRepo.getKpiMetrics).toHaveBeenCalledWith('weekly');

    component.setKpiFilter('Year to Date');
    expect(mockDashboardRepo.getKpiMetrics).toHaveBeenCalledWith('yearly');
  });

  it('should handle search keyword change', () => {
    component.searchQuery = 'Rebecca AI';
    component.applyTimelineFilter();
    expect(component.filteredTimelinePosts).toEqual([]);
    
    component.searchQuery = 'Hello';
    component.applyTimelineFilter();
    expect(component.filteredTimelinePosts.length).toBe(1);
  });

  it('should perform bulk delete of posts and trigger reload', () => {
    component.selectedRows.add('p1');
    component.selectedRows.add('p2');
    component.executeBulkDelete();
    expect(mockDashboardRepo.deletePosts).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('should open ranking modal with live API data for posts and users', () => {
    component.openRankingModal('posts');
    expect(component.rankingModalType).toBe('post');
    expect(component.isRankingModalOpen).toBeTrue();
    expect(component.rankingModalEntries.length).toBe(2);

    component.openRankingModal('users');
    expect(component.rankingModalType).toBe('user');
    expect(component.rankingModalEntries.length).toBe(1);
  });

  it('should open post drawer and user drawer correctly', () => {
    component.openPostDrawer('p1');
    expect(component.drawerType).toBe('post');
    expect(component.selectedItemId).toBe('p1');
    expect(component.isDrawerOpen).toBeTrue();

    component.openUserDrawer('@user1');
    expect(component.drawerType).toBe('user');
    expect(component.selectedItemId).toBe('@user1');
  });
});
