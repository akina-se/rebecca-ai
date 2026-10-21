import { Storage } from '@google-cloud/storage';
import path from 'path';
import {
  SupportTransactionDoc,
  RewardImageDoc,
  SupporterLedgerQuery,
  SupporterLedgerResponse,
  UpdateSupportTransactionDto,
  ManualResolveSupportDto,
  ManualEntrySupportDto,
} from './types';
import { SupportersRepository } from './repository';
import { resolveSupportTierFromAmount } from '@rebecca/types';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * UseCase coordinating business logic for supporter transactions,
 * community moderation, manual recovery/retry, and reward asset catalog management.
 */
export class SupportersUseCase {
  constructor(
    private repo: SupportersRepository,
    private storage: Storage,
  ) {}

  /**
   * Retrieves paginated transaction records along with high-level summary KPIs.
   */
  async getLedger(query: SupporterLedgerQuery): Promise<SupporterLedgerResponse> {
    return this.repo.getTransactions(query);
  }

  /**
   * Retrieves a single transaction by ID.
   */
  async getTransactionById(id: string): Promise<SupportTransactionDoc | null> {
    return this.repo.getTransactionById(id);
  }

  /**
   * Updates a transaction (producer overrides: safeName, VIP tier elevation, ban toggle, credit visibility).
   */
  async updateTransaction(id: string, dto: UpdateSupportTransactionDto): Promise<SupportTransactionDoc> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) {
      const err = new Error(`Transaction with ID "${id}" not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    const updates: Partial<SupportTransactionDoc> = {
      updatedAt: new Date().toISOString(),
    };

    if (dto.safeName !== undefined) {
      updates.safeName = dto.safeName.trim();
    }
    if (dto.tier !== undefined) {
      updates.tier = dto.tier;
    }
    if (dto.isBanned !== undefined) {
      updates.isBanned = dto.isBanned;
    }
    if (dto.creditVisibility !== undefined) {
      updates.creditVisibility = dto.creditVisibility;
    }
    if (dto.isVip !== undefined) {
      updates.isVip = dto.isVip;
    }

    await this.repo.updateTransaction(id, updates);
    const updated = await this.repo.getTransactionById(id);
    return updated!;
  }

  /**
   * Retries an appreciation post generation for a failed transaction.
   * Resets status to 'pending', clears errorMessage, and dispatches task to bot-backend.
   */
  async retryTransaction(id: string): Promise<{ success: boolean; message: string; transaction: SupportTransactionDoc }> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) {
      const err = new Error(`Transaction with ID "${id}" not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (existing.status === 'completed') {
      const err = new Error('Cannot retry a completed transaction');
      (err as any).statusCode = 400;
      throw err;
    }

    // Reset status to pending and clear error
    await this.repo.updateTransaction(id, {
      status: 'pending',
      errorMessage: undefined,
      updatedAt: new Date().toISOString(),
    });

    const updated = await this.repo.getTransactionById(id);

    // Trigger worker endpoint if bot-backend URL is configured
    if (config.services.botBackendUrl) {
      try {
        const workerUrl = `${config.services.botBackendUrl.replace(/\/+$/, '')}/worker/support-post`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (config.services.batchSecret) {
          headers['x-worker-secret'] = config.services.batchSecret;
        }

        logger.info('[SupportersUseCase] Dispatching support post retry to bot-backend', {
          transactionId: id,
          workerUrl,
        });

        // Fire-and-forget or await with short timeout
        fetch(workerUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ transactionId: id }),
        }).catch((fetchErr) => {
          logger.warn('[SupportersUseCase] Failed to dispatch retry directly to worker (task will remain pending for worker pick-up)', {
            transactionId: id,
            error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          });
        });
      } catch (dispatchErr) {
        logger.warn('[SupportersUseCase] Worker dispatch error during retry', {
          transactionId: id,
          error: dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr),
        });
      }
    }

    return {
      success: true,
      message: 'Transaction has been reset to pending and scheduled for retry.',
      transaction: updated!,
    };
  }

  /**
   * Manually resolves a transaction (e.g. after manual review or manual posting).
   */
  async manualResolve(id: string, dto: ManualResolveSupportDto): Promise<SupportTransactionDoc> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) {
      const err = new Error(`Transaction with ID "${id}" not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    await this.repo.updateTransaction(id, {
      status: 'manual',
      tweetText: dto.tweetText,
      errorMessage: undefined,
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updated = await this.repo.getTransactionById(id);
    return updated!;
  }

  /**
   * Fallback form to manually ingest a transaction from Stripe Dashboard records if a webhook was dropped.
   */
  async manualEntry(dto: ManualEntrySupportDto): Promise<SupportTransactionDoc> {
    if (!dto.stripeSessionId || !dto.rawName || !dto.amount || dto.amount <= 0) {
      const err = new Error('stripeSessionId, rawName, and positive amount are required');
      (err as any).statusCode = 400;
      throw err;
    }

    const { tier, itemLabel } = resolveSupportTierFromAmount(dto.amount);

    // Get active reward
    const rewards = await this.repo.getRewardImages();
    const activeReward = rewards.find((r) => r.isActive);
    const rewardImageId = activeReward ? activeReward.id : 'default';

    const newId = await this.repo.createTransaction({
      stripeSessionId: dto.stripeSessionId.trim(),
      rawName: dto.rawName.trim(),
      safeName: dto.rawName.trim(),
      isNameSanitized: false,
      creditVisibility: dto.creditVisibility || 'show',
      amount: dto.amount,
      currency: 'jpy',
      tier,
      itemLabel,
      rewardImageId,
      status: 'pending',
      isBanned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const created = await this.repo.getTransactionById(newId);
    return created!;
  }

  /**
   * Retrieves all digital reward assets.
   */
  async getRewards(): Promise<RewardImageDoc[]> {
    return this.repo.getRewardImages();
  }

  /**
   * Uploads and registers a new digital reward asset.
   */
  async uploadReward(file: Express.Multer.File, title: string): Promise<RewardImageDoc> {
    if (!file || !file.buffer) {
      const err = new Error('Image file is required');
      (err as any).statusCode = 400;
      throw err;
    }

    const cleanTitle = (title || 'サポーター特典イラスト').trim();
    const safeExt = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `rewards/${Date.now()}_${path.basename(file.originalname, safeExt).replace(/[^a-zA-Z0-9_-]/g, '_')}${safeExt}`;
    const bucket = this.storage.bucket(config.gcp.imageBucketName);

    const fileRef = bucket.file(filename);
    await fileRef.save(file.buffer, {
      contentType: file.mimetype || 'image/png',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    const docId = await this.repo.createRewardImage({
      title: cleanTitle,
      storagePath: filename,
      imageUrl: `/api/v1/supporters/rewards/temp/image`, // Will update with generated docId
      isActive: true,
      distributedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const finalImageUrl = `/api/v1/supporters/rewards/${docId}/image`;
    await this.repo.updateRewardImage(docId, { imageUrl: finalImageUrl });

    const created = await this.repo.getRewardImageById(docId);
    return created!;
  }

  /**
   * Retrieves binary image stream for a reward.
   */
  async getRewardBinary(id: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const reward = await this.repo.getRewardImageById(id);
    if (!reward || !reward.storagePath) {
      return null;
    }

    const bucket = this.storage.bucket(config.gcp.imageBucketName);
    const file = bucket.file(reward.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/png';

    return { buffer, contentType };
  }

  /**
   * Updates a digital reward asset (e.g. toggle active status or rename title).
   */
  async updateReward(id: string, data: { title?: string; isActive?: boolean }): Promise<RewardImageDoc> {
    const existing = await this.repo.getRewardImageById(id);
    if (!existing) {
      const err = new Error(`Reward asset with ID "${id}" not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    await this.repo.updateRewardImage(id, data);
    const updated = await this.repo.getRewardImageById(id);
    return updated!;
  }

  /**
   * Deletes a digital reward asset.
   */
  async deleteReward(id: string): Promise<void> {
    const existing = await this.repo.getRewardImageById(id);
    if (!existing) {
      const err = new Error(`Reward asset with ID "${id}" not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (existing.storagePath) {
      try {
        const bucket = this.storage.bucket(config.gcp.imageBucketName);
        await bucket.file(existing.storagePath).delete({ ignoreNotFound: true });
      } catch (storageErr) {
        logger.warn('[SupportersUseCase] Failed to delete file from Cloud Storage', {
          id,
          storagePath: existing.storagePath,
          error: storageErr instanceof Error ? storageErr.message : String(storageErr),
        });
      }
    }

    await this.repo.deleteRewardImage(id);
  }
}
