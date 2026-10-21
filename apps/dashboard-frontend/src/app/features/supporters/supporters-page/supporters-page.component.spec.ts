import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SupportersPageComponent } from './supporters-page.component';
import { SUPPORTERS_REPOSITORY } from '../../../core/ports/supporters.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { SupportTransactionDoc, RewardImageDoc } from '@rebecca/types';

describe('SupportersPageComponent', () => {
  let component: SupportersPageComponent;
  let fixture: ComponentFixture<SupportersPageComponent>;
  let mockRepo: any;
  let mockToast: any;

  const mockTransaction: SupportTransactionDoc = {
    id: 'tx_123',
    stripeSessionId: 'cs_test_123',
    rawName: 'Alice Master',
    safeName: 'Alice Master',
    isNameSanitized: false,
    creditVisibility: 'show',
    amount: 3000,
    currency: 'jpy',
    tier: 'gold',
    itemLabel: '開発サポート',
    rewardImageId: 'r_1',
    status: 'completed',
    isBanned: false,
    tweetId: 'tweet_123',
    tweetText: 'Thank you Alice!',
    createdAt: '2026-10-20T10:00:00Z',
  };

  const mockReward: RewardImageDoc = {
    id: 'r_1',
    title: 'Halloween Reward',
    imageUrl: '/image.png',
    storagePath: 'rewards/halloween.png',
    isActive: true,
    distributedCount: 5,
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
  };

  beforeEach(async () => {
    mockRepo = {
      getLedger: jest.fn().mockReturnValue(
        of({
          transactions: [mockTransaction],
          summary: {
            totalCount: 1,
            failedCount: 0,
            pendingCount: 0,
            completedCount: 1,
            totalAmount: 3000,
          },
        }),
      ),
      getTransactionById: jest.fn().mockReturnValue(of(mockTransaction)),
      updateTransaction: jest.fn().mockReturnValue(of(mockTransaction)),
      retryTransaction: jest.fn().mockReturnValue(
        of({
          success: true,
          message: 'Retried',
          transaction: { ...mockTransaction, status: 'pending' },
        }),
      ),
      manualResolve: jest.fn().mockReturnValue(of({ ...mockTransaction, status: 'manual' })),
      manualEntry: jest.fn().mockReturnValue(of(mockTransaction)),
      getRewards: jest.fn().mockReturnValue(of({ rewards: [mockReward] })),
      uploadReward: jest.fn().mockReturnValue(of(mockReward)),
      updateReward: jest.fn().mockReturnValue(of({ ...mockReward, isActive: false })),
      deleteReward: jest.fn().mockReturnValue(of({ success: true })),
    };

    mockToast = {
      show: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SupportersPageComponent],
      providers: [
        { provide: SUPPORTERS_REPOSITORY, useValue: mockRepo },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupportersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load ledger and rewards', () => {
    expect(component).toBeTruthy();
    expect(mockRepo.getLedger).toHaveBeenCalled();
    expect(mockRepo.getRewards).toHaveBeenCalled();
    expect(component.transactions()).toHaveLength(1);
    expect(component.summary().totalAmount).toBe(3000);
    expect(component.rewards()).toHaveLength(1);
  });

  it('should handle retry action and display toast', () => {
    const failedTx: SupportTransactionDoc = {
      ...mockTransaction,
      id: 'tx_failed',
      status: 'failed',
      errorMessage: 'X API Error',
    };

    component.retry(failedTx);
    expect(mockRepo.retryTransaction).toHaveBeenCalledWith('tx_failed');
    expect(mockToast.show).toHaveBeenCalledWith(
      expect.stringContaining('再試行タスクをスケジュールしました'),
      'success',
    );
  });

  it('should open edit modal and save modified safeName and VIP tier', () => {
    component.openEditModal(mockTransaction);
    expect(component.isEditModalOpen()).toBe(true);
    expect(component.editSafeName).toBe('Alice Master');

    component.editSafeName = 'Alice (VIP)';
    component.editTier = 'vip';
    component.saveEdit();

    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', {
      safeName: 'Alice (VIP)',
      tier: 'vip',
      creditVisibility: 'show',
      isBanned: false,
    });
    expect(mockToast.show).toHaveBeenCalledWith(
      'サポーター情報を更新しました',
      'success',
    );
    expect(component.isEditModalOpen()).toBe(false);
  });

  it('should open manual resolve modal and mark as manual with custom tweetText', () => {
    component.openManualResolveModal(mockTransaction);
    expect(component.isManualModalOpen()).toBe(true);

    component.manualTweetText = 'Custom resolution tweet text';
    component.saveManualResolve();

    expect(mockRepo.manualResolve).toHaveBeenCalledWith('tx_123', {
      tweetText: 'Custom resolution tweet text',
    });
    expect(mockToast.show).toHaveBeenCalledWith(
      '手動ポストとして解決しました',
      'success',
    );
    expect(component.isManualModalOpen()).toBe(false);
  });

  it('should toggle ban status on a transaction', () => {
    component.toggleBan(mockTransaction);
    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', {
      isBanned: true,
    });
    expect(mockToast.show).toHaveBeenCalledWith(
      '公開を停止しました',
      'info',
    );
  });

  it('should handle manual transaction entry', () => {
    component.openManualEntryModal();
    expect(component.isManualEntryModalOpen()).toBe(true);

    component.entrySessionId = 'cs_manual_999';
    component.entryRawName = 'Bob';
    component.entryAmount = 1000;
    component.submitManualEntry();

    expect(mockRepo.manualEntry).toHaveBeenCalledWith({
      stripeSessionId: 'cs_manual_999',
      rawName: 'Bob',
      amount: 1000,
      creditVisibility: 'show',
    });
    expect(mockToast.show).toHaveBeenCalledWith(
      '手動トランザクションを登録しました',
      'success',
    );
    expect(component.isManualEntryModalOpen()).toBe(false);
  });

  it('should toggle reward active status', () => {
    component.toggleRewardActive(mockReward);
    expect(mockRepo.updateReward).toHaveBeenCalledWith('r_1', { isActive: false });
    expect(mockToast.show).toHaveBeenCalledWith(
      '特典を非アクティブにしました',
      'info',
    );
  });
});
