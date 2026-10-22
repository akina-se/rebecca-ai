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
import { SUPPORT_TIER_CONFIG, resolveSupportTierFromAmount, SupportTransactionDoc } from '@rebecca/types';
import { logger } from '../../utils/logger';

/**
 * Controller managing public-facing support endpoints.
 */
export class PublicSupportController {
  private readonly stripeClient: Stripe;

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
    this.stripeClient =
      stripeClient ||
      new Stripe(this.config.stripeSecretKey || 'sk_test_unconfigured_placeholder');
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
      const transaction = await this.deps.firestore.getSupportTransactionBySessionId(sessionId);

      // Step 4: Fetch active supporter reward illustration asset
      const activeReward = await this.deps.firestore.getActiveRewardImage();

      let rewardPayload = null;
      if (activeReward) {
        const expiresInMinutes = 30;
        const signedUrl = await this.deps.storage.generateSignedUrl(
          activeReward.storagePath,
          expiresInMinutes,
        );

        // Record distribution telemetry
        await this.deps.firestore.incrementRewardImageDistributedCount(activeReward.id);

        rewardPayload = {
          title: activeReward.title,
          imageUrl: signedUrl,
          expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
        };
      }

      const amount = session.amount_total ?? 0;
      const tierInfo = resolveSupportTierFromAmount(amount);

      res.status(200).json({
        valid: true,
        tier: transaction?.tier ?? tierInfo.tier,
        itemLabel: transaction?.itemLabel ?? tierInfo.itemLabel,
        safeName: transaction?.safeName,
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
      const credits = await this.deps.firestore.getPublicSupporters(100);
      res.status(200).json({ credits });
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

      res.status(200).json({ plans });
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

    let event: Stripe.Event;

    try {
      if (webhookSecret && signature) {
        const rawBody = (req as { rawBody?: Buffer }).rawBody;
        if (!rawBody) {
          logger.warn('[PublicSupportController] Missing rawBody for Stripe webhook signature verification');
          res.status(400).json({ error: 'Webhook Error: Missing raw request body' });
          return;
        }
        event = this.stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else {
        // Fallback in unconfigured dev environments
        event = req.body as Stripe.Event;
      }
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

        // Extract custom fields safely
        const customFields = session.custom_fields || [];
        const rawNameField = customFields.find(
          (f) => f.key === 'supporter_name',
        );
        const rawName = rawNameField?.text?.value?.trim() || '';

        const visibilityField = customFields.find(
          (f) => f.key === 'credit_visibility',
        );
        const creditVisibility = visibilityField?.dropdown?.value === 'hide' ? 'hide' : 'show';

        const amount = session.amount_total ?? 0;
        if (amount <= 0) {
          logger.warn('[PublicSupportController] Non-positive amount in checkout session', {
            sessionId: session.id,
            amount,
          });
          res.status(400).json({ error: 'Invalid payment amount' });
          return;
        }
        const { tier, itemLabel } = resolveSupportTierFromAmount(amount);
        const activeReward = await this.deps.firestore.getActiveRewardImage();

        const transactionId = `tx_${session.id.replace('cs_', '').replace('test_', '')}`;
        const transactionDoc: SupportTransactionDoc = {
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
          rewardImageId: activeReward?.id ?? 'none',
          status: 'pending',
          isBanned: false,
          createdAt: new Date().toISOString(),
        };

        await this.deps.firestore.createSupportTransaction(transactionDoc);
        logger.info('[PublicSupportController] Created support transaction', { transactionId });

        // Enqueue autonomous appreciation post task via Cloud Tasks
        await this.deps.tasks.enqueueSupportTask({ transactionId });

        res.status(200).json({ received: true, transactionId });
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
}
