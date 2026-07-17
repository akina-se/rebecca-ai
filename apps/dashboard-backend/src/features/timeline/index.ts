import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { TimelineRepository } from './repository';
import { TimelineUseCase } from './usecase';
import { TimelineController } from './controller';

export function initializeTimelineModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new TimelineRepository(firestore);
  const useCase = new TimelineUseCase(repo);
  const controller = new TimelineController(useCase);

  router.get('/metrics', controller.getMetrics.bind(controller));
  router.get('/posts', controller.getPosts.bind(controller));
  router.delete('/posts', controller.deletePosts.bind(controller));
  router.get('/posts/:id', controller.getPostById.bind(controller));

  return router;
}
