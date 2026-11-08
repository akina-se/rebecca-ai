import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Checks whether an outgoing request URL targets a same-origin or relative BFF endpoint
 * so Firebase JWT Bearer tokens are never leaked to third-party origins.
 */
function isTrustedApiDestination(url: string): boolean {
  if (url.startsWith('/')) {
    return !url.startsWith('//');
  }
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return true;
    }
    return parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Attaches the Firebase JWT Bearer token synchronously to trusted outgoing BFF HTTP requests.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getSyncToken();

  if (token && isTrustedApiDestination(req.url)) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};
