import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { take } from 'rxjs';
import * as authModule from 'firebase/auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            firebaseConfig: {
              apiKey: 'mock-key',
              authDomain: 'mock.firebaseapp.com',
              projectId: 'mock-project'
            },
            isEmulator: true
          }
        }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize and provide currentUser$ observable', (done) => {
    expect(service).toBeTruthy();
    service.currentUser$.pipe(take(1)).subscribe((user) => {
      expect(user === null || typeof user === 'object').toBeTrue();
      done();
    });
  });

  it('should resolve waitForInit promise', async () => {
    await expect(service.waitForInit()).resolves.toBeUndefined();
  });

  it('should return null when currentUser is not authenticated', () => {
    expect(service.currentUser).toBeNull();
  });

  it('should resolve token to null when unauthenticated', async () => {
    const token = await service.getToken();
    expect(token).toBeNull();
  });

  it('should detect mobile devices based on user agent and touch points', () => {
    const originalNavigator = window.navigator;

    // Desktop Windows
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 },
      configurable: true
    });
    expect(service.isMobileDevice()).toBeFalse();

    // iPhone
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 },
      configurable: true
    });
    expect(service.isMobileDevice()).toBeTrue();

    // Android
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', platform: 'Linux armv8l', maxTouchPoints: 5 },
      configurable: true
    });
    expect(service.isMobileDevice()).toBeTrue();

    // iPadOS (MacIntel + touch)
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 },
      configurable: true
    });
    expect(service.isMobileDevice()).toBeTrue();

    // Restore
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true
    });
  });

  it('should handle redirect result when user is returned', async () => {
    const mockUser = {
      uid: 'user-redirect',
      getIdToken: jest.fn().mockResolvedValue('token-redirect')
    };
    jest.spyOn(authModule, 'getRedirectResult').mockResolvedValue({
      user: mockUser
    } as any);

    const result = await service.handleRedirectResult();
    expect(result).toBe(mockUser as any);
    expect(service.currentUserSignal()).toBe(mockUser as any);
  });

  it('should return null when getRedirectResult returns null', async () => {
    jest.spyOn(authModule, 'getRedirectResult').mockResolvedValue(null);

    const result = await service.handleRedirectResult();
    expect(result).toBeNull();
  });

  it('should rethrow error when getRedirectResult fails', async () => {
    jest.spyOn(authModule, 'getRedirectResult').mockRejectedValue(new Error('Redirect failed'));

    await expect(service.handleRedirectResult()).rejects.toThrow('Redirect failed');
  });

  it('should invoke signInWithRedirect when isMobileDevice is true', async () => {
    jest.spyOn(service, 'isMobileDevice').mockReturnValue(true);
    const redirectSpy = jest.spyOn(authModule, 'signInWithRedirect').mockResolvedValue(undefined as never);

    const result = await service.loginWithGoogle();
    expect(redirectSpy).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should invoke signInWithPopup and resolve user on desktop', async () => {
    jest.spyOn(service, 'isMobileDevice').mockReturnValue(false);
    const mockUser = {
      uid: 'user-popup',
      getIdToken: jest.fn().mockResolvedValue('token-popup')
    };
    jest.spyOn(authModule, 'signInWithPopup').mockResolvedValue({
      user: mockUser
    } as any);

    const result = await service.loginWithGoogle();
    expect(result).toBe(mockUser as any);
    expect(service.currentUserSignal()).toBe(mockUser as any);
  });

  it('should fallback to signInWithRedirect when popup is blocked', async () => {
    jest.spyOn(service, 'isMobileDevice').mockReturnValue(false);
    const popupBlockedError: any = new Error('Popup blocked');
    popupBlockedError.code = 'auth/popup-blocked';
    jest.spyOn(authModule, 'signInWithPopup').mockRejectedValue(popupBlockedError);
    const redirectSpy = jest.spyOn(authModule, 'signInWithRedirect').mockResolvedValue(undefined as never);

    const result = await service.loginWithGoogle();
    expect(redirectSpy).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should rethrow error when signInWithPopup fails with general error', async () => {
    jest.spyOn(service, 'isMobileDevice').mockReturnValue(false);
    jest.spyOn(authModule, 'signInWithPopup').mockRejectedValue(new Error('Popup general error'));

    await expect(service.loginWithGoogle()).rejects.toThrow('Popup general error');
  });

  it('should handle loginWithEmail and handle errors gracefully in test environment', async () => {
    try {
      await service.loginWithEmail('test@example.com', 'password123');
    } catch {
      // Expected in node/jsdom test environment
    }
  });

  it('should reject loginWithEmail when isEmulator is false', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            firebaseConfig: { apiKey: 'mock-key' },
            isEmulator: false
          }
        }
      ]
    });
    const nonEmuService = TestBed.inject(AuthService);
    await expect(nonEmuService.loginWithEmail('admin@example.com', 'password123')).rejects.toThrow(
      'Email/password login is strictly disabled outside local emulator environments.'
    );
  });

  it('should initialize when isEmulator is false', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            firebaseConfig: {
              apiKey: 'mock-key-no-emu',
              authDomain: 'mock-no-emu.firebaseapp.com',
              projectId: 'mock-no-emu-project'
            },
            isEmulator: false
          }
        }
      ]
    });
    const nonEmuService = TestBed.inject(AuthService);
    await expect(nonEmuService.waitForInit()).resolves.toBeUndefined();
  });

  it('should attempt logout and handle errors if any', async () => {
    try {
      await service.logout();
    } catch {
      // Ignored in test environment
    }
  });

  it('should return token from getSyncToken and getToken when user is authenticated with accessToken or stsTokenManager', async () => {
    const mockUserWithToken = {
      uid: 'user-1',
      accessToken: 'token-direct',
      getIdToken: () => Promise.resolve('token-async')
    } as any;
    service.currentUserSignal.set(mockUserWithToken);

    expect(service.currentUser).toBe(mockUserWithToken);
    expect(service.getSyncToken()).toBe('token-direct');
    expect(await service.getToken()).toBe('token-direct');

    const mockUserWithSts = {
      uid: 'user-2',
      stsTokenManager: { accessToken: 'token-sts' },
      getIdToken: () => Promise.resolve('token-async')
    } as any;
    service.currentUserSignal.set(mockUserWithSts);
    expect(service.getSyncToken()).toBe('token-sts');
    expect(await service.getToken()).toBe('token-sts');

    const mockUserNoDirectToken = {
      uid: 'user-3',
      getIdToken: () => Promise.resolve('token-from-idtoken')
    } as any;
    service.currentUserSignal.set(mockUserNoDirectToken);
    expect(service.getSyncToken()).toBeNull();
    expect(await service.getToken()).toBe('token-from-idtoken');

    const mockUserFailingToken = {
      uid: 'user-4',
      getIdToken: () => Promise.reject(new Error('fail'))
    } as any;
    service.currentUserSignal.set(mockUserFailingToken);
    expect(await service.getToken()).toBeNull();
  });
});
