import { Routes } from '@angular/router';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page.component';
import { MemoryPageComponent } from './features/memory/memory-page/memory-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'memory', component: MemoryPageComponent }
];
