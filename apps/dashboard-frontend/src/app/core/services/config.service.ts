import { Injectable, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RuntimeConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  apiUrl: string;
  publicSiteUrl: string;
  production: boolean;
  useEmulators: boolean;
}

/**
 * Service responsible for asynchronously loading runtime application configurations
 * from the backend `/api/v1/config` endpoint during application bootstrap.
 * 
 * Adheres to the 12-Factor App methodology by keeping client build artifacts environment-agnostic
 * and loading configurations dynamically at runtime without hardcoded keys in source code.
 */
@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private config: RuntimeConfig | null = null;
  readonly publicSiteUrl = signal<string>('https://rebecca-ai.net');

  constructor(private httpBackend: HttpBackend) {}

  /**
   * Asynchronously fetches the runtime configuration before the Angular application bootstraps.
   * Uses HttpBackend directly to bypass interceptors during the initialization phase.
   */
  async loadAppConfig(): Promise<void> {
    const http = new HttpClient(this.httpBackend);
    try {
      const data = await firstValueFrom(http.get<RuntimeConfig>('/api/v1/config'));
      if (data) {
        this.config = data;
        if (data.publicSiteUrl) {
          this.publicSiteUrl.set(data.publicSiteUrl);
        }
      }
    } catch (err) {
      console.warn('Could not load runtime /api/v1/config, falling back to local environment defaults:', err);
      this.config = {
        firebase: environment.firebase,
        apiUrl: environment.apiUrl,
        publicSiteUrl: 'https://rebecca-ai.net',
        production: environment.production,
        useEmulators: (environment as Record<string, unknown>)['useEmulators'] as boolean || false,
      };
      this.publicSiteUrl.set('https://rebecca-ai.net');
    }
  }

  get runtimeConfig(): RuntimeConfig | null {
    return this.config;
  }

  get firebaseConfig() {
    return this.config?.firebase || environment.firebase;
  }

  get apiUrl(): string {
    return this.config?.apiUrl || environment.apiUrl;
  }

  get isEmulator(): boolean {
    return this.config?.useEmulators ?? false;
  }
}
