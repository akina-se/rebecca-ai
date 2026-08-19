import { Router } from 'express';
import { ConfigController } from './controller';

/**
 * Initializes the Config module router.
 * 
 * @returns An Express Router configured with public configuration endpoints.
 */
export function initializeConfigModule(): Router {
  const router = Router();
  const controller = new ConfigController();

  router.get('/', controller.getConfig);

  return router;
}
