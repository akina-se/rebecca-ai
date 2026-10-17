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
      reposts: 5,
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
      reposts: null,
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
      reposts: 0,
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
      reposts: 0,
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

  it('should open tweet on X via window.open on onViewOnX when tweetId is present', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.postData.set({
      id: 'doc_123',
      tweetId: 'tweet_123',
      time: '2026-08-15',
      text: 'Post',
      impressions: '100',
      status: 'SUCCESS',
      likes: 1,
      reposts: 0,
      replies: 0,
      mediaUrls: []
    });
    component.onViewOnX();
    expect(openSpy).toHaveBeenCalledWith('https://x.com/i/status/tweet_123', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('should show toast notification when tweetId is missing on onViewOnX', () => {
    component.postData.set(null);
    component.onViewOnX();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Tweet ID is not available/), 'info');
  });

  it('should compute poll vote totals, percentages, and leading option accurately', () => {
    dashboardRepoSpy.getPostById.and.returnValue(of({
      id: 'p_poll',
      time: '2026-10-17T11:00:00Z',
      content: 'Weekly poll question',
      impressions: 800,
      status: 'SUCCESS',
      likes: 20,
      reposts: 4,
      replies: 6,
      mediaUrls: [],
      poll: {
        id: 'poll_100',
        options: [
          { position: 1, label: 'Option A', votes: 30 },
          { position: 2, label: 'Option B', votes: 15 },
          { position: 3, label: 'Option C', votes: 5 }
        ],
        votingStatus: 'closed'
      }
    }));

    component.postId = 'p_poll';
    component.ngOnChanges();

    expect(component.postData()?.poll?.id).toBe('poll_100');
    expect(component.getTotalPollVotes()).toBe(50);
    expect(component.getPollOptionPercentage(30)).toBe(60);
    expect(component.getPollOptionPercentage(15)).toBe(30);
    expect(component.getPollOptionPercentage(5)).toBe(10);
    expect(component.isLeadingPollOption(30)).toBeTrue();
    expect(component.isLeadingPollOption(15)).toBeFalse();
  });

  it('should return 0 votes and false leading option when poll has 0 votes or is absent', () => {
    component.postData.set({
      id: 'p_empty_poll',
      time: '2026-10-17T11:00:00Z',
      text: 'Zero votes poll',
      impressions: '10',
      status: 'SUCCESS',
      likes: 0,
      reposts: 0,
      replies: 0,
      mediaUrls: [],
      poll: {
        options: [
          { position: 1, label: 'A', votes: 0 },
          { position: 2, label: 'B', votes: 0 }
        ],
        votingStatus: 'open'
      }
    });

    expect(component.getTotalPollVotes()).toBe(0);
    expect(component.getPollOptionPercentage(0)).toBe(0);
    expect(component.isLeadingPollOption(0)).toBeFalse();

    component.postData.set(null);
    expect(component.getTotalPollVotes()).toBe(0);
    expect(component.isLeadingPollOption(10)).toBeFalse();
  });
});

