import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { DASHBOARD_REPOSITORY } from './core/ports/dashboard.repository';
import { MockDashboardRepository } from './infrastructure/mock-api/mock-dashboard.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    { provide: DASHBOARD_REPOSITORY, useClass: MockDashboardRepository }
  ]
};
