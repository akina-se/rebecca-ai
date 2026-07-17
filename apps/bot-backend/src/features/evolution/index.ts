import { Router } from 'express';
import { GlobalEvolutionController } from './controller';
import { GlobalEvolutionUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createGlobalEvolutionRouter } from './routes';

/**
 * Bootstraps the global evolution module by assembling its use case, controller, and router.
 * 
 * @param deps - The application dependencies required to instantiate the use case.
 * @returns A configured Express Router for the evolution module.
 */
export const createGlobalEvolutionModule = (deps: AppDependencies): Router => {
    const useCase = new GlobalEvolutionUseCase(deps);
    const controller = new GlobalEvolutionController(useCase);
    return createGlobalEvolutionRouter(controller);
};