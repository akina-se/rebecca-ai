import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpRequest, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, map, tap, filter } from 'rxjs';
import { AssetsRepository } from '../../core/ports/assets.repository';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the assets BFF backend.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpAssetsRepository implements AssetsRepository {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  /**
   * Retrieves assets, supporting pagination, search, and status filters.
   * 
   * @param params - The query parameters.
   * @returns Observable of paginated assets list.
   */
  getAll(params?: { page?: number; limit?: number; search?: string; status?: string; }): Observable<PaginatedResponse<Asset>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.search !== undefined && params.search.trim().length > 0) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      if (params.status !== undefined && params.status.trim().length > 0) {
        httpParams = httpParams.set('status', params.status.trim());
      }
    }
    return this.http.get<PaginatedResponse<Asset>>(`${this.baseUrl}/images`, { params: httpParams }).pipe(
      map((response: PaginatedResponse<Asset>) => ({
        ...response,
        data: (response.data || []).map((asset: Asset) => ({
          ...asset,
          status: this.mapStatus(asset.status)
        }))
      }))
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
   * Retrieves a single asset by ID.
   * 
   * @param id - The ID of the asset.
   * @returns Observable of Asset entity.
   */
  getById(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.baseUrl}/images/${id}`).pipe(
      map(asset => ({ ...asset, status: this.mapStatus(asset.status) }))
    );
  }

  /**
   * Uploads one or multiple image files to the server using multipart/form-data.
   * 
   * @param files - Single File or array of Files.
   * @param onProgress - Optional callback receiving upload progress percentage (0-100).
   * @returns Observable resolving when upload completes.
   */
  upload(files: File[] | File, onProgress?: (progress: number) => void): Observable<unknown> {
    const formData = new FormData();
    if (Array.isArray(files)) {
      for (const f of files) {
        formData.append('files', f, f.name);
      }
    } else {
      formData.append('files', files, files.name);
    }

    if (!onProgress) {
      return this.http.post<unknown>(`${this.baseUrl}/images`, formData);
    }

    const req = new HttpRequest('POST', `${this.baseUrl}/images`, formData, {
      reportProgress: true,
    });

    return this.http.request(req).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const percent = Math.round((100 * event.loaded) / event.total);
          onProgress(percent);
        } else if (event.type === HttpEventType.Response) {
          onProgress(100);
        }
      }),
      filter((event): event is HttpResponse<unknown> => event.type === HttpEventType.Response),
      map((res: HttpResponse<unknown>) => res.body)
    );
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
    if (ids.length === 1) {
      return this.http.delete<unknown>(`${this.baseUrl}/images/${ids[0]}`);
    }
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
