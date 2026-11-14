import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PostsPageComponent } from './posts-page.component';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../core/ports/dashboard.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

describe('PostsPageComponent', () => {
  let component: PostsPageComponent;
  let fixture: ComponentFixture<PostsPageComponent>;
  let mockRepo: jasmine.SpyObj<DashboardRepository>;
  let mockToast: jasmine.SpyObj<ToastService>;
  let queryParamSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    queryParamSubject = new BehaviorSubject(convertToParamMap({}));
    mockRepo = jasmine.createSpyObj('DashboardRepository', [
      'getKpiMetrics',
      'getTopPosts',
      'getTopUsers',
      'getAlerts',
      'getTimelineHistory',
      'getPostById',
      'deletePosts',
      'syncPosts',
      'triggerReply',
    ]);
    mockToast = jasmine.createSpyObj('ToastService', ['show']);

    mockRepo.getTimelineHistory.and.returnValue(
      of({
        data: [
          {
            id: 'p1',
            time: '12:00',
            snippet: 'Hello World',
            impressions: 500,
            hasMedia: true,
            mediaUrls: ['/api/v1/assets/img1/image'],
          },
          {
            id: 'p2',
            time: '13:00',
            snippet: 'Second Post',
            impressions: 200,
            hasMedia: false,
            mediaUrls: [],
          },
        ],
        meta: { currentPage: 1, limit: 10, totalItems: 2, totalPages: 1 },
      })
    );
    mockRepo.deletePosts.and.returnValue(of(undefined));
    mockRepo.syncPosts.and.returnValue(of({ success: true, message: 'OK: Timeline synced successfully.' }));
    mockRepo.triggerReply.and.returnValue(of({ success: true, message: 'OK: Reply batch executed successfully.' }));

    await TestBed.configureTestingModule({
      imports: [PostsPageComponent, HttpClientTestingModule],
      providers: [
        { provide: DASHBOARD_REPOSITORY, useValue: mockRepo },
        { provide: ToastService, useValue: mockToast },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamSubject.asObservable() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load timeline history on init', () => {
    expect(component).toBeTruthy();
    expect(mockRepo.getTimelineHistory).toHaveBeenCalledWith(1, 10, 'created_at', 'desc');
    expect(component.timelinePosts().length).toBe(2);
    expect(component.filteredTimelinePosts().length).toBe(2);
  });

  it('should open post drawer when postId query param is present', () => {
    queryParamSubject.next(convertToParamMap({ postId: 'p1' }));
    expect(component.isDrawerOpen()).toBeTrue();
    expect(component.selectedItemId()).toBe('p1');
  });

  it('should filter timeline posts by search query', () => {
    component.searchQuery = 'second';
    component.applyTimelineFilter();
    expect(component.filteredTimelinePosts().length).toBe(1);
    expect(component.filteredTimelinePosts()[0].id).toBe('p2');

    component.searchQuery = '';
    component.applyTimelineFilter();
    expect(component.filteredTimelinePosts().length).toBe(2);
  });

  it('should toggle timeline sort column and order', () => {
    component.toggleTimelineSort('time');
    expect(component.timelineSortOrder).toBe('asc');
    expect(mockRepo.getTimelineHistory).toHaveBeenCalledWith(1, 10, 'created_at', 'asc');

    component.toggleTimelineSort('impressions');
    expect(component.timelineSortBy).toBe('impressions');
    expect(component.timelineSortOrder).toBe('desc');
    expect(mockRepo.getTimelineHistory).toHaveBeenCalledWith(1, 10, 'impressions', 'desc');
  });

  it('should handle timeline load error gracefully', () => {
    mockRepo.getTimelineHistory.and.returnValue(throwError(() => new Error('Network error')));
    component.loadTimeline(1);
    expect(component.isLoadingTimeline).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to load timeline', 'error');
  });

  it('should trigger manual post sync and reload timeline on success, and show error toast on failure', () => {
    component.syncPosts();
    expect(mockRepo.syncPosts).toHaveBeenCalled();
    expect(component.isSyncing()).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith(jasmine.any(String), 'success');
    expect(mockRepo.getTimelineHistory).toHaveBeenCalledTimes(2);

    // Error branch
    mockRepo.syncPosts.and.returnValue(throwError(() => new Error('Sync failed')));
    component.syncPosts();
    expect(component.isSyncing()).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should trigger manual reply execution and show toast on success or failure', () => {
    component.triggerReply();
    expect(mockRepo.triggerReply).toHaveBeenCalled();
    expect(component.isReplying()).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith(jasmine.any(String), 'success');

    // Error branch
    mockRepo.triggerReply.and.returnValue(throwError(() => new Error('Reply failed')));
    component.triggerReply();
    expect(component.isReplying()).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should manage row selection and bulk delete', async () => {
    component.toggleSelectAll();
    expect(component.selectAll).toBeTrue();
    expect(component.selectedRows.size).toBe(2);

    const mockEvent = new Event('change');
    component.toggleRowSelection('p1', mockEvent);
    expect(component.selectAll).toBeFalse();
    expect(component.selectedRows.size).toBe(1);

    component.toggleRowSelection('p1', mockEvent);
    expect(component.selectAll).toBeTrue();

    await component.executeBulkDelete();
    expect(mockRepo.deletePosts).toHaveBeenCalledWith(['p2', 'p1']);
    expect(component.selectedRows.size).toBe(0);
    expect(mockToast.show).toHaveBeenCalledWith('Successfully deleted 2 posts', 'success');

    // Error branch
    component.selectedRows.add('p1');
    mockRepo.deletePosts.and.returnValue(throwError(() => new Error('Delete failed')));
    await component.executeBulkDelete();
    expect(component.isDeleting()).toBeFalse();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to delete posts', 'error');
  });

  it('should format thumbnail URLs and open lightbox', () => {
    expect(component.getThumbnailUrl('')).toBe('');
    expect(component.getThumbnailUrl('/api/v1/assets/a1/image')).toBe('/api/v1/assets/a1/image?size=thumbnail');
    expect(component.getThumbnailUrl('/api/v1/assets/a1/image?foo=1')).toBe('/api/v1/assets/a1/image?foo=1&size=thumbnail');
    expect(component.getThumbnailUrl('https://example.com/pic.png')).toBe('https://example.com/pic.png');

    component.openLightbox('/api/v1/assets/a1/image?size=thumbnail');
    expect(component.isLightboxOpen()).toBeTrue();
    expect(component.lightboxImageUrl()).toBe('/api/v1/assets/a1/image');

    component.onPostDeleted('p1');
    expect(component.isDrawerOpen()).toBeFalse();
  });
});
