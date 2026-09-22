import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { config } from '../../config';
import { CampaignsRepository } from './repository';
import { CampaignsUseCase, CampaignsUseCaseConfig } from './usecase';
import { CampaignsController } from './controller';

export * from './repository';
export * from './usecase';
export * from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max per illustration
  },
});

/**
 * Initializes the Campaign feature module.
 *
 * @param firestore - The Firestore database instance.
 * @param storage - Optional GCS Storage instance for DI (defaults to new Storage()).
 * @param campaignConfig - Optional campaign configuration for DI (defaults to config.gcp.imageBucketName).
 * @returns Configured Express Router for /campaigns endpoints.
 */
export function initializeCampaignsModule(
  firestore: Firestore,
  storage: Storage = new Storage(),
  campaignConfig: CampaignsUseCaseConfig = {
    imageBucketName: config.gcp.imageBucketName,
  },
): Router {
  const router = Router();

  const repo = new CampaignsRepository(firestore);
  const useCase = new CampaignsUseCase(repo, storage, campaignConfig);
  const controller = new CampaignsController(useCase);

  // Listing & Creation
  router.get('/', controller.list);
  router.post('/', controller.create);

  // Specific Actions before :id
  router.post('/:id/clone', controller.clone);
  router.post('/:id/pause', controller.pause);
  router.post('/:id/resume', controller.resume);
  router.post('/:id/assets', upload.single('file'), controller.uploadAsset);

  // Single Item CRUD
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}
