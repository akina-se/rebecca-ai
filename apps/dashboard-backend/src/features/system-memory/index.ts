import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { SystemMemoryRepository } from './repository';
import { SystemMemoryUseCase } from './usecase';
import { SystemMemoryController } from './controller';

export function initializeSystemMemoryModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new SystemMemoryRepository(firestore);
  const useCase = new SystemMemoryUseCase(repo);
  const controller = new SystemMemoryController(useCase);

  router.get('/layers', controller.getLayers.bind(controller));
  router.get('/core', controller.getCoreMemory.bind(controller));
  router.get('/global', controller.getGlobalMemory.bind(controller));
  router.put('/global', controller.updateGlobalMemory.bind(controller));
  router.post('/force-dreaming', controller.triggerDreaming.bind(controller));

  return router;
}
