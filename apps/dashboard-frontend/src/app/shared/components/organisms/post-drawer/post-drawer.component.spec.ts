import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { PostDrawerComponent } from './post-drawer.component';
import { DASHBOARD_REPOSITORY } from '../../../../core/ports/dashboard.repository';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';

describe('PostDrawerComponent', () => {
  let component: PostDrawerComponent;
  let fixture: ComponentFixture<PostDrawerComponent>;
  let dashboardRepoSpy: jasmine.SpyObj<any>;
  let drawerServiceSpy: jasmine.SpyObj<DrawerService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dashboardRepoSpy = jasmine.createSpyObj('DashboardRepository', ['getPostById', 'deletePosts']);
    drawerServiceSpy = jasmine.createSpyObj('DrawerService', ['close', 'open']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [PostDrawerComponent, HttpClientTestingModule],
      providers: [
        { provide: DASHBOARD_REPOSITORY, useValue: dashboardRepoSpy },
        { provide: DrawerService, useValue: drawerServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        CopilotContextService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PostDrawerComponent);
    component = fixture.componentInstance;
  });

  it('should load post details when postId changes', () => {
    dashboardRepoSpy.getPostById.and.returnValue(of({
      id: 'p123',
      time: '2026-08-15T00:00:00Z',
      content: 'Sample post',
      impressions: 500,
      status: 'SUCCESS',
      likes: 10,
      retweets: 5,
      replies: 2,
      mediaUrls: ['https://example.com/p.jpg']
    }));

    component.postId = 'p123';
    component.ngOnChanges();

    expect(dashboardRepoSpy.getPostById).toHaveBeenCalledWith('p123');
    expect(component.postData()).toBeTruthy();
    expect(component.postData()?.text).toBe('Sample post');
    expect(component.isLoading()).toBeFalse();
  });

  it('should handle post with null fields gracefully in ngOnChanges', () => {
    dashboardRepoSpy.getPostById.and.returnValue(of({
      id: 'p_null',
      time: '2026-08-15T00:00:00Z',
      content: null,
      impressions: null,
      status: null,
      likes: null,
      retweets: null,
      replies: null,
      mediaUrls: null
    }));

    component.postId = 'p_null';
    component.ngOnChanges();

    expect(component.postData()?.text).toBe('');
    expect(component.postData()?.impressions).toBe('0');
    expect(component.postData()?.status).toBe('SUCCESS');
    expect(component.postData()?.mediaUrls).toEqual([]);

    // When postId is null
    component.postId = null;
    component.ngOnChanges();
    expect(component.isLoading()).toBeFalse();
  });

  it('should handle post load error gracefully', () => {
    dashboardRepoSpy.getPostById.and.returnValue(throwError(() => new Error('Not found')));

    component.postId = 'p_err';
    component.ngOnChanges();

    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to load/), 'error');
    expect(component.isLoading()).toBeFalse();
  });

  it('should delete post on onDelete', () => {
    component.postData.set({
      id: 'p123',
      time: '2026-08-15',
      text: 'Post',
      impressions: '100',
      status: 'SUCCESS',
      likes: 1,
      retweets: 0,
      replies: 0,
      mediaUrls: []
    });
    dashboardRepoSpy.deletePosts.and.returnValue(of(void 0));

    component.onDelete();

    expect(dashboardRepoSpy.deletePosts).toHaveBeenCalledWith(['p123']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/deleted successfully/), 'success');
  });

  it('should handle delete post error', () => {
    component.postData.set({
      id: 'p123',
      time: '2026-08-15',
      text: 'Post',
      impressions: '100',
      status: 'SUCCESS',
      likes: 1,
      retweets: 0,
      replies: 0,
      mediaUrls: []
    });
    dashboardRepoSpy.deletePosts.and.returnValue(throwError(() => new Error('Delete failed')));

    component.onDelete();

    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to delete/), 'error');
  });

  it('should open lightbox on onMediaClick', () => {
    spyOn(component.openLightbox, 'emit');
    component.onMediaClick('https://example.com/img.png');
    expect(component.openLightbox.emit).toHaveBeenCalledWith('https://example.com/img.png');
  });

  it('should open tweet on X via window.open on onViewOnX', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.postId = 'tweet_123';
    component.onViewOnX();
    expect(openSpy).toHaveBeenCalledWith('https://x.com/i/status/tweet_123', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });
});

