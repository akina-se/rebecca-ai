import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AuthUrlPipe } from './auth-url.pipe';

describe('AuthUrlPipe', () => {
  let pipe: AuthUrlPipe;
  let httpSpy: jest.Mocked<HttpClient>;
  let sanitizerSpy: jest.Mocked<DomSanitizer>;
  let cdrSpy: jest.Mocked<ChangeDetectorRef>;

  beforeEach(() => {
    httpSpy = {
      get: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;

    sanitizerSpy = {
      bypassSecurityTrustUrl: jest.fn((url: string) => `safe:${url}`),
    } as unknown as jest.Mocked<DomSanitizer>;

    cdrSpy = {
      markForCheck: jest.fn(),
    } as unknown as jest.Mocked<ChangeDetectorRef>;

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url-123');
    global.URL.revokeObjectURL = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        AuthUrlPipe,
        { provide: HttpClient, useValue: httpSpy },
        { provide: DomSanitizer, useValue: sanitizerSpy },
        { provide: ChangeDetectorRef, useValue: cdrSpy },
      ],
    });

    pipe = TestBed.inject(AuthUrlPipe);
  });

  afterEach(() => {
    pipe.ngOnDestroy();
    jest.clearAllMocks();
  });

  it('should return empty string for null or undefined input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should not alter external or data/blob URLs', () => {
    expect(pipe.transform('https://example.com/pic.png')).toBe('https://example.com/pic.png');
    expect(pipe.transform('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
    expect(pipe.transform('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx');
    expect(httpSpy.get).not.toHaveBeenCalled();
  });

  it('should fetch internal API URL as blob and transform into sanitized blob URL', () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    httpSpy.get.mockReturnValueOnce(of(mockBlob));

    const result = pipe.transform('/api/v1/assets/img_123/image');

    expect(httpSpy.get).toHaveBeenCalledWith('/api/v1/assets/img_123/image', { responseType: 'blob' });
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(sanitizerSpy.bypassSecurityTrustUrl).toHaveBeenCalledWith('blob:mock-url-123');
    expect(result).toBe('safe:blob:mock-url-123');
    expect(cdrSpy.markForCheck).toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully by returning empty string', () => {
    httpSpy.get.mockReturnValueOnce(throwError(() => new Error('404 Not Found')));

    const result = pipe.transform('/api/v1/assets/not_found/image');

    expect(result).toBe('');
    expect(cdrSpy.markForCheck).toHaveBeenCalled();
  });

  it('should return cached result when input URL is identical', () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    httpSpy.get.mockReturnValueOnce(of(mockBlob));

    pipe.transform('/api/v1/assets/img_cached/image');
    expect(httpSpy.get).toHaveBeenCalledTimes(1);

    const secondCall = pipe.transform('/api/v1/assets/img_cached/image');
    expect(httpSpy.get).toHaveBeenCalledTimes(1);
    expect(secondCall).toBe('safe:blob:mock-url-123');
  });

  it('should revoke object URL on destroy', () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    httpSpy.get.mockReturnValueOnce(of(mockBlob));

    pipe.transform('/api/v1/assets/img_cleanup/image');
    pipe.ngOnDestroy();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-123');
  });
});
