import { Request, Response } from 'express';
import { CloneCampaignRequest } from '@rebecca/types';
import { CampaignsUseCase } from './usecase';

/**
 * Validates and extracts a required non-empty string ID from request params.
 * Throws an Error (mapped to HTTP 400) if missing or whitespace.
 */
const extractRequiredId = (param: unknown): string => {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('Valid campaign ID parameter is required.');
  }
  return raw.trim();
};

/**
 * Error response handler for CampaignsController.
 * Maps domain/validation errors to standard HTTP status codes,
 * and masks unexpected server errors to prevent internal system leakage.
 */
const handleControllerError = (res: Response, err: unknown, context: string): void => {
  const message = err instanceof Error ? err.message : String(err);

  if (message.toLowerCase().includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('overlap')) {
    res.status(409).json({ error: message });
    return;
  }

  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('cannot be') ||
    message.includes('Invalid') ||
    message.includes('Only image')
  ) {
    res.status(400).json({ error: message });
    return;
  }

  console.error(`[CampaignsController] ${context} unexpected server error:`, err);
  res.status(500).json({ error: 'Internal server error' });
};

/**
 * Controller handling HTTP requests for the Campaign Narrative Event feature.
 */
export class CampaignsController {
  constructor(private readonly useCase: CampaignsUseCase) {}

  /**
   * GET / - List campaigns with friendly query clamping and filtering.
   *
   * @param req - Express Request object containing optional query params (page, limit, status).
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10) || 1) : 1;
      const limit = req.query.limit ? Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 20)) : 20;

      const status = typeof req.query.status === 'string' && req.query.status.trim()
        ? req.query.status.trim()
        : undefined;

      const result = await this.useCase.listCampaigns({ page, limit, status });
      res.status(200).json(result);
    } catch (err: unknown) {
      handleControllerError(res, err, 'list');
    }
  };

  /**
   * GET /:id - Retrieve single campaign by ID.
   *
   * @param req - Express Request object containing ID path parameter.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const campaign = await this.useCase.getCampaign(id);
      if (!campaign) {
        res.status(404).json({ error: `Campaign not found with id: ${id}` });
        return;
      }
      res.status(200).json(campaign);
    } catch (err: unknown) {
      handleControllerError(res, err, 'getById');
    }
  };

  /**
   * POST / - Create a new campaign.
   *
   * @param req - Express Request object containing CreateCampaignRequest in body.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const created = await this.useCase.createCampaign(req.body);
      res.status(201).json(created);
    } catch (err: unknown) {
      handleControllerError(res, err, 'create');
    }
  };

  /**
   * PUT /:id - Update an existing campaign.
   *
   * @param req - Express Request object containing ID path param and UpdateCampaignRequest in body.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const updated = await this.useCase.updateCampaign(id, req.body);
      res.status(200).json(updated);
    } catch (err: unknown) {
      handleControllerError(res, err, 'update');
    }
  };

  /**
   * POST /:id/clone - Duplicate an existing campaign.
   *
   * @param req - Express Request object containing source ID path param and optional new dates in body.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  clone = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const { newStartDate, newEndDate }: CloneCampaignRequest = req.body || {};
      const cloned = await this.useCase.cloneCampaign(id, newStartDate, newEndDate);
      res.status(201).json(cloned);
    } catch (err: unknown) {
      handleControllerError(res, err, 'clone');
    }
  };

  /**
   * POST /:id/pause - Emergency kill switch pause.
   *
   * @param req - Express Request object containing campaign ID path param.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  pause = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const updated = await this.useCase.pauseCampaign(id);
      res.status(200).json(updated);
    } catch (err: unknown) {
      handleControllerError(res, err, 'pause');
    }
  };

  /**
   * POST /:id/resume - Resume a paused campaign.
   *
   * @param req - Express Request object containing campaign ID path param.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  resume = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const updated = await this.useCase.resumeCampaign(id);
      res.status(200).json(updated);
    } catch (err: unknown) {
      handleControllerError(res, err, 'resume');
    }
  };

  /**
   * POST /:id/assets - Isolated campaign illustration upload.
   *
   * @param req - Express Request object containing campaign ID path param and uploaded file.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  uploadAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No image file uploaded.' });
        return;
      }

      const result = await this.useCase.uploadCampaignAsset(id, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      handleControllerError(res, err, 'uploadAsset');
    }
  };

  /**
   * GET /:id/assets/:filename - Stream campaign illustration with on-demand thumbnail generation.
   *
   * @param req - Express Request object.
   * @param res - Express Response object.
   */
  getAssetImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const filename = req.params.filename;
      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'Filename parameter is required.' });
        return;
      }
      const size = req.query.size === 'thumbnail' ? 'thumbnail' : 'full';
      const binary = await this.useCase.getCampaignAssetBinary(id, filename, size);
      if (!binary) {
        res.status(404).json({ error: 'Campaign asset not found.' });
        return;
      }

      res.setHeader('Content-Type', binary.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(binary.buffer);
    } catch (err: unknown) {
      handleControllerError(res, err, 'getAssetImage');
    }
  };

  /**
   * DELETE /:id/assets/:filename - Physically delete campaign asset from GCS.
   *
   * @param req - Express Request object.
   * @param res - Express Response object.
   */
  deleteAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const filename = req.params.filename;
      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'Filename parameter is required.' });
        return;
      }

      await this.useCase.deleteCampaignAsset(id, filename);
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      handleControllerError(res, err, 'deleteAsset');
    }
  };

  /**
   * DELETE /:id - Delete campaign.
   *
   * @param req - Express Request object containing campaign ID path param.
   * @param res - Express Response object.
   * @returns A Promise resolving to void.
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      await this.useCase.deleteCampaign(id);
      res.status(200).json({ message: 'Campaign deleted successfully.' });
    } catch (err: unknown) {
      handleControllerError(res, err, 'delete');
    }
  };
}

