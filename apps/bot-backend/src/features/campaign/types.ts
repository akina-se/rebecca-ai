import { SlotTimePeriod } from '@rebecca/types';

/**
 * Execution result of the /batch/campaign-post job.
 */
export interface CampaignPostResult {
  /** High-level execution status. */
  status: 'success' | 'no_active_campaign' | 'no_pending_slot' | 'skipped' | 'failed';
  /** ID of the campaign slot processed, if matched. */
  slotId?: string;
  /** Campaign day number (e.g. 1 for Day 1). */
  dayNumber?: number;
  /** Categorized slot period (morning, afternoon, evening, night). */
  timePeriod?: SlotTimePeriod;
  /** Created tweet ID on X if posted. */
  tweetId?: string;
  /** The generated or fixed text published to X. */
  post?: string;
  /** Whether an image illustration was attached. */
  attachedMedia?: boolean;
  /** Descriptive explanation for skipping, lack of active campaign, or failure. */
  reason?: string;
}
