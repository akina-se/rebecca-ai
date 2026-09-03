import { Request, Response } from 'express';
import { SoliloquyUseCase } from './usecase';

/**
 * Controller for the Autonomous Soliloquy feature.
 * Adapts HTTP batch requests to the corresponding SoliloquyUseCase executions.
 */
export class SoliloquyController {
  constructor(private useCase: SoliloquyUseCase) {}

  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (e) {
      console.error('soliloquy error:', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
