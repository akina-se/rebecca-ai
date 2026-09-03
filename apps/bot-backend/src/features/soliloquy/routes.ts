import { Router } from 'express';
import { SoliloquyController } from './controller';

/**
 * Configures the Express routes for the Autonomous Soliloquy feature.
 * @param controller The SoliloquyController instance.
 * @returns An Express Router configured with soliloquy endpoints.
 */
export const createSoliloquyRouter = (controller: SoliloquyController): Router => {
  const router = Router();
  router.post('/', controller.handle);
  router.get('/', controller.handle);
  return router;
};
