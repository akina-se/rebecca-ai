import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CampaignDoc, CampaignDocWithId, PaginatedResponse } from '@rebecca/types';

/**
 * Query parameters for campaigns list.
 */
export interface CampaignListParams {
  page?: number;
  limit?: number;
  status?: string;
}

/**
 * Asset upload result contract.
 */
export interface CampaignAssetUploadResult {
  url: string;
  filename: string;
}

/**
 * Port contract for campaigns backend interactions.
 */
export interface CampaignsRepository {
  /**
   * Retrieves paginated campaigns.
   */
  getAll(params?: CampaignListParams): Observable<PaginatedResponse<CampaignDocWithId>>;

  /**
   * Retrieves a single campaign by ID.
   */
  getById(id: string): Observable<CampaignDocWithId>;

  /**
   * Creates a new campaign.
   */
  create(data: Partial<CampaignDoc>): Observable<CampaignDocWithId>;

  /**
   * Updates an existing campaign.
   */
  update(id: string, updates: Partial<CampaignDoc>): Observable<CampaignDocWithId>;

  /**
   * Duplicates an existing campaign with reset slots.
   */
  clone(id: string, startDate?: string, endDate?: string): Observable<CampaignDocWithId>;

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
   * Deletes a campaign.
   */
  delete(id: string): Observable<unknown>;
}

export const CAMPAIGNS_REPOSITORY = new InjectionToken<CampaignsRepository>('CampaignsRepository');
