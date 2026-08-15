import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert } from '@rebecca/types';
import { ToastService } from '../../../shared/services/toast.service';
import { DropdownComponent } from '../../../shared/components/molecules/dropdown/dropdown.component';
import { DatePickerPopoverComponent } from '../../../shared/components/molecules/date-picker-popover/date-picker-popover.component';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { PostDrawerComponent } from '../../../shared/components/organisms/post-drawer/post-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { RankingModalComponent } from '../../../shared/components/organisms/ranking-modal/ranking-modal.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DropdownComponent, DatePickerPopoverComponent, RightDrawerComponent, PostDrawerComponent, UserDrawerComponent, LightboxComponent, RankingModalComponent, PaginationComponent, TzDatePipe],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {
  kpiMetrics?: KpiMetrics;
  topPosts: PostLeaderboard[] = [];
  topUsers: UserLeaderboard[] = [];
  systemAlerts: SystemAlert[] = [];

  toastService = inject(ToastService);

  topPostsMode: 'monthly' | 'yearly' | 'all-time' = 'monthly';
  topPostsDate = 'July 2026';

  topUsersMode: 'monthly' | 'yearly' | 'all-time' = 'yearly';
  topUsersDate = '2026';

  // Modal State
  isRankingModalOpen = false;
  rankingModalTitle = '';
  rankingModalColLabel = '';
  rankingModalColMetric = '';
  rankingModalType: 'post' | 'user' = 'post';

  // Drawer State
  isDrawerOpen = false;
  drawerType: 'post' | 'user' | null = null;
  drawerTitle = '';
  drawerIcon = '';
  selectedItemId: string | null = null;

  // Lightbox State
  isLightboxOpen = false;
  lightboxImageUrl = '';

  // Timeline State
  selectAll = false;
  selectedRows = new Set<string>();
  timelinePosts: any[] = [];
  filteredTimelinePosts: any[] = [];
  searchQuery = '';
  timelinePage = 1;
  timelineTotalPages = 1;
  timelineTotalItems = 0;
  timelineItemsPerPage = 10;
  isLoadingTimeline = false;

  constructor(@Inject(DASHBOARD_REPOSITORY) private dashboardRepo: DashboardRepository) {}

  ngOnInit(): void {
    this.dashboardRepo.getKpiMetrics('monthly').subscribe(metrics => this.kpiMetrics = metrics);
    this.loadTopPosts();
    this.loadTopUsers();
    this.loadTimeline();
    this.dashboardRepo.getAlerts().subscribe(alerts => this.systemAlerts = alerts);
  }

  // Timeline Sort State
  timelineSortBy: 'time' | 'impressions' = 'time';
  timelineSortOrder: 'asc' | 'desc' = 'desc';

  loadTimeline(page: number = 1) {
    if (this.isLoadingTimeline) return;

    this.isLoadingTimeline = true;
    this.timelinePage = page;
    const backendSortBy = this.timelineSortBy === 'time' ? 'created_at' : 'impressions';
    
    this.dashboardRepo.getTimelineHistory(this.timelinePage, this.timelineItemsPerPage, backendSortBy, this.timelineSortOrder).subscribe({
      next: (response) => {
        const posts = response.data;
        const meta = response.meta;
        
        this.timelineTotalPages = meta.totalPages;
        this.timelineTotalItems = meta.totalItems;

        const mapped = posts.map(p => ({
          id: p.id,
          time: p.time,
          text: p.snippet,
          impressions: p.impressions,
          status: p.status || 'SUCCESS',
          hasMedia: p.hasMedia,
          mediaUrls: p.mediaUrls || []
        }));
        
        this.timelinePosts = mapped;
        this.applyTimelineFilter();
        this.isLoadingTimeline = false;
      },
      error: () => {
        this.isLoadingTimeline = false;
        this.toastService.show('Failed to load timeline', 'error');
      }
    });
  }

  toggleTimelineSort(column: 'time' | 'impressions') {
    if (this.timelineSortBy === column) {
      this.timelineSortOrder = this.timelineSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.timelineSortBy = column;
      this.timelineSortOrder = 'desc';
    }
    this.loadTimeline(1);
  }

  onDatePicked(target: 'posts' | 'users', date: string) {
    if (target === 'posts') {
      this.topPostsDate = date;
      this.loadTopPosts();
    } else {
      this.topUsersDate = date;
      this.loadTopUsers();
    }
  }

  applyTimelineFilter() {
    if (!this.searchQuery) {
      this.filteredTimelinePosts = [...this.timelinePosts];
    } else {
      const q = this.searchQuery.toLowerCase();
      this.filteredTimelinePosts = this.timelinePosts.filter(p => p.text?.toLowerCase().includes(q));
    }
  }

  loadTopPosts() {
    const isoDate = this.getIsoDate(this.topPostsDate);
    this.dashboardRepo.getTopPosts(this.topPostsMode, isoDate).subscribe(response => this.topPosts = response.data);
  }

  loadTopUsers() {
    const isoDate = this.getIsoDate(this.topUsersDate);
    this.dashboardRepo.getTopUsers(this.topUsersMode, isoDate).subscribe(response => this.topUsers = response.data);
  }

  getIsoDate(dateStr: string): string {
    const months: Record<string, string> = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    
    if (dateStr === 'All-Time') {
      return '';
    }
    
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      const monthName = parts[0];
      const year = parts[1];
      const monthNum = months[monthName];
      if (monthNum) {
        return `${year}-${monthNum}`;
      }
    }
    
    return dateStr; // just year or as-is
  }

  setKpiFilter(filter: string) {
    let mode = 'monthly';
    if (filter === 'Last 7 Days') mode = 'weekly';
    else if (filter === 'Last 30 Days') mode = 'monthly';
    else if (filter === 'Year to Date') mode = 'yearly';
    
    this.dashboardRepo.getKpiMetrics(mode).subscribe(metrics => this.kpiMetrics = metrics);
  }

  getSparklinePoints(history: number[] = [], height = 20, width = 100): string {
    if (!history || history.length === 0) return `0,${height} ${width},${height}`;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const step = width / (history.length - 1 || 1);
    const points = history.map((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * (height - 2) - 1; // 1px padding top/bottom
      return `${x},${y}`;
    });
    return points.join(' ');
  }
  
  getSparklinePolygon(history: number[] = [], height = 20, width = 100): string {
    if (!history || history.length === 0) return `0,${height} ${width},${height}`;
    const polyline = this.getSparklinePoints(history, height, width);
    return `0,${height} ${polyline} ${width},${height}`;
  }

  openLightbox(imageUrl = '') {
    this.lightboxImageUrl = imageUrl;
    this.isLightboxOpen = true;
  }

  setMode(target: 'posts' | 'users', mode: 'monthly' | 'yearly' | 'all-time') {
    if (target === 'posts') {
      this.topPostsMode = mode;
      if (mode === 'monthly') this.topPostsDate = 'July 2026';
      if (mode === 'yearly') this.topPostsDate = '2026';
      if (mode === 'all-time') this.topPostsDate = 'All-Time';
      this.loadTopPosts();
    } else {
      this.topUsersMode = mode;
      if (mode === 'monthly') this.topUsersDate = 'July 2026';
      if (mode === 'yearly') this.topUsersDate = '2026';
      if (mode === 'all-time') this.topUsersDate = 'All-Time';
      this.loadTopUsers();
    }
  }

  shiftDate(target: 'posts' | 'users', direction: -1 | 1) {
    const isPosts = target === 'posts';
    const mode = isPosts ? this.topPostsMode : this.topUsersMode;
    let currentDate = isPosts ? this.topPostsDate : this.topUsersDate;
    
    if (mode === 'monthly') {
      const months = ['May 2026', 'June 2026', 'July 2026'];
      let idx = months.indexOf(currentDate);
      if (idx === -1) idx = 2;
      let newIdx = idx + direction;
      if (newIdx < 0) newIdx = 0;
      if (newIdx > 2) newIdx = 2;
      currentDate = months[newIdx];
    } else if (mode === 'yearly') {
      const years = ['2024', '2025', '2026'];
      let idx = years.indexOf(currentDate);
      if (idx === -1) idx = 2;
      let newIdx = idx + direction;
      if (newIdx < 0) newIdx = 0;
      if (newIdx > 2) newIdx = 2;
      currentDate = years[newIdx];
    }
    
    if (isPosts) {
      this.topPostsDate = currentDate;
      this.loadTopPosts();
    } else {
      this.topUsersDate = currentDate;
      this.loadTopUsers();
    }
  }

  rankingModalEntries: any[] = [];

  openRankingModal(type: 'posts' | 'users') {
    if (type === 'posts') {
      this.rankingModalTitle = 'Top Posts by Impressions';
      this.rankingModalColLabel = 'Post';
      this.rankingModalColMetric = 'Impressions';
      this.rankingModalType = 'post';
      this.rankingModalEntries = this.topPosts.map((p, i) => ({
        id: p.id,
        rank: i + 1,
        label: p.snippet,
        value: p.impressions,
        badge: i < 3 ? ['1st', '2nd', '3rd'][i] : undefined,
      }));
    } else {
      this.rankingModalTitle = 'Top Engaged Users';
      this.rankingModalColLabel = 'User ID';
      this.rankingModalColMetric = 'Interactions';
      this.rankingModalType = 'user';
      this.rankingModalEntries = this.topUsers.map((u, i) => ({
        id: (u as any).handle || u.userId,
        rank: i + 1,
        label: (u as any).handle || u.userId,
        value: u.interactions,
        badge: i < 3 ? ['1st', '2nd', '3rd'][i] : undefined,
      }));
    }
    this.isRankingModalOpen = true;
  }

  openPostDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.drawerType = 'post';
    this.selectedItemId = id;
    this.drawerTitle = 'Post Details';
    this.drawerIcon = 'article';
    this.isDrawerOpen = true;
  }

  openUserDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.drawerType = 'user';
    this.selectedItemId = id;
    this.drawerTitle = 'User Profile';
    this.drawerIcon = 'person';
    this.isDrawerOpen = true;
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.timelinePosts.forEach(p => this.selectedRows.add(p.id));
    } else {
      this.selectedRows.clear();
    }
  }

  toggleRowSelection(id: string, event: Event) {
    event.stopPropagation();
    if (this.selectedRows.has(id)) {
      this.selectedRows.delete(id);
      this.selectAll = false;
    } else {
      this.selectedRows.add(id);
      if (this.selectedRows.size === this.timelinePosts.length) {
        this.selectAll = true;
      }
    }
  }

  isDeleting = false;
  isArchiving = false;
  actionHelper = inject(ActionHelperService);

  async executeBulkDelete() {
    if (this.selectedRows.size === 0) return;
    this.isDeleting = true;
    
    const ids = Array.from(this.selectedRows);
    this.dashboardRepo.deletePosts(ids).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted ${ids.length} posts`, 'success');
        this.isDeleting = false;
        this.selectedRows.clear();
        this.selectAll = false;
        this.loadTimeline(1); // reload timeline
      },
      error: () => {
        this.toastService.show(`Failed to delete posts`, 'error');
        this.isDeleting = false;
      }
    });
  }

  async executeBulkArchive() {
    if (this.selectedRows.size === 0) return;
    this.isArchiving = true;
    await this.actionHelper.executeMockAction(`Successfully archived ${this.selectedRows.size} posts`);
    this.isArchiving = false;
    this.selectedRows.clear();
    this.selectAll = false;
  }

  mockAlert(msg: string) {
    this.toastService.show(msg, 'info');
  }
}
