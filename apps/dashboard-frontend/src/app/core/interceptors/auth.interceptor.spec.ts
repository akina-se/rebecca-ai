import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getToken']);

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

  it('should attach Bearer token to request headers when user is authenticated', fakeAsync(() => {
    authServiceSpy.getToken.and.returnValue(Promise.resolve('mock-firebase-token-xyz'));

    httpClient.get('/api/v1/users').subscribe();
    tick();

    const req = httpMock.expectOne('/api/v1/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-firebase-token-xyz');
    req.flush({ success: true });
  }));

  it('should not attach Authorization header when user is unauthenticated (token is null)', fakeAsync(() => {
    authServiceSpy.getToken.and.returnValue(Promise.resolve(null));

    httpClient.get('/api/v1/config').subscribe();
    tick();

    const req = httpMock.expectOne('/api/v1/config');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  }));
});
