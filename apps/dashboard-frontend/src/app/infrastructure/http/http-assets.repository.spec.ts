import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpAssetsRepository } from './http-assets.repository';
import { AssetStatus } from '@rebecca/types';

describe('HttpAssetsRepository', () => {
  let repository: HttpAssetsRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpAssetsRepository]
    });
    repository = TestBed.inject(HttpAssetsRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch assets with search, status, and pagination params', () => {
    repository.getAll({ page: 1, limit: 10, search: 'rebecca', status: 'READY' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe(AssetStatus.SUCCESS);
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/images') &&
      r.params.get('page') === '1' &&
      r.params.get('search') === 'rebecca' &&
      r.params.get('status') === 'READY'
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [{ id: 'a1', filename: 'rebecca.png', status: 'READY' }]
    });
  });

  it('should get asset by ID and map status enum', () => {
    repository.getById('asset_10').subscribe((asset) => {
      expect(asset.id).toBe('asset_10');
      expect(asset.status).toBe(AssetStatus.FAILED);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/images/asset_10'));
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'asset_10', status: 'FAILED' });
  });

  it('should upload files with FormData', () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    repository.upload(file).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images') && r.method === 'POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ success: true });
  });

  it('should update asset properties via PUT', () => {
    repository.update('asset_10', { caption: 'Updated' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images/asset_10') && r.method === 'PUT');
    expect(req.request.body).toEqual({ caption: 'Updated' });
    req.flush({ success: true });
  });

  it('should delete multiple assets via DELETE body', () => {
    repository.deleteMany(['a1', 'a2']).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images') && r.method === 'DELETE');
    expect(req.request.body).toEqual({ ids: ['a1', 'a2'] });
    req.flush({ success: true });
  });

  it('should regenerate captions via POST', () => {
    repository.regenerateCaptions(['a1']).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images/regenerate-captions') && r.method === 'POST');
    expect(req.request.body).toEqual({ ids: ['a1'] });
    req.flush({ queued: 1 });
  });

  it('should handle getAll without params or with empty search/status', () => {
    repository.getAll().subscribe((res) => {
      expect(res.data.length).toBe(3);
      expect(res.data[0].status).toBe(AssetStatus.PENDING);
      expect(res.data[1].status).toBe(AssetStatus.PROCESSING);
      expect(res.data[2].status).toBe(AssetStatus.PENDING);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/images'));
    expect(req.request.params.keys().length).toBe(0);
    req.flush({
      data: [
        { id: 'a1', filename: 'img1.png', status: null },
        { id: 'a2', filename: 'img2.png', status: 'PROCESSING' },
        { id: 'a3', filename: 'img3.png', status: 'UNKNOWN' }
      ]
    });
  });

  it('should upload multiple files as an array', () => {
    const files = [
      new File(['data1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['data2'], 'test2.png', { type: 'image/png' })
    ];
    repository.upload(files).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images') && r.method === 'POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ success: true });
  });

  it('should delete a single asset via direct ID URL', () => {
    repository.deleteMany(['a1']).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/images/a1') && r.method === 'DELETE');
    req.flush({ success: true });
  });
});
