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
    timezone: config.appTimezone,
  },
): { campaignsRouter: Router; publicCampaignImagesRouter: Router } {
  const campaignsRouter = Router();
  const publicCampaignImagesRouter = Router();

  const repo = new CampaignsRepository(firestore);
  const useCase = new CampaignsUseCase(repo, storage, campaignConfig);
  const controller = new CampaignsController(useCase);

  // Public image streaming endpoint (no auth required for browser <img> & lightbox)
  publicCampaignImagesRouter.get('/:id/assets/:filename', controller.getAssetImage);

  // Listing & Creation
  campaignsRouter.get('/', controller.list);
  campaignsRouter.post('/', controller.create);

  // Specific Actions before :id
  campaignsRouter.post('/:id/clone', controller.clone);
  campaignsRouter.post('/:id/pause', controller.pause);
  campaignsRouter.post('/:id/resume', controller.resume);
  campaignsRouter.post('/:id/assets', upload.single('file'), controller.uploadAsset);
  campaignsRouter.delete('/:id/assets/:filename', controller.deleteAsset);
  campaignsRouter.get('/:id/assets/:filename', controller.getAssetImage);

  // Single Item CRUD
  campaignsRouter.get('/:id', controller.getById);
  campaignsRouter.put('/:id', controller.update);
  campaignsRouter.delete('/:id', controller.delete);

  return { campaignsRouter, publicCampaignImagesRouter };
}
