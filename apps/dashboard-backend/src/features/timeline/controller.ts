import { Request, Response } from 'express';
import { TimelineUseCase } from './usecase';

/**
 * Controller for handling timeline and metrics-related requests.
 */
export class TimelineController {
  /**
   * Creates an instance of TimelineController.
   * 
   * @param useCase - The timeline use case instance.
   */
  constructor(private useCase: TimelineUseCase) {}

  /**
   * Retrieves global system KPI metrics.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.useCase.getMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  }

  /**
   * Retrieves the top timeline posts for the leaderboard.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getPosts(req: Request, res: Response): Promise<void> {
    try {
      const posts = await this.useCase.getPosts();
      res.json(posts);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  }

  /**
   * Retrieves detailed information for a specific post by ID.
   * 
   * @param req - The Express Request object containing the post ID in params.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getPostById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const post = await this.useCase.getPostById(id as string);
      res.json(post);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch post details' });
    }
  }

  /**
   * Deletes multiple posts by their IDs.
   * 
   * @param req - The Express Request object containing an array of post IDs in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
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
