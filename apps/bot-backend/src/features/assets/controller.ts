import { Request, Response } from 'express';
import { AssetEmbeddingsUseCase } from './usecase';

/**
 * Controller for the Asset Embeddings self-healing batch endpoint.
 */
export class AssetEmbeddingsController {
  constructor(private useCase: AssetEmbeddingsUseCase) {}

  handle = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.useCase.execute();
      res.status(200).json(result);
    } catch (e) {
      console.error('[AssetEmbeddingsController] Batch error:', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
