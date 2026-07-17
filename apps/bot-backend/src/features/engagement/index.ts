import { Router } from 'express';
import { RandomEngagementController } from './controller';
import { RandomEngagementUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createRandomEngagementRouter } from './routes';

/**
 * Bootstraps the random engagement module by assembling its use case, controller, and router.
 * 
 * @param deps - The application dependencies required to instantiate the use case.
 * @returns A configured Express Router for the engagement module.
 */
export const createRandomEngagementModule = (deps: AppDependencies): Router => {
    const useCase = new RandomEngagementUseCase(deps);
    const controller = new RandomEngagementController(useCase);
    return createRandomEngagementRouter(controller);
};