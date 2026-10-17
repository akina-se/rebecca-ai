/**
 * @fileoverview HTTP controller for the X Poll & Result Reaction feature.
 */

import { Request, Response } from 'express';
import { PollUseCase } from './usecase';
import { CampaignGuard } from '../campaign';
import { logger } from '../../utils/logger';

/**
 * Controller for the X Poll & Result Reaction feature.
 * Adapts HTTP batch requests to PollUseCase executions while respecting active campaign suppression.
 */
export class PollController {
  /**
   * @param useCase - Domain use case orchestrating poll creation and result reactions.
   * @param campaignGuard - Optional guard that suppresses routine posts while a narrative campaign is active.
   */
  constructor(
    private readonly useCase: PollUseCase,
    private readonly campaignGuard?: CampaignGuard,
  ) {}

  /**
   * Handles `/batch/poll/create` HTTP requests to generate and publish a new X poll.
   *
   * @param _req - Express HTTP request object.
   * @param res - Express HTTP response object.
   */
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

  /**
   * Handles `/batch/poll/result` HTTP requests to synchronize closed poll tallies and publish a quote post reaction.
   *
   * @param _req - Express HTTP request object.
   * @param res - Express HTTP response object.
   */
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
