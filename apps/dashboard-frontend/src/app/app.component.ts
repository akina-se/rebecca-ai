import { Component, inject, computed } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { TopNavComponent } from './layout/top-nav/top-nav.component';
import { AiDrawerComponent } from './layout/ai-drawer/ai-drawer.component';
import { ToastComponent } from './shared/components/atoms/toast/toast.component';
import { AuthService } from './core/services/auth.service';

/**
 * Root component managing global layout shells and authentication context.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopNavComponent,
    AiDrawerComponent,
    ToastComponent
],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  readonly currentUser = this.authService.currentUserSignal;

  readonly isLoggedIn = computed<boolean>(() => {
    return !!this.currentUser();
  });
}
