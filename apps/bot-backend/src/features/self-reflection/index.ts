import { Router } from 'express';
import { AppDependencies } from '../../types';
import { SelfReflectionUseCase, SelfReflectionConfig } from './usecase';
import { SelfReflectionController } from './controller';
import { createSelfReflectionRouter } from './routes';

export * from './types';
export * from './usecase';
export * from './controller';
export * from './routes';

/**
 * Initializes and wires the self-reflection module.
 *
 * @param deps - Application dependencies.
 * @param config - Optional configuration for timeline post limits.
 * @returns Express Router for the self-reflection endpoints.
 */
export const createSelfReflectionModule = (
  deps: AppDependencies,
  config?: SelfReflectionConfig,
): Router => {
  const useCase = new SelfReflectionUseCase(deps, config);
  const controller = new SelfReflectionController(useCase);
  return createSelfReflectionRouter(controller);
};
