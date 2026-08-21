import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpMemoryRepository } from './http-memory.repository';

describe('HttpMemoryRepository', () => {
  let repository: HttpMemoryRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpMemoryRepository]
    });
    repository = TestBed.inject(HttpMemoryRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch memory layers via GET', () => {
    repository.getLayers().subscribe((layers) => {
      expect(layers.length).toBe(3);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/memory/layers'));
    expect(req.request.method).toBe('GET');
    req.flush([{ level: 0 }, { level: 1 }, { level: 2 }]);
  });

  it('should fetch core memory via GET', () => {
    repository.getCoreMemory().subscribe((res) => {
      expect(res.content).toBe('Core Persona');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/memory/core'));
    expect(req.request.method).toBe('GET');
    req.flush({ level: 0, name: 'Core Persona', content: 'Core Persona', isReadOnly: true });
  });

  it('should fetch and update extended memory', () => {
    repository.getExtendedMemory().subscribe((res) => {
      expect(res.content).toBe('Old tuning');
    });

    const getReq = httpMock.expectOne((r) => r.url.endsWith('/memory/extended'));
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ content: 'Old tuning' });

    repository.updateExtendedMemory('New tuning').subscribe();
    const putReq = httpMock.expectOne((r) => r.url.endsWith('/memory/extended') && r.method === 'PUT');
    expect(putReq.request.body).toEqual({ content: 'New tuning' });
    putReq.flush({ success: true });
  });

  it('should fetch and update global memory', () => {
    repository.getGlobalMemory().subscribe((res) => {
      expect(res.content).toBe('Global summary');
    });

    const getReq = httpMock.expectOne((r) => r.url.endsWith('/memory/global'));
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ content: 'Global summary' });

    repository.updateGlobalMemory('New summary').subscribe();
    const putReq = httpMock.expectOne((r) => r.url.endsWith('/memory/global') && r.method === 'PUT');
    expect(putReq.request.body).toEqual({ content: 'New summary' });
    putReq.flush({ success: true });
  });

  it('should trigger force dreaming via POST', () => {
    let triggered = false;
    repository.triggerDreaming().subscribe(() => {
      triggered = true;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/memory/force-dreaming') && r.method === 'POST');
    req.flush({ status: 'TRIGGERED' });
    expect(triggered).toBeTrue();
  });
});
