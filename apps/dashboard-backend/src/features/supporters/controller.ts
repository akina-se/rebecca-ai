import { SupporterLedgerQuery, SUPPORT_TIER_CONFIG, SupportPlanItem } from '@rebecca/types';
import { Request, Response } from 'express';
import { SupportersUseCase } from './usecase';
import { logger } from '../../utils/logger';

/**
 * Controller handling HTTP requests for the supporter management ledger,
 * retry mechanisms, community moderation, and reward asset management.
 */
export class SupportersController {
  constructor(private useCase: SupportersUseCase) {}

  /**
   * GET /api/v1/supporters
   * Retrieves paginated transaction records with KPI summary.
   */
  /**
   * GET /api/v1/supporters/plans
   * Retrieves active support tier plans and pricing configuration.
   */
  getPlans(_req: Request, res: Response): void {
    const plans: SupportPlanItem[] = [
      {
        tier: SUPPORT_TIER_CONFIG.bronze.tier,
        amount: SUPPORT_TIER_CONFIG.bronze.amount,
        currency: 'jpy',
        itemLabel: SUPPORT_TIER_CONFIG.bronze.itemLabel,
        displayName: SUPPORT_TIER_CONFIG.bronze.displayName,
      },
      {
        tier: SUPPORT_TIER_CONFIG.silver.tier,
        amount: SUPPORT_TIER_CONFIG.silver.amount,
        currency: 'jpy',
        itemLabel: SUPPORT_TIER_CONFIG.silver.itemLabel,
        displayName: SUPPORT_TIER_CONFIG.silver.displayName,
      },
      {
        tier: SUPPORT_TIER_CONFIG.gold.tier,
        amount: SUPPORT_TIER_CONFIG.gold.amount,
        currency: 'jpy',
        itemLabel: SUPPORT_TIER_CONFIG.gold.itemLabel,
        displayName: SUPPORT_TIER_CONFIG.gold.displayName,
      },
    ];
    res.status(200).json({ plans });
  }

  async getLedger(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, cursor, status, tier, search } = req.query;
      const query: SupporterLedgerQuery = {
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 30,
        cursor: cursor ? String(cursor) : undefined,
        status: status ? (String(status) as SupporterLedgerQuery['status']) : undefined,
        tier: tier ? (String(tier) as SupporterLedgerQuery['tier']) : undefined,
        search: search ? String(search) : undefined,
      };

      const result = await this.useCase.getLedger(query);
      res.status(200).json(result);
    } catch (error) {
      logger.error('[SupportersController] getLedger failed', error);
      res.status(500).json({ error: 'Failed to retrieve supporter ledger' });
    }
  }

  /**
   * GET /api/v1/supporters/:id
   * Retrieves single transaction details.
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.useCase.getTransactionById(id);
      if (!result) {
        res.status(404).json({ error: `Transaction ${id} not found` });
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      logger.error('[SupportersController] getById failed', error, { id: req.params.id });
      res.status(500).json({ error: 'Failed to retrieve transaction' });
    }
  }

  /**
   * PATCH /api/v1/supporters/:id
   * Updates transaction fields (safeName, tier, isBanned, creditVisibility).
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.useCase.updateTransaction(id, req.body);
      res.status(200).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] update failed', error, { id: req.params.id });
      res.status(status).json({ error: (error as Error).message || 'Failed to update transaction' });
    }
  }

  /**
   * POST /api/v1/supporters/:id/retry
   * Resets transaction status to pending and re-dispatches the appreciation task.
   */
  async retry(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.useCase.retryTransaction(id);
      res.status(200).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] retry failed', error, { id: req.params.id });
      res.status(status).json({ error: (error as Error).message || 'Failed to retry transaction' });
    }
  }

  /**
   * POST /api/v1/supporters/:id/manual-resolve
   * Resolves a transaction manually with custom tweet text.
   */
  async manualResolve(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.useCase.manualResolve(id, req.body);
      res.status(200).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] manualResolve failed', error, { id: req.params.id });
      res.status(status).json({ error: (error as Error).message || 'Failed to manually resolve transaction' });
    }
  }

  /**
   * POST /api/v1/supporters/manual-entry
   * Manually ingests a transaction from Stripe dashboard records.
   */
  async manualEntry(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.useCase.manualEntry(req.body);
      res.status(201).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] manualEntry failed', error);
      res.status(status).json({ error: (error as Error).message || 'Failed to create manual entry' });
    }
  }

  /**
   * GET /api/v1/supporters/rewards
   * Retrieves all reward image assets.
   */
  async getRewards(_req: Request, res: Response): Promise<void> {
    try {
      const rewards = await this.useCase.getRewards();
      res.status(200).json({ rewards });
    } catch (error) {
      logger.error('[SupportersController] getRewards failed', error);
      res.status(500).json({ error: 'Failed to retrieve rewards' });
    }
  }

  /**
   * POST /api/v1/supporters/rewards
   * Uploads and registers a new reward image asset.
   */
  async uploadReward(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'File upload is required (multipart field "file")' });
        return;
      }
      const title = req.body?.title || 'サポーター特典イラスト';
      const result = await this.useCase.uploadReward(req.file, title);
      res.status(201).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] uploadReward failed', error);
      res.status(status).json({ error: (error as Error).message || 'Failed to upload reward' });
    }
  }

  /**
   * GET /api/v1/supporters/rewards/:id/image
   * Streams the binary image for a reward asset.
   */
  async getRewardImage(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const type = req.query.type === 'thumbnail' ? 'thumbnail' : 'master';
      const result = await this.useCase.getRewardBinary(id, type);
      if (!result) {
        res.status(404).send('Image not found');
        return;
      }
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', type === 'thumbnail' ? 'public, max-age=86400' : 'private, max-age=3600');
      res.send(result.buffer);
    } catch (error) {
      logger.error('[SupportersController] getRewardImage failed', error, { id: req.params.id });
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * PATCH /api/v1/supporters/rewards/:id
   * Updates reward asset title or isActive status.
   */
  async updateReward(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.useCase.updateReward(id, req.body);
      res.status(200).json(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] updateReward failed', error, { id: req.params.id });
      res.status(status).json({ error: (error as Error).message || 'Failed to update reward' });
    }
  }

  /**
   * DELETE /api/v1/supporters/rewards/:id
   * Deletes a reward image asset.
   */
  async deleteReward(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      await this.useCase.deleteReward(id);
      res.status(200).json({ success: true });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode || 500;
      logger.error('[SupportersController] deleteReward failed', error, { id: req.params.id });
      res.status(status).json({ error: (error as Error).message || 'Failed to delete reward' });
    }
  }
}
