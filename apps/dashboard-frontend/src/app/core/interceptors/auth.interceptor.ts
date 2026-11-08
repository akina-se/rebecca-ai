import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Checks whether an outgoing request URL targets a same-origin relative path or the
 * configured BFF origin (`environment.apiUrl`) so Firebase JWT Bearer tokens are
 * never leaked to third-party origins, even if a third-party URL path starts with `/api/`.
 */
function isTrustedApiDestination(url: string): boolean {
  if (url.startsWith('/')) {
    return !url.startsWith('//');
  }
  try {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, currentOrigin);
    if (parsed.origin === currentOrigin) {
      return true;
    }
    if (environment.apiUrl.startsWith('http://') || environment.apiUrl.startsWith('https://')) {
      const configuredApiOrigin = new URL(environment.apiUrl).origin;
      return parsed.origin === configuredApiOrigin;
    }
    return false;
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
