import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Asset } from '@rebecca/types';

export interface AssetsRepository {
  getAll(params?: {
    limit?: number;
    startAfterId?: string;
    search?: string;
    status?: string;
  }): Observable<Asset[]>;
  upload(file: File): Observable<unknown>;
  update(id: string, updates: Partial<Asset>): Observable<unknown>;
  deleteMany(ids: string[]): Observable<unknown>;
  regenerateCaptions(ids: string[]): Observable<unknown>;
}

export const ASSETS_REPOSITORY = new InjectionToken<AssetsRepository>('AssetsRepository');
