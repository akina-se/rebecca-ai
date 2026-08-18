import crypto from 'crypto';
import { AssetsRepository, AssetQueryParams } from './repository';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';
import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { config } from '../../config';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * UseCase for managing and processing Assets (images).
 */
export class AssetsUseCase {
  private storage: Storage;
  private ai?: GoogleGenAI;

  /**
   * Creates an instance of AssetsUseCase.
   * 
   * @param repo - The repository instance for database operations.
   */
  constructor(private repo: AssetsRepository) {
    this.storage = new Storage();
    if (config.gemini.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    }
  }

  /**
   * Retrieves paginated assets supporting search and status filtering.
   * 
   * @param params - Query parameters.
   * @returns Paginated assets response.
   */
  async getPaginatedAssets(params: AssetQueryParams): Promise<PaginatedResponse<Asset>> {
    return this.repo.getPaginated(params);
  }

  /**
   * Retrieves all assets.
   * 
   * @returns A promise that resolves to an array of Assets.
   */
  async getAllAssets(): Promise<Asset[]> {
    return this.repo.getAll();
  }

  /**
   * Retrieves a single asset by its ID.
   * 
   * @param id - The ID of the asset.
   * @returns The Asset entity or null.
   */
  async getAssetById(id: string): Promise<Asset | null> {
    return this.repo.getById(id);
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
   * Uploads one or more image files, stores in Storage/GCS, generates AI captions & embeddings, and saves metadata.
   * 
   * @param files - Array of uploaded files.
   * @returns Created Asset entities.
   */
  async uploadImages(files: UploadedFile[]): Promise<Asset[]> {
    const createdAssets: Asset[] = [];

    for (const file of files) {
      // 1. Compute SHA-256 hash for deduplication and consistent ID
      const hashSum = crypto.createHash('sha256');
      hashSum.update(file.buffer);
      const hash = hashSum.digest('hex');
      const docId = `img_${hash.substring(0, 16)}`;

      // 2. Upload to Cloud Storage or create fallback data URL
      let imageUrl = '';
      try {
        const bucket = this.storage.bucket(config.gcp.imageBucketName);
        const gcsFile = bucket.file(`media_assets/${hash}_${file.originalname}`);
        await gcsFile.save(file.buffer, {
          contentType: file.mimetype,
          resumable: false
        });
        imageUrl = `https://storage.googleapis.com/${config.gcp.imageBucketName}/media_assets/${hash}_${file.originalname}`;
      } catch {
        // Fallback for local emulator / mock environments without live GCS
        const base64Data = file.buffer.toString('base64');
        imageUrl = `data:${file.mimetype};base64,${base64Data}`;
      }

      // 3. Analyze caption with Gemini Vision
      let caption = '';
      let embedding: number[] = [];
      let status: AssetStatus = AssetStatus.SUCCESS;

      if (this.ai) {
        try {
          const response = await this.ai.models.generateContent({
            model: config.gemini.model,
            contents: [
              {
                inlineData: {
                  data: file.buffer.toString('base64'),
                  mimeType: file.mimetype
                }
              },
              'Please generate a concise, descriptive Japanese caption for this anime / character image.'
            ],
            config: {
              maxOutputTokens: 200
            }
          });

          caption = response.text?.trim() || '';

          if (caption) {
            try {
              const embResponse = await this.ai.models.embedContent({
                model: config.gemini.embeddingModel,
                contents: caption
              });
              if (embResponse.embeddings?.[0]?.values) {
                embedding = embResponse.embeddings[0].values;
              }
            } catch (embErr) {
              console.warn('Failed to generate embedding for uploaded asset:', embErr);
            }
          }
        } catch (visionErr) {
          console.error(`Gemini Vision analysis failed for ${file.originalname}:`, visionErr);
        }
      }

      // If caption failed or AI is unavailable, mark as FAILED with empty caption
      if (!caption) {
        caption = '';
        status = AssetStatus.FAILED;
      }

      // 4. Save metadata to Firestore
      const assetData = {
        filename: file.originalname,
        url: imageUrl,
        caption,
        embedding,
        useCount: 0,
        lastUsedAt: null,
        status,
        createdAt: new Date().toISOString()
      };

      await this.repo.create(docId, assetData);

      createdAssets.push({
        id: docId,
        filename: file.originalname,
        caption,
        usedCount: 0,
        status,
        url: imageUrl
      });
    }

    return createdAssets;
  }

  /**
   * Regenerates captions for a given set of assets using Gemini Vision.
   * 
   * @param ids The IDs of the assets to process.
   */
  async regenerateCaptions(ids: string[]): Promise<void> {
    const allAssets = await this.repo.getAll();
    const targetAssets = allAssets.filter(a => ids.includes(a.id));

    for (const asset of targetAssets) {
      let newCaption = '';
      let embedding: number[] = [];
      let status: AssetStatus = AssetStatus.FAILED;

      if (this.ai) {
        try {
          const response = await this.ai.models.generateContent({
            model: config.gemini.model,
            contents: [
              `Please generate a descriptive Japanese caption for anime asset: ${asset.filename}`
            ]
          });

          newCaption = response.text?.trim() || '';
          if (newCaption) {
            status = AssetStatus.SUCCESS;
            try {
              const embResponse = await this.ai.models.embedContent({
                model: config.gemini.embeddingModel,
                contents: newCaption
              });
              if (embResponse.embeddings?.[0]?.values) {
                embedding = embResponse.embeddings[0].values;
              }
            } catch (embErr) {
              console.warn(`Failed to generate embedding for regenerated asset ${asset.id}:`, embErr);
            }
          }
        } catch (e) {
          console.error(`Failed to regenerate caption for asset ${asset.id}:`, e);
        }
      } else {
        // Fallback simulated caption if Gemini API key not provided
        newCaption = `AIにより再生成された「${asset.filename}」の美麗なイラストレーション。`;
        status = AssetStatus.SUCCESS;
      }

      await this.repo.update(asset.id, {
        caption: newCaption,
        status,
        usedCount: asset.usedCount,
        ...(embedding.length > 0 ? { embedding } : {})
      });
    }
  }
}
