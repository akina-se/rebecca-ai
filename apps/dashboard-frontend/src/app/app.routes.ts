import { Routes } from '@angular/router';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page.component';
import { MemoryPageComponent } from './features/memory/memory-page/memory-page.component';
import { AssetsPageComponent } from './features/assets/assets-page/assets-page.component';
import { UsersPageComponent } from './features/users/users-page/users-page.component';
import { SettingsPageComponent } from './features/settings/settings-page/settings-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'memory', component: MemoryPageComponent },
  { path: 'assets', component: AssetsPageComponent },
  { path: 'users', component: UsersPageComponent },
  { path: 'settings', component: SettingsPageComponent }
];


