/**
 * @fileoverview Express router configuring public API endpoints for the Rebecca AI bot.
 *
 * Includes:
 * - Public support session verification: GET /api/support/verify-session
 * - Public special thanks credits: GET /api/support/credits
 * - Public Stripe webhooks: POST /api/webhooks/stripe
 */

import { Router } from 'express';
import { AppDependencies } from '../types';
import config from '../config';
import { PublicSupportController } from '../features/support/publicController';

/**
 * Creates and mounts public API routes.
 *
 * @param deps - Injected application dependencies.
 * @param controller - Optional pre-instantiated PublicSupportController for testing.
 * @returns Configured Express Router.
 */
export const createPublicRoutes = (
  deps: AppDependencies,
  controller?: PublicSupportController,
): Router => {
  const router = Router();
  const supportController = controller || new PublicSupportController(deps, config.support);

  // Support Verification, Credits & Plans
  router.get('/support/verify-session', supportController.verifySession);
  router.get('/support/credits', supportController.getCredits);
  router.get('/support/plans', supportController.getSupportPlans);
  router.get('/support/rewards/download', supportController.downloadReward);

  // Stripe Webhook Endpoint
  router.post('/webhooks/stripe', supportController.handleWebhook);

  return router;
};
