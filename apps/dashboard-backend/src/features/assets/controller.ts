import { Request, Response } from 'express';
import { AssetsUseCase } from './usecase';

/**
 * Controller for handling asset-related requests.
 */
export class AssetsController {
  /**
   * Creates an instance of AssetsController.
   * 
   * @param useCase - The use case instance for managing assets.
   */
  constructor(private useCase: AssetsUseCase) {}

  /**
   * Retrieves all assets.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const assets = await this.useCase.getAllAssets();
      res.json(assets);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  }

  /**
   * Uploads a new asset to the system.
   * 
   * @param req - The Express Request object containing the uploaded file data.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the upload response is sent.
   */
  async upload(req: Request, res: Response): Promise<void> {
    res.status(201).json({ message: 'Mock upload successful' });
  }

  /**
   * Updates an existing asset by ID.
   * 
   * @param req - The Express Request object containing the asset ID in params and updates in body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await this.useCase.updateAsset(id as string, req.body);
    res.json({ success: true });
  }

  /**
   * Deletes multiple assets by their IDs.
   * 
   * @param req - The Express Request object containing an array of asset IDs in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async deleteMany(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids must be an array' });
      return;
    }
    await this.useCase.deleteAssets(ids);
    res.json({ success: true });
  }

  /**
   * Regenerates captions for specified assets.
   * 
   * @param req - The Express Request object containing an array of asset IDs in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async regenerateCaptions(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids must be an array' });
      return;
    }
    await this.useCase.regenerateCaptions(ids);
    res.json({ success: true });
  }
}
