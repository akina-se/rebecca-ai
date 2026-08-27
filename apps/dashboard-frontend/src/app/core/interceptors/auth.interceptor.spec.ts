import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getToken', 'getSyncToken']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Bearer token to request headers when user is authenticated', () => {
    authServiceSpy.getSyncToken.and.returnValue('mock-firebase-token-xyz');

    httpClient.get('/api/v1/users').subscribe();

    const req = httpMock.expectOne('/api/v1/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-firebase-token-xyz');
    req.flush({ success: true });
  });

  it('should not attach Authorization header when user is unauthenticated (token is null)', () => {
    authServiceSpy.getSyncToken.and.returnValue(null);

    httpClient.get('/api/v1/config').subscribe();

    const req = httpMock.expectOne('/api/v1/config');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });
});
