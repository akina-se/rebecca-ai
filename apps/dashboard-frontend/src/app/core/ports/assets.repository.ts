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
  upload(file: File): Observable<any>;
  update(id: string, updates: Partial<Asset>): Observable<any>;
  deleteMany(ids: string[]): Observable<any>;
  regenerateCaptions(ids: string[]): Observable<any>;
}

export const ASSETS_REPOSITORY = new InjectionToken<AssetsRepository>('AssetsRepository');
