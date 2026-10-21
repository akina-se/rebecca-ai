import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpSupportersRepository } from './http-supporters.repository';
import { environment } from '../../../environments/environment';
import { SupportTransactionDoc, RewardImageDoc } from '@rebecca/types';

describe('HttpSupportersRepository', () => {
  let repo: HttpSupportersRepository;
  let httpMock: HttpTestingController;

  const mockTransaction: SupportTransactionDoc = {
    id: 'tx_1',
    stripeSessionId: 'cs_1',
    rawName: 'Alice',
    safeName: 'Alice',
    isNameSanitized: false,
    creditVisibility: 'show',
    amount: 1000,
    currency: 'jpy',
    tier: 'silver',
    itemLabel: 'サーバーリソース差し入れ',
    rewardImageId: 'r_1',
    status: 'completed',
    isBanned: false,
    createdAt: '2026-10-20T00:00:00Z',
  };

  const mockReward: RewardImageDoc = {
    id: 'r_1',
    title: 'Reward Art',
    imageUrl: '/img.png',
    storagePath: 'rewards/art.png',
    isActive: true,
    distributedCount: 0,
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpSupportersRepository],
    });

    repo = TestBed.inject(HttpSupportersRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getLedger sends GET request with filters', () => {
    repo.getLedger({ status: 'failed', tier: 'gold', limit: 20, search: 'alice' }).subscribe((res) => {
      expect(res.transactions).toHaveLength(1);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/supporters` &&
        r.params.get('status') === 'failed' &&
        r.params.get('tier') === 'gold' &&
        r.params.get('limit') === '20' &&
        r.params.get('search') === 'alice',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      transactions: [mockTransaction],
      summary: { totalCount: 1, failedCount: 1, pendingCount: 0, completedCount: 0, totalAmount: 1000 },
    });
  });

  it('retryTransaction sends POST request to /supporters/:id/retry', () => {
    repo.retryTransaction('tx_1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/supporters/tx_1/retry`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'Retried', transaction: mockTransaction });
  });

  it('updateTransaction sends PATCH request', () => {
    repo.updateTransaction('tx_1', { safeName: 'New Name' }).subscribe((res) => {
      expect(res.safeName).toBe('New Name');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/supporters/tx_1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ safeName: 'New Name' });
    req.flush({ ...mockTransaction, safeName: 'New Name' });
  });

  it('manualResolve sends POST request to /manual-resolve', () => {
    repo.manualResolve('tx_1', { tweetText: 'Manual text' }).subscribe((res) => {
      expect(res.status).toBe('manual');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/supporters/tx_1/manual-resolve`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...mockTransaction, status: 'manual' });
  });

  it('manualEntry sends POST request to /manual-entry', () => {
    repo.manualEntry({ stripeSessionId: 'cs_1', rawName: 'Alice', amount: 300 }).subscribe((res) => {
      expect(res.id).toBe('tx_1');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/supporters/manual-entry`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTransaction);
  });

  it('reward endpoints send appropriate HTTP requests', () => {
    repo.getRewards().subscribe((res) => {
      expect(res.rewards).toHaveLength(1);
    });
    const reqGet = httpMock.expectOne(`${environment.apiUrl}/supporters/rewards`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush({ rewards: [mockReward] });

    repo.updateReward('r_1', { isActive: false }).subscribe((res) => {
      expect(res.isActive).toBe(false);
    });
    const reqPatch = httpMock.expectOne(`${environment.apiUrl}/supporters/rewards/r_1`);
    expect(reqPatch.request.method).toBe('PATCH');
    reqPatch.flush({ ...mockReward, isActive: false });

    repo.deleteReward('r_1').subscribe((res) => {
      expect(res.success).toBe(true);
    });
    const reqDelete = httpMock.expectOne(`${environment.apiUrl}/supporters/rewards/r_1`);
    expect(reqDelete.request.method).toBe('DELETE');
    reqDelete.flush({ success: true });
  });
});
