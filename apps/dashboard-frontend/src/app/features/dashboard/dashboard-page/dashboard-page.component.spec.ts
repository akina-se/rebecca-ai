import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { DashboardPageComponent } from './dashboard-page.component';
import { DASHBOARD_REPOSITORY } from '../../../core/ports/dashboard.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { ActionHelperService } from '../../../shared/services/action-helper.service';

describe('DashboardPageComponent', () => {
  let component: DashboardPageComponent;
  let fixture: ComponentFixture<DashboardPageComponent>;
  let dashboardRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let actionHelperSpy: jasmine.SpyObj<ActionHelperService>;

  beforeEach(async () => {
    dashboardRepoSpy = jasmine.createSpyObj('DashboardRepository', [
      'getKpiMetrics',
      'getTopPosts',
      'getTopUsers',
      'getTimelineHistory',
      'getAlerts',
      'deletePosts'
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);
    actionHelperSpy = jasmine.createSpyObj('ActionHelperService', ['executeMockAction']);

    dashboardRepoSpy.getKpiMetrics.and.returnValue(of({
      followers: 1200,
      followersTrend: null,
      followersHistory: [],
      engagementRate: 4.5,
      engagementTrend: 0.2,
      engagementHistory: [],
      dailyActiveUsers: 300,
      dauTrend: null,
      dauHistory: [],
      apiCalls: 15000,
      apiCallsTrend: 0.0,
      apiCallsHistory: []
    }));
    dashboardRepoSpy.getTopPosts.and.returnValue(of({ data: [] }));
    dashboardRepoSpy.getTopUsers.and.returnValue(of({ data: [] }));
    dashboardRepoSpy.getTimelineHistory.and.returnValue(of({ data: [], meta: { totalPages: 1, totalItems: 0 } }));
    dashboardRepoSpy.getAlerts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent, HttpClientTestingModule],
      providers: [
        { provide: DASHBOARD_REPOSITORY, useValue: dashboardRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: ActionHelperService, useValue: actionHelperSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    component = fixture.componentInstance;
  });

  it('should create dashboard page component and load initial metrics', () => {
    component.ngOnInit();
    expect(dashboardRepoSpy.getKpiMetrics).toHaveBeenCalled();
    expect(dashboardRepoSpy.getTopPosts).toHaveBeenCalled();
    expect(dashboardRepoSpy.getTopUsers).toHaveBeenCalled();
    expect(dashboardRepoSpy.getTimelineHistory).toHaveBeenCalled();
    expect(component.kpiMetrics()?.followers).toBe(1200);
  });

  it('should switch mode for top posts and top users', () => {
    component.setMode('posts', 'monthly');
    expect(component.topPostsMode).toBe('monthly');
    expect(component.topPostsDate).toContain('2026');

    component.setMode('posts', 'all-time');
    expect(component.topPostsMode).toBe('all-time');
    expect(component.topPostsDate).toBe('All-Time');

    component.setMode('users', 'monthly');
    expect(component.topUsersMode).toBe('monthly');
    expect(component.topUsersDate).toContain('2026');

    component.setMode('users', 'all-time');
    expect(component.topUsersMode).toBe('all-time');
    expect(component.topUsersDate).toBe('All-Time');
  });

  it('should shift date backward and forward honoring boundary limits', () => {
    component.setMode('posts', 'monthly');
    component.topPostsDate = 'July 2026';
    component.shiftDate('posts', -1);
    expect(component.topPostsDate).toBe('June 2026');
    component.shiftDate('posts', -1);
    expect(component.topPostsDate).toBe('May 2026');

    // Test March 2006 lower boundary
    component.topPostsDate = 'March 2006';
    component.shiftDate('posts', -1);
    expect(component.topPostsDate).toBe('March 2006');

    component.setMode('users', 'yearly');
    component.topUsersDate = '2006';
    component.shiftDate('users', -1);
    expect(component.topUsersDate).toBe('2006'); // Lower boundary
    component.shiftDate('users', 1);
    expect(component.topUsersDate).toBe('2007');
  });

  it('should calculate SVG sparkline points and polygon strings', () => {
    const points = component.getSparklinePoints([10, 20, 15, 30], 20, 100);
    expect(points).toContain('0,');
    expect(points).toContain('100,');

    const polygon = component.getSparklinePolygon([10, 20, 15, 30], 20, 100);
    expect(polygon).toContain('0,20');
    expect(polygon).toContain('100,20');

    // Empty array fallbacks
    expect(component.getSparklinePoints([])).toBe('0,20 100,20');
    expect(component.getSparklinePolygon([])).toBe('0,20 100,20');
  });

  it('should toggle selection for timeline posts', () => {
    component.timelinePosts.set([
      { id: 'p1', time: '2026-08-15', snippet: 'Post 1', impressions: 10, status: 'SUCCESS' } as any,
      { id: 'p2', time: '2026-08-15', snippet: 'Post 2', impressions: 20, status: 'SUCCESS' } as any
    ]);

    component.toggleSelectAll();
    expect(component.selectAll).toBeTrue();
    expect(component.selectedRows.size).toBe(2);

    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    component.toggleRowSelection('p1', mockEvent);
    expect(component.selectedRows.has('p1')).toBeFalse();
    expect(component.selectAll).toBeFalse();

    component.toggleRowSelection('p1', mockEvent);
    expect(component.selectedRows.has('p1')).toBeTrue();
    expect(component.selectAll).toBeTrue();
  });

  it('should execute bulk delete on selected posts and handle errors', async () => {
    dashboardRepoSpy.deletePosts.and.returnValue(of({ success: true, count: 1 }));
    component.selectedRows.add('p1');

    await component.executeBulkDelete();
    expect(dashboardRepoSpy.deletePosts).toHaveBeenCalledWith(['p1']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Successfully deleted/), 'success');

    // Error case
    component.selectedRows.add('p1');
    dashboardRepoSpy.deletePosts.and.returnValue(throwError(() => new Error('Delete failed')));
    await component.executeBulkDelete();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to delete posts', 'error');

    // Empty selection
    component.selectedRows.clear();
    await component.executeBulkDelete();
  });

  it('should execute bulk archive on selected posts', async () => {
    actionHelperSpy.executeMockAction.and.returnValue(Promise.resolve());
    component.selectedRows.add('p1');

    await component.executeBulkArchive();
    expect(actionHelperSpy.executeMockAction).toHaveBeenCalled();

    // Empty selection
    component.selectedRows.clear();
    await component.executeBulkArchive();
  });

  it('should open ranking modal for posts and users', () => {
    dashboardRepoSpy.getTopPosts.and.returnValue(of({ data: [{ id: 'p1', impressions: 100 } as any], meta: { totalPages: 1, totalItems: 1, currentPage: 1, limit: 10 } }));
    component.openRankingModal('posts');
    expect(component.rankingModalType()).toBe('post');
    expect(component.rankingModalEntries().length).toBe(1);

    dashboardRepoSpy.getTopUsers.and.returnValue(of({ data: [{ userId: 'user1', interactions: 50, handle: '@user1' } as any], meta: { totalPages: 1, totalItems: 1, currentPage: 1, limit: 10 } }));
    component.openRankingModal('users');
    expect(component.rankingModalType()).toBe('user');
    expect(component.rankingModalEntries().length).toBe(1);
  });

  it('should open lightbox and drawers for post and user', () => {
    component.openLightbox('https://example.com/img.jpg');
    expect(component.lightboxImageUrl()).toBe('https://example.com/img.jpg');
    expect(component.isLightboxOpen()).toBeTrue();

    component.openPostDrawer('p1');
    expect(component.drawerType()).toBe('post');
    expect(component.isDrawerOpen()).toBeTrue();

    component.openUserDrawer('u1');
    expect(component.drawerType()).toBe('user');
    expect(component.isDrawerOpen()).toBeTrue();
  });

  it('should parse ISO date string properly', () => {
    expect(component.getIsoDate('All-Time')).toBe('');
    expect(component.getIsoDate('July 2026')).toBe('2026-07');
    expect(component.getIsoDate('2026')).toBe('2026');
    expect(component.getIsoDate('Unknown Month 2026')).toBe('Unknown Month 2026');
  });

  it('should set KPI filter for 7d, 30d, and ytd', () => {
    component.setKpiFilter('Last 7 Days');
    expect(dashboardRepoSpy.getKpiMetrics).toHaveBeenCalledWith('weekly');

    component.setKpiFilter('Last 30 Days');
    expect(dashboardRepoSpy.getKpiMetrics).toHaveBeenCalledWith('monthly');

    component.setKpiFilter('Year to Date');
    expect(dashboardRepoSpy.getKpiMetrics).toHaveBeenCalledWith('yearly');
  });

  it('should handle timeline sorting, date picking, search filtering, and alerts', () => {
    component.toggleTimelineSort('time');
    expect(component.timelineSortOrder).toBe('asc');
    component.toggleTimelineSort('impressions');
    expect(component.timelineSortBy).toBe('impressions');

    component.onDatePicked('posts', '2026');
    component.onDatePicked('users', '2026');

    component.searchQuery = 'cool';
    component.timelinePosts.set([
      { id: '1', snippet: 'cool post', text: 'cool post' } as any,
      { id: '2', snippet: 'other', text: 'other' } as any
    ]);
    component.applyTimelineFilter();
    expect(component.filteredTimelinePosts().length).toBe(1);

    component.mockAlert('System message');
    expect(toastServiceSpy.show).toHaveBeenCalledWith('System message', 'info');
  });

  it('should strip size=thumbnail when opening lightbox and handle state', () => {
    component.openLightbox('/api/v1/assets/photo1.webp?size=thumbnail');
    expect(component.lightboxImageUrl()).toBe('/api/v1/assets/photo1.webp');
    expect(component.isLightboxOpen()).toBeTrue();

    // Plain URL without size parameter
    component.openLightbox('https://cdn.example.com/original.jpg');
    expect(component.lightboxImageUrl()).toBe('https://cdn.example.com/original.jpg');

    // Empty URL
    component.openLightbox('');
    expect(component.lightboxImageUrl()).toBe('');
  });

  it('should open and handle state for post drawer, user drawer, and ranking modals', () => {
    component.openPostDrawer('p_101');
    expect(component.isDrawerOpen()).toBeTrue();
    expect(component.drawerType()).toBe('post');
    expect(component.selectedItemId()).toBe('p_101');

    component.openUserDrawer('u_202');
    expect(component.isDrawerOpen()).toBeTrue();
    expect(component.drawerType()).toBe('user');
    expect(component.selectedItemId()).toBe('u_202');

    component.openRankingModal('posts');
    expect(component.isRankingModalOpen()).toBeTrue();
    expect(component.rankingModalType()).toBe('post');

    component.onRankingPageChange(2);
    expect(component.rankingModalCurrentPage()).toBe(2);
  });

  it('should test canShiftDate for monthly, yearly, and all-time bounds', () => {
    component.setMode('posts', 'all-time');
    expect(component.canShiftDate('posts', 1)).toBeFalse();
    expect(component.canShiftDate('posts', -1)).toBeFalse();

    component.setMode('posts', 'monthly');
    component.topPostsDate = 'March 2006';
    expect(component.canShiftDate('posts', -1)).toBeFalse();
    expect(component.canShiftDate('posts', 1)).toBeTrue();

    component.topPostsDate = 'InvalidMonth 2026';
    expect(component.canShiftDate('posts', 1)).toBeFalse();

    component.setMode('users', 'yearly');
    component.topUsersDate = '2006';
    expect(component.canShiftDate('users', -1)).toBeFalse();
    expect(component.canShiftDate('users', 1)).toBeTrue();
  });

  it('should handle year roll-over when shifting months backward and forward', () => {
    component.setMode('posts', 'monthly');
    component.topPostsDate = 'January 2025';
    component.shiftDate('posts', -1);
    expect(component.topPostsDate).toBe('December 2024');

    component.shiftDate('posts', 1);
    expect(component.topPostsDate).toBe('January 2025');
  });

  it('should render KPI card trends correctly for positive, negative, zero, and null trends', () => {
    dashboardRepoSpy.getKpiMetrics.and.returnValue(of({
      followers: 141,
      followersTrend: 5.2,
      followersHistory: [10, 20],
      engagementRate: 19.8,
      engagementTrend: -73.5,
      engagementHistory: [5, 15],
      dailyActiveUsers: 1,
      dauTrend: 0.0,
      dauHistory: [1],
      apiCalls: 158,
      apiCallsTrend: null,
      apiCallsHistory: [100, 58]
    }));
    component.setKpiFilter('Last 30 Days');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('+5.2%');
    expect(text).toContain('-73.5%');
    expect(text).toContain('0%');
    expect(text).toContain('前日比');
  });
});
