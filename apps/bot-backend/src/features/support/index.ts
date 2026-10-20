/**
 * @fileoverview Module factory for the support appreciation post feature.
 */

import { Router } from 'express';
import { AppDependencies } from '../../types';
import { SupportTaskUseCase } from './usecase';
import { SupportTaskController } from './controller';
import { createSupportTaskRouter } from './routes';

export * from './types';
export * from './sanitizer';
export * from './repository';
export * from './usecase';
export * from './controller';

/**
 * Creates and configures the support task worker router.
 *
 * @param deps Injected application dependencies.
 * @returns Configured Express Router.
 */
export const createSupportTaskModule = (deps: AppDependencies): Router => {
  const useCase = new SupportTaskUseCase(deps);
  const controller = new SupportTaskController(useCase);
  return createSupportTaskRouter(controller);
};
