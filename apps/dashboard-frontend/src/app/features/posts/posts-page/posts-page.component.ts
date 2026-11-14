import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DASHBOARD_REPOSITORY } from '../../../core/ports/dashboard.repository';
import { PostLeaderboard } from '@rebecca/types';
import { ToastService } from '../../../shared/services/toast.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { PostDrawerComponent } from '../../../shared/components/organisms/post-drawer/post-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthUrlPipe } from '../../../shared/pipes/auth-url.pipe';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * Dedicated Posts Management page displaying timeline post history, search filtering,
 * bulk deletion from X, manual timeline synchronization, and manual reply execution.
 */
@Component({
  selector: 'app-posts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RightDrawerComponent,
    PostDrawerComponent,
    LightboxComponent,
    PaginationComponent,
    TzDatePipe,
    TranslatePipe,
    AuthUrlPipe,
  ],
  templateUrl: './posts-page.component.html',
  styleUrls: ['./posts-page.component.css'],
})
export class PostsPageComponent implements OnInit {
  translationService = inject(TranslationService);
  toastService = inject(ToastService);

  // Drawer State
  readonly isDrawerOpen = signal<boolean>(false);
  readonly drawerTitle = signal<string>('Post Details');
  readonly drawerIcon = signal<string>('article');
  readonly selectedItemId = signal<string | null>(null);

  // Lightbox State
  readonly isLightboxOpen = signal<boolean>(false);
  readonly lightboxImageUrl = signal<string>('');

  // Timeline State
  selectAll = false;
  selectedRows = new Set<string>();
  readonly timelinePosts = signal<PostLeaderboard[]>([]);
  readonly filteredTimelinePosts = signal<PostLeaderboard[]>([]);
  searchQuery = '';
  timelinePage = 1;
  timelineTotalPages = 1;
  timelineTotalItems = 0;
  timelineItemsPerPage = 10;
  isLoadingTimeline = false;

  // Timeline Sort State
  timelineSortBy: 'time' | 'impressions' = 'time';
  timelineSortOrder: 'asc' | 'desc' = 'desc';

  // Action Button States
  readonly isDeleting = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);
  readonly isReplying = signal<boolean>(false);

  private readonly dashboardRepo = inject(DASHBOARD_REPOSITORY);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.loadTimeline();

    this.route.queryParamMap.subscribe((params) => {
      const postId = params.get('postId');
      if (postId) {
        this.openPostDrawer(postId);
      }
    });
  }

  /**
   * Loads paginated timeline history from the BFF backend.
   *
   * @param page - Target 1-based page index.
   */
  loadTimeline(page = 1): void {
    if (this.isLoadingTimeline) return;

    this.isLoadingTimeline = true;
    this.timelinePage = page;
    const backendSortBy = this.timelineSortBy === 'time' ? 'created_at' : 'impressions';

    this.dashboardRepo
      .getTimelineHistory(this.timelinePage, this.timelineItemsPerPage, backendSortBy, this.timelineSortOrder)
      .subscribe({
        next: (response) => {
          const posts = response.data;
          const meta = response.meta;

          this.timelineTotalPages = meta.totalPages;
          this.timelineTotalItems = meta.totalItems;

          const mapped = posts.map((p) => ({
            id: p.id,
            time: p.time,
            snippet: p.snippet ?? '',
            text: p.snippet ?? '',
            impressions: p.impressions,
            status: p.status ?? 'SUCCESS',
            hasMedia: p.hasMedia,
            mediaUrls: p.mediaUrls ?? [],
          }));

          this.timelinePosts.set(mapped);
          this.applyTimelineFilter();
          this.isLoadingTimeline = false;
        },
        error: () => {
          this.isLoadingTimeline = false;
          this.toastService.show('Failed to load timeline', 'error');
        },
      });
  }

  /**
   * Toggles timeline sorting between time and impressions.
   *
   * @param column - Column identifier to sort by.
   */
  toggleTimelineSort(column: 'time' | 'impressions'): void {
    if (this.timelineSortBy === column) {
      this.timelineSortOrder = this.timelineSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.timelineSortBy = column;
      this.timelineSortOrder = 'desc';
    }
    this.loadTimeline(1);
  }

  /**
   * Filters loaded timeline posts by the current search query.
   */
  applyTimelineFilter(): void {
    if (!this.searchQuery) {
      this.filteredTimelinePosts.set([...this.timelinePosts()]);
    } else {
      const q = this.searchQuery.toLowerCase();
      this.filteredTimelinePosts.set(
        this.timelinePosts().filter((p) => p.text?.toLowerCase().includes(q))
      );
    }
  }

  /**
   * Triggers manual timeline post synchronization via the BFF endpoint and reloads the table.
   */
  syncPosts(): void {
    if (this.isSyncing()) return;

    this.isSyncing.set(true);
    this.dashboardRepo.syncPosts().subscribe({
      next: () => {
        this.isSyncing.set(false);
        this.toastService.show(this.translationService.t('toast.sync_posts_success'), 'success');
        this.loadTimeline(this.timelinePage);
      },
      error: () => {
        this.isSyncing.set(false);
        this.toastService.show(this.translationService.t('toast.sync_posts_failed'), 'error');
      },
    });
  }

  /**
   * Triggers manual mentions polling and reply execution via the BFF endpoint.
   */
  triggerReply(): void {
    if (this.isReplying()) return;

    this.isReplying.set(true);
    this.dashboardRepo.triggerReply().subscribe({
      next: () => {
        this.isReplying.set(false);
        this.toastService.show(this.translationService.t('toast.trigger_reply_success'), 'success');
      },
      error: () => {
        this.isReplying.set(false);
        this.toastService.show(this.translationService.t('toast.trigger_reply_failed'), 'error');
      },
    });
  }

  /**
   * Appends thumbnail size query parameter for internal BFF media proxy URLs.
   *
   * @param url - Raw media URL.
   * @returns Thumbnail URL string.
   */
  getThumbnailUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('/api/v1/')) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}size=thumbnail`;
    }
    return url;
  }

  /**
   * Opens the full-size image lightbox modal.
   *
   * @param imageUrl - Target image URL.
   */
  openLightbox(imageUrl = ''): void {
    const fullUrl = imageUrl
      ? imageUrl.replace(/([?&])size=thumbnail(&|$)/, '$1').replace(/[?&]$/, '')
      : '';
    this.lightboxImageUrl.set(fullUrl || imageUrl);
    this.isLightboxOpen.set(true);
  }

  /**
   * Opens the Post Details right drawer for the specified post ID.
   *
   * @param id - Post identifier.
   */
  openPostDrawer(id: string): void {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.selectedItemId.set(id);
    this.drawerTitle.set('Post Details');
    this.drawerIcon.set('article');
    this.isDrawerOpen.set(true);
  }

  /**
   * Toggles selection of all visible timeline rows.
   */
  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.timelinePosts().forEach((p) => this.selectedRows.add(p.id));
    } else {
      this.selectedRows.clear();
    }
  }

  /**
   * Toggles selection state of a single timeline row.
   *
   * @param id - Post identifier.
   * @param event - DOM change event.
   */
  toggleRowSelection(id: string, event: Event): void {
    event.stopPropagation();
    if (this.selectedRows.has(id)) {
      this.selectedRows.delete(id);
      this.selectAll = false;
    } else {
      this.selectedRows.add(id);
      if (this.selectedRows.size === this.timelinePosts().length) {
        this.selectAll = true;
      }
    }
  }

  /**
   * Deletes all currently selected posts from X and Firestore.
   */
  async executeBulkDelete(): Promise<void> {
    if (this.selectedRows.size === 0) return;
    this.isDeleting.set(true);

    const ids = Array.from(this.selectedRows);
    this.dashboardRepo.deletePosts(ids).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted ${ids.length} posts`, 'success');
        this.isDeleting.set(false);
        this.selectedRows.clear();
        this.selectAll = false;
        this.loadTimeline(1);
      },
      error: () => {
        this.toastService.show('Failed to delete posts', 'error');
        this.isDeleting.set(false);
      },
    });
  }

  /**
   * Callback invoked when a post is deleted from within the Post Details drawer.
   */
  onPostDeleted(_postId: string): void {
    this.isDrawerOpen.set(false);
    this.loadTimeline(1);
  }
}
