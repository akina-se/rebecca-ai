import { Router } from 'express';
import { SelfReflectionController } from './controller';

/**
 * Creates and configures Express routes for the self-reflection module.
 *
 * @param controller - The controller instance handling matched routes.
 * @returns An Express Router configured with self-reflection endpoints.
 */
export const createSelfReflectionRouter = (controller: SelfReflectionController): Router => {
  const router = Router();
  router.post('/', controller.handle);
  router.get('/', controller.handle);
  return router;
};
