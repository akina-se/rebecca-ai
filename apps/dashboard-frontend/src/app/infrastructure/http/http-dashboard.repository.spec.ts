import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpDashboardRepository } from './http-dashboard.repository';

describe('HttpDashboardRepository', () => {
  let repository: HttpDashboardRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpDashboardRepository]
    });
    repository = TestBed.inject(HttpDashboardRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch KPI metrics with period parameter', () => {
    repository.getKpiMetrics('7d').subscribe((metrics) => {
      expect(metrics).toBeTruthy();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics') && r.params.get('period') === '7d');
    expect(req.request.method).toBe('GET');
    req.flush({ followers: { value: 1000, diff: 5 } });
  });

  it('should fetch top posts with and without date param', () => {
    repository.getTopPosts('monthly', '2026-08').subscribe();
    const reqWithDate = httpMock.expectOne((r) =>
      r.url.endsWith('/posts') &&
      r.params.get('period') === 'monthly' &&
      r.params.get('date') === '2026-08'
    );
    expect(reqWithDate.request.method).toBe('GET');
    reqWithDate.flush({ data: [] });

    repository.getTopPosts('all-time').subscribe();
    const reqWithoutDate = httpMock.expectOne((r) =>
      r.url.endsWith('/posts') &&
      r.params.get('period') === 'all-time' &&
      !r.params.has('date')
    );
    expect(reqWithoutDate.request.method).toBe('GET');
    reqWithoutDate.flush({ data: [] });
  });

  it('should fetch top users with and without date param', () => {
    repository.getTopUsers('all-time').subscribe();
    const reqWithoutDate = httpMock.expectOne((r) =>
      r.url.endsWith('/users') &&
      r.params.get('period') === 'all-time' &&
      !r.params.has('date')
    );
    expect(reqWithoutDate.request.method).toBe('GET');
    reqWithoutDate.flush({ data: [] });

    repository.getTopUsers('monthly', '2026-08').subscribe();
    const reqWithDate = httpMock.expectOne((r) =>
      r.url.endsWith('/users') &&
      r.params.get('period') === 'monthly' &&
      r.params.get('date') === '2026-08'
    );
    expect(reqWithDate.request.method).toBe('GET');
    reqWithDate.flush({ data: [] });
  });

  it('should fetch system alerts', () => {
    repository.getAlerts().subscribe((alerts) => {
      expect(alerts).toBeDefined();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/alerts'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should fetch timeline history with pagination', () => {
    repository.getTimelineHistory(1, 20).subscribe((res) => {
      expect(res).toBeDefined();
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/posts') &&
      r.params.get('page') === '1' &&
      r.params.get('limit') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { totalPages: 1 } });
  });

  it('should fetch single post by id', () => {
    repository.getPostById('post_123').subscribe((post) => {
      expect(post.id).toBe('post_123');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/posts/post_123'));
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'post_123', content: 'Tweet content' });
  });

  it('should delete posts via DELETE request', () => {
    repository.deletePosts(['post_1', 'post_2']).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/posts') && r.method === 'DELETE');
    expect(req.request.body).toEqual({ ids: ['post_1', 'post_2'] });
    req.flush({ success: true });
  });
});
