import { Router } from 'express';
import { SoliloquyController } from './controller';
import { SoliloquyUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createSoliloquyRouter } from './routes';

export { SoliloquyUseCase, SoliloquyResult } from './usecase';

import config from '../../config';

/**
 * Creates and configures the router module for the Autonomous Soliloquy feature.
 * @param deps The application dependencies.
 * @returns An Express Router instance configured with soliloquy routes.
 */
export const createSoliloquyModule = (deps: AppDependencies): Router => {
  const useCase = new SoliloquyUseCase(deps, { timezone: config.appTimezone });
  const controller = new SoliloquyController(useCase);
  return createSoliloquyRouter(controller);
};
