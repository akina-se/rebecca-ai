import { Request, Response } from 'express';
import { ProactiveAnniversaryUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';

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
   */
  constructor(
    private useCase: ProactiveAnniversaryUseCase,
    private soliloquyUseCase: SoliloquyUseCase,
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
      const result = await this.useCase.execute();
      if (result.status === 'skipped') {
        console.log(`[ProactiveAnniversaryController] Anniversary post skipped (${result.reason}). Executing soliloquy fallback...`);
        const fallbackResult = await this.soliloquyUseCase.execute();
        res.status(200).json(fallbackResult);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('[ProactiveAnniversaryController] Batch error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
