import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DASHBOARD_REPOSITORY } from './core/ports/dashboard.repository';
import { MockDashboardRepository } from './infrastructure/mock-api/mock-dashboard.repository';
import { HttpDashboardRepository } from './infrastructure/http/http-dashboard.repository';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { 
      provide: DASHBOARD_REPOSITORY, 
      useClass: environment.useMock ? MockDashboardRepository : HttpDashboardRepository 
    }
  ]
};
