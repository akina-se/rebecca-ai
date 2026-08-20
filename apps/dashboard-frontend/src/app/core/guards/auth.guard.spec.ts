import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['waitForInit'], {
      currentUser: null
    });
    authServiceSpy.waitForInit.and.returnValue(Promise.resolve());

    routerSpy = jasmine.createSpyObj('Router', ['parseUrl']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });
  });

  it('should allow activation when user is authenticated', async () => {
    (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')?.get as jasmine.Spy).and.returnValue({
      uid: 'user_123',
      email: 'admin@test.com'
    } as any);

    const result = await TestBed.runInInjectionContext(() => authGuard());
    expect(result).toBeTrue();
  });

  it('should redirect to /login when user is unauthenticated', async () => {
    (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')?.get as jasmine.Spy).and.returnValue(null);
    const mockUrlTree = {} as UrlTree;
    routerSpy.parseUrl.and.returnValue(mockUrlTree);

    const result = await TestBed.runInInjectionContext(() => authGuard());
    expect(result).toBe(mockUrlTree);
    expect(routerSpy.parseUrl).toHaveBeenCalledWith('/login');
  });
});
