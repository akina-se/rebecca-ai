import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import {
  CampaignDoc,
  CampaignDocWithId,
  CampaignSlot,
  PaginatedResponse,
  SlotTimePeriod,
} from '@rebecca/types';
import { CampaignsRepository, CampaignQueryParams } from './repository';
import { config } from '../../config';

export interface UploadedCampaignFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Maps a HH:mm string to SlotTimePeriod.
 */
export const getTimePeriodForHour = (timeStr: string): SlotTimePeriod => {
  const hour = parseInt(timeStr.split(':')[0], 10) || 0;
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'afternoon';
  if (hour >= 15 && hour < 19) return 'evening';
  return 'night';
};

/**
 * Generates an initial sequence of CampaignSlots for every day and slot time in the window.
 *
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @param dailySlotTimes - Array of HH:mm strings (e.g. ['08:00', '12:00', '19:00'])
 * @returns Array of initialized pending CampaignSlot objects.
 */
export const generateSlotsForSchedule = (
  startDate: string,
  endDate: string,
  dailySlotTimes: string[],
): CampaignSlot[] => {
  const slots: CampaignSlot[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return slots;
  }

  const times = dailySlotTimes.length > 0 ? dailySlotTimes : ['08:00', '12:00', '19:00'];

  let dayNum = 1;
  const current = new Date(start);

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    for (const time of times) {
      const period = getTimePeriodForHour(time);
      const cleanTime = time.replace(':', '');
      slots.push({
        slotId: `slot-${dayNum}-${cleanTime}`,
        dayNumber: dayNum,
        timePeriod: period,
        scheduledTime: `${dateStr}T${time}:00Z`,
        theme: `Day ${dayNum} ${period.charAt(0).toUpperCase() + period.slice(1)}`,
        status: 'pending',
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
    dayNum++;
  }

  return slots;
};

/**
 * Business logic layer for Campaign Narrative Event management.
 */
export class CampaignsUseCase {
  private storage: Storage;

  constructor(private readonly repo: CampaignsRepository) {
    this.storage = new Storage();
  }

  /**
   * Retrieves paginated campaigns.
   */
  async listCampaigns(params?: CampaignQueryParams): Promise<PaginatedResponse<CampaignDocWithId>> {
    return this.repo.getPaginated(params);
  }

  /**
   * Retrieves a campaign by ID.
   */
  async getCampaign(id: string): Promise<CampaignDocWithId | null> {
    return this.repo.getById(id);
  }

  /**
   * Creates a new narrative event campaign with date overlap validation and automatic slot generation.
   *
   * @param data - Input campaign attributes.
   * @returns Created campaign entity.
   */
  async createCampaign(data: Partial<CampaignDoc>): Promise<CampaignDocWithId> {
    const title = data.title?.trim();
    if (!title) {
      throw new Error('Campaign title is required.');
    }

    const startDate = data.startDate?.trim();
    const endDate = data.endDate?.trim();
    if (!startDate || !endDate) {
      throw new Error('Campaign startDate and endDate are required.');
    }

    if (startDate > endDate) {
      throw new Error('startDate cannot be after endDate.');
    }

    // Invariant: Reject overlapping active or scheduled campaigns
    const overlapping = await this.repo.findOverlapping(startDate, endDate);
    if (overlapping.length > 0) {
      throw new Error(
        `Campaign dates overlap with existing campaign: "${overlapping[0].title}" (${overlapping[0].startDate} to ${overlapping[0].endDate})`,
      );
    }

    const dailySlotTimes = Array.isArray(data.dailySlotTimes) && data.dailySlotTimes.length > 0
      ? data.dailySlotTimes
      : ['08:00', '12:00', '19:00'];

    // Generate slots if not supplied, or validate provided slots
    const slots: CampaignSlot[] = Array.isArray(data.slots) && data.slots.length > 0
      ? data.slots
      : generateSlotsForSchedule(startDate, endDate, dailySlotTimes);

    const id = `camp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    const campaignDoc: CampaignDoc = {
      title,
      description: data.description?.trim() || undefined,
      status: data.status || 'draft',
      isPaused: Boolean(data.isPaused),
      startDate,
      endDate,
      dailySlotTimes,
      masterContext: data.masterContext?.trim() || '',
      replyContextSummary: data.replyContextSummary?.trim() || '',
      slots,
      totalSlotsCount: slots.length,
      completedSlotsCount: slots.filter((s) => s.status === 'posted').length,
      isAnnualRecurring: Boolean(data.isAnnualRecurring),
      recurringApprovedYear: data.recurringApprovedYear,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return this.repo.create(id, campaignDoc);
  }

  /**
   * Updates an existing campaign with date overlap validation and slot reconciliation.
   */
  async updateCampaign(id: string, updates: Partial<CampaignDoc>): Promise<CampaignDocWithId> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new Error(`Campaign ${id} not found.`);
    }

    const startDate = updates.startDate ? updates.startDate.trim() : existing.startDate;
    const endDate = updates.endDate ? updates.endDate.trim() : existing.endDate;

    if (startDate > endDate) {
      throw new Error('startDate cannot be after endDate.');
    }

    // If dates changed, verify non-overlap with other campaigns
    if (startDate !== existing.startDate || endDate !== existing.endDate) {
      const overlapping = await this.repo.findOverlapping(startDate, endDate, id);
      if (overlapping.length > 0) {
        throw new Error(
          `Updated dates overlap with existing campaign: "${overlapping[0].title}" (${overlapping[0].startDate} to ${overlapping[0].endDate})`,
        );
      }
    }

    const slots = updates.slots !== undefined ? updates.slots : existing.slots;
    const totalSlotsCount = slots.length;
    const completedSlotsCount = slots.filter((s) => s.status === 'posted').length;

    const sanitizedUpdates: Partial<CampaignDoc> = {
      ...updates,
      startDate,
      endDate,
      slots,
      totalSlotsCount,
      completedSlotsCount,
      updatedAt: new Date().toISOString(),
    };

    return this.repo.update(id, sanitizedUpdates);
  }

  /**
   * Clones an existing campaign for a new iteration, resetting slot statuses to pending.
   */
  async cloneCampaign(
    id: string,
    newStartDate?: string,
    newEndDate?: string,
  ): Promise<CampaignDocWithId> {
    const source = await this.repo.getById(id);
    if (!source) {
      throw new Error(`Source campaign ${id} not found.`);
    }

    const startDate = newStartDate || source.startDate;
    const endDate = newEndDate || source.endDate;

    // Reset slots to pending and clear execution artifacts
    const clonedSlots: CampaignSlot[] = (source.slots || []).map((slot, index) => ({
      ...slot,
      slotId: `slot-${slot.dayNumber}-${slot.timePeriod}-${index + 1}`,
      status: 'pending',
      postedTweetId: undefined,
      postedAt: undefined,
      errorReason: undefined,
    }));

    const clonedTitle = `Copy of ${source.title}`;

    return this.createCampaign({
      title: clonedTitle,
      description: source.description,
      status: 'draft',
      isPaused: false,
      startDate,
      endDate,
      dailySlotTimes: source.dailySlotTimes,
      masterContext: source.masterContext,
      replyContextSummary: source.replyContextSummary,
      slots: clonedSlots,
      isAnnualRecurring: source.isAnnualRecurring,
    });
  }

  /**
   * Instantly pauses an active campaign (kill switch).
   */
  async pauseCampaign(id: string): Promise<CampaignDocWithId> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new Error(`Campaign ${id} not found.`);
    }
    return this.repo.update(id, {
      isPaused: true,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Resumes a paused campaign.
   */
  async resumeCampaign(id: string): Promise<CampaignDocWithId> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new Error(`Campaign ${id} not found.`);
    }
    return this.repo.update(id, {
      isPaused: false,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Uploads an isolated campaign illustration directly to GCS.
   * STRICT ASSET SEGREGATION: Stored under gs://<bucket>/campaigns/<campaignId>/...
   * and NEVER registered into collections.images.
   */
  async uploadCampaignAsset(
    campaignId: string,
    file: UploadedCampaignFile,
  ): Promise<{ url: string; filename: string }> {
    const campaign = await this.repo.getById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found.`);
    }

    const bucketName = config.gcp.imageBucketName;
    const bucket = this.storage.bucket(bucketName);

    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : 'jpg';
    const cleanFilename = `${Date.now()}_${crypto.randomUUID().slice(0, 6)}.${ext}`;
    const destination = `campaigns/${campaignId}/${cleanFilename}`;

    const gcsFile = bucket.file(destination);
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    return {
      url: publicUrl,
      filename: cleanFilename,
    };
  }

  /**
   * Deletes a campaign.
   */
  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.repo.getById(id);
    if (!campaign) {
      throw new Error(`Campaign ${id} not found.`);
    }
    await this.repo.delete(id);
  }
}
