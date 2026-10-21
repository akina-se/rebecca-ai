import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupportTier,
  CreditVisibility,
} from '@rebecca/types';
import { SUPPORTERS_REPOSITORY } from '../../../core/ports/supporters.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-supporters-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, TzDatePipe],
  templateUrl: './supporters-page.component.html',
  styleUrls: ['./supporters-page.component.css'],
})
export class SupportersPageComponent implements OnInit {
  private readonly repo = inject(SUPPORTERS_REPOSITORY);
  private readonly toast = inject(ToastService);
  readonly translationService = inject(TranslationService);

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

  // Filters
  selectedStatus = 'all';
  selectedTier = 'all';
  searchQuery = '';

  // Edit Modal State
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

  ngOnInit(): void {
    this.loadLedger();
    this.loadRewards();
  }

  loadLedger(): void {
    this.isLoading.set(true);
    this.repo
      .getLedger({
        status: this.selectedStatus as any,
        tier: this.selectedTier as any,
        search: this.searchQuery,
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.transactions);
          this.summary.set(res.summary);
          this.isLoading.set(false);
        },
        error: () => {
          this.toast.show('サポーター台帳の取得に失敗しました', 'error');
          this.isLoading.set(false);
        },
      });
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
    this.loadLedger();
  }

  onSearch(): void {
    this.loadLedger();
  }

  filterByFailed(): void {
    this.selectedStatus = 'failed';
    this.loadLedger();
  }

  // 1-Click Retry
  retry(tx: SupportTransactionDoc): void {
    if (this.retryingId()) return;
    this.retryingId.set(tx.id);

    this.repo.retryTransaction(tx.id).subscribe({
      next: () => {
        this.toast.show(`再試行タスクをスケジュールしました (${tx.safeName})`, 'success');
        this.retryingId.set(null);
        this.loadLedger();
      },
      error: (err) => {
        this.toast.show(`再試行に失敗しました: ${err?.error?.error || err.message}`, 'error');
        this.retryingId.set(null);
      },
    });
  }

  // Edit Modal Actions
  openEditModal(tx: SupportTransactionDoc): void {
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
          this.toast.show('サポーター情報を更新しました', 'success');
          this.isSavingEdit.set(false);
          this.closeEditModal();
          this.loadLedger();
        },
        error: () => {
          this.toast.show('更新に失敗しました', 'error');
          this.isSavingEdit.set(false);
        },
      });
  }

  // Manual Resolve Modal Actions
  openManualResolveModal(tx: SupportTransactionDoc): void {
    this.manualTransaction.set(tx);
    this.manualTweetText = tx.tweetText || `マスター ${tx.safeName}、${tx.itemLabel}差し入れありがとう！レベッカの演算パワー充填完了だよ♡\n\n👇スペシャルサンクス\nhttps://rebecca-ai.net/#supporters\n#全肯定AIレベッカ`;
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
          this.toast.show('手動ポストとして解決しました', 'success');
          this.isResolvingManual.set(false);
          this.closeManualResolveModal();
          this.loadLedger();
        },
        error: () => {
          this.toast.show('手動解決の登録に失敗しました', 'error');
          this.isResolvingManual.set(false);
        },
      });
  }

  // Quick Ban Toggle
  toggleBan(tx: SupportTransactionDoc): void {
    const nextState = !tx.isBanned;
    this.repo
      .updateTransaction(tx.id, { isBanned: nextState })
      .subscribe({
        next: () => {
          this.toast.show(nextState ? '公開を停止しました' : '公開を再開しました', 'info');
          this.loadLedger();
        },
        error: () => {
          this.toast.show('変更に失敗しました', 'error');
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
      this.toast.show('すべての必須項目を入力してください', 'error');
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
          this.toast.show('手動トランザクションを登録しました', 'success');
          this.isSubmittingEntry.set(false);
          this.closeManualEntryModal();
          this.loadLedger();
        },
        error: () => {
          this.toast.show('登録に失敗しました', 'error');
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
      if (!this.newRewardTitle) {
        this.newRewardTitle = this.selectedRewardFile.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  uploadReward(): void {
    if (!this.selectedRewardFile) {
      this.toast.show('画像ファイルを選択してください', 'error');
      return;
    }

    this.isUploadingReward.set(true);
    this.repo
      .uploadReward(this.selectedRewardFile, this.newRewardTitle || 'サポーター特典イラスト')
      .subscribe({
        next: () => {
          this.toast.show('デジタル特典画像をアップロードしました', 'success');
          this.isUploadingReward.set(false);
          this.selectedRewardFile = null;
          this.newRewardTitle = '';
          this.loadRewards();
        },
        error: () => {
          this.toast.show('アップロードに失敗しました', 'error');
          this.isUploadingReward.set(false);
        },
      });
  }

  toggleRewardActive(reward: RewardImageDoc): void {
    const nextState = !reward.isActive;
    this.repo.updateReward(reward.id, { isActive: nextState }).subscribe({
      next: () => {
        this.toast.show(nextState ? '特典をアクティブ化しました' : '特典を非アクティブにしました', 'info');
        this.loadRewards();
      },
      error: () => {
        this.toast.show('更新に失敗しました', 'error');
      },
    });
  }

  deleteReward(reward: RewardImageDoc): void {
    if (!confirm(`特典「${reward.title}」を削除してもよろしいですか？`)) return;

    this.repo.deleteReward(reward.id).subscribe({
      next: () => {
        this.toast.show('特典を削除しました', 'success');
        this.loadRewards();
      },
      error: () => {
        this.toast.show('削除に失敗しました', 'error');
      },
    });
  }
}
