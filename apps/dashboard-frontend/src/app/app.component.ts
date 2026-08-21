import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { TopNavComponent } from './layout/top-nav/top-nav.component';
import { AiDrawerComponent } from './layout/ai-drawer/ai-drawer.component';
import { ToastComponent } from './shared/components/atoms/toast/toast.component';
import { AuthService } from './core/services/auth.service';
import { Subscription } from 'rxjs';

/**
 * The root component of the application.
 * Manages the main layout structure and global authentication state.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopNavComponent, AiDrawerComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  isLoggedIn = false;
  isLoading = true;
  private authSub?: Subscription;

  constructor(private authService: AuthService) {}

  /**
   * Initializes the component.
   * Waits for the authentication service to initialize and subscribes to the current user state.
   *
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   */
  async ngOnInit(): Promise<void> {
    await this.authService.waitForInit();
    this.isLoading = false;
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user || !!this.authService.currentUser;
    });
  }

  /**
   * Cleans up resources when the component is destroyed.
   * Unsubscribes from the authentication state subscription.
   */
  ngOnDestroy(): void {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }
}
