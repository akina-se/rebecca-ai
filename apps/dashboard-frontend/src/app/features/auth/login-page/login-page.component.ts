import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {
  error: string | null = null;
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  async loginWithGoogle() {
    this.isLoading = true;
    this.error = null;
    try {
      await this.authService.loginWithGoogle();
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      console.error(err);
    } finally {
      this.isLoading = false;
    }
  }
}
