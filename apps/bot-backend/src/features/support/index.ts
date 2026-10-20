/**
 * @fileoverview Composition root for the support appreciation feature.
 * Exports domain interfaces, sanitizer utilities, repository, use case, and route factory.
 */

import { Router } from 'express';
import { AppDependencies } from '../../types';
import appConfig from '../../config';
import { SupportTaskUseCase } from './usecase';
import { SupportTaskController } from './controller';
import { createSupportTaskRouter } from './routes';
import { SupportConfig } from './types';

export * from './types';
export * from './sanitizer';
export * from './repository';
export * from './usecase';
export * from './controller';

/**
 * Creates and configures the support task worker router with injected dependencies.
 *
 * @param deps - Injected application dependencies.
 * @param config - Optional configuration override for support settings.
 * @returns Configured Express Router.
 */
export const createSupportTaskModule = (
  deps: AppDependencies,
  config?: Partial<SupportConfig>,
): Router => {
  const supportConfig = config || appConfig.support;
  const useCase = new SupportTaskUseCase(deps, supportConfig);
  const controller = new SupportTaskController(useCase);
  return createSupportTaskRouter(controller);
};
