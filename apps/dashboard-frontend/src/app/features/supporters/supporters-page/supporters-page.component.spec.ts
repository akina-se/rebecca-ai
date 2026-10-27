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
          pagination: {
            totalItems: 1,
            totalPages: 1,
            currentPage: 1,
            limit: 30,
            itemCount: 1,
            itemsPerPage: 30,
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
      getRewardImageBlob: jest.fn().mockReturnValue(of(new Blob(['mock-data'], { type: 'image/png' }))),
      getPlans: jest.fn().mockReturnValue(of({ plans: [
        { tier: 'bronze', amount: 500, currency: 'jpy', itemLabel: 'Energy Drink', displayName: 'Bronze Supporter' },
        { tier: 'silver', amount: 1000, currency: 'jpy', itemLabel: 'Server Resource', displayName: 'Silver Supporter' },
        { tier: 'gold', amount: 3000, currency: 'jpy', itemLabel: 'Dev Support', displayName: 'Gold Sponsor' },
      ] })),
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

  it('should handle loadLedger and loadRewards error gracefully', () => {
    mockRepo.getLedger.mockReturnValueOnce(throwError(() => new Error('Ledger failure')));
    component.loadLedger();
    expect(mockToast.show).toHaveBeenCalledWith('サポーター台帳の取得に失敗しました', 'error');

    mockRepo.getRewards.mockReturnValueOnce(throwError(() => new Error('Rewards failure')));
    component.loadRewards();
    expect(component.rewards()).toHaveLength(1); // Unchanged
  });

  it('should handle filter and search changes and reset to page 1', () => {
    component.selectedStatus = 'completed';
    component.onFilterChange();
    expect(mockRepo.getLedger).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    component.searchQuery = 'Alice';
    component.onSearch();
    expect(mockRepo.getLedger).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    component.filterByFailed();
    expect(component.selectedStatus).toBe('failed');
    expect(mockRepo.getLedger).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('should handle pagination page changes', () => {
    component.onPageChange(2);
    expect(component.currentPage).toBe(2);
    expect(mockRepo.getLedger).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 30 }),
    );
  });

  it('should open and close transaction detail drawer', () => {
    component.openTransactionDrawer(mockTransaction);
    expect(component.isDrawerOpen()).toBe(true);
    expect(component.selectedTx()).toEqual(mockTransaction);
    expect(component.drawerSafeName).toBe('Alice Master');

    component.closeTransactionDrawer();
    expect(component.isDrawerOpen()).toBe(false);
    expect(component.selectedTx()).toBeNull();
  });

  it('should save drawer settings and handle failure', () => {
    component.openTransactionDrawer(mockTransaction);
    component.drawerSafeName = 'Alice VIP';
    component.drawerTier = 'vip';
    component.saveDrawerSettings();

    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', expect.objectContaining({
      safeName: 'Alice VIP',
      tier: 'vip',
    }));
    expect(mockToast.show).toHaveBeenCalledWith('サポーター設定を保存しました', 'success');

    // Blank safeName early return
    component.drawerSafeName = '   ';
    component.saveDrawerSettings();

    // Error branch
    component.drawerSafeName = 'Valid Name';
    mockRepo.updateTransaction.mockReturnValueOnce(throwError(() => new Error('Save error')));
    component.saveDrawerSettings();
    expect(mockToast.show).toHaveBeenCalledWith('設定の保存に失敗しました', 'error');
  });

  it('should trigger retry and manual resolve from drawer', () => {
    component.openTransactionDrawer(mockTransaction);
    component.retryFromDrawer();
    expect(mockRepo.retryTransaction).toHaveBeenCalledWith('tx_123');

    component.openManualResolveFromDrawer();
    expect(component.isManualModalOpen()).toBe(true);
  });

  it('should copy text to clipboard safely', async () => {
    const originalClipboard = navigator.clipboard;
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    component.copyToClipboard('cs_test_123', 'session_id');
    expect(writeTextMock).toHaveBeenCalledWith('cs_test_123');

    // Early return on empty text
    component.copyToClipboard('', 'empty');

    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('should handle retry action and error states', () => {
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

    // Error state
    mockRepo.retryTransaction.mockReturnValueOnce(throwError(() => ({ error: { error: 'Rate limit' } })));
    component.retry(failedTx);
    expect(mockToast.show).toHaveBeenCalledWith('再試行に失敗しました: Rate limit', 'error');
  });

  it('should open edit modal, save modifications, close, and handle failure', () => {
    const dummyEvent = { stopPropagation: jest.fn() } as unknown as Event;
    component.openEditModal(mockTransaction, dummyEvent);
    expect(dummyEvent.stopPropagation).toHaveBeenCalled();
    expect(component.isEditModalOpen()).toBe(true);
    expect(component.editSafeName).toBe('Alice Master');

    component.editSafeName = 'Alice (Gold)';
    component.editTier = 'gold';
    component.saveEdit();

    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', {
      safeName: 'Alice (Gold)',
      tier: 'gold',
      creditVisibility: 'show',
      isBanned: false,
    });
    expect(mockToast.show).toHaveBeenCalledWith('サポーター情報を更新しました', 'success');
    expect(component.isEditModalOpen()).toBe(false);

    // Error state
    component.openEditModal(mockTransaction);
    component.editSafeName = 'Alice Error';
    mockRepo.updateTransaction.mockReturnValueOnce(throwError(() => new Error('Update error')));
    component.saveEdit();
    expect(mockToast.show).toHaveBeenCalledWith('更新に失敗しました', 'error');

    component.closeEditModal();
    expect(component.isEditModalOpen()).toBe(false);
  });

  it('should open manual resolve modal, save resolution, close, and handle failure', () => {
    const dummyEvent = { stopPropagation: jest.fn() } as unknown as Event;
    component.openManualResolveModal(mockTransaction, dummyEvent);
    expect(dummyEvent.stopPropagation).toHaveBeenCalled();
    expect(component.isManualModalOpen()).toBe(true);

    component.manualTweetText = 'Custom resolution tweet text';
    component.saveManualResolve();

    expect(mockRepo.manualResolve).toHaveBeenCalledWith('tx_123', {
      tweetText: 'Custom resolution tweet text',
    });
    expect(mockToast.show).toHaveBeenCalledWith('手動ポストとして解決しました', 'success');
    expect(component.isManualModalOpen()).toBe(false);

    // Error state
    component.openManualResolveModal(mockTransaction);
    component.manualTweetText = 'Error text';
    mockRepo.manualResolve.mockReturnValueOnce(throwError(() => new Error('Manual fail')));
    component.saveManualResolve();
    expect(mockToast.show).toHaveBeenCalledWith('手動解決の登録に失敗しました', 'error');

    component.closeManualResolveModal();
    expect(component.isManualModalOpen()).toBe(false);
  });

  it('should toggle ban status and handle error', () => {
    const dummyEvent = { stopPropagation: jest.fn() } as unknown as Event;
    component.toggleBan(mockTransaction, dummyEvent);
    expect(dummyEvent.stopPropagation).toHaveBeenCalled();
    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', { isBanned: true });
    expect(mockToast.show).toHaveBeenCalledWith('公開を停止しました', 'info');

    // Unban toggle
    const bannedTx = { ...mockTransaction, isBanned: true };
    component.toggleBan(bannedTx);
    expect(mockRepo.updateTransaction).toHaveBeenCalledWith('tx_123', { isBanned: false });
    expect(mockToast.show).toHaveBeenCalledWith('公開を再開しました', 'info');

    // Error state
    mockRepo.updateTransaction.mockReturnValueOnce(throwError(() => new Error('Toggle error')));
    component.toggleBan(mockTransaction);
    expect(mockToast.show).toHaveBeenCalledWith('変更に失敗しました', 'error');
  });

  it('should handle manual transaction entry, validations, and errors', () => {
    component.openManualEntryModal();
    expect(component.isManualEntryModalOpen()).toBe(true);

    // Validation failure on empty fields
    component.entrySessionId = '';
    component.submitManualEntry();
    expect(mockToast.show).toHaveBeenCalledWith('すべての必須項目を入力してください', 'error');

    // Success
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
    expect(mockToast.show).toHaveBeenCalledWith('手動トランザクションを登録しました', 'success');
    expect(component.isManualEntryModalOpen()).toBe(false);

    // Error state
    component.openManualEntryModal();
    component.entrySessionId = 'cs_fail';
    component.entryRawName = 'Charlie';
    mockRepo.manualEntry.mockReturnValueOnce(throwError(() => new Error('Fail')));
    component.submitManualEntry();
    expect(mockToast.show).toHaveBeenCalledWith('登録に失敗しました', 'error');

    component.closeManualEntryModal();
    expect(component.isManualEntryModalOpen()).toBe(false);
  });

  it('should manage reward modal, file upload, activate/deactivate, and deletion', () => {
    component.openRewardsModal();
    expect(component.isRewardsModalOpen()).toBe(true);

    // Upload with no file
    component.selectedRewardFile = null;
    component.uploadReward();
    expect(mockToast.show).toHaveBeenCalledWith('画像ファイルを選択してください', 'error');

    // File selected event
    const file = new File(['content'], 'special_art.png', { type: 'image/png' });
    const fakeEvent = {
      target: { files: [file] },
    } as unknown as Event;
    component.newRewardTitle = 'special_art';
    component.onRewardFileSelected(fakeEvent);
    expect(component.selectedRewardFile).toBe(file);
    expect(component.newRewardTitle).toBe('special_art');

    // Upload success
    component.uploadReward();
    expect(mockRepo.uploadReward).toHaveBeenCalledWith(file, 'special_art');
    expect(mockToast.show).toHaveBeenCalledWith('デジタル特典画像をアップロードしました', 'success');

    // Upload error
    component.selectedRewardFile = file;
    mockRepo.uploadReward.mockReturnValueOnce(throwError(() => new Error('Upload error')));
    component.uploadReward();
    expect(mockToast.show).toHaveBeenCalledWith('アップロードに失敗しました', 'error');

    // Toggle active
    component.toggleRewardActive(mockReward);
    expect(mockRepo.updateReward).toHaveBeenCalledWith('r_1', { isActive: false });
    expect(mockToast.show).toHaveBeenCalledWith('特典を非アクティブにしました', 'info');

    const inactiveReward = { ...mockReward, isActive: false };
    component.toggleRewardActive(inactiveReward);
    expect(mockRepo.updateReward).toHaveBeenCalledWith('r_1', { isActive: true });
    expect(mockToast.show).toHaveBeenCalledWith('特典をアクティブ化しました', 'info');

    // Delete confirm rejected
    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(false);
    component.deleteReward(mockReward);
    expect(mockRepo.deleteReward).not.toHaveBeenCalled();

    // Delete confirm accepted
    window.confirm = jest.fn().mockReturnValue(true);
    component.deleteReward(mockReward);
    expect(mockRepo.deleteReward).toHaveBeenCalledWith('r_1');
    expect(mockToast.show).toHaveBeenCalledWith('特典を削除しました', 'success');

    // Delete error
    mockRepo.deleteReward.mockReturnValueOnce(throwError(() => new Error('Delete error')));
    component.deleteReward(mockReward);
    expect(mockToast.show).toHaveBeenCalledWith('削除に失敗しました', 'error');

    window.confirm = originalConfirm;
    component.closeRewardsModal();
    expect(component.isRewardsModalOpen()).toBe(false);
  });

  it('should open and close reward illustration lightbox with authenticated blob URL', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
    URL.revokeObjectURL = jest.fn();

    expect(component.isLightboxOpen()).toBe(false);
    expect(component.lightboxImageUrl()).toBe('');

    component.openRewardLightbox(mockReward);
    expect(mockRepo.getRewardImageBlob).toHaveBeenCalledWith('r_1', 'master');
    expect(component.isLightboxOpen()).toBe(true);
    expect(component.lightboxImageUrl()).toBe('blob:http://localhost/mock-blob-url');

    component.closeRewardLightbox();
    expect(component.isLightboxOpen()).toBe(false);
    expect(component.lightboxImageUrl()).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-blob-url');

    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('should clean up object URLs on ngOnDestroy', () => {
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.revokeObjectURL = jest.fn();

    component.ngOnDestroy();
    expect(component).toBeTruthy();

    URL.revokeObjectURL = originalRevokeObjectUrl;
  });
});
