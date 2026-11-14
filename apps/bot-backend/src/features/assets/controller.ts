import { Request, Response } from 'express';
import { AssetEmbeddingsUseCase } from './usecase';
import { handleControllerError } from '../../utils/httpError';

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
      handleControllerError(res, e, '[AssetEmbeddingsController] Batch error');
    }
  };
}
