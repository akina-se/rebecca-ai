import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DASHBOARD_REPOSITORY } from '../../../core/ports/dashboard.repository';
import { KpiMetrics, PostLeaderboard, UserLeaderboard, SystemAlert } from '@rebecca/types';
import { ToastService } from '../../../shared/services/toast.service';
import { DropdownComponent } from '../../../shared/components/molecules/dropdown/dropdown.component';
import { DatePickerPopoverComponent } from '../../../shared/components/molecules/date-picker-popover/date-picker-popover.component';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { PostDrawerComponent } from '../../../shared/components/organisms/post-drawer/post-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { RankingModalComponent } from '../../../shared/components/organisms/ranking-modal/ranking-modal.component';
import { KpiCardComponent } from '../../../shared/components/molecules/kpi-card/kpi-card.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DropdownComponent, DatePickerPopoverComponent, RightDrawerComponent, PostDrawerComponent, UserDrawerComponent, LightboxComponent, RankingModalComponent, KpiCardComponent, TzDatePipe, TranslatePipe],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {
  translationService = inject(TranslationService);
  readonly kpiMetrics = signal<KpiMetrics | undefined>(undefined);
  readonly topPosts = signal<PostLeaderboard[]>([]);
  readonly topUsers = signal<UserLeaderboard[]>([]);
  readonly systemAlerts = signal<SystemAlert[]>([]);

  toastService = inject(ToastService);

  topPostsMode: 'monthly' | 'yearly' | 'all-time' = 'yearly';
  topPostsDate = '2026';

  topUsersMode: 'monthly' | 'yearly' | 'all-time' = 'yearly';
  topUsersDate = '2026';

  // Modal State
  readonly isRankingModalOpen = signal<boolean>(false);
  readonly rankingModalTitle = signal<string>('');
  readonly rankingModalColLabel = signal<string>('');
  readonly rankingModalColMetric = signal<string>('');
  readonly rankingModalType = signal<'post' | 'user'>('post');

  // Drawer State
  readonly isDrawerOpen = signal<boolean>(false);
  readonly drawerType = signal<'post' | 'user' | null>(null);
  readonly drawerTitle = signal<string>('');
  readonly drawerIcon = signal<string>('');
  readonly selectedItemId = signal<string | null>(null);

  // Lightbox State
  readonly isLightboxOpen = signal<boolean>(false);
  readonly lightboxImageUrl = signal<string>('');

  private readonly dashboardRepo = inject(DASHBOARD_REPOSITORY);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.dashboardRepo.getKpiMetrics('monthly').subscribe(metrics => {
      this.kpiMetrics.set(metrics);
    });
    this.loadTopPosts();
    this.loadTopUsers();
    this.dashboardRepo.getAlerts().subscribe(alerts => {
      this.systemAlerts.set(alerts);
    });

    this.route.queryParamMap.subscribe(params => {
      const postId = params.get('postId');
      const userId = params.get('userId');
      if (postId) {
        this.openPostDrawer(postId);
      } else if (userId) {
        this.openUserDrawer(userId);
      }
    });
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

  loadTopPosts() {
    const isoDate = this.getIsoDate(this.topPostsDate);
    this.dashboardRepo.getTopPosts(this.topPostsMode, isoDate).subscribe(response => {
      this.topPosts.set(response.data);
      if (this.isRankingModalOpen() && this.rankingModalType() === 'post') {
        this.openRankingModal('posts');
      }
    });
  }

  loadTopUsers() {
    const isoDate = this.getIsoDate(this.topUsersDate);
    this.dashboardRepo.getTopUsers(this.topUsersMode, isoDate).subscribe(response => {
      this.topUsers.set(response.data);
      if (this.isRankingModalOpen() && this.rankingModalType() === 'user') {
        this.openRankingModal('users');
      }
    });
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

  get kpiFilterOptions(): string[] {
    return [
      this.translationService.t('dashboard.filter_7d'),
      this.translationService.t('dashboard.filter_30d'),
      this.translationService.t('dashboard.filter_ytd')
    ];
  }

  setKpiFilter(filter: string) {
    let mode = 'monthly';
    if (filter === 'Last 7 Days' || filter === this.translationService.t('dashboard.filter_7d')) mode = 'weekly';
    else if (filter === 'Last 30 Days' || filter === this.translationService.t('dashboard.filter_30d')) mode = 'monthly';
    else if (filter === 'Year to Date' || filter === this.translationService.t('dashboard.filter_ytd')) mode = 'yearly';
    
    this.dashboardRepo.getKpiMetrics(mode).subscribe(metrics => this.kpiMetrics.set(metrics));
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
    // If imageUrl is a thumbnail URL (e.g. contains size=thumbnail), strip size parameter to load full-resolution image
    const fullUrl = imageUrl ? imageUrl.replace(/([?&])size=thumbnail(&|$)/, '$1').replace(/[?&]$/, '') : '';
    this.lightboxImageUrl.set(fullUrl || imageUrl);
    this.isLightboxOpen.set(true);
  }

  private getCurrentMonthStr(): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const now = new Date();
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }

  private getCurrentYearStr(): string {
    return String(new Date().getFullYear());
  }

  setMode(target: 'posts' | 'users', mode: 'monthly' | 'yearly' | 'all-time') {
    if (target === 'posts') {
      this.topPostsMode = mode;
      if (mode === 'monthly') this.topPostsDate = this.getCurrentMonthStr();
      if (mode === 'yearly') this.topPostsDate = this.getCurrentYearStr();
      if (mode === 'all-time') this.topPostsDate = 'All-Time';
      this.loadTopPosts();
    } else {
      this.topUsersMode = mode;
      if (mode === 'monthly') this.topUsersDate = this.getCurrentMonthStr();
      if (mode === 'yearly') this.topUsersDate = this.getCurrentYearStr();
      if (mode === 'all-time') this.topUsersDate = 'All-Time';
      this.loadTopUsers();
    }
  }

  shiftDate(target: 'posts' | 'users', direction: -1 | 1) {
    const isPosts = target === 'posts';
    const mode = isPosts ? this.topPostsMode : this.topUsersMode;
    let currentDate = isPosts ? this.topPostsDate : this.topUsersDate;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (mode === 'monthly') {
      const parts = currentDate.split(' ');
      let mIdx = monthNames.indexOf(parts[0]);
      let year = parseInt(parts[1], 10) || currentYear;
      if (mIdx === -1) {
        mIdx = currentMonth;
        year = currentYear;
      }

      mIdx += direction;
      if (mIdx > 11) {
        mIdx = 0;
        year += 1;
      } else if (mIdx < 0) {
        mIdx = 11;
        year -= 1;
      }

      // Check bounds: March 2006 to current month/year
      if (year < 2006 || (year === 2006 && mIdx < 2)) {
        year = 2006;
        mIdx = 2; // March 2006
      } else if (year > currentYear || (year === currentYear && mIdx > currentMonth)) {
        year = currentYear;
        mIdx = currentMonth;
      }

      currentDate = `${monthNames[mIdx]} ${year}`;
    } else if (mode === 'yearly') {
      let year = parseInt(currentDate, 10) || currentYear;
      year += direction;
      if (year < 2006) year = 2006;
      if (year > currentYear) year = currentYear;
      currentDate = String(year);
    }
    
    if (isPosts) {
      this.topPostsDate = currentDate;
      this.loadTopPosts();
    } else {
      this.topUsersDate = currentDate;
      this.loadTopUsers();
    }
  }

  canShiftDate(target: 'posts' | 'users', direction: -1 | 1): boolean {
    const isPosts = target === 'posts';
    const mode = isPosts ? this.topPostsMode : this.topUsersMode;
    const currentDate = isPosts ? this.topPostsDate : this.topUsersDate;
    if (mode === 'all-time') return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (mode === 'monthly') {
      const parts = currentDate.split(' ');
      const mIdx = monthNames.indexOf(parts[0]);
      const year = parseInt(parts[1], 10) || currentYear;
      if (mIdx === -1) return false;

      if (direction === 1) {
        return !(year > currentYear || (year === currentYear && mIdx >= currentMonth));
      } else {
        return !(year < 2006 || (year === 2006 && mIdx <= 2));
      }
    }

    if (mode === 'yearly') {
      const year = parseInt(currentDate, 10) || currentYear;
      if (direction === 1) {
        return year < currentYear;
      } else {
        return year > 2006;
      }
    }

    return false;
  }

  readonly rankingModalEntries = signal<{ id: string; rank: number; label: string; value: number | string; badge?: string }[]>([]);
  readonly rankingModalCurrentPage = signal<number>(1);
  readonly rankingModalTotalPages = signal<number>(1);
  readonly rankingModalTotalItems = signal<number>(0);

  openRankingModal(type: 'posts' | 'users') {
    this.rankingModalType.set(type === 'posts' ? 'post' : 'user');
    this.rankingModalCurrentPage.set(1);
    this.loadRankingModalData(1);
    this.isRankingModalOpen.set(true);
  }

  loadRankingModalData(page: number) {
    this.rankingModalCurrentPage.set(page);
    if (this.rankingModalType() === 'post') {
      this.rankingModalTitle.set('Top Posts by Impressions');
      this.rankingModalColLabel.set('Post');
      this.rankingModalColMetric.set('Impressions');
      const isoDate = this.getIsoDate(this.topPostsDate);
      this.dashboardRepo.getTopPosts(this.topPostsMode, isoDate, page, 10).subscribe(res => {
        this.rankingModalTotalItems.set(res.meta?.totalItems || res.data.length);
        this.rankingModalTotalPages.set(res.meta?.totalPages || 1);
        this.rankingModalEntries.set(res.data.map((p, i) => ({
          id: p.id,
          rank: (page - 1) * 10 + i + 1,
          label: p.snippet,
          value: p.impressions,
          badge: (page === 1 && i < 3) ? ['1st', '2nd', '3rd'][i] : undefined,
        })));
      });
    } else {
      this.rankingModalTitle.set('Top Engaged Users');
      this.rankingModalColLabel.set('User');
      this.rankingModalColMetric.set('Interactions');
      const isoDate = this.getIsoDate(this.topUsersDate);
      this.dashboardRepo.getTopUsers(this.topUsersMode, isoDate, page, 10).subscribe(res => {
        this.rankingModalTotalItems.set(res.meta?.totalItems || res.data.length);
        this.rankingModalTotalPages.set(res.meta?.totalPages || 1);
        this.rankingModalEntries.set(res.data.map((u, i) => ({
          id: u.id,
          rank: (page - 1) * 10 + i + 1,
          label: u.name ? `${u.name}${u.username ? ` (@${u.username})` : ''}` : (u.username ? `@${u.username}` : u.id),
          value: u.interactions,
          badge: (page === 1 && i < 3) ? ['1st', '2nd', '3rd'][i] : undefined,
        })));
      });
    }
  }

  onRankingPageChange(page: number) {
    this.loadRankingModalData(page);
  }

  openPostDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.drawerType.set('post');
    this.selectedItemId.set(id);
    this.drawerTitle.set('Post Details');
    this.drawerIcon.set('article');
    this.isDrawerOpen.set(true);
  }

  openUserDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.drawerType.set('user');
    this.selectedItemId.set(id);
    this.drawerTitle.set('User Profile');
    this.drawerIcon.set('person');
    this.isDrawerOpen.set(true);
  }

  onPostDeleted(_postId: string): void {
    this.isDrawerOpen.set(false);
    this.loadTopPosts();
  }

  mockAlert(msg: string) {
    this.toastService.show(msg, 'info');
  }
}
