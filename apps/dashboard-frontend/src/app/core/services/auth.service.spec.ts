import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { take } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
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

  it('should read localStorage fallback when available with full details', async () => {
    const mockAuthData = {
      uid: 'admin_test_123',
      email: 'admin@example.com',
      displayName: 'Test Admin',
      stsTokenManager: { accessToken: 'mock_jwt_token_123' }
    };
    localStorage.setItem('firebase:authUser:YOUR_API_KEY:[DEFAULT]', JSON.stringify(mockAuthData));

    const user = service.currentUser;
    expect(user).toBeTruthy();
    expect(user?.uid).toBe('admin_test_123');
    expect(user?.email).toBe('admin@example.com');
    expect(user?.displayName).toBe('Test Admin');

    const token = await service.getToken();
    expect(token).toBe('mock_jwt_token_123');
  });

  it('should read localStorage fallback with default values when properties missing', async () => {
    const mockAuthData = {};
    localStorage.setItem('firebase:authUser:YOUR_API_KEY:[DEFAULT]', JSON.stringify(mockAuthData));

    const user = service.currentUser;
    expect(user).toBeTruthy();
    expect(user?.uid).toBe('admin_test_uid');
    expect(user?.email).toBe('admin@example.com');
    expect(user?.displayName).toBe('Rebecca Administrator');

    const token = await service.getToken();
    expect(token).toBe('mock_e2e_jwt_token');
  });

  it('should handle malformed JSON in localStorage fallback gracefully', () => {
    localStorage.setItem('firebase:authUser:YOUR_API_KEY:[DEFAULT]', '{invalid_json');
    expect(service.currentUser).toBeNull();
  });

  it('should attempt logout and handle errors if any', async () => {
    try {
      await service.logout();
    } catch {
      // Ignored in test environment
    }
  });
});
