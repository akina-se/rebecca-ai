import { Request, Response } from 'express';
import { SystemMemoryUseCase } from './usecase';

/**
 * Controller for managing Rebecca's system memory layers.
 */
export class SystemMemoryController {
  /**
   * Creates an instance of SystemMemoryController.
   * 
   * @param useCase - The system memory use case instance.
   */
  constructor(private useCase: SystemMemoryUseCase) {}

  /**
   * Retrieves the metadata for all memory layers.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getLayers(req: Request, res: Response): Promise<void> {
    try {
      const layers = await this.useCase.getLayers();
      res.json(layers);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch memory layers' });
    }
  }

  /**
   * Retrieves the core memory content (Layer 0).
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getCoreMemory(req: Request, res: Response): Promise<void> {
    try {
      const content = await this.useCase.getCoreMemory();
      res.json(content);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch core memory' });
    }
  }

  /**
   * Retrieves the global memory content (Layer 2).
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getGlobalMemory(req: Request, res: Response): Promise<void> {
    try {
      const content = await this.useCase.getGlobalMemory();
      res.json(content);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch global memory' });
    }
  }

  /**
   * Updates the global memory content (Layer 2).
   * 
   * @param req - The Express Request object containing the new content in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async updateGlobalMemory(req: Request, res: Response): Promise<void> {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    await this.useCase.updateGlobalMemory(content);
    res.json({ success: true });
  }

  /**
   * Triggers the dreaming evolution process.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async triggerDreaming(req: Request, res: Response): Promise<void> {
    // Non-blocking async trigger
    this.useCase.triggerDreaming().catch(console.error);
    res.status(202).json({ success: true, message: 'Dreaming process initiated' });
  }
}
