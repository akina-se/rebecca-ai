import { Router } from 'express';
import { GlobalDreamingController } from './controller';
import { GlobalDreamingUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createGlobalDreamingRouter } from './routes';

/**
 * Bootstraps the global dreaming module by assembling the use case, controller, and router.
 * 
 * @param deps - The application dependencies required to instantiate the use case.
 * @returns A configured Express Router for the dreaming module.
 */
export const createGlobalDreamingModule = (deps: AppDependencies): Router => {
    const useCase = new GlobalDreamingUseCase(deps);
    const controller = new GlobalDreamingController(useCase);
    return createGlobalDreamingRouter(controller);
};