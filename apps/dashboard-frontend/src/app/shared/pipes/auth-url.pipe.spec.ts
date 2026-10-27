import { TestBed } from '@angular/core/testing';
import { AuthUrlPipe } from './auth-url.pipe';
import { AuthService } from '../../core/services/auth.service';

describe('AuthUrlPipe', () => {
  let pipe: AuthUrlPipe;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getSyncToken']);

    TestBed.configureTestingModule({
      providers: [
        AuthUrlPipe,
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    pipe = TestBed.inject(AuthUrlPipe);
  });

  it('should return empty string for null or undefined input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should not alter external or blob URLs', () => {
    authServiceSpy.getSyncToken.and.returnValue('token_123');
    expect(pipe.transform('https://example.com/pic.png')).toBe('https://example.com/pic.png');
    expect(pipe.transform('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });

  it('should append token to internal API URLs', () => {
    authServiceSpy.getSyncToken.and.returnValue('token_123');
    expect(pipe.transform('/api/v1/assets/img_1/image')).toBe('/api/v1/assets/img_1/image?token=token_123');
  });

  it('should append token with ampersand if URL already contains query parameters', () => {
    authServiceSpy.getSyncToken.and.returnValue('token_123');
    expect(pipe.transform('/api/v1/assets/img_1/image?size=thumbnail')).toBe('/api/v1/assets/img_1/image?size=thumbnail&token=token_123');
  });

  it('should return untouched URL if no token is available', () => {
    authServiceSpy.getSyncToken.and.returnValue(null);
    expect(pipe.transform('/api/v1/assets/img_1/image')).toBe('/api/v1/assets/img_1/image');
  });
});
