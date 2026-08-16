import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { CopilotUseCase } from './usecase';
import { CopilotController } from './controller';
import { TimelineRepository } from '../timeline/repository';
import { UsersRepository } from '../users/repository';
import { AssetsRepository } from '../assets/repository';
import { SystemMemoryRepository } from '../system-memory/repository';

/**
 * Initializes the Copilot feature module, setting up dependencies and routes.
 * 
 * @param firestore - Optional Firestore instance to initialize repository data access.
 * @returns An Express Router configured with the Copilot routes.
 */
export function initializeCopilotModule(firestore?: Firestore): Router {
  const router = Router();
  
  let timelineRepo: TimelineRepository | undefined;
  let usersRepo: UsersRepository | undefined;
  let assetsRepo: AssetsRepository | undefined;
  let memoryRepo: SystemMemoryRepository | undefined;

  if (firestore) {
    timelineRepo = new TimelineRepository(firestore);
    usersRepo = new UsersRepository(firestore);
    assetsRepo = new AssetsRepository(firestore);
    memoryRepo = new SystemMemoryRepository(firestore);
  }

  const useCase = new CopilotUseCase(timelineRepo, usersRepo, assetsRepo, memoryRepo);
  const controller = new CopilotController(useCase);

  router.post('/chat', controller.chat.bind(controller));

  return router;
}
