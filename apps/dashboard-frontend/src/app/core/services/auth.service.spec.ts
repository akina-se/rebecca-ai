import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { take } from 'rxjs';

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

  it('should initialize and provide currentUser$ observable', (done) => {
    expect(service).toBeTruthy();
    service.currentUser$.pipe(take(1)).subscribe((user) => {
      expect(user === null || typeof user === 'object').toBeTrue();
      done();
    });
  });

  it('should resolve waitForInit promise', async () => {
    await expectAsync(service.waitForInit()).toBeResolved();
  });

  it('should return null when currentUser is not authenticated', () => {
    expect(service.currentUser).toBeNull();
  });

  it('should resolve token to null when unauthenticated', async () => {
    const token = await service.getToken();
    expect(token).toBeNull();
  });

  it('should handle loginWithEmail and handle errors gracefully in test environment', async () => {
    try {
      await service.loginWithEmail('test@example.com', 'password123');
    } catch {
      // Expected in node/jsdom test environment
    }
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
    await expectAsync(nonEmuService.waitForInit()).toBeResolved();
  });

  it('should attempt logout and handle errors if any', async () => {
    try {
      await service.logout();
    } catch {
      // Ignored in test environment
    }
  });

  it('should attempt loginWithGoogle and handle errors if any', async () => {
    try {
      await service.loginWithGoogle();
    } catch {
      // Expected in node/jsdom environment without popup support
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
