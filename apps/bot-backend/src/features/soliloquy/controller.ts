import { Request, Response } from 'express';
import { SoliloquyUseCase } from './usecase';
import { CampaignGuard } from '../campaign';
import { logger } from '../../utils/logger';

/**
 * Controller for the Autonomous Soliloquy feature.
 * Adapts HTTP batch requests to the corresponding SoliloquyUseCase executions.
 */
export class SoliloquyController {
  constructor(
    private useCase: SoliloquyUseCase,
    private campaignGuard?: CampaignGuard,
  ) {}

  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      if (this.campaignGuard) {
        const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
        if (suppression.shouldSuppress) {
          logger.info('[SoliloquyController] Suppressed by active campaign', {
            campaignTitle: suppression.campaign?.title,
            campaignId: suppression.campaign?.id,
          });
          res.status(200).json({ status: 'suppressed_by_campaign', campaignId: suppression.campaign?.id });
          return;
        }
      }

      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (e) {
      logger.error('soliloquy error', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
