import { Request, Response } from 'express';
import { CampaignsUseCase } from './usecase';
import {
  CampaignError,
  CampaignNotFoundError,
  CampaignValidationError,
} from './errors';

/**
 * Validates and extracts a required non-empty string ID from request params.
 * Throws CampaignValidationError (HTTP 400) if missing or whitespace, avoiding silent empty string fallbacks.
 */
const extractRequiredId = (param: unknown): string => {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new CampaignValidationError('Valid campaign ID parameter is required.');
  }
  return raw.trim();
};

/**
 * Unified error response handler for CampaignsController.
 * Maps typed domain errors to corresponding HTTP status codes and structured codes,
 * and securely masks unexpected 500 errors to prevent internal system leakage.
 */
const handleControllerError = (res: Response, err: unknown, context: string): void => {
  if (err instanceof CampaignError) {
    console.warn(`[CampaignsController] ${context} client error:`, err.message);
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error(`[CampaignsController] ${context} unexpected server error:`, err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  });
};

/**
 * Controller handling HTTP requests for the Campaign Narrative Event feature.
 */
export class CampaignsController {
  constructor(private readonly useCase: CampaignsUseCase) {}

  /**
   * GET / - List campaigns with validated pagination and filtering.
   */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      let page = 1;
      if (req.query.page !== undefined) {
        const parsedPage = Number(req.query.page);
        if (!Number.isInteger(parsedPage) || parsedPage < 1) {
          throw new CampaignValidationError('Page query parameter must be a positive integer.');
        }
        page = parsedPage;
      }

      let limit = 20;
      if (req.query.limit !== undefined) {
        const parsedLimit = Number(req.query.limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
          throw new CampaignValidationError('Limit query parameter must be an integer between 1 and 100.');
        }
        limit = parsedLimit;
      }

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
   * GET /:id - Retrieve single campaign.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const campaign = await this.useCase.getCampaign(id);
      if (!campaign) {
        throw new CampaignNotFoundError(`Campaign not found with id: ${id}`);
      }
      res.status(200).json(campaign);
    } catch (err: unknown) {
      handleControllerError(res, err, 'getById');
    }
  };

  /**
   * POST / - Create a new campaign.
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
   */
  clone = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const { newStartDate, newEndDate } = req.body || {};
      const cloned = await this.useCase.cloneCampaign(id, newStartDate, newEndDate);
      res.status(201).json(cloned);
    } catch (err: unknown) {
      handleControllerError(res, err, 'clone');
    }
  };

  /**
   * POST /:id/pause - Emergency kill switch pause.
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
   */
  uploadAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = extractRequiredId(req.params.id);
      const file = req.file;

      if (!file) {
        throw new CampaignValidationError('No image file uploaded.');
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
   * DELETE /:id - Delete campaign.
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

