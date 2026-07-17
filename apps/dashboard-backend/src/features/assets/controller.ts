import { Request, Response } from 'express';
import { AssetsUseCase } from './usecase';

export class AssetsController {
  constructor(private useCase: AssetsUseCase) {}

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const assets = await this.useCase.getAllAssets();
      res.json(assets);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  }

  async upload(req: Request, res: Response): Promise<void> {
    // Stub for multer/file upload logic
    res.status(201).json({ message: 'Mock upload successful' });
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await this.useCase.updateAsset(id as string, req.body);
    res.json({ success: true });
  }

  async deleteMany(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids must be an array' });
      return;
    }
    await this.useCase.deleteAssets(ids);
    res.json({ success: true });
  }

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
