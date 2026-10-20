/**
 * @fileoverview Controller for handling support post task HTTP requests from Cloud Tasks.
 */

import { Request, Response } from 'express';
import { SupportTaskUseCase } from './usecase';
import { logger } from '../../utils/logger';

export class SupportTaskController {
  constructor(private useCase: SupportTaskUseCase) {}

  /**
   * Handles the HTTP request for processing a support appreciation post task.
   *
   * @param req The Express Request object containing { transactionId } in the body.
   * @param res The Express Response object.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.body;
      if (!transactionId || typeof transactionId !== 'string') {
        res.status(400).json({ error: 'Missing or invalid transactionId in payload' });
        return;
      }

      const result = await this.useCase.execute({ transactionId });
      // Always return 200 OK so Cloud Tasks acknowledges handled failures
      res.status(200).json(result);
    } catch (error) {
      logger.error('[SupportTaskController] Uncaught error handling support task', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
