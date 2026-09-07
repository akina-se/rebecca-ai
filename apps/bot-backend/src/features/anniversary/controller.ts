import { Request, Response } from 'express';
import { ProactiveAnniversaryUseCase } from './usecase';

/**
 * Controller for the Proactive Anniversary feature.
 * Adapts HTTP requests to the corresponding UseCase executions.
 */
export class ProactiveAnniversaryController {
  /**
   * Initializes the ProactiveAnniversaryController.
   *
   * @param useCase The use case responsible for executing proactive anniversary posting.
   */
  constructor(private useCase: ProactiveAnniversaryUseCase) {}

  /**
   * Handles the HTTP request to trigger the proactive anniversary post batch job.
   *
   * @param req The Express Request object.
   * @param res The Express Response object.
   * @returns A Promise that resolves when the response is sent.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (error) {
      console.error('[ProactiveAnniversaryController] Batch error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
