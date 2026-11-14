import { Request, Response } from 'express';
import { BatchTriggerResponse } from '@rebecca/types';
import { TimelineUseCase } from './usecase';
import { getTraceHeader, handleControllerError } from '../../utils/httpError';

/**
 * Controller responsible for handling HTTP requests related to the timeline and system metrics.
 * It coordinates with the TimelineUseCase to retrieve and manage data, handling the Express request/response lifecycle.
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
    const traceHeader = getTraceHeader(req);
    try {
      const period = req.query.period as string || 'monthly';
      const metrics = await this.useCase.getMetrics(period);
      res.json(metrics);
    } catch (err) {
      handleControllerError(res, err, 'Failed to fetch metrics', { period: req.query.period }, traceHeader);
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
    const traceHeader = getTraceHeader(req);
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
      const period = req.query.period as 'monthly' | 'yearly' | 'all-time' | undefined;
      const date = req.query.date as string | undefined;
      
      const result = await this.useCase.getPosts({ page, limit, sortBy, sortOrder, period, date });
      res.json(result);
    } catch (err) {
      handleControllerError(res, err, 'Failed to fetch posts', { query: req.query }, traceHeader);
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
    const traceHeader = getTraceHeader(req);
    const { id } = req.params;
    try {
      const post = await this.useCase.getPostById(id as string);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      res.json(post);
    } catch (err) {
      handleControllerError(res, err, 'Failed to fetch post details', { postId: id }, traceHeader);
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
    const traceHeader = getTraceHeader(req);
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids must be an array' });
      return;
    }
    try {
      await this.useCase.deletePosts(ids);
      res.json({ success: true });
    } catch (err) {
      handleControllerError(res, err, 'Failed to delete posts', undefined, traceHeader);
    }
  }

  /**
   * Retrieves active system alerts.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getAlerts(req: Request, res: Response): Promise<void> {
    const traceHeader = getTraceHeader(req);
    try {
      const alerts = await this.useCase.getAlerts();
      res.json(alerts);
    } catch (err) {
      handleControllerError(res, err, 'Failed to fetch alerts', undefined, traceHeader);
    }
  }

  /**
   * Triggers manual timeline synchronization from X into Firestore via Cloud Functions.
   *
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async syncPosts(req: Request, res: Response): Promise<void> {
    const traceHeader = getTraceHeader(req);
    try {
      const result: BatchTriggerResponse = await this.useCase.syncPosts();
      res.json(result);
    } catch (err) {
      handleControllerError(res, err, 'Failed to sync timeline posts', undefined, traceHeader);
    }
  }

  /**
   * Triggers manual mentions polling and reply execution via bot-backend.
   *
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async triggerReply(req: Request, res: Response): Promise<void> {
    const traceHeader = getTraceHeader(req);
    try {
      const result: BatchTriggerResponse = await this.useCase.triggerReply();
      res.json(result);
    } catch (err) {
      handleControllerError(res, err, 'Failed to trigger reply execution', undefined, traceHeader);
    }
  }
}
