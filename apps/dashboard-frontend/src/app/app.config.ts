import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DASHBOARD_REPOSITORY } from './core/ports/dashboard.repository';
import { HttpDashboardRepository } from './infrastructure/http/http-dashboard.repository';

import { ASSETS_REPOSITORY } from './core/ports/assets.repository';
import { HttpAssetsRepository } from './infrastructure/http/http-assets.repository';

import { USERS_REPOSITORY } from './core/ports/users.repository';
import { HttpUsersRepository } from './infrastructure/http/http-users.repository';

import { MEMORY_REPOSITORY } from './core/ports/memory.repository';
import { HttpMemoryRepository } from './infrastructure/http/http-memory.repository';

import { COPILOT_REPOSITORY } from './core/ports/copilot.repository';
import { HttpCopilotRepository } from './infrastructure/http/http-copilot.repository';

import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { 
      provide: DASHBOARD_REPOSITORY, 
      useClass: HttpDashboardRepository 
    },
    {
      provide: ASSETS_REPOSITORY,
      useClass: HttpAssetsRepository
    },
    {
      provide: USERS_REPOSITORY,
      useClass: HttpUsersRepository
    },
    {
      provide: MEMORY_REPOSITORY,
      useClass: HttpMemoryRepository
    },
    {
      provide: COPILOT_REPOSITORY,
      useClass: HttpCopilotRepository
    }
  ]
};

