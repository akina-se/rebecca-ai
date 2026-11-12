import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

/**
 * Controller component for the administration console login page.
 * Provides immediate interactive rendering on initial mount to prevent mobile browser lockups,
 * with graceful error recovery and timeout safeguards.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent implements OnInit {
  error: string | null = null;
  isLoading = false;
  readonly configService = inject(ConfigService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // Check if an authenticated user session is already active in local storage/IndexedDB.
    // Notice: Do NOT set isLoading = true here; the login button must remain immediately interactive.
    try {
      await this.authService.waitForInit();
      if (this.authService.currentUser) {
        await this.router.navigate(['/dashboard']);
      }
    } catch (err) {
      console.warn('Initial auth state check warning:', err);
    }
  }

  /**
   * Initiates Google authentication upon explicit user interaction.
   */
  async loginWithGoogle(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      // Ignore normal user cancellation (closing popup window)
      if (authError?.code === 'auth/popup-closed-by-user' || authError?.code === 'auth/cancelled-popup-request') {
        this.error = null;
        return;
      }
      this.error = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      console.error('Authentication error:', err);
    } finally {
      this.isLoading = false;
    }
  }
}
