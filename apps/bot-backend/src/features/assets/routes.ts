import { Router } from 'express';
import { AssetEmbeddingsController } from './controller';

/**
 * Configures Express routes for the Asset Embeddings batch feature.
 *
 * @param controller - The AssetEmbeddingsController instance.
 * @returns Express Router configured with batch endpoints.
 */
export const createAssetEmbeddingsRouter = (controller: AssetEmbeddingsController): Router => {
  const router = Router();
  router.get('/', controller.handle);
  router.post('/', controller.handle);
  return router;
};
