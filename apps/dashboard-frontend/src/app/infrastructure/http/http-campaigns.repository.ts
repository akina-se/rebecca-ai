import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CampaignsRepository } from '../../core/ports/campaigns.repository';
import {
  CampaignDocWithId,
  PaginatedResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CloneCampaignRequest,
  CampaignQueryParams,
  CampaignAssetUploadResult,
} from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Concrete HTTP implementation of CampaignsRepository communicating with dashboard-backend.
 */
@Injectable({
  providedIn: 'root',
})
export class HttpCampaignsRepository implements CampaignsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Retrieves paginated campaigns list with optional status filtering.
   */
  getAll(params?: CampaignQueryParams): Observable<PaginatedResponse<CampaignDocWithId>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page !== undefined) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit !== undefined) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.status && params.status.trim() !== '') {
        httpParams = httpParams.set('status', params.status.trim());
      }
    }
    return this.http.get<PaginatedResponse<CampaignDocWithId>>(`${this.baseUrl}/campaigns`, {
      params: httpParams,
    });
  }

  /**
   * Retrieves a single campaign document by ID.
   */
  getById(id: string): Observable<CampaignDocWithId> {
    return this.http.get<CampaignDocWithId>(`${this.baseUrl}/campaigns/${id}`);
  }

  /**
   * Creates a new narrative event campaign.
   */
  create(data: CreateCampaignRequest): Observable<CampaignDocWithId> {
    return this.http.post<CampaignDocWithId>(`${this.baseUrl}/campaigns`, data);
  }

  /**
   * Updates an existing campaign document.
   */
  update(id: string, updates: UpdateCampaignRequest): Observable<CampaignDocWithId> {
    return this.http.put<CampaignDocWithId>(`${this.baseUrl}/campaigns/${id}`, updates);
  }

  /**
   * Clones an existing campaign with reset slot status.
   */
  clone(id: string, newStartDate?: string, newEndDate?: string): Observable<CampaignDocWithId> {
    const payload: CloneCampaignRequest = {
      newStartDate,
      newEndDate,
    };
    return this.http.post<CampaignDocWithId>(`${this.baseUrl}/campaigns/${id}/clone`, payload);
  }

  /**
   * Immediately halts campaign execution (emergency kill switch).
   */
  pause(id: string): Observable<CampaignDocWithId> {
    return this.http.post<CampaignDocWithId>(`${this.baseUrl}/campaigns/${id}/pause`, {});
  }

  /**
   * Resumes a paused campaign.
   */
  resume(id: string): Observable<CampaignDocWithId> {
    return this.http.post<CampaignDocWithId>(`${this.baseUrl}/campaigns/${id}/resume`, {});
  }

  /**
   * Uploads an isolated campaign asset directly to GCS.
   */
  uploadAsset(campaignId: string, file: File): Observable<CampaignAssetUploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<CampaignAssetUploadResult>(
      `${this.baseUrl}/campaigns/${campaignId}/assets`,
      formData,
    );
  }

  /**
   * Deletes a campaign.
   */
  delete(id: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.baseUrl}/campaigns/${id}`);
  }
}
