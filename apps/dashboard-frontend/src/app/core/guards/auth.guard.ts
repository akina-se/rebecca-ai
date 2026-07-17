import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  await authService.waitForInit();

  if (authService.currentUser) {
    return true;
  } else {
    return router.parseUrl('/login');
  }
};
