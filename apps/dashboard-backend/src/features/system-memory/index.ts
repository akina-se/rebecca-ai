import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { SystemMemoryRepository } from './repository';
import { SystemMemoryUseCase } from './usecase';
import { SystemMemoryController } from './controller';

/**
 * Initializes the system memory feature module, setting up dependencies and routes.
 * 
 * @param firestore - The Firestore instance used for database operations.
 * @returns An Express Router configured with the system memory routes.
 */
export function initializeSystemMemoryModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new SystemMemoryRepository(firestore);
  const useCase = new SystemMemoryUseCase(repo);
  const controller = new SystemMemoryController(useCase);

  router.get('/layers', controller.getLayers.bind(controller));
  router.get('/core', controller.getCoreMemory.bind(controller));
  router.get('/extended', controller.getExtendedMemory.bind(controller));
  router.put('/extended', controller.updateExtendedMemory.bind(controller));
  router.get('/global', controller.getGlobalMemory.bind(controller));
  router.put('/global', controller.updateGlobalMemory.bind(controller));
  router.post('/force-dreaming', controller.triggerDreaming.bind(controller));

  return router;
}
