import { Request, Response } from 'express';
import { CampaignPostUseCase } from './usecase';

/**
 * Controller for the Campaign Post batch feature.
 * Coordinates execution of slot-bound narrative event posts triggered by Cloud Scheduler.
 */
export class CampaignPostController {
  constructor(private readonly useCase: CampaignPostUseCase) {}

  /**
   * Handles the HTTP GET/POST request from Cloud Scheduler to trigger the campaign post batch.
   *
   * @param req - Express Request object.
   * @param res - Express Response object.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (error) {
      console.error('[CampaignPostController] Batch execution failed:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
