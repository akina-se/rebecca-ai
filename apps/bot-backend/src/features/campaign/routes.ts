import { Router } from 'express';
import { CampaignPostController } from './controller';

/**
 * Creates the router for the campaign post feature.
 *
 * @param controller - The CampaignPostController instance.
 * @returns An Express Router configured with GET and POST handlers.
 */
export const createCampaignPostRouter = (controller: CampaignPostController): Router => {
  const router = Router();
  router.get('/', controller.handle);
  router.post('/', controller.handle);
  return router;
};
