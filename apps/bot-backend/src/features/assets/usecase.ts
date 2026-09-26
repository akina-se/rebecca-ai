import { AppDependencies } from '../../types';
import { logger } from '../../utils/logger';

export interface AssetEmbeddingsResult {
  status: 'success' | 'failed';
  processed: number;
  failed: number;
  totalPending: number;
}

/**
 * UseCase for self-healing backfill of image asset embeddings.
 * Scans for assets with non-empty captions but missing embeddings,
 * generates embeddings via Gemini, and persists them as Firestore VectorValues.
 */
export class AssetEmbeddingsUseCase {
  constructor(private deps: AppDependencies) {}

  async execute(): Promise<AssetEmbeddingsResult> {
    logger.info('[AssetEmbeddingsUseCase] Starting asset embeddings backfill batch');
    try {
      const pendingAssets = await this.deps.firestore.getAssetsPendingEmbedding();
      logger.info('[AssetEmbeddingsUseCase] Found assets pending embeddings', { count: pendingAssets.length });

      if (pendingAssets.length === 0) {
        return { status: 'success', processed: 0, failed: 0, totalPending: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const asset of pendingAssets) {
        try {
          const embedding = await this.deps.gemini.generateEmbedding(asset.caption);
          if (embedding && embedding.length > 0) {
            await this.deps.firestore.updateAssetEmbedding(asset.id, embedding);
            processed++;
            logger.info('[AssetEmbeddingsUseCase] Successfully generated and saved embedding for asset', { assetId: asset.id });
          } else {
            failed++;
            logger.warn('[AssetEmbeddingsUseCase] Gemini returned empty embedding for asset', { assetId: asset.id });
          }
        } catch (err) {
          failed++;
          logger.error('[AssetEmbeddingsUseCase] Failed to generate embedding for asset', err, { assetId: asset.id });
        }

        // Throttle slightly between items to respect Gemini RPM limits
        if (pendingAssets.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      logger.info('[AssetEmbeddingsUseCase] Completed batch', {
        processed,
        failed,
        totalPending: pendingAssets.length,
      });
      return {
        status: 'success',
        processed,
        failed,
        totalPending: pendingAssets.length,
      };
    } catch (error) {
      logger.error('[AssetEmbeddingsUseCase] Error in asset embeddings backfill batch', error);
      throw error;
    }
  }
}
