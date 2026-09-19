import { Request, Response } from 'express';
import { ProactiveAnniversaryUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';
import { CampaignGuard } from '../campaign';

/**
 * Controller for the Proactive Anniversary feature.
 * Coordinates anniversary post batch job and falls back to SoliloquyUseCase when skipped.
 */
export class ProactiveAnniversaryController {
  /**
   * Initializes the ProactiveAnniversaryController.
   *
   * @param useCase The use case responsible for executing proactive anniversary posting.
   * @param soliloquyUseCase The fallback use case for when no anniversaries are available.
   * @param campaignGuard Optional campaign guard for evaluating narrative event suppression.
   */
  constructor(
    private useCase: ProactiveAnniversaryUseCase,
    private soliloquyUseCase: SoliloquyUseCase,
    private campaignGuard?: CampaignGuard,
  ) {}

  /**
   * Handles the HTTP request to trigger the proactive anniversary post batch job.
   *
   * @param req The Express Request object.
   * @param res The Express Response object.
   * @returns A Promise that resolves when the response is sent.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      if (this.campaignGuard) {
        const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
        if (suppression.shouldSuppress) {
          console.log(`[ProactiveAnniversaryController] Suppressed by active campaign "${suppression.campaign?.title}" (${suppression.campaign?.id})`);
          res.status(200).json({ status: 'suppressed_by_campaign', campaignId: suppression.campaign?.id });
          return;
        }
      }

      const result = await this.useCase.execute();
      if (result.status === 'skipped') {
        console.log(`[ProactiveAnniversaryController] Anniversary post skipped (${result.reason}). Executing alternate soliloquy post...`);
        const fallbackResult = await this.soliloquyUseCase.execute();
        res.status(200).json(fallbackResult);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('[ProactiveAnniversaryController] Batch execution failed:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
