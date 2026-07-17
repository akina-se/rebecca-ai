import { Request, Response } from 'express';
import { SystemMemoryUseCase } from './usecase';

export class SystemMemoryController {
  constructor(private useCase: SystemMemoryUseCase) {}

  async getLayers(req: Request, res: Response): Promise<void> {
    try {
      const layers = await this.useCase.getLayers();
      res.json(layers);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch memory layers' });
    }
  }

  async getCoreMemory(req: Request, res: Response): Promise<void> {
    try {
      const content = await this.useCase.getCoreMemory();
      res.json(content);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch core memory' });
    }
  }

  async getGlobalMemory(req: Request, res: Response): Promise<void> {
    try {
      const content = await this.useCase.getGlobalMemory();
      res.json(content);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch global memory' });
    }
  }

  async updateGlobalMemory(req: Request, res: Response): Promise<void> {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    await this.useCase.updateGlobalMemory(content);
    res.json({ success: true });
  }

  async triggerDreaming(req: Request, res: Response): Promise<void> {
    // Non-blocking async trigger
    this.useCase.triggerDreaming().catch(console.error);
    res.status(202).json({ success: true, message: 'Dreaming process initiated' });
  }
}
