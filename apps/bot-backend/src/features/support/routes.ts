/**
 * @fileoverview Router for support post task worker endpoints.
 */

import { Router } from 'express';
import { SupportTaskController } from './controller';

export const createSupportTaskRouter = (controller: SupportTaskController): Router => {
  const router = Router();
  router.post('/', controller.handle);
  router.get('/', controller.handle);
  return router;
};
