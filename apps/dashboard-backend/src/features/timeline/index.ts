import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { TimelineRepository } from './repository';
import { TimelineUseCase } from './usecase';
import { TimelineController } from './controller';

/**
 * Initializes the timeline feature module by injecting dependencies and setting up Express routes.
 * 
 * @param firestore - The Firestore database instance used for data access.
 * @returns An object containing configured Express routers for the dashboard and posts.
 */
export function initializeTimelineModule(firestore: Firestore): { dashboardRouter: Router, postsRouter: Router } {
  const dashboardRouter = Router();
  const postsRouter = Router();
  
  const repo = new TimelineRepository(firestore);
  const useCase = new TimelineUseCase(repo);
  const controller = new TimelineController(useCase);

  dashboardRouter.get('/metrics', controller.getMetrics.bind(controller));
  dashboardRouter.get('/alerts', controller.getAlerts.bind(controller));

  postsRouter.get('/', controller.getPosts.bind(controller));
  postsRouter.delete('/', controller.deletePosts.bind(controller));
  postsRouter.get('/:id', controller.getPostById.bind(controller));

  return { dashboardRouter, postsRouter };
}
