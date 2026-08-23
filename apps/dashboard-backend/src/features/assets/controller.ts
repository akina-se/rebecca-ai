import { Request, Response } from 'express';
import { AssetsUseCase, UploadedFile } from './usecase';

/**
 * Controller for handling asset-related HTTP requests.
 */
export class AssetsController {
  /**
   * Creates an instance of AssetsController.
   * 
   * @param useCase - The use case instance for managing assets.
   */
  constructor(private useCase: AssetsUseCase) {}

  /**
   * Retrieves paginated assets supporting search and status filtering.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await this.useCase.getPaginatedAssets({ page, limit, search, status });
      res.json(result);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  }

  /**
   * Retrieves a single asset by ID.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const asset = await this.useCase.getAssetById(id as string);
      if (!asset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      res.json(asset);
    } catch (err) {
      const safeId = String(req.params.id || '').replace(/[\r\n]/g, '');
      console.error('Failed to fetch asset %s:', safeId, err);
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  }

  /**
   * Streams the raw image binary for an asset with cache headers.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   */
  async getImage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sizeParam = req.query.size;
      const size: 'full' | 'thumbnail' = (sizeParam === 'thumbnail' || sizeParam === 'thumb') ? 'thumbnail' : 'full';
      const binary = await this.useCase.getAssetBinary(id as string, size);
      if (!binary) {
        res.status(404).send('Image not found');
        return;
      }
      res.setHeader('Content-Type', binary.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      res.send(binary.buffer);
    } catch (err) {
      const safeId = String(req.params.id || '').replace(/[\r\n]/g, '');
      console.error('Failed to stream image %s:', safeId, err);
      res.status(500).send('Failed to stream image');
    }
  }

  /**
   * Uploads one or multiple new assets to the system.
   * Supports multipart/form-data (via multer) and base64 JSON payload.
   * 
   * @param req - The Express Request object containing the uploaded file data.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the upload response is sent.
   */
  async upload(req: Request, res: Response): Promise<void> {
    try {
      const filesToProcess: UploadedFile[] = [];

      // 1. Check if files were uploaded via multipart/form-data (multer)
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const f of req.files as Express.Multer.File[]) {
          filesToProcess.push({
            originalname: f.originalname,
            mimetype: f.mimetype,
            buffer: f.buffer
          });
        }
      } else if (req.file) {
        const f = req.file as Express.Multer.File;
        filesToProcess.push({
          originalname: f.originalname,
          mimetype: f.mimetype,
          buffer: f.buffer
        });
      } else if (req.body?.files && Array.isArray(req.body.files)) {
        // 2. Check JSON payload with base64 data
        for (const item of req.body.files) {
          if (item.data && item.filename) {
            const buffer = Buffer.from(item.data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            filesToProcess.push({
              originalname: item.filename,
              mimetype: item.mimetype || 'image/png',
              buffer
            });
          }
        }
      }

      if (filesToProcess.length === 0) {
        res.status(400).json({ error: 'No files provided for upload' });
        return;
      }

      const createdAssets = await this.useCase.uploadImages(filesToProcess);
      res.status(201).json({
        success: true,
        count: createdAssets.length,
        data: createdAssets
      });
    } catch (err) {
      console.error('Failed to upload assets:', err);
      res.status(500).json({ error: 'Failed to upload assets' });
    }
  }

  /**
   * Updates an existing asset by ID.
   * 
   * @param req - The Express Request object containing the asset ID in params and updates in body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.useCase.updateAsset(id as string, req.body);
      res.json({ success: true });
    } catch (err) {
      const safeId = String(req.params.id || '').replace(/[\r\n]/g, '');
      console.error('Failed to update asset %s:', safeId, err);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  }

  /**
   * Deletes multiple assets by their IDs.
   * 
   * @param req - The Express Request object containing an array of asset IDs in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async deleteMany(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }
      await this.useCase.deleteAssets(ids);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete assets:', err);
      res.status(500).json({ error: 'Failed to delete assets' });
    }
  }

  /**
   * Regenerates captions for specified assets.
   * 
   * @param req - The Express Request object containing an array of asset IDs in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async regenerateCaptions(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }
      await this.useCase.regenerateCaptions(ids);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to regenerate captions:', err);
      res.status(500).json({ error: 'Failed to regenerate captions' });
    }
  }
}
