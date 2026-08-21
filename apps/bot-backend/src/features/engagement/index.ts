import { Router } from 'express';
import { RandomEngagementController } from './controller';
import { RandomEngagementUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createRandomEngagementRouter } from './routes';

/**
 * Initializes and configures the random engagement module.
 * Bootstraps the necessary use case, controller, and router instances to expose the engagement API endpoints.
 * 
 * @param deps - The application dependencies required to instantiate the module components.
 * @returns A fully configured Express Router instance for the random engagement module.
 */
export const createRandomEngagementModule = (deps: AppDependencies): Router => {
    const useCase = new RandomEngagementUseCase(deps);
    const controller = new RandomEngagementController(useCase);
    return createRandomEngagementRouter(controller);
};