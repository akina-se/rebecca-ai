import { Component, inject } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {
  error: string | null = null;
  isLoading = false;
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async loginWithGoogle() {
    this.isLoading = true;
    this.error = null;
    try {
      if (this.authService.isEmulator) {
        await this.authService.loginWithEmail('admin@example.com', 'password123');
      } else {
        await this.authService.loginWithGoogle();
      }
      
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      console.error('Authentication error:', err);
    } finally {
      this.isLoading = false;
    }
  }
}
