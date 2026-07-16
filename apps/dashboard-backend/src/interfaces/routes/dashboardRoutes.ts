import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';

export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();

  // GET /api/v1/dashboard/stats
  router.get('/stats', controller.getStats);

  return router;
}
