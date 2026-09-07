import { Router } from 'express';
import { ProactiveAnniversaryController } from './controller';

/**
 * Configures the Express routes for the Proactive Anniversary feature.
 *
 * @param controller The ProactiveAnniversaryController instance to handle route requests.
 * @returns An Express Router configured with proactive anniversary endpoints.
 */
export const createProactiveAnniversaryRouter = (controller: ProactiveAnniversaryController): Router => {
  const router = Router();
  router.post('/', controller.handle);
  router.get('/', controller.handle);
  return router;
};
