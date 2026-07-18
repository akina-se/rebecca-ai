import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DASHBOARD_REPOSITORY } from './core/ports/dashboard.repository';
import { MockDashboardRepository } from './infrastructure/mock-api/mock-dashboard.repository';
import { HttpDashboardRepository } from './infrastructure/http/http-dashboard.repository';

import { ASSETS_REPOSITORY } from './core/ports/assets.repository';
import { MockAssetsRepository } from './infrastructure/mock-api/mock-assets.repository';
import { HttpAssetsRepository } from './infrastructure/http/http-assets.repository';

import { USERS_REPOSITORY } from './core/ports/users.repository';
import { MockUsersRepository } from './infrastructure/mock-api/mock-users.repository';
import { HttpUsersRepository } from './infrastructure/http/http-users.repository';

import { MEMORY_REPOSITORY } from './core/ports/memory.repository';
import { MockMemoryRepository } from './infrastructure/mock-api/mock-memory.repository';
import { HttpMemoryRepository } from './infrastructure/http/http-memory.repository';

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
    },
    {
      provide: ASSETS_REPOSITORY,
      useClass: environment.useMock ? MockAssetsRepository : HttpAssetsRepository
    },
    {
      provide: USERS_REPOSITORY,
      useClass: environment.useMock ? MockUsersRepository : HttpUsersRepository
    },
    {
      provide: MEMORY_REPOSITORY,
      useClass: environment.useMock ? MockMemoryRepository : HttpMemoryRepository
    }
  ]
};
