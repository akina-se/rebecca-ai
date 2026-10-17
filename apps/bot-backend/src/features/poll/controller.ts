import { Request, Response } from 'express';
import { PollUseCase } from './usecase';
import { CampaignGuard } from '../campaign';
import { logger } from '../../utils/logger';

/**
 * Controller for the X Poll & Result Reaction feature.
 * Adapts HTTP batch requests to PollUseCase executions while respecting active campaign suppression.
 */
export class PollController {
  constructor(
    private readonly useCase: PollUseCase,
    private readonly campaignGuard?: CampaignGuard,
  ) {}

  handleCreate = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (this.campaignGuard) {
        const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
        if (suppression.shouldSuppress) {
          logger.info('[PollController] Poll creation suppressed by active campaign', {
            campaignTitle: suppression.campaign?.title,
            campaignId: suppression.campaign?.id,
          });
          res.status(200).json({
            status: 'suppressed_by_campaign',
            campaignId: suppression.campaign?.id,
          });
          return;
        }
      }

      const result = await this.useCase.executeCreatePoll();
      res.status(200).json(result);
    } catch (e) {
      logger.error('[PollController] Error in handleCreate', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  handleResult = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (this.campaignGuard) {
        const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
        if (suppression.shouldSuppress) {
          logger.info('[PollController] Poll result reaction suppressed by active campaign', {
            campaignTitle: suppression.campaign?.title,
            campaignId: suppression.campaign?.id,
          });
          res.status(200).json({
            status: 'suppressed_by_campaign',
            campaignId: suppression.campaign?.id,
          });
          return;
        }
      }

      const result = await this.useCase.executePollResult();
      res.status(200).json(result);
    } catch (e) {
      logger.error('[PollController] Error in handleResult', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
