import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

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
    if (this.authService.isEmulator) {
      return;
    }
    this.isLoading = true;
    try {
      const redirectUser = await this.authService.handleRedirectResult();
      if (redirectUser) {
        await this.router.navigate(['/dashboard']);
        return;
      }
      await this.authService.waitForInit();
      if (this.authService.currentUser) {
        await this.router.navigate(['/dashboard']);
        return;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      console.error('Redirect authentication error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async loginWithGoogle() {
    this.isLoading = true;
    this.error = null;
    try {
      if (this.authService.isEmulator) {
        await this.authService.loginWithEmail('admin@example.com', 'password123');
        await this.router.navigate(['/dashboard']);
        this.isLoading = false;
      } else {
        const user = await this.authService.loginWithGoogle();
        if (user) {
          await this.router.navigate(['/dashboard']);
          this.isLoading = false;
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      console.error('Authentication error:', err);
      this.isLoading = false;
    }
  }
}
