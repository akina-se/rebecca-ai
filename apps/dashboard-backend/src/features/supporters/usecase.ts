export class HttpError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'HttpError';
  }
}

import { Storage } from '@google-cloud/storage';
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
import { generateWebpThumbnail, stripImageMetadata } from '../../utils/image';

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
  /**
   * Deletes a support transaction document.
   */
  async deleteTransaction(id: string): Promise<void> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) {
      throw new HttpError(`Support transaction with ID "${id}" not found`, 404);
    }
    await this.repo.deleteTransaction(id);
  }

  async updateTransaction(id: string, dto: UpdateSupportTransactionDto): Promise<SupportTransactionDoc> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) {
      throw new HttpError(`Transaction with ID "${id}" not found`, 404);
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
      throw new HttpError(`Transaction with ID "${id}" not found`, 404);
    }

    if (existing.status === 'completed') {
      throw new HttpError('Cannot retry a completed transaction', 400);
    }

    // Reset status to pending and clear error
    await this.repo.updateTransaction(id, {
      status: 'pending',
      errorMessage: undefined,
      updatedAt: new Date().toISOString(),
    });

    const updated = await this.repo.getTransactionById(id);

    // Trigger worker endpoint to process retry immediately
    await this.dispatchSupportWorker(id);

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
      throw new HttpError(`Transaction with ID "${id}" not found`, 404);
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
      throw new HttpError('stripeSessionId, rawName, and positive amount are required', 400);
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

    // Trigger worker endpoint to process the manual transaction immediately
    await this.dispatchSupportWorker(newId);

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
  async uploadReward(file: Express.Multer.File, title?: string): Promise<RewardImageDoc> {
    if (!file || !file.buffer) {
      throw new HttpError('Image file is required', 400);
    }

    // 1. Calculate sequential number and ensure privacy-safe title
    const existingRewards = await this.repo.getRewardImages();
    const sequenceNumber = existingRewards.length + 1;
    const sequenceStr = String(sequenceNumber).padStart(2, '0');

    let cleanTitle = (title || '').trim();
    if (
      !cleanTitle ||
      cleanTitle === 'サポーター特典イラスト' ||
      /\.(png|jpe?g|webp|gif)$/i.test(cleanTitle)
    ) {
      cleanTitle = `サポーター特典 #${sequenceStr}`;
    }

    // 2. Security & Privacy: Strip EXIF, GPS, camera model, and creator metadata from master image
    const mimeType = file.mimetype || 'image/png';
    const cleanMasterBuffer = await stripImageMetadata(file.buffer, mimeType);

    // 3. Performance: Generate responsive WebP thumbnail (max-width 800px)
    const thumbBuffer = await generateWebpThumbnail(cleanMasterBuffer, 800);

    // 4. Secure storage paths (completely ignoring file.originalname to prevent any PII or client metadata leak)
    const timestamp = Date.now();
    const safeExt = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? '.jpg' : '.png';
    const masterFilename = `rewards/reward_${sequenceStr}_${timestamp}_master${safeExt}`;
    const thumbFilename = `rewards/reward_${sequenceStr}_${timestamp}_thumb.webp`;

    const bucket = this.storage.bucket(config.gcp.imageBucketName);

    // Save cleaned master image
    const masterFileRef = bucket.file(masterFilename);
    await masterFileRef.save(cleanMasterBuffer, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'private, max-age=31536000',
      },
    });

    // Save WebP thumbnail
    const thumbFileRef = bucket.file(thumbFilename);
    await thumbFileRef.save(thumbBuffer, {
      contentType: 'image/webp',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // 5. Register in Firestore
    const docId = await this.repo.createRewardImage({
      title: cleanTitle,
      storagePath: masterFilename,
      thumbnailStoragePath: thumbFilename,
      sequenceNumber,
      imageUrl: `/api/v1/supporters/rewards/temp/image`,
      thumbnailUrl: `/api/v1/supporters/rewards/temp/image?type=thumbnail`,
      isActive: true,
      distributedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const finalImageUrl = `/api/v1/supporters/rewards/${docId}/image`;
    const finalThumbnailUrl = `/api/v1/supporters/rewards/${docId}/image?type=thumbnail`;

    await this.repo.updateRewardImage(docId, {
      imageUrl: finalImageUrl,
      thumbnailUrl: finalThumbnailUrl,
    });

    const created = await this.repo.getRewardImageById(docId);
    return created!;
  }

  /**
   * Retrieves binary image stream for a reward (master high-res or thumbnail preview).
   */
  async getRewardBinary(
    id: string,
    type: 'master' | 'thumbnail' = 'master'
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const reward = await this.repo.getRewardImageById(id);
    if (!reward) {
      return null;
    }

    const targetPath =
      type === 'thumbnail' && reward.thumbnailStoragePath
        ? reward.thumbnailStoragePath
        : reward.storagePath;

    if (!targetPath) {
      return null;
    }

    const bucket = this.storage.bucket(config.gcp.imageBucketName);
    const file = bucket.file(targetPath);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType =
      type === 'thumbnail' || targetPath.endsWith('.webp')
        ? 'image/webp'
        : metadata.contentType || 'image/png';

    return { buffer, contentType };
  }

  /**
   * Updates a digital reward asset (e.g. toggle active status or rename title).
   */
  async updateReward(id: string, data: { title?: string; isActive?: boolean }): Promise<RewardImageDoc> {
    const existing = await this.repo.getRewardImageById(id);
    if (!existing) {
      throw new HttpError(`Reward asset with ID "${id}" not found`, 404);
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
      throw new HttpError(`Reward asset with ID "${id}" not found`, 404);
    }

    const pathsToDelete = [existing.storagePath, existing.thumbnailStoragePath].filter(
      (p): p is string => Boolean(p),
    );
    if (pathsToDelete.length > 0) {
      try {
        const bucket = this.storage.bucket(config.gcp.imageBucketName);
        await Promise.allSettled(
          pathsToDelete.map((p) => bucket.file(p).delete({ ignoreNotFound: true })),
        );
      } catch (storageErr) {
        logger.warn('[SupportersUseCase] Failed to delete file(s) from Cloud Storage', {
          id,
          pathsToDelete,
          error: storageErr instanceof Error ? storageErr.message : String(storageErr),
        });
      }
    }

    await this.repo.deleteRewardImage(id);
  }
  /**
   * Dispatches an asynchronous support post processing task to bot-backend worker.
   */
  async dispatchSupportWorker(transactionId: string): Promise<void> {
    if (!config.services.botBackendUrl) {
      logger.warn('[SupportersUseCase] botBackendUrl is not configured; skipping worker dispatch', {
        transactionId,
      });
      return;
    }

    try {
      const workerUrl = `${config.services.botBackendUrl.replace(/\/+$/, '')}/worker/support-post`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.services.batchSecret) {
        headers['x-worker-secret'] = config.services.batchSecret;
      }

      logger.info('[SupportersUseCase] Dispatching support post to bot-backend worker', {
        transactionId,
        workerUrl,
      });

      // Fire-and-forget or await with short timeout
      fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId }),
      }).catch((fetchErr) => {
        logger.warn('[SupportersUseCase] Failed to dispatch directly to worker (task will remain pending for worker pick-up)', {
          transactionId,
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        });
      });
    } catch (dispatchErr) {
      logger.warn('[SupportersUseCase] Worker dispatch error', {
        transactionId,
        error: dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr),
      });
    }
  }

}
