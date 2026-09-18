import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import {
  CampaignDoc,
  CampaignDocWithId,
  CampaignSlot,
  CampaignStatus,
  CampaignQueryParams,
  CreateCampaignRequest,
  PaginatedResponse,
  SlotTimePeriod,
  UpdateCampaignRequest,
} from '@rebecca/types';
import { CampaignsRepository } from './repository';
import { config } from '../../config';
import {
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
} from './errors';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  'draft',
  'scheduled',
  'active',
  'completed',
  'archived',
]);

export interface UploadedCampaignFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Maps a HH:mm string to SlotTimePeriod.
 */
export const getTimePeriodForHour = (timeStr: string): SlotTimePeriod => {
  if (!TIME_REGEX.test(timeStr)) {
    throw new CampaignValidationError(`Invalid time format "${timeStr}". Expected HH:mm.`);
  }
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
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
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
    throw new CampaignValidationError('Dates must be in YYYY-MM-DD format.');
  }
  if (startDate > endDate) {
    throw new CampaignValidationError('startDate cannot be after endDate.');
  }
  if (!Array.isArray(dailySlotTimes) || dailySlotTimes.length === 0) {
    throw new CampaignValidationError('dailySlotTimes must be a non-empty array of HH:mm strings.');
  }
  for (const t of dailySlotTimes) {
    if (!TIME_REGEX.test(t)) {
      throw new CampaignValidationError(`Invalid slot time "${t}". Expected HH:mm format.`);
    }
  }

  const slots: CampaignSlot[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  let dayNum = 1;
  const current = new Date(start);

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    for (const time of dailySlotTimes) {
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
   * Creates a new narrative event campaign with strict validation and automatic slot generation.
   *
   * @param data - Input campaign attributes.
   * @returns Created campaign entity.
   */
  async createCampaign(data: CreateCampaignRequest): Promise<CampaignDocWithId> {
    if (!data || typeof data !== 'object') {
      throw new CampaignValidationError('Campaign creation payload is required.');
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title) {
      throw new CampaignValidationError('Campaign title is required.');
    }

    const startDate = typeof data.startDate === 'string' ? data.startDate.trim() : '';
    const endDate = typeof data.endDate === 'string' ? data.endDate.trim() : '';
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      throw new CampaignValidationError('startDate and endDate must be valid dates in YYYY-MM-DD format.');
    }
    if (startDate > endDate) {
      throw new CampaignValidationError('startDate cannot be after endDate.');
    }

    if (!Array.isArray(data.dailySlotTimes) || data.dailySlotTimes.length === 0) {
      throw new CampaignValidationError('dailySlotTimes must be a non-empty array of HH:mm strings.');
    }
    for (const t of data.dailySlotTimes) {
      if (!TIME_REGEX.test(t)) {
        throw new CampaignValidationError(`Invalid slot time "${t}". Expected HH:mm format.`);
      }
    }

    if (!data.status || !VALID_CAMPAIGN_STATUSES.has(data.status)) {
      throw new CampaignValidationError(
        `Invalid campaign status "${data.status}". Allowed values: ${Array.from(VALID_CAMPAIGN_STATUSES).join(', ')}.`,
      );
    }

    const masterContext = typeof data.masterContext === 'string' ? data.masterContext.trim() : '';
    const replyContextSummary = typeof data.replyContextSummary === 'string' ? data.replyContextSummary.trim() : '';

    if (data.status === 'scheduled' || data.status === 'active') {
      if (!masterContext) {
        throw new CampaignValidationError('masterContext is required when scheduling or activating a campaign.');
      }
      if (!replyContextSummary) {
        throw new CampaignValidationError('replyContextSummary is required when scheduling or activating a campaign.');
      }
    }

    // Invariant: Reject overlapping active or scheduled campaigns
    const overlapping = await this.repo.findOverlapping(startDate, endDate);
    if (overlapping.length > 0) {
      throw new CampaignConflictError(
        `Campaign dates overlap with existing campaign: "${overlapping[0].title}" (${overlapping[0].startDate} to ${overlapping[0].endDate})`,
      );
    }

    // Generate slots if not supplied, or validate provided slots
    const slots: CampaignSlot[] = Array.isArray(data.slots) && data.slots.length > 0
      ? data.slots
      : generateSlotsForSchedule(startDate, endDate, data.dailySlotTimes);

    if ((data.status === 'scheduled' || data.status === 'active') && slots.length === 0) {
      throw new CampaignValidationError('A scheduled or active campaign must contain at least one slot.');
    }

    const id = `camp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    const campaignDoc: CampaignDoc = {
      title,
      description: typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined,
      status: data.status,
      isPaused: Boolean(data.isPaused),
      startDate,
      endDate,
      dailySlotTimes: data.dailySlotTimes,
      masterContext,
      replyContextSummary,
      slots,
      totalSlotsCount: slots.length,
      completedSlotsCount: slots.filter((s) => s.status === 'posted').length,
      isAnnualRecurring: Boolean(data.isAnnualRecurring),
      recurringApprovedYear: typeof data.recurringApprovedYear === 'number' ? data.recurringApprovedYear : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return this.repo.create(id, campaignDoc);
  }

  /**
   * Updates an existing campaign with date overlap validation and slot reconciliation.
   */
  async updateCampaign(id: string, updates: UpdateCampaignRequest): Promise<CampaignDocWithId> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new CampaignNotFoundError(`Campaign ${id} not found.`);
    }

    const startDate = updates.startDate ? updates.startDate.trim() : existing.startDate;
    const endDate = updates.endDate ? updates.endDate.trim() : existing.endDate;

    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      throw new CampaignValidationError('startDate and endDate must be valid dates in YYYY-MM-DD format.');
    }
    if (startDate > endDate) {
      throw new CampaignValidationError('startDate cannot be after endDate.');
    }

    // If dates changed, verify non-overlap with other campaigns
    if (startDate !== existing.startDate || endDate !== existing.endDate) {
      const overlapping = await this.repo.findOverlapping(startDate, endDate, id);
      if (overlapping.length > 0) {
        throw new CampaignConflictError(
          `Updated dates overlap with existing campaign: "${overlapping[0].title}" (${overlapping[0].startDate} to ${overlapping[0].endDate})`,
        );
      }
    }

    if (updates.dailySlotTimes !== undefined) {
      if (!Array.isArray(updates.dailySlotTimes) || updates.dailySlotTimes.length === 0) {
        throw new CampaignValidationError('dailySlotTimes must be a non-empty array of HH:mm strings.');
      }
      for (const t of updates.dailySlotTimes) {
        if (!TIME_REGEX.test(t)) {
          throw new CampaignValidationError(`Invalid slot time "${t}". Expected HH:mm format.`);
        }
      }
    }

    const targetStatus = updates.status || existing.status;
    if (!VALID_CAMPAIGN_STATUSES.has(targetStatus)) {
      throw new CampaignValidationError(`Invalid campaign status "${targetStatus}".`);
    }

    const masterContext = updates.masterContext !== undefined ? updates.masterContext.trim() : existing.masterContext;
    const replyContextSummary = updates.replyContextSummary !== undefined ? updates.replyContextSummary.trim() : existing.replyContextSummary;

    if (targetStatus === 'scheduled' || targetStatus === 'active') {
      if (!masterContext) {
        throw new CampaignValidationError('masterContext is required when scheduling or activating a campaign.');
      }
      if (!replyContextSummary) {
        throw new CampaignValidationError('replyContextSummary is required when scheduling or activating a campaign.');
      }
    }

    const slots = updates.slots !== undefined ? updates.slots : existing.slots;
    const totalSlotsCount = slots.length;
    const completedSlotsCount = slots.filter((s) => s.status === 'posted').length;

    const sanitizedUpdates: Partial<CampaignDoc> = {
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      startDate,
      endDate,
      masterContext,
      replyContextSummary,
      status: targetStatus,
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
      throw new CampaignNotFoundError(`Source campaign ${id} not found.`);
    }

    const startDate = newStartDate ? newStartDate.trim() : source.startDate;
    const endDate = newEndDate ? newEndDate.trim() : source.endDate;

    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      throw new CampaignValidationError('startDate and endDate must be in YYYY-MM-DD format.');
    }
    if (startDate > endDate) {
      throw new CampaignValidationError('startDate cannot be after endDate.');
    }

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
      throw new CampaignNotFoundError(`Campaign ${id} not found.`);
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
      throw new CampaignNotFoundError(`Campaign ${id} not found.`);
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
      throw new CampaignNotFoundError(`Campaign ${campaignId} not found.`);
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new CampaignValidationError('Only image uploads are permitted for campaign assets.');
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
      throw new CampaignNotFoundError(`Campaign ${id} not found.`);
    }
    await this.repo.delete(id);
  }
}
