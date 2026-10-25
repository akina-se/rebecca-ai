import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupportTier,
  SupportTransactionStatus,
  CreditVisibility,
} from '@rebecca/types';
import { SUPPORTERS_REPOSITORY } from '../../../core/ports/supporters.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { CopilotContextService } from '../../../core/services/copilot-context.service';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';

@Component({
  selector: 'app-supporters-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, TzDatePipe, RightDrawerComponent, PaginationComponent, LightboxComponent],
  templateUrl: './supporters-page.component.html',
  styleUrls: ['./supporters-page.component.css'],
})
export class SupportersPageComponent implements OnInit {
  private readonly repo = inject(SUPPORTERS_REPOSITORY);
  private readonly toast = inject(ToastService);
  readonly translationService = inject(TranslationService);
  private readonly contextService = inject(CopilotContextService);

  readonly transactions = signal<SupportTransactionDoc[]>([]);
  readonly summary = signal({
    totalCount: 0,
    failedCount: 0,
    pendingCount: 0,
    completedCount: 0,
    totalAmount: 0,
  });
  readonly isLoading = signal<boolean>(false);
  readonly rewards = signal<RewardImageDoc[]>([]);
  readonly retryingId = signal<string | null>(null);

  // Pagination State
  currentPage = 1;
  pageSize = 30;
  readonly totalPages = signal<number>(1);
  readonly totalItems = signal<number>(0);

  // Filters
  selectedStatus: SupportTransactionStatus | 'all' = 'all';
  selectedTier: SupportTier | 'all' = 'all';
  searchQuery = '';

  // Detail Right Drawer State
  readonly isDrawerOpen = signal<boolean>(false);
  readonly selectedTx = signal<SupportTransactionDoc | null>(null);
  drawerSafeName = '';
  drawerTier: SupportTier = 'bronze';
  drawerCreditVisibility: CreditVisibility = 'show';
  drawerIsBanned = false;
  readonly isSavingDrawer = signal<boolean>(false);
  readonly copiedKey = signal<string | null>(null);

  // Edit Modal State (Kept for standalone edit)
  readonly isEditModalOpen = signal<boolean>(false);
  readonly editingTransaction = signal<SupportTransactionDoc | null>(null);
  editSafeName = '';
  editTier: SupportTier = 'bronze';
  editCreditVisibility: CreditVisibility = 'show';
  editIsBanned = false;
  readonly isSavingEdit = signal<boolean>(false);

  // Manual Resolve Modal State
  readonly isManualModalOpen = signal<boolean>(false);
  readonly manualTransaction = signal<SupportTransactionDoc | null>(null);
  manualTweetText = '';
  readonly isResolvingManual = signal<boolean>(false);

  // Manual Entry Ingestion Modal State
  readonly isManualEntryModalOpen = signal<boolean>(false);
  entrySessionId = '';
  entryRawName = '';
  entryAmount = 3000;
  entryCreditVisibility: CreditVisibility = 'show';
  readonly isSubmittingEntry = signal<boolean>(false);

  // Reward Manager Modal State
  readonly isRewardsModalOpen = signal<boolean>(false);
  newRewardTitle = '';
  selectedRewardFile: File | null = null;
  readonly isUploadingReward = signal<boolean>(false);

  // Fullscreen Illustration Lightbox State
  readonly isLightboxOpen = signal<boolean>(false);
  readonly lightboxImageUrl = signal<string>('');

  ngOnInit(): void {
    this.loadLedger();
    this.loadRewards();
  }

  loadLedger(page = 1): void {
    this.currentPage = page;
    this.isLoading.set(true);
    this.repo
      .getLedger({
        page: this.currentPage,
        limit: this.pageSize,
        status: this.selectedStatus,
        tier: this.selectedTier,
        search: this.searchQuery,
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.transactions);
          this.summary.set(res.summary);
          const meta = res.pagination || res.meta;
          const count = meta?.totalItems ?? res.summary?.totalCount ?? res.transactions.length;
          this.totalItems.set(count);
          this.totalPages.set(meta?.totalPages ?? Math.ceil(count / this.pageSize) ?? 1);
          this.isLoading.set(false);

          // Sync drawer if currently open
          const currentTx = this.selectedTx();
          if (currentTx) {
            const fresh = res.transactions.find((t) => t.id === currentTx.id);
            if (fresh) {
              this.selectedTx.set(fresh);
            }
          }
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_fetch_error'), 'error');
          this.isLoading.set(false);
        },
      });
  }

  onPageChange(page: number): void {
    this.loadLedger(page);
  }

  loadRewards(): void {
    this.repo.getRewards().subscribe({
      next: (res) => {
        this.rewards.set(res.rewards);
      },
      error: () => {
        // Quietly handle
      },
    });
  }

  onFilterChange(): void {
    this.loadLedger(1);
  }

  onSearch(): void {
    this.loadLedger(1);
  }

  filterByFailed(): void {
    this.selectedStatus = 'failed';
    this.loadLedger(1);
  }

  // Detail Drawer Actions
  openTransactionDrawer(tx: SupportTransactionDoc): void {
    this.selectedTx.set(tx);
    this.drawerSafeName = tx.safeName || tx.rawName;
    this.drawerTier = tx.tier;
    this.drawerCreditVisibility = tx.creditVisibility;
    this.drawerIsBanned = Boolean(tx.isBanned);
    this.isDrawerOpen.set(true);
    this.contextService.setFocusedEntity({
      type: 'supporter',
      id: tx.id,
      label: tx.safeName || tx.rawName,
      details: {
        amount: tx.amount,
        tier: tx.tier,
        status: tx.status,
        stripeSessionId: tx.stripeSessionId,
        stripePaymentIntentId: tx.stripePaymentIntentId,
        creditVisibility: tx.creditVisibility,
        isBanned: tx.isBanned,
        errorMessage: tx.errorMessage,
      },
    });
  }

  closeTransactionDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedTx.set(null);
    this.contextService.clearFocusedEntity();
  }

  saveDrawerSettings(): void {
    const tx = this.selectedTx();
    if (!tx || !this.drawerSafeName.trim()) return;

    this.isSavingDrawer.set(true);
    this.repo
      .updateTransaction(tx.id, {
        safeName: this.drawerSafeName.trim(),
        tier: this.drawerTier,
        creditVisibility: this.drawerCreditVisibility,
        isBanned: this.drawerIsBanned,
      })
      .subscribe({
        next: (updated) => {
          this.toast.show(this.translationService.t('supporters.toast_save_success'), 'success');
          this.isSavingDrawer.set(false);
          this.selectedTx.set(updated);
          this.loadLedger(this.currentPage);
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_save_error'), 'error');
          this.isSavingDrawer.set(false);
        },
      });
  }

  copyToClipboard(text: string, key: string): void {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).then(() => {
        this.copiedKey.set(key);
        this.toast.show(this.translationService.t('supporters.toast_copy_success'), 'info');
        setTimeout(() => this.copiedKey.set(null), 2000);
      });
    } catch {
      this.toast.show(text, 'info');
    }
  }

  retryFromDrawer(): void {
    const tx = this.selectedTx();
    if (tx) {
      this.retry(tx);
    }
  }

  openManualResolveFromDrawer(): void {
    const tx = this.selectedTx();
    if (tx) {
      this.openManualResolveModal(tx);
    }
  }

  // 1-Click Retry
  retry(tx: SupportTransactionDoc): void {
    if (this.retryingId()) return;
    this.retryingId.set(tx.id);

    this.repo.retryTransaction(tx.id).subscribe({
      next: () => {
        this.toast.show(`${this.translationService.t('supporters.toast_retry_scheduled')} (${tx.safeName})`, 'success');
        this.retryingId.set(null);
        this.loadLedger(this.currentPage);
      },
      error: (err) => {
        this.toast.show(`${this.translationService.t('supporters.toast_retry_failed')}: ${err?.error?.error || err.message}`, 'error');
        this.retryingId.set(null);
      },
    });
  }

  // Edit Modal Actions (Legacy / Standalone)
  openEditModal(tx: SupportTransactionDoc, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingTransaction.set(tx);
    this.editSafeName = tx.safeName;
    this.editTier = tx.tier;
    this.editCreditVisibility = tx.creditVisibility;
    this.editIsBanned = tx.isBanned;
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editingTransaction.set(null);
  }

  saveEdit(): void {
    const tx = this.editingTransaction();
    if (!tx || !this.editSafeName.trim()) return;

    this.isSavingEdit.set(true);
    this.repo
      .updateTransaction(tx.id, {
        safeName: this.editSafeName.trim(),
        tier: this.editTier,
        creditVisibility: this.editCreditVisibility,
        isBanned: this.editIsBanned,
      })
      .subscribe({
        next: () => {
          this.toast.show(this.translationService.t('supporters.toast_update_success'), 'success');
          this.isSavingEdit.set(false);
          this.closeEditModal();
          this.loadLedger(this.currentPage);
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_update_error'), 'error');
          this.isSavingEdit.set(false);
        },
      });
  }

  // Manual Resolve Modal Actions
  openManualResolveModal(tx: SupportTransactionDoc, event?: Event): void {
    if (event) event.stopPropagation();
    this.manualTransaction.set(tx);
    this.manualTweetText = tx.tweetText || `マスター ${tx.safeName}、${tx.itemLabel}差し入れありがとう！レベッカの演算パワー充填完了だよ♡\n\n👇公式ポータル・スペシャルサンクス\nhttps://rebecca-ai.net/supporters#plans\n#全肯定AIレベッカ`;
    this.isManualModalOpen.set(true);
  }

  closeManualResolveModal(): void {
    this.isManualModalOpen.set(false);
    this.manualTransaction.set(null);
  }

  saveManualResolve(): void {
    const tx = this.manualTransaction();
    if (!tx || !this.manualTweetText.trim()) return;

    this.isResolvingManual.set(true);
    this.repo
      .manualResolve(tx.id, {
        tweetText: this.manualTweetText.trim(),
      })
      .subscribe({
        next: () => {
          this.toast.show(this.translationService.t('supporters.toast_manual_post_success'), 'success');
          this.isResolvingManual.set(false);
          this.closeManualResolveModal();
          this.loadLedger(this.currentPage);
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_manual_post_error'), 'error');
          this.isResolvingManual.set(false);
        },
      });
  }

  // Quick Ban Toggle
  toggleBan(tx: SupportTransactionDoc, event?: Event): void {
    if (event) event.stopPropagation();
    const nextState = !tx.isBanned;
    this.repo
      .updateTransaction(tx.id, { isBanned: nextState })
      .subscribe({
        next: () => {
          this.toast.show(nextState ? this.translationService.t('supporters.toast_paused') : this.translationService.t('supporters.toast_resumed'), 'info');
          this.loadLedger(this.currentPage);
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_change_error'), 'error');
        },
      });
  }

  // Manual Ingestion Modal Actions
  openManualEntryModal(): void {
    this.entrySessionId = `cs_manual_${Date.now()}`;
    this.entryRawName = '';
    this.entryAmount = 3000;
    this.entryCreditVisibility = 'show';
    this.isManualEntryModalOpen.set(true);
  }

  closeManualEntryModal(): void {
    this.isManualEntryModalOpen.set(false);
  }

  submitManualEntry(): void {
    if (!this.entrySessionId.trim() || !this.entryRawName.trim() || !this.entryAmount) {
      this.toast.show(this.translationService.t('supporters.toast_required_fields'), 'error');
      return;
    }

    this.isSubmittingEntry.set(true);
    this.repo
      .manualEntry({
        stripeSessionId: this.entrySessionId.trim(),
        rawName: this.entryRawName.trim(),
        amount: this.entryAmount,
        creditVisibility: this.entryCreditVisibility,
      })
      .subscribe({
        next: () => {
          this.toast.show(this.translationService.t('supporters.toast_entry_success'), 'success');
          this.isSubmittingEntry.set(false);
          this.closeManualEntryModal();
          this.loadLedger();
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_entry_error'), 'error');
          this.isSubmittingEntry.set(false);
        },
      });
  }

  // Reward Manager Actions
  openRewardsModal(): void {
    this.loadRewards();
    this.newRewardTitle = '';
    this.selectedRewardFile = null;
    this.isRewardsModalOpen.set(true);
  }

  closeRewardsModal(): void {
    this.isRewardsModalOpen.set(false);
  }

  onRewardFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedRewardFile = input.files[0];
    }
  }

  uploadReward(): void {
    if (!this.selectedRewardFile) {
      this.toast.show(this.translationService.t('supporters.toast_select_image'), 'error');
      return;
    }

    this.isUploadingReward.set(true);
    this.repo
      .uploadReward(this.selectedRewardFile, this.newRewardTitle.trim())
      .subscribe({
        next: () => {
          this.toast.show(this.translationService.t('supporters.toast_reward_upload_success'), 'success');
          this.isUploadingReward.set(false);
          this.selectedRewardFile = null;
          this.newRewardTitle = '';
          this.loadRewards();
        },
        error: () => {
          this.toast.show(this.translationService.t('supporters.toast_upload_error'), 'error');
          this.isUploadingReward.set(false);
        },
      });
  }

  toggleRewardActive(reward: RewardImageDoc): void {
    const nextState = !reward.isActive;
    this.repo.updateReward(reward.id, { isActive: nextState }).subscribe({
      next: () => {
        this.toast.show(nextState ? this.translationService.t('supporters.toast_activated') : this.translationService.t('supporters.toast_deactivated'), 'info');
        this.loadRewards();
      },
      error: () => {
        this.toast.show(this.translationService.t('supporters.toast_update_error'), 'error');
      },
    });
  }

  deleteReward(reward: RewardImageDoc): void {
    const confirmMsg = this.translationService.t('supporters.confirm_delete_reward').replace('{title}', reward.title);
    if (!confirm(confirmMsg)) return;

    this.repo.deleteReward(reward.id).subscribe({
      next: () => {
        this.toast.show(this.translationService.t('supporters.toast_delete_success'), 'success');
        this.loadRewards();
      },
      error: () => {
        this.toast.show(this.translationService.t('supporters.toast_delete_error'), 'error');
      },
    });
  }

  openRewardLightbox(reward: RewardImageDoc): void {
    this.lightboxImageUrl.set(`/api/v1/supporters/rewards/${reward.id}/image?type=master`);
    this.isLightboxOpen.set(true);
  }

  closeRewardLightbox(): void {
    this.isLightboxOpen.set(false);
    this.lightboxImageUrl.set('');
  }
}
