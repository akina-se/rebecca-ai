import { Request, Response } from 'express';
import { AssetsUseCase, UploadedFile } from './usecase';
import { logger } from '../../utils/logger';
import { handleControllerError } from '../../utils/httpError';

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
      handleControllerError(res, err, 'Failed to fetch assets');
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
      handleControllerError(res, err, 'Failed to fetch asset', { assetId: req.params.id });
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
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Vary', 'Authorization');
      res.send(binary.buffer);
    } catch (err) {
      logger.error('Failed to stream image', err, { assetId: req.params.id });
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
        const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        for (const item of req.body.files.slice(0, 20)) {
          if (item.data && item.filename) {
            const mime = item.mimetype || 'image/png';
            if (!allowedMimes.has(mime)) {
              res.status(400).json({ error: 'Unsupported image MIME type. Allowed: JPEG, PNG, WebP, GIF.' });
              return;
            }
            const buffer = Buffer.from(String(item.data).replace(/^data:image\/\w+;base64,/, ''), 'base64');
            if (buffer.length > 15 * 1024 * 1024) {
              res.status(400).json({ error: 'Image size exceeds 15MB limit' });
              return;
            }
            filesToProcess.push({
              originalname: String(item.filename),
              mimetype: mime,
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
      handleControllerError(res, err, 'Failed to upload assets');
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
      handleControllerError(res, err, 'Failed to update asset', { assetId: req.params.id });
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
      let ids: string[] = [];
      if (Array.isArray(req.body?.ids)) {
        ids = req.body.ids;
      } else if (req.params && req.params['id']) {
        ids = [String(req.params['id'])];
      } else if (typeof req.query?.['ids'] === 'string') {
        ids = req.query['ids'].split(',').map(s => s.trim()).filter(Boolean);
      } else if (typeof req.query?.['id'] === 'string') {
        ids = [req.query['id']];
      }

      if (ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }
      await this.useCase.deleteAssets(ids);
      res.json({ success: true });
    } catch (err) {
      handleControllerError(res, err, 'Failed to delete assets');
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
    } catch (err: unknown) {
      handleControllerError(res, err, 'Failed to regenerate captions');
    }
  }
}
