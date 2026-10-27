/**
 * @fileoverview Public HTTP Controller for the supporter tipping system.
 *
 * Handles:
 * - `GET /api/support/verify-session`: Instant reward delivery with Stripe payment_status verification and Signed URL issuance.
 * - `GET /api/support/credits`: Public Hall of Fame credit roster for website display.
 * - `POST /api/webhooks/stripe`: Stripe checkout.session.completed webhook processing & task queuing.
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { AppDependencies } from '../../types';
import { SupportConfig } from './types';
import { SUPPORT_TIER_CONFIG, resolveSupportTierFromAmount, SupportTransactionDoc, RewardImageDoc } from '@rebecca/types';
import { logger } from '../../utils/logger';

/**
 * Controller managing public-facing support endpoints.
 */
export class PublicSupportController {
  private readonly stripeClient: Stripe | null;

  /**
   * Initializes PublicSupportController.
   *
   * @param deps - Injected application dependencies.
   * @param config - Injected support runtime configuration.
   * @param stripeClient - Optional pre-configured Stripe client (allows test mocking).
   */
  constructor(
    private readonly deps: AppDependencies,
    private readonly config: SupportConfig,
    stripeClient?: Stripe,
  ) {
    if (stripeClient) {
      this.stripeClient = stripeClient;
    } else if (this.config.stripeSecretKey) {
      this.stripeClient = new Stripe(this.config.stripeSecretKey);
    } else {
      this.stripeClient = null;
    }
  }

  /**
   * Enqueues the appreciation post task via Cloud Tasks.
   */
  private triggerAppreciationPost(transactionId: string): void {
    this.deps.tasks.enqueueSupportTask({ transactionId }).catch((taskErr) => {
      logger.error('[PublicSupportController] Cloud Tasks enqueue failed for support transaction', taskErr, {
        transactionId,
      });
    });
  }

  /**
   * Constructs a canonical SupportTransactionDoc from a verified Stripe Checkout Session.
   *
   * @remarks
   * Privacy / Security:
   * Only reads supporter nickname from `session.custom_fields` (`supporter_name`).
   * Never accesses `customer_details` (billing cardholder name) to prevent accidental PII leakage.
   */
  private buildTransactionDoc(
    session: Stripe.Checkout.Session,
    activeRewardId?: string,
  ): SupportTransactionDoc {
    const customFields = session.custom_fields || [];
    const rawNameField = customFields.find((f) => f.key === 'supporter_name');
    const rawName = rawNameField?.text?.value?.trim() || '';
    const visibilityField = customFields.find((f) => f.key === 'credit_visibility');
    const creditVisibility = visibilityField?.dropdown?.value === 'hide' ? 'hide' : 'show';
    const amount = session.amount_total ?? 0;
    const { tier, itemLabel } = resolveSupportTierFromAmount(amount);
    const transactionId = `tx_${session.id.replace('cs_', '').replace('test_', '')}`;

    return {
      id: transactionId,
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      rawName,
      safeName: rawName || this.config.fallbackName,
      isNameSanitized: false,
      creditVisibility,
      amount,
      currency: 'jpy',
      tier,
      itemLabel,
      rewardImageId: activeRewardId || 'none',
      status: 'pending',
      isBanned: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Verifies Stripe checkout session completion and generates a time-limited Signed Download URL.
   *
   * @remarks
   * Security Invariant:
   * Rejects any request where `payment_status !== 'paid'` with HTTP 403 Forbidden.
   * Only authenticated paying supporters receive high-resolution signed download links.
   *
   * @param req - Express Request with `session_id` query parameter.
   * @param res - Express Response.
   */
  verifySession = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Missing or invalid session_id query parameter' });
        return;
      }

      if (!this.stripeClient) {
        logger.error('[PublicSupportController] Stripe is not configured (missing stripeSecretKey)');
        res.status(500).json({ error: 'Payment gateway configuration error' });
        return;
      }

      // Step 1: Retrieve session from Stripe API and verify payment completion
      let session: Stripe.Checkout.Session;
      try {
        session = await this.stripeClient.checkout.sessions.retrieve(sessionId);
      } catch (stripeErr) {
        logger.warn('[PublicSupportController] Failed to retrieve Stripe session', {
          sessionId,
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
        res.status(404).json({ valid: false, error: 'Checkout session not found' });
        return;
      }

      // Step 2: Strict Payment Guard
      if (session.payment_status !== 'paid') {
        logger.warn('[PublicSupportController] Session payment incomplete', {
          sessionId,
          status: session.payment_status,
        });
        res.status(403).json({
          valid: false,
          error: 'Payment has not been completed or verified.',
        });
        return;
      }

      // Step 3: Fetch transaction record (if already created by webhook)
      let transaction = await this.deps.firestore.getSupportTransactionBySessionId(sessionId);

      // If webhook has not recorded it yet (e.g. local environment or delayed webhook), auto-sync from verified paid session
      if (!transaction) {
        try {
          const activeRewardForSync = await this.deps.firestore.getActiveRewardImage();
          const transactionDoc = this.buildTransactionDoc(session, activeRewardForSync?.id);

          await this.deps.firestore.createSupportTransaction(transactionDoc);
          transaction = transactionDoc;
          logger.info('[PublicSupportController] Auto-created support transaction on session verification', {
            transactionId: transactionDoc.id,
          });

          this.triggerAppreciationPost(transactionDoc.id);
        } catch (syncErr) {
          logger.warn('[PublicSupportController] Failed to auto-sync transaction from session', { syncErr });
        }
      } else if (transaction && transaction.status === 'pending') {
        this.triggerAppreciationPost(transaction.id);
      }

      // Step 4: Fetch supporter reward illustration asset:
      // If transaction already has an assigned rewardImageId, fetch it; otherwise pick a random active reward from the pool!
      let activeReward: RewardImageDoc | null = null;
      if (transaction?.rewardImageId && transaction.rewardImageId !== 'none') {
        activeReward = await this.deps.firestore.getRewardImageById(transaction.rewardImageId);
      }
      if (!activeReward) {
        activeReward = await this.deps.firestore.getActiveRewardImage();
      }

      let rewardPayload = null;
      if (activeReward) {
        const expiresInMinutes = 30;
        const encodedSessionId = encodeURIComponent(sessionId);
        // Secure by Default: Do not expose raw GCS bucket URLs or direct GCS signed links.
        // Stream through Bot Backend download API with strict 30-minute expiry verification.
        const downloadUrl = `/api/v1/support/rewards/download?session_id=${encodedSessionId}&type=master`;
        const thumbnailUrl = `/api/v1/support/rewards/download?session_id=${encodedSessionId}&type=thumbnail`;

        // Record distribution telemetry
        await this.deps.firestore.incrementRewardImageDistributedCount(activeReward.id);

        rewardPayload = {
          title: activeReward.title,
          imageUrl: thumbnailUrl,
          thumbnailUrl,
          downloadUrl,
          expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
        };
      }

      const amount = session.amount_total ?? 0;
      const tierInfo = resolveSupportTierFromAmount(amount);

      // Privacy Guard: If supporter opted to hide credit visibility ('hide'),
      // do not expose safeName in the public verify-session response to prevent
      // disclosure if sessionId is leaked or intercepted via browser history/referrer.
      const isCreditHidden = transaction?.creditVisibility === 'hide';
      const safeNameForResponse = isCreditHidden ? null : (transaction?.safeName || null);

      res.status(200).json({
        valid: true,
        tier: transaction?.tier ?? tierInfo.tier,
        itemLabel: transaction?.itemLabel ?? tierInfo.itemLabel,
        safeName: safeNameForResponse,
        reward: rewardPayload,
      });
    } catch (error) {
      logger.error('[PublicSupportController] Error verifying support session', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Retrieves public credits for display in the official Special Thanks roster.
   *
   * @param req - Express Request.
   * @param res - Express Response.
   */
  getCredits = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '120'), 10) || 120;
      const result = await this.deps.firestore.getPublicSupporters(page, limit);
      res.status(200).json(result);
    } catch (error) {
      logger.error('[PublicSupportController] Error retrieving public credits', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Retrieves active supporter sponsorship plans, pricing, and dynamic payment links.
   *
   * @remarks
   * Serves as the authoritative Single Source of Truth (SSOT) combining in-universe
   * tier metadata with environment-specific Stripe payment links (Test vs Live mode).
   *
   * @param _req - Express Request.
   * @param res - Express Response returning the plans list.
   */
  getSupportPlans = async (_req: Request, res: Response): Promise<void> => {
    try {
      const paymentLinks = this.config.paymentLinks || { bronze: '', silver: '', gold: '' };

      const plans = [
        {
          tier: SUPPORT_TIER_CONFIG.bronze.tier,
          amount: SUPPORT_TIER_CONFIG.bronze.amount,
          currency: 'jpy',
          itemLabel: SUPPORT_TIER_CONFIG.bronze.itemLabel,
          displayName: SUPPORT_TIER_CONFIG.bronze.displayName,
          paymentUrl: paymentLinks.bronze || null,
          available: Boolean(paymentLinks.bronze),
        },
        {
          tier: SUPPORT_TIER_CONFIG.silver.tier,
          amount: SUPPORT_TIER_CONFIG.silver.amount,
          currency: 'jpy',
          itemLabel: SUPPORT_TIER_CONFIG.silver.itemLabel,
          displayName: SUPPORT_TIER_CONFIG.silver.displayName,
          paymentUrl: paymentLinks.silver || null,
          available: Boolean(paymentLinks.silver),
        },
        {
          tier: SUPPORT_TIER_CONFIG.gold.tier,
          amount: SUPPORT_TIER_CONFIG.gold.amount,
          currency: 'jpy',
          itemLabel: SUPPORT_TIER_CONFIG.gold.itemLabel,
          displayName: SUPPORT_TIER_CONFIG.gold.displayName,
          paymentUrl: paymentLinks.gold || null,
          available: Boolean(paymentLinks.gold),
        },
      ];

      const rawEmail = (this.config.contactEmail || '').trim();
      const contactEmail = rawEmail ? rawEmail.replace(/@/g, ' [at mark] ') : null;
      res.status(200).json({ plans, contactEmail });
    } catch (error) {
      logger.error('[PublicSupportController] Error retrieving support plans', {
        error: (error as Error).message,
      });
      res.status(500).json({ error: 'Failed to retrieve support plans' });
    }
  };

  /**
   * Handles Stripe asynchronous webhook notifications (specifically `checkout.session.completed`).
   *
   * @param req - Express Request containing rawBody and stripe-signature header.
   * @param res - Express Response.
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = this.config.stripeWebhookSecret;

    // Fail-Closed: Strictly require server webhook secret configuration
    if (!webhookSecret) {
      logger.error('[PublicSupportController] Stripe webhook secret is not configured on this server');
      res.status(500).json({ error: 'Webhook Error: Server webhook secret is not configured' });
      return;
    }

    // Fail-Closed: Strictly require Stripe-Signature header
    if (!signature || typeof signature !== 'string') {
      logger.warn('[PublicSupportController] Missing or invalid stripe-signature header on webhook request');
      res.status(400).json({ error: 'Webhook Error: Missing stripe-signature header' });
      return;
    }

    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.warn('[PublicSupportController] Missing rawBody for Stripe webhook signature verification');
      res.status(400).json({ error: 'Webhook Error: Missing raw request body' });
      return;
    }

    let event: Stripe.Event;
    try {
      const webhookClient = this.stripeClient || Stripe;
      event = webhookClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('[PublicSupportController] Stripe webhook signature verification failed', {
        error: errMsg,
      });
      res.status(400).json({ error: `Webhook Error: ${errMsg}` });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      logger.info('[PublicSupportController] Processing checkout.session.completed webhook', {
        sessionId: session.id,
        amount: session.amount_total,
      });

      try {
        // Idempotency: Skip if already recorded
        const existingTx = await this.deps.firestore.getSupportTransactionBySessionId(session.id);
        if (existingTx) {
          logger.info('[PublicSupportController] Transaction already recorded. Skipping webhook', {
            sessionId: session.id,
            transactionId: existingTx.id,
          });
          res.status(200).json({ received: true, status: 'already_processed' });
          return;
        }

        const amount = session.amount_total ?? 0;
        if (amount <= 0) {
          logger.warn('[PublicSupportController] Non-positive amount in checkout session', {
            sessionId: session.id,
            amount,
          });
          res.status(400).json({ error: 'Invalid payment amount' });
          return;
        }

        const activeReward = await this.deps.firestore.getActiveRewardImage();
        const transactionDoc = this.buildTransactionDoc(session, activeReward?.id);

        await this.deps.firestore.createSupportTransaction(transactionDoc);
        logger.info('[PublicSupportController] Created support transaction', {
          transactionId: transactionDoc.id,
        });

        // Enqueue autonomous appreciation post task via Cloud Tasks
        this.triggerAppreciationPost(transactionDoc.id);

        res.status(200).json({ received: true, transactionId: transactionDoc.id });
        return;
      } catch (txError) {
        logger.error('[PublicSupportController] Failed to record support transaction', txError, {
          sessionId: session.id,
        });
        res.status(500).json({ error: 'Failed to record transaction' });
        return;
      }
    }

    res.status(200).json({ received: true });
  };
  /**
   * Streams the reward image asset securely through the Bot Backend (BFF proxy).
   *
   * @remarks
   * Security Invariants:
   * 1. Direct GCS bucket access is completely forbidden; all media is streamed via backend ADC credentials.
   * 2. Strict Payment Guard: Requires verified Stripe session (`payment_status === 'paid'`).
   * 3. 30-Minute Download Window: Allowed only within 30 minutes from checkout / transaction creation.
   *    Requests beyond 30 minutes return HTTP 410 Gone.
   *
   * @param req - Express Request with `session_id` and optional `type` ('thumbnail' | 'master').
   * @param res - Express Response streaming the image binary.
   */
  downloadReward = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Missing or invalid session_id query parameter' });
        return;
      }

      const type = req.query.type === 'thumbnail' ? 'thumbnail' : 'master';

      // Step 1: Verify payment and retrieve transaction record
      let transaction = await this.deps.firestore.getSupportTransactionBySessionId(sessionId);
      let sessionCreatedMs: number | null = null;

      if (!transaction) {
        if (!this.stripeClient) {
          logger.error('[PublicSupportController] Stripe is not configured (missing stripeSecretKey)');
          res.status(500).json({ error: 'Payment gateway configuration error' });
          return;
        }
        try {
          const session = await this.stripeClient.checkout.sessions.retrieve(sessionId);
          if (session.payment_status !== 'paid') {
            res.status(403).json({ error: 'Payment has not been completed or verified.' });
            return;
          }
          if (session.created) {
            sessionCreatedMs = session.created * 1000;
          }
        } catch (stripeErr) {
          logger.warn('[PublicSupportController] Failed to retrieve Stripe session for download', { sessionId, stripeErr });
          res.status(404).json({ error: 'Checkout session not found' });
          return;
        }
      }

      // Step 2: Enforce strict 30-minute time window
      const createdAtMs = transaction?.createdAt
        ? new Date(transaction.createdAt).getTime()
        : sessionCreatedMs;

      if (!createdAtMs || isNaN(createdAtMs)) {
        logger.warn('[PublicSupportController] Missing valid creation timestamp for download verification', { sessionId });
        res.status(400).json({ error: 'Unable to determine checkout session timestamp.' });
        return;
      }

      const ageMinutes = (Date.now() - createdAtMs) / (60 * 1000);

      const MAX_WINDOW_MINUTES = 30;
      if (ageMinutes > MAX_WINDOW_MINUTES) {
        res.status(410).json({
          error: 'Reward download link has expired. Downloads are available for 30 minutes after checkout.',
          expired: true,
        });
        return;
      }

      // Step 3: Resolve reward image record
      let rewardDoc: RewardImageDoc | null = null;
      if (transaction?.rewardImageId && transaction.rewardImageId !== 'none') {
        rewardDoc = await this.deps.firestore.getRewardImageById(transaction.rewardImageId);
      }
      if (!rewardDoc) {
        rewardDoc = await this.deps.firestore.getActiveRewardImage();
      }

      if (!rewardDoc) {
        res.status(404).json({ error: 'Reward asset not found' });
        return;
      }

      const targetPath =
        type === 'thumbnail' && rewardDoc.thumbnailStoragePath
          ? rewardDoc.thumbnailStoragePath
          : rewardDoc.storagePath;

      if (!targetPath) {
        res.status(404).json({ error: 'Reward asset file path not configured' });
        return;
      }

      // Step 4: Stream binary buffer via backend ADC
      const buffer = await this.deps.storage.downloadImage(targetPath);

      const ext = targetPath.toLowerCase().split('.').pop() || 'png';
      const contentType =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Cache-Control',
        type === 'thumbnail' ? 'private, max-age=1800' : 'private, no-transform, max-age=1800',
      );

      if (type === 'master') {
        const safeTitle = rewardDoc.title.replace(/[^\w\s.-]/gi, '_') || 'rebecca-reward';
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(safeTitle)}.${ext}"`,
        );
      } else {
        res.setHeader('Content-Disposition', 'inline');
      }

      res.status(200).send(buffer);
    } catch (error) {
      logger.error('[PublicSupportController] downloadReward failed', error);
      res.status(500).json({ error: 'Failed to download reward image' });
    }
  };
}
