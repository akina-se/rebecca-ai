import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { TopNavComponent } from './layout/top-nav/top-nav.component';
import { AiDrawerComponent } from './layout/ai-drawer/ai-drawer.component';
import { ToastComponent } from './shared/components/atoms/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopNavComponent, AiDrawerComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';
}
