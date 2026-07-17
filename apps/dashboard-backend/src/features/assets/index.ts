import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { AssetsRepository } from './repository';
import { AssetsUseCase } from './usecase';
import { AssetsController } from './controller';

/**
 * Initializes the assets feature module, setting up dependencies and routes.
 * 
 * @param firestore - The Firestore instance used for database operations.
 * @returns An Express Router configured with the assets routes.
 */
export function initializeAssetsModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new AssetsRepository(firestore);
  const useCase = new AssetsUseCase(repo);
  const controller = new AssetsController(useCase);

  router.get('/', controller.getAll.bind(controller));
  router.post('/', controller.upload.bind(controller));
  router.delete('/', controller.deleteMany.bind(controller));
  router.put('/:id', controller.update.bind(controller));
  router.post('/regenerate-captions', controller.regenerateCaptions.bind(controller));

  return router;
}
