import { Request, Response } from 'express';
import { TimelineUseCase } from './usecase';

export class TimelineController {
  constructor(private useCase: TimelineUseCase) {}

  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.useCase.getMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  }

  async getPosts(req: Request, res: Response): Promise<void> {
    try {
      const posts = await this.useCase.getPosts();
      res.json(posts);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  }

  async getPostById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const post = await this.useCase.getPostById(id as string);
      res.json(post);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch post details' });
    }
  }

  async deletePosts(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids must be an array' });
      return;
    }
    await this.useCase.deletePosts(ids);
    res.json({ success: true });
  }
}
