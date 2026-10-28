import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

/** In-memory blob cache to avoid duplicate network fetches across components */
const blobCache = new Map<string, { blobUrl: string; refCount: number }>();

/**
 * Enterprise-grade AuthUrlPipe.
 *
 * Securely streams protected binary assets via Angular HttpClient using `Authorization: Bearer <token>`
 * headers (injected automatically via authInterceptor).
 *
 * Converts received binary Blobs into browser-local in-memory object URLs (`blob:http://...`).
 * Completely eliminates passing security credentials in URL query parameters (RFC 6750 / OWASP compliance).
 *
 * Implements reference counting and lifecycle cleanup via `URL.revokeObjectURL` to guarantee zero memory leaks.
 */
@Pipe({
  name: 'authUrl',
  standalone: true,
  pure: false,
})
export class AuthUrlPipe implements PipeTransform, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);

  private lastInput: string | null = null;
  private currentTrackedUrl: string | null = null;
  private latestResult: SafeUrl | string = '';
  private subscription?: Subscription;

  transform(url: string | null | undefined): SafeUrl | string {
    if (!url) {
      this.disposeCurrent();
      this.latestResult = '';
      return '';
    }

    // External URLs (data:, blob:, or third-party https://) do not require authenticated BFF streaming
    if (url.startsWith('data:') || url.startsWith('blob:') || (!url.startsWith('/api/') && !url.includes('/api/v1/'))) {
      return url;
    }

    if (url === this.lastInput) {
      return this.latestResult;
    }

    this.lastInput = url;
    this.disposeCurrent();

    // Check in-memory blob cache
    const cached = blobCache.get(url);
    if (cached) {
      cached.refCount++;
      this.currentTrackedUrl = url;
      this.latestResult = this.sanitizer.bypassSecurityTrustUrl(cached.blobUrl);
      return this.latestResult;
    }

    this.subscription = this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        blobCache.set(url, { blobUrl, refCount: 1 });
        this.currentTrackedUrl = url;
        this.latestResult = this.sanitizer.bypassSecurityTrustUrl(blobUrl);
        this.cdr.markForCheck();
      },
      error: () => {
        this.latestResult = '';
        this.cdr.markForCheck();
      },
    });

    return this.latestResult;
  }

  private disposeCurrent(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    if (this.currentTrackedUrl) {
      const entry = blobCache.get(this.currentTrackedUrl);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          URL.revokeObjectURL(entry.blobUrl);
          blobCache.delete(this.currentTrackedUrl);
        }
      }
      this.currentTrackedUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.disposeCurrent();
  }
}
