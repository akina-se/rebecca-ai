import { Router } from 'express';
import { AssetEmbeddingsController } from './controller';
import { AssetEmbeddingsUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createAssetEmbeddingsRouter } from './routes';

export { AssetEmbeddingsUseCase, AssetEmbeddingsResult } from './usecase';
export { createAssetEmbeddingsRouter } from './routes';

/**
 * Creates and configures the router module for the Asset Embeddings batch feature.
 *
 * @param deps - The application dependencies.
 * @returns An Express Router instance.
 */
export const createAssetEmbeddingsModule = (deps: AppDependencies): Router => {
  const useCase = new AssetEmbeddingsUseCase(deps);
  const controller = new AssetEmbeddingsController(useCase);
  return createAssetEmbeddingsRouter(controller);
};
