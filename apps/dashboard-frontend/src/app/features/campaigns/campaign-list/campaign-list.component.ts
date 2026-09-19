import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CampaignDocWithId, CampaignStatus, PaginatedResponse } from '@rebecca/types';
import { CAMPAIGNS_REPOSITORY } from '../../../core/ports/campaigns.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * CampaignsListComponent
 *
 * Smart page component displaying paginated list of narrative campaigns,
 * supporting emergency kill-switch controls, clone iterations, and filtering.
 */
@Component({
  selector: 'app-campaign-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, TranslatePipe],
  templateUrl: './campaign-list.component.html',
  styleUrls: ['./campaign-list.component.css'],
})
export class CampaignListComponent implements OnInit {
  private readonly repo = inject(CAMPAIGNS_REPOSITORY);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly translationService = inject(TranslationService);

  readonly campaigns = signal<CampaignDocWithId[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly totalItems = signal<number>(0);
  readonly totalPages = signal<number>(1);
  currentPage = 1;
  pageSize = 10;
  selectedFilter = 'all';

  // Emergency Pause banner detection
  readonly pausedActiveCampaign = computed(() => {
    return this.campaigns().find((c) => c.status === 'active' && c.isPaused);
  });

  // Clone Modal state
  readonly isCloneModalOpen = signal<boolean>(false);
  readonly targetCloneCampaign = signal<CampaignDocWithId | null>(null);
  cloneStartDate = '';
  cloneEndDate = '';
  readonly isCloning = signal<boolean>(false);

  // Delete Modal state
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly targetDeleteCampaign = signal<CampaignDocWithId | null>(null);
  readonly isDeleting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCampaigns(1);
  }

  /**
   * Loads paginated campaigns according to active page and status filter.
   */
  loadCampaigns(page = 1): void {
    this.isLoading.set(true);
    this.currentPage = page;

    this.repo
      .getAll({
        page: this.currentPage,
        limit: this.pageSize,
        status: this.selectedFilter !== 'all' ? this.selectedFilter : undefined,
      })
      .subscribe({
        next: (res: PaginatedResponse<CampaignDocWithId>) => {
          this.campaigns.set(res.data);
          this.totalItems.set(res.meta.totalItems);
          this.totalPages.set(res.meta.totalPages);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[CampaignList] Failed to load campaigns:', err);
          this.toastService.show('Failed to load campaigns', 'error');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Sets active status filter and reloads list from page 1.
   */
  setFilter(filter: string): void {
    this.selectedFilter = filter;
    this.loadCampaigns(1);
  }

  /**
   * Handles page change from pagination component.
   */
  onPageChange(page: number): void {
    this.loadCampaigns(page);
  }

  /**
   * Navigates to campaign creation page.
   */
  openNewCampaign(): void {
    this.router.navigate(['/campaigns/new']);
  }

  /**
   * Navigates to campaign edit page.
   */
  editCampaign(id: string): void {
    this.router.navigate(['/campaigns', id]);
  }

  /**
   * Toggles emergency pause / resume for a campaign.
   */
  togglePause(campaign: CampaignDocWithId): void {
    const isPaused = campaign.isPaused;
    const action$ = isPaused ? this.repo.resume(campaign.id) : this.repo.pause(campaign.id);

    action$.subscribe({
      next: (updated) => {
        this.campaigns.update((list) =>
          list.map((c) => (c.id === updated.id ? { ...c, isPaused: updated.isPaused } : c)),
        );
        const msgKey = isPaused ? 'campaign.resumed_success' : 'campaign.paused_success';
        this.toastService.show(this.translationService.translate(msgKey), 'info');
      },
      error: (err) => {
        console.error('[CampaignList] Toggle pause failed:', err);
        this.toastService.show('Failed to toggle pause status', 'error');
      },
    });
  }

  /**
   * Opens clone modal with prefilled next year dates.
   */
  openCloneModal(campaign: CampaignDocWithId): void {
    this.targetCloneCampaign.set(campaign);
    // Suggest default next year dates
    const startYear = parseInt(campaign.startDate.slice(0, 4), 10) + 1;
    const endYear = parseInt(campaign.endDate.slice(0, 4), 10) + 1;
    this.cloneStartDate = `${startYear}${campaign.startDate.slice(4)}`;
    this.cloneEndDate = `${endYear}${campaign.endDate.slice(4)}`;
    this.isCloneModalOpen.set(true);
  }

  /**
   * Closes clone modal.
   */
  closeCloneModal(): void {
    this.isCloneModalOpen.set(false);
    this.targetCloneCampaign.set(null);
  }

  /**
   * Submits clone request and navigates to editor for newly created campaign.
   */
  submitClone(): void {
    const target = this.targetCloneCampaign();
    if (!target) return;

    this.isCloning.set(true);
    this.repo.clone(target.id, this.cloneStartDate, this.cloneEndDate).subscribe({
      next: (cloned) => {
        this.isCloning.set(false);
        this.closeCloneModal();
        this.toastService.show('Campaign cloned successfully', 'success');
        this.router.navigate(['/campaigns', cloned.id]);
      },
      error: (err) => {
        console.error('[CampaignList] Clone failed:', err);
        const msg = typeof err.error?.error === 'string' ? err.error.error : 'Failed to clone campaign';
        this.toastService.show(msg, 'error');
        this.isCloning.set(false);
      },
    });
  }

  /**
   * Opens delete confirmation modal.
   */
  openDeleteModal(campaign: CampaignDocWithId): void {
    this.targetDeleteCampaign.set(campaign);
    this.isDeleteModalOpen.set(true);
  }

  /**
   * Closes delete modal.
   */
  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.targetDeleteCampaign.set(null);
  }

  /**
   * Confirms and deletes targeted campaign.
   */
  confirmDelete(): void {
    const target = this.targetDeleteCampaign();
    if (!target) return;

    this.isDeleting.set(true);
    this.repo.delete(target.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.toastService.show('Campaign deleted successfully', 'success');
        this.loadCampaigns(this.currentPage);
      },
      error: (err) => {
        console.error('[CampaignList] Delete failed:', err);
        this.toastService.show('Failed to delete campaign', 'error');
        this.isDeleting.set(false);
      },
    });
  }

  /**
   * Computes completed slots percentage for progress bar.
   */
  getProgressPercentage(campaign: CampaignDocWithId): number {
    if (campaign.totalSlotsCount <= 0) return 0;
    return Math.min(100, Math.round((campaign.completedSlotsCount / campaign.totalSlotsCount) * 100));
  }

  /**
   * Resolves badge CSS class for a given campaign status.
   */
  getStatusBadgeClass(status: CampaignStatus): string {
    switch (status) {
      case 'active':
        return 'badge-active';
      case 'scheduled':
        return 'badge-scheduled';
      case 'completed':
        return 'badge-completed';
      case 'archived':
        return 'badge-cancelled';
      case 'draft':
      default:
        return 'badge-draft';
    }
  }
}
