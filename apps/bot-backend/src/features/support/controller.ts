/**
 * @fileoverview Controller for handling support post task HTTP requests from Cloud Tasks.
 *
 * Implements input validation, use case delegation, and HTTP response mapping.
 */

import { Request, Response } from 'express';
import { SupportTaskUseCase } from './usecase';
import { logger } from '../../utils/logger';

/**
 * Controller handling task execution requests triggered by Cloud Tasks workers.
 */
export class SupportTaskController {
  /**
   * Initializes a new instance of SupportTaskController.
   *
   * @param useCase - Injected instance of {@link SupportTaskUseCase}.
   */
  constructor(private readonly useCase: SupportTaskUseCase) {}

  /**
   * Handles incoming HTTP POST requests from Cloud Tasks to process a support appreciation post.
   *
   * @remarks
   * Always responds with HTTP 200 for handled outcomes (including failures captured by the use case)
   * so Cloud Tasks marks the task as delivered and avoids unintended retries.
   * Responds with HTTP 400 for malformed payloads, or HTTP 500 for unhandled infrastructure crashes.
   *
   * @param req - Express Request object containing {@link SupportTaskPayload} in `req.body`.
   * @param res - Express Response object.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.body;
      if (!transactionId || typeof transactionId !== 'string') {
        res.status(400).json({ error: 'Missing or invalid transactionId in payload' });
        return;
      }

      const result = await this.useCase.execute({ transactionId });
      res.status(200).json(result);
    } catch (error) {
      logger.error('[SupportTaskController] Uncaught error handling support task', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
