import { IFirestoreService } from '../../types';
import { CampaignDoc } from '@rebecca/types';

/**
 * Result returned by the CampaignGuard evaluation.
 */
export interface CampaignGuardResult {
  /** Whether routine proactive posts should be suppressed. */
  shouldSuppress: boolean;
  /** The active campaign triggering suppression, if any. */
  campaign?: CampaignDoc;
}

/**
 * CampaignGuard evaluates whether an active narrative event campaign should suppress
 * routine proactive batch posts (News, Soliloquy, Anniversary, Random Engagement).
 *
 * FAIL-LOUDLY DESIGN:
 * If an error occurs while querying Firestore, it is intentionally allowed to re-raise
 * so that Cloud Scheduler and Cloud Tasks can retry the job rather than silently falling back.
 */
export class CampaignGuard {
  constructor(private readonly firestore: IFirestoreService) {}

  /**
   * Evaluates if routine posts should be suppressed.
   *
   * @returns An object with `shouldSuppress: boolean` and optionally the active `campaign`.
   */
  async shouldSuppressRoutinePost(): Promise<CampaignGuardResult> {
    const activeCampaign = await this.firestore.getActiveCampaign();
    if (activeCampaign && !activeCampaign.isPaused) {
      return {
        shouldSuppress: true,
        campaign: activeCampaign,
      };
    }
    return {
      shouldSuppress: false,
    };
  }
}
