import { Routes } from '@angular/router';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page.component';
import { MemoryPageComponent } from './features/memory/memory-page/memory-page.component';
import { AssetsPageComponent } from './features/assets/assets-page/assets-page.component';
import { UsersPageComponent } from './features/users/users-page/users-page.component';
import { SettingsPageComponent } from './features/settings/settings-page/settings-page.component';
import { LoginPageComponent } from './features/auth/login-page/login-page.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginPageComponent },
  { path: 'dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'memory', component: MemoryPageComponent, canActivate: [authGuard] },
  { path: 'assets', component: AssetsPageComponent, canActivate: [authGuard] },
  { path: 'users', component: UsersPageComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] }
];

