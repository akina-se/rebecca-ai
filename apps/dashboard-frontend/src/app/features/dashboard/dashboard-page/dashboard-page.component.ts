import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  timelinePosts = [
    { id: '1', time: '2026-07-11 12:00', text: '今日は暑いね！水分補給しっかりしてね', impressions: '3,402', status: 'Success', hasMedia: true },
    { id: '2', time: '2026-07-10 18:00', text: '水星の魔女、最新話見た！？展開が熱すぎる…', impressions: '5,120', status: 'Success', hasMedia: true },
  ];

  constructor(@Inject(DASHBOARD_REPOSITORY) private dashboardRepo: DashboardRepository) {}

  ngOnInit(): void {
    this.dashboardRepo.getKpiMetrics('monthly').subscribe(metrics => this.kpiMetrics = metrics);
    this.loadTopPosts();
    this.loadTopUsers();
    this.dashboardRepo.getAlerts().subscribe(alerts => this.systemAlerts = alerts);
  }

  loadTopPosts() {
    const isoDate = this.getIsoDate(this.topPostsDate);
    this.dashboardRepo.getTopPosts(this.topPostsMode, isoDate).subscribe(posts => this.topPosts = posts);
  }

  loadTopUsers() {
    const isoDate = this.getIsoDate(this.topUsersDate);
    this.dashboardRepo.getTopUsers(this.topUsersMode, isoDate).subscribe(users => this.topUsers = users);
  }

  getIsoDate(dateStr: string): string {
    const months: { [key: string]: string } = {
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

  openRankingModal(type: 'posts' | 'users') {
    if (type === 'posts') {
      this.rankingModalTitle = 'Top Posts by Impressions';
      this.rankingModalColLabel = 'Post';
      this.rankingModalColMetric = 'Impressions';
      this.rankingModalType = 'post';
    } else {
      this.rankingModalTitle = 'Top Engaged Users';
      this.rankingModalColLabel = 'User ID';
      this.rankingModalColMetric = 'Interactions';
      this.rankingModalType = 'user';
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
    await this.actionHelper.executeMockAction(`Successfully deleted ${this.selectedRows.size} posts`);
    this.isDeleting = false;
    this.selectedRows.clear();
    this.selectAll = false;
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
