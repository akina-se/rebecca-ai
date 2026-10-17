/**
 * @fileoverview Module entry point and factory for the X Poll & Result Reaction feature.
 */

import { Router } from 'express';
import { PollController } from './controller';
import { PollUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createPollRouter } from './routes';
import { CampaignGuard } from '../campaign';
import config from '../../config';

export { PollUseCase } from './usecase';
export * from './types';

/**
 * Creates and configures the router module for the X Poll & Result Reaction feature.
 *
 * @param deps - The application dependencies.
 * @returns An Express Router instance configured with poll routes.
 */
export const createPollModule = (deps: AppDependencies): Router => {
  const useCase = new PollUseCase(deps, {
    timezone: config.appTimezone,
    durationMinutes: config.poll.durationMinutes,
  });
  const campaignGuard = new CampaignGuard(deps.firestore);
  const controller = new PollController(useCase, campaignGuard);
  return createPollRouter(controller);
};
