import { Request, Response } from 'express';
import { SelfReflectionUseCase } from './usecase';
import { logger } from '../../utils/logger';

/**
 * Handles HTTP requests for the self-reflection batch process.
 */
export class SelfReflectionController {
  /**
   * Initializes the SelfReflectionController.
   *
   * @param useCase - The use case responsible for timeline summarization.
   */
  constructor(private readonly useCase: SelfReflectionUseCase) {}

  /**
   * Handles incoming GET or POST requests to run timeline self-reflection.
   */
  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (error) {
      logger.error('[SelfReflectionController] Execution failed', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error during self-reflection.',
      });
    }
  };
}
