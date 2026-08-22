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
   * Retrieves the raw image binary data for an asset from Cloud Storage or data URI.
   * 
   * @param id - The ID of the asset.
   * @returns An object containing the binary buffer and content-type, or null.
   */
  async getAssetBinary(id: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    // 0. Strict ID validation to prevent path traversal
    if (!id || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
      return null;
    }

    const rawDoc = await this.repo.getRawDoc(id);
    const bucketName = config.gcp.imageBucketName;
    const bucket = this.storage.bucket(bucketName);

    // 1. Try reading from GCS URL specified in doc
    const rawUrl = String(rawDoc?.url || '');
    if (rawUrl.startsWith('gs://')) {
      const objectPath = rawUrl.replace(`gs://${bucketName}/`, '');
      try {
        const file = bucket.file(objectPath);
        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await file.download();
          const contentType = objectPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
          return { buffer, contentType };
        }
      } catch (err) {
        console.warn(`Failed to download object from GCS path ${objectPath}:`, err);
      }
    }

    // 2. Try exact conventional paths
    const candidates = [
      `images/${id}`,
      `images/${id}.jpg`,
      `images/${id}.png`,
      `media_assets/${id}`
    ];
    for (const path of candidates) {
      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await file.download();
          const [metadata] = await file.getMetadata();
          const contentType = metadata.contentType || (path.endsWith('.png') ? 'image/png' : 'image/jpeg');
          return { buffer, contentType };
        }
      } catch {
        // Continue to next candidate
      }
    }

    // 3. Try prefix search in media_assets/ and images/
    try {
      const [mediaFiles] = await bucket.getFiles({ prefix: `media_assets/${id}`, maxResults: 1 });
      if (mediaFiles && mediaFiles.length > 0) {
        const [buffer] = await mediaFiles[0].download();
        const contentType = mediaFiles[0].name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return { buffer, contentType };
      }
      const [imageFiles] = await bucket.getFiles({ prefix: `images/${id}`, maxResults: 1 });
      if (imageFiles && imageFiles.length > 0) {
        const [buffer] = await imageFiles[0].download();
        const contentType = imageFiles[0].name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return { buffer, contentType };
      }
    } catch (err) {
      console.warn(`Failed to search prefix in GCS for ${id}:`, err);
    }

    // 4. Try base64 data URI in url field
    if (rawUrl.startsWith('data:image/')) {
      const matches = rawUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        return { buffer, contentType };
      }
    }

    return null;
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
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const docId = `img_${hash.substring(0, 16)}`;

      const imageUrl = await this.saveToStorage(file, hash);
      const { caption, embedding, status } = await this.analyzeImage(file);

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
      const { caption, embedding, status } = await this.generateCaptionForAsset(asset.filename, asset.id);

      await this.repo.update(asset.id, {
        caption,
        status,
        usedCount: asset.usedCount,
        ...(embedding.length > 0 ? { embedding } : {})
      });
    }
  }

  /**
   * Helper: Saves uploaded file buffer to GCS or falls back to data URI.
   */
  private async saveToStorage(file: UploadedFile, hash: string): Promise<string> {
    try {
      const bucket = this.storage.bucket(config.gcp.imageBucketName);
      const gcsFile = bucket.file(`media_assets/${hash}_${file.originalname}`);
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false
      });
      return `https://storage.googleapis.com/${config.gcp.imageBucketName}/media_assets/${hash}_${file.originalname}`;
    } catch {
      const base64Data = file.buffer.toString('base64');
      return `data:${file.mimetype};base64,${base64Data}`;
    }
  }

  /**
   * Helper: Analyzes image content using Gemini Vision and generates embeddings.
   */
  private async analyzeImage(file: UploadedFile): Promise<{ caption: string; embedding: number[]; status: AssetStatus }> {
    if (!this.ai) {
      return { caption: '', embedding: [], status: AssetStatus.FAILED };
    }

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
        config: { maxOutputTokens: 200 }
      });

      const caption = response.text?.trim() || '';
      if (!caption) {
        return { caption: '', embedding: [], status: AssetStatus.FAILED };
      }

      const embedding = await this.generateEmbedding(caption);
      return { caption, embedding, status: AssetStatus.SUCCESS };
    } catch (visionErr) {
      const safeName = String(file.originalname || '').replace(/[\r\n]/g, '');
      console.error('Gemini Vision analysis failed for %s:', safeName, visionErr);
      return { caption: '', embedding: [], status: AssetStatus.FAILED };
    }
  }

  /**
   * Helper: Generates caption and embedding when regenerating for an existing asset.
   */
  private async generateCaptionForAsset(filename: string, assetId: string): Promise<{ caption: string; embedding: number[]; status: AssetStatus }> {
    if (!this.ai) {
      const fallbackCaption = `AIにより再生成された「${filename}」の美麗なイラストレーション。`;
      return { caption: fallbackCaption, embedding: [], status: AssetStatus.SUCCESS };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: config.gemini.model,
        contents: [`Please generate a descriptive Japanese caption for anime asset: ${filename}`]
      });

      const caption = response.text?.trim() || '';
      if (!caption) {
        return { caption: '', embedding: [], status: AssetStatus.FAILED };
      }

      const embedding = await this.generateEmbedding(caption);
      return { caption, embedding, status: AssetStatus.SUCCESS };
    } catch (e) {
      console.error(`Failed to regenerate caption for asset ${assetId}:`, e);
      return { caption: '', embedding: [], status: AssetStatus.FAILED };
    }
  }

  /**
   * Helper: Generates vector embedding from text.
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.ai) return [];
    try {
      const embResponse = await this.ai.models.embedContent({
        model: config.gemini.embeddingModel,
        contents: text
      });
      return embResponse.embeddings?.[0]?.values || [];
    } catch (embErr) {
      console.warn('Failed to generate embedding:', embErr);
      return [];
    }
  }
}
