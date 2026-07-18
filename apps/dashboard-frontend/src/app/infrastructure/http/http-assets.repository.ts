import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AssetsRepository } from '../../core/ports/assets.repository';
import { Asset, AssetStatus } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the assets BFF backend.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpAssetsRepository implements AssetsRepository {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1/dashboard';

  /**
   * Retrieves assets, supporting pagination, search, and status filters.
   * 
   * @param params - The query parameters.
   * @returns Observable of assets list.
   */
  getAll(params?: { limit?: number; startAfterId?: string; search?: string; status?: string; }): Observable<Asset[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.startAfterId !== undefined) httpParams = httpParams.set('startAfterId', params.startAfterId);
      if (params.search !== undefined) httpParams = httpParams.set('search', params.search);
      if (params.status !== undefined) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get<Asset[]>(`${this.baseUrl}/images`, { params: httpParams }).pipe(
      map(assets => assets.map(asset => ({
        ...asset,
        status: this.mapStatus(asset.status)
      })))
    );
  }

  /**
   * Helper to map status values to strictly-typed AssetStatus enum.
   * 
   * @param status - The raw status input.
   * @returns The resolved AssetStatus.
   */
  private mapStatus(status: unknown): AssetStatus {
    if (!status) return AssetStatus.PENDING;
    const s = String(status).toUpperCase();
    if (s === 'READY' || s === 'SUCCESS') return AssetStatus.SUCCESS;
    if (s === 'CAPTION FAILED' || s === 'FAILED') return AssetStatus.FAILED;
    if (s === 'PROCESSING') return AssetStatus.PROCESSING;
    return AssetStatus.PENDING;
  }

  /**
   * Uploads an image asset to the server.
   * 
   * @param file - The file to upload.
   * @returns Observable resolving when upload completes.
   */
  upload(file: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<unknown>(`${this.baseUrl}/images`, formData);
  }

  /**
   * Updates an existing asset with new property values.
   * 
   * @param id - The ID of the asset to update.
   * @param updates - The partial updates to apply.
   * @returns Observable resolving when update completes.
   */
  update(id: string, updates: Partial<Asset>): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/images/${id}`, updates);
  }

  /**
   * Deletes multiple assets by their IDs.
   * 
   * @param ids - The array of asset IDs to delete.
   * @returns Observable resolving when deletion completes.
   */
  deleteMany(ids: string[]): Observable<unknown> {
    return this.http.delete<unknown>(`${this.baseUrl}/images`, { body: { ids } });
  }

  /**
   * Triggers recaptioning for multiple assets.
   * 
   * @param ids - The array of asset IDs to regenerate captions for.
   * @returns Observable resolving when recaptioning starts.
   */
  regenerateCaptions(ids: string[]): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/images/regenerate-captions`, { ids });
  }
}
