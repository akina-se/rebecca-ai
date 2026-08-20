import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Asset, PaginatedResponse } from '@rebecca/types';

export interface AssetsRepository {
  /**
   * Retrieves paginated assets with optional query parameters.
   * 
   * @param params - Optional query parameters including pagination and filtering.
   * @returns Observable of paginated asset response.
   */
  getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Observable<PaginatedResponse<Asset>>;

  /**
   * Retrieves a single asset by its unique identifier.
   * 
   * @param id - The asset ID.
   * @returns Observable of the asset entity.
   */
  getById(id: string): Observable<Asset>;

  /**
   * Uploads one or more image files using multipart/form-data.
   * 
   * @param files - Array of File objects or single File.
   * @returns Observable resolving with upload result.
   */
  upload(files: File[] | File): Observable<unknown>;

  /**
   * Updates an existing asset with partial changes.
   * 
   * @param id - The asset ID.
   * @param updates - Partial asset fields.
   * @returns Observable resolving when update is complete.
   */
  update(id: string, updates: Partial<Asset>): Observable<unknown>;

  /**
   * Deletes multiple assets by their IDs.
   * 
   * @param ids - Array of asset IDs to delete.
   * @returns Observable resolving when deletion is complete.
   */
  deleteMany(ids: string[]): Observable<unknown>;

  /**
   * Triggers AI caption and embedding regeneration for specified assets.
   * 
   * @param ids - Array of asset IDs.
   * @returns Observable resolving when regeneration is triggered.
   */
  regenerateCaptions(ids: string[]): Observable<unknown>;
}

export const ASSETS_REPOSITORY = new InjectionToken<AssetsRepository>('AssetsRepository');
