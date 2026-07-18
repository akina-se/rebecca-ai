import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AssetsRepository } from '../../core/ports/assets.repository';
import { Asset, AssetStatus } from '@rebecca/types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HttpAssetsRepository implements AssetsRepository {
  private http = inject(HttpClient);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:8081/api/v1/dashboard';

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

  private mapStatus(status: any): AssetStatus {
    if (!status) return AssetStatus.PENDING;
    const s = String(status).toUpperCase();
    if (s === 'READY' || s === 'SUCCESS') return AssetStatus.SUCCESS;
    if (s === 'CAPTION FAILED' || s === 'FAILED') return AssetStatus.FAILED;
    if (s === 'PROCESSING') return AssetStatus.PROCESSING;
    return AssetStatus.PENDING;
  }

  upload(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/images`, formData);
  }

  update(id: string, updates: Partial<Asset>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/images/${id}`, updates);
  }

  deleteMany(ids: string[]): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/images`, { body: { ids } });
  }

  regenerateCaptions(ids: string[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/images/regenerate-captions`, { ids });
  }
}
