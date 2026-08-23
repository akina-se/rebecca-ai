import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigService]
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should initialize with default site URL', () => {
    expect(service.publicSiteUrl()).toBe('https://rebecca-ai.net');
    expect(service.runtimeConfig).toBeNull();
  });

  it('should successfully load runtime config from /api/v1/config', async () => {
    const mockConfig = {
      firebase: {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '12345',
        appId: '1:12345:web:test'
      },
      apiUrl: 'https://admin.rebecca-ai.net/api/v1',
      publicSiteUrl: 'https://rebecca-ai.net',
      production: true,
      useEmulators: false
    };

    const loadPromise = service.loadAppConfig();

    const req = httpMock.expectOne('/api/v1/config');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
    await loadPromise;

    expect(service.runtimeConfig).toEqual(mockConfig);
    expect(service.firebaseConfig.apiKey).toBe('test-api-key');
    expect(service.apiUrl).toBe('https://admin.rebecca-ai.net/api/v1');
    expect(service.isEmulator).toBeFalse();

    mockConfig.useEmulators = true;
    const loadPromise2 = service.loadAppConfig();
    const req2 = httpMock.expectOne('/api/v1/config');
    req2.flush(mockConfig);
    await loadPromise2;
    expect(service.isEmulator).toBeTrue();
  });

  it('should fall back gracefully to environment defaults when /api/v1/config fails', async () => {
    const loadPromise = service.loadAppConfig();
    const req = httpMock.expectOne('/api/v1/config');
    req.flush('Network error', { status: 500, statusText: 'Server Error' });
    await loadPromise;

    expect(service.runtimeConfig).not.toBeNull();
    expect(service.publicSiteUrl()).toBe('https://rebecca-ai.net');
    expect(service.apiUrl).toBeDefined();
    expect(service.firebaseConfig).toBeDefined();
  });

  it('should return environment fallbacks when config is null', () => {
    (service as any).config = null;
    expect(service.firebaseConfig).toBeDefined();
    expect(service.apiUrl).toBeDefined();
    expect(service.isEmulator).toBeFalse();
  });
});
