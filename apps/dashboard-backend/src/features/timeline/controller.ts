import { Request, Response } from 'express';
import { BatchTriggerResponse, parseUpstreamApiError } from '@rebecca/types';
import { TimelineUseCase } from './usecase';
import { logger } from '../../utils/logger';

function getTraceHeader(req: Request): string | undefined {
  if (typeof req.header === 'function') {
    return req.header('x-cloud-trace-context');
  }
  return req.headers?.['x-cloud-trace-context'] as string | undefined;
}

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
      logger.error('Failed to fetch metrics', err, { period: req.query.period }, traceHeader);
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
      logger.error('Failed to fetch posts', err, { query: req.query }, traceHeader);
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
      logger.error('Failed to fetch post details', err, { postId: id }, traceHeader);
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
      this.handleBatchTriggerError(res, err, 'Failed to delete posts', traceHeader);
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
      logger.error('Failed to fetch alerts', err, undefined, traceHeader);
      res.status(500).json({ error: 'Failed to fetch alerts' });
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
      this.handleBatchTriggerError(res, err, 'Failed to sync timeline posts', traceHeader);
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
      this.handleBatchTriggerError(res, err, 'Failed to trigger reply execution', traceHeader);
    }
  }

  private handleBatchTriggerError(
    res: Response,
    err: unknown,
    defaultMessage: string,
    traceHeader?: string
  ): void {
    const upstream = parseUpstreamApiError(err);
    const statusCode = upstream?.statusCode ?? 500;
    const errorMessage =
      upstream && upstream.message.trim() ? upstream.message : defaultMessage;

    if (upstream && statusCode >= 400 && statusCode < 500) {
      logger.warn(defaultMessage, { statusCode, errorMessage }, traceHeader);
    } else {
      logger.error(defaultMessage, err, undefined, traceHeader);
    }
    res.status(statusCode).json({ error: errorMessage });
  }
}
