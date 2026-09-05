import { AppDependencies } from '../../types';

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
    console.log('[AssetEmbeddingsUseCase] Starting asset embeddings backfill batch...');
    try {
      const pendingAssets = await this.deps.firestore.getAssetsPendingEmbedding();
      console.log(`[AssetEmbeddingsUseCase] Found ${pendingAssets.length} assets pending embeddings.`);

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
            console.log(`[AssetEmbeddingsUseCase] Successfully generated & saved embedding for asset ${asset.id}`);
          } else {
            failed++;
            console.warn(`[AssetEmbeddingsUseCase] Gemini returned empty embedding for asset ${asset.id}`);
          }
        } catch (err) {
          failed++;
          console.error(`[AssetEmbeddingsUseCase] Failed to generate embedding for asset ${asset.id}:`, err);
        }

        // Throttle slightly between items to respect Gemini RPM limits
        if (pendingAssets.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`[AssetEmbeddingsUseCase] Completed batch: ${processed} processed, ${failed} failed out of ${pendingAssets.length} total.`);
      return {
        status: 'success',
        processed,
        failed,
        totalPending: pendingAssets.length,
      };
    } catch (error) {
      console.error('[AssetEmbeddingsUseCase] Error in asset embeddings backfill batch:', error);
      throw error;
    }
  }
}
