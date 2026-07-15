import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard } from '../../../core/models/dashboard.model';
import { ToastService } from '../../../shared/services/toast.service';
import { DropdownComponent } from '../../../shared/components/molecules/dropdown/dropdown.component';
import { DatePickerPopoverComponent } from '../../../shared/components/molecules/date-picker-popover/date-picker-popover.component';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { PostDrawerComponent } from '../../../shared/components/organisms/post-drawer/post-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { RankingModalComponent } from '../../../shared/components/organisms/ranking-modal/ranking-modal.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DropdownComponent, DatePickerPopoverComponent, RightDrawerComponent, PostDrawerComponent, UserDrawerComponent, LightboxComponent, RankingModalComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {
  kpiMetrics?: KpiMetrics;
  topPosts: PostLeaderboard[] = [];
  topUsers: UserLeaderboard[] = [];

  toastService = inject(ToastService);

  topPostsMode: 'monthly' | 'yearly' | 'all-time' = 'monthly';
  topPostsDate = 'July 2026';

  topUsersMode: 'monthly' | 'yearly' | 'all-time' = 'yearly';
  topUsersDate = '2026';

  // Modal State
  isRankingModalOpen = false;
  rankingModalTitle = '';
  rankingModalLabel = '';

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
  timelinePosts = [
    { id: '1', time: '2026-07-11 12:00', text: '今日は暑いね！水分補給しっかりしてね🥤', impressions: '3,402', status: 'Success', hasMedia: true },
    { id: '2', time: '2026-07-10 18:00', text: '水星の魔女、最新話見た！？展開が熱すぎる…', impressions: '5,120', status: 'Success', hasMedia: true },
  ];

  constructor(@Inject(DASHBOARD_REPOSITORY) private dashboardRepo: DashboardRepository) {}

  ngOnInit(): void {
    this.dashboardRepo.getKpiMetrics('monthly').subscribe(metrics => this.kpiMetrics = metrics);
    this.dashboardRepo.getTopPosts('monthly').subscribe(posts => this.topPosts = posts);
    this.dashboardRepo.getTopUsers('monthly').subscribe(users => this.topUsers = users);
  }

  openLightbox(imageUrl: string = '') {
    this.lightboxImageUrl = imageUrl;
    this.isLightboxOpen = true;
  }

  setMode(target: 'posts' | 'users', mode: 'monthly' | 'yearly' | 'all-time') {
    if (target === 'posts') {
      this.topPostsMode = mode;
      if (mode === 'monthly') this.topPostsDate = 'July 2026';
      if (mode === 'yearly') this.topPostsDate = '2026';
      if (mode === 'all-time') this.topPostsDate = 'All-Time';
    } else {
      this.topUsersMode = mode;
      if (mode === 'monthly') this.topUsersDate = 'July 2026';
      if (mode === 'yearly') this.topUsersDate = '2026';
      if (mode === 'all-time') this.topUsersDate = 'All-Time';
    }
  }

  openRankingModal(type: 'posts' | 'users') {
    if (type === 'posts') {
      this.rankingModalTitle = 'Top Posts by Impressions';
      this.rankingModalLabel = 'Post';
    } else {
      this.rankingModalTitle = 'Top Engaged Users';
      this.rankingModalLabel = 'User ID';
    }
    this.isRankingModalOpen = true;
  }

  openPostDrawer(id: string) {
    this.drawerType = 'post';
    this.selectedItemId = id;
    this.drawerTitle = 'Post Details';
    this.drawerIcon = 'article';
    this.isDrawerOpen = true;
  }

  openUserDrawer(id: string) {
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

  executeBulkDelete() {
    this.toastService.show(`Executing batch delete for ${this.selectedRows.size} posts...`, 'info');
    setTimeout(() => {
      this.toastService.show('Posts deleted successfully.', 'success');
      this.selectedRows.clear();
      this.selectAll = false;
    }, 1500);
  }

  mockAlert(msg: string) {
    this.toastService.show(msg, 'info');
  }
}
