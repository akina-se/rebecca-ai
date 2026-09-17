import { Router } from 'express';
import { AppDependencies } from '../../types';
import { GlobalDreamingUseCase } from './usecase';
import { GlobalDreamingController } from './controller';
import { createGlobalDreamingRouter } from './routes';

export * from './types';
export * from './usecase';
export * from './controller';
export * from './routes';

/**
 * Initializes and configures the global dreaming module.
 * 
 * This factory function wires together the core components of the dreaming feature,
 * including the use case, controller, and routing logic, using the provided application dependencies.
 * 
 * @param deps - The application-level dependencies required to instantiate the module components.
 * @returns An Express Router instance configured with the global dreaming routes.
 */
export const createGlobalDreamingModule = (deps: AppDependencies): Router => {
    const useCase = new GlobalDreamingUseCase(deps);
    const controller = new GlobalDreamingController(useCase);
    return createGlobalDreamingRouter(controller);
};