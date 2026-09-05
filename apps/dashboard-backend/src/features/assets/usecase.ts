import crypto from 'crypto';
import sharp from 'sharp';
import { AssetsRepository, AssetQueryParams } from './repository';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';
import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { FieldValue } from '@google-cloud/firestore';
import { config } from '../../config';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * In-memory LRU Cache for high-frequency thumbnail streaming.
 */
class ThumbnailMemoryCache {
  private cache = new Map<string, { buffer: Buffer; contentType: string }>();
  constructor(private max = 200) {}

  get(key: string) {
    const val = this.cache.get(key);
    if (val) {
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: string, val: { buffer: Buffer; contentType: string }) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, val);
  }
}

/**
 * UseCase for managing and processing Assets (images).
 */
export class AssetsUseCase {
  private storage: Storage;
  private ai?: GoogleGenAI;
  private thumbnailMemoryCache = new ThumbnailMemoryCache(200);

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
   * Retrieves the image binary data for an asset.
   * Supports on-demand compressed WebP thumbnail generation and multi-tier caching (RAM -> GCS -> On-demand).
   * 
   * @param id - The ID of the asset.
   * @param size - 'full' for original high-resolution or 'thumbnail' for compressed 400px WebP.
   * @returns An object containing the binary buffer and content-type, or null.
   */
  async getAssetBinary(id: string, size: 'full' | 'thumbnail' = 'full'): Promise<{ buffer: Buffer; contentType: string } | null> {
    // 0. Strict ID validation to prevent path traversal
    if (!id || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
      return null;
    }

    const cleanId = id.replace(/^img_/, '');
    const bucketName = config.gcp.imageBucketName;
    const bucket = this.storage.bucket(bucketName);

    // 1. If thumbnail is requested:
    if (size === 'thumbnail') {
      // Tier 1: In-memory RAM cache (sub-1ms)
      const memoryHit = this.thumbnailMemoryCache.get(cleanId);
      if (memoryHit) {
        return memoryHit;
      }

      // Tier 2: Pre-cached GCS thumbnail
      const cachedThumbnailPaths = cleanId === id ? [`thumbnails/${cleanId}.webp`] : [`thumbnails/${cleanId}.webp`, `thumbnails/${id}.webp`];
      for (const thumbPath of cachedThumbnailPaths) {
        try {
          const file = bucket.file(thumbPath);
          const [buffer] = await file.download();
          const result = { buffer, contentType: 'image/webp' };
          this.thumbnailMemoryCache.set(cleanId, result);
          return result;
        } catch {
          // GCS 404 or read error, proceed
        }
      }
    }

    // 2. Retrieve original full binary
    const original = await this.getOriginalAssetBinary(id);
    if (!original) {
      return null;
    }

    // 3. If thumbnail requested and not pre-cached, generate compressed WebP via sharp
    if (size === 'thumbnail') {
      try {
        const thumbnailBuffer = await sharp(original.buffer)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        const result = { buffer: thumbnailBuffer, contentType: 'image/webp' };
        this.thumbnailMemoryCache.set(cleanId, result);

        // Asynchronously save to GCS cache for subsequent instant loads
        const cachePath = `thumbnails/${cleanId}.webp`;
        bucket.file(cachePath).save(thumbnailBuffer, {
          metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }
        }).catch(err => {
          console.warn(`Failed to cache thumbnail ${cachePath} in GCS:`, err);
        });

        return result;
      } catch (err) {
        console.warn(`Failed to generate thumbnail for ${id}, falling back to original:`, err);
        return original;
      }
    }

    return original;
  }

  /**
   * Internal helper to fetch original binary data from GCS or data URI.
   * 
   * @param id - The ID of the asset.
   * @returns Binary buffer and content type, or null.
   */
  private async getOriginalAssetBinary(id: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const rawDoc = await this.repo.getRawDoc(id);
    const bucketName = config.gcp.imageBucketName;
    const bucket = this.storage.bucket(bucketName);

    // 1. Try reading from GCS URL specified in doc (gs://...)
    const rawUrl = String(rawDoc?.url || '');
    let objectPathFromUrl = '';
    if (rawUrl.startsWith('gs://')) {
      objectPathFromUrl = rawUrl.replace(`gs://${bucketName}/`, '').replace(/^gs:\/\/[^/]+\//, '');
    }

    if (objectPathFromUrl) {
      try {
        const file = bucket.file(objectPathFromUrl);
        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await file.download();
          let contentType = objectPathFromUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          if (typeof file.getMetadata === 'function') {
            try {
              const [metadata] = await file.getMetadata();
              if (metadata?.contentType) contentType = metadata.contentType;
            } catch {
              // ignore metadata error
            }
          }
          return { buffer, contentType };
        }
      } catch (err) {
        console.warn(`Failed to download object from GCS path ${objectPathFromUrl}:`, err);
      }
    }

    // 2. Try clean ID (stripped of 'img_' prefix if present)
    const cleanId = id.replace(/^img_/, '');

    // 3. Try exact conventional paths
    const candidates = [
      `images/${id}`,
      `images/${id}.jpg`,
      `images/${id}.png`,
      `images/${cleanId}`,
      `images/${cleanId}.jpg`,
      `images/${cleanId}.png`,
      `media_assets/${id}`,
      `media_assets/${id}.jpg`,
      `media_assets/${id}.png`,
      `media_assets/${cleanId}`,
      `media_assets/${cleanId}.jpg`,
      `media_assets/${cleanId}.png`,
      id,
      cleanId
    ];
    for (const path of candidates) {
      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await file.download();
          let contentType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          if (typeof file.getMetadata === 'function') {
            try {
              const [metadata] = await file.getMetadata();
              if (metadata?.contentType) contentType = metadata.contentType;
            } catch {
              // ignore metadata error
            }
          }
          return { buffer, contentType };
        }
      } catch {
        // Continue to next candidate
      }
    }

    // 4. Try prefix search in media_assets/ and images/
    try {
      for (const prefix of [`media_assets/${cleanId}`, `images/${cleanId}`, `media_assets/${id}`, `images/${id}`]) {
        const [files] = await bucket.getFiles({ prefix, maxResults: 1 });
        if (files && files.length > 0) {
          const file = files[0];
          const [buffer] = await file.download();
          let contentType = file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          if (typeof file.getMetadata === 'function') {
            try {
              const [metadata] = await file.getMetadata();
              if (metadata?.contentType) contentType = metadata.contentType;
            } catch {
              // ignore metadata error
            }
          }
          return { buffer, contentType };
        }
      }
    } catch (err) {
      console.warn(`Failed to search prefix in GCS for ${id}:`, err);
    }

    // 5. Try base64 data URI in url field
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
   * If caption is being updated, attempts to synchronously generate a new embedding.
   * On failure, removes the stale embedding using FieldValue.delete() to avoid semantic mismatch,
   * while preserving the updated caption and marking status as FAILED.
   * 
   * @param id - The ID of the asset to update.
   * @param updates - The partial asset fields to update.
   * @returns A promise that resolves when the update is complete.
   */
  async updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
    const repoUpdates: Parameters<AssetsRepository['update']>[1] = { ...updates };

    if (typeof updates.caption === 'string') {
      const trimmedCaption = updates.caption.trim();
      if (trimmedCaption.length > 0) {
        try {
          const emb = await this.generateEmbedding(trimmedCaption);
          if (emb && emb.length > 0) {
            repoUpdates.embedding = emb;
            if (updates.status === undefined) {
              repoUpdates.status = AssetStatus.SUCCESS;
            }
          } else {
            repoUpdates.embedding = FieldValue.delete();
            repoUpdates.status = AssetStatus.FAILED;
          }
        } catch (err) {
          console.error(`Failed to generate embedding during updateAsset for ${id}:`, err);
          repoUpdates.embedding = FieldValue.delete();
          repoUpdates.status = AssetStatus.FAILED;
        }
      } else {
        repoUpdates.embedding = FieldValue.delete();
        if (updates.status === undefined) {
          repoUpdates.status = AssetStatus.FAILED;
        }
      }
    }

    await this.repo.update(id, repoUpdates);
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
      const now = new Date().toISOString();

      const assetData: Record<string, unknown> = {
        filename: file.originalname,
        url: imageUrl,
        caption,
        useCount: 0,
        lastUsedAt: null,
        status,
        createdAt: now
      };

      if (embedding && embedding.length > 0) {
        assetData.embedding = embedding;
      }

      await this.repo.create(docId, assetData);

      createdAssets.push({
        id: docId,
        filename: file.originalname,
        caption,
        useCount: 0,
        status,
        url: imageUrl,
        createdAt: now
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

      const updates: Parameters<AssetsRepository['update']>[1] = {
        caption,
        status,
      };

      if (embedding && embedding.length > 0) {
        updates.embedding = embedding;
      } else {
        updates.embedding = FieldValue.delete();
      }

      await this.repo.update(asset.id, updates);
    }
  }

  /**
   * Helper: Saves uploaded file buffer to GCS or falls back to data URI.
   */
  private async saveToStorage(file: UploadedFile, hash: string): Promise<string> {
    const bucketName = config.gcp.imageBucketName;
    try {
      const bucket = this.storage.bucket(bucketName);
      const gcsFile = bucket.file(`media_assets/${hash}_${file.originalname}`);
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false
      });
      return `gs://${bucketName}/media_assets/${hash}_${file.originalname}`;
    } catch {
      const base64Data = file.buffer.toString('base64');
      return `data:${file.mimetype};base64,${base64Data}`;
    }
  }

  /**
   * Standardized prompt matching bot-backend image ingestion logic for high-quality vector search.
   */
  private static readonly CAPTION_PROMPT =
    'この画像に写っている状況、被写体の表情、および感情を説明するテキスト（キャプション）を生成してください。' +
    'ベクトル検索のクエリとして使用するため、具体的なキーワード（場所、服装、髪型、表情、時間帯、天候、シチュエーション）を豊富に含めた自然な日本語にしてください。' +
    '途中で途切れないように、必ず完全な文章（句点で終わる）で出力してください。';

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
          AssetsUseCase.CAPTION_PROMPT
        ],
        config: { maxOutputTokens: 300 }
      });

      const caption = response.text?.trim() || '';
      if (!caption) {
        return { caption: '', embedding: [], status: AssetStatus.FAILED };
      }

      const embedding = await this.generateEmbedding(caption);
      const status = embedding.length > 0 ? AssetStatus.SUCCESS : AssetStatus.FAILED;
      return { caption, embedding, status };
    } catch (visionErr) {
      const safeName = String(file.originalname || '').replace(/[\r\n]/g, '');
      console.error('Gemini Vision analysis failed for %s:', safeName, visionErr);
      return { caption: '', embedding: [], status: AssetStatus.FAILED };
    }
  }

  /**
   * Helper: Generates caption and embedding when regenerating for an existing asset using Gemini Vision.
   */
  private async generateCaptionForAsset(filename: string, assetId: string): Promise<{ caption: string; embedding: number[]; status: AssetStatus }> {
    if (!this.ai || !config.gemini.apiKey) {
      const fallbackCaption = `AIにより再生成された「${filename}」の美麗なイラストレーション。`;
      return { caption: fallbackCaption, embedding: [], status: AssetStatus.FAILED };
    }

    try {
      // 1. Fetch original image binary from GCS / Storage to perform true Gemini Vision analysis
      const imageBinary = await this.getAssetBinary(assetId, 'full');

      const contents = imageBinary && imageBinary.buffer && imageBinary.buffer.length > 0
        ? [
            {
              inlineData: {
                data: imageBinary.buffer.toString('base64'),
                mimeType: imageBinary.contentType || 'image/jpeg'
              }
            },
            AssetsUseCase.CAPTION_PROMPT
          ]
        : [
            `このアニメ画像アセット（ファイル名: ${filename}）の状況や被写体を説明する日本語のキャプション文を生成してください。` +
            '解説や前置きは含めず、具体的なキーワード（シチュエーション、服装、表情等）を含むキャプション本文のみを句点で終わる完全な文章として出力してください。'
          ];

      const response = await this.ai.models.generateContent({
        model: config.gemini.model,
        contents,
        config: { maxOutputTokens: 300 }
      });

      const caption = response.text?.trim() || '';
      if (!caption) {
        const fallbackCaption = `AIにより再生成された「${filename}」の美麗なイラストレーション。`;
        return { caption: fallbackCaption, embedding: [], status: AssetStatus.FAILED };
      }

      const embedding = await this.generateEmbedding(caption);
      const status = embedding.length > 0 ? AssetStatus.SUCCESS : AssetStatus.FAILED;
      return { caption, embedding, status };
    } catch (e) {
      console.warn(`Gemini Vision regenerate caption error for asset ${assetId}, using fallback:`, e);
      const fallbackCaption = `AIにより再生成された「${filename}」の美麗なイラストレーション。`;
      return { caption: fallbackCaption, embedding: [], status: AssetStatus.FAILED };
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
        contents: text,
        config: { outputDimensionality: 768 }
      });
      return embResponse.embeddings?.[0]?.values || [];
    } catch (embErr) {
      console.warn('Failed to generate embedding:', embErr);
      return [];
    }
  }
}
