import { Router } from 'express';
import { StatsController } from './controller';

export function createStatsRouter(controller: StatsController): Router {
  const router = Router();
  router.get('/', controller.getStats);
  return router;
}
