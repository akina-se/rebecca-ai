import { Router } from 'express';
import { StealthOnboardingController } from './controller';
import { StealthOnboardingUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createStealthOnboardingRouter } from './routes';

import config from '../../config';

/**
 * Creates and configures the stealth onboarding module router.
 * 
 * @param deps The application dependencies.
 * @returns The configured Express Router for the stealth onboarding module.
 */
export const createStealthOnboardingModule = (deps: AppDependencies): Router => {
    const useCase = new StealthOnboardingUseCase(deps, {
        myUserId: config.xApi.myUserId,
        targetListId: config.xApi.targetListId,
        followersPageSize: config.xApi.followersPageSize,
        followersMaxResults: config.xApi.followersMaxResults,
    });
    const controller = new StealthOnboardingController(useCase);
    return createStealthOnboardingRouter(controller);
};