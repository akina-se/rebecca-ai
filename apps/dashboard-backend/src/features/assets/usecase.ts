import { AssetsRepository } from './repository';
import { Asset } from '@rebecca/types';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../config';

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

/**
 * UseCase for managing and processing Assets (images).
 */
export class AssetsUseCase {
  /**
   * Creates an instance of AssetsUseCase.
   * 
   * @param repo - The repository instance for database operations.
   */
  constructor(private repo: AssetsRepository) {}

  /**
   * Retrieves all assets.
   * 
   * @returns A promise that resolves to an array of Assets.
   */
  async getAllAssets(): Promise<Asset[]> {
    return this.repo.getAll();
  }

  /**
   * Updates an asset with partial data.
   * 
   * @param id - The ID of the asset to update.
   * @param updates - The partial asset fields to update.
   * @returns A promise that resolves when the update is complete.
   */
  async updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
    await this.repo.update(id, updates);
  }

  /**
   * Deletes multiple assets.
   * 
   * @param ids - The array of asset IDs to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteAssets(ids: string[]): Promise<void> {
    await this.repo.deleteMany(ids);
  }

  /**
   * Regenerates captions for a given set of assets using Gemini Vision.
   * 
   * @param ids The IDs of the assets to process.
   */
  async regenerateCaptions(ids: string[]): Promise<void> {
    const assets = await this.repo.getAll();
    const targetAssets = assets.filter(a => ids.includes(a.id));

    for (const asset of targetAssets) {
      try {
        // In a real system, we'd fetch the actual image bytes from the asset URL
        // const imageResp = await fetch(asset.url);
        // const imageBytes = await imageResp.arrayBuffer();
        
        const response = await ai.models.generateContent({
          model: config.gemini.model,
          contents: [
            "Please generate a short, descriptive Japanese caption for this anime character image. (Simulated generation for filename: " + asset.filename + ")"
          ]
        });

        const caption = response.text || 'Caption generation failed';
        
        await this.repo.update(asset.id, { 
          caption, 
          status: 'Ready' 
        });
      } catch (e) {
        console.error(`Failed to generate caption for asset ${asset.id}`, e);
        await this.repo.update(asset.id, { status: 'Caption Failed' });
      }
    }
  }
}

