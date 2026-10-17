/**
 * @fileoverview Express route definitions for the X Poll & Result Reaction feature.
 */

import { Router } from 'express';
import { PollController } from './controller';

/**
 * Configures the Express routes for the X Poll & Result Reaction feature.
 *
 * @param controller - The PollController instance handling HTTP requests.
 * @returns An Express Router configured with `/create` and `/result` endpoints.
 */
export const createPollRouter = (controller: PollController): Router => {
  const router = Router();
  router.post('/create', controller.handleCreate);
  router.get('/create', controller.handleCreate);
  router.post('/result', controller.handleResult);
  router.get('/result', controller.handleResult);
  return router;
};
