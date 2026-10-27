import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Transforms an internal image API URL to include the active auth token query parameter,
 * enabling authenticated browser image streaming via <img> and CSS background-image.
 */
@Pipe({
  name: 'authUrl',
  standalone: true,
})
export class AuthUrlPipe implements PipeTransform {
  private readonly authService = inject(AuthService);

  transform(url: string | null | undefined): string {
    if (!url) return '';
    // Only append token to internal API routes; external URLs (or data/blob URIs) remain untouched.
    if (!url.startsWith('/api/') && !url.startsWith('api/')) {
      return url;
    }
    const token = this.authService.getSyncToken();
    if (!token) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
}
