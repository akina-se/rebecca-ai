import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpCampaignsRepository } from './http-campaigns.repository';
import { environment } from '../../../environments/environment';
import { CampaignDocWithId } from '@rebecca/types';

describe('HttpCampaignsRepository', () => {
  let repo: HttpCampaignsRepository;
  let httpMock: HttpTestingController;

  const mockCampaign: CampaignDocWithId = {
    id: 'camp_1',
    title: 'Kyoto Journey',
    description: 'Fall colors tour',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    status: 'scheduled',
    dailySlotTimes: ['08:00', '19:00'],
    masterContext: 'Rebecca in Kyoto',
    replyContextSummary: 'Enjoying Kyoto',
    slots: [],
    totalSlotsCount: 6,
    completedSlotsCount: 0,
    isPaused: false,
    createdAt: '2026-09-18T00:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpCampaignsRepository],
    });

    repo = TestBed.inject(HttpCampaignsRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll should request GET /campaigns with query params', () => {
    repo.getAll({ page: 2, limit: 10, status: 'scheduled' }).subscribe((res) => {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('camp_1');
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/campaigns` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10' &&
        r.params.get('status') === 'scheduled',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [mockCampaign],
      meta: { totalItems: 1, totalPages: 1, currentPage: 2, limit: 10 },
    });
  });

  it('getAll should support call with no params or partial params with whitespace status', () => {
    // No params
    repo.getAll().subscribe();
    const req1 = httpMock.expectOne(`${environment.apiUrl}/campaigns`);
    expect(req1.request.params.keys()).toHaveLength(0);
    req1.flush({ data: [], meta: { totalItems: 0, totalPages: 1, currentPage: 1, limit: 10 } });

    // Whitespace status should not be set
    repo.getAll({ status: '   ' }).subscribe();
    const req2 = httpMock.expectOne(`${environment.apiUrl}/campaigns`);
    expect(req2.request.params.has('status')).toBe(false);
    req2.flush({ data: [], meta: { totalItems: 0, totalPages: 1, currentPage: 1, limit: 10 } });
  });

  it('getById should request GET /campaigns/:id', () => {
    repo.getById('camp_1').subscribe((res) => {
      expect(res.id).toBe('camp_1');
      expect(res.title).toBe('Kyoto Journey');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCampaign);
  });

  it('create should request POST /campaigns', () => {
    repo.create({ title: 'New Trip' }).subscribe((res) => {
      expect(res.id).toBe('camp_1');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'New Trip' });
    req.flush(mockCampaign);
  });

  it('update should request PUT /campaigns/:id', () => {
    repo.update('camp_1', { title: 'Updated Trip' }).subscribe((res) => {
      expect(res.title).toBe('Updated Trip');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ ...mockCampaign, title: 'Updated Trip' });
  });

  it('clone should request POST /campaigns/:id/clone', () => {
    repo.clone('camp_1', '2027-11-01', '2027-11-03').subscribe((res) => {
      expect(res.id).toBe('camp_2');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1/clone`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newStartDate: '2027-11-01', newEndDate: '2027-11-03' });
    req.flush({ ...mockCampaign, id: 'camp_2' });
  });

  it('clone should support call without optional dates', () => {
    repo.clone('camp_1').subscribe((res) => {
      expect(res.id).toBe('camp_2');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1/clone`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newStartDate: undefined, newEndDate: undefined });
    req.flush({ ...mockCampaign, id: 'camp_2' });
  });

  it('pause and resume should request POST /pause and POST /resume', () => {
    repo.pause('camp_1').subscribe((res) => {
      expect(res.isPaused).toBe(true);
    });

    const reqPause = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1/pause`);
    expect(reqPause.request.method).toBe('POST');
    reqPause.flush({ ...mockCampaign, isPaused: true });

    repo.resume('camp_1').subscribe((res) => {
      expect(res.isPaused).toBe(false);
    });

    const reqResume = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1/resume`);
    expect(reqResume.request.method).toBe('POST');
    reqResume.flush({ ...mockCampaign, isPaused: false });
  });

  it('uploadAsset should send multipart form-data to POST /campaigns/:id/assets', () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    repo.uploadAsset('camp_1', file).subscribe((res) => {
      expect(res.url).toContain('test.png');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1/assets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ url: 'https://storage.googleapis.com/bucket/campaigns/camp_1/test.png', filename: 'test.png' });
  });

  it('delete should request DELETE /campaigns/:id', () => {
    repo.delete('camp_1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/campaigns/camp_1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
