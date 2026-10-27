import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { SupportersRepository } from './repository';
import { SupportersUseCase } from './usecase';
import { SupportersController } from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max per image
    files: 1,
  },
});

/**
 * Initializes the supporters feature module by injecting dependencies and setting up Express routes.
 *
 * @param firestore - Firestore instance.
 * @param storage - Cloud Storage instance.
 * @returns Routers for protected supporter endpoints.
 */
export function initializeSupportersModule(
  firestore: Firestore,
  storage: Storage,
): { supportersRouter: Router } {
  const supportersRouter = Router();

  const repo = new SupportersRepository(firestore);
  const useCase = new SupportersUseCase(repo, storage);
  const controller = new SupportersController(useCase);

  // Protected endpoints (All endpoints require verifyAuth when mounted)
  // Support tier plans endpoint
  supportersRouter.get('/plans', controller.getPlans.bind(controller));
  supportersRouter.get('/', controller.getLedger.bind(controller));
  supportersRouter.post('/manual-entry', controller.manualEntry.bind(controller));

  // Reward catalog endpoints
  supportersRouter.get('/rewards', controller.getRewards.bind(controller));
  supportersRouter.post('/rewards', upload.single('file'), controller.uploadReward.bind(controller));
  supportersRouter.get('/rewards/:id/image', controller.getRewardImage.bind(controller));
  supportersRouter.patch('/rewards/:id', controller.updateReward.bind(controller));
  supportersRouter.delete('/rewards/:id', controller.deleteReward.bind(controller));

  // Transaction specific endpoints
  supportersRouter.get('/:id', controller.getById.bind(controller));
  supportersRouter.patch('/:id', controller.update.bind(controller));
  supportersRouter.delete('/:id', controller.delete.bind(controller));
  supportersRouter.post('/:id/retry', controller.retry.bind(controller));
  supportersRouter.post('/:id/manual-resolve', controller.manualResolve.bind(controller));

  return { supportersRouter };
}
