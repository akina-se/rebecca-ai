import { Request, Response } from 'express';
import { CampaignsUseCase } from './usecase';

const resolveId = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return String(param || '');
};

/**
 * Controller handling HTTP requests for the Campaign Narrative Event feature.
 */
export class CampaignsController {
  constructor(private readonly useCase: CampaignsUseCase) {}

  /**
   * GET / - List campaigns with pagination and filtering.
   */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const status = req.query.status ? String(req.query.status) : undefined;

      const result = await this.useCase.listCampaigns({ page, limit, status });
      res.status(200).json(result);
    } catch (err: unknown) {
      console.error('[CampaignsController] list error:', err);
      const message = err instanceof Error ? err.message : 'Failed to list campaigns';
      res.status(500).json({ error: message });
    }
  };

  /**
   * GET /:id - Retrieve single campaign.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const campaign = await this.useCase.getCampaign(id);
      if (!campaign) {
        res.status(404).json({ error: `Campaign not found with id: ${id}` });
        return;
      }
      res.status(200).json(campaign);
    } catch (err: unknown) {
      console.error('[CampaignsController] getById error:', err);
      const message = err instanceof Error ? err.message : 'Failed to get campaign';
      res.status(500).json({ error: message });
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
      console.error('[CampaignsController] create error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create campaign';
      res.status(400).json({ error: message });
    }
  };

  /**
   * PUT /:id - Update an existing campaign.
   */
  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const updated = await this.useCase.updateCampaign(id, req.body);
      res.status(200).json(updated);
    } catch (err: unknown) {
      console.error('[CampaignsController] update error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update campaign';
      const statusCode = message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({ error: message });
    }
  };

  /**
   * POST /:id/clone - Duplicate an existing campaign.
   */
  clone = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const { newStartDate, newEndDate } = req.body || {};
      const cloned = await this.useCase.cloneCampaign(id, newStartDate, newEndDate);
      res.status(201).json(cloned);
    } catch (err: unknown) {
      console.error('[CampaignsController] clone error:', err);
      const message = err instanceof Error ? err.message : 'Failed to clone campaign';
      const statusCode = message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({ error: message });
    }
  };

  /**
   * POST /:id/pause - Emergency kill switch pause.
   */
  pause = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const updated = await this.useCase.pauseCampaign(id);
      res.status(200).json(updated);
    } catch (err: unknown) {
      console.error('[CampaignsController] pause error:', err);
      const message = err instanceof Error ? err.message : 'Failed to pause campaign';
      const statusCode = message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  };

  /**
   * POST /:id/resume - Resume a paused campaign.
   */
  resume = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const updated = await this.useCase.resumeCampaign(id);
      res.status(200).json(updated);
    } catch (err: unknown) {
      console.error('[CampaignsController] resume error:', err);
      const message = err instanceof Error ? err.message : 'Failed to resume campaign';
      const statusCode = message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  };

  /**
   * POST /:id/assets - Isolated campaign illustration upload.
   */
  uploadAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No image file uploaded' });
        return;
      }

      const result = await this.useCase.uploadCampaignAsset(id, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      console.error('[CampaignsController] uploadAsset error:', err);
      const message = err instanceof Error ? err.message : 'Failed to upload campaign asset';
      const statusCode = message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  };

  /**
   * DELETE /:id - Delete campaign.
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = resolveId(req.params.id);
      await this.useCase.deleteCampaign(id);
      res.status(200).json({ message: 'Campaign deleted successfully.' });
    } catch (err: unknown) {
      console.error('[CampaignsController] delete error:', err);
      const message = err instanceof Error ? err.message : 'Failed to delete campaign';
      const statusCode = message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  };
}
