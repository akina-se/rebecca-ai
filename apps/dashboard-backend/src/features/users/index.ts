import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { UsersRepository } from './repository';
import { UsersUseCase } from './usecase';
import { UsersController } from './controller';

/**
 * Initializes the users feature module by injecting dependencies and setting up Express routes.
 * 
 * @param firestore - The Firestore database instance used for data access.
 * @returns An Express Router configured with the user-related routes.
 */
export function initializeUsersModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new UsersRepository(firestore);
  const useCase = new UsersUseCase(repo);
  const controller = new UsersController(useCase);

  router.get('/', controller.getAll.bind(controller));
  router.put('/status', controller.bulkUpdateStatus.bind(controller)); // Bulk update status
  
  router.get('/:id', controller.getById.bind(controller));
  router.put('/:id/memory', controller.updateMemory.bind(controller));

  return router;
}
