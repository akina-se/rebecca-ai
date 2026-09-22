import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CampaignDocWithId,
  PaginatedResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignQueryParams,
  CampaignAssetUploadResult,
} from '@rebecca/types';

export type { CampaignQueryParams as CampaignListParams, CampaignAssetUploadResult };

/**
 * Port contract for campaigns backend interactions.
 */
export interface CampaignsRepository {
  /**
   * Retrieves paginated campaigns.
   */
  getAll(params?: CampaignQueryParams): Observable<PaginatedResponse<CampaignDocWithId>>;

  /**
   * Retrieves a single campaign by ID.
   */
  getById(id: string): Observable<CampaignDocWithId>;

  /**
   * Creates a new campaign.
   */
  create(data: CreateCampaignRequest): Observable<CampaignDocWithId>;

  /**
   * Updates an existing campaign.
   */
  update(id: string, updates: UpdateCampaignRequest): Observable<CampaignDocWithId>;

  /**
   * Duplicates an existing campaign with reset slots.
   */
  clone(id: string, newStartDate?: string, newEndDate?: string): Observable<CampaignDocWithId>;

  /**
   * Triggers emergency kill-switch pause.
   */
  pause(id: string): Observable<CampaignDocWithId>;

  /**
   * Resumes an emergency paused campaign.
   */
  resume(id: string): Observable<CampaignDocWithId>;

  /**
   * Uploads an isolated media asset for a campaign.
   */
  uploadAsset(campaignId: string, file: File): Observable<CampaignAssetUploadResult>;

  /**
   * Physically deletes an isolated media asset from a campaign.
   */
  deleteAsset(campaignId: string, filename: string): Observable<unknown>;

  /**
   * Deletes a campaign.
   */
  delete(id: string): Observable<unknown>;
}

export const CAMPAIGNS_REPOSITORY = new InjectionToken<CampaignsRepository>('CampaignsRepository');
