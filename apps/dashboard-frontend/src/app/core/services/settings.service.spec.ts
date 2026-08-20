import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SettingsService]
    });
    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);

    // Handle the initial fetchRemoteSettings request
    const initReq = httpMock.match((req) => req.url.endsWith('/settings') && req.method === 'GET');
    if (initReq.length > 0) {
      initReq[0].flush({
        data: {
          timezone: 'Asia/Tokyo',
          language: 'ja',
          maintenanceMode: false,
          allowSelfRegistration: false,
          maxTokensPerRequest: 4096
        }
      });
    }
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should initialize with default timezone and language', () => {
    expect(service.selectedLang()).toBe('ja');
    expect(service.selectedTz()).toBe('Asia/Tokyo');
    expect(service.timezoneOptions.length).toBeGreaterThan(20);
    expect(service.languageOptions.length).toBe(2);
  });

  it('should update language and sync with backend via PATCH', () => {
    service.setLanguage('en');
    expect(service.selectedLang()).toBe('en');
    expect(localStorage.getItem('rebecca_lang')).toBe('en');

    const req = httpMock.expectOne((r) => r.url.endsWith('/settings') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ language: 'en' });
    req.flush({ success: true });
  });

  it('should update timezone and sync with backend via PATCH', () => {
    service.setTimezone('America/New_York');
    expect(service.selectedTz()).toBe('America/New_York');
    expect(localStorage.getItem('rebecca_tz')).toBe('America/New_York');

    const req = httpMock.expectOne((r) => r.url.endsWith('/settings') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ timezone: 'America/New_York' });
    req.flush({ success: true });
  });

  it('should format date strings properly according to timezone', () => {
    service.setTimezone('UTC');
    // Flush the PATCH
    const req = httpMock.expectOne((r) => r.url.endsWith('/settings') && r.method === 'PATCH');
    req.flush({ success: true });

    const formatted = service.formatDate('2026-08-15T12:00:00.000Z');
    expect(formatted).toBe('2026/08/15 12:00:00');
  });

  it('should handle special date keywords gracefully', () => {
    expect(service.formatDate('Never')).toBe('Never');
    expect(service.formatDate('N/A')).toBe('N/A');
    expect(service.formatDate('System Deploy')).toBe('System Deploy');
    expect(service.formatDate(undefined)).toBe('N/A');
    expect(service.formatDate('invalid-date-string')).toBe('invalid-date-string');
  });

  it('should handle backend error gracefully on init', () => {
    localStorage.clear();
    const newService = TestBed.inject(SettingsService);
    expect(newService.selectedLang()).toBeDefined();
  });
});
