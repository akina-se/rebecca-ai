import { Router } from 'express';
import { AppDependencies } from '../../types';
import { CampaignPostUseCase } from './usecase';
import { CampaignPostController } from './controller';
import { createCampaignPostRouter } from './routes';
import config from '../../config';

export * from './types';
export * from './guard';
export * from './usecase';
export * from './controller';
export * from './routes';

/**
 * Creates and configures the router module for the Narrative Event Campaign Post batch.
 *
 * @param deps - Injected application dependencies.
 * @returns Configured Express Router.
 */
export const createCampaignPostModule = (deps: AppDependencies): Router => {
  const useCase = new CampaignPostUseCase(deps, {
    timezone: config.appTimezone,
    bucketName: config.images.bucketName,
  });
  const controller = new CampaignPostController(useCase);
  return createCampaignPostRouter(controller);
};
